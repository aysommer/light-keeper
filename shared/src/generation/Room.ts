import type { AABB } from '../math/AABB.ts';
import type { Vector2 } from '../math/Vector2.ts';
import type { CellRect } from './CellRect.ts';
import type { Obstacle } from './Obstacle.ts';
import type { RoomKind } from './RoomKind.ts';

/** Комната чанка. */
export class Room {
  public constructor(
    /** Идентификатор комнаты в пространстве: `<номер пространства>:<индекс комнаты>`. */
    public readonly id: string,
    public readonly kind: RoomKind,
    public readonly cells: CellRect,
    public readonly bounds: AABB,
    public readonly obstacles: readonly Obstacle[],
    public readonly oilSpawns: readonly Vector2[],
  ) {}
}
