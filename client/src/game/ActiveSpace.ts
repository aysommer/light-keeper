import type { Scene, Vector3 } from 'three';
import { CollisionWorld, PlayerMovement, SpaceGenerator } from '@light-keeper/shared';
import type { DroppedCanister, ExitSnapshot, Space } from '@light-keeper/shared';
import { CanisterField } from '../scene/CanisterField.ts';
import { CeilingLightPool } from '../scene/CeilingLightPool.ts';
import type { CeilingPanelLight } from '../scene/CeilingLightPool.ts';
import { ExitDoorView } from '../scene/ExitDoorView.ts';
import { KeyView } from '../scene/KeyView.ts';
import { NoteView } from '../scene/NoteView.ts';
import { TapeRecorderView } from '../scene/TapeRecorderView.ts';
import { MaterialLibrary } from '../scene/MaterialLibrary.ts';
import type { SpaceDetail } from '../scene/MaterialLibrary.ts';
import { SceneCoords } from '../scene/SceneCoords.ts';
import { SpaceMeshBuilder } from '../scene/SpaceMeshBuilder.ts';
import { StairView } from '../scene/StairView.ts';
import { WaySignView } from '../scene/WaySignView.ts';
import type { SpaceView } from '../scene/SpaceView.ts';

/** Источник правила движения для текущего пространства и этажа. */
export interface MovementProvider {
  readonly movement: PlayerMovement;
  readonly spaceIndex: number;
  /** Этаж, на котором сейчас игрок (для команд ввода). */
  readonly floor: number;
}

/**
 * Текущее пространство на клиенте: карта, коллизии и 3D-представление.
 * При переходе старое пространство полностью освобождается и строится новое.
 */
export class ActiveSpace implements MovementProvider {
  private readonly generator: SpaceGenerator;
  private readonly builder = new SpaceMeshBuilder();
  private currentSpace: Space;
  /** Коллизии и правило движения — по этажам. */
  private movements: PlayerMovement[] = [];
  private collisionWorlds: CollisionWorld[] = [];
  private currentFloor = 0;
  /** Этажи на сцене (стопкой по высоте). */
  private views: SpaceView[] = [];
  private stairs: StairView[] = [];
  private sign: WaySignView | null = null;
  private door!: ExitDoorView;
  private keys: KeyView[] = [];
  private note: NoteView | TapeRecorderView | null = null;
  private canisters!: CanisterField;
  private detail: SpaceDetail;
  private readonly ceilingLights: CeilingLightPool;
  private panelLights: CeilingPanelLight[] = [];

  public constructor(
    matchSeed: number,
    private readonly scene: Scene,
    detail: SpaceDetail = MaterialLibrary.NO_DETAIL,
  ) {
    this.detail = detail;
    this.ceilingLights = new CeilingLightPool(scene);
    this.generator = new SpaceGenerator(matchSeed);
    this.currentSpace = this.generator.generate(0);
    this.build();
  }

  public get space(): Space {
    return this.currentSpace;
  }

  public get spaceIndex(): number {
    return this.currentSpace.index;
  }

  /** Этаж, на котором сейчас этот игрок. */
  public get floor(): number {
    return this.currentFloor;
  }

  public setFloor(floor: number): void {
    this.currentFloor = Math.max(0, Math.min(this.currentSpace.floorCount - 1, floor));
  }

  /** Коллизии этажа игрока (для прямой видимости при обмене). */
  public get collisions(): CollisionWorld {
    return this.collisionWorlds[this.currentFloor] ?? this.collisionWorlds[0]!;
  }

  public get movement(): PlayerMovement {
    return this.movements[this.currentFloor] ?? this.movements[0]!;
  }

  /** Галочки графики материалов: сразу для текущего пространства и для следующих. */
  public setDetail(detail: SpaceDetail): void {
    this.detail = detail;
    this.views.forEach((view) => view.materials.setDetail(detail));
  }

  public enter(index: number): void {
    if (index === this.currentSpace.index) {
      return;
    }
    this.disposeViews();
    this.currentSpace = this.generator.generate(index);
    this.currentFloor = 0;
    this.build();
  }

  /**
   * Анимация пространства, двери, ключей и канистр по последнему состоянию с сервера.
   * @param viewer где игрок (сцена) — свет потолочных панелей вокруг него
   */
  public update(
    exit: ExitSnapshot | null,
    oilTaken: readonly number[] | null,
    oilDropped: readonly DroppedCanister[] | null,
    deltaSeconds: number,
    time: number,
    viewer: Vector3,
  ): void {
    this.views.forEach((view) => view.update(time));
    this.ceilingLights.update(
      this.panelLights,
      viewer,
      this.currentFloor,
      this.views[0]?.materials.flickerLit ?? true,
    );
    this.door.update(exit, deltaSeconds);
    this.keys.forEach((key) => key.update(exit, time));
    this.note?.update(exit, time);
    this.canisters.update(oilTaken, oilDropped);
  }

  public dispose(): void {
    this.disposeViews();
    this.ceilingLights.dispose();
  }

  private build(): void {
    const space = this.currentSpace;
    this.collisionWorlds = space.floors.map((_, floor) => CollisionWorld.fromSpace(space, floor));
    this.movements = this.collisionWorlds.map((collisions) => new PlayerMovement(collisions));
    this.views = space.floors.map((_, floor) => {
      const view = this.builder.build(space, this.detail, floor);
      this.scene.add(view.group);
      return view;
    });
    this.panelLights = this.views.flatMap((view) => [...view.panelLights]);
    this.stairs = space.stairs.map((stair) => {
      const view = new StairView(stair);
      this.scene.add(view.root);
      return view;
    });
    this.door = this.createDoor();
    this.keys = this.createKeys();
    this.note = this.createNote();
    this.sign = space.sign ? new WaySignView(space.sign) : null;
    if (this.sign) this.scene.add(this.sign.root);
    this.canisters = new CanisterField(
      this.scene,
      space.oilSpawns,
      (i) => space.isOilFull(i),
      space.oilFloors,
    );
  }

  private createDoor(): ExitDoorView {
    const space = this.currentSpace;
    const door = new ExitDoorView(
      space.exit,
      this.views[space.exitFloor]!.materials,
      space.keys.length,
    );
    door.root.position.y += SceneCoords.floorY(space.exitFloor);
    this.scene.add(door.root);
    return door;
  }

  private createKeys(): KeyView[] {
    return this.currentSpace.keys.map((position, index) => {
      const key = new KeyView(position, index, this.currentSpace.keyFloors[index] ?? 0);
      this.scene.add(key.root);
      return key;
    });
  }

  private createNote(): NoteView | TapeRecorderView | null {
    if (!this.currentSpace.note) {
      return null;
    }
    // Код — в записке или на магнитофоне, который повторяет его вслух.
    const note =
      this.currentSpace.codeHint === 'tape'
        ? new TapeRecorderView(this.currentSpace.note, this.currentSpace.noteFloor)
        : new NoteView(this.currentSpace.note, this.currentSpace.noteFloor);
    this.scene.add(note.root);
    return note;
  }

  private disposeViews(): void {
    this.canisters.dispose();
    this.keys.forEach((key) => key.dispose());
    this.note?.dispose();
    this.door.dispose();
    this.stairs.forEach((stair) => stair.dispose());
    this.sign?.dispose();
    this.views.forEach((view) => view.dispose());
  }
}
