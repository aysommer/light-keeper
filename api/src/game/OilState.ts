import type { DroppedCanister, Vector2 } from '@light-keeper/shared';

/**
 * Канистры текущего пространства: какие уже подобраны (индексы в
 * `Space.oilSpawns`) и где лежат пустые, брошенные после заправки.
 */
export class OilState {
  private readonly taken = new Set<number>();
  private readonly dropped: Array<{ position: Vector2; floor: number }> = [];

  public isTaken(index: number): boolean {
    return this.taken.has(index);
  }

  public take(index: number): void {
    this.taken.add(index);
  }

  /** Бросить пустую канистру — она остаётся лежать серой обманкой. */
  public drop(position: Vector2, floor: number): void {
    this.dropped.push({ position, floor });
  }

  public get droppedCanisters(): ReadonlyArray<{ position: Vector2; floor: number }> {
    return this.dropped;
  }

  public snapshot(): number[] {
    return [...this.taken].sort((a, b) => a - b);
  }

  public droppedSnapshot(): DroppedCanister[] {
    return this.dropped.map(({ position, floor }) => ({
      x: Math.round(position.x * 100) / 100,
      y: Math.round(position.y * 100) / 100,
      floor,
    }));
  }
}
