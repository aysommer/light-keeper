import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ServerMessage, ServerMessageOf, ServerMessageType } from '@light-keeper/shared';
import { LobbyCodeGenerator } from '../src/lobby/LobbyCodeGenerator.ts';
import { LobbyError } from '../src/lobby/LobbyError.ts';
import { LobbyManager } from '../src/lobby/LobbyManager.ts';
import type { LobbyManagerOptions } from '../src/lobby/LobbyManager.ts';
import type { LobbyParticipant } from '../src/lobby/LobbyParticipant.ts';

class FakeParticipant implements LobbyParticipant {
  public readonly inbox: ServerMessage[] = [];
  public constructor(public readonly id: string) {}
  public send(message: ServerMessage): void {
    this.inbox.push(message);
  }
  public last<T extends ServerMessageType>(type: T): ServerMessageOf<T> | undefined {
    return this.inbox.filter((m): m is ServerMessageOf<T> => m.type === type).at(-1);
  }
  public count(type: ServerMessageType): number {
    return this.inbox.filter((m) => m.type === type).length;
  }
}

const createManager = (overrides: Partial<LobbyManagerOptions> = {}) =>
  new LobbyManager({
    countdownSeconds: 3,
    maxLobbies: 3,
    createSeed: () => 4242,
    ...overrides,
  });

const expectLobbyError = (action: () => void, code: string): void => {
  try {
    action();
  } catch (error) {
    expect(error).toBeInstanceOf(LobbyError);
    expect((error as LobbyError).code).toBe(code);
    return;
  }
  throw new Error(`Ожидалась ошибка ${code}`);
};

describe('LobbyManager', () => {
  let manager: LobbyManager;
  let red: FakeParticipant;
  let blue: FakeParticipant;

  beforeEach(() => {
    vi.useFakeTimers();
    manager = createManager();
    red = new FakeParticipant('red-id');
    blue = new FakeParticipant('blue-id');
  });

  afterEach(() => {
    manager.dispose();
    vi.useRealTimers();
  });

  it('создатель получает красный цвет, второй игрок — голубой', () => {
    const lobby = manager.create(red);
    manager.join(blue, lobby.code);
    const state = blue.last('lobby:state')!.lobby;
    expect(state.code).toMatch(/^[A-Z]{4}$/);
    expect(state.players.map((p) => [p.id, p.color])).toEqual([
      ['red-id', 'red'],
      ['blue-id', 'blue'],
    ]);
  });

  it('третий игрок не помещается', () => {
    const lobby = manager.create(red);
    manager.join(blue, lobby.code);
    expectLobbyError(() => manager.join(new FakeParticipant('x'), lobby.code), 'lobby_full');
  });

  it('несуществующая комната', () => {
    expectLobbyError(() => manager.join(red, 'ZZZZ'), 'lobby_not_found');
  });

  it('готовность обоих запускает отсчёт и затем партию с общим seed', () => {
    const lobby = manager.create(red);
    manager.join(blue, lobby.code);
    manager.setReady(red, true);
    expect(lobby.status).toBe('waiting');
    manager.setReady(blue, true);
    expect(lobby.status).toBe('countdown');
    expect(red.last('lobby:state')!.lobby.countdownSeconds).toBe(3);

    vi.advanceTimersByTime(1000);
    expect(blue.last('lobby:state')!.lobby.countdownSeconds).toBe(2);
    vi.advanceTimersByTime(2000);

    expect(lobby.status).toBe('in_game');
    expect(red.last('match:start')).toMatchObject({ seed: 4242, you: 'red' });
    expect(blue.last('match:start')).toMatchObject({ seed: 4242, you: 'blue' });
    expect(red.count('match:start')).toBe(1);
  });

  it('отмена готовности во время отсчёта останавливает старт', () => {
    const lobby = manager.create(red);
    manager.join(blue, lobby.code);
    manager.setReady(red, true);
    manager.setReady(blue, true);
    vi.advanceTimersByTime(1000);
    manager.setReady(blue, false);
    expect(lobby.status).toBe('waiting');
    vi.advanceTimersByTime(10_000);
    expect(red.count('match:start')).toBe(0);
  });

  it('выход партнёра во время партии: match:aborted и возврат в ожидание', () => {
    const lobby = manager.create(red);
    manager.join(blue, lobby.code);
    manager.setReady(red, true);
    manager.setReady(blue, true);
    vi.advanceTimersByTime(3000);
    manager.disconnect(blue.id);

    expect(red.last('match:aborted')).toEqual({ type: 'match:aborted', reason: 'partner_left' });
    const state = red.last('lobby:state')!.lobby;
    expect(state.status).toBe('waiting');
    expect(state.players).toEqual([{ id: 'red-id', color: 'red', ready: false }]);

    // В освободившееся место можно зайти снова.
    const newcomer = new FakeParticipant('new');
    manager.join(newcomer, lobby.code);
    expect(newcomer.last('lobby:state')!.lobby.players[1]).toMatchObject({ color: 'blue' });
  });

  it('в идущую партию войти нельзя', () => {
    const lobby = manager.create(red);
    manager.join(blue, lobby.code);
    manager.setReady(red, true);
    manager.setReady(blue, true);
    vi.advanceTimersByTime(3000);
    manager.disconnect(blue.id);
    manager.join(blue, lobby.code); // red снова ждёт — можно
    manager.setReady(red, true);
    manager.setReady(blue, true);
    vi.advanceTimersByTime(3000);
    expectLobbyError(() => manager.join(new FakeParticipant('x'), lobby.code), 'lobby_in_game');
  });

  it('явный выход: подтверждение и удаление пустой комнаты', () => {
    const lobby = manager.create(red);
    expect(manager.lobbyCount).toBe(1);
    manager.leave(red);
    expect(red.last('lobby:left')).toEqual({ type: 'lobby:left' });
    expect(manager.lobbyCount).toBe(0);
    expectLobbyError(() => manager.join(blue, lobby.code), 'lobby_not_found');
    expectLobbyError(() => manager.leave(red), 'not_in_lobby');
  });

  it('создание новой комнаты выводит из старой', () => {
    const first = manager.create(red);
    manager.join(blue, first.code);
    manager.create(red);
    expect(blue.last('lobby:state')!.lobby.players).toHaveLength(1);
    expect(manager.lobbyCount).toBe(2);
  });

  it('предел количества комнат', () => {
    manager.create(new FakeParticipant('a'));
    manager.create(new FakeParticipant('b'));
    manager.create(new FakeParticipant('c'));
    expectLobbyError(() => manager.create(red), 'server_full');
  });

  it('готовность вне комнаты — ошибка', () => {
    expectLobbyError(() => manager.setReady(red, true), 'not_in_lobby');
  });

  it('нулевой отсчёт стартует сразу', () => {
    const instant = createManager({ countdownSeconds: 0 });
    const lobby = instant.create(red);
    instant.join(blue, lobby.code);
    instant.setReady(red, true);
    instant.setReady(blue, true);
    expect(lobby.status).toBe('in_game');
    instant.dispose();
  });
});

describe('LobbyCodeGenerator', () => {
  it('пропускает занятые коды', () => {
    let calls = 0;
    const generator = new LobbyCodeGenerator(() => (calls++ < 4 ? 0 : 1));
    expect(generator.generate((code) => code === 'AAAA')).toBe('BBBB');
  });
});
