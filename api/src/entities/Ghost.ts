import type { GhostSnapshot, Vector2 } from '@light-keeper/shared';

/** Привидение: идёт к игрокам по лабиринту, боится света, в свете растворяется. */
export class Ghost {
  /** Сколько секунд пробыло в свете (медленно спадает в темноте). */
  public exposure = 0;
  /** Сколько осталось растворяться; `null` — ещё не растворяется. */
  public fadeLeft: number | null = null;

  public constructor(
    public readonly id: number,
    public position: Vector2,
  ) {}

  public get fading(): boolean {
    return this.fadeLeft !== null;
  }

  public snapshot(): GhostSnapshot {
    return {
      id: this.id,
      x: Math.round(this.position.x * 100) / 100,
      y: Math.round(this.position.y * 100) / 100,
      fading: this.fading,
    };
  }
}
