import { describe, expect, it } from 'vitest';
import { GameConfig, SpaceGenerator, Vector2 } from '@light-keeper/shared';
import type { ExitKind, PlayerInput, ServerMessage, ServerMessageOf } from '@light-keeper/shared';
import { Match } from '../src/game/Match.ts';
import type { LobbyParticipant } from '../src/lobby/LobbyParticipant.ts';

class FakeParticipant implements LobbyParticipant {
  public readonly inbox: ServerMessage[] = [];
  public constructor(public readonly id: string) {}
  public send(message: ServerMessage): void {
    this.inbox.push(message);
  }
  public last<T extends ServerMessage['type']>(type: T): ServerMessageOf<T> | undefined {
    return this.inbox.filter((m): m is ServerMessageOf<T> => m.type === type).at(-1);
  }
}

const SEED = 4242;

/** Номер первого пространства с дверью нужного типа. */
const indexWithKind = (kind: ExitKind): number => {
  const generator = new SpaceGenerator(SEED);
  for (let index = 0; index < 50; index++) {
    if (generator.generate(index).exit.kind === kind) return index;
  }
  throw new Error(`Нет двери ${kind}`);
};

const setup = (spaceIndex = 0) => {
  let now = 0;
  let ended = 0;
  const red = new FakeParticipant('red');
  const blue = new FakeParticipant('blue');
  const match = new Match(
    SEED,
    [
      { participant: red, color: 'red' },
      { participant: blue, color: 'blue' },
    ],
    { tickRate: 20, transitionSeconds: 0.5, now: () => now, onEnd: () => ended++ },
  );
  if (spaceIndex > 0) match.world.enterSpace(spaceIndex);
  const seq = { red: 0, blue: 0 };
  const space = () => match.world.space;
  const player = (id: 'red' | 'blue') => match.world.players.get(id)!;

  /** Поставить игрока перед дверью. */
  const toDoor = (id: 'red' | 'blue', offset = 0.6): void => {
    player(id).position = space().exit.frontPoint(offset);
  };
  /** Один тик: каждый игрок шлёт команду «стоять» с нужным состоянием `E`. */
  const tick = (interact: Partial<Record<'red' | 'blue', boolean>> = {}): void => {
    for (const id of ['red', 'blue'] as const) {
      const command: PlayerInput = {
        seq: ++seq[id],
        dt: 0.05,
        moveX: 0,
        moveY: 0,
        yaw: 0,
        pitch: 0,
        run: false,
        interact: interact[id] ?? false,
        item: 'lamp',
        refuel: false,
        space: space().index,
      };
      match.receiveInput(id, [command]);
    }
    now += 50;
    match.step();
  };
  const ticksFor = (seconds: number): number => Math.round(seconds * 20);
  const exitState = () => red.last('match:snapshot')!.snapshot.exit;
  return { match, red, blue, player, toDoor, tick, ticksFor, exitState, space, ended: () => ended };
};

describe('ExitSystem: открытие', () => {
  it('удержание E у двери 3 секунды открывает её', () => {
    const { toDoor, tick, ticksFor, exitState } = setup();
    toDoor('red');
    tick();
    for (let i = 0; i < ticksFor(GameConfig.exit.openSeconds) - 1; i++) tick({ red: true });
    expect(exitState().open).toBe(false);
    expect(exitState().openerId).toBe('red');
    expect(exitState().openProgress).toBeGreaterThan(0.9);
    tick({ red: true });
    expect(exitState().open).toBe(true);
    expect(exitState().secondsLeft).toBeCloseTo(GameConfig.exit.timerSeconds, 0);
  });

  it('отпустил E — прогресс сбрасывается', () => {
    const { toDoor, tick, ticksFor, exitState } = setup();
    toDoor('red');
    for (let i = 0; i < ticksFor(2); i++) tick({ red: true });
    tick({ red: false });
    expect(exitState().openProgress).toBe(0);
    expect(exitState().openerId).toBeNull();
    for (let i = 0; i < ticksFor(2); i++) tick({ red: true });
    expect(exitState().open).toBe(false);
  });

  it('отошёл от двери — прогресс сбрасывается', () => {
    const { toDoor, tick, ticksFor, exitState, player } = setup();
    toDoor('red');
    for (let i = 0; i < ticksFor(2); i++) tick({ red: true });
    player('red').position = player('red').position.add(new Vector2(5, 5));
    tick({ red: true });
    expect(exitState().openProgress).toBe(0);
  });

  it('вдалеке от двери E ничего не делает', () => {
    const { tick, ticksFor, exitState } = setup();
    for (let i = 0; i < ticksFor(4); i++) tick({ red: true, blue: true });
    expect(exitState().open).toBe(false);
    expect(exitState().openProgress).toBe(0);
  });

  it('вдвоём быстрее не открыть', () => {
    const { toDoor, tick, ticksFor, exitState } = setup();
    toDoor('red', 0.5);
    toDoor('blue', 0.9);
    for (let i = 0; i < ticksFor(GameConfig.exit.openSeconds) - 1; i++) {
      tick({ red: true, blue: true });
    }
    expect(exitState().open).toBe(false);
  });
});

