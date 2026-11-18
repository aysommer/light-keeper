/** Неизменяемый двумерный вектор. Ось `x` — поперёк пути, ось `y` — вдоль пути (вперёд). */
export class Vector2 {
  public static readonly ZERO = new Vector2(0, 0);

  public constructor(
    public readonly x: number = 0,
    public readonly y: number = 0,
  ) {}

  public add(other: Vector2): Vector2 {
    return new Vector2(this.x + other.x, this.y + other.y);
  }

  public sub(other: Vector2): Vector2 {
    return new Vector2(this.x - other.x, this.y - other.y);
  }

  public scale(factor: number): Vector2 {
    return new Vector2(this.x * factor, this.y * factor);
  }

  public lengthSquared(): number {
    return this.x * this.x + this.y * this.y;
  }

  public length(): number {
    return Math.sqrt(this.lengthSquared());
  }

  public distanceTo(other: Vector2): number {
    return this.sub(other).length();
  }

  public normalize(): Vector2 {
    const length = this.length();
    return length === 0 ? Vector2.ZERO : this.scale(1 / length);
  }

  public equals(other: Vector2, epsilon = 1e-9): boolean {
    return Math.abs(this.x - other.x) <= epsilon && Math.abs(this.y - other.y) <= epsilon;
  }

  public toString(): string {
    return `(${this.x}, ${this.y})`;
  }
}
