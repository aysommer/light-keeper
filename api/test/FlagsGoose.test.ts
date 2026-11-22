import { describe, expect, it } from 'vitest';
import { GameConfig, SpaceGenerator, Vector2 } from '@light-keeper/shared';
import type { HeldItem, PlayerInput, ServerMessage, Space } from '@light-keeper/shared';
import { Match } from '../src/game/Match.ts';
import type { LobbyParticipant } from '../src/lobby/LobbyParticipant.ts';
import { GooseSystem } from '../src/systems/GooseSystem.ts';

class FakeParticipant implements LobbyParticipant {
  public readonly inbox: ServerMessage[] = [];
  public constructor(public readonly id: string) {}
  public send(message: ServerMessage): void {
    this.inbox.push(message);
  }
}

const SEED = 9090;
const findIndex = (test: (space: Space) => boolean): number => {
  const generator = new SpaceGenerator(SEED);
  for (let index = 1; index < 400; index++) {
    if (test(generator.generate(index))) return index;
  }
  throw new Error('нет подходящего пространства');
};

type Id = 'red' | 'blue';
const setup = (index: number) => {
  let now = 0;
  const match = new Match(
    SEED,
    [
      { participant: new FakeParticipant('red'), color: 'red' },
      { participant: new FakeParticipant('blue'), color: 'blue' },
    ],
    { tickRate: 20, now: () => now },
  );
  match.world.enterSpace(index);
  match.world.giveLampTo('red');
  const player = (id: Id) => match.world.players.get(id)!;
  const items: Record<Id, HeldItem> = { red: 'lamp', blue: 'compass' };
  const seq = { red: 0, blue: 0 };
  const tick = (interact: Partial<Record<Id, boolean>> = {}): void => {
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
        space: match.world.spaceIndex,
        floor: player(id).floor,
      };
      match.receiveInput(id, [command]);
    }
    now += 50;
    match.step();
  };
  const press = (id: Id) => {
    tick({ [id]: true });
    tick();
  };
  return { match, player, items, tick, press, space: () => match.world.space };
};

describe('Флажки', () => {
  it('E рядом — поднять; с флажком в руке E — поставить перед собой; видно в снимке', () => {
    const ctx = setup(findIndex((s) => s.flags.length > 0));
    const spot = ctx.space().flags[0]!;
    const blue = ctx.player('blue');
    blue.position = spot.position.add(new Vector2(0.5, 0));
    blue.floor = spot.floor;
    ctx.press('blue');
    expect(ctx.match.world.flags.carriedBy('blue')).toBe(1);

    // С компасом в руке E флажок не ставит.
    ctx.press('blue');
    expect(ctx.match.world.flags.carriedBy('blue')).toBe(1);

    ctx.items.blue = 'flag';
    blue.position = spot.position.add(new Vector2(3, 0));
    ctx.press('blue');
    expect(ctx.match.world.flags.carriedBy('blue')).toBe(0);
    const placed = ctx.match.world.flags.flags[0]!;
    expect(placed.holderId).toBeNull();
    expect(placed.position.distanceTo(blue.position)).toBeLessThan(0.6);
    const inbox = (ctx.player('red').participant as FakeParticipant).inbox;
    const last = inbox.filter((m) => m.type === 'match:snapshot').at(-1);
    if (last?.type !== 'match:snapshot') throw new Error('нет снимка');
    expect(last.snapshot.flags[0]).toMatchObject({ holderId: null, floor: blue.floor });
  });
});

describe('Гусь-призрак', () => {
  const gooseIndex = () => findIndex((s) => s.goose !== null);

  it('убегает от игрока на своём этаже', () => {
    const ctx = setup(gooseIndex());
    const goose = ctx.match.world.goose!;
    const blue = ctx.player('blue');
    blue.floor = goose.floor;
    blue.position = goose.position.add(new Vector2(1.5, 0));
    const before = goose.position.distanceTo(blue.position);
    for (let i = 0; i < 10; i++) ctx.tick();
    expect(goose.holderId).toBeNull();
    expect(goose.position.distanceTo(blue.position)).toBeGreaterThan(before);
  });

  it('пойман касанием; в руках открывает дверь без ключа и кода', () => {
    const ctx = setup(gooseIndex());
    const goose = ctx.match.world.goose!;
    const blue = ctx.player('blue');
    blue.floor = goose.floor;
    blue.position = goose.position.add(new Vector2(GooseSystem.CATCH_DISTANCE / 2, 0));
    ctx.tick();
    expect(goose.holderId).toBe('blue');
    ctx.items.blue = 'goose';

    // У двери с гусем в руках — E, и дверь открыта.
    const exit = ctx.space().exit;
    blue.floor = ctx.space().exitFloor;
    blue.position = exit.frontPoint(0.6);
    ctx.tick();
    ctx.press('blue');
    expect(ctx.match.world.exit.open).toBe(true);
    expect(goose.gone).toBe(true);
    expect(ctx.match.world.exit.secondsLeft).toBeCloseTo(GameConfig.exit.timerSeconds, 0);
  });

  it('сменил слот — гусь вырвался и какое-то время не даётся', () => {
    const ctx = setup(gooseIndex());
    const goose = ctx.match.world.goose!;
    const blue = ctx.player('blue');
    blue.floor = goose.floor;
    blue.position = goose.position.add(new Vector2(GooseSystem.CATCH_DISTANCE / 2, 0));
    ctx.tick();
    ctx.items.blue = 'goose';
    ctx.tick();
    expect(goose.holderId).toBe('blue');
    ctx.items.blue = 'compass';
    ctx.tick();
    expect(goose.holderId).toBeNull();
    // Сразу не ловится, даже вплотную.
    ctx.tick();
    expect(goose.holderId).toBeNull();
  });

  it('не взял гуся в руки — он вырывается сам', () => {
    const ctx = setup(gooseIndex());
    const goose = ctx.match.world.goose!;
    const blue = ctx.player('blue');
    blue.floor = goose.floor;
    blue.position = goose.position.add(new Vector2(GooseSystem.CATCH_DISTANCE / 2, 0));
    ctx.tick();
    expect(goose.holderId).toBe('blue');
    for (let i = 0; i < GooseSystem.GRAB_GRACE / 0.05 + 2; i++) ctx.tick();
    expect(goose.holderId).toBeNull();
  });

  it('без гуся в руках дверь им не открыть', () => {
    const ctx = setup(gooseIndex());
    const goose = ctx.match.world.goose!;
    const blue = ctx.player('blue');
    blue.floor = goose.floor;
    blue.position = goose.position.add(new Vector2(GooseSystem.CATCH_DISTANCE / 2, 0));
    ctx.tick();
    const exit = ctx.space().exit;
    blue.floor = ctx.space().exitFloor;
    blue.position = exit.frontPoint(0.6);
    ctx.press('blue');
    expect(goose.gone).toBe(false);
  });
});
