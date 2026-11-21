import { PlayerMovement } from '@light-keeper/shared';
import type { MatchWorld } from '../game/MatchWorld.ts';
import type { System } from './System.ts';

/**
 * Применяет команды ввода игроков. Время команд ограничено бюджетом,
 * накопленным за реально прошедшее время, — ускорить игрока нельзя.
 * Во время перехода, в тамбуре и для команд из прошлого пространства игрок не двигается,
 * но команды подтверждаются — клиент перестаёт их переигрывать.
 * Команды, сформированные на другом этаже (до подъёма по лестнице), тоже не двигают.
 */
export class MovementSystem implements System {
  public update(world: MatchWorld, deltaSeconds: number): void {
    for (const player of world.players.values()) {
      player.budget.credit(deltaSeconds);
      for (const command of player.drainCommands()) {
        const dt = player.budget.spend(Math.min(command.dt, PlayerMovement.MAX_COMMAND_DT));
        const canMove =
          world.phase === 'playing' &&
          command.space === world.spaceIndex &&
          command.floor === player.floor &&
          !player.inTambour;
        if (canMove) {
          player.position = world.movementOn(player.floor).apply(player.position, {
            ...command,
            dt,
          });
        }
        player.applyLook(command);
        player.applyInteract(command.interact);
        player.item = command.item;
        player.refueling = command.refuel;
        player.moving = command.moveX !== 0 || command.moveY !== 0;
        player.lastSeq = command.seq;
      }
    }
  }
}
