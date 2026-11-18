import { describe, expect, it } from 'vitest';
import {
  AABB,
  ChunkGenerator,
  CollisionResolver,
  CollisionWorld,
  GameConfig,
  SeededRandom,
  Vector2,
  WorldLayout,
} from '../src/index.ts';

const resolver = new CollisionResolver();
const radius = 0.3;
const wall = new AABB(-5, 1.9, 5, 2.1);

describe('CollisionResolver', () => {
  it('свободное движение не меняется', () => {
    const result = resolver.move(Vector2.ZERO, new Vector2(1, 1), radius, []);
    expect(result.equals(new Vector2(1, 1))).toBe(true);
  });

  it('упирается в стену', () => {
    const result = resolver.move(Vector2.ZERO, new Vector2(0, 5), radius, [wall]);
    expect(result.y).toBeCloseTo(1.9 - radius, 5);
  });

  it('скользит вдоль стены', () => {
    const result = resolver.move(new Vector2(0, 1.5), new Vector2(2, 2), radius, [wall]);
    expect(result.x).toBeCloseTo(2, 5);
    expect(result.y).toBeCloseTo(1.9 - radius, 5);
  });

  it('не проскакивает тонкую стену на большой скорости', () => {
    const result = resolver.move(Vector2.ZERO, new Vector2(0, 50), radius, [wall]);
    expect(result.y).toBeLessThan(1.9);
  });

  it('выталкивает центр, оказавшийся внутри коробки', () => {
    const box = new AABB(0, 0, 2, 1);
    const result = resolver.resolve(new Vector2(1, 0.9), radius, [box]);
    expect(box.intersectsCircle(result, radius - 1e-6)).toBe(false);
    expect(result.y).toBeCloseTo(1 + radius, 5);
  });
});

describe('CollisionWorld', () => {
  it('игрок не оказывается в стенах при случайном блуждании по миру', () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const generator = new ChunkGenerator(seed);
      const world = new CollisionWorld(new WorldLayout(generator));
      const rng = new SeededRandom(seed);
      let position = generator.startPositions()[0];
      let direction = new Vector2(0, 1);
      for (let step = 0; step < 3000; step++) {
        if (rng.chance(0.05)) {
          const angle = rng.float(0, Math.PI * 2);
          direction = new Vector2(Math.cos(angle), Math.sin(angle) + 0.3);
        }
        position = world.move(position, direction.normalize().scale(0.12), radius);
        const near = world.collidersNear(position, 2);
        const stuck = near.some((box) => box.intersectsCircle(position, radius - 1e-3));
        expect(stuck, `seed ${seed}, шаг ${step}, позиция ${position}`).toBe(false);
        expect(position.y).toBeGreaterThan(0);
        expect(position.x).toBeGreaterThan(0);
        expect(position.x).toBeLessThan(generator.worldWidth);
      }
    }
  });

  it('проходит через дверной проём', () => {
    const generator = new ChunkGenerator(10);
    const world = new CollisionWorld(new WorldLayout(generator));
    const exit = generator.generate(0).exitDoor.position;
    const below = new Vector2(exit.x, exit.y - 1);
    const result = world.move(below, new Vector2(0, 2), GameConfig.player.radius);
    expect(result.y).toBeGreaterThan(exit.y + 0.9);
  });
});
