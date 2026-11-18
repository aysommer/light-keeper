import { describe, expect, it } from 'vitest';
import {
  AABB,
  ChunkGenerator,
  GameConfig,
  OccupancyGrid,
  RoomLayoutPlanner,
  SeededRandom,
  Vector2,
  WorldLayout,
} from '../src/index.ts';
import type { Chunk } from '../src/index.ts';

const SEEDS = Array.from({ length: 40 }, (_, i) => 1000 + i * 7919);
const CHUNKS_PER_SEED = 6;
const settings = GameConfig.world;

/** Карта проходимости для игрока по чанкам `0..count-1` (стены чанка `count` закрывают верх). */
const buildOccupancy = (generator: ChunkGenerator, count: number): OccupancyGrid => {
  const chunks = Array.from({ length: count + 1 }, (_, i) => generator.generate(i));
  const bounds = new AABB(-1, -1, generator.worldWidth + 1, count * generator.chunkLength + 1);
  const grid = new OccupancyGrid(bounds, 0.1);
  const radius = GameConfig.player.radius;
  for (const chunk of chunks) {
    chunk.walls.forEach((wall) => grid.block(wall.bounds, radius));
    chunk.obstacles.forEach((obstacle) => grid.block(obstacle.bounds, radius));
  }
  return grid;
};

describe('RoomLayoutPlanner', () => {
  it('покрывает каждую клетку ровно одной комнатой', () => {
    const planner = new RoomLayoutPlanner(settings.columns, settings.rowsPerChunk);
    for (const seed of SEEDS) {
      const layout = planner.plan(new SeededRandom(seed));
      const covered = new Array<number>(settings.columns * settings.rowsPerChunk).fill(0);
      for (const rect of layout.rects) {
        expect(rect.col + rect.width).toBeLessThanOrEqual(settings.columns);
        expect(rect.row + rect.height).toBeLessThanOrEqual(settings.rowsPerChunk);
        for (let r = rect.row; r < rect.row + rect.height; r++) {
          for (let c = rect.col; c < rect.col + rect.width; c++) {
            covered[r * settings.columns + c]! += 1;
          }
        }
      }
      expect(covered.every((count) => count === 1)).toBe(true);
    }
  });
});

describe('ChunkGenerator: детерминизм', () => {
  it('одинаковые seed и индекс дают одинаковый чанк', () => {
    const a = new ChunkGenerator(123).generate(4);
    const b = new ChunkGenerator(123).generate(4);
    expect(a).toEqual(b);
  });

  it('разные seed дают разные чанки', () => {
    const a = new ChunkGenerator(1).generate(0);
    const b = new ChunkGenerator(2).generate(0);
    expect(a).not.toEqual(b);
  });

  it('чанк не зависит от порядка генерации', () => {
    const direct = new ChunkGenerator(77).generate(5);
    const sequential = new ChunkGenerator(77);
    let last: Chunk | undefined;
    for (let i = 0; i <= 5; i++) last = sequential.generate(i);
    expect(last).toEqual(direct);
  });

  it('отклоняет отрицательный и дробный индекс', () => {
    const generator = new ChunkGenerator(1);
    expect(() => generator.generate(-1)).toThrow();
    expect(() => generator.generate(1.5)).toThrow();
  });
});

describe('ChunkGenerator: структура', () => {
  it('у нулевого чанка нет входа, у остальных вход совпадает с выходом предыдущего', () => {
    for (const seed of SEEDS) {
      const generator = new ChunkGenerator(seed);
      expect(generator.generate(0).entryDoor).toBeNull();
      for (let i = 1; i < CHUNKS_PER_SEED; i++) {
        const previous = generator.generate(i - 1);
        const current = generator.generate(i);
        expect(current.entryDoor).not.toBeNull();
        expect(current.entryDoor!.position.equals(previous.exitDoor.position)).toBe(true);
      }
    }
  });

  it('чанки лежат друг за другом вдоль оси y', () => {
    const generator = new ChunkGenerator(5);
    const chunk = generator.generate(3);
    expect(chunk.bounds.minY).toBe(3 * generator.chunkLength);
    expect(chunk.bounds.maxY).toBe(4 * generator.chunkLength);
    expect(chunk.bounds.width).toBe(generator.worldWidth);
  });

  it('встречаются все типы комнат', () => {
    const kinds = new Set<string>();
    for (const seed of SEEDS) {
      new ChunkGenerator(seed).generate(0).rooms.forEach((room) => kinds.add(room.kind));
    }
    expect([...kinds].sort()).toEqual(['corridor', 'hall', 'office']);
  });

  it('стены и препятствия не перекрывают дверные проёмы', () => {
    const halfWall = settings.wallThickness / 2;
    for (const seed of SEEDS) {
      const generator = new ChunkGenerator(seed);
      for (let i = 0; i < CHUNKS_PER_SEED; i++) {
        const chunk = generator.generate(i);
        const next = generator.generate(i + 1);
        const colliders = [...chunk.walls, ...next.walls, ...chunk.obstacles].map((c) => c.bounds);
        for (const door of chunk.doors) {
          const horizontal = door.edge.orientation === 'horizontal';
          const gap = AABB.fromCenter(
            door.position,
            horizontal ? door.width - 0.01 : 2 * halfWall,
            horizontal ? 2 * halfWall : door.width - 0.01,
          );
          expect(colliders.some((collider) => collider.intersects(gap))).toBe(false);
        }
      }
    }
  });
});

