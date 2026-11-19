import type { PlayerInput, Vector2 } from '@light-keeper/shared';
import type { MovementProvider } from '../game/ActiveSpace.ts';
import type { LocalPlayer } from '../game/LocalPlayer.ts';

/**
 * Согласование предсказанной позиции с сервером.
 * Хранит команды, которые сервер ещё не подтвердил; получив снимок,
 * берёт позицию сервера и заново применяет к ней неподтверждённые команды.
 */
export class PredictionReconciler {
  /** Сколько неподтверждённых команд хранить (≈4 с при 60 к/с). */
  private static readonly MAX_PENDING = 256;

  private pending: PlayerInput[] = [];

  public constructor(private readonly rules: MovementProvider) {}

  public get pendingCount(): number {
    return this.pending.length;
  }

  /** Забыть неподтверждённые команды (после перехода в новое пространство). */
  public clear(): void {
    this.pending = [];
  }

  public record(command: PlayerInput): void {
    this.pending.push(command);
    if (this.pending.length > PredictionReconciler.MAX_PENDING) {
      this.pending.shift();
    }
  }

  public reconcile(player: LocalPlayer, serverPosition: Vector2, lastSeq: number): void {
    this.pending = this.pending.filter((command) => command.seq > lastSeq);
    let position = serverPosition;
    for (const command of this.pending) {
      // Команды из прошлого пространства на новой карте не переигрываем.
      if (command.space === this.rules.spaceIndex) {
        position = this.rules.movement.apply(position, command);
      }
    }
    player.correctTo(position);
  }
}
