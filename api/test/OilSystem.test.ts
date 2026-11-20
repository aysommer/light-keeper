import { describe, expect, it } from 'vitest';
import { GameConfig, SpaceGenerator } from '@light-keeper/shared';
import type { PlayerInput, ServerMessage } from '@light-keeper/shared';
import { Match } from '../src/game/Match.ts';
import type { LobbyParticipant } from '../src/lobby/LobbyParticipant.ts';

class FakeParticipant implements LobbyParticipant {
  public readonly inbox: ServerMessage[] = [];
  public constructor(public readonly id: string) {}
  public send(message: ServerMessage): void {
    this.inbox.push(message);
  }
}

type Id = 'red' | 'blue';
const settings = GameConfig.canister;

/** Seed, где в первом пространстве хотя бы три полные канистры и одна пустая. */
const findOilySpace = (): { seed: number; index: number } => {
  for (let seed = 1; seed < 2000; seed++) {
    const space = new SpaceGenerator(seed).generate(0);
    const full = space.oilSpawns.filter((_, i) => space.isOilFull(i)).length;
    if (full >= 3 && full < space.oilSpawns.length) return { seed, index: 0 };
  }
  throw new Error('Нет подходящего пространства');
};

const setup = () => {
  const { seed } = findOilySpace();
  let now = 0;
  const red = new FakeParticipant('red');
  const match = new Match(
    seed,
    [
      { participant: red, color: 'red' },
      { participant: new FakeParticipant('blue'), color: 'blue' },
    ],
    { tickRate: 20, now: () => now },
  );
  const player = (id: Id) => match.world.players.get(id)!;
  const space = match.world.space;
  const spawns = space.oilSpawns.filter((_, i) => space.isOilFull(i));
  const emptySpawn = space.oilSpawns.find((_, i) => !space.isOilFull(i))!;
  const fullIndex = space.oilSpawns.indexOf(spawns[0]!);
  let seq = 0;
  const tick = (input: { refuel?: boolean; move?: boolean } = {}): void => {
    const command: PlayerInput = {
      seq: ++seq,
      dt: 0.05,
      moveX: 0,
      moveY: input.move ? 1 : 0,
      yaw: 0,
      pitch: 0,
      run: false,
      interact: false,
      item: 'lamp',
      refuel: input.refuel ?? false,
      space: match.world.spaceIndex,
    };
    match.receiveInput('red', [command]);
    now += 50;
    match.step();
  };
  const ticksFor = (seconds: number): number => Math.round(seconds * 20);
  const lastSnapshot = () => {
    const message = red.inbox.filter((m) => m.type === 'match:snapshot').at(-1);
    if (message?.type !== 'match:snapshot') throw new Error('нет снимка');
    return message.snapshot;
  };
  return { match, player, spawns, emptySpawn, fullIndex, tick, ticksFor, lastSnapshot };
};

describe('OilSystem: канистры', () => {
  it('игрок подбирает канистру, проходя рядом; подобранную второй раз не взять', () => {
    const ctx = setup();
    ctx.player('red').position = ctx.spawns[0]!;
    ctx.tick();
    expect(ctx.player('red').canisters).toBe(1);
    expect(ctx.lastSnapshot().oilTaken).toEqual([ctx.fullIndex]);

    ctx.player('blue').position = ctx.spawns[0]!;
    ctx.tick();
    expect(ctx.player('blue').canisters).toBe(0);
  });

  it('больше двух канистр не унести — лишняя остаётся лежать', () => {
    const ctx = setup();
    for (const spawn of ctx.spawns.slice(0, 3)) {
      ctx.player('red').position = spawn;
      ctx.tick();
    }
    expect(ctx.player('red').canisters).toBe(settings.maxCarried);
    expect(ctx.lastSnapshot().oilTaken).toHaveLength(settings.maxCarried);
  });
});

