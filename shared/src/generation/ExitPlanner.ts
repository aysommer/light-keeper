import { GameConfig } from '../config/GameConfig.ts';
import type { ExitSettings } from '../config/GameConfig.ts';
import { Vector2 } from '../math/Vector2.ts';
import type { SeededRandom } from '../random/SeededRandom.ts';
import { ExitCode } from './ExitCode.ts';
import type { Door } from './Door.ts';
import { ExitDoor } from './ExitDoor.ts';
import type { ExitKind } from './ExitDoor.ts';
import { GridEdge } from './GridEdge.ts';
import type { Room } from './Room.ts';
import { RoomGraph } from './RoomGraph.ts';
import type { RoomLayout } from './RoomLayout.ts';
import type { SpaceGrid } from './SpaceGrid.ts';

export interface ExitPlan {
  readonly exit: ExitDoor;
  /** Где лежат ключи (только у запертой двери; их 1–3). */
  readonly keys: readonly Vector2[];
  /** Где лежит записка с кодом (только у двери с панелью). */
  readonly note: Vector2 | null;
  /** Код двери с панелью. */
  readonly code: ExitCode | null;
}

/**
 * Прячет дверь выхода, ключи и записку с кодом.
 * Дверь — в одной из самых дальних от старта комнат (лучше тупиковой), на сплошной
 * стене. Ключи и записка — в других ветках лабиринта: не на кратчайшем пути от
 * старта к двери, но тоже далеко от старта; ключи — по возможности в разных комнатах.
 */
export class ExitPlanner {
  private static readonly KINDS: readonly ExitKind[] = ['plain', 'locked', 'code'];
  /** Сколько ключей бывает у запертой двери. */
  public static readonly MIN_KEYS = 1;
  public static readonly MAX_KEYS = 3;

  public constructor(private readonly settings: ExitSettings = GameConfig.exit) {}

  /** Первое пространство — всегда обычная дверь; дальше — случайно. */
  public static kindFor(spaceIndex: number, rng: SeededRandom): ExitKind {
    return spaceIndex === 0 ? 'plain' : rng.pick(ExitPlanner.KINDS);
  }

  public plan(
    kind: ExitKind,
    grid: SpaceGrid,
    layout: RoomLayout,
    rooms: readonly Room[],
    doors: readonly Door[],
    startRoom: Room,
    rng: SeededRandom,
  ): ExitPlan {
    const graph = new RoomGraph(rooms, doors);
    const distances = graph.distancesFrom(startRoom.id);
    const distanceOf = (room: Room): number => distances.get(room.id) ?? 0;

    const others = rooms.filter((room) => room !== startRoom);
    const deadEnds = others.filter((room) => graph.degree(room.id) === 1);
    const exitRoom =
      this.pickFarthest(deadEnds.length > 0 ? deadEnds : others, distanceOf, rng) ?? startRoom;
    const exit = this.placeDoor(kind, exitRoom, grid, layout, rooms, doors, rng);

    const path = new Set(graph.path(startRoom.id, exitRoom.id));
    const offPath = others.filter((room) => !path.has(room.id));
    const fallback = others.filter((room) => room !== exitRoom);
    const hidingRooms = offPath.length > 0 ? offPath : fallback;

    if (kind === 'locked') {
      const count = rng.int(ExitPlanner.MIN_KEYS, ExitPlanner.MAX_KEYS);
      return {
        exit,
        keys: this.hide(count, hidingRooms, grid, distanceOf, rng, startRoom),
        note: null,
        code: null,
      };
    }
    if (kind === 'code') {
      const [note] = this.hide(1, hidingRooms, grid, distanceOf, rng, startRoom);
      return { exit, keys: [], note: note ?? null, code: ExitCode.generate(rng) };
    }
    return { exit, keys: [], note: null, code: null };
  }

  /**
   * Прячет `count` предметов в дальних комнатах-кандидатах — по возможности в разных,
   * и всегда в разных клетках.
   */
  private hide(
    count: number,
    candidates: readonly Room[],
    grid: SpaceGrid,
    distanceOf: (room: Room) => number,
    rng: SeededRandom,
    startRoom: Room,
  ): Vector2[] {
    const spots: Vector2[] = [];
    const usedCells = new Set<string>();
    let pool = [...candidates];
    for (let i = 0; i < count; i++) {
      if (pool.length === 0) pool = [...candidates];
      const room = this.pickFarthest(pool, distanceOf, rng) ?? startRoom;
      pool = pool.filter((candidate) => candidate !== room);
      for (let attempt = 0; attempt < 12; attempt++) {
        const col = room.cells.col + rng.int(0, room.cells.width - 1);
        const row = room.cells.row + rng.int(0, room.cells.height - 1);
        const cell = `${col}:${row}`;
        if (!usedCells.has(cell) || attempt === 11) {
          usedCells.add(cell);
          spots.push(grid.cellCenter(col, row));
          break;
        }
      }
    }
    return spots;
  }

  /** Случайная комната среди самой дальней доли кандидатов. */
  private pickFarthest(
    candidates: readonly Room[],
    distanceOf: (room: Room) => number,
    rng: SeededRandom,
  ): Room | null {
    if (candidates.length === 0) {
      return null;
    }
    const sorted = [...candidates].sort((a, b) => distanceOf(b) - distanceOf(a));
    const count = Math.max(1, Math.ceil(sorted.length * this.settings.farthestShare));
    return rng.pick(sorted.slice(0, count));
  }

  /** Дверь — на случайном сплошном ребре комнаты (без проёма). */
  private placeDoor(
    kind: ExitKind,
    room: Room,
    grid: SpaceGrid,
    layout: RoomLayout,
    rooms: readonly Room[],
    doors: readonly Door[],
    rng: SeededRandom,
  ): ExitDoor {
    const roomIndex = rooms.indexOf(room);
    const doorways = new Set(doors.map((door) => door.edge.key));
    const candidates: Array<{ edge: GridEdge; normal: Vector2 }> = [];
    const { col, row, width, height } = room.cells;
    for (let r = row; r < row + height; r++) {
      for (let c = col; c < col + width; c++) {
        const sides = [
          { edge: GridEdge.horizontal(c, r), neighbour: [c, r - 1], normal: new Vector2(0, 1) },
          {
            edge: GridEdge.horizontal(c, r + 1),
            neighbour: [c, r + 1],
            normal: new Vector2(0, -1),
          },
          { edge: GridEdge.vertical(c, r), neighbour: [c - 1, r], normal: new Vector2(1, 0) },
          { edge: GridEdge.vertical(c + 1, r), neighbour: [c + 1, r], normal: new Vector2(-1, 0) },
        ] as const;
        for (const side of sides) {
          const isWall = layout.ownerAt(side.neighbour[0], side.neighbour[1]) !== roomIndex;
          if (isWall && !doorways.has(side.edge.key)) {
            candidates.push({ edge: side.edge, normal: side.normal });
          }
        }
      }
    }
    const chosen = rng.pick(candidates);
    return new ExitDoor(kind, chosen.edge, grid.edgeCenter(chosen.edge), chosen.normal, room.id);
  }
}
