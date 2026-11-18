import type { SeededRandom } from '../random/SeededRandom.ts';
import { DisjointSet } from '../util/DisjointSet.ts';
import { GridEdge } from './GridEdge.ts';
import type { RoomLayout } from './RoomLayout.ts';

/** Запланированная дверь между двумя комнатами чанка. */
export interface PlannedDoor {
  readonly edge: GridEdge;
  readonly roomA: number;
  readonly roomB: number;
}

interface RoomAdjacency {
  readonly roomA: number;
  readonly roomB: number;
  readonly edges: GridEdge[];
}

/**
 * Расставляет двери между комнатами чанка.
 * Строит случайное остовное дерево графа смежности комнат (алгоритм Краскала),
 * поэтому все комнаты гарантированно связаны. Затем с вероятностью
 * `extraDoorChance` добавляет лишние двери — они создают петли.
 */
export class DoorPlanner {
  public constructor(private readonly extraDoorChance: number) {}

  public plan(layout: RoomLayout, rng: SeededRandom): PlannedDoor[] {
    const adjacencies = rng.shuffle([...this.collectAdjacencies(layout).values()]);
    const sets = new DisjointSet(layout.rects.length);
    const doors: PlannedDoor[] = [];

    for (const adjacency of adjacencies) {
      const isTreeEdge = sets.union(adjacency.roomA, adjacency.roomB);
      if (isTreeEdge || rng.chance(this.extraDoorChance)) {
        doors.push({
          edge: rng.pick(adjacency.edges),
          roomA: adjacency.roomA,
          roomB: adjacency.roomB,
        });
      }
    }
    return doors;
  }

  private collectAdjacencies(layout: RoomLayout): Map<string, RoomAdjacency> {
    const adjacencies = new Map<string, RoomAdjacency>();
    const register = (a: number, b: number, edge: GridEdge): void => {
      if (a === b || a < 0 || b < 0) {
        return;
      }
      const [roomA, roomB] = a < b ? [a, b] : [b, a];
      const key = `${roomA}|${roomB}`;
      let adjacency = adjacencies.get(key);
      if (!adjacency) {
        adjacency = { roomA, roomB, edges: [] };
        adjacencies.set(key, adjacency);
      }
      adjacency.edges.push(edge);
    };

    for (let row = 0; row < layout.rows; row++) {
      for (let col = 0; col < layout.columns; col++) {
        const owner = layout.ownerAt(col, row);
        if (col + 1 < layout.columns) {
          register(owner, layout.ownerAt(col + 1, row), GridEdge.vertical(col + 1, row));
        }
        if (row + 1 < layout.rows) {
          register(owner, layout.ownerAt(col, row + 1), GridEdge.horizontal(col, row + 1));
        }
      }
    }
    return adjacencies;
  }
}
