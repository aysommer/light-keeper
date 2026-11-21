import { describe, expect, it } from 'vitest';
import { SpaceGenerator, Vector2 } from '@light-keeper/shared';
import type { Space } from '@light-keeper/shared';
import { CanisterHint } from '../src/game/CanisterHint.ts';

/** Пространство, где есть и полная, и пустая канистры. */
const mixedSpace = (): Space => {
  for (let seed = 1; seed < 2000; seed++) {
    const space = new SpaceGenerator(seed).generate(0);
    const full = space.oilSpawns.some((_, i) => space.isOilFull(i));
    const empty = space.oilSpawns.some((_, i) => !space.isOilFull(i));
    if (full && empty) return space;
  }
  throw new Error('нет подходящего пространства');
};

describe('CanisterHint', () => {
  const hint = new CanisterHint();
  const space = mixedSpace();
  const emptyIndex = space.oilSpawns.findIndex((_, i) => !space.isOilFull(i));
  const fullIndex = space.oilSpawns.findIndex((_, i) => space.isOilFull(i));

  it('у пустой канистры — «Пустая канистра»', () => {
    expect(hint.resolve(space, [], [], space.oilSpawns[emptyIndex]!)).toBe('Пустая канистра');
  });

  it('у полной или вдали от канистр — без подсказки', () => {
    expect(hint.resolve(space, [], [], space.oilSpawns[fullIndex]!)).toBeNull();
    expect(hint.resolve(space, [], [], new Vector2(-50, -50))).toBeNull();
  });

  it('брошенная после заправки канистра тоже пустая', () => {
    const at = new Vector2(-30, -30);
    expect(hint.resolve(space, [], [{ x: at.x, y: at.y, floor: 0 }], at)).toBe('Пустая канистра');
  });
});
