import { PROTOCOL_VERSION } from '@light-keeper/shared';
import type { ClientMessage } from '@light-keeper/shared';
import { LobbyError } from '../lobby/LobbyError.ts';
import type { LobbyManager } from '../lobby/LobbyManager.ts';
import type { ClientConnection } from './ClientConnection.ts';

export interface DispatcherOptions {
  /** Принимать отладочные команды (только в режиме разработки). */
  readonly allowDebug: boolean;
}

/** Направляет сообщения клиентов в игровую логику. */
export class MessageDispatcher {
  public constructor(
    private readonly lobbies: LobbyManager,
    private readonly options: DispatcherOptions = { allowDebug: false },
  ) {}

  public handle(connection: ClientConnection, message: ClientMessage): void {
    if (message.type === 'hello') {
      this.handleHello(connection, message.protocolVersion);
      return;
    }
    if (!connection.welcomed) {
      connection.sendError('not_welcomed', 'Сначала отправь hello');
      return;
    }
    try {
      this.route(connection, message);
    } catch (error) {
      if (error instanceof LobbyError) {
        connection.sendError(error.code, error.message);
        return;
      }
      throw error;
    }
  }

  public disconnect(connection: ClientConnection): void {
    this.lobbies.disconnect(connection.id);
  }

  private handleHello(connection: ClientConnection, protocolVersion: number): void {
    if (protocolVersion !== PROTOCOL_VERSION) {
      connection.sendError(
        'version_mismatch',
        `Версия клиента ${protocolVersion} не совпадает с сервером (${PROTOCOL_VERSION}). Обнови страницу.`,
      );
      connection.close(4000, 'version_mismatch');
      return;
    }
    connection.welcomed = true;
    connection.send({
      type: 'welcome',
      playerId: connection.id,
      protocolVersion: PROTOCOL_VERSION,
    });
  }

  private route(
    connection: ClientConnection,
    message: Exclude<ClientMessage, { type: 'hello' }>,
  ): void {
    switch (message.type) {
      case 'lobby:create':
        this.lobbies.create(connection);
        return;
      case 'lobby:join':
        this.lobbies.join(connection, message.code);
        return;
      case 'lobby:leave':
        this.lobbies.leave(connection);
        return;
      case 'lobby:ready':
        this.lobbies.setReady(connection, message.ready);
        return;
      case 'ping':
        connection.send({ type: 'pong', sentAt: message.sentAt });
        return;
      case 'debug:next-space':
        if (this.options.allowDebug) {
          this.lobbies.lobbyOf(connection.id)?.match?.requestNextSpace();
        }
        return;
      case 'debug:goto':
        if (this.options.allowDebug) {
          this.lobbies.lobbyOf(connection.id)?.match?.debugGoto(connection.id, message.target);
        }
        return;
      case 'input':
        // Команды, долетевшие после конца партии, просто отбрасываются.
        this.lobbies.lobbyOf(connection.id)?.match?.receiveInput(connection.id, message.commands);
        return;
    }
  }
}
