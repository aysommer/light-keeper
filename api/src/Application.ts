import type { AddressInfo } from 'node:net';
import { ServerConfig } from './config/ServerConfig.ts';
import { HttpServer } from './server/HttpServer.ts';

/** Корень композиции серверного приложения. */
export class Application {
  private readonly httpServer: HttpServer;

  public constructor(private readonly config: ServerConfig = ServerConfig.fromEnv()) {
    this.httpServer = new HttpServer(this.config);
  }

  public async start(): Promise<AddressInfo> {
    return this.httpServer.start();
  }

  public async stop(): Promise<void> {
    await this.httpServer.stop();
  }
}
