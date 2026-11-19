import type { Door } from './Door.ts';
import type { Room } from './Room.ts';

/** Граф комнат пространства: вершины — комнаты, рёбра — проёмы между ними. */
export class RoomGraph {
  private readonly neighbours = new Map<string, Set<string>>();

  public constructor(rooms: readonly Room[], doors: readonly Door[]) {
    rooms.forEach((room) => this.neighbours.set(room.id, new Set()));
    for (const door of doors) {
      this.neighbours.get(door.roomA)?.add(door.roomB);
      this.neighbours.get(door.roomB)?.add(door.roomA);
    }
  }

  public degree(roomId: string): number {
    return this.neighbours.get(roomId)?.size ?? 0;
  }

  /** Расстояние в переходах от `startId` до каждой достижимой комнаты (поиск в ширину). */
  public distancesFrom(startId: string): Map<string, number> {
    return this.search(startId).distances;
  }

  /** Комнаты кратчайшего пути от `fromId` до `toId` включительно; пусто, если пути нет. */
  public path(fromId: string, toId: string): string[] {
    const { parents, distances } = this.search(fromId);
    if (!distances.has(toId)) {
      return [];
    }
    const path: string[] = [];
    for (
      let current: string | undefined = toId;
      current !== undefined;
      current = parents.get(current)
    ) {
      path.unshift(current);
    }
    return path;
  }

  private search(startId: string): {
    distances: Map<string, number>;
    parents: Map<string, string>;
  } {
    const distances = new Map<string, number>([[startId, 0]]);
    const parents = new Map<string, string>();
    const queue = [startId];
    for (let head = 0; head < queue.length; head++) {
      const current = queue[head]!;
      const distance = distances.get(current)!;
      for (const next of this.neighbours.get(current) ?? []) {
        if (!distances.has(next)) {
          distances.set(next, distance + 1);
          parents.set(next, current);
          queue.push(next);
        }
      }
    }
    return { distances, parents };
  }
}
