import { ExchangeRules, GameConfig } from '@light-keeper/shared';
import type { ExchangeSettings } from '@light-keeper/shared';
import type { ServerPlayer } from '../entities/ServerPlayer.ts';
import type { MatchWorld } from '../game/MatchWorld.ts';
import type { System } from './System.ts';

/**
 * Передача общей лампы — «горячая картошка». Лампа одна на двоих.
 * Нужно согласие обоих: игрок, глядя на напарника рядом, нажимает `E` —
 * это предложение (отдать или попросить лампу); если напарник в ответ
 * (за `offerSeconds`) тоже нажмёт `E`, глядя на него, лампа переходит в
 * другие руки. При этом она немного остывает, а «привычка» к руке сбрасывается.
 */
export class ExchangeSystem implements System {
  public constructor(private readonly settings: ExchangeSettings = GameConfig.exchange) {}

  public update(world: MatchWorld, deltaSeconds: number): void {
    const state = world.exchange;
    state.cooldownLeft = Math.max(0, state.cooldownLeft - deltaSeconds);
    if (state.offerFromId !== null) {
      state.offerSecondsLeft -= deltaSeconds;
      if (state.offerSecondsLeft <= 0) state.clearOffer();
    }

    const players = [...world.players.values()];
    players.forEach((player) => (player.aimingAtPartner = false));
    const [a, b] = players;
    if (world.phase !== 'playing' || !a || !b || players.length !== 2) {
      state.clearOffer();
      return;
    }
    a.aimingAtPartner = this.canReach(world, a, b);
    b.aimingAtPartner = this.canReach(world, b, a);
    if (state.cooldownLeft > 0) {
      return;
    }

    const pressed = players.filter((player) => player.interactPressed && player.aimingAtPartner);
    if (pressed.length === 0) {
      return;
    }
    const answersOffer = pressed.some(
      (player) => state.offerFromId !== null && state.offerFromId !== player.id,
    );
    if (pressed.length === 2 || answersOffer) {
      this.swap(world, a, b);
    } else if (pressed[0] && state.offerFromId === null) {
      state.offerFromId = pressed[0].id;
      state.offerSecondsLeft = this.settings.offerSeconds;
    }
    // Нажатие израсходовано на обмен — дверь его не увидит.
    pressed.forEach((player) => (player.interactPressed = false));
  }

  private canReach(world: MatchWorld, from: ServerPlayer, to: ServerPlayer): boolean {
    return (
      !from.inTambour &&
      !to.inTambour &&
      ExchangeRules.canReach(from.position, from.yaw, to.position, world.collisions, this.settings)
    );
  }

  private swap(world: MatchWorld, a: ServerPlayer, b: ServerPlayer): void {
    [a.lamp, b.lamp] = [b.lamp, a.lamp];
    (a.lamp ?? b.lamp)?.handOver(this.settings.heatRelief);
    const state = world.exchange;
    state.count += 1;
    state.cooldownLeft = this.settings.cooldownSeconds;
    state.clearOffer();
  }
}