describe('OilSystem: пустые канистры', () => {
  it('пустую канистру-обманку не подобрать', () => {
    const ctx = setup();
    ctx.player('red').position = ctx.emptySpawn;
    ctx.tick();
    expect(ctx.player('red').canisters).toBe(0);
  });

  it('после заправки опустевшая канистра остаётся лежать, и её не подобрать', () => {
    const ctx = setup();
    ctx.player('red').canisters = 1;
    ctx.player('red').lamp.oil = 30;
    for (let i = 0; i < ctx.ticksFor(settings.refuelSeconds); i++) ctx.tick({ refuel: true });
    const dropped = ctx.lastSnapshot().oilDropped;
    expect(dropped).toHaveLength(1);
    expect(
      Math.hypot(
        dropped[0]!.x - ctx.player('red').position.x,
        dropped[0]!.y - ctx.player('red').position.y,
      ),
    ).toBeLessThan(0.6);
    ctx.player('blue').position = ctx.player('red').position;
    ctx.tick();
    expect(ctx.player('blue').canisters).toBe(0);
  });
});

describe('OilSystem: заправка', () => {
  const withCanister = () => {
    const ctx = setup();
    ctx.player('red').canisters = 1;
    ctx.player('red').lamp.oil = 30;
    return ctx;
  };

  it('удержание R 1.5 с стоя на месте добавляет масло и тратит канистру', () => {
    const ctx = withCanister();
    for (let i = 0; i < ctx.ticksFor(settings.refuelSeconds) - 1; i++) ctx.tick({ refuel: true });
    expect(ctx.lastSnapshot().players[0]!.refuelProgress).toBeGreaterThan(0.9);
    ctx.tick({ refuel: true });
    expect(ctx.player('red').canisters).toBe(0);
    // 30 % минус немного сгоревшего за время заправки, плюс канистра.
    expect(ctx.player('red').lamp.oil).toBeGreaterThan(30 + settings.amount - 2);
    expect(ctx.player('red').refuelSeconds).toBe(0);
  });

  it('пошёл или отпустил R — прогресс сбрасывается', () => {
    const ctx = withCanister();
    for (let i = 0; i < ctx.ticksFor(1); i++) ctx.tick({ refuel: true });
    ctx.tick({ refuel: true, move: true });
    expect(ctx.player('red').refuelSeconds).toBe(0);
    for (let i = 0; i < ctx.ticksFor(1); i++) ctx.tick({ refuel: true });
    ctx.tick();
    expect(ctx.player('red').refuelSeconds).toBe(0);
    expect(ctx.player('red').canisters).toBe(1);
  });

  it('без канистры или с полной лампой заправки нет', () => {
    const empty = setup();
    empty.player('red').lamp.oil = 30;
    for (let i = 0; i < empty.ticksFor(2); i++) empty.tick({ refuel: true });
    expect(empty.player('red').lamp.oil).toBeLessThan(30);

    const full = setup();
    full.player('red').canisters = 1;
    for (let i = 0; i < full.ticksFor(2); i++) full.tick({ refuel: true });
    expect(full.player('red').canisters).toBe(1);
  });

  it('масла не больше 100 %', () => {
    const ctx = withCanister();
    ctx.player('red').lamp.oil = 80;
    for (let i = 0; i < ctx.ticksFor(settings.refuelSeconds); i++) ctx.tick({ refuel: true });
    expect(ctx.player('red').lamp.oil).toBe(100);
  });
});

describe('OilSystem: новое пространство', () => {
  it('канистры в руках пропадают, подобранные пространства прошлого — забыты', () => {
    const ctx = setup();
    ctx.player('red').position = ctx.spawns[0]!;
    ctx.tick();
    ctx.match.world.enterSpace(1);
    ctx.tick();
    expect(ctx.player('red').canisters).toBe(0);
    expect(ctx.lastSnapshot().oilTaken).toEqual([]);
    expect(ctx.lastSnapshot().oilDropped).toEqual([]);
  });
});
