import type { CellRect } from './CellRect.ts';

/** Разбиение сетки чанка на комнаты: какая комната владеет каждой клеткой. */
export class RoomLayout {
  public constructor(
    public readonly columns: number,
    public readonly rows: number,
    public readonly rects: readonly CellRect[],
    private readonly owners: readonly number[],
  ) {}

  /** Индекс комнаты в клетке или `-1` для клетки вне сетки. */
  public ownerAt(col: number, row: number): number {
    if (col < 0 || col >= this.columns || row < 0 || row >= this.rows) {
      return -1;
    }
    return this.owners[row * this.columns + col] ?? -1;
  }
}
