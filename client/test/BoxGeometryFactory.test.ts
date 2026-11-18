import { describe, expect, it } from 'vitest';
import { Vector3 } from 'three';
import { AABB, Vector2 } from '@light-keeper/shared';
import { BoxGeometryFactory } from '../src/scene/BoxGeometryFactory.ts';
import { SceneCoords } from '../src/scene/SceneCoords.ts';

describe('SceneCoords', () => {
  it('ось y мира смотрит в −Z сцены', () => {
    expect(SceneCoords.toScene(new Vector2(3, 5), 1.6)).toEqual(new Vector3(3, 1.6, -5));
  });
});

describe('BoxGeometryFactory', () => {
  const factory = new BoxGeometryFactory(1);
  const geometry = factory.create(new AABB(0, 10, 4, 10.2), 0, 3);

  it('ставит коробку на место прямоугольника мира', () => {
    geometry.computeBoundingBox();
    const box = geometry.boundingBox!;
    expect(box.min.x).toBeCloseTo(0);
    expect(box.max.x).toBeCloseTo(4);
    expect(box.min.y).toBeCloseTo(0);
    expect(box.max.y).toBeCloseTo(3);
    expect(box.min.z).toBeCloseTo(-10.2);
    expect(box.max.z).toBeCloseTo(-10);
  });

  it('масштабирует UV в метрах: на грани 4×3 м помещается 4×3 плитки', () => {
    const uv = geometry.getAttribute('uv');
    // Грань +z — вершины 16..19.
    const us = [16, 17, 18, 19].map((i) => uv.getX(i));
    const vs = [16, 17, 18, 19].map((i) => uv.getY(i));
    expect(Math.max(...us) - Math.min(...us)).toBeCloseTo(4);
    expect(Math.max(...vs) - Math.min(...vs)).toBeCloseTo(3);
  });
});
