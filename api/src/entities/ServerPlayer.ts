import { PlayerMovement } from '@light-keeper/shared';
import type { PlayerColor, PlayerInput, PlayerSnapshot, Vector2 } from '@light-keeper/shared';
import type { LobbyParticipant } from '../lobby/LobbyParticipant.ts';
import { InputBudget } from '../game/InputBudget.ts';
import { Entity } from './Entity.ts';

/** Игрок в партии: позиция, взгляд, очередь команд ввода. */
export class ServerPlayer extends Entity {
  /** Предел очереди: всё сверх него отбрасывается. */
  public static readonly MAX_QUEUED_COMMANDS = 64;

  public yaw = 0;
  public pitch = 0;
  public lastSeq = -1;
  public readonly budget = new InputBudget();
  private readonly queue: PlayerInput[] = [];

  public constructor(
    public readonly participant: LobbyParticipant,
    public readonly color: PlayerColor,
    position: Vector2,
  ) {
    super(participant.id, position);
  }

  /** Принимает команды клиента; повторы и устаревшие номера игнорируются. */
  public enqueue(commands: readonly PlayerInput[]): void {
    const newestQueued = this.queue.at(-1)?.seq ?? this.lastSeq;
    let newest = newestQueued;
    for (const command of commands) {
      if (command.seq <= newest || this.queue.length >= ServerPlayer.MAX_QUEUED_COMMANDS) {
        continue;
      }
      this.queue.push(command);
      newest = command.seq;
    }
  }

  /** Забирает накопленные команды. */
  public drainCommands(): PlayerInput[] {
    return this.queue.splice(0);
  }

  /** Ставит игрока на старт пространства и поворачивает взглядом в заданную сторону. */
  public placeAt(position: Vector2, yaw: number): void {
    this.position = position;
    this.yaw = yaw;
    this.pitch = 0;
  }

  public applyLook(command: PlayerInput): void {
    this.yaw = command.yaw;
    this.pitch = PlayerMovement.clampPitch(command.pitch);
  }

  public snapshot(): PlayerSnapshot {
    return {
      id: this.id,
      x: this.position.x,
      y: this.position.y,
      yaw: this.yaw,
      pitch: this.pitch,
      lastSeq: this.lastSeq,
    };
  }
}
