import { describe, expect, it } from 'vitest';
import {
  AABB,
  GameConfig,
  HslColor,
  OccupancyGrid,
  PlayerMovement,
  RoomLayoutPlanner,
  SeededRandom,
  SpaceGenerator,
  SpacePalette,
  Vector2,
} from '../src/index.ts';
import type { Space } from '../src/index.ts';

const SEEDS = Array.from({ length: 30 }, (_, i) => 1000 + i * 7919);
const settings = GameConfig.world;

/** Карта проходимости пространства для игрока. */
const buildOccupancy = (space: Space): OccupancyGrid => {
  const grid = new OccupancyGrid(space.bounds.expand(1), 0.1);
  space.colliders.forEach((collider) => grid.block(collider, GameConfig.player.radius));
  return grid;
};

describe('RoomLayoutPlanner', () => {
  it('покрывает каждую клетку ровно одной комнатой при любом размере', () => {
    for (const size of [6, 9, 12]) {
      const planner = new RoomLayoutPlanner(size, size);
      for (const seed of SEEDS.slice(0, 10)) {
        const layout = planner.plan(new SeededRandom(seed));
        const covered = new Array<number>(size * size).fill(0);
        for (const rect of layout.rects) {
          for (let r = rect.row; r < rect.row + rect.height; r++) {
            for (let c = rect.col; c < rect.col + rect.width; c++) {
              covered[r * size + c]! += 1;
            }
          }
        }
        expect(covered.every((count) => count === 1)).toBe(true);
      }
    }
  });
});

describe('SpaceGenerator: размер и детерминизм', () => {
  it('размер растёт каждые 2 пространства и ограничен сверху', () => {
    const generator = new SpaceGenerator(1);
    expect([0, 1, 2, 3, 4, 10, 12, 50].map((i) => generator.sizeFor(i))).toEqual([
      6, 6, 7, 7, 8, 11, 12, 12,
    ]);
    const space = generator.generate(4);
    expect(space.grid.columns).toBe(8);
    expect(space.bounds.width).toBe(8 * settings.cellSize);
  });

  it('одинаковые seed и номер дают одинаковое пространство', () => {
    expect(new SpaceGenerator(123).generate(3)).toEqual(new SpaceGenerator(123).generate(3));
  });

  it('разные номера и разные seed партии дают разные пространства', () => {
    const generator = new SpaceGenerator(5);
    expect(generator.generate(0)).not.toEqual(generator.generate(1));
    expect(generator.generate(0)).not.toEqual(new SpaceGenerator(6).generate(0));
  });

  it('отклоняет некорректный номер', () => {
    expect(() => new SpaceGenerator(1).generate(-1)).toThrow();
    expect(() => new SpaceGenerator(1).generate(0.5)).toThrow();
  });
});

describe('SpaceGenerator: структура', () => {
  it('встречаются все типы комнат', () => {
    const kinds = new Set<string>();
    for (const seed of SEEDS) {
      new SpaceGenerator(seed).generate(0).rooms.forEach((room) => kinds.add(room.kind));
    }
    expect([...kinds].sort()).toEqual(['corridor', 'hall', 'office']);
  });

  it('внешний контур замкнут: стены по всем четырём сторонам без проёмов', () => {
    for (const seed of SEEDS) {
      const space = new SpaceGenerator(seed).generate(0);
      const { width, length } = space.grid;
      const covers = (axis: 'x' | 'y', line: number, from: number, to: number): boolean => {
        const step = 0.25;
        for (let t = from + step / 2; t < to; t += step) {
          const point = axis === 'x' ? new Vector2(t, line) : new Vector2(line, t);
          if (!space.walls.some((wall) => wall.bounds.containsPoint(point))) return false;
        }
        return true;
      };
      expect(covers('x', 0, 0, width)).toBe(true);
      expect(covers('x', length, 0, width)).toBe(true);
      expect(covers('y', 0, 0, length)).toBe(true);
      expect(covers('y', width, 0, length)).toBe(true);
    }
  });

  it('стены и препятствия не перекрывают дверные проёмы', () => {
    const halfWall = settings.wallThickness / 2;
    for (const seed of SEEDS) {
      const space = new SpaceGenerator(seed).generate(2);
      for (const door of space.doors) {
        const horizontal = door.edge.orientation === 'horizontal';
        const gap = AABB.fromCenter(
          door.position,
          horizontal ? door.width - 0.01 : 2 * halfWall,
          horizontal ? 2 * halfWall : door.width - 0.01,
        );
        expect(space.colliders.some((collider) => collider.intersects(gap))).toBe(false);
      }
    }
  });

  it('стартовая комната пуста, точки старта свободны и лежат в ней', () => {
    for (const seed of SEEDS) {
      const space = new SpaceGenerator(seed).generate(1);
      expect(space.startRoom.obstacles).toHaveLength(0);
      const grid = buildOccupancy(space);
      for (const position of space.startPositions) {
        expect(grid.isBlocked(position)).toBe(false);
        expect(space.roomAt(position)).toBe(space.startRoom);
      }
    }
  });
});

