/** Какие канистры текущего пространства уже подобраны (индексы в `Space.oilSpawns`). */
export class OilState {
  private readonly taken = new Set<number>();

  public isTaken(index: number): boolean {
    return this.taken.has(index);
  }

  public take(index: number): void {
    this.taken.add(index);
  }

  public snapshot(): number[] {
    return [...this.taken].sort((a, b) => a - b);
  }
}
