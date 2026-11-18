import { createServer } from 'node:http';
import type { IncomingMessage, Server, ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { PROTOCOL_VERSION } from '@light-keeper/shared';
import type { HealthResponse } from '@light-keeper/shared';
import type { ServerConfig } from '../config/ServerConfig.ts';

type RouteHandler = (request: IncomingMessage, response: ServerResponse) => void;

/**
 * HTTP-сервер игры. Пока обслуживает только служебные маршруты;
 * на этапе 3 к нему подключится WebSocket-шлюз.
 */
export class HttpServer {
  private readonly server: Server;
  private readonly routes = new Map<string, RouteHandler>();
  private readonly startedAt = Date.now();

  public constructor(private readonly config: ServerConfig) {
    this.server = createServer((request, response) => this.handle(request, response));
    this.registerRoutes();
  }

  /** Нижележащий `http.Server` (понадобится для WebSocket). */
  public get raw(): Server {
    return this.server;
  }

  public async start(): Promise<AddressInfo> {
    await new Promise<void>((resolve, reject) => {
      this.server.once('error', reject);
      this.server.listen(this.config.port, this.config.host, () => {
        this.server.off('error', reject);
        resolve();
      });
    });
    return this.server.address() as AddressInfo;
  }

  public async stop(): Promise<void> {
    if (!this.server.listening) {
      return;
    }
    await new Promise<void>((resolve, reject) => {
      this.server.close((error) => (error ? reject(error) : resolve()));
      this.server.closeAllConnections();
    });
  }

  private registerRoutes(): void {
    this.routes.set('GET /health', (_request, response) => {
      const body: HealthResponse = {
        status: 'ok',
        service: 'light-keeper-api',
        protocolVersion: PROTOCOL_VERSION,
        uptime: (Date.now() - this.startedAt) / 1000,
      };
      this.sendJson(response, 200, body);
    });
  }

  private handle(request: IncomingMessage, response: ServerResponse): void {
    const path = new URL(request.url ?? '/', 'http://localhost').pathname;
    const handler = this.routes.get(`${request.method ?? 'GET'} ${path}`);
    if (handler) {
      handler(request, response);
      return;
    }
    this.sendJson(response, 404, { error: 'Not Found' });
  }

  private sendJson(response: ServerResponse, status: number, body: unknown): void {
    response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
    response.end(JSON.stringify(body));
  }
}
