import { AABB } from '../math/AABB.ts';
import { Vector2 } from '../math/Vector2.ts';
import type { WorldSettings } from '../config/GameConfig.ts';
import type { CellRect } from './CellRect.ts';
import type { GridEdge } from './GridEdge.ts';

/** Геометрия сетки одного чанка: перевод клеток и рёбер в мировые координаты. */
export class ChunkGrid {
  public readonly originY: number;

  public constructor(
    public readonly chunkIndex: number,
    private readonly settings: WorldSettings,
  ) {
    this.originY = chunkIndex * this.length;
  }

  public get columns(): number {
    return this.settings.columns;
  }

  public get rows(): number {
    return this.settings.rowsPerChunk;
  }

  public get cellSize(): number {
    return this.settings.cellSize;
  }

  /** Ширина чанка (ось x). */
  public get width(): number {
    return this.settings.columns * this.settings.cellSize;
  }

  /** Длина чанка (ось y). */
  public get length(): number {
    return this.settings.rowsPerChunk * this.settings.cellSize;
  }

  public get bounds(): AABB {
    return new AABB(0, this.originY, this.width, this.originY + this.length);
  }

  public contains(col: number, row: number): boolean {
    return col >= 0 && col < this.columns && row >= 0 && row < this.rows;
  }

  /** Мировая точка узла сетки (угла клеток). */
  public cornerPoint(col: number, row: number): Vector2 {
    return new Vector2(col * this.cellSize, this.originY + row * this.cellSize);
  }

  public cellBounds(col: number, row: number): AABB {
    const min = this.cornerPoint(col, row);
    return new AABB(min.x, min.y, min.x + this.cellSize, min.y + this.cellSize);
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
