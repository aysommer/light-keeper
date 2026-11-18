import type { Vector2 } from '../math/Vector2.ts';
import type { GridEdge } from './GridEdge.ts';

/** Дверной проём между двумя комнатами (или между чанками). */
export class Door {
  public constructor(
    public readonly edge: GridEdge,
    /** Центр проёма в мировых координатах. */
    public readonly position: Vector2,
    public readonly width: number,
    /** Комната с меньшей координатой (снизу/слева); `null` — комната соседнего чанка. */
    public readonly roomA: string | null,
    /** Комната с большей координатой (сверху/справа); `null` — комната соседнего чанка. */
    public readonly roomB: string | null,
  ) {}
}
