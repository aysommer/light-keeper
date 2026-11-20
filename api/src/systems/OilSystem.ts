import { GameConfig, PlayerMovement } from '@light-keeper/shared';
import type { CanisterSettings } from '@light-keeper/shared';
import type { ServerPlayer } from '../entities/ServerPlayer.ts';
import type { MatchWorld } from '../game/MatchWorld.ts';
import type { System } from './System.ts';

/**
 * Канистры с маслом: игрок подбирает полные, проходя рядом (не больше
 * `maxCarried`); пустые обманки не подбираются. Лампу в руках заправляют,
 * удерживая `R` стоя на месте; пошёл, отпустил клавишу или лампа уже полная —
 * прогресс сбрасывается. Опустевшая канистра остаётся лежать под ногами.
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
      this.refuel(world, player, deltaSeconds);
    }
  }

  private pickUp(world: MatchWorld, player: ServerPlayer): void {
    if (player.canisters >= this.settings.maxCarried) {
      return;
    }
    world.space.oilSpawns.forEach((spawn, index) => {
      if (
        player.canisters < this.settings.maxCarried &&
        world.space.isOilFull(index) &&
        !world.oil.isTaken(index) &&
        player.position.distanceTo(spawn) <= this.settings.pickupDistance
      ) {
        world.oil.take(index);
        player.canisters += 1;
      }
    });
  }

  private refuel(world: MatchWorld, player: ServerPlayer, deltaSeconds: number): void {
    // Заправить можно только общую лампу — у того, у кого она в руках.
    const lamp = player.lamp;
    const canRefuel =
      lamp !== null &&
      player.refueling &&
      !player.moving &&
      player.canisters > 0 &&
      lamp.oil < this.settings.fullAt;
    if (!canRefuel) {
      player.refuelSeconds = 0;
      return;
    }
    player.refuelSeconds += deltaSeconds;
    if (player.refuelSeconds + 1e-6 >= this.settings.refuelSeconds) {
      lamp.oil = Math.min(100, lamp.oil + this.settings.amount);
      player.canisters -= 1;
      player.refuelSeconds = 0;
      world.oil.drop(this.dropPoint(world, player));
    }
  }

  /** Пустую канистру ставим чуть впереди игрока, если там нет стены, иначе — под ноги. */
  private dropPoint(world: MatchWorld, player: ServerPlayer): ServerPlayer['position'] {
    const ahead = player.position.add(PlayerMovement.forward(player.yaw).scale(0.45));
    return world.collisions.lineOfSight(player.position, ahead) ? ahead : player.position;
  }
}
