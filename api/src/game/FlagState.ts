import type { FlagSnapshot, FloorSpot, Vector2 } from '@light-keeper/shared';

interface Flag {
  readonly id: number;
  position: Vector2;
  floor: number;
  /** У кого флажок; `null` — стоит на полу. */
  holderId: string | null;
}

/** Флажки-ориентиры текущего пространства: какие стоят на полу, какие у игроков. */
export class FlagState {
  public readonly flags: Flag[];

  public constructor(spawns: readonly FloorSpot[]) {
    this.flags = spawns.map((spot, id) => ({
      id,
      position: spot.position,
      floor: spot.floor,
      holderId: null,
    }));
  }

  /** Сколько флажков у игрока. */
  public carriedBy(playerId: string): number {
    return this.flags.filter((flag) => flag.holderId === playerId).length;
  }

  public snapshot(): FlagSnapshot[] {
    return this.flags.map((flag) => ({
      id: flag.id,
      x: Math.round(flag.position.x * 100) / 100,
      y: Math.round(flag.position.y * 100) / 100,
      floor: flag.floor,
      holderId: flag.holderId,
    }));
  }
}
