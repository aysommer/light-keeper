import { GameConfig, PlayerMovement } from '@light-keeper/shared';
import type { LampSettings } from '@light-keeper/shared';
import type { ServerPlayer } from '../entities/ServerPlayer.ts';
import type { MatchWorld } from '../game/MatchWorld.ts';
import type { System } from './System.ts';

/**
 * Масло и нагрев общей лампы. Перегревшись в руках, лампа выпадает на пол
 * (под ноги, чуть впереди) и остывает там; поднять её может любой — `E` рядом.
 * Во время перехода между пространствами лампа не меняется.
 */
export class LampSystem implements System {
  public constructor(private readonly settings: LampSettings = GameConfig.lamp) {}

  public update(world: MatchWorld, deltaSeconds: number): void {
    if (world.phase !== 'playing') {
      return;
    }
    const holder = [...world.players.values()].find((player) => player.lamp !== null);
    const wasOverheated = world.lamp.overheated;
    world.lamp.update(deltaSeconds, holder?.lampInHand ?? false);
    // Выпадает в момент перегрева; поднятая ещё горячей — остывает в руках.
    if (holder && world.lamp.overheated && !wasOverheated && !holder.inTambour) {
      world.dropLamp(this.dropPoint(world, holder), holder.floor);
    }
    this.pickUp(world);
  }

  /** `E` рядом с лежащей лампой — поднять её (нажатие тратится на это). */
  private pickUp(world: MatchWorld): void {
    const at = world.lampOnFloor;
    if (!at) {
      return;
    }
    const picker = [...world.players.values()].find(
      (player) =>
        player.interactPressed &&
        !player.inTambour &&
        player.floor === world.lampFloor &&
        player.position.distanceTo(at) <= this.settings.pickupDistance,
    );
    if (picker) {
      picker.interactPressed = false;
      world.giveLampTo(picker.id);
    }
  }

  /** Лампа падает чуть впереди игрока, если там нет стены, иначе — под ноги. */
  private dropPoint(world: MatchWorld, player: ServerPlayer): ServerPlayer['position'] {
    const ahead = player.position.add(PlayerMovement.forward(player.yaw).scale(0.5));
    return world.collisionsOn(player.floor).lineOfSight(player.position, ahead)
      ? ahead
      : player.position;
  }
}
