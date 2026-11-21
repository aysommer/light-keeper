import { Vector2 } from '@light-keeper/shared';
import type { DroppedCanister, Space } from '@light-keeper/shared';

/** Подсказка у пустой канистры: подошёл вплотную — понял, что она пустая. */
export class CanisterHint {
  /** С какого расстояния видно, что канистра пустая, м. */
  public static readonly DISTANCE = 1;

  public resolve(
    space: Space,
    taken: readonly number[] | null,
    dropped: readonly DroppedCanister[] | null,
    position: Vector2,
    floor = 0,
  ): string | null {
    const takenSet = new Set(taken ?? []);
    const floors = space.oilFloors;
    const near = (point: Vector2): boolean => point.distanceTo(position) <= CanisterHint.DISTANCE;
    const here = (i: number): boolean => (floors[i] ?? 0) === floor;
    // Рядом полная — её подберут автоматически, подсказка не нужна.
    const fullNear = space.oilSpawns.some(
      (spawn, i) => here(i) && space.isOilFull(i) && !takenSet.has(i) && near(spawn),
    );
    if (fullNear) {
      return null;
    }
    const emptyNear =
      space.oilSpawns.some((spawn, i) => here(i) && !space.isOilFull(i) && near(spawn)) ||
      (dropped ?? []).some((drop) => drop.floor === floor && near(new Vector2(drop.x, drop.y)));
    return emptyNear ? 'Пустая канистра' : null;
  }
}
