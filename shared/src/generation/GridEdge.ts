/**
 * Ориентация ребра сетки:
 * - `horizontal` — ребро лежит на линии `y = row * cellSize` и тянется вдоль x
 *   от `col` до `col + 1`;
 * - `vertical` — ребро лежит на линии `x = col * cellSize` и тянется вдоль y
 *   от `row` до `row + 1`.
 */
export type EdgeOrientation = 'horizontal' | 'vertical';

/** Ребро между клетками сетки чанка (локальные координаты сетки). */
export class GridEdge {
  public constructor(
    public readonly orientation: EdgeOrientation,
    public readonly col: number,
    public readonly row: number,
  ) {}

  public static horizontal(col: number, row: number): GridEdge {
    return new GridEdge('horizontal', col, row);
  }

  public static vertical(col: number, row: number): GridEdge {
    return new GridEdge('vertical', col, row);
  }

  public get key(): string {
    return `${this.orientation === 'horizontal' ? 'H' : 'V'}:${this.col}:${this.row}`;
  }
}
