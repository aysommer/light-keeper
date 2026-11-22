import { AABB } from '../math/AABB.ts';
import type { Vector2 } from '../math/Vector2.ts';

/**
 * Лестница между этажами `lower` и `lower + 1`. Игрок встаёт в точку `position`
 * (одна и та же на обоих этажах) и нажимает `E`. Пролёт ступеней внизу (и проём
 * с перилами наверху) уходит от этой точки в сторону `direction` и целиком
 * помещается в клетку — к сплошной стене, не к проёму. Пролёт твёрдый: сквозь
 * него не проходят ни игроки, ни привидения.
 */
export class Stair {
  /** Пролёт начинается в стольких метрах от точки подъёма… */
  public static readonly RUN_START = 0.45;
  /** …и заканчивается в стольких (клетка 4 м, полстены 0,1 м + запас). */
  public static readonly RUN_END = 1.8;
  /** Полуширина пролёта, м. */
  public static readonly HALF_WIDTH = 0.5;

  public constructor(
    public readonly lower: number,
    public readonly position: Vector2,
    /** Куда уходит пролёт от точки подъёма: единичный вектор вдоль оси. */
    public readonly direction: Vector2,
  ) {}

  /** Куда ведёт лестница с этажа `floor`; `null` — лестница не на этом этаже. */
  public targetFrom(floor: number): number | null {
    if (floor === this.lower) return this.lower + 1;
    if (floor === this.lower + 1) return this.lower;
    return null;
  }

  /** Непроходимый прямоугольник пролёта (на обоих этажах лестницы). */
  public block(): AABB {
    const from = this.position.add(this.direction.scale(Stair.RUN_START));
    const to = this.position.add(this.direction.scale(Stair.RUN_END));
    const side = Stair.HALF_WIDTH;
    const alongX = Math.abs(this.direction.x) > 0.5;
    return new AABB(
      Math.min(from.x, to.x) - (alongX ? 0 : side),
      Math.min(from.y, to.y) - (alongX ? side : 0),
      Math.max(from.x, to.x) + (alongX ? 0 : side),
      Math.max(from.y, to.y) + (alongX ? side : 0),
    );
  }
}
