import { ExitCode } from '../generation/ExitCode.ts';
import { HELD_ITEMS } from '../simulation/HeldItem.ts';
import { LobbyCode } from './LobbyCode.ts';
import type { HeldItem } from '../simulation/HeldItem.ts';
import type { PlayerInput } from '../simulation/PlayerInput.ts';
import type { ClientMessage, ServerMessage, ServerMessageType } from './Messages.ts';

type JsonObject = Record<string, unknown>;

/**
 * Кодирование и проверка сообщений протокола (JSON поверх WebSocket).
 * Сообщения клиента проверяются строго: сервер не доверяет входящим данным.
 */
export class MessageCodec {
  /** Максимальный размер одного сообщения, байт. */
  public static readonly MAX_MESSAGE_BYTES = 4096;
  /** Максимум команд ввода в одном сообщении `input`. */
  public static readonly MAX_INPUT_COMMANDS = 16;
  private static readonly MAX_SEQ = 2 ** 31;
  private static readonly MAX_FLOORS = 8;
  private static readonly MAX_ANGLE = 1e4;

  private static readonly SERVER_TYPES: ReadonlySet<ServerMessageType> = new Set([
    'welcome',
    'lobby:state',
    'lobby:left',
    'match:start',
    'match:snapshot',
    'match:aborted',
    'match:over',
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
      case 'input':
        return this.decodeInput(data['commands']);
      case 'exit:code': {
        const code = data['code'];
        const valid =
          Array.isArray(code) &&
          code.length <= ExitCode.LENGTH * 2 &&
          code.every(
            (symbol) =>
              typeof symbol === 'string' &&
              symbol.length > 0 &&
              symbol.length <= ExitCode.MAX_SYMBOL_LENGTH,
          );
        return valid ? { type: 'exit:code', code: code as string[] } : null;
      }
      case 'debug:next-space':
        return { type: 'debug:next-space' };
      case 'debug:ghost':
        return { type: 'debug:ghost' };
      case 'debug:lamp':
        return data['preset'] === 'hot' || data['preset'] === 'low-oil'
          ? { type: 'debug:lamp', preset: data['preset'] }
          : null;
      case 'debug:goto':
        return data['target'] === 'exit' ||
          data['target'] === 'key' ||
          data['target'] === 'note' ||
          data['target'] === 'oil' ||
          data['target'] === 'stair'
          ? { type: 'debug:goto', target: data['target'] }
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

  private decodeInput(raw: unknown): ClientMessage | null {
    if (!Array.isArray(raw) || raw.length === 0 || raw.length > MessageCodec.MAX_INPUT_COMMANDS) {
      return null;
    }
    const commands: PlayerInput[] = [];
    for (const item of raw) {
      const command = this.decodeCommand(item);
      if (!command) {
        return null;
      }
      commands.push(command);
    }
    return { type: 'input', commands };
  }

  private decodeCommand(raw: unknown): PlayerInput | null {
    if (typeof raw !== 'object' || raw === null) {
      return null;
    }
    const { seq, dt, moveX, moveY, yaw, pitch, run, interact, item, refuel, space, floor } =
      raw as JsonObject;
    const valid =
      Number.isInteger(seq) &&
      (seq as number) >= 0 &&
      (seq as number) < MessageCodec.MAX_SEQ &&
      this.inRange(dt, 0, 1) &&
      this.inRange(moveX, -1, 1) &&
      this.inRange(moveY, -1, 1) &&
      this.inRange(yaw, -MessageCodec.MAX_ANGLE, MessageCodec.MAX_ANGLE) &&
      this.inRange(pitch, -Math.PI, Math.PI) &&
      typeof run === 'boolean' &&
      typeof interact === 'boolean' &&
      HELD_ITEMS.includes(item as HeldItem) &&
      typeof refuel === 'boolean' &&
      Number.isInteger(space) &&
      (space as number) >= 0 &&
      (space as number) < MessageCodec.MAX_SEQ &&
      Number.isInteger(floor) &&
      (floor as number) >= 0 &&
      (floor as number) < MessageCodec.MAX_FLOORS;
    if (!valid) {
      return null;
    }
    return {
      seq: seq as number,
      dt: dt as number,
      moveX: moveX as number,
      moveY: moveY as number,
      yaw: yaw as number,
      pitch: pitch as number,
      run: run as boolean,
      interact: interact as boolean,
      item: item as HeldItem,
      refuel: refuel as boolean,
      space: space as number,
      floor: floor as number,
    };
  }

  private inRange(value: unknown, min: number, max: number): value is number {
    return this.isFiniteNumber(value) && value >= min && value <= max;
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
