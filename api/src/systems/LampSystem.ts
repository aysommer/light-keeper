import type { MatchWorld } from '../game/MatchWorld.ts';
import type { System } from './System.ts';

/** Масло и нагрев ламп. Во время перехода между пространствами лампы не меняются. */
export class LampSystem implements System {
  public update(world: MatchWorld, deltaSeconds: number): void {
    if (world.phase !== 'playing') {
      return;
    }
    for (const player of world.players.values()) {
      player.lamp.update(deltaSeconds, player.lampInHand);
    }
  }
}
