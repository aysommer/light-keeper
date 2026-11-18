import type { AABB } from '../math/AABB.ts';
import type { Vector2 } from '../math/Vector2.ts';
import type { Door } from './Door.ts';
import type { Obstacle } from './Obstacle.ts';
import type { Room } from './Room.ts';
import type { Wall } from './Wall.ts';

/** Сгенерированный сегмент мира. */
export class Chunk {
  public constructor(
    public readonly index: number,
    public readonly bounds: AABB,
    public readonly rooms: readonly Room[],
    public readonly walls: readonly Wall[],
    /** Все двери чанка, включая входную и выходную. */
    public readonly doors: readonly Door[],
    /** Дверь из предыдущего чанка. У нулевого чанка её нет — там стартовая стена. */
    public readonly entryDoor: Door | null,
    /** Дверь в следующий чанк (на верхней границе). */
    public readonly exitDoor: Door,
  ) {}

  public get obstacles(): Obstacle[] {
    return this.rooms.flatMap((room) => room.obstacles);
  }

  public get oilSpawns(): Vector2[] {
    return this.rooms.flatMap((room) => room.oilSpawns);
  }

  public roomAt(point: Vector2): Room | undefined {
    return this.rooms.find((room) => room.bounds.containsPoint(point));
  }
}
