import type { Scene } from 'three';
import { CollisionWorld, PlayerMovement, SpaceGenerator } from '@light-keeper/shared';
import type { ExitSnapshot, Space } from '@light-keeper/shared';
import { ExitDoorView } from '../scene/ExitDoorView.ts';
import { KeyView } from '../scene/KeyView.ts';
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
  private view: SpaceView;
  private door: ExitDoorView;
  private key: KeyView | null;

  public constructor(
    matchSeed: number,
    private readonly scene: Scene,
  ) {
    this.generator = new SpaceGenerator(matchSeed);
    this.currentSpace = this.generator.generate(0);
    this.currentMovement = new PlayerMovement(CollisionWorld.fromSpace(this.currentSpace));
    this.view = this.builder.build(this.currentSpace);
    scene.add(this.view.group);
    this.door = this.createDoor();
    this.key = this.createKey();
  }

  public get space(): Space {
    return this.currentSpace;
  }

  public get spaceIndex(): number {
    return this.currentSpace.index;
  }

  public get movement(): PlayerMovement {
    return this.currentMovement;
  }

  public enter(index: number): void {
    if (index === this.currentSpace.index) {
      return;
    }
    this.disposeViews();
    this.currentSpace = this.generator.generate(index);
    this.currentMovement = new PlayerMovement(CollisionWorld.fromSpace(this.currentSpace));
    this.view = this.builder.build(this.currentSpace);
    this.scene.add(this.view.group);
    this.door = this.createDoor();
    this.key = this.createKey();
  }

  /** Анимация пространства, двери и ключа по последнему состоянию с сервера. */
  public update(exit: ExitSnapshot | null, deltaSeconds: number, time: number): void {
    this.view.update(time);
    this.door.update(exit, deltaSeconds);
    this.key?.update(exit, time);
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
    this.key?.dispose();
    this.door.dispose();
    this.view.dispose();
  }
}
