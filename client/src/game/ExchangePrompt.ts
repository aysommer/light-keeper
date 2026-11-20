import { ExchangeRules } from '@light-keeper/shared';
import type { CollisionWorld, ExchangeSnapshot, Vector2 } from '@light-keeper/shared';

/** Что сейчас видит игрок у напарника: где тот стоит и не ушёл ли в тамбур. */
export interface PartnerView {
  readonly position: Vector2;
}

/** Подсказка о передаче общей лампы (по тем же правилам, что и на сервере). */
export class ExchangePrompt {
  public resolve(
    exchange: ExchangeSnapshot | null,
    playerId: string,
    position: Vector2,
    yaw: number,
    partner: PartnerView | null,
    collisions: CollisionWorld,
    inTambour: boolean,
    hasLamp: boolean,
  ): string | null {
    if (!exchange || !partner || inTambour) {
      return null;
    }
    const aiming = ExchangeRules.canReach(position, yaw, partner.position, collisions);
    if (exchange.offerFromId === playerId) {
      return 'Ждём, пока напарник нажмёт E';
    }
    if (exchange.offerFromId !== null) {
      const offer = hasLamp ? 'Напарник просит лампу' : 'Напарник отдаёт лампу';
      return aiming ? `${offer} — нажми E` : `${offer} — подойди и посмотри на него`;
    }
    if (!aiming) {
      return null;
    }
    return hasLamp ? 'E — передать лампу' : 'E — взять лампу';
  }
}
