import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { WebSocket } from 'ws';
import { MessageCodec, PROTOCOL_VERSION } from '@light-keeper/shared';
import type {
  ClientMessage,
  ServerMessage,
  ServerMessageOf,
  ServerMessageType,
} from '@light-keeper/shared';
import { Application } from '../src/Application.ts';
import { ServerConfig } from '../src/config/ServerConfig.ts';

const codec = new MessageCodec();

/** Тестовый клиент: копит входящие сообщения и умеет их ждать. */
class TestClient {
  private readonly inbox: ServerMessage[] = [];
  private readonly waiters: Array<() => void> = [];

  private constructor(public readonly socket: WebSocket) {
    socket.on('message', (data) => {
      const message = codec.decodeServerMessage(data.toString());
      if (message) this.inbox.push(message);
      this.waiters.splice(0).forEach((wake) => wake());
    });
  }

  public static async connect(url: string): Promise<TestClient> {
    const socket = new WebSocket(url);
    await new Promise<void>((resolve, reject) => {
      socket.once('open', () => resolve());
      socket.once('error', reject);
    });
    return new TestClient(socket);
  }

  public send(message: ClientMessage | Record<string, unknown>): void {
    this.socket.send(JSON.stringify(message));
  }

  public async waitFor<T extends ServerMessageType>(
    type: T,
    predicate: (message: ServerMessageOf<T>) => boolean = () => true,
    timeoutMs = 2000,
  ): Promise<ServerMessageOf<T>> {
    const deadline = Date.now() + timeoutMs;
    for (;;) {
      const found = this.inbox.find(
        (m): m is ServerMessageOf<T> => m.type === type && predicate(m as ServerMessageOf<T>),
      );
      if (found) {
        this.inbox.splice(this.inbox.indexOf(found), 1);
        return found;
      }
      const left = deadline - Date.now();
      if (left <= 0) throw new Error(`Не дождались ${type}`);
      await new Promise<void>((resolve) => {
        const timer = setTimeout(resolve, left);
        this.waiters.push(() => {
          clearTimeout(timer);
          resolve();
        });
      });
    }
  }

  public async hello(): Promise<string> {
    this.send({ type: 'hello', protocolVersion: PROTOCOL_VERSION });
    return (await this.waitFor('welcome')).playerId;
  }

  public close(): void {
    this.socket.close();
  }
}

