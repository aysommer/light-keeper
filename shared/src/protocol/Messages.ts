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
  | { readonly type: 'ping'; readonly sentAt: number };

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
    }
  | { readonly type: 'match:aborted'; readonly reason: 'partner_left' }
  | { readonly type: 'error'; readonly code: ErrorCode; readonly message: string }
  | { readonly type: 'pong'; readonly sentAt: number };

export type ClientMessageType = ClientMessage['type'];
export type ServerMessageType = ServerMessage['type'];

/** Сообщение сервера заданного типа. */
export type ServerMessageOf<T extends ServerMessageType> = Extract<ServerMessage, { type: T }>;
