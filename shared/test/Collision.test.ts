import { describe, expect, it } from 'vitest';
import {
  AABB,
  CollisionResolver,
  CollisionWorld,
  GameConfig,
  SeededRandom,
  SpaceGenerator,
  Vector2,
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
  it('находит только ближайшие коллайдеры', () => {
    const near = new AABB(1, 1, 2, 2);
    const far = new AABB(40, 40, 41, 41);
    const world = new CollisionWorld([near, far]);
    expect(world.collidersNear(new Vector2(0, 0), 3)).toEqual([near]);
  });

  it('длинная стена находится из любой своей корзины и без повторов', () => {
    const wall = new AABB(0, 10, 40, 10.2);
    const world = new CollisionWorld([wall]);
    expect(world.collidersNear(new Vector2(35, 9), 2)).toEqual([wall]);
    expect(world.collidersNear(new Vector2(20, 9), 30)).toEqual([wall]);
  });

  it('игрок не оказывается в стенах и не выходит за пределы при случайном блуждании', () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const space = new SpaceGenerator(seed).generate(seed);
      const world = CollisionWorld.fromSpace(space);
      const rng = new SeededRandom(seed);
      let position = space.startPositions[0];
      let direction = new Vector2(0, 1);
      for (let step = 0; step < 3000; step++) {
        if (rng.chance(0.05)) {
          const angle = rng.float(0, Math.PI * 2);
          direction = new Vector2(Math.cos(angle), Math.sin(angle));
        }
        position = world.move(position, direction.scale(0.12), radius);
        const near = world.collidersNear(position, 2);
        const stuck = near.some((box) => box.intersectsCircle(position, radius - 1e-3));
        expect(stuck, `seed ${seed}, шаг ${step}, позиция ${position}`).toBe(false);
        expect(space.bounds.containsPoint(position)).toBe(true);
      }
    }
  });

  it('проходит через дверной проём', () => {
    const space = new SpaceGenerator(10).generate(0);
    const world = CollisionWorld.fromSpace(space);
    const door = space.doors.find((d) => d.edge.orientation === 'horizontal')!;
    const below = new Vector2(door.position.x, door.position.y - 1);
    const result = world.move(below, new Vector2(0, 2), GameConfig.player.radius);
    expect(result.y).toBeGreaterThan(door.position.y + 0.9);
  });
});
