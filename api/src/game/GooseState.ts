import type { FloorSpot, GooseSnapshot, Vector2 } from '@light-keeper/shared';

/** Гусь-призрак текущего пространства: бегает, пойман или уже открыл дверь. */
export class GooseState {
  public position: Vector2;
  public floor: number;
  /** У кого гусь; `null` — бегает на свободе. */
  public holderId: string | null = null;
  /** Держатель уже взял гуся в руки (выбрал слот гуся); сменил слот — гусь вырвался. */
  public inHands = false;
  /** Сколько секунд пойманный гусь ждёт, пока его возьмут в руки, прежде чем вырваться. */
  public graceSeconds = 0;
  /** Сколько секунд вырвавшегося гуся нельзя поймать снова. */
  public slipperySeconds = 0;
  /** Гусем открыли дверь — его больше нет. */
  public gone = false;

  public constructor(spot: FloorSpot) {
    this.position = spot.position;
    this.floor = spot.floor;
  }

  public catchBy(playerId: string, graceSeconds: number): void {
    this.holderId = playerId;
    this.inHands = false;
    this.graceSeconds = graceSeconds;
  }

  /** Гусь вырвался из рук: снова на свободе и какое-то время не даётся. */
  public release(slipperySeconds: number): void {
    this.holderId = null;
    this.inHands = false;
    this.slipperySeconds = slipperySeconds;
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
