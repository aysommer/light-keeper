import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ProtocolGuard } from '@light-keeper/shared';
import { ServerConfig } from '../src/config/ServerConfig.ts';
import { HttpServer } from '../src/server/HttpServer.ts';

describe('HttpServer', () => {
  const server = new HttpServer(new ServerConfig(0, '127.0.0.1'));
  let baseUrl = '';

  beforeAll(async () => {
    const address = await server.start();
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    await server.stop();
  });

  it('GET /health возвращает корректный HealthResponse', async () => {
    const response = await fetch(`${baseUrl}/health`);
    expect(response.status).toBe(200);
    expect(ProtocolGuard.isHealthResponse(await response.json())).toBe(true);
  });

  it('неизвестный маршрут возвращает 404', async () => {
    const response = await fetch(`${baseUrl}/nope`);
    expect(response.status).toBe(404);
  });
});

describe('ServerConfig.fromEnv', () => {
  it('использует значения по умолчанию', () => {
    const config = ServerConfig.fromEnv({});
    expect(config.port).toBe(ServerConfig.DEFAULT_PORT);
    expect(config.host).toBe(ServerConfig.DEFAULT_HOST);
  });

  it('читает PORT и HOST', () => {
    const config = ServerConfig.fromEnv({ PORT: '4000', HOST: '127.0.0.1' });
    expect(config.port).toBe(4000);
    expect(config.host).toBe('127.0.0.1');
  });

  it('LK_DEBUG=1 включает отладочные команды', () => {
    expect(ServerConfig.fromEnv({}).allowDebug).toBe(false);
    expect(ServerConfig.fromEnv({ LK_DEBUG: '1' }).allowDebug).toBe(true);
  });

  it('отклоняет некорректный PORT', () => {
    expect(() => ServerConfig.fromEnv({ PORT: 'abc' })).toThrow();
  });
});
