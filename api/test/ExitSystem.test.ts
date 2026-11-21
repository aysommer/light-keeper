import { describe, expect, it } from 'vitest';
import { ExitCode, GameConfig, SpaceGenerator, Vector2 } from '@light-keeper/shared';
import type {
  ExitKind,
  HeldItem,
  PlayerInput,
  ServerMessage,
  ServerMessageOf,
} from '@light-keeper/shared';
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
const indexWithKind = (kind: ExitKind, minKeys = 0): number => {
  const generator = new SpaceGenerator(SEED);
  for (let index = 0; index < 80; index++) {
    const space = generator.generate(index);
    if (space.exit.kind === kind && space.keys.length >= minKeys) return index;
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
  // Лампу в каждом пространстве получает случайный игрок; в тестах — красный.
  if (spaceIndex > 0) match.world.enterSpace(spaceIndex);
  match.world.giveLampTo('red');
  const seq = { red: 0, blue: 0 };
  /** Что каждый держит в руке (слоты 1–4). */
  const items: Record<'red' | 'blue', HeldItem> = { red: 'lamp', blue: 'lamp' };
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
        item: items[id],
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
  return {
    match,
    red,
    blue,
    items,
    player,
    toDoor,
    tick,
    ticksFor,
    exitState,
    space,
    ended: () => ended,
  };
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
    expect(ctx.red.last('match:over')).toMatchObject({
      type: 'match:over',
      reason: 'door_timeout',
      spacesCleared: 0,
      place: null,
    });
    expect(ctx.red.last('match:over')!.elapsedSeconds).toBeGreaterThan(30);
    expect(ctx.blue.last('match:over')).toBeDefined();
    expect(ctx.ended()).toBe(1);
  });
});

describe('ExitSystem: запертая дверь и ключи', () => {
  const hold = (ctx: ReturnType<typeof setup>, id: 'red' | 'blue'): void => {
    for (let i = 0; i < ctx.ticksFor(GameConfig.exit.openSeconds); i++) ctx.tick({ [id]: true });
  };

  it('без ключа не открыть; ключ должен быть в руке (слот 3)', () => {
    const ctx = setup(indexWithKind('locked'));
    const keys = ctx.space().keys;
    ctx.toDoor('red');
    for (let i = 0; i < ctx.ticksFor(4); i++) ctx.tick({ red: true });
    expect(ctx.exitState().open).toBe(false);

    // Красный собирает все ключи, но держит лампу — дверь не открывается.
    for (const key of keys) {
      ctx.player('red').position = key;
      ctx.tick();
    }
    expect(ctx.player('red').keys).toBe(keys.length);
    expect(ctx.exitState().keysTaken).toEqual(keys.map((_, index) => index));
    ctx.toDoor('red');
    hold(ctx, 'red');
    expect(ctx.exitState().open).toBe(false);
    expect(ctx.exitState().keysInserted).toBe(0);

    // Взял ключи в руку — вставил все и открыл.
    ctx.items.red = 'key';
    hold(ctx, 'red');
    expect(ctx.exitState().keysInserted).toBe(keys.length);
    expect(ctx.player('red').keys).toBe(0);
    expect(ctx.exitState().open).toBe(true);
  });

  it('нужны все ключи: если они у разных игроков, вставляют оба', () => {
    const ctx = setup(indexWithKind('locked', 2));
    const keys = ctx.space().keys;
    expect(keys.length).toBeGreaterThanOrEqual(2);
    ctx.player('red').position = keys[0]!;
    ctx.tick();
    for (const key of keys.slice(1)) {
      ctx.player('blue').position = key;
      ctx.tick();
    }
    expect(ctx.player('red').keys).toBe(1);
    expect(ctx.player('blue').keys).toBe(keys.length - 1);

    ctx.items.red = 'key';
    ctx.toDoor('red');
    hold(ctx, 'red');
    expect(ctx.exitState().keysInserted).toBe(1);
    expect(ctx.exitState().open).toBe(false);
    // Ключей больше нет — повторное удержание ничего не даёт.
    hold(ctx, 'red');
    expect(ctx.exitState().keysInserted).toBe(1);

    ctx.player('red').position = ctx.space().startPositions[0];
    ctx.items.blue = 'key';
    ctx.toDoor('blue', 0.9);
    hold(ctx, 'blue');
    expect(ctx.exitState().keysInserted).toBe(keys.length);
    expect(ctx.exitState().open).toBe(true);
  });

  it('в снимке игрока — сколько у него ключей', () => {
    const ctx = setup(indexWithKind('locked'));
    ctx.player('blue').position = ctx.space().keys[0]!;
    ctx.tick();
    const blue = ctx.red.last('match:snapshot')!.snapshot.players.find((p) => p.id === 'blue')!;
    expect(blue.keys).toBe(1);
  });
});

