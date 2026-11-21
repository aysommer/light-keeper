import { Vector3 } from 'three';
import { GameConfig } from '@light-keeper/shared';
import type { Vector2 } from '@light-keeper/shared';

/**
 * Перевод координат мира (2D, метры) в координаты сцены Three.js.
 * Мировая ось x → X сцены, мировая ось y (вперёд по пути) → −Z сцены,
 * высота → Y сцены. Так камера с нулевым поворотом смотрит вперёд по пути.
 */
export class SceneCoords {
  /** @param floor этаж: этажи стоят стопкой, каждый на `floorHeight` выше предыдущего */
  public static toScene(point: Vector2, height = 0, floor = 0): Vector3 {
    return new Vector3(point.x, height + SceneCoords.floorY(floor), -point.y);
  }

  /** Высота пола этажа в сцене. */
  public static floorY(floor: number): number {
    return floor * GameConfig.world.floorHeight;
  }

  public static sceneZ(worldY: number): number {
    return -worldY;
  }
}
