import { describe, expect, it } from 'vitest';
import { SpaceGenerator, Vector2 } from '@light-keeper/shared';
import type { PlayerInput, ServerMessage } from '@light-keeper/shared';
import { Match } from '../src/game/Match.ts';
import type { LobbyParticipant } from '../src/lobby/LobbyParticipant.ts';
import { StairSystem } from '../src/systems/StairSystem.ts';

class FakeParticipant implements LobbyParticipant {
  public readonly inbox: ServerMessage[] = [];
  public constructor(public readonly id: string) {}
  public send(message: ServerMessage): void {
    this.inbox.push(message);
  }
}

const SEED = 4242;
/** Номер многоэтажного пространства для партии с этим зерном. */
const multiFloorIndex = (): number => {
  const generator = new SpaceGenerator(SEED);
  for (let index = 1; index < 60; index++) {
    if (generator.generate(index).floorCount >= 2) return index;
  }
  throw new Error('нет многоэтажного пространства');
};

type Id = 'red' | 'blue';

const setup = () => {
  let now = 0;
  const match = new Match(
    SEED,
    [
      { participant: new FakeParticipant('red'), color: 'red' },
      { participant: new FakeParticipant('blue'), color: 'blue' },
    ],
    { tickRate: 20, now: () => now },
  );
  match.world.enterSpace(multiFloorIndex());
  match.world.giveLampTo('red');
  const player = (id: Id) => match.world.players.get(id)!;
  const seq = { red: 0, blue: 0 };
  const tick = (input: Partial<Record<Id, Partial<PlayerInput>>> = {}): void => {
    for (const id of ['red', 'blue'] as const) {
      match.receiveInput(id, [
        {
          seq: ++seq[id],
          dt: 0.05,
          moveX: 0,
          moveY: 0,
          yaw: 0,
          pitch: 0,
          run: false,
          interact: false,
          item: 'lamp',
          refuel: false,
          space: match.world.spaceIndex,
          floor: player(id).floor,
          ...input[id],
        },
      ]);
    }
    now += 50;
    match.step();
  };
  return { match, player, tick, stair: match.world.space.stairs[0]! };
};

describe('Этажи на сервере', () => {
  it('E у лестницы — подъём на следующий этаж и обратно', () => {
    const ctx = setup();
    ctx.player('red').position = ctx.stair.position.add(new Vector2(0.3, 0));
    ctx.tick({ red: { interact: true } });
    expect(ctx.player('red').floor).toBe(1);
    expect(ctx.player('red').position).toEqual(ctx.stair.position);
    ctx.tick();
    ctx.tick({ red: { interact: true } });
    expect(ctx.player('red').floor).toBe(0);
  });

  it('вдали от лестницы E этаж не меняет', () => {
    const ctx = setup();
    ctx.player('red').position = ctx.stair.position.add(new Vector2(StairSystem.REACH + 0.5, 0));
    ctx.tick({ red: { interact: true } });
    expect(ctx.player('red').floor).toBe(0);
  });

  it('команды, сформированные на другом этаже, не двигают игрока', () => {
    const ctx = setup();
    const start = ctx.player('red').position;
    ctx.tick({ red: { moveY: 1, floor: 1 } });
    expect(ctx.player('red').position).toEqual(start);
    expect(ctx.player('red').lastSeq).toBeGreaterThan(0);
  });

  it('в снимке — этаж игрока', () => {
    const ctx = setup();
    ctx.player('blue').floor = 1;
    ctx.tick();
    const inbox = (ctx.player('red').participant as FakeParticipant).inbox;
    const last = inbox.filter((m) => m.type === 'match:snapshot').at(-1);
    if (last?.type !== 'match:snapshot') throw new Error('нет снимка');
    expect(last.snapshot.players.find((p) => p.id === 'blue')!.floor).toBe(1);
  });

  it('привидение на другом этаже не ловит и стоит на месте', () => {
    const ctx = setup();
    ctx.player('red').item = 'compass';
    const population = ctx.match.world.ghostPopulation;
    const at = ctx.player('red').position.add(new Vector2(0.3, 0));
    const ghost = population.add(at, 1);
    for (let i = 0; i < 40; i++) ctx.tick({ red: { item: 'compass' }, blue: { item: 'compass' } });
    expect(ctx.match.world.over).toBeNull();
    expect(ghost.position).toEqual(at);
  });

  it('лампу не передать с этажа на этаж', () => {
    const ctx = setup();
    ctx.player('red').position = new Vector2(5, 5);
    ctx.player('blue').position = new Vector2(6, 5);
    ctx.player('blue').floor = 1;
    ctx.tick({
      red: { interact: true, yaw: Math.PI / 2 },
      blue: { interact: true, yaw: -Math.PI / 2 },
    });
    expect(ctx.match.world.exchange.count).toBe(0);
  });
});
