import type { Vector2 } from '../math/Vector2.ts';

/**
 * Лестница между этажами `lower` и `lower + 1`. Стоит в одной и той же
 * точке на обоих этажах: внизу по ней поднимаются, наверху — спускаются (`E`).
 */
export class Stair {
  public constructor(
    public readonly lower: number,
    public readonly position: Vector2,
  ) {}

  /** Куда ведёт лестница с этажа `floor`; `null` — лестница не на этом этаже. */
  public targetFrom(floor: number): number | null {
    if (floor === this.lower) return this.lower + 1;
    if (floor === this.lower + 1) return this.lower;
    return null;
  }
}
