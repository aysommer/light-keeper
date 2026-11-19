import { randomUUID } from 'node:crypto';
import { WebSocket } from 'ws';
import type { ErrorCode, MessageCodec, ServerMessage } from '@light-keeper/shared';
import type { LobbyParticipant } from '../lobby/LobbyParticipant.ts';
import { RateLimiter } from './RateLimiter.ts';

/** Одно WebSocket-подключение игрока. */
export class ClientConnection implements LobbyParticipant {
  public readonly id = randomUUID();
  /** Клиент прошёл рукопожатие `hello` с совместимой версией протокола. */
  public welcomed = false;
  private alive = true;
  private readonly limiter = new RateLimiter(60, 120);

  public constructor(
    private readonly socket: WebSocket,
    private readonly codec: MessageCodec,
  ) {}

  public send(message: ServerMessage): void {
    if (this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(this.codec.encode(message));
    }
  }

  public sendError(code: ErrorCode, message: string): void {
    this.send({ type: 'error', code, message });
  }

  /** Учитывает входящее сообщение; `false` — клиент шлёт слишком часто. */
  public acceptIncoming(): boolean {
    return this.limiter.tryConsume();
  }

  public markAlive(): void {
    this.alive = true;
  }

  /**
   * Проверка «пульса»: если с прошлой проверки не было pong — соединение мёртвое.
   * Возвращает `false`, если соединение разорвано.
   */
  public checkAlive(): boolean {
    if (!this.alive) {
      this.socket.terminate();
      return false;
    }
    this.alive = false;
    this.socket.ping();
    return true;
  }

  public close(code: number, reason: string): void {
    this.socket.close(code, reason);
  }
}
