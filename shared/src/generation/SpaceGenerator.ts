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
import { SpaceFloor } from './SpaceFloor.ts';
import { Stair } from './Stair.ts';
import { RoomGraph } from './RoomGraph.ts';
import { WaySign } from './WaySign.ts';
import type { WaySignTarget } from './WaySign.ts';
import { GridEdge } from './GridEdge.ts';
import type { AABB } from '../math/AABB.ts';
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

    const floorCount = this.floorCountFor(index, rng.fork('floors'));
    // Раскладки этажей и их проёмы — заранее: лестница не должна упираться в проём.
    const floorRngs = Array.from({ length: floorCount }, (_, floor) =>
      floor === 0 ? rng : rng.fork(`floor:${floor}`),
    );
    const layouts = floorRngs.map((floorRng, floor) =>
      floor === 0 ? layout : new RoomLayoutPlanner(size, size).plan(floorRng.fork('layout')),
    );
    const doorEdges = layouts.map(
      (floorLayout, floor) =>
        new Set(
          new DoorPlanner(this.settings.extraDoorChance)
            .plan(floorLayout, floorRngs[floor]!.fork('doors'))
            .map((door) => door.edge.key),
        ),
    );
    const stairs = this.planStairs(
      floorCount,
      size,
      grid,
      [startCol, startRow],
      doorEdges,
      rng.fork('stairs'),
    );
    const stairCells = stairs.map((stair) => grid.cellAt(stair.position));
    const stairCellsOf = (floor: number): Array<[number, number]> =>
      stairCells.filter((_, lower) => lower === floor || lower === floor - 1);
    const blocksOf = (floor: number) =>
      stairs.filter((stair) => stair.targetFrom(floor) !== null).map((stair) => stair.block());

    const floors = layouts.map((floorLayout, floor) =>
      this.buildFloor(
        floor,
        index,
        grid,
        floorLayout,
        floor === 0 ? startRoomIndex : -1,
        floorRngs[floor]!,
        stairCellsOf(floor),
        blocksOf(floor),
      ),
    );
    const ground = floors[0]!;

    const startCenter = grid.cellCenter(startCol, startRow);
    const offset = new Vector2(this.settings.cellSize / 5, 0);
    const startRoom = ground.rooms[startRoomIndex];
    if (!startRoom) {
      throw new Error('Стартовая комната не найдена');
    }
    // Дверь — на верхнем этаже (в одноэтажном — на первом): чтобы выйти, нужно подняться.
    const exitFloor = floorCount - 1;
    const top = floors[exitFloor]!;
    const arrival =
      exitFloor === 0 ? startRoom : (top.roomAt(stairs[exitFloor - 1]!.position) ?? top.rooms[0]!);
    const exitRng = rng.fork('exit');
    const plan = new ExitPlanner().plan(
      ExitPlanner.kindFor(index, exitRng),
      grid,
      top.layout,
      top.rooms,
      top.doors,
      arrival,
      exitRng,
    );
    // Ключи и записка в многоэтажном пространстве — на случайных этажах.
    const scatter = this.scatter(floors, stairCells, grid, rng.fork('scatter'));
    const keyFloors = plan.keys.map(() => exitFloor);
    const keys = plan.keys.map((key, i) => {
      const moved = scatter(exitFloor);
      if (moved) keyFloors[i] = moved.floor;
      return moved?.position ?? key;
    });
    let note = plan.note;
    let noteFloor = exitFloor;
    if (note) {
      const moved = scatter(exitFloor);
      if (moved) {
        note = moved.position;
        noteFloor = moved.floor;
      }
    }

    return new Space(
      index,
      seed,
      grid,
      floors,
      SpacePalette.generate(rng.fork('palette')),
      startRoom,
      [startCenter.sub(offset), startCenter.add(offset)],
      this.startYaw(startCenter, startRoom, ground.doors),
      plan.exit,
      exitFloor,
      keys,
      keyFloors,
      note,
      noteFloor,
      plan.code,
      // Код из цифр иногда не в записке, а на магнитофоне, который его повторяет.
      plan.code?.alphabet === 'digits' && rng.fork('code-hint').chance(0.5) ? 'tape' : 'note',
      stairs,
      this.planSign(
        ground,
        startRoom,
        startCenter,
        floorCount > 1 ? stairs[0]!.position : plan.exit.position,
        floorCount > 1 ? 'stairs' : 'exit',
        grid,
        floorCount > 1 ? null : plan.exit.roomId,
      ),
      this.planEmptyOil(
        floors.flatMap((floor) => floor.rooms),
        rng.fork('oil-empty'),
      ),
    );
  }

  /**
   * Лестницы: по одной между соседними этажами, в разных клетках, не в клетке
   * старта. Пролёт идёт к стороне клетки без проёма на обоих этажах — так он
   * не упирается в проём и целиком остаётся в клетке.
   */
  private planStairs(
    floorCount: number,
    size: number,
    grid: SpaceGrid,
    start: readonly [number, number],
    doorEdges: ReadonlyArray<ReadonlySet<string>>,
    rng: SeededRandom,
  ): Stair[] {
    const stairs: Stair[] = [];
    const used = new Set<string>([`${start[0]}:${start[1]}`]);
    for (let lower = 0; lower < floorCount - 1; lower++) {
      let fallback: Stair | null = null;
      for (let attempt = 0; attempt < 200; attempt++) {
        const col = rng.int(0, size - 1);
        const row = rng.int(0, size - 1);
        if (used.has(`${col}:${row}`)) continue;
        const sides = [
          { direction: new Vector2(1, 0), edge: GridEdge.vertical(col + 1, row) },
          { direction: new Vector2(-1, 0), edge: GridEdge.vertical(col, row) },
          { direction: new Vector2(0, 1), edge: GridEdge.horizontal(col, row + 1) },
          { direction: new Vector2(0, -1), edge: GridEdge.horizontal(col, row) },
        ];
        const free = sides.filter(
          (side) =>
            !doorEdges[lower]!.has(side.edge.key) && !doorEdges[lower + 1]!.has(side.edge.key),
        );
        const position = grid.cellCenter(col, row);
        fallback ??= new Stair(lower, position, sides[0]!.direction);
        const side = free.length > 0 ? rng.pick(free) : null;
        if (side) {
          used.add(`${col}:${row}`);
          fallback = null;
          stairs.push(new Stair(lower, position, side.direction));
          break;
        }
      }
      if (fallback) stairs.push(fallback);
    }
    return stairs;
  }

  /**
   * Табличка в стартовой комнате: стрелка к проёму, через который короче всего
   * идти к цели (по графу комнат), или прямо к цели, если она в этой же комнате.
   * Висит на той стене, вдоль которой это направление читается лучше всего,
   * на сплошном участке (не в проёме), ближе к старту.
   */
  private planSign(
    ground: SpaceFloor,
    startRoom: Room,
    from: Vector2,
    target: Vector2,
    kind: WaySignTarget,
    grid: SpaceGrid,
    targetRoomId: string | null = null,
  ): WaySign | null {
    const graph = new RoomGraph(ground.rooms, ground.doors);
    const targetId = targetRoomId ?? ground.roomAt(target)?.id ?? startRoom.id;
    const path = graph.path(startRoom.id, targetId);
    const doorBetween = (a: string, b: string) =>
      ground.doors.find(
        (d) => (d.roomA === a && d.roomB === b) || (d.roomB === a && d.roomA === b),
      );
    // Вешаем в стартовой комнате; если там нет сплошной стены — в следующей по пути.
    let here = from;
    for (let step = 0; step < Math.max(1, path.length); step++) {
      const roomId = path[step] ?? startRoom.id;
      const room = ground.rooms.find((r) => r.id === roomId) ?? startRoom;
      const next = path[step + 1];
      const door = next ? doorBetween(roomId, next) : undefined;
      const sign = this.signIn(
        ground,
        room,
        here,
        (door ? door.position : target).sub(here),
        kind,
        grid,
      );
      if (sign) return sign;
      if (!door) break;
      here = door.position;
    }
    return null;
  }

  /** Табличка в комнате: на стене, вдоль которой направление читается лучше, на сплошном участке. */
  private signIn(
    ground: SpaceFloor,
    room: Room,
    from: Vector2,
    direction: Vector2,
    kind: WaySignTarget,
    grid: SpaceGrid,
  ): WaySign | null {
    if (direction.length() < 1e-6) {
      return null;
    }
    const way = direction.normalize();
    const { col, row, width, height } = room.cells;
    const doorways = new Set(ground.doors.map((d) => d.edge.key));
    const sides = [
      {
        normal: new Vector2(0, -1),
        edges: Array.from({ length: width }, (_, i) => GridEdge.horizontal(col + i, row + height)),
      },
      {
        normal: new Vector2(0, 1),
        edges: Array.from({ length: width }, (_, i) => GridEdge.horizontal(col + i, row)),
      },
      {
        normal: new Vector2(1, 0),
        edges: Array.from({ length: height }, (_, i) => GridEdge.vertical(col, row + i)),
      },
      {
        normal: new Vector2(-1, 0),
        edges: Array.from({ length: height }, (_, i) => GridEdge.vertical(col + width, row + i)),
      },
    ];
    const along = (n: Vector2) => Math.abs(way.x * -n.y + way.y * n.x);
    const ranked = [...sides].sort((a, b) => along(b.normal) - along(a.normal));
    for (const side of ranked) {
      const spot = side.edges
        .filter((edge) => !doorways.has(edge.key))
        .map((edge) => grid.edgeCenter(edge))
        .sort((a, b) => a.distanceTo(from) - b.distanceTo(from))[0];
      if (!spot) continue;
      const half = this.settings.wallThickness / 2;
      // Смотрящий на табличку стоит лицом к стене: вперёд = −нормаль, вправо = (f.y, −f.x).
      const facing = side.normal.scale(-1);
      const right = new Vector2(facing.y, -facing.x);
      const arrow = way.x * right.x + way.y * right.y >= 0 ? 'right' : 'left';
      return new WaySign(spot.add(side.normal.scale(half + 0.01)), side.normal, arrow, kind);
    }
    return null;
  }

  /** Сколько этажей: первое пространство — один, дальше иногда два или три. */
  private floorCountFor(index: number, rng: SeededRandom): number {
    if (index === 0) {
      return 1;
    }
    const { twoFloors, threeFloors } = this.settings.floors;
    const roll = rng.next();
    return roll < threeFloors ? 3 : roll < threeFloors + twoFloors ? 2 : 1;
  }

  /** Этаж: комнаты, проёмы, стены; клетки лестниц свободны от мебели и канистр. */
  private buildFloor(
    floor: number,
    index: number,
    grid: SpaceGrid,
    layout: RoomLayout,
    startRoomIndex: number,
    rng: SeededRandom,
    stairCells: ReadonlyArray<[number, number]>,
    blocks: readonly AABB[] = [],
  ): SpaceFloor {
    const prefix = floor === 0 ? `${index}` : `${index}:f${floor}`;
    const stairAreas = stairCells.map(([col, row]) => grid.cellBounds(col, row));
    const rooms = this.createRooms(index, prefix, grid, layout, startRoomIndex, rng).map((room) =>
      stairAreas.length === 0
        ? room
        : new Room(
            room.id,
            room.kind,
            room.cells,
            room.bounds,
            room.obstacles.filter((o) => !stairAreas.some((area) => area.intersects(o.bounds))),
            room.oilSpawns.filter((p) => !stairAreas.some((area) => area.containsPoint(p))),
          ),
    );
    const roomId = (roomIndex: number): string => `${prefix}:${roomIndex}`;
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
    return new SpaceFloor(floor, layout, rooms, walls, doors, blocks);
  }

  /**
   * Перенос предмета на случайный этаж (в одноэтажном — ничего не делает):
   * случайная клетка случайной комнаты, не клетка лестницы.
   */
  private scatter(
    floors: readonly SpaceFloor[],
    stairCells: ReadonlyArray<[number, number]>,
    grid: SpaceGrid,
    rng: SeededRandom,
  ): (planned: number) => { floor: number; position: Vector2 } | null {
    const used = new Set(stairCells.map(([c, r]) => `${c}:${r}`));
    return (planned) => {
      if (floors.length === 1) {
        return null;
      }
      const floor = rng.int(0, floors.length - 1);
      if (floor === planned) {
        return null;
      }
      const target = floors[floor]!;
      for (let attempt = 0; attempt < 20; attempt++) {
        const room = rng.pick(target.rooms);
        const col = room.cells.col + rng.int(0, room.cells.width - 1);
        const row = room.cells.row + rng.int(0, room.cells.height - 1);
        const point = grid.cellCenter(col, row);
        if (
          used.has(`${col}:${row}`) ||
          target.obstacles.some((o) => o.bounds.containsPoint(point))
        ) {
          continue;
        }
        used.add(`${col}:${row}`);
        return { floor, position: point };
      }
      return null;
    };
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
    idPrefix: string,
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
        `${idPrefix}:${index}`,
        template.kind,
        cells,
        bounds,
        decoration.obstacles,
        decoration.oilSpawns,
      );
    });
  }
}
