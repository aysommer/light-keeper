import type { AABB } from '../math/AABB.ts';
import type { EdgeOrientation } from './GridEdge.ts';

/** Сегмент стены (сплошной коллайдер). */
export class Wall {
  public constructor(
    public readonly bounds: AABB,
    public readonly orientation: EdgeOrientation,
  ) {}
}