describe('SpaceGenerator: направление старта', () => {
  it('игрок на старте смотрит на дверь своей комнаты', () => {
    for (const seed of SEEDS) {
      const space = new SpaceGenerator(seed).generate(2);
      const forward = PlayerMovement.forward(space.startYaw);
      const center = space.startPositions[0].add(space.startPositions[1]).scale(0.5);
      const exits = space.doors.filter(
        (door) => door.roomA === space.startRoom.id || door.roomB === space.startRoom.id,
      );
      const looksAtExit = exits.some((door) => {
        const toDoor = door.position.sub(center).normalize();
        return forward.x * toDoor.x + forward.y * toDoor.y > 0.999;
      });
      expect(looksAtExit, `seed ${seed}`).toBe(true);
    }
  });
});

describe('SpaceGenerator: связность', () => {
  it.each(SEEDS)('seed %i: каждая клетка, дверь и канистра достижимы со старта', (seed) => {
    const generator = new SpaceGenerator(seed);
    for (const index of [0, 5]) {
      const space = generator.generate(index);
      const reachable = buildOccupancy(space).reachableFrom(space.startPositions[0]);
      for (let row = 0; row < space.grid.rows; row++) {
        for (let col = 0; col < space.grid.columns; col++) {
          expect(reachable.contains(space.grid.cellCenter(col, row)), `клетка ${col},${row}`).toBe(
            true,
          );
        }
      }
      space.doors.forEach((door) =>
        expect(reachable.contains(door.position), `дверь ${door.edge.key}`).toBe(true),
      );
      space.oilSpawns.forEach((oil) =>
        expect(reachable.contains(oil), `канистра ${oil}`).toBe(true),
      );
    }
  });

  it('из пространства нельзя выйти', () => {
    for (const seed of SEEDS.slice(0, 5)) {
      const space = new SpaceGenerator(seed).generate(0);
      const grid = new OccupancyGrid(space.bounds.expand(3), 0.1);
      space.colliders.forEach((collider) => grid.block(collider, GameConfig.player.radius));
      const reachable = grid.reachableFrom(space.startPositions[0]);
      expect(reachable.contains(new Vector2(-2, -2))).toBe(false);
    }
  });
});

describe('Канистры масла', () => {
  it('в далёких пространствах канистр меньше на комнату', () => {
    const rate = (index: number): number => {
      let oil = 0;
      let rooms = 0;
      for (const seed of SEEDS) {
        const space = new SpaceGenerator(seed).generate(index);
        oil += space.oilSpawns.length;
        rooms += space.rooms.length;
      }
      return oil / rooms;
    };
    expect(rate(15)).toBeLessThan(rate(0));
  });
});

describe('SpacePalette', () => {
  it('детерминирована seed пространства', () => {
    const a = new SpaceGenerator(7).generate(2).palette;
    const b = new SpaceGenerator(7).generate(2).palette;
    expect(a).toEqual(b);
  });

  it('обои приглушённые, пол темнее стен, потолок светлый', () => {
    for (const seed of SEEDS) {
      const palette = SpacePalette.generate(new SeededRandom(seed));
      expect(palette.wall.saturation).toBeLessThanOrEqual(SpacePalette.MAX_WALL_SATURATION);
      expect(palette.floor.lightness).toBeLessThan(palette.wall.lightness);
      expect(palette.ceiling.lightness).toBeGreaterThan(palette.wall.lightness);
    }
  });

  it('встречаются все узоры и разные оттенки', () => {
    const patterns = new Set<string>();
    const hues = new Set<number>();
    for (let seed = 0; seed < 200; seed++) {
      const palette = SpacePalette.generate(new SeededRandom(seed));
      patterns.add(palette.pattern);
      hues.add(Math.floor(palette.wall.hue / 60));
    }
    expect([...patterns].sort()).toEqual([...SpacePalette.PATTERNS].sort());
    expect(hues.size).toBe(6);
  });
});

describe('HslColor', () => {
  it('переводит в hex', () => {
    expect(new HslColor(0, 1, 0.5).toHex()).toBe('#ff0000');
    expect(new HslColor(120, 1, 0.25).toHex()).toBe('#008000');
    expect(new HslColor(0, 0, 1).toHex()).toBe('#ffffff');
    expect(new HslColor(-120, 1, 0.5).toHex()).toBe('#0000ff');
  });
});
