import type { AABB } from '../math/AABB.ts';
import { Vector2 } from '../math/Vector2.ts';

/**
 * Движение круга (игрока, привидения) среди прямоугольных коллайдеров
 * со скольжением вдоль стен. Длинный шаг делится на подшаги,
 * чтобы круг не «проскакивал» тонкие стены.
 */
export class CollisionResolver {
  public constructor(
    /** Сколько раз за подшаг выталкивать круг из пересечений. */
    private readonly iterations = 4,
  ) {}

  public move(
    position: Vector2,
    delta: Vector2,
    radius: number,
    colliders: readonly AABB[],
  ): Vector2 {
    const maxStep = radius * 0.5;
    const steps = Math.max(1, Math.ceil(delta.length() / maxStep));
    const step = delta.scale(1 / steps);
    let current = position;
    for (let i = 0; i < steps; i++) {
      current = this.resolve(current.add(step), radius, colliders);
    }
    return current;
  }

  /** Выталкивает круг из всех пересекаемых коллайдеров. */
  public resolve(position: Vector2, radius: number, colliders: readonly AABB[]): Vector2 {
    let current = position;
    for (let iteration = 0; iteration < this.iterations; iteration++) {
      let pushed = false;
      for (const box of colliders) {
        const push = this.penetration(current, radius, box);
        if (push) {
          current = current.add(push);
          pushed = true;
        }
      }
      if (!pushed) {
        break;
      }
    }
    return current;
  }

  /** Вектор, на который нужно сдвинуть круг, чтобы он перестал пересекать коробку. */
  private penetration(center: Vector2, radius: number, box: AABB): Vector2 | null {
    const closestX = Math.min(Math.max(center.x, box.minX), box.maxX);
    const closestY = Math.min(Math.max(center.y, box.minY), box.maxY);
    const offset = new Vector2(center.x - closestX, center.y - closestY);
    const distanceSquared = offset.lengthSquared();
    if (distanceSquared >= radius * radius) {
      return null;
    }
    if (distanceSquared > 1e-12) {
      const distance = Math.sqrt(distanceSquared);
      return offset.scale((radius - distance) / distance);
    }
    // Центр внутри коробки — выталкиваем через ближайшую сторону.
    const exits = [
      new Vector2(box.minX - center.x - radius, 0),
      new Vector2(box.maxX - center.x + radius, 0),
      new Vector2(0, box.minY - center.y - radius),
      new Vector2(0, box.maxY - center.y + radius),
    ];
    return exits.reduce((best, exit) => (exit.length() < best.length() ? exit : best));
  }
}
