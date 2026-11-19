import { describe, expect, it } from 'vitest';
import { GameConfig, OccupancyGrid, RoomGraph, SpaceGenerator } from '../src/index.ts';
import type { Space } from '../src/index.ts';

const SEEDS = Array.from({ length: 40 }, (_, i) => 500 + i * 104729);

const reachable = (space: Space) => {
  const grid = new OccupancyGrid(space.bounds.expand(1), 0.1);
  space.colliders.forEach((collider) => grid.block(collider, GameConfig.player.radius));
  return grid.reachableFrom(space.startPositions[0]);
};

describe('ExitPlanner: тип двери', () => {
  it('в первом пространстве дверь всегда обычная', () => {
    for (const seed of SEEDS) {
      expect(new SpaceGenerator(seed).generate(0).exit.kind).toBe('plain');
    }
  });

  it('дальше встречаются все три типа примерно поровну', () => {
    const counts = { plain: 0, hidden: 0, locked: 0 };
    for (const seed of SEEDS) {
      for (let index = 1; index <= 6; index++) {
        counts[new SpaceGenerator(seed).generate(index).exit.kind] += 1;
      }
    }
    const total = SEEDS.length * 6;
    for (const count of Object.values(counts)) {
      expect(count / total).toBeGreaterThan(0.2);
      expect(count / total).toBeLessThan(0.47);
    }
  });

  it('ключ есть только у запертой двери', () => {
    for (const seed of SEEDS) {
      for (let index = 0; index <= 4; index++) {
        const space = new SpaceGenerator(seed).generate(index);
        expect(space.key !== null).toBe(space.exit.kind === 'locked');
      }
    }
  });
});

describe('ExitPlanner: размещение двери', () => {
  it('дверь висит на сплошной стене своей комнаты, не в стартовой комнате', () => {
    for (const seed of SEEDS) {
      const space = new SpaceGenerator(seed).generate(3);
      const { exit } = space;
      expect(exit.roomId).not.toBe(space.startRoom.id);
      expect(space.doors.some((door) => door.edge.key === exit.edge.key)).toBe(false);
      // На осевой линии двери — стена.
      expect(space.walls.some((wall) => wall.bounds.containsPoint(exit.position))).toBe(true);
      // Перед дверью — её комната.
      expect(space.roomAt(exit.frontPoint())?.id).toBe(exit.roomId);
    }
  });

  it('к двери можно подойти вплотную', () => {
    for (const seed of SEEDS) {
      const space = new SpaceGenerator(seed).generate(2);
      const front = space.exit.frontPoint(GameConfig.world.wallThickness / 2 + 0.35);
      expect(reachable(space).contains(front), `seed ${seed}`).toBe(true);
    }
  });

  it('дверь далеко: её комната среди самой дальней трети', () => {
    for (const seed of SEEDS) {
      const space = new SpaceGenerator(seed).generate(4);
      const graph = new RoomGraph(space.rooms, space.doors);
      const distances = [...graph.distancesFrom(space.startRoom.id).values()].sort((a, b) => b - a);
      const exitDistance = graph.distancesFrom(space.startRoom.id).get(space.exit.roomId)!;
      const threshold = distances[Math.ceil(distances.length * 0.5) - 1]!;
      expect(exitDistance).toBeGreaterThanOrEqual(threshold);
    }
  });

  it('детерминизм: та же дверь и тот же ключ при том же seed', () => {
    const a = new SpaceGenerator(9).generate(5);
    const b = new SpaceGenerator(9).generate(5);
    expect(a.exit).toEqual(b.exit);
    expect(a.key).toEqual(b.key);
  });
});

describe('ExitPlanner: ключ', () => {
  const lockedSpaces = (): Space[] =>
    SEEDS.flatMap((seed) =>
      Array.from({ length: 8 }, (_, i) => new SpaceGenerator(seed).generate(i + 1)),
    ).filter((space) => space.exit.kind === 'locked');

  it('ключ достижим и лежит не в стартовой комнате и не в комнате двери', () => {
    const spaces = lockedSpaces();
    expect(spaces.length).toBeGreaterThan(20);
    for (const space of spaces) {
      const keyRoom = space.roomAt(space.key!)!;
      expect(keyRoom.id).not.toBe(space.startRoom.id);
      expect(keyRoom.id).not.toBe(space.exit.roomId);
      expect(reachable(space).contains(space.key!)).toBe(true);
    }
  });

  it('ключ не на кратчайшем пути к двери (если в лабиринте есть ответвления)', () => {
    for (const space of lockedSpaces()) {
      const graph = new RoomGraph(space.rooms, space.doors);
      const path = graph.path(space.startRoom.id, space.exit.roomId);
      const offPathExists = space.rooms.some((room) => !path.includes(room.id));
      if (offPathExists) {
        expect(path).not.toContain(space.roomAt(space.key!)!.id);
      }
    }
  });
});

describe('RoomGraph', () => {
  it('путь начинается со старта и заканчивается целью', () => {
    const space = new SpaceGenerator(3).generate(2);
    const graph = new RoomGraph(space.rooms, space.doors);
    const path = graph.path(space.startRoom.id, space.exit.roomId);
    expect(path[0]).toBe(space.startRoom.id);
    expect(path.at(-1)).toBe(space.exit.roomId);
    expect(path.length - 1).toBe(graph.distancesFrom(space.startRoom.id).get(space.exit.roomId));
  });
});
