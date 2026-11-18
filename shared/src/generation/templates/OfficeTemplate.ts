import { AABB } from '../../math/AABB.ts';
import { Obstacle } from '../Obstacle.ts';
import type { RoomKind } from '../RoomKind.ts';
import type { RoomDecorationContext } from './RoomTemplate.ts';
import { RoomTemplate } from './RoomTemplate.ts';

/** Небольшая пустая комната; в углах клеток иногда стоят столы. Подходит под любую форму. */
export class OfficeTemplate extends RoomTemplate {
  public readonly kind: RoomKind = 'office';
  protected readonly oilChanceMultiplier = 1.3;

  public matches(): boolean {
    return true;
  }

  protected placeObstacles(context: RoomDecorationContext): Obstacle[] {
    const { cells, grid, settings, rng } = context;
    const { width, depth, wallGap, chancePerCell } = settings.desk;
    const desks: Obstacle[] = [];

    for (let row = cells.row; row < cells.row + cells.height; row++) {
      for (let col = cells.col; col < cells.col + cells.width; col++) {
        if (!rng.chance(chancePerCell)) {
          continue;
        }
        const cell = grid.cellBounds(col, row);
        const alongX = rng.chance(0.5);
        const deskWidth = alongX ? width : depth;
        const deskHeight = alongX ? depth : width;
        const atRight = rng.chance(0.5);
        const atTop = rng.chance(0.5);
        const minX = atRight ? cell.maxX - wallGap - deskWidth : cell.minX + wallGap;
        const minY = atTop ? cell.maxY - wallGap - deskHeight : cell.minY + wallGap;
        desks.push(new Obstacle('desk', new AABB(minX, minY, minX + deskWidth, minY + deskHeight)));
      }
    }
    return desks;
  }
}
