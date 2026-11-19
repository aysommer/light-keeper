import { AABB } from '../math/AABB.ts';
import type { Vector2 } from '../math/Vector2.ts';
import type { Space } from '../generation/Space.ts';
import { CollisionResolver } from './CollisionResolver.ts';

/**
 * Коллизии пространства. Коллайдеры разложены по корзинам-ячейкам,
 * чтобы для движения проверять только ближайшие.
 */
export class CollisionWorld {
  private readonly buckets = new Map<string, AABB[]>();

  public constructor(
    colliders: readonly AABB[],
    private readonly resolver: CollisionResolver = new CollisionResolver(),
    private readonly bucketSize = 4,
  ) {
    for (const collider of colliders) {
      this.forEachBucket(collider, (key) => {
        let bucket = this.buckets.get(key);
        if (!bucket) {
          bucket = [];
          this.buckets.set(key, bucket);
        }
        bucket.push(collider);
      });
    }
  }

  public static fromSpace(space: Space): CollisionWorld {
    return new CollisionWorld(space.colliders);
  }

  /** Коллайдеры в квадрате со стороной `2 * reach` вокруг точки. */
  public collidersNear(position: Vector2, reach: number): AABB[] {
    const area = new AABB(
      position.x - reach,
      position.y - reach,
      position.x + reach,
      position.y + reach,
    );
    const found = new Set<AABB>();
    this.forEachBucket(area, (key) => {
      for (const collider of this.buckets.get(key) ?? []) {
        if (collider.intersects(area)) found.add(collider);
      }
    });
    return [...found];
  }

  public move(position: Vector2, delta: Vector2, radius: number): Vector2 {
    const reach = delta.length() + radius + 1;
    return this.resolver.move(position, delta, radius, this.collidersNear(position, reach));
  }

  private forEachBucket(area: AABB, visit: (key: string) => void): void {
    const minX = Math.floor(area.minX / this.bucketSize);
    const maxX = Math.floor(area.maxX / this.bucketSize);
    const minY = Math.floor(area.minY / this.bucketSize);
    const maxY = Math.floor(area.maxY / this.bucketSize);
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        visit(`${x}:${y}`);
      }
    }
  }
}
