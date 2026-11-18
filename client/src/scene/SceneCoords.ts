import { Vector3 } from 'three';
import type { Vector2 } from '@light-keeper/shared';

/**
 * Перевод координат мира (2D, метры) в координаты сцены Three.js.
 * Мировая ось x → X сцены, мировая ось y (вперёд по пути) → −Z сцены,
 * высота → Y сцены. Так камера с нулевым поворотом смотрит вперёд по пути.
 */
export class SceneCoords {
  public static toScene(point: Vector2, height = 0): Vector3 {
    return new Vector3(point.x, height, -point.y);
  }

  public static sceneZ(worldY: number): number {
    return -worldY;
  }
}
