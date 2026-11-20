import { ExchangeRules } from '@light-keeper/shared';
import type { CollisionWorld, ExchangeSnapshot, Vector2 } from '@light-keeper/shared';

/** Что сейчас видит игрок у напарника: где тот стоит и не ушёл ли в тамбур. */
export interface PartnerView {
  readonly position: Vector2;
}

/** Подсказка об обмене лампами (по тем же правилам, что и на сервере). */
export class ExchangePrompt {
  public resolve(
    exchange: ExchangeSnapshot | null,
    playerId: string,
    position: Vector2,
    yaw: number,
    partner: PartnerView | null,
    collisions: CollisionWorld,
    inTambour: boolean,
  ): string | null {
    if (!exchange || !partner || inTambour) {
      return null;
    }
    const aiming = ExchangeRules.canReach(position, yaw, partner.position, collisions);
    if (exchange.offerFromId === playerId) {
      return 'Ждём, пока напарник нажмёт E';
    }
    if (exchange.offerFromId !== null) {
      return aiming
        ? 'Напарник предлагает обмен — нажми E'
        : 'Напарник предлагает обмен — подойди и посмотри на него';
    }
    return aiming ? 'E — обменяться лампами' : null;
  }
}
