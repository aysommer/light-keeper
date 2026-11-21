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

  /** Коллизии этажа `floor` пространства. */
  public static fromSpace(space: Space, floor = 0): CollisionWorld {
    return new CollisionWorld(space.floor(floor).colliders);
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

  /** Видно ли точку `to` из точки `from`: отрезок между ними не пересекает коллайдеры. */
  public lineOfSight(from: Vector2, to: Vector2): boolean {
    const area = new AABB(
      Math.min(from.x, to.x),
      Math.min(from.y, to.y),
      Math.max(from.x, to.x),
      Math.max(from.y, to.y),
    );
    const found = new Set<AABB>();
    this.forEachBucket(area, (key) => this.buckets.get(key)?.forEach((c) => found.add(c)));
    for (const collider of found) {
      if (CollisionWorld.segmentHitsBox(from, to, collider)) {
        return false;
      }
    }
    return true;
  }

  public move(position: Vector2, delta: Vector2, radius: number): Vector2 {
    const reach = delta.length() + radius + 1;
    return this.resolver.move(position, delta, radius, this.collidersNear(position, reach));
  }

  /** Пересекает ли отрезок прямоугольник (метод «плит»). */
  private static segmentHitsBox(from: Vector2, to: Vector2, box: AABB): boolean {
    let enter = 0;
    let exit = 1;
    const axes: Array<[number, number, number, number]> = [
      [from.x, to.x - from.x, box.minX, box.maxX],
      [from.y, to.y - from.y, box.minY, box.maxY],
    ];
    for (const [origin, delta, min, max] of axes) {
      if (Math.abs(delta) < 1e-12) {
        if (origin < min || origin > max) return false;
        continue;
      }
      let t1 = (min - origin) / delta;
      let t2 = (max - origin) / delta;
      if (t1 > t2) [t1, t2] = [t2, t1];
      enter = Math.max(enter, t1);
      exit = Math.min(exit, t2);
      if (enter > exit) return false;
    }
    return true;
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
