import type { MatchWorld } from '../game/MatchWorld.ts';
import type { System } from './System.ts';

/**
 * Лестницы между этажами: `E` у лестницы — подняться (или спуститься) на
 * соседний этаж. Игрок встаёт в ту же точку другого этажа; нажатие тратится
 * на лестницу (дверь и передача лампы его не увидят).
 */
export class StairSystem implements System {
  /** С какого расстояния работает лестница, м. */
  public static readonly REACH = 0.9;

  public update(world: MatchWorld): void {
    if (world.phase !== 'playing' || world.over !== null) {
      return;
    }
    for (const player of world.players.values()) {
      if (!player.interactPressed || player.inTambour) {
        continue;
      }
      const near = world.space.stairNear(player.floor, player.position, StairSystem.REACH);
      if (near) {
        player.floor = near.to;
        player.position = near.stair.position;
        player.interactPressed = false;
      }
    }
  }
}
