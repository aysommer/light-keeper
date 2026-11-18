import { SeedHasher } from './SeedHasher.ts';

/**
 * Детерминированный генератор псевдослучайных чисел (mulberry32).
 * Одинаковый seed на клиенте и сервере даёт одинаковую последовательность.
 */
export class SeededRandom {
  private state: number;

  public constructor(public readonly seed: number) {
    this.state = seed >>> 0;
  }

  /** Число в диапазоне [0, 1). */
  public next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Число в диапазоне [min, max). */
  public float(min: number, max: number): number {
    return min + (max - min) * this.next();
  }

  /** Целое в диапазоне [min, max] включительно. */
  public int(min: number, max: number): number {
    if (!Number.isInteger(min) || !Number.isInteger(max) || min > max) {
      throw new Error(`Некорректный диапазон int(${min}, ${max})`);
    }
    return min + Math.floor(this.next() * (max - min + 1));
  }

  public chance(probability: number): boolean {
    return this.next() < probability;
  }

  public pick<T>(items: readonly T[]): T {
    if (items.length === 0) {
      throw new Error('pick() из пустого массива');
    }
    return items[this.int(0, items.length - 1)] as T;
  }

  /** Перемешанная копия массива (Фишер — Йетс). */
  public shuffle<T>(items: readonly T[]): T[] {
    const result = [...items];
    for (let i = result.length - 1; i > 0; i--) {
      const j = this.int(0, i);
      [result[i], result[j]] = [result[j] as T, result[i] as T];
    }
    return result;
  }

  /**
   * Перемешанная копия, где элементы с большим весом чаще оказываются впереди
   * (алгоритм Эфраимидиса — Спиракиса).
   */
  public weightedShuffle<T>(items: readonly T[], weightOf: (item: T) => number): T[] {
    return items
      .map((item) => {
        const weight = weightOf(item);
        const key = weight > 0 ? Math.pow(this.next(), 1 / weight) : -1;
        return { item, key };
      })
      .sort((a, b) => b.key - a.key)
      .map((entry) => entry.item);
  }

  /**
   * Независимый дочерний генератор. Зависит только от исходного seed и соли,
   * а не от того, сколько чисел уже извлечено из текущего генератора.
   */
  public fork(salt: string | number): SeededRandom {
    return new SeededRandom(SeedHasher.hash(this.seed, salt));
  }
}
