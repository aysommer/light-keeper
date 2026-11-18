/** Прямоугольник из клеток сетки чанка. */
export interface CellRect {
  readonly col: number;
  readonly row: number;
  readonly width: number;
  readonly height: number;
}
