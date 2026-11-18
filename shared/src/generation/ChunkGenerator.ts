import { GameConfig } from '../config/GameConfig.ts';
import type { WorldSettings } from '../config/GameConfig.ts';
import { Vector2 } from '../math/Vector2.ts';
import { SeededRandom } from '../random/SeededRandom.ts';
import { SeedHasher } from '../random/SeedHasher.ts';
import { Chunk } from './Chunk.ts';
import { ChunkGrid } from './ChunkGrid.ts';
import { Door } from './Door.ts';
import { DoorPlanner } from './DoorPlanner.ts';
import { GridEdge } from './GridEdge.ts';
import { Room } from './Room.ts';
import type { RoomLayout } from './RoomLayout.ts';
import { RoomLayoutPlanner } from './RoomLayoutPlanner.ts';
import { RoomTemplateRegistry } from './templates/RoomTemplateRegistry.ts';
import { WallBuilder } from './WallBuilder.ts';

/**
 * Детерминированный генератор чанков мира.
 *
 * Чанк `i` зависит только от `(seed, i)`, поэтому клиент и сервер строят
 * одинаковый мир, а по сети достаточно передать seed. Двери на стыке чанков
 * выбираются из `hash(seed, boundary)` — оба соседа вычисляют их независимо.
 */
export class ChunkGenerator {
  private readonly layoutPlanner: RoomLayoutPlanner;
  private readonly doorPlanner: DoorPlanner;

  public constructor(
    public readonly seed: number,
    private readonly settings: WorldSettings = GameConfig.world,
    private readonly templates: RoomTemplateRegistry = RoomTemplateRegistry.createDefault(),
  ) {
    this.layoutPlanner = new RoomLayoutPlanner(settings.columns, settings.rowsPerChunk);
    this.doorPlanner = new DoorPlanner(settings.extraDoorChance);
  }

  /** Длина чанка вдоль пути, м. */
  public get chunkLength(): number {
    return this.settings.rowsPerChunk * this.settings.cellSize;
  }

  /** Ширина мира, м. */
  public get worldWidth(): number {
    return this.settings.columns * this.settings.cellSize;
  }

  public generate(index: number): Chunk {
    if (!Number.isInteger(index) || index < 0) {
      throw new Error(`Некорректный индекс чанка: ${index}`);
    }
    const rng = new SeededRandom(SeedHasher.hash(this.seed, 'chunk', index));
    const grid = new ChunkGrid(index, this.settings);
    const layout = this.layoutPlanner.plan(rng.fork('layout'));
    const rooms = this.createRooms(grid, layout, rng);
    const roomId = (col: number, row: number): string =>
      this.roomId(index, layout.ownerAt(col, row));

    const doors = this.doorPlanner
      .plan(layout, rng.fork('doors'))
      .map(
        (planned) =>
          new Door(
            planned.edge,
            grid.edgeCenter(planned.edge),
            this.settings.doorWidth,
            this.roomId(index, Math.min(planned.roomA, planned.roomB)),
            this.roomId(index, Math.max(planned.roomA, planned.roomB)),
          ),
      );

    const entryDoor = this.createEntryDoor(grid, roomId);
    const exitColumn = this.boundaryDoorColumn(index + 1);
    const exitEdge = GridEdge.horizontal(exitColumn, grid.rows);
    const exitDoor = new Door(
      exitEdge,
      grid.edgeCenter(exitEdge),
      this.settings.doorWidth,
      roomId(exitColumn, grid.rows - 1),
      null,
    );
    if (entryDoor) {
      doors.push(entryDoor);
    }
    doors.push(exitDoor);

    const walls = new WallBuilder(grid, this.settings.wallThickness, this.settings.doorWidth).build(
      layout,
      new Set(doors.map((door) => door.edge.key)),
    );

    return new Chunk(index, grid.bounds, rooms, walls, doors, entryDoor, exitDoor);
  }

  /**
   * Колонка двери на границе `boundary` (между чанками `boundary - 1` и `boundary`).
   * Граница 0 — стартовая стена, двери в ней нет.
   */
  public boundaryDoorColumn(boundary: number): number {
    return new SeededRandom(SeedHasher.hash(this.seed, 'boundary', boundary)).int(
      0,
      this.settings.columns - 1,
    );
  }

  /** Стартовые позиции двух игроков в нулевом чанке. */
  public startPositions(): [Vector2, Vector2] {
    const grid = new ChunkGrid(0, this.settings);
    const center = grid.cellCenter(Math.floor(grid.columns / 2), 0);
    const offset = new Vector2(this.settings.cellSize / 5, 0);
    return [center.sub(offset), center.add(offset)];
  }

  private createRooms(grid: ChunkGrid, layout: RoomLayout, rng: SeededRandom): Room[] {
    return layout.rects.map((cells, index) => {
      const template = this.templates.select(cells);
      const bounds = grid.rectBounds(cells);
      const decoration = template.decorate({
        cells,
        bounds,
        grid,
        settings: this.settings,
        rng: rng.fork(`room:${index}`),
      });
      return new Room(
        this.roomId(grid.chunkIndex, index),
        template.kind,
        cells,
        bounds,
        decoration.obstacles,
        decoration.oilSpawns,
      );
    });
  }

  private createEntryDoor(
    grid: ChunkGrid,
    roomId: (col: number, row: number) => string,
  ): Door | null {
    if (grid.chunkIndex === 0) {
      return null;
    }
    const column = this.boundaryDoorColumn(grid.chunkIndex);
    const edge = GridEdge.horizontal(column, 0);
    return new Door(edge, grid.edgeCenter(edge), this.settings.doorWidth, null, roomId(column, 0));
  }

  private roomId(chunkIndex: number, roomIndex: number): string {
    return `${chunkIndex}:${roomIndex}`;
  }
}
