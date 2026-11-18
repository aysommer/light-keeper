import { AABB } from '../math/AABB.ts';
import type { Vector2 } from '../math/Vector2.ts';
import type { WorldLayout } from '../generation/WorldLayout.ts';
import { CollisionResolver } from './CollisionResolver.ts';

/** Коллизии с бесконечным миром: собирает стены и препятствия ближайших чанков. */
export class CollisionWorld {
  public constructor(
    private readonly world: WorldLayout,
    private readonly resolver: CollisionResolver = new CollisionResolver(),
  ) {}

  /** Коллайдеры в квадрате со стороной `2 * reach` вокруг точки. */
  public collidersNear(position: Vector2, reach: number): AABB[] {
    const area = new AABB(
      position.x - reach,
      position.y - reach,
      position.x + reach,
      position.y + reach,
    );
    // Нижняя стена следующего чанка закрывает верх текущего — захватываем и её.
    const chunks = this.world.getChunksBetween(area.minY, area.maxY + 1);
    const colliders: AABB[] = [];
    for (const chunk of chunks) {
      for (const wall of chunk.walls) {
        if (wall.bounds.intersects(area)) colliders.push(wall.bounds);
      }
      for (const obstacle of chunk.obstacles) {
        if (obstacle.bounds.intersects(area)) colliders.push(obstacle.bounds);
      }
    }
    return colliders;
  }

  public move(position: Vector2, delta: Vector2, radius: number): Vector2 {
    const reach = delta.length() + radius + 1;
    return this.resolver.move(position, delta, radius, this.collidersNear(position, reach));
  }
}