describe('ExitSystem: тамбур и таймер', () => {
  const openDoor = (ctx: ReturnType<typeof setup>): void => {
    ctx.toDoor('red');
    for (let i = 0; i < ctx.ticksFor(GameConfig.exit.openSeconds); i++) ctx.tick({ red: true });
    expect(ctx.exitState().open).toBe(true);
  };

  it('удержание E после открытия не заводит в тамбур — нужно новое нажатие', () => {
    const ctx = setup();
    openDoor(ctx);
    ctx.tick({ red: true });
    expect(ctx.player('red').inTambour).toBe(false);
    ctx.tick({ red: false });
    ctx.tick({ red: true });
    expect(ctx.player('red').inTambour).toBe(true);
  });

  it('оба вошли — переход в следующее пространство, все на старте', () => {
    const ctx = setup();
    openDoor(ctx);
    ctx.toDoor('blue');
    ctx.tick();
    ctx.tick({ red: true, blue: true });
    expect(ctx.red.last('match:snapshot')!.snapshot.phase).toBe('transition');
    for (let i = 0; i < ctx.ticksFor(0.6); i++) ctx.tick();
    const snapshot = ctx.red.last('match:snapshot')!.snapshot;
    expect(snapshot.spaceIndex).toBe(1);
    expect(snapshot.exit.open).toBe(false);
    expect(snapshot.players.every((p) => !p.inTambour)).toBe(true);
  });

  it('в тамбуре нельзя двигаться', () => {
    const ctx = setup();
    openDoor(ctx);
    ctx.tick();
    ctx.tick({ red: true });
    const before = ctx.player('red').position;
    ctx.match.receiveInput('red', [
      {
        seq: 10_000,
        dt: 0.05,
        moveX: 0,
        moveY: 1,
        yaw: 0,
        pitch: 0,
        run: true,
        interact: false,
        item: 'lamp',
        refuel: false,
        space: 0,
      },
    ]);
    ctx.tick();
    expect(ctx.player('red').position).toEqual(before);
  });

  it('не успели войти оба за 30 секунд — конец партии', () => {
    const ctx = setup();
    openDoor(ctx);
    ctx.tick();
    ctx.tick({ red: true }); // красный в тамбуре, голубой далеко
    for (let i = 0; i < ctx.ticksFor(GameConfig.exit.timerSeconds) + 2; i++) ctx.tick();
    expect(ctx.red.last('match:over')).toEqual({
      type: 'match:over',
      reason: 'door_timeout',
      spacesCleared: 0,
    });
    expect(ctx.blue.last('match:over')).toBeDefined();
    expect(ctx.ended()).toBe(1);
  });
});

describe('ExitSystem: ключ и скрытая дверь', () => {
  it('запертая дверь: без ключа не открыть, ключ личный', () => {
    const ctx = setup(indexWithKind('locked'));
    const key = ctx.space().key!;
    ctx.toDoor('red');
    for (let i = 0; i < ctx.ticksFor(4); i++) ctx.tick({ red: true });
    expect(ctx.exitState().open).toBe(false);

    // Голубой подбирает ключ.
    ctx.player('blue').position = key;
    ctx.tick();
    expect(ctx.exitState().keyHolderId).toBe('blue');

    // Красный у двери всё равно не откроет — ключ у голубого.
    for (let i = 0; i < ctx.ticksFor(4); i++) ctx.tick({ red: true });
    expect(ctx.exitState().open).toBe(false);

    // Голубой подходит и открывает.
    ctx.toDoor('blue', 0.9);
    for (let i = 0; i < ctx.ticksFor(GameConfig.exit.openSeconds); i++) ctx.tick({ blue: true });
    expect(ctx.exitState().open).toBe(true);
  });

  it('скрытая дверь проявляется, когда игрок подходит ближе 3 м, и остаётся видимой', () => {
    const ctx = setup(indexWithKind('hidden'));
    ctx.tick();
    expect(ctx.exitState().revealed).toBe(false);
    ctx.toDoor('red', 2.5);
    ctx.tick();
    expect(ctx.exitState().revealed).toBe(true);
    ctx.player('red').position = ctx.space().startPositions[0];
    ctx.tick();
    expect(ctx.exitState().revealed).toBe(true);
  });

  it('скрытую дверь проявляет только горящая лампа в руке', () => {
    const ctx = setup(indexWithKind('hidden'));
    // С компасом в руке лампа убрана — дверь не проявится.
    ctx.player('red').item = 'compass';
    ctx.toDoor('red', 2);
    ctx.match.step();
    expect(ctx.player('red').lampShining).toBe(false);
    expect(ctx.match.world.exit.revealed).toBe(false);
    // Погасшая лампа тоже не проявит.
    ctx.player('red').item = 'lamp';
    ctx.player('red').lamp.oil = 0;
    ctx.match.step();
    expect(ctx.match.world.exit.revealed).toBe(false);
    ctx.player('red').lamp.oil = 50;
    ctx.match.step();
    expect(ctx.match.world.exit.revealed).toBe(true);
  });

  it('новое пространство — лампы снова полные и холодные', () => {
    const ctx = setup();
    ctx.player('red').lamp.oil = 10;
    ctx.player('red').lamp.heat = 90;
    ctx.match.world.enterSpace(1);
    expect(ctx.player('red').lamp.snapshot()).toEqual({
      oil: 100,
      heat: 0,
      lit: true,
      overheated: false,
    });
  });

  it('снимок несёт состояние лампы и предмет в руке', () => {
    const ctx = setup();
    for (let i = 0; i < 40; i++) ctx.tick();
    const red = ctx.red.last('match:snapshot')!.snapshot.players.find((p) => p.id === 'red')!;
    expect(red.item).toBe('lamp');
    expect(red.lamp.oil).toBeLessThan(100);
    expect(red.lamp.heat).toBeGreaterThan(0);
  });

  it('у обычной двери ключа нет и она видна сразу', () => {
    const ctx = setup();
    ctx.tick();
    expect(ctx.space().key).toBeNull();
    expect(ctx.exitState().revealed).toBe(true);
    expect(ctx.exitState().keyHolderId).toBeNull();
  });
});
