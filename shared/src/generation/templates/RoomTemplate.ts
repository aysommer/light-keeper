import type { WorldSettings } from '../../config/GameConfig.ts';
import type { AABB } from '../../math/AABB.ts';
import { Vector2 } from '../../math/Vector2.ts';
import type { SeededRandom } from '../../random/SeededRandom.ts';
import type { CellRect } from '../CellRect.ts';
import type { ChunkGrid } from '../ChunkGrid.ts';
import type { Obstacle } from '../Obstacle.ts';
import type { RoomKind } from '../RoomKind.ts';

/** Всё, что нужно шаблону, чтобы обставить комнату. */
export interface RoomDecorationContext {
  readonly cells: CellRect;
  readonly bounds: AABB;
  readonly grid: ChunkGrid;
  readonly settings: WorldSettings;
  readonly rng: SeededRandom;
}

export interface RoomDecoration {
  readonly obstacles: Obstacle[];
  readonly oilSpawns: Vector2[];
}

/**
 * Шаблон комнаты: решает, подходит ли он под форму комнаты, и расставляет в ней
 * препятствия и точки появления канистр.
 *
 * Инвариант для наследников: препятствия не должны перекрывать середины рёбер
 * клеток (там бывают двери) и центры клеток (там появляются канистры).
 */
export abstract class RoomTemplate {
  public abstract readonly kind: RoomKind;

  /** Множитель вероятности канистры для этого типа комнаты. */
  protected abstract readonly oilChanceMultiplier: number;

  public abstract matches(cells: CellRect): boolean;

  public decorate(context: RoomDecorationContext): RoomDecoration {
    return {
      obstacles: this.placeObstacles(context),
      oilSpawns: this.placeOil(context),
    };
  }

  protected abstract placeObstacles(context: RoomDecorationContext): Obstacle[];

  /** Не больше одной канистры на комнату; шанс падает с глубиной. */
  protected placeOil(context: RoomDecorationContext): Vector2[] {
    const { oil } = context.settings;
    const depthChance = oil.baseChance * Math.pow(oil.decayPerChunk, context.grid.chunkIndex);
    const chance = Math.max(oil.minChance, depthChance) * this.oilChanceMultiplier;
    if (!context.rng.chance(chance)) {
      return [];
    }
    const col = context.cells.col + context.rng.int(0, context.cells.width - 1);
    const row = context.cells.row + context.rng.int(0, context.cells.height - 1);
    const jitter = new Vector2(
      context.rng.float(-oil.jitter, oil.jitter),
      context.rng.float(-oil.jitter, oil.jitter),
    );
    return [context.grid.cellCenter(col, row).add(jitter)];
  }
}
