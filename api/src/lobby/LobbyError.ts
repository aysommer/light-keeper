import type { ErrorCode } from '@light-keeper/shared';

/** Ожидаемая ошибка лобби — отправляется клиенту как `error`. */
export class LobbyError extends Error {
  public constructor(
    public readonly code: ErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'LobbyError';
  }
}
