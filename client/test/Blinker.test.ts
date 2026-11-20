import { describe, expect, it } from 'vitest';
import { Blinker } from '../src/game/Blinker.ts';

/** Детерминированный «случай» из заданной последовательности. */
const sequence = (...values: number[]) => {
  let i = 0;
  return () => values[i++ % values.length]!;
};

const STEP = 1 / 120;

describe('Blinker', () => {
  it('между морганиями глаза открыты, первое — через 2–6 с', () => {
    const blinker = new Blinker(sequence(0.5, 0.9)); // интервал 4 с, без двойного
    let firstClosed: number | null = null;
    for (let t = 0; t < 5; t += STEP) {
      if (blinker.update(STEP) < 1 && firstClosed === null) firstClosed = t;
    }
    expect(firstClosed).toBeGreaterThan(3.9);
    expect(firstClosed).toBeLessThan(4.1);
  });

  it('моргание короткое: закрываются полностью и открываются за ~0.17 с', () => {
    const blinker = new Blinker(sequence(0, 0.9)); // интервал 2 с
    for (let t = 0; t < 2 - STEP / 2; t += STEP) blinker.update(STEP);
    const values: number[] = [];
    for (let t = 0; t < 0.3; t += STEP) values.push(blinker.update(STEP));
    expect(Math.min(...values)).toBe(0);
    const closedFor = values.filter((v) => v < 1).length * STEP;
    expect(closedFor).toBeGreaterThan(0.12);
    expect(closedFor).toBeLessThan(Blinker.DURATION + 0.02);
    expect(values.at(-1)).toBe(1);
  });

  it('иногда моргает дважды подряд', () => {
    const blinker = new Blinker(sequence(0, 0.1, 0.9)); // интервал 2 с, затем двойное
    let blinks = 0;
    let wasOpen = true;
    for (let t = 0; t < 2.8; t += STEP) {
      const open = blinker.update(STEP) >= 1;
      if (wasOpen && !open) blinks++;
      wasOpen = open;
    }
    expect(blinks).toBe(2);
  });

  it('интервалы случайные, но всегда в пределах 2–6 с', () => {
    const blinker = new Blinker();
    const starts: number[] = [];
    let wasOpen = true;
    for (let t = 0; t < 120; t += STEP) {
      const open = blinker.update(STEP) >= 1;
      if (wasOpen && !open) starts.push(t);
      wasOpen = open;
    }
    const gaps = starts.slice(1).map((s, i) => s - starts[i]!);
    expect(gaps.length).toBeGreaterThan(15);
    // Двойное моргание даёт короткий промежуток; остальные — 2–6 с.
    for (const gap of gaps) {
      const isDouble = gap < 0.5;
      if (!isDouble) {
        expect(gap).toBeGreaterThan(Blinker.MIN_INTERVAL);
        expect(gap).toBeLessThan(Blinker.MAX_INTERVAL + Blinker.DURATION + 0.05);
      }
    }
  });
});