describe('ChunkGenerator: связность', () => {
  it.each(SEEDS)('seed %i: всё достижимо со старта', (seed) => {
    const generator = new ChunkGenerator(seed);
    const grid = buildOccupancy(generator, CHUNKS_PER_SEED);
    const [start] = generator.startPositions();
    const reachable = grid.reachableFrom(start);

    for (let i = 0; i < CHUNKS_PER_SEED; i++) {
      const chunk = generator.generate(i);
      for (const room of chunk.rooms) {
        for (let r = room.cells.row; r < room.cells.row + room.cells.height; r++) {
          for (let c = room.cells.col; c < room.cells.col + room.cells.width; c++) {
            const center = new Vector2(
              (c + 0.5) * settings.cellSize,
              chunk.bounds.minY + (r + 0.5) * settings.cellSize,
            );
            expect(reachable.contains(center), `клетка ${c},${r} комнаты ${room.id}`).toBe(true);
          }
        }
      }
      for (const door of chunk.doors) {
        if (door.position.y < CHUNKS_PER_SEED * generator.chunkLength) {
          expect(reachable.contains(door.position), `дверь ${door.edge.key} чанка ${i}`).toBe(true);
        }
      }
      for (const oil of chunk.oilSpawns) {
        expect(reachable.contains(oil), `канистра ${oil} чанка ${i}`).toBe(true);
      }
    }
  });

  it('стартовые позиции свободны', () => {
    for (const seed of SEEDS) {
      const generator = new ChunkGenerator(seed);
      const grid = buildOccupancy(generator, 1);
      for (const position of generator.startPositions()) {
        expect(grid.isBlocked(position)).toBe(false);
      }
    }
  });
});

describe('Канистры масла', () => {
  it('с глубиной канистр становится меньше', () => {
    const countOil = (from: number, to: number): number => {
      let total = 0;
      for (const seed of SEEDS) {
        const generator = new ChunkGenerator(seed);
        for (let i = from; i < to; i++) total += generator.generate(i).oilSpawns.length;
      }
      return total;
    };
    expect(countOil(60, 65)).toBeLessThan(countOil(0, 5));
  });
});

describe('WorldLayout', () => {
  it('находит чанк по координате и кеширует его', () => {
    const generator = new ChunkGenerator(9);
    const world = new WorldLayout(generator, 3);
    const y = generator.chunkLength * 2.5;
    expect(world.chunkIndexAt(y)).toBe(2);
    expect(world.chunkIndexAt(-5)).toBe(0);
    expect(world.getChunk(2)).toBe(world.getChunk(2));
  });

  it('вытесняет старые чанки сверх лимита', () => {
    const world = new WorldLayout(new ChunkGenerator(9), 2);
    const first = world.getChunk(0);
    world.getChunk(1);
    world.getChunk(2);
    expect(world.getChunk(0)).not.toBe(first);
    expect(world.getChunk(0)).toEqual(first);
  });

  it('getChunksBetween() возвращает чанки по порядку', () => {
    const generator = new ChunkGenerator(9);
    const world = new WorldLayout(generator);
    const chunks = world.getChunksBetween(generator.chunkLength * 3.2, generator.chunkLength * 1.1);
    expect(chunks.map((chunk) => chunk.index)).toEqual([1, 2, 3]);
  });
});