describe('ExitSystem: дверь с кодовой панелью', () => {
  const codeSetup = () => {
    const ctx = setup(indexWithKind('code'));
    return { ...ctx, code: ctx.space().code! };
  };
  const wrongOf = (symbols: readonly string[], keypad: readonly string[]): string[] =>
    symbols.map((symbol, index) =>
      index === 0 ? keypad.find((other) => other !== symbol)! : symbol,
    );

  it('записку подбирает тот, кто подошёл к ней', () => {
    const ctx = codeSetup();
    ctx.player('blue').position = ctx.space().note!;
    ctx.tick();
    expect(ctx.exitState().noteHolderId).toBe('blue');
  });

  it('удержание E такую дверь не открывает', () => {
    const ctx = codeSetup();
    ctx.toDoor('red');
    for (let i = 0; i < ctx.ticksFor(4); i++) ctx.tick({ red: true });
    expect(ctx.exitState().open).toBe(false);
  });

  it('верный код у панели открывает дверь (знать код можно и без записки)', () => {
    const ctx = codeSetup();
    ctx.toDoor('red');
    ctx.match.submitCode('red', ctx.code.symbols);
    ctx.tick();
    expect(ctx.exitState().open).toBe(true);
    expect(ctx.exitState().secondsLeft).toBeCloseTo(GameConfig.exit.timerSeconds, 0);
  });

  it('неверный код — ошибка и пауза перед следующей попыткой', () => {
    const ctx = codeSetup();
    const keypad = ExitCode.keypad(ctx.code.alphabet);
    ctx.toDoor('red');
    ctx.match.submitCode('red', wrongOf(ctx.code.symbols, keypad));
    ctx.tick();
    expect(ctx.exitState().open).toBe(false);
    expect(ctx.exitState().codeFailures).toBe(1);
    // Во время паузы даже верный код не принимается.
    ctx.match.submitCode('red', ctx.code.symbols);
    ctx.tick();
    expect(ctx.exitState().open).toBe(false);
    for (let i = 0; i < ctx.ticksFor(GameConfig.exit.codeCooldownSeconds); i++) ctx.tick();
    ctx.match.submitCode('red', ctx.code.symbols);
    ctx.tick();
    expect(ctx.exitState().open).toBe(true);
  });

  it('вдали от панели код не принимается', () => {
    const ctx = codeSetup();
    ctx.match.submitCode('red', ctx.code.symbols);
    ctx.tick();
    expect(ctx.exitState().open).toBe(false);
    expect(ctx.exitState().codeFailures).toBe(0);
  });
});

describe('ExitSystem: лампа', () => {
  it('новое пространство — лампа снова полная и холодная', () => {
    const ctx = setup();
    ctx.player('red').lamp!.oil = 10;
    ctx.player('red').lamp!.heat = 90;
    ctx.match.world.enterSpace(1);
    expect(ctx.match.world.lamp.snapshot()).toEqual({
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
    expect(red.lamp!.oil).toBeLessThan(100);
    expect(red.lamp!.heat).toBeGreaterThan(0);
    // Лампа одна на двоих: у синего её нет, в руке — компас.
    const blue = ctx.red.last('match:snapshot')!.snapshot.players.find((p) => p.id === 'blue')!;
    expect(blue.lamp).toBeNull();
    expect(blue.item).toBe('compass');
  });

  it('в каждом пространстве лампу получает случайный игрок — то красный, то синий', () => {
    const ctx = setup();
    const lamp = ctx.match.world.lamp;
    lamp.oil = 10;
    const holders = new Set<string>();
    for (let index = 1; index <= 12; index++) {
      ctx.match.world.enterSpace(index);
      const withLamp = [ctx.player('red'), ctx.player('blue')].filter((p) => p.lamp);
      expect(withLamp).toHaveLength(1);
      expect(withLamp[0]!.lamp).toBe(lamp);
      holders.add(withLamp[0]!.id);
    }
    expect(holders).toEqual(new Set(['red', 'blue']));
    expect(lamp.oil).toBe(100);
  });

  it('жребий лампы зависит от зерна партии: у разных партий он разный', () => {
    const holderAt = (seed: number) => {
      const match = new Match(
        seed,
        [
          { participant: new FakeParticipant('red'), color: 'red' },
          { participant: new FakeParticipant('blue'), color: 'blue' },
        ],
        { tickRate: 20, now: () => 0 },
      );
      return [...match.world.players.values()].find((p) => p.lamp)!.color;
    };
    const firstHolders = new Set(Array.from({ length: 20 }, (_, seed) => holderAt(seed + 1)));
    expect(firstHolders).toEqual(new Set(['red', 'blue']));
  });

  it('у обычной двери нет ни ключей, ни записки', () => {
    const ctx = setup();
    ctx.tick();
    expect(ctx.space().keys).toEqual([]);
    expect(ctx.space().note).toBeNull();
    expect(ctx.exitState().keysTaken).toEqual([]);
    expect(ctx.exitState().noteHolderId).toBeNull();
  });
});
