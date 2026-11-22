import { PlayerMovement } from '@light-keeper/shared';
import type { MatchWorld } from '../game/MatchWorld.ts';
import type { System } from './System.ts';

/**
 * Флажки-ориентиры: `E` рядом с флажком на полу — поднять его; с флажком
 * в руке (слот 5) `E` — поставить его на пол перед собой. Флажки видят оба.
 */
export class FlagSystem implements System {
  /** С какого расстояния флажок можно поднять, м. */
  public static readonly REACH = 1;

  public update(world: MatchWorld): void {
    if (world.phase !== 'playing' || world.over !== null) {
      return;
    }
    for (const player of world.players.values()) {
      if (!player.interactPressed || player.inTambour) {
        continue;
      }
      const nearby = world.flags.flags.find(
        (flag) =>
          flag.holderId === null &&
          flag.floor === player.floor &&
          flag.position.distanceTo(player.position) <= FlagSystem.REACH,
      );
      if (nearby) {
        nearby.holderId = player.id;
        player.interactPressed = false;
        continue;
      }
      const carried = world.flags.flags.find((flag) => flag.holderId === player.id);
      if (carried && player.item === 'flag') {
        const ahead = player.position.add(PlayerMovement.forward(player.yaw).scale(0.5));
        const clear = world.collisionsOn(player.floor).lineOfSight(player.position, ahead);
        carried.position = clear ? ahead : player.position;
        carried.floor = player.floor;
        carried.holderId = null;
        player.interactPressed = false;
      }
    }
  }
}
