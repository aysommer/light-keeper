import type { Scene, Vector3 } from 'three';
import { CollisionWorld, PlayerMovement, SpaceGenerator, Vector2 } from '@light-keeper/shared';
import type { DroppedCanister, ExitSnapshot, Space } from '@light-keeper/shared';
import { CanisterField } from '../scene/CanisterField.ts';
import { CeilingLightPool } from '../scene/CeilingLightPool.ts';
import type { CeilingPanelLight } from '../scene/CeilingLightPool.ts';
import { ExitDoorView } from '../scene/ExitDoorView.ts';
import { FloorReflection } from '../scene/FloorReflection.ts';
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
  /** Комната игрока (последняя известная — в проёме комнаты нет) и её видимые панели. */
  private lightRoom = '';
  private visiblePanels: CeilingPanelLight[] = [];
  /** Отражения на полу (галочка «Отражения»): по плоскости на этаж. */
  private reflectionsOn = false;
  private reflections: FloorReflection[] = [];

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

  /** Отражения на полу: включаются сразу и для следующих пространств. */
  public setReflections(enabled: boolean): void {
    if (enabled === this.reflectionsOn) return;
    this.reflectionsOn = enabled;
    this.rebuildReflections();
  }

  private rebuildReflections(): void {
    this.reflections.forEach((reflection) => reflection.dispose());
    this.reflections = this.reflectionsOn
      ? this.currentSpace.floors.map((_, floor) => {
          const reflection = new FloorReflection(this.currentSpace, floor);
          this.scene.add(reflection.mirror);
          return reflection;
        })
      : [];
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
    // Отражение рисуется только на этаже игрока — иначе сцена считалась бы лишний раз.
    this.reflections.forEach((reflection, floor) => {
      reflection.mirror.visible = floor === this.currentFloor;
    });
    this.ceilingLights.update(
      this.panelsSeenFrom(new Vector2(viewer.x, -viewer.z)),
      viewer,
      this.currentFloor,
      this.flickerLit,
    );
    this.door.update(exit, deltaSeconds);
    this.keys.forEach((key) => key.update(exit, time));
    this.note?.update(exit, time);
    this.canisters.update(oilTaken, oilDropped);
  }

  /** Горящие панели, под которыми сейчас стоит свет (ближние первыми). */
  public get nearbyPanels(): readonly CeilingPanelLight[] {
    return this.ceilingLights.active;
  }

  /** Горят ли сейчас мерцающие панели. */
  public get flickerLit(): boolean {
    return this.views[0]?.materials.flickerLit ?? true;
  }

  public dispose(): void {
    this.disposeViews();
    this.ceilingLights.dispose();
  }

  /**
   * Панели, свет которых может достать до игрока: все над его комнатой и в
   * соседних — только те, что над клеткой у проёма в его комнату (сквозь
   * стены свет не проходит, а через проём — да).
   */
  private panelsSeenFrom(point: Vector2): CeilingPanelLight[] {
    const floor = this.currentSpace.floor(this.currentFloor);
    const room = floor.roomAt(point);
    const key = room ? `${this.currentFloor}:${room.id}` : this.lightRoom;
    if (key === this.lightRoom) {
      return this.visiblePanels;
    }
    this.lightRoom = key;
    const roomId = room!.id;
    const grid = this.currentSpace.grid;
    const doorCells = new Set<string>();
    for (const door of floor.doors) {
      if (door.roomA !== roomId && door.roomB !== roomId) continue;
      const across = door.edge.orientation === 'horizontal' ? new Vector2(0, 1) : new Vector2(1, 0);
      for (const side of [-1, 1]) {
        const cellPoint = door.position.add(across.scale((side * grid.cellSize) / 2));
        if (floor.roomAt(cellPoint)?.id !== roomId) {
          doorCells.add(grid.cellAt(cellPoint).join(':'));
        }
      }
    }
    this.visiblePanels = this.panelLights.filter(
      (panel) =>
        panel.floor === this.currentFloor && (panel.roomId === roomId || doorCells.has(panel.cell)),
    );
    return this.visiblePanels;
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
    this.lightRoom = '';
    this.visiblePanels = [];
    this.rebuildReflections();
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
    this.reflections.forEach((reflection) => reflection.dispose());
    this.reflections = [];
    this.canisters.dispose();
    this.keys.forEach((key) => key.dispose());
    this.note?.dispose();
    this.door.dispose();
    this.stairs.forEach((stair) => stair.dispose());
    this.sign?.dispose();
    this.views.forEach((view) => view.dispose());
  }
}
