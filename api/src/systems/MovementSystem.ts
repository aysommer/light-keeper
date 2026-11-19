import { PlayerMovement } from '@light-keeper/shared';
import type { MatchWorld } from '../game/MatchWorld.ts';
import type { System } from './System.ts';

/**
 * Применяет команды ввода игроков. Время команд ограничено бюджетом,
 * накопленным за реально прошедшее время, — ускорить игрока нельзя.
 */
export class MovementSystem implements System {
  public constructor(private readonly movement: PlayerMovement) {}

  public update(world: MatchWorld, deltaSeconds: number): void {
    for (const player of world.players.values()) {
      player.budget.credit(deltaSeconds);
      for (const command of player.drainCommands()) {
        const dt = player.budget.spend(Math.min(command.dt, PlayerMovement.MAX_COMMAND_DT));
        player.position = this.movement.apply(player.position, { ...command, dt });
        player.applyLook(command);
        player.lastSeq = command.seq;
      }
      world.recordProgress(player.position.y);
    }
  }
}
