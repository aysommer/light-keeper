import type { AddressInfo } from 'node:net';
import { ServerConfig } from './config/ServerConfig.ts';
import { LobbyManager } from './lobby/LobbyManager.ts';
import type { LobbyManagerOptions } from './lobby/LobbyManager.ts';
import { HttpServer } from './server/HttpServer.ts';
import { MessageDispatcher } from './server/MessageDispatcher.ts';
import { WsGateway } from './server/WsGateway.ts';
import type { WsGatewayOptions } from './server/WsGateway.ts';

export interface ApplicationOptions {
  readonly lobby?: LobbyManagerOptions;
  readonly gateway?: WsGatewayOptions;
}

/** Корень композиции серверного приложения. */
export class Application {
  private readonly httpServer: HttpServer;
  private readonly lobbies: LobbyManager;
  private readonly gateway: WsGateway;

  public constructor(
    private readonly config: ServerConfig = ServerConfig.fromEnv(),
    options: ApplicationOptions = {},
  ) {
    this.httpServer = new HttpServer(this.config);
    this.lobbies = new LobbyManager(options.lobby);
    this.gateway = new WsGateway(
      this.httpServer.raw,
      new MessageDispatcher(this.lobbies),
      options.gateway,
    );
  }

  public async start(): Promise<AddressInfo> {
    return this.httpServer.start();
  }

  public async stop(): Promise<void> {
    await this.gateway.close();
    this.lobbies.dispose();
    await this.httpServer.stop();
  }
}
