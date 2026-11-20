import { describe, expect, it } from 'vitest';
import { GameConfig, GhostRules, NavigationField, SpaceGenerator, Vector2 } from '../src/index.ts';

const rules = new GhostRules();
const settings = GameConfig.ghosts;

describe('GhostRules', () => {
  it('с каждым пространством привидения приходят чаще, но не чаще минимума', () => {
    expect(rules.firstDelay(0)).toBe(settings.firstDelaySeconds);
    expect(rules.interval(3)).toBeLessThan(rules.interval(0));
    expect(rules.interval(100)).toBe(settings.minIntervalSeconds);
  });

  it('одновременно их больше в дальних пространствах, с пределом', () => {
    expect(rules.maxConcurrent(0)).toBe(1);
    expect(rules.maxConcurrent(2)).toBe(2);
    expect(rules.maxConcurrent(50)).toBe(settings.maxConcurrentCap);
  });

  it('в первых пространствах привидение медленнее шага, потом быстрее, с пределом', () => {
    expect(rules.speed(0)).toBeLessThan(GameConfig.player.walkSpeed);
    expect(rules.speed(10)).toBeGreaterThan(rules.speed(0));
    expect(rules.speed(100)).toBe(settings.maxSpeed);
  });

  it('радиус света зависит от яркости и сжимается в дальних пространствах', () => {
    expect(rules.lightRadius(0, 0)).toBe(0);
    expect(rules.lightRadius(1, 0)).toBeCloseTo(5.5);
    expect(rules.lightRadius(0.3, 0)).toBeLessThan(rules.lightRadius(1, 0));
    expect(rules.lightRadius(1, 5)).toBeLessThan(rules.lightRadius(1, 0));
    expect(rules.lightRadius(1, 100)).toBeCloseTo(5.5 * settings.minLightFactor);
  });
});

describe('NavigationField', () => {
  const space = new SpaceGenerator(2024).generate(2);
  const target = space.startPositions[0];
  const field = new NavigationField(space, settings.radius);
  field.computeFrom([target]);

  it('из любой части лабиринта путь по полю приводит к цели, не проходя сквозь стены', () => {
    const far = field.farthestCell()!;
    let position = far;
    for (let i = 0; i < 4000 && position.distanceTo(target) > 0.5; i++) {
      position = field.step(position, 0.1);
      const stuck = space.colliders.some((c) =>
        c.intersectsCircle(position, settings.radius - 0.15),
      );
      expect(stuck).toBe(false);
    }
    expect(position.distanceTo(target)).toBeLessThan(0.6);
  });

  it('прочь от цели расстояние по полю растёт', () => {
    let position = target.add(new Vector2(0.5, 0));
    const start = field.stepsAt(position);
    for (let i = 0; i < 40; i++) position = field.step(position, 0.1, true);
    expect(field.stepsAt(position)).toBeGreaterThan(start);
  });

  it('клетки дальше заданного расстояния — действительно далеко', () => {
    const cells = field.cellsFartherThan(24);
    expect(cells.length).toBeGreaterThan(0);
    for (const cell of cells.slice(0, 50)) {
      expect(cell.distanceTo(target)).toBeGreaterThan(24 * field.resolution * 0.7);
    }
  });
});
