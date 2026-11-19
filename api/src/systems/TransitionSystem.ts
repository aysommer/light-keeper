import type { MatchWorld } from '../game/MatchWorld.ts';
import type { System } from './System.ts';

/** Отсчитывает переход между пространствами и по его окончании входит в следующее. */
export class TransitionSystem implements System {
  public update(world: MatchWorld, deltaSeconds: number): void {
    world.advanceTransition(deltaSeconds);
  }
}
