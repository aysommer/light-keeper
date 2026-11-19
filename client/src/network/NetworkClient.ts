import { MessageCodec, PROTOCOL_VERSION } from '@light-keeper/shared';
import type {
  ClientMessage,
  ErrorCode,
  ServerMessage,
  ServerMessageOf,
  ServerMessageType,
} from '@light-keeper/shared';

type AnyHandler = (message: ServerMessage) => void;

/** Ошибка подключения: код протокола или `connection_failed`. */
export class ConnectionError extends Error {
  public constructor(
    public readonly code: ErrorCode | 'connection_failed',
    message: string,
  ) {
    super(message);
    this.name = 'ConnectionError';
  }
}

/** WebSocket-клиент игрового сервера с типизированными подписками на сообщения. */
export class NetworkClient {
  private static readonly CONNECT_TIMEOUT_MS = 5000;

  private socket: WebSocket | null = null;
  private readonly handlers = new Map<ServerMessageType, Set<AnyHandler>>();
  private readonly closeHandlers = new Set<() => void>();
  private currentPlayerId: string | null = null;
  private closedByClient = false;

  public constructor(
    private readonly url: string = NetworkClient.defaultUrl(),
    private readonly codec: MessageCodec = new MessageCodec(),
  ) {}

  /** Адрес шлюза рядом со страницей: `/api/ws` (в dev Vite проксирует его на сервер). */
  public static defaultUrl(): string {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${protocol}//${window.location.host}/api/ws`;
  }

  public get playerId(): string | null {
    return this.currentPlayerId;
  }

  public get isConnected(): boolean {
    return this.socket?.readyState === WebSocket.OPEN && this.currentPlayerId !== null;
  }

  /** Подключается и проходит рукопожатие `hello` → `welcome`. */
  public async connect(): Promise<void> {
    if (this.isConnected) {
      return;
    }
    this.closedByClient = false;
    const socket = new WebSocket(this.url);
    this.socket = socket;
    socket.addEventListener('message', (event) => this.receive(event.data));

    await new Promise<void>((resolve, reject) => {
      const fail = (error: ConnectionError): void => {
        cleanup();
        socket.close();
        reject(error);
      };
      const timer = setTimeout(
        () => fail(new ConnectionError('connection_failed', 'Сервер не отвечает')),
        NetworkClient.CONNECT_TIMEOUT_MS,
      );
      const offWelcome = this.on('welcome', (message) => {
        cleanup();
        this.currentPlayerId = message.playerId;
        socket.addEventListener('close', () => this.handleClose());
        resolve();
      });
      const offError = this.on('error', (message) =>
        fail(new ConnectionError(message.code, message.message)),
      );
      const onClose = (): void =>
        fail(new ConnectionError('connection_failed', 'Не удалось подключиться к серверу'));
      const cleanup = (): void => {
        clearTimeout(timer);
        offWelcome();
        offError();
        socket.removeEventListener('close', onClose);
      };
      socket.addEventListener('close', onClose);
      socket.addEventListener('open', () =>
        this.send({ type: 'hello', protocolVersion: PROTOCOL_VERSION }),
      );
    });
  }

  public send(message: ClientMessage): void {
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(this.codec.encode(message));
    }
  }

  /** Подписка на сообщения типа `type`. Возвращает функцию отписки. */
  public on<T extends ServerMessageType>(
    type: T,
    handler: (message: ServerMessageOf<T>) => void,
  ): () => void {
    let set = this.handlers.get(type);
    if (!set) {
      set = new Set();
      this.handlers.set(type, set);
    }
    const anyHandler = handler as AnyHandler;
    set.add(anyHandler);
    return () => set.delete(anyHandler);
  }

  /** Подписка на неожиданный разрыв соединения (не вызывается при `disconnect()`). */
  public onClose(handler: () => void): () => void {
    this.closeHandlers.add(handler);
    return () => this.closeHandlers.delete(handler);
  }

  public disconnect(): void {
    this.closedByClient = true;
    this.socket?.close();
    this.socket = null;
    this.currentPlayerId = null;
  }

  private receive(data: unknown): void {
    if (typeof data !== 'string') {
      return;
    }
    const message = this.codec.decodeServerMessage(data);
    if (!message) {
      return;
    }
    this.handlers.get(message.type)?.forEach((handler) => handler(message));
  }

  private handleClose(): void {
    this.currentPlayerId = null;
    this.socket = null;
    if (!this.closedByClient) {
      this.closeHandlers.forEach((handler) => handler());
    }
  }
}
