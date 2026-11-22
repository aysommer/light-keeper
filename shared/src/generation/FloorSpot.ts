import type { Vector2 } from '../math/Vector2.ts';

/** Точка в пространстве с этажом: где лежит флажок или где появляется гусь. */
export interface FloorSpot {
  readonly position: Vector2;
  readonly floor: number;
}
