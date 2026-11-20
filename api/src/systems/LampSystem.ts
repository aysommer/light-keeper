import type { MatchWorld } from '../game/MatchWorld.ts';
import type { System } from './System.ts';

/** Масло и нагрев общей лампы. Во время перехода между пространствами лампа не меняется. */
export class LampSystem implements System {
  public update(world: MatchWorld, deltaSeconds: number): void {
    if (world.phase !== 'playing') {
      return;
    }
    for (const player of world.players.values()) {
      player.lamp?.update(deltaSeconds, player.lampInHand);
    }
  }
}
