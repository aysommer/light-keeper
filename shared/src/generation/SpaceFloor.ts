import type { AABB } from '../math/AABB.ts';
import type { Vector2 } from '../math/Vector2.ts';
import type { Door } from './Door.ts';
import type { Obstacle } from './Obstacle.ts';
import type { Room } from './Room.ts';
import type { RoomLayout } from './RoomLayout.ts';
import type { Wall } from './Wall.ts';

/** Один этаж пространства: свой лабиринт комнат со стенами и проёмами. */
export class SpaceFloor {
  public constructor(
    /** Номер этажа: 0 — первый. */
    public readonly index: number,
    public readonly layout: RoomLayout,
    public readonly rooms: readonly Room[],
    public readonly walls: readonly Wall[],
    public readonly doors: readonly Door[],
    /** Дополнительные непроходимые места: пролёты лестниц. */
    public readonly blocks: readonly AABB[] = [],
  ) {}

  public get obstacles(): Obstacle[] {
    return this.rooms.flatMap((room) => room.obstacles);
  }

  /** Все непроходимые прямоугольники этажа: стены и препятствия. */
  public get colliders(): AABB[] {
    return [
      ...this.walls.map((wall) => wall.bounds),
      ...this.obstacles.map((o) => o.bounds),
      ...this.blocks,
    ];
  }

  public roomAt(point: Vector2): Room | undefined {
    return this.rooms.find((room) => room.bounds.containsPoint(point));
  }
}
