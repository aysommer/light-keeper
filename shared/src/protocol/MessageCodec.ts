import { LobbyCode } from './LobbyCode.ts';
import type { ClientMessage, ServerMessage, ServerMessageType } from './Messages.ts';

type JsonObject = Record<string, unknown>;

/**
 * Кодирование и проверка сообщений протокола (JSON поверх WebSocket).
 * Сообщения клиента проверяются строго: сервер не доверяет входящим данным.
 */
export class MessageCodec {
  /** Максимальный размер одного сообщения, байт. */
  public static readonly MAX_MESSAGE_BYTES = 4096;

  private static readonly SERVER_TYPES: ReadonlySet<ServerMessageType> = new Set([
    'welcome',
    'lobby:state',
    'lobby:left',
    'match:start',
    'match:aborted',
    'error',
    'pong',
  ]);

  public encode(message: ClientMessage | ServerMessage): string {
    return JSON.stringify(message);
  }

  /** Разбирает и проверяет сообщение клиента. `null` — сообщение некорректно. */
  public decodeClientMessage(raw: string): ClientMessage | null {
    const data = this.parseObject(raw);
    if (!data) {
      return null;
    }
    switch (data['type']) {
      case 'hello':
        return this.isFiniteNumber(data['protocolVersion'])
          ? { type: 'hello', protocolVersion: data['protocolVersion'] }
          : null;
      case 'lobby:create':
        return { type: 'lobby:create' };
      case 'lobby:join': {
        const code = data['code'];
        if (typeof code !== 'string' || code.length > 16) {
          return null;
        }
        const normalized = LobbyCode.normalize(code);
        return LobbyCode.isValid(normalized) ? { type: 'lobby:join', code: normalized } : null;
      }
      case 'lobby:leave':
        return { type: 'lobby:leave' };
      case 'lobby:ready':
        return typeof data['ready'] === 'boolean'
          ? { type: 'lobby:ready', ready: data['ready'] }
          : null;
      case 'ping':
        return this.isFiniteNumber(data['sentAt'])
          ? { type: 'ping', sentAt: data['sentAt'] }
          : null;
      default:
        return null;
    }
  }

  /**
   * Разбирает сообщение сервера. Проверяется только известный тип:
   * сервер — доверенная сторона, а формат задают общие типы.
   */
  public decodeServerMessage(raw: string): ServerMessage | null {
    const data = this.parseObject(raw);
    if (!data || !MessageCodec.SERVER_TYPES.has(data['type'] as ServerMessageType)) {
      return null;
    }
    return data as unknown as ServerMessage;
  }

  private parseObject(raw: string): JsonObject | null {
    if (raw.length > MessageCodec.MAX_MESSAGE_BYTES) {
      return null;
    }
    try {
      const value: unknown = JSON.parse(raw);
      return typeof value === 'object' && value !== null && !Array.isArray(value)
        ? (value as JsonObject)
        : null;
    } catch {
      return null;
    }
  }

  private isFiniteNumber(value: unknown): value is number {
    return typeof value === 'number' && Number.isFinite(value);
  }
}
