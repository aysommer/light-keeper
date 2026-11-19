import type { ServerMessage } from '@light-keeper/shared';

/** Участник лобби с точки зрения игровой логики: идентификатор и канал отправки. */
export interface LobbyParticipant {
  readonly id: string;
  send(message: ServerMessage): void;
}
