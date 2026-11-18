import type { CellRect } from '../CellRect.ts';
import type { Obstacle } from '../Obstacle.ts';
import type { RoomKind } from '../RoomKind.ts';
import { RoomTemplate } from './RoomTemplate.ts';

/** Длинный пустой коридор шириной в одну клетку. */
export class CorridorTemplate extends RoomTemplate {
  public readonly kind: RoomKind = 'corridor';
  protected readonly oilChanceMultiplier = 0.6;

  public matches(cells: CellRect): boolean {
    return Math.min(cells.width, cells.height) === 1 && Math.max(cells.width, cells.height) >= 3;
  }

  protected placeObstacles(): Obstacle[] {
    return [];
  }
}
