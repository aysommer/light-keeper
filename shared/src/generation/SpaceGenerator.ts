import { SpacePalette } from '../appearance/SpacePalette.ts';
import { GameConfig } from '../config/GameConfig.ts';
import type { WorldSettings } from '../config/GameConfig.ts';
import { Vector2 } from '../math/Vector2.ts';
import { PlayerMovement } from '../simulation/PlayerMovement.ts';
import { SeededRandom } from '../random/SeededRandom.ts';
import { SeedHasher } from '../random/SeedHasher.ts';
import { Door } from './Door.ts';
import { DoorPlanner } from './DoorPlanner.ts';
import { ExitPlanner } from './ExitPlanner.ts';
import { Room } from './Room.ts';
import type { RoomLayout } from './RoomLayout.ts';
import { RoomLayoutPlanner } from './RoomLayoutPlanner.ts';
import { Space } from './Space.ts';
import { SpaceGrid } from './SpaceGrid.ts';
import { RoomTemplateRegistry } from './templates/RoomTemplateRegistry.ts';
import { WallBuilder } from './WallBuilder.ts';

/**
 * Детерминированный генератор пространств партии.
 *
 * Пространство `i` зависит только от `(seed партии, i)`: клиент и сервер строят
 * одинаковую карту, а по сети достаточно передать номер пространства.
 */
export class SpaceGenerator {
  public constructor(
    public readonly matchSeed: number,
    private readonly settings: WorldSettings = GameConfig.world,
    private readonly templates: RoomTemplateRegistry = RoomTemplateRegistry.createDefault(),
  ) {}

  /** Сторона пространства в клетках для номера `index`. */
  public sizeFor(index: number): number {
    const { initialSize, growthEvery, maxSize } = this.settings.space;
    return Math.min(maxSize, initialSize + Math.floor(index / growthEvery));
  }

  public seedFor(index: number): number {
    return SeedHasher.hash(this.matchSeed, 'space', index);
  }

  public generate(index: number): Space {
    if (!Number.isInteger(index) || index < 0) {
      throw new Error(`Некорректный номер пространства: ${index}`);
    }
    const seed = this.seedFor(index);
    const rng = new SeededRandom(seed);
    const size = this.sizeFor(index);
    const grid = new SpaceGrid(size, size, this.settings.cellSize);
    const layout = new RoomLayoutPlanner(size, size).plan(rng.fork('layout'));

    const startRng = rng.fork('start');
    const startCol = startRng.int(0, size - 1);
    const startRow = startRng.int(0, size - 1);
    const startRoomIndex = layout.ownerAt(startCol, startRow);

    const rooms = this.createRooms(index, grid, layout, startRoomIndex, rng);
    const roomId = (roomIndex: number): string => `${index}:${roomIndex}`;
    const doors = new DoorPlanner(this.settings.extraDoorChance)
      .plan(layout, rng.fork('doors'))
      .map(
        (planned) =>
          new Door(
            planned.edge,
            grid.edgeCenter(planned.edge),
            this.settings.doorWidth,
            roomId(Math.min(planned.roomA, planned.roomB)),
            roomId(Math.max(planned.roomA, planned.roomB)),
          ),
      );
    const walls = new WallBuilder(grid, this.settings.wallThickness, this.settings.doorWidth).build(
      layout,
      new Set(doors.map((door) => door.edge.key)),
    );

    const startCenter = grid.cellCenter(startCol, startRow);
    const offset = new Vector2(this.settings.cellSize / 5, 0);
    const startRoom = rooms[startRoomIndex];
    if (!startRoom) {
      throw new Error('Стартовая комната не найдена');
    }
    const exitRng = rng.fork('exit');
    const { exit, key } = new ExitPlanner().plan(
      ExitPlanner.kindFor(index, exitRng),
      grid,
      layout,
      rooms,
      doors,
      startRoom,
      exitRng,
    );

    return new Space(
      index,
      seed,
      grid,
      layout,
      rooms,
      walls,
      doors,
      SpacePalette.generate(rng.fork('palette')),
      startRoom,
      [startCenter.sub(offset), startCenter.add(offset)],
      this.startYaw(startCenter, startRoom, doors),
      exit,
      key,
      this.planEmptyOil(rooms, rng.fork('oil-empty')),
    );
  }

  /** Часть канистр — пустые обманки: издалека и в темноте их не отличить от полных. */
  private planEmptyOil(rooms: readonly Room[], rng: SeededRandom): boolean[] {
    return rooms
      .flatMap((room) => room.oilSpawns)
      .map(() => rng.chance(this.settings.oil.emptyShare));
  }

  /** Поворот, при котором игрок смотрит на ближайшую дверь стартовой комнаты (а не в стену). */
  private startYaw(from: Vector2, startRoom: Room, doors: readonly Door[]): number {
    const exits = doors.filter(
      (door) => door.roomA === startRoom.id || door.roomB === startRoom.id,
    );
    const nearest = exits.reduce<Door | null>(
      (best, door) =>
        !best || door.position.distanceTo(from) < best.position.distanceTo(from) ? door : best,
      null,
    );
    if (!nearest) {
      return 0;
    }
    return PlayerMovement.yawTowards(nearest.position.sub(from));
  }

  private createRooms(
    spaceIndex: number,
    grid: SpaceGrid,
    layout: RoomLayout,
    startRoomIndex: number,
    rng: SeededRandom,
  ): Room[] {
    return layout.rects.map((cells, index) => {
      const template = this.templates.select(cells);
      const bounds = grid.rectBounds(cells);
      const decoration = template.decorate({
        cells,
        bounds,
        grid,
        settings: this.settings,
        rng: rng.fork(`room:${index}`),
        spaceIndex,
        isStartRoom: index === startRoomIndex,
      });
      return new Room(
        `${spaceIndex}:${index}`,
        template.kind,
        cells,
        bounds,
        decoration.obstacles,
        decoration.oilSpawns,
      );
    });
  }
}
