import type { SeededRandom } from '../random/SeededRandom.ts';
import type { CellRect } from './CellRect.ts';
import { RoomLayout } from './RoomLayout.ts';

interface RoomShape {
  readonly width: number;
  readonly height: number;
  readonly weight: number;
}

/**
 * Разбивает сетку чанка на прямоугольные комнаты.
 * Обходит клетки построчно; в каждой свободной клетке пробует формы комнат
 * в случайном (взвешенном) порядке и ставит первую, что помещается.
 * Форма 1×1 помещается всегда, поэтому сетка покрывается полностью.
 */
export class RoomLayoutPlanner {
  private static readonly SHAPES: readonly RoomShape[] = [
    // коридоры
    { width: 1, height: 3, weight: 3 },
    { width: 1, height: 4, weight: 2 },
    { width: 3, height: 1, weight: 2 },
    { width: 4, height: 1, weight: 1 },
    // залы
    { width: 2, height: 2, weight: 3 },
    { width: 3, height: 2, weight: 2 },
    { width: 2, height: 3, weight: 2 },
    { width: 3, height: 3, weight: 1 },
    // офисы и подсобки
    { width: 1, height: 1, weight: 3 },
    { width: 2, height: 1, weight: 2 },
    { width: 1, height: 2, weight: 2 },
  ];

  public constructor(
    private readonly columns: number,
    private readonly rows: number,
  ) {}

  public plan(rng: SeededRandom): RoomLayout {
    const owners = new Array<number>(this.columns * this.rows).fill(-1);
    const rects: CellRect[] = [];

    for (let row = 0; row < this.rows; row++) {
      for (let col = 0; col < this.columns; col++) {
        if (owners[row * this.columns + col] !== -1) {
          continue;
        }
        const shapes = rng.weightedShuffle(RoomLayoutPlanner.SHAPES, (shape) => shape.weight);
        const shape = shapes.find((candidate) => this.fits(owners, col, row, candidate)) ?? {
          width: 1,
          height: 1,
        };
        const rect: CellRect = { col, row, width: shape.width, height: shape.height };
        this.occupy(owners, rect, rects.length);
        rects.push(rect);
      }
    }

    return new RoomLayout(this.columns, this.rows, rects, owners);
  }

  private fits(owners: readonly number[], col: number, row: number, shape: RoomShape): boolean {
    if (col + shape.width > this.columns || row + shape.height > this.rows) {
      return false;
    }
    for (let r = row; r < row + shape.height; r++) {
      for (let c = col; c < col + shape.width; c++) {
        if (owners[r * this.columns + c] !== -1) {
          return false;
        }
      }
    }
    return true;
  }

  private occupy(owners: number[], rect: CellRect, owner: number): void {
    for (let r = rect.row; r < rect.row + rect.height; r++) {
      for (let c = rect.col; c < rect.col + rect.width; c++) {
        owners[r * this.columns + c] = owner;
      }
    }
  }
}
