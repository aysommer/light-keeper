import type { HeldItem } from '../simulation/HeldItem.ts';
import type { PlayerInput } from '../simulation/PlayerInput.ts';

/** Цвет персонажа-стикмена. Первый вошедший — красный, второй — голубой. */
export type PlayerColor = 'red' | 'blue';

export const PLAYER_COLORS: readonly PlayerColor[] = ['red', 'blue'];

/** Состояние лобби: ожидание игроков, обратный отсчёт, партия идёт. */
export type LobbyStatus = 'waiting' | 'countdown' | 'in_game';

export interface LobbyPlayerInfo {
  readonly id: string;
  readonly color: PlayerColor;
  readonly ready: boolean;
}

export interface LobbySnapshot {
  readonly code: string;
  readonly status: LobbyStatus;
  readonly players: readonly LobbyPlayerInfo[];
  /** Секунд до старта во время обратного отсчёта, иначе `null`. */
  readonly countdownSeconds: number | null;
}

export interface MatchPlayerInfo {
  readonly id: string;
  readonly color: PlayerColor;
}

/** Состояние игрока в снимке мира. */
export interface PlayerSnapshot {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly yaw: number;
  readonly pitch: number;
  /** Номер последней применённой команды ввода этого игрока. */
  readonly lastSeq: number;
  /** Игрок уже вошёл в дверь и ждёт в тамбуре. */
  readonly inTambour: boolean;
  /** Что игрок держит в руке. */
  readonly item: HeldItem;
}

/** Состояние двери выхода и ключа в текущем пространстве. */
export interface ExitSnapshot {
  readonly open: boolean;
  /** Скрытая дверь уже проявлена (для остальных типов всегда `true`). */
  readonly revealed: boolean;
  /** Кто открывает дверь прямо сейчас, иначе `null`. */
  readonly openerId: string | null;
  /** Прогресс открытия, 0–1. */
  readonly openProgress: number;
  /** Сколько секунд осталось войти, пока дверь открыта; иначе `null`. */
  readonly secondsLeft: number | null;
  /** У кого ключ; `null` — ключ лежит на месте или его нет. */
  readonly keyHolderId: string | null;
}

/** Куда можно перенестись отладочной командой. */
export type DebugGotoTarget = 'exit' | 'key';

/** Почему партия закончилась. */
export type MatchOverReason = 'door_timeout';

/** Фаза пространства: игра идёт или идёт переход (затемнение) в следующее. */
export type SpacePhase = 'playing' | 'transition';

/** Снимок мира, который сервер рассылает каждый тик. */
export interface MatchSnapshot {
  readonly tick: number;
  /** Время сервера с начала партии, мс. */
  readonly serverTime: number;
  /** Номер текущего пространства (0 — первое) = число пройденных пространств. */
  readonly spaceIndex: number;
  readonly phase: SpacePhase;
  readonly exit: ExitSnapshot;
  readonly players: readonly PlayerSnapshot[];
}

export type ErrorCode =
  | 'version_mismatch'
  | 'bad_message'
  | 'not_welcomed'
  | 'rate_limited'
  | 'server_full'
  | 'lobby_not_found'
  | 'lobby_full'
  | 'lobby_in_game'
  | 'not_in_lobby';

/** Сообщения клиент → сервер. */
export type ClientMessage =
  | { readonly type: 'hello'; readonly protocolVersion: number }
  | { readonly type: 'lobby:create' }
  | { readonly type: 'lobby:join'; readonly code: string }
  | { readonly type: 'lobby:leave' }
  | { readonly type: 'lobby:ready'; readonly ready: boolean }
  | { readonly type: 'ping'; readonly sentAt: number }
  | { readonly type: 'input'; readonly commands: readonly PlayerInput[] }
  /** Отладка: перейти в следующее пространство. Сервер принимает только в режиме разработки. */
  | { readonly type: 'debug:next-space' }
  /** Отладка: перенестись к двери выхода или к ключу. Только в режиме разработки. */
  | { readonly type: 'debug:goto'; readonly target: DebugGotoTarget };

/** Сообщения сервер → клиент. */
export type ServerMessage =
  | { readonly type: 'welcome'; readonly playerId: string; readonly protocolVersion: number }
  | { readonly type: 'lobby:state'; readonly lobby: LobbySnapshot }
  | { readonly type: 'lobby:left' }
  | {
      readonly type: 'match:start';
      readonly seed: number;
      readonly you: PlayerColor;
      readonly players: readonly MatchPlayerInfo[];
      /** Частота тиков сервера, Гц. */
      readonly tickRate: number;
    }
  | { readonly type: 'match:snapshot'; readonly snapshot: MatchSnapshot }
  | { readonly type: 'match:aborted'; readonly reason: 'partner_left' }
  | {
      readonly type: 'match:over';
      readonly reason: MatchOverReason;
      /** Сколько пространств пройдено. */
      readonly spacesCleared: number;
    }
  | { readonly type: 'error'; readonly code: ErrorCode; readonly message: string }
  | { readonly type: 'pong'; readonly sentAt: number };

export type ClientMessageType = ClientMessage['type'];
export type ServerMessageType = ServerMessage['type'];

/** Сообщение сервера заданного типа. */
export type ServerMessageOf<T extends ServerMessageType> = Extract<ServerMessage, { type: T }>;
