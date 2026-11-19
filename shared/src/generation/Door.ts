import type { Vector2 } from '../math/Vector2.ts';
import type { GridEdge } from './GridEdge.ts';

/** Дверной проём между двумя комнатами. */
export class Door {
  public constructor(
    public readonly edge: GridEdge,
    /** Центр проёма в мировых координатах. */
    public readonly position: Vector2,
    public readonly width: number,
    public readonly roomA: string,
    public readonly roomB: string,
  ) {}
}
