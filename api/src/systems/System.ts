import type { MatchWorld } from '../game/MatchWorld.ts';

/** Система игровой логики: обновляет мир партии за один тик. */
export interface System {
  update(world: MatchWorld, deltaSeconds: number): void;
}
