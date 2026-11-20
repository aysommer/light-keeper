import { GameConfig } from '../config/GameConfig.ts';
import type { ExchangeSettings } from '../config/GameConfig.ts';
import type { Vector2 } from '../math/Vector2.ts';
import type { CollisionWorld } from '../physics/CollisionWorld.ts';
import { PlayerMovement } from './PlayerMovement.ts';

/** Может ли игрок обратиться к напарнику для обмена — общее правило для сервера и клиента. */
export class ExchangeRules {
  /**
   * Напарник рядом, игрок смотрит на него и их не разделяет стена.
   * @param yaw направление взгляда игрока
   */
  public static canReach(
    from: Vector2,
    yaw: number,
    to: Vector2,
    collisions: CollisionWorld,
    settings: ExchangeSettings = GameConfig.exchange,
  ): boolean {
    const offset = to.sub(from);
    const distance = offset.length();
    if (distance > settings.distance || distance < 1e-6) {
      return false;
    }
    const forward = PlayerMovement.forward(yaw);
    const cosine = (forward.x * offset.x + forward.y * offset.y) / distance;
    if (cosine < Math.cos((settings.maxAngleDegrees * Math.PI) / 180)) {
      return false;
    }
    return collisions.lineOfSight(from, to);
  }
}
