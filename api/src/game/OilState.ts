import type { DroppedCanister, Vector2 } from '@light-keeper/shared';

/**
 * Канистры текущего пространства: какие уже подобраны (индексы в
 * `Space.oilSpawns`) и где лежат пустые, брошенные после заправки.
 */
export class OilState {
  private readonly taken = new Set<number>();
  private readonly dropped: Vector2[] = [];

  public isTaken(index: number): boolean {
    return this.taken.has(index);
  }

  public take(index: number): void {
    this.taken.add(index);
  }

  /** Бросить пустую канистру — она остаётся лежать серой обманкой. */
  public drop(position: Vector2): void {
    this.dropped.push(position);
  }

  public get droppedCanisters(): readonly Vector2[] {
    return this.dropped;
  }

  public snapshot(): number[] {
    return [...this.taken].sort((a, b) => a - b);
  }

  public droppedSnapshot(): DroppedCanister[] {
    return this.dropped.map((p) => ({
      x: Math.round(p.x * 100) / 100,
      y: Math.round(p.y * 100) / 100,
    }));
  }
}
