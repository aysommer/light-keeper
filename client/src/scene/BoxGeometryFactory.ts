import { BoxGeometry } from 'three';
import type { BufferGeometry } from 'three';
import type { AABB } from '@light-keeper/shared';
import { SceneCoords } from './SceneCoords.ts';

/**
 * Строит коробки по прямоугольникам мира с UV в метрах,
 * чтобы текстура не растягивалась на длинных стенах.
 */
export class BoxGeometryFactory {
  public constructor(
    /** Сколько метров занимает одна плитка текстуры. */
    private readonly metersPerTile: number,
  ) {}

  public create(bounds: AABB, bottom: number, top: number): BufferGeometry {
    const width = bounds.width;
    const height = top - bottom;
    const depth = bounds.height;
    const geometry = new BoxGeometry(width, height, depth);
    this.scaleFaceUvs(geometry, width, height, depth);
    const center = bounds.center;
    geometry.translate(center.x, bottom + height / 2, SceneCoords.sceneZ(center.y));
    return geometry;
  }

  /** Грани BoxGeometry идут в порядке +x, −x, +y, −y, +z, −z, по 4 вершины. */
  private scaleFaceUvs(geometry: BoxGeometry, width: number, height: number, depth: number): void {
    const uv = geometry.getAttribute('uv');
    const faceSizes: ReadonlyArray<readonly [number, number]> = [
      [depth, height],
      [depth, height],
      [width, depth],
      [width, depth],
      [width, height],
      [width, height],
    ];
    faceSizes.forEach(([u, v], face) => {
      for (let vertex = face * 4; vertex < face * 4 + 4; vertex++) {
        uv.setXY(
          vertex,
          (uv.getX(vertex) * u) / this.metersPerTile,
          (uv.getY(vertex) * v) / this.metersPerTile,
        );
      }
    });
    uv.needsUpdate = true;
  }
}
