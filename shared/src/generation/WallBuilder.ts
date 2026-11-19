import { AABB } from '../math/AABB.ts';
import type { EdgeOrientation } from './GridEdge.ts';
import type { RoomLayout } from './RoomLayout.ts';
import type { SpaceGrid } from './SpaceGrid.ts';
import { Wall } from './Wall.ts';

/** Отрезок стены вдоль одной линии сетки. */
interface WallSpan {
  start: number;
  end: number;
  /** Конец лежит в узле сетки (а не у проёма двери) — его надо продлить на полтолщины. */
  startOnGrid: boolean;
  endOnGrid: boolean;
}

/**
 * Строит стены пространства по разбиению на комнаты: внешний контур со всех
 * сторон и все рёбра между разными комнатами. Соседние сплошные рёбра на одной
 * линии сливаются в один коллайдер, в местах дверей остаётся проём.
 */
export class WallBuilder {
  public constructor(
    private readonly grid: SpaceGrid,
    private readonly wallThickness: number,
    private readonly doorWidth: number,
  ) {}

  public build(layout: RoomLayout, doorEdgeKeys: ReadonlySet<string>): Wall[] {
    const walls: Wall[] = [];

    // За пределами сетки ownerAt() возвращает −1, поэтому внешний контур
    // получается автоматически: «комната» снаружи всегда другая.
    for (let row = 0; row <= this.grid.rows; row++) {
      const spans: WallSpan[] = [];
      for (let col = 0; col < this.grid.columns; col++) {
        if (layout.ownerAt(col, row - 1) !== layout.ownerAt(col, row)) {
          this.addEdgeSpans(spans, col, doorEdgeKeys.has(`H:${col}:${row}`));
        }
      }
      walls.push(...this.toWalls(spans, 'horizontal', row * this.grid.cellSize));
    }

    for (let col = 0; col <= this.grid.columns; col++) {
      const spans: WallSpan[] = [];
      for (let row = 0; row < this.grid.rows; row++) {
        if (layout.ownerAt(col - 1, row) !== layout.ownerAt(col, row)) {
          this.addEdgeSpans(spans, row, doorEdgeKeys.has(`V:${col}:${row}`));
        }
      }
      walls.push(...this.toWalls(spans, 'vertical', col * this.grid.cellSize));
    }

    return walls;
  }

  /** Добавляет ребро (целиком или двумя кусками вокруг проёма), сливая с предыдущим. */
  private addEdgeSpans(spans: WallSpan[], index: number, hasDoor: boolean): void {
    const start = index * this.grid.cellSize;
    const end = start + this.grid.cellSize;
    if (!hasDoor) {
      this.pushSpan(spans, { start, end, startOnGrid: true, endOnGrid: true });
      return;
    }
    const middle = (start + end) / 2;
    const halfDoor = this.doorWidth / 2;
    this.pushSpan(spans, { start, end: middle - halfDoor, startOnGrid: true, endOnGrid: false });
    this.pushSpan(spans, { start: middle + halfDoor, end, startOnGrid: false, endOnGrid: true });
  }

  private pushSpan(spans: WallSpan[], span: WallSpan): void {
    const previous = spans[spans.length - 1];
    if (previous && previous.endOnGrid && span.startOnGrid && previous.end === span.start) {
      previous.end = span.end;
      previous.endOnGrid = span.endOnGrid;
      return;
    }
    spans.push({ ...span });
  }

  /** Превращает отрезки на линии в коллайдеры заданной толщины. */
  private toWalls(spans: readonly WallSpan[], orientation: EdgeOrientation, line: number): Wall[] {
    const half = this.wallThickness / 2;
    return spans.map((span) => {
      const start = span.start - (span.startOnGrid ? half : 0);
      const end = span.end + (span.endOnGrid ? half : 0);
      const bounds =
        orientation === 'horizontal'
          ? new AABB(start, line - half, end, line + half)
          : new AABB(line - half, start, line + half, end);
      return new Wall(bounds, orientation);
    });
  }
}
