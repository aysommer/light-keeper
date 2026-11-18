import { AABB } from '../../math/AABB.ts';
import type { CellRect } from '../CellRect.ts';
import { Obstacle } from '../Obstacle.ts';
import type { RoomKind } from '../RoomKind.ts';
import type { RoomDecorationContext } from './RoomTemplate.ts';
import { RoomTemplate } from './RoomTemplate.ts';

/** Большой зал; иногда с колоннами во внутренних узлах сетки. */
export class HallTemplate extends RoomTemplate {
  public readonly kind: RoomKind = 'hall';
  protected readonly oilChanceMultiplier = 1;

  public matches(cells: CellRect): boolean {
    return cells.width >= 2 && cells.height >= 2;
  }

  protected placeObstacles(context: RoomDecorationContext): Obstacle[] {
    if (!context.rng.chance(context.settings.hallPillarChance)) {
      return [];
    }
    const { cells, grid, settings } = context;
    const pillars: Obstacle[] = [];
    for (let row = cells.row + 1; row < cells.row + cells.height; row++) {
      for (let col = cells.col + 1; col < cells.col + cells.width; col++) {
        const bounds = AABB.fromCenter(
          grid.cornerPoint(col, row),
          settings.pillarSize,
          settings.pillarSize,
        );
        pillars.push(new Obstacle('pillar', bounds));
      }
    }
    return pillars;
  }
}
