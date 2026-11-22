import type { SpacePalette } from '../appearance/SpacePalette.ts';
import type { AABB } from '../math/AABB.ts';
import type { Vector2 } from '../math/Vector2.ts';
import type { Door } from './Door.ts';
import type { SpaceFloor } from './SpaceFloor.ts';
import type { Stair } from './Stair.ts';
import type { CodeHint, ExitCode } from './ExitCode.ts';
import type { ExitDoor } from './ExitDoor.ts';
import type { Obstacle } from './Obstacle.ts';
import type { Room } from './Room.ts';
import type { RoomLayout } from './RoomLayout.ts';
import type { SpaceGrid } from './SpaceGrid.ts';
import type { Wall } from './Wall.ts';

/**
 * Одно пространство: 1–3 этажа-лабиринта, связанных лестницами, палитра,
 * точки старта (на первом этаже), дверь выхода, ключи, записка, канистры.
 * Всё, что лежит в пространстве, — с номером этажа.
 */
export class Space {
  public constructor(
    /** Номер пространства в партии: 0 — первое. */
    public readonly index: number,
    public readonly seed: number,
    public readonly grid: SpaceGrid,
    /** Этажи: [0] — первый (там старт). */
    public readonly floors: readonly SpaceFloor[],
    public readonly palette: SpacePalette,
    public readonly startRoom: Room,
    /** Точки появления: [красный, голубой] (первый этаж). */
    public readonly startPositions: readonly [Vector2, Vector2],
    /** Направление взгляда на старте (yaw, рад): на ближайший выход из стартовой комнаты. */
    public readonly startYaw: number,
    /** Спрятанная дверь выхода в следующее пространство. */
    public readonly exit: ExitDoor,
    /** На каком этаже дверь выхода. */
    public readonly exitFloor: number,
    /** Где лежат ключи (только у двери `locked`; их 1–3, нужны все). */
    public readonly keys: readonly Vector2[],
    /** Этажи ключей (параллельно `keys`). */
    public readonly keyFloors: readonly number[],
    /** Где лежит записка с кодом (только у двери `code`). */
    public readonly note: Vector2 | null,
    public readonly noteFloor: number,
    /** Код двери `code`. */
    public readonly code: ExitCode | null,
    /**
     * Где код: записка (`note`) или магнитофон (`tape`) — оба стоят в точке `note`
     * на этаже `noteFloor`. Магнитофон бывает только у кода из цифр.
     */
    public readonly codeHint: CodeHint,
    /** Лестницы между этажами (по одной на каждую пару соседних этажей). */
    public readonly stairs: readonly Stair[],
    /** Какие канистры пустые (обманки) — по индексам `oilSpawns`. */
    public readonly oilEmpty: readonly boolean[] = [],
  ) {}

  public get floorCount(): number {
    return this.floors.length;
  }

  /** Этаж по номеру (вне диапазона — первый). */
  public floor(index: number): SpaceFloor {
    return this.floors[index] ?? this.floors[0]!;
  }

  /** Первый этаж: комнаты (для одноэтажных проверок и старта). */
  public get layout(): RoomLayout {
    return this.floor(0).layout;
  }

  public get rooms(): readonly Room[] {
    return this.floor(0).rooms;
  }

  public get walls(): readonly Wall[] {
    return this.floor(0).walls;
  }

  public get doors(): readonly Door[] {
    return this.floor(0).doors;
  }

  /** Полная ли канистра с номером `index` (пустые — серые обманки). */
  public isOilFull(index: number): boolean {
    return this.oilEmpty[index] !== true;
  }

  public get bounds(): AABB {
    return this.grid.bounds;
  }

  public get obstacles(): Obstacle[] {
    return this.floor(0).obstacles;
  }

  /** Все канистры пространства на всех этажах — и полные, и пустые. */
  public get oilSpawns(): Vector2[] {
    return this.floors.flatMap((floor) => floor.rooms.flatMap((room) => room.oilSpawns));
  }

  /** Этажи канистр (параллельно `oilSpawns`). */
  public get oilFloors(): number[] {
    return this.floors.flatMap((floor) =>
      floor.rooms.flatMap((room) => room.oilSpawns.map(() => floor.index)),
    );
  }

  /** Непроходимые прямоугольники первого этажа. */
  public get colliders(): AABB[] {
    return this.floor(0).colliders;
  }

  /** Комната первого этажа в точке. */
  public roomAt(point: Vector2): Room | undefined {
    return this.floor(0).roomAt(point);
  }

  /** Лестница рядом с точкой на этаже `floor` (ближе `reach`) и куда она ведёт. */
  public stairNear(
    floor: number,
    point: Vector2,
    reach: number,
  ): { readonly stair: Stair; readonly to: number } | null {
    for (const stair of this.stairs) {
      const to = stair.targetFrom(floor);
      if (to !== null && stair.position.distanceTo(point) <= reach) {
        return { stair, to };
      }
    }
    return null;
  }
}
