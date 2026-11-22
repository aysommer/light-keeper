import { AABB } from '../math/AABB.ts';
import { Vector2 } from '../math/Vector2.ts';
import type { CellRect } from './CellRect.ts';
import type { GridEdge } from './GridEdge.ts';

/** Геометрия сетки пространства: перевод клеток и рёбер в мировые координаты. */
export class SpaceGrid {
  public constructor(
    public readonly columns: number,
    public readonly rows: number,
    public readonly cellSize: number,
  ) {}

  /** Ширина пространства (ось x), м. */
  public get width(): number {
    return this.columns * this.cellSize;
  }

  /** Длина пространства (ось y), м. */
  public get length(): number {
    return this.rows * this.cellSize;
  }

  public get bounds(): AABB {
    return new AABB(0, 0, this.width, this.length);
  }

  public contains(col: number, row: number): boolean {
    return col >= 0 && col < this.columns && row >= 0 && row < this.rows;
  }

  /** Мировая точка узла сетки (угла клеток). */
  public cornerPoint(col: number, row: number): Vector2 {
    return new Vector2(col * this.cellSize, row * this.cellSize);
  }

  public cellBounds(col: number, row: number): AABB {
    const min = this.cornerPoint(col, row);
    return new AABB(min.x, min.y, min.x + this.cellSize, min.y + this.cellSize);
  }

  /** Клетка [столбец, строка], в которой лежит точка. */
  public cellAt(point: Vector2): [number, number] {
    return [Math.floor(point.x / this.cellSize), Math.floor(point.y / this.cellSize)];
  }

  public cellCenter(col: number, row: number): Vector2 {
    return this.cellBounds(col, row).center;
  }

  public rectBounds(rect: CellRect): AABB {
    const min = this.cornerPoint(rect.col, rect.row);
    return new AABB(
      min.x,
      min.y,
      min.x + rect.width * this.cellSize,
      min.y + rect.height * this.cellSize,
    );
  }

  /** Мировая точка середины ребра. */
  public edgeCenter(edge: GridEdge): Vector2 {
    const corner = this.cornerPoint(edge.col, edge.row);
    const half = this.cellSize / 2;
    return edge.orientation === 'horizontal'
      ? new Vector2(corner.x + half, corner.y)
      : new Vector2(corner.x, corner.y + half);
  }
}