describe('WsGateway (интеграция)', () => {
  let app: Application;
  let url = '';
  const clients: TestClient[] = [];
  const connect = async (): Promise<TestClient> => {
    const client = await TestClient.connect(url);
    clients.push(client);
    return client;
  };

  beforeEach(async () => {
    app = new Application(new ServerConfig(0, '127.0.0.1'), {
      lobby: { countdownSeconds: 0, maxLobbies: 10, createSeed: () => 777 },
    });
    const address = await app.start();
    url = `ws://127.0.0.1:${address.port}/ws`;
  });

  afterEach(async () => {
    clients.splice(0).forEach((client) => client.close());
    await app.stop();
  });

  it('два игрока создают комнату, входят по коду и стартуют с общим seed', async () => {
    const host = await connect();
    const guest = await connect();
    const hostId = await host.hello();
    const guestId = await guest.hello();
    expect(hostId).not.toBe(guestId);

    host.send({ type: 'lobby:create' });
    const { lobby } = await host.waitFor('lobby:state');
    guest.send({ type: 'lobby:join', code: lobby.code.toLowerCase() });
    await guest.waitFor('lobby:state', (m) => m.lobby.players.length === 2);

    host.send({ type: 'lobby:ready', ready: true });
    guest.send({ type: 'lobby:ready', ready: true });

    const hostStart = await host.waitFor('match:start');
    const guestStart = await guest.waitFor('match:start');
    expect(hostStart.seed).toBe(777);
    expect(guestStart.seed).toBe(777);
    expect(hostStart.you).toBe('red');
    expect(guestStart.you).toBe('blue');
    expect(hostStart.players.map((p) => p.id).sort()).toEqual([hostId, guestId].sort());
  });

  it('ввод игрока двигает его в снимках сервера', async () => {
    const host = await connect();
    const guest = await connect();
    const hostId = await host.hello();
    await guest.hello();
    host.send({ type: 'lobby:create' });
    const { lobby } = await host.waitFor('lobby:state');
    guest.send({ type: 'lobby:join', code: lobby.code });
    host.send({ type: 'lobby:ready', ready: true });
    guest.send({ type: 'lobby:ready', ready: true });
    const start = await host.waitFor('match:start');
    expect(start.tickRate).toBe(20);

    const first = await guest.waitFor('match:snapshot');
    const startY = first.snapshot.players.find((p) => p.id === hostId)!.y;
    host.send({
      type: 'input',
      commands: [1, 2, 3].map((seq) => ({
        seq,
        dt: 0.05,
        moveX: 0,
        moveY: 1,
        yaw: 0,
        pitch: 0,
        run: false,
        space: 0,
      })),
    });
    const moved = await guest.waitFor('match:snapshot', (m) =>
      m.snapshot.players.some((p) => p.id === hostId && p.lastSeq === 3),
    );
    const host3 = moved.snapshot.players.find((p) => p.id === hostId)!;
    expect(host3.y).toBeGreaterThan(startY + 0.2);
  });

  it('отладочный переход работает только с allowDebug', async () => {
    const startMatch = async (): Promise<[TestClient, TestClient]> => {
      const host = await connect();
      const guest = await connect();
      await host.hello();
      await guest.hello();
      host.send({ type: 'lobby:create' });
      const { lobby } = await host.waitFor('lobby:state');
      guest.send({ type: 'lobby:join', code: lobby.code });
      host.send({ type: 'lobby:ready', ready: true });
      guest.send({ type: 'lobby:ready', ready: true });
      await host.waitFor('match:start');
      return [host, guest];
    };

    // Без allowDebug команда игнорируется.
    const [host] = await startMatch();
    host.send({ type: 'debug:next-space' });
    await new Promise((resolve) => setTimeout(resolve, 150));
    const plain = await host.waitFor('match:snapshot', (m) => m.snapshot.tick > 3);
    expect(plain.snapshot.phase).toBe('playing');

    // С allowDebug — начинается переход.
    await app.stop();
    app = new Application(new ServerConfig(0, '127.0.0.1', true), {
      lobby: {
        countdownSeconds: 0,
        maxLobbies: 10,
        createSeed: () => 777,
        match: { tickRate: 20, transitionSeconds: 0.1 },
      },
    });
    url = `ws://127.0.0.1:${(await app.start()).port}/ws`;
    const [debugHost, debugGuest] = await startMatch();
    debugHost.send({ type: 'debug:next-space' });
    await debugGuest.waitFor('match:snapshot', (m) => m.snapshot.phase === 'transition');
    await debugGuest.waitFor('match:snapshot', (m) => m.snapshot.spaceIndex === 1);
  });

  it('обрыв соединения партнёра прерывает партию', async () => {
    const host = await connect();
    const guest = await connect();
    await host.hello();
    await guest.hello();
    host.send({ type: 'lobby:create' });
    const { lobby } = await host.waitFor('lobby:state');
    guest.send({ type: 'lobby:join', code: lobby.code });
    host.send({ type: 'lobby:ready', ready: true });
    guest.send({ type: 'lobby:ready', ready: true });
    await host.waitFor('match:start');

    guest.socket.terminate();
    await host.waitFor('match:aborted');
    const state = await host.waitFor(
      'lobby:state',
      (m) => m.lobby.status === 'waiting' && m.lobby.players.length === 1,
    );
    expect(state.lobby.players[0]).toMatchObject({ color: 'red', ready: false });
  });

  it('без hello команды не принимаются', async () => {
    const client = await connect();
    client.send({ type: 'lobby:create' });
    expect((await client.waitFor('error')).code).toBe('not_welcomed');
  });

  it('несовместимая версия протокола: ошибка и разрыв', async () => {
    const client = await connect();
    const closed = new Promise<number>((resolve) => client.socket.once('close', resolve));
    client.send({ type: 'hello', protocolVersion: PROTOCOL_VERSION + 100 });
    expect((await client.waitFor('error')).code).toBe('version_mismatch');
    expect(await closed).toBe(4000);
  });

  it('некорректные сообщения отклоняются без разрыва', async () => {
    const client = await connect();
    await client.hello();
    client.socket.send('не json');
    expect((await client.waitFor('error')).code).toBe('bad_message');
    client.send({ type: 'ping', sentAt: 5 });
    expect((await client.waitFor('pong')).sentAt).toBe(5);
  });

  it('вход в несуществующую комнату', async () => {
    const client = await connect();
    await client.hello();
    client.send({ type: 'lobby:join', code: 'QQQQ' });
    expect((await client.waitFor('error')).code).toBe('lobby_not_found');
  });

  it('флуд сообщениями закрывает соединение', async () => {
    const client = await connect();
    await client.hello();
    const closed = new Promise<number>((resolve) => client.socket.once('close', resolve));
    for (let i = 0; i < 300; i++) client.send({ type: 'ping', sentAt: i });
    expect(await closed).toBe(1008);
  });
});
