import { GameConfig } from '@light-keeper/shared';
import type { CanisterSettings } from '@light-keeper/shared';
import type { ServerPlayer } from '../entities/ServerPlayer.ts';
import type { MatchWorld } from '../game/MatchWorld.ts';
import type { System } from './System.ts';

/**
 * Канистры с маслом: игрок подбирает их, проходя рядом (не больше `maxCarried`),
 * и заправляет лампу в руках, удерживая `R` стоя на месте. Пошёл, отпустил
 * клавишу или лампа уже полная — прогресс сбрасывается.
 */
export class OilSystem implements System {
  public constructor(private readonly settings: CanisterSettings = GameConfig.canister) {}

  public update(world: MatchWorld, deltaSeconds: number): void {
    if (world.phase !== 'playing') {
      return;
    }
    for (const player of world.players.values()) {
      if (player.inTambour) {
        player.refuelSeconds = 0;
        continue;
      }
      this.pickUp(world, player);
      this.refuel(player, deltaSeconds);
    }
  }

  private pickUp(world: MatchWorld, player: ServerPlayer): void {
    if (player.canisters >= this.settings.maxCarried) {
      return;
    }
    world.space.oilSpawns.forEach((spawn, index) => {
      if (
        player.canisters < this.settings.maxCarried &&
        !world.oil.isTaken(index) &&
        player.position.distanceTo(spawn) <= this.settings.pickupDistance
      ) {
        world.oil.take(index);
        player.canisters += 1;
      }
    });
  }

  private refuel(player: ServerPlayer, deltaSeconds: number): void {
    const canRefuel =
      player.refueling &&
      !player.moving &&
      player.canisters > 0 &&
      player.lamp.oil < this.settings.fullAt;
    if (!canRefuel) {
      player.refuelSeconds = 0;
      return;
    }
    player.refuelSeconds += deltaSeconds;
    if (player.refuelSeconds + 1e-6 >= this.settings.refuelSeconds) {
      player.lamp.oil = Math.min(100, player.lamp.oil + this.settings.amount);
      player.canisters -= 1;
      player.refuelSeconds = 0;
    }
  }
}
