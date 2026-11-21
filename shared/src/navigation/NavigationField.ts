import { Vector2 } from '../math/Vector2.ts';
import type { Space } from '../generation/Space.ts';
import { OccupancyGrid } from './OccupancyGrid.ts';

/**
 * Поле расстояний по лабиринту до ближайшей цели (игрока) — «карта путей»
 * для привидений. Считается поиском в ширину от всех целей сразу; привидение
 * идёт в соседнюю клетку с меньшим расстоянием (к игроку) или с большим
 * (прочь от света).
 */
export class NavigationField {
  private static readonly NEIGHBOURS = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
    [1, 1],
    [1, -1],
    [-1, 1],
    [-1, -1],
  ] as const;

  private readonly grid: OccupancyGrid;
  private distances: Int32Array;

  /** Поле путей по этажу `floor` пространства. */
  public constructor(space: Space, agentRadius: number, resolution = 0.5, floor = 0) {
    this.grid = new OccupancyGrid(space.bounds, resolution);
    space.floor(floor).colliders.forEach((collider) => this.grid.block(collider, agentRadius));
    this.distances = new Int32Array(this.grid.columns * this.grid.rows).fill(-1);
  }

  /** Пересчитать расстояния до ближайшей из целей. */
  public computeFrom(targets: readonly Vector2[]): void {
    const { columns, rows } = this.grid;
    const distances = new Int32Array(columns * rows).fill(-1);
    const queue = new Int32Array(columns * rows);
    let head = 0;
    let tail = 0;
    for (const target of targets) {
      const index = this.nearestFree(this.grid.indexOf(target));
      if (index >= 0 && distances[index] === -1) {
        distances[index] = 0;
        queue[tail++] = index;
      }
    }
    while (head < tail) {
      const index = queue[head++]!;
      const col = index % columns;
      const row = Math.floor(index / columns);
      for (const [dx, dy] of NavigationField.NEIGHBOURS) {
        const nc = col + dx;
        const nr = row + dy;
        if (nc < 0 || nr < 0 || nc >= columns || nr >= rows) continue;
        const next = nr * columns + nc;
        // По диагонали — только если не срезаем угол стены.
        if (dx !== 0 && dy !== 0) {
          if (
            this.grid.isBlockedIndex(row * columns + nc) ||
            this.grid.isBlockedIndex(nr * columns + col)
          ) {
            continue;
          }
        }
        if (distances[next] === -1 && !this.grid.isBlockedIndex(next)) {
          distances[next] = distances[index]! + 1;
          queue[tail++] = next;
        }
      }
    }
    this.distances = distances;
  }

  /** Расстояние до ближайшей цели в шагах сетки; `-1` — недостижимо. */
  public stepsAt(position: Vector2): number {
    const index = this.grid.indexOf(position);
    return index < 0 ? -1 : (this.distances[index] ?? -1);
  }

  /**
   * Сдвиг на `distance` метров по полю: к цели или (если `away`) прочь от неё.
   * Если клетка вне поля — стоим на месте.
   */
  public step(position: Vector2, distance: number, away = false): Vector2 {
    const here = this.nearestFree(this.grid.indexOf(position));
    if (here < 0 || this.distances[here] === -1) {
      return position;
    }
    const { columns, rows } = this.grid;
    const col = here % columns;
    const row = Math.floor(here / columns);
    let best = here;
    let bestValue = this.distances[here]!;
    for (const [dx, dy] of NavigationField.NEIGHBOURS) {
      const nc = col + dx;
      const nr = row + dy;
      if (nc < 0 || nr < 0 || nc >= columns || nr >= rows) continue;
      if (dx !== 0 && dy !== 0) {
        if (
          this.grid.isBlockedIndex(row * columns + nc) ||
          this.grid.isBlockedIndex(nr * columns + col)
        ) {
          continue;
        }
      }
      const next = nr * columns + nc;
      const value = this.distances[next]!;
      if (value === -1) continue;
      if (away ? value > bestValue : value < bestValue) {
        best = next;
        bestValue = value;
      }
    }
    const target =
      best === here
        ? new Vector2(this.grid.cellCenterX(here), this.grid.cellCenterY(here))
        : new Vector2(this.grid.cellCenterX(best), this.grid.cellCenterY(best));
    const offset = target.sub(position);
    const length = offset.length();
    if (length < 1e-6) {
      return position;
    }
    return position.add(offset.scale(Math.min(distance, length) / length));
  }

  /** Центры всех свободных достижимых клеток с расстоянием до целей не меньше `minSteps`. */
  public cellsFartherThan(minSteps: number): Vector2[] {
    const cells: Vector2[] = [];
    this.distances.forEach((value, index) => {
      if (value >= minSteps) {
        cells.push(new Vector2(this.grid.cellCenterX(index), this.grid.cellCenterY(index)));
      }
    });
    return cells;
  }

  /** Самая дальняя от целей достижимая клетка. */
  public farthestCell(): Vector2 | null {
    let best = -1;
    let bestValue = -1;
    this.distances.forEach((value, index) => {
      if (value > bestValue) {
        best = index;
        bestValue = value;
      }
    });
    return best < 0 ? null : new Vector2(this.grid.cellCenterX(best), this.grid.cellCenterY(best));
  }

  public get resolution(): number {
    return this.grid.resolution;
  }

  /** Ближайшая свободная клетка к данной (игрок может стоять у самой стены). */
  private nearestFree(index: number): number {
    if (index < 0 || !this.grid.isBlockedIndex(index)) {
      return index;
    }
    const { columns, rows } = this.grid;
    const col = index % columns;
    const row = Math.floor(index / columns);
    for (let radius = 1; radius <= 3; radius++) {
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          const nc = col + dx;
          const nr = row + dy;
          if (nc < 0 || nr < 0 || nc >= columns || nr >= rows) continue;
          const next = nr * columns + nc;
          if (!this.grid.isBlockedIndex(next)) return next;
        }
      }
    }
    return -1;
  }
}
