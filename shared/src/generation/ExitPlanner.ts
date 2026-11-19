import { GameConfig } from '../config/GameConfig.ts';
import type { ExitSettings } from '../config/GameConfig.ts';
import { Vector2 } from '../math/Vector2.ts';
import type { SeededRandom } from '../random/SeededRandom.ts';
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
  /** Где лежит ключ; `null`, если дверь без ключа. */
  readonly key: Vector2 | null;
}

/**
 * Прячет дверь выхода и ключ.
 * Дверь — в одной из самых дальних от старта комнат (лучше тупиковой), на сплошной
 * стене. Ключ — в другой ветке лабиринта: не на кратчайшем пути от старта к двери,
 * но тоже далеко от старта.
 */
export class ExitPlanner {
  private static readonly KINDS: readonly ExitKind[] = ['plain', 'hidden', 'locked'];

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

    let key: Vector2 | null = null;
    if (kind === 'locked') {
      const path = new Set(graph.path(startRoom.id, exitRoom.id));
      const offPath = others.filter((room) => !path.has(room.id));
      const fallback = others.filter((room) => room !== exitRoom);
      const keyRoom =
        this.pickFarthest(offPath.length > 0 ? offPath : fallback, distanceOf, rng) ?? startRoom;
      const col = keyRoom.cells.col + rng.int(0, keyRoom.cells.width - 1);
      const row = keyRoom.cells.row + rng.int(0, keyRoom.cells.height - 1);
      key = grid.cellCenter(col, row);
    }
    return { exit, key };
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
