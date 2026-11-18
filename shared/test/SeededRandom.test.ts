import { describe, expect, it } from 'vitest';
import { SeededRandom, SeedHasher } from '../src/index.ts';

const sample = (rng: SeededRandom, count: number): number[] =>
  Array.from({ length: count }, () => rng.next());

describe('SeededRandom', () => {
  it('одинаковый seed даёт одинаковую последовательность', () => {
    expect(sample(new SeededRandom(42), 100)).toEqual(sample(new SeededRandom(42), 100));
  });

  it('разные seed дают разные последовательности', () => {
    expect(sample(new SeededRandom(1), 10)).not.toEqual(sample(new SeededRandom(2), 10));
  });

  it('next() в диапазоне [0, 1)', () => {
    for (const value of sample(new SeededRandom(7), 10_000)) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  it('int() покрывает обе границы включительно', () => {
    const rng = new SeededRandom(3);
    const seen = new Set(Array.from({ length: 1000 }, () => rng.int(2, 5)));
    expect([...seen].sort()).toEqual([2, 3, 4, 5]);
  });

  it('int() отклоняет некорректный диапазон', () => {
    expect(() => new SeededRandom(1).int(5, 2)).toThrow();
  });

  it('shuffle() возвращает перестановку и не меняет исходный массив', () => {
    const source = [1, 2, 3, 4, 5, 6, 7, 8];
    const shuffled = new SeededRandom(9).shuffle(source);
    expect(source).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect([...shuffled].sort()).toEqual(source);
  });

  it('weightedShuffle() чаще ставит вперёд тяжёлые элементы', () => {
    const rng = new SeededRandom(11);
    let heavyFirst = 0;
    for (let i = 0; i < 1000; i++) {
      const [first] = rng.weightedShuffle(['light', 'heavy'], (item) => (item === 'heavy' ? 9 : 1));
      if (first === 'heavy') heavyFirst++;
    }
    expect(heavyFirst).toBeGreaterThan(850);
  });

  it('fork() не зависит от уже извлечённых чисел', () => {
    const a = new SeededRandom(5);
    const b = new SeededRandom(5);
    sample(b, 50);
    expect(sample(a.fork('x'), 10)).toEqual(sample(b.fork('x'), 10));
    expect(sample(a.fork('x'), 10)).not.toEqual(sample(a.fork('y'), 10));
  });
});

describe('SeedHasher', () => {
  it('стабилен и чувствителен к частям и их типам', () => {
    expect(SeedHasher.hash(1, 'chunk', 2)).toBe(SeedHasher.hash(1, 'chunk', 2));
    expect(SeedHasher.hash(1, 'chunk', 2)).not.toBe(SeedHasher.hash(1, 'chunk', 3));
    expect(SeedHasher.hash(1, 'chunk', 2)).not.toBe(SeedHasher.hash(1, 'chunk', '2'));
  });

  it('возвращает беззнаковое 32-битное целое', () => {
    const hash = SeedHasher.hash('anything');
    expect(Number.isInteger(hash)).toBe(true);
    expect(hash).toBeGreaterThanOrEqual(0);
    expect(hash).toBeLessThan(2 ** 32);
  });
});
