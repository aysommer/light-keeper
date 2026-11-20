import type { Scene } from 'three';
import { CollisionWorld, PlayerMovement, SpaceGenerator } from '@light-keeper/shared';
import type { DroppedCanister, ExitSnapshot, Space } from '@light-keeper/shared';
import { CanisterField } from '../scene/CanisterField.ts';
import { ExitDoorView } from '../scene/ExitDoorView.ts';
import { KeyView } from '../scene/KeyView.ts';
import { MaterialLibrary } from '../scene/MaterialLibrary.ts';
import type { SpaceDetail } from '../scene/MaterialLibrary.ts';
import { SpaceMeshBuilder } from '../scene/SpaceMeshBuilder.ts';
import type { SpaceView } from '../scene/SpaceView.ts';

/** Источник правила движения для текущего пространства. */
export interface MovementProvider {
  readonly movement: PlayerMovement;
  readonly spaceIndex: number;
}

/**
 * Текущее пространство на клиенте: карта, коллизии и 3D-представление.
 * При переходе старое пространство полностью освобождается и строится новое.
 */
export class ActiveSpace implements MovementProvider {
  private readonly generator: SpaceGenerator;
  private readonly builder = new SpaceMeshBuilder();
  private currentSpace: Space;
  private currentMovement: PlayerMovement;
  private currentCollisions: CollisionWorld;
  private view: SpaceView;
  private door: ExitDoorView;
  private key: KeyView | null;
  private canisters: CanisterField;
  private detail: SpaceDetail;

  public constructor(
    matchSeed: number,
    private readonly scene: Scene,
    detail: SpaceDetail = MaterialLibrary.NO_DETAIL,
  ) {
    this.detail = detail;
    this.generator = new SpaceGenerator(matchSeed);
    this.currentSpace = this.generator.generate(0);
    this.currentCollisions = CollisionWorld.fromSpace(this.currentSpace);
    this.currentMovement = new PlayerMovement(this.currentCollisions);
    this.view = this.builder.build(this.currentSpace, this.detail);
    scene.add(this.view.group);
    this.door = this.createDoor();
    this.key = this.createKey();
    this.canisters = new CanisterField(scene, this.currentSpace.oilSpawns, (i) =>
      this.currentSpace.isOilFull(i),
    );
  }

  public get space(): Space {
    return this.currentSpace;
  }

  public get spaceIndex(): number {
    return this.currentSpace.index;
  }

  /** Коллизии текущего пространства (для прямой видимости при обмене). */
  public get collisions(): CollisionWorld {
    return this.currentCollisions;
  }

  public get movement(): PlayerMovement {
    return this.currentMovement;
  }

  /** Галочки графики материалов: сразу для текущего пространства и для следующих. */
  public setDetail(detail: SpaceDetail): void {
    this.detail = detail;
    this.view.materials.setDetail(detail);
  }

  public enter(index: number): void {
    if (index === this.currentSpace.index) {
      return;
    }
    this.disposeViews();
    this.currentSpace = this.generator.generate(index);
    this.currentCollisions = CollisionWorld.fromSpace(this.currentSpace);
    this.currentMovement = new PlayerMovement(this.currentCollisions);
    this.view = this.builder.build(this.currentSpace, this.detail);
    this.scene.add(this.view.group);
    this.door = this.createDoor();
    this.key = this.createKey();
    this.canisters = new CanisterField(this.scene, this.currentSpace.oilSpawns, (i) =>
      this.currentSpace.isOilFull(i),
    );
  }

  /** Анимация пространства, двери, ключа и канистр по последнему состоянию с сервера. */
  public update(
    exit: ExitSnapshot | null,
    oilTaken: readonly number[] | null,
    oilDropped: readonly DroppedCanister[] | null,
    deltaSeconds: number,
    time: number,
  ): void {
    this.view.update(time);
    this.door.update(exit, deltaSeconds);
    this.key?.update(exit, time);
    this.canisters.update(oilTaken, oilDropped);
  }

  public dispose(): void {
    this.disposeViews();
  }

  private createDoor(): ExitDoorView {
    const door = new ExitDoorView(this.currentSpace.exit, this.view.materials);
    this.scene.add(door.root);
    return door;
  }

  private createKey(): KeyView | null {
    if (!this.currentSpace.key) {
      return null;
    }
    const key = new KeyView(this.currentSpace.key);
    this.scene.add(key.root);
    return key;
  }

  private disposeViews(): void {
    this.canisters.dispose();
    this.key?.dispose();
    this.door.dispose();
    this.view.dispose();
  }
}
