import type { ErrorCode } from '@light-keeper/shared';

/** Понятные игроку тексты ошибок. */
export class ErrorMessages {
  private static readonly TEXTS: Record<
    ErrorCode | 'connection_failed' | 'connection_lost',
    string
  > = {
    version_mismatch: 'Версия игры устарела — обнови страницу.',
    bad_message: 'Сервер не понял запрос.',
    not_welcomed: 'Соединение не готово, попробуй ещё раз.',
    rate_limited: 'Слишком много действий подряд.',
    server_full: 'Сервер переполнен, попробуй позже.',
    lobby_not_found: 'Комната с таким кодом не найдена.',
    lobby_full: 'В этой комнате уже двое.',
    lobby_in_game: 'В этой комнате уже идёт партия.',
    not_in_lobby: 'Ты не в комнате.',
    connection_failed: 'Не удалось подключиться к серверу.',
    connection_lost: 'Соединение с сервером потеряно.',
  };

  public static text(code: keyof typeof ErrorMessages.TEXTS): string {
    return ErrorMessages.TEXTS[code];
  }
}
