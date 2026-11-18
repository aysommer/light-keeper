import { describe, expect, it } from 'vitest';
import { AABB, DisjointSet, OccupancyGrid, Vector2 } from '../src/index.ts';

describe('Vector2', () => {
  it('арифметика', () => {
    const v = new Vector2(3, 4);
    expect(v.length()).toBe(5);
    expect(v.add(new Vector2(1, 1))).toEqual(new Vector2(4, 5));
    expect(v.sub(new Vector2(3, 4))).toEqual(Vector2.ZERO);
    expect(v.normalize().equals(new Vector2(0.6, 0.8))).toBe(true);
    expect(Vector2.ZERO.normalize()).toEqual(Vector2.ZERO);
  });
});

describe('AABB', () => {
  const box = new AABB(0, 0, 2, 2);

  it('размеры и центр', () => {
    expect(box.width).toBe(2);
    expect(box.center).toEqual(new Vector2(1, 1));
    expect(AABB.fromCenter(new Vector2(1, 1), 2, 2)).toEqual(box);
  });

  it('пересечения', () => {
    expect(box.intersects(new AABB(1, 1, 3, 3))).toBe(true);
    expect(box.intersects(new AABB(2, 0, 3, 2))).toBe(false); // касание
    expect(box.intersectsCircle(new Vector2(2.2, 1), 0.3)).toBe(true);
    expect(box.intersectsCircle(new Vector2(2.5, 1), 0.3)).toBe(false);
  });

  it('отклоняет перевёрнутый прямоугольник', () => {
    expect(() => new AABB(1, 0, 0, 1)).toThrow();
  });
});

describe('DisjointSet', () => {
  it('объединяет множества', () => {
    const set = new DisjointSet(4);
    expect(set.union(0, 1)).toBe(true);
    expect(set.union(1, 0)).toBe(false);
    expect(set.connected(0, 1)).toBe(true);
    expect(set.connected(0, 2)).toBe(false);
  });
});

describe('OccupancyGrid', () => {
  it('стена с проёмом пропускает, сплошная — нет', () => {
    const bounds = new AABB(0, 0, 10, 10);
    const from = new Vector2(1, 1);
    const to = new Vector2(1, 9);

    const solid = new OccupancyGrid(bounds, 0.1);
    solid.block(new AABB(0, 4.9, 10, 5.1));
    expect(solid.canReach(from, to)).toBe(false);

    const withGap = new OccupancyGrid(bounds, 0.1);
    withGap.block(new AABB(0, 4.9, 4, 5.1));
    withGap.block(new AABB(6, 4.9, 10, 5.1));
    expect(withGap.canReach(from, to)).toBe(true);

    // Агент шире проёма не пройдёт.
    const narrow = new OccupancyGrid(bounds, 0.1);
    narrow.block(new AABB(0, 4.9, 4, 5.1), 1.1);
    narrow.block(new AABB(6, 4.9, 10, 5.1), 1.1);
    expect(narrow.canReach(from, to)).toBe(false);
  });
});
