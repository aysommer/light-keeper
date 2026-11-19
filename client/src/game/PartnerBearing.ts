import { PlayerMovement } from '@light-keeper/shared';
import type { Vector2 } from '@light-keeper/shared';

/** Направление на напарника относительно взгляда игрока (для компаса). */
export class PartnerBearing {
  /**
   * Угол по часовой стрелке от направления взгляда до напарника, рад, в (−π, π].
   * 0 — напарник прямо по курсу, π/2 — справа, π — позади, −π/2 — слева.
   */
  public static clockwiseFromForward(from: Vector2, yaw: number, to: Vector2): number {
    const offset = to.sub(from);
    if (offset.lengthSquared() < 1e-12) {
      return 0;
    }
    // yaw растёт против часовой стрелки, поэтому знак меняем.
    const angle = -(PlayerMovement.yawTowards(offset) - yaw);
    return Math.atan2(Math.sin(angle), Math.cos(angle));
  }
}
