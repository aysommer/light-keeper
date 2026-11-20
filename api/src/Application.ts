import type { AddressInfo } from 'node:net';
import { ServerConfig } from './config/ServerConfig.ts';
import { Match } from './game/Match.ts';
import { LobbyManager } from './lobby/LobbyManager.ts';
import type { LobbyManagerOptions } from './lobby/LobbyManager.ts';
import { HttpServer } from './server/HttpServer.ts';
import { MessageDispatcher } from './server/MessageDispatcher.ts';
import { WsGateway } from './server/WsGateway.ts';
import type { WsGatewayOptions } from './server/WsGateway.ts';
import { RecordBook } from './records/RecordBook.ts';
import { FileRecordStore, MemoryRecordStore } from './records/RecordStore.ts';

export interface ApplicationOptions {
  readonly lobby?: LobbyManagerOptions;
  readonly gateway?: WsGatewayOptions;
}

/** Корень композиции серверного приложения. */
export class Application {
  private readonly httpServer: HttpServer;
  private readonly lobbies: LobbyManager;
  private readonly gateway: WsGateway;
  /** Таблица рекордов (в файле или в памяти — по настройкам). */
  public readonly records: RecordBook;

  public constructor(
    private readonly config: ServerConfig = ServerConfig.fromEnv(),
    options: ApplicationOptions = {},
  ) {
    this.records = new RecordBook(
      config.recordsFile ? new FileRecordStore(config.recordsFile) : new MemoryRecordStore(),
    );
    this.httpServer = new HttpServer(this.config, this.records);
    const lobby = options.lobby ?? LobbyManager.DEFAULT_OPTIONS;
    this.lobbies = new LobbyManager({
      ...lobby,
      match: { ...(lobby.match ?? Match.DEFAULT_OPTIONS), records: this.records },
    });
    this.gateway = new WsGateway(
      this.httpServer.raw,
      new MessageDispatcher(this.lobbies, { allowDebug: this.config.allowDebug }),
      options.gateway,
    );
  }

  public async start(): Promise<AddressInfo> {
    await this.records.load();
    return this.httpServer.start();
  }

  public async stop(): Promise<void> {
    await this.gateway.close();
    this.lobbies.dispose();
    await this.records.flush();
    await this.httpServer.stop();
  }
}
