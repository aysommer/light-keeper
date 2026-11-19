import type { Server } from 'node:http';
import { WebSocketServer } from 'ws';
import type { RawData, WebSocket } from 'ws';
import { MessageCodec } from '@light-keeper/shared';
import { ClientConnection } from './ClientConnection.ts';
import type { MessageDispatcher } from './MessageDispatcher.ts';

export interface WsGatewayOptions {
  readonly path: string;
  /** Интервал проверки «пульса» соединений, мс. */
  readonly heartbeatMs: number;
}

/** WebSocket-шлюз: принимает подключения, декодирует сообщения, следит за «пульсом». */
export class WsGateway {
  public static readonly DEFAULT_OPTIONS: WsGatewayOptions = {
    path: '/ws',
    heartbeatMs: 15_000,
  };

  private readonly server: WebSocketServer;
  private readonly connections = new Set<ClientConnection>();
  private readonly heartbeat: ReturnType<typeof setInterval>;
  private readonly codec = new MessageCodec();

  public constructor(
    httpServer: Server,
    private readonly dispatcher: MessageDispatcher,
    options: WsGatewayOptions = WsGateway.DEFAULT_OPTIONS,
  ) {
    this.server = new WebSocketServer({
      server: httpServer,
      path: options.path,
      maxPayload: MessageCodec.MAX_MESSAGE_BYTES,
    });
    this.server.on('connection', (socket) => this.accept(socket));
    this.heartbeat = setInterval(() => this.checkHeartbeats(), options.heartbeatMs);
  }

  public get connectionCount(): number {
    return this.connections.size;
  }

  public async close(): Promise<void> {
    clearInterval(this.heartbeat);
    for (const client of this.server.clients) {
      client.terminate();
    }
    await new Promise<void>((resolve) => this.server.close(() => resolve()));
  }

  private accept(socket: WebSocket): void {
    const connection = new ClientConnection(socket, this.codec);
    this.connections.add(connection);

    socket.on('pong', () => connection.markAlive());
    socket.on('message', (data, isBinary) => this.receive(connection, data, isBinary));
    socket.on('close', () => {
      this.connections.delete(connection);
      this.dispatcher.disconnect(connection);
    });
    socket.on('error', () => socket.terminate());
  }

  private receive(connection: ClientConnection, data: RawData, isBinary: boolean): void {
    if (!connection.acceptIncoming()) {
      connection.sendError('rate_limited', 'Слишком много сообщений');
      connection.close(1008, 'rate_limited');
      return;
    }
    const message = isBinary ? null : this.codec.decodeClientMessage(data.toString());
    if (!message) {
      connection.sendError('bad_message', 'Некорректное сообщение');
      return;
    }
    this.dispatcher.handle(connection, message);
  }

  private checkHeartbeats(): void {
    for (const connection of this.connections) {
      connection.checkAlive();
    }
  }
}
