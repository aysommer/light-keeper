import { describe, expect, it } from 'vitest';
import { GameConfig } from '@light-keeper/shared';
import type { PlayerInput, ServerMessage, ServerMessageOf } from '@light-keeper/shared';
import { InputBudget } from '../src/game/InputBudget.ts';
import { Match } from '../src/game/Match.ts';
import type { LobbyParticipant } from '../src/lobby/LobbyParticipant.ts';

class FakeParticipant implements LobbyParticipant {
  public readonly inbox: ServerMessage[] = [];
  public constructor(public readonly id: string) {}
  public send(message: ServerMessage): void {
    this.inbox.push(message);
  }
  public lastSnapshot(): ServerMessageOf<'match:snapshot'>['snapshot'] {
    const message = this.inbox.filter((m) => m.type === 'match:snapshot').at(-1);
    if (!message || message.type !== 'match:snapshot') throw new Error('Нет снимка');
    return message.snapshot;
  }
}

const forward = (seq: number, overrides: Partial<PlayerInput> = {}): PlayerInput => ({
  seq,
  dt: 0.05,
  moveX: 0,
  moveY: 1,
  yaw: 0,
  pitch: 0,
  run: false,
  interact: false,
  item: 'lamp',
  space: 0,
  ...overrides,
});

const setup = () => {
  let now = 0;
  const red = new FakeParticipant('red');
  const blue = new FakeParticipant('blue');
  const match = new Match(
    12345,
    [
      { participant: red, color: 'red' },
      { participant: blue, color: 'blue' },
    ],
    { tickRate: 20, transitionSeconds: 1, now: () => now },
  );
  const advance = (ms: number): void => {
    now += ms;
    match.step();
  };
  return { match, red, blue, advance };
};

describe('InputBudget', () => {
  it('не даёт потратить больше накопленного и ограничен ёмкостью', () => {
    const budget = new InputBudget(1, 0);
    expect(budget.spend(0.1)).toBe(0);
    budget.credit(0.05);
    expect(budget.spend(0.1)).toBeCloseTo(0.05);
    budget.credit(10);
    expect(budget.seconds).toBe(1);
  });
});

describe('Match', () => {
  it('игроки стартуют на разных позициях стартового зала', () => {
    const { red, blue, advance } = setup();
    advance(50);
    const [r, b] = red.lastSnapshot().players;
    expect(r!.id).toBe('red');
    expect(b!.id).toBe('blue');
    expect(r!.x).not.toBe(b!.x);
    expect(blue.lastSnapshot()).toEqual(red.lastSnapshot());
  });

  it('применяет команды и подтверждает номер последней', () => {
    const { match, red, advance } = setup();
    advance(50);
    const startY = red.lastSnapshot().players[0]!.y;
    match.receiveInput('red', [forward(1), forward(2)]);
    advance(100);
    const me = red.lastSnapshot().players[0]!;
    expect(me.lastSeq).toBe(2);
    expect(me.y - startY).toBeCloseTo(GameConfig.player.walkSpeed * 0.1, 5);
  });

  it('повторы и старые команды игнорируются', () => {
    const { match, red, advance } = setup();
    advance(50);
    match.receiveInput('red', [forward(5)]);
    advance(50);
    const y = red.lastSnapshot().players[0]!.y;
    match.receiveInput('red', [forward(5), forward(3)]);
    advance(50);
    expect(red.lastSnapshot().players[0]!.y).toBe(y);
    expect(red.lastSnapshot().players[0]!.lastSeq).toBe(5);
  });

  it('speedhack: нельзя пройти больше, чем позволяет реальное время', () => {
    const { match, red, advance } = setup();
    advance(50);
    const startY = red.lastSnapshot().players[0]!.y;
    // 10 секунд команд за полсекунды реального времени.
    let seq = 0;
    for (let tick = 0; tick < 10; tick++) {
      match.receiveInput(
        'red',
        Array.from({ length: 16 }, () => forward(++seq, { dt: 0.1 })),
      );
      advance(50);
    }
    const travelled = red.lastSnapshot().players[0]!.y - startY;
    // Начальный запас 0.25 с + 0.5 с реального времени.
    expect(travelled).toBeLessThanOrEqual(GameConfig.player.walkSpeed * 0.8 + 1e-6);
  });

  it('снимки нумеруются и несут время сервера', () => {
    const { red, advance } = setup();
    advance(50);
    advance(50);
    const snapshot = red.lastSnapshot();
    expect(snapshot.tick).toBe(2);
    expect(snapshot.serverTime).toBe(100);
  });

  it('переход: затемнение, затем новое пространство и оба игрока на его старте', () => {
    const { match, red, advance } = setup();
    advance(50);
    match.receiveInput('red', [forward(1)]);
    advance(50);
    expect(red.lastSnapshot()).toMatchObject({ spaceIndex: 0, phase: 'playing' });

    match.requestNextSpace();
    match.requestNextSpace(); // повтор во время перехода игнорируется
    advance(50);
    expect(red.lastSnapshot()).toMatchObject({ spaceIndex: 0, phase: 'transition' });
    advance(1000);
    const snapshot = red.lastSnapshot();
    expect(snapshot).toMatchObject({ spaceIndex: 1, phase: 'playing' });

    const space = match.world.space;
    expect(space.index).toBe(1);
    const [r, b] = snapshot.players;
    expect(r!.x).toBe(space.startPositions[0].x);
    expect(r!.y).toBe(space.startPositions[0].y);
    expect(b!.x).toBe(space.startPositions[1].x);
    expect(r!.yaw).toBe(space.startYaw);
  });

  it('во время перехода и командами прошлого пространства не сдвинуться, но они подтверждаются', () => {
    const { match, red, advance } = setup();
    advance(50);
    match.requestNextSpace();
    advance(50);
    const during = red.lastSnapshot().players[0]!;
    match.receiveInput('red', [forward(1)]);
    advance(50);
    const after = red.lastSnapshot().players[0]!;
    expect(after.y).toBe(during.y);
    expect(after.lastSeq).toBe(1);

    advance(1000); // теперь пространство 1
    const start = red.lastSnapshot().players[0]!;
    match.receiveInput('red', [forward(2, { space: 0 })]);
    advance(50);
    expect(red.lastSnapshot().players[0]!.y).toBe(start.y);
    match.receiveInput('red', [forward(3, { space: 1 })]);
    advance(50);
    expect(red.lastSnapshot().players[0]!.y).not.toBe(start.y);
  });

  it('команды неизвестного игрока игнорируются', () => {
    const { match, advance } = setup();
    expect(() => match.receiveInput('ghost', [forward(1)])).not.toThrow();
    advance(50);
  });
});
