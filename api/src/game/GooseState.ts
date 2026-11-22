import type { FloorSpot, GooseSnapshot, Vector2 } from '@light-keeper/shared';

/** Гусь-призрак текущего пространства: бегает, пойман или уже открыл дверь. */
export class GooseState {
  public position: Vector2;
  public floor: number;
  /** У кого гусь; `null` — бегает на свободе. */
  public holderId: string | null = null;
  /** Гусем открыли дверь — его больше нет. */
  public gone = false;

  public constructor(spot: FloorSpot) {
    this.position = spot.position;
    this.floor = spot.floor;
  }

  public snapshot(): GooseSnapshot | null {
    return this.gone
      ? null
      : {
          x: Math.round(this.position.x * 100) / 100,
          y: Math.round(this.position.y * 100) / 100,
          floor: this.floor,
          holderId: this.holderId,
        };
  }
}
