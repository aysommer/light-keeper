import type { SpacePalette } from '../appearance/SpacePalette.ts';
import type { AABB } from '../math/AABB.ts';
import type { Vector2 } from '../math/Vector2.ts';
import type { Door } from './Door.ts';
import type { ExitDoor } from './ExitDoor.ts';
import type { Obstacle } from './Obstacle.ts';
import type { Room } from './Room.ts';
import type { RoomLayout } from './RoomLayout.ts';
import type { SpaceGrid } from './SpaceGrid.ts';
import type { Wall } from './Wall.ts';

/** Одно пространство-лабиринт: комнаты, стены, двери, палитра, точки старта. */
export class Space {
  public constructor(
    /** Номер пространства в партии: 0 — первое. */
    public readonly index: number,
    public readonly seed: number,
    public readonly grid: SpaceGrid,
    public readonly layout: RoomLayout,
    public readonly rooms: readonly Room[],
    public readonly walls: readonly Wall[],
    public readonly doors: readonly Door[],
    public readonly palette: SpacePalette,
    public readonly startRoom: Room,
    /** Точки появления: [красный, голубой]. */
    public readonly startPositions: readonly [Vector2, Vector2],
    /** Направление взгляда на старте (yaw, рад): на ближайший выход из стартовой комнаты. */
    public readonly startYaw: number,
    /** Спрятанная дверь выхода в следующее пространство. */
    public readonly exit: ExitDoor,
    /** Где лежит ключ (только для двери `locked`). */
    public readonly key: Vector2 | null,
  ) {}

  public get bounds(): AABB {
    return this.grid.bounds;
  }

  public get obstacles(): Obstacle[] {
    return this.rooms.flatMap((room) => room.obstacles);
  }

  public get oilSpawns(): Vector2[] {
    return this.rooms.flatMap((room) => room.oilSpawns);
  }

  /** Все непроходимые прямоугольники: стены и препятствия. */
  public get colliders(): AABB[] {
    return [...this.walls.map((wall) => wall.bounds), ...this.obstacles.map((o) => o.bounds)];
  }

  public roomAt(point: Vector2): Room | undefined {
    return this.rooms.find((room) => room.bounds.containsPoint(point));
  }
}
