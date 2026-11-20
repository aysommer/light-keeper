import { describe, expect, it } from 'vitest';
import { GameConfig, Vector2 } from '@light-keeper/shared';
import type { HeldItem, PlayerInput, ServerMessage, ServerMessageOf } from '@light-keeper/shared';
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

type Id = 'red' | 'blue';
const settings = GameConfig.ghosts;

const setup = () => {
  let now = 0;
  const red = new FakeParticipant('red');
  const blue = new FakeParticipant('blue');
  const match = new Match(
    4242,
    [
      { participant: red, color: 'red' },
      { participant: blue, color: 'blue' },
    ],
    { tickRate: 20, now: () => now },
  );
  const items: Record<Id, HeldItem> = { red: 'lamp', blue: 'lamp' };
  const seq = { red: 0, blue: 0 };
  const player = (id: Id) => match.world.players.get(id)!;
  const population = () => match.world.ghostPopulation;
  const tick = (): void => {
    for (const id of ['red', 'blue'] as const) {
      const command: PlayerInput = {
        seq: ++seq[id],
        dt: 0.05,
        moveX: 0,
        moveY: 0,
        yaw: 0,
        pitch: 0,
        run: false,
        interact: false,
        item: items[id],
        refuel: false,
        space: match.world.spaceIndex,
      };
      match.receiveInput(id, [command]);
    }
    now += 50;
    match.step();
  };
  const run = (seconds: number): void => {
    for (let i = 0; i < Math.round(seconds * 20); i++) tick();
  };
  /** Обоим убрать лампы — полная темнота. */
  const darkness = (): void => {
    items.red = 'compass';
    items.blue = 'compass';
  };
  /** Поставить привидение в `steps` метрах от игрока по прямой (без стен между ними). */
  const ghostNear = (id: Id, meters: number) => {
    const start = player(id).position;
    for (const direction of [
      new Vector2(1, 0),
      new Vector2(-1, 0),
      new Vector2(0, 1),
      new Vector2(0, -1),
    ]) {
      const at = start.add(direction.scale(meters));
      if (
        match.world.collisions.lineOfSight(start, at) &&
        match.world.space.bounds.containsPoint(at)
      ) {
        return population().add(at);
      }
    }
    throw new Error('нет места для привидения');
  };
  return { match, red, blue, items, player, population, tick, run, darkness, ghostNear };
};

describe('GhostSystem: появление', () => {
  it('до первой задержки привидений нет, потом приходит одно — далеко от игроков', () => {
    const ctx = setup();
    ctx.run(settings.firstDelaySeconds - 1);
    expect(ctx.population().ghosts).toHaveLength(0);
    ctx.run(1.5);
    const [ghost] = ctx.population().ghosts;
    expect(ghost).toBeDefined();
    for (const id of ['red', 'blue'] as const) {
      expect(ghost!.position.distanceTo(ctx.player(id).position)).toBeGreaterThan(
        settings.spawnMinDistance * 0.6,
      );
    }
    expect(ctx.red.last('match:snapshot')!.snapshot.ghosts).toHaveLength(1);
  });

  it('одновременно не больше предела для пространства', () => {
    const ctx = setup();
    // Свет держит привидения на расстоянии, но не мешает им приходить.
    ctx.run(settings.firstDelaySeconds + settings.intervalSeconds * 2 + 1);
    const active = ctx.population().ghosts.filter((g) => !g.fading);
    expect(active.length).toBeLessThanOrEqual(ctx.population().rules.maxConcurrent(0));
  });
});

describe('GhostSystem: темнота и свет', () => {
  it('в темноте привидение подходит и настигает игрока — конец игры', () => {
    const ctx = setup();
    ctx.darkness();
    ctx.ghostNear('red', 3);
    ctx.run(5);
    expect(ctx.red.last('match:over')).toMatchObject({ reason: 'ghost_caught' });
    expect(ctx.blue.last('match:over')).toMatchObject({ reason: 'ghost_caught' });
  });

  it('свет лампы отгоняет привидение, и через несколько секунд оно растворяется', () => {
    const ctx = setup();
    const ghost = ctx.ghostNear('red', 3);
    ctx.run(1);
    expect(ghost.position.distanceTo(ctx.player('red').position)).toBeGreaterThan(3);
    ctx.run(settings.dissolveSeconds + settings.fadeSeconds + 1);
    expect(ctx.population().ghosts).not.toContain(ghost);
    expect(ctx.red.last('match:over')).toBeUndefined();
  });

  it('перегретая лампа не защищает', () => {
    const ctx = setup();
    ctx.items.blue = 'compass';
    ctx.player('red').lamp.overheated = true;
    ctx.player('red').lamp.heat = 100;
    ctx.ghostNear('red', 2.5);
    ctx.run(4);
    expect(ctx.red.last('match:over')).toMatchObject({ reason: 'ghost_caught' });
  });

  it('растворяющееся привидение уже не опасно', () => {
    const ctx = setup();
    ctx.darkness();
    const ghost = ctx.ghostNear('red', 0.5);
    ghost.fadeLeft = 5;
    ctx.run(1);
    expect(ctx.red.last('match:over')).toBeUndefined();
    expect(ctx.red.last('match:snapshot')!.snapshot.ghosts[0]).toMatchObject({ fading: true });
  });
});

describe('GhostSystem: тамбур и новое пространство', () => {
  it('игроков в тамбуре привидения не трогают', () => {
    const ctx = setup();
    ctx.darkness();
    const ghost = ctx.ghostNear('red', 0.5);
    ctx.player('red').inTambour = true;
    ctx.player('blue').inTambour = true;
    const before = ghost.position;
    ctx.run(2);
    expect(ghost.position).toEqual(before);
    expect(ctx.red.last('match:over')).toBeUndefined();
  });

  it('в новое пространство привидения не переходят, расписание начинается заново', () => {
    const ctx = setup();
    ctx.ghostNear('red', 5);
    ctx.match.world.enterSpace(1);
    ctx.tick();
    expect(ctx.population().ghosts).toHaveLength(0);
    expect(ctx.population().nextSpawnIn).toBeGreaterThan(settings.minIntervalSeconds - 1);
  });
});
