import { Vector2 } from './Vector2.ts';

/** Неизменяемый прямоугольник, выровненный по осям (axis-aligned bounding box). */
export class AABB {
  public constructor(
    public readonly minX: number,
    public readonly minY: number,
    public readonly maxX: number,
    public readonly maxY: number,
  ) {
    if (minX > maxX || minY > maxY) {
      throw new Error(`Некорректный AABB: [${minX}, ${minY}] — [${maxX}, ${maxY}]`);
    }
  }

  public static fromCenter(center: Vector2, width: number, height: number): AABB {
    const halfWidth = width / 2;
    const halfHeight = height / 2;
    return new AABB(
      center.x - halfWidth,
      center.y - halfHeight,
      center.x + halfWidth,
      center.y + halfHeight,
    );
  }

  public get width(): number {
    return this.maxX - this.minX;
  }

  public get height(): number {
    return this.maxY - this.minY;
  }

  public get center(): Vector2 {
    return new Vector2((this.minX + this.maxX) / 2, (this.minY + this.maxY) / 2);
  }

  /** Точка внутри или на границе. */
  public containsPoint(point: Vector2): boolean {
    return (
      point.x >= this.minX && point.x <= this.maxX && point.y >= this.minY && point.y <= this.maxY
    );
  }

  /** Строгое пересечение: касание границами пересечением не считается. */
  public intersects(other: AABB): boolean {
    return (
      this.minX < other.maxX &&
      this.maxX > other.minX &&
      this.minY < other.maxY &&
      this.maxY > other.minY
    );
  }

  public intersectsCircle(center: Vector2, radius: number): boolean {
    const closestX = Math.min(Math.max(center.x, this.minX), this.maxX);
    const closestY = Math.min(Math.max(center.y, this.minY), this.maxY);
    const dx = center.x - closestX;
    const dy = center.y - closestY;
    return dx * dx + dy * dy < radius * radius;
  }

  public expand(margin: number): AABB {
    return new AABB(this.minX - margin, this.minY - margin, this.maxX + margin, this.maxY + margin);
  }

  public union(other: AABB): AABB {
    return new AABB(
      Math.min(this.minX, other.minX),
      Math.min(this.minY, other.minY),
      Math.max(this.maxX, other.maxX),
      Math.max(this.maxY, other.maxY),
    );
  }

  public translate(offset: Vector2): AABB {
    return new AABB(
      this.minX + offset.x,
      this.minY + offset.y,
      this.maxX + offset.x,
      this.maxY + offset.y,
    );
  }
}
