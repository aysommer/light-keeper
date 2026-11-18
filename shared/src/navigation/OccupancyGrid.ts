import type { AABB } from '../math/AABB.ts';
import type { Vector2 } from '../math/Vector2.ts';

/**
 * Растровая карта проходимости. Клетка заблокирована, если её центр попадает
 * в препятствие, расширенное на радиус агента.
 * Используется для проверки связности уровня, позже — для поиска пути привидений.
 */
export class OccupancyGrid {
  public readonly columns: number;
  public readonly rows: number;
  private readonly blocked: Uint8Array;

  public constructor(
    public readonly bounds: AABB,
    public readonly resolution: number,
  ) {
    this.columns = Math.ceil(bounds.width / resolution);
    this.rows = Math.ceil(bounds.height / resolution);
    this.blocked = new Uint8Array(this.columns * this.rows);
  }

  public block(area: AABB, inflate = 0): void {
    const inflated = area.expand(inflate);
    const minCol = Math.max(
      0,
      Math.ceil((inflated.minX - this.bounds.minX) / this.resolution - 0.5),
    );
    const maxCol = Math.min(
      this.columns - 1,
      Math.floor((inflated.maxX - this.bounds.minX) / this.resolution - 0.5),
    );
    const minRow = Math.max(
      0,
      Math.ceil((inflated.minY - this.bounds.minY) / this.resolution - 0.5),
    );
    const maxRow = Math.min(
      this.rows - 1,
      Math.floor((inflated.maxY - this.bounds.minY) / this.resolution - 0.5),
    );
    for (let row = minRow; row <= maxRow; row++) {
      this.blocked.fill(1, row * this.columns + minCol, row * this.columns + maxCol + 1);
    }
  }

  public isBlocked(point: Vector2): boolean {
    const index = this.indexOf(point);
    return index === -1 || this.blocked[index] === 1;
  }

  /** Достижима ли точка `to` из точки `from` по 4-связной сетке. */
  public canReach(from: Vector2, to: Vector2): boolean {
    return this.reachableFrom(from).has(this.indexOf(to));
  }

  /** Множество индексов клеток, достижимых из точки. */
  public reachableFrom(start: Vector2): ReachableSet {
    const visited = new Uint8Array(this.columns * this.rows);
    const startIndex = this.indexOf(start);
    if (startIndex === -1 || this.blocked[startIndex] === 1) {
      return new ReachableSet(this, visited);
    }
    const queue = new Int32Array(this.columns * this.rows);
    let head = 0;
    let tail = 0;
    queue[tail++] = startIndex;
    visited[startIndex] = 1;
    while (head < tail) {
      const index = queue[head++] as number;
      const col = index % this.columns;
      const neighbours = [
        col > 0 ? index - 1 : -1,
        col < this.columns - 1 ? index + 1 : -1,
        index - this.columns,
        index + this.columns,
      ];
      for (const next of neighbours) {
        if (next >= 0 && next < visited.length && visited[next] === 0 && this.blocked[next] === 0) {
          visited[next] = 1;
          queue[tail++] = next;
        }
      }
    }
    return new ReachableSet(this, visited);
  }

  /** Индекс клетки, содержащей точку, или `-1`, если точка вне карты. */
  public indexOf(point: Vector2): number {
    const col = Math.floor((point.x - this.bounds.minX) / this.resolution);
    const row = Math.floor((point.y - this.bounds.minY) / this.resolution);
    if (col < 0 || col >= this.columns || row < 0 || row >= this.rows) {
      return -1;
    }
    return row * this.columns + col;
  }
}

/** Результат заливки: какие клетки достижимы. */
export class ReachableSet {
  public constructor(
    private readonly grid: OccupancyGrid,
    private readonly visited: Uint8Array,
  ) {}

  public has(index: number): boolean {
    return index >= 0 && this.visited[index] === 1;
  }

  public contains(point: Vector2): boolean {
    return this.has(this.grid.indexOf(point));
  }
}
