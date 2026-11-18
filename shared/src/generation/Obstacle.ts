import type { AABB } from '../math/AABB.ts';

export type ObstacleKind = 'pillar' | 'desk';

/** Непроходимый предмет внутри комнаты. */
export class Obstacle {
  public constructor(
    public readonly kind: ObstacleKind,
    public readonly bounds: AABB,
  ) {}
}
