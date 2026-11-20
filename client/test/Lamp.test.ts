import { describe, expect, it } from 'vitest';
import { GameConfig } from '@light-keeper/shared';
import type { LampSnapshot } from '@light-keeper/shared';
import { LampFlame } from '../src/game/LampFlame.ts';
import { LampHint } from '../src/game/LampHint.ts';

const lamp = (overrides: Partial<LampSnapshot> = {}): LampSnapshot => ({
  oil: 100,
  heat: 0,
  lit: true,
  overheated: false,
  ...overrides,
});

const samples = (brightness: number): number[] =>
  Array.from({ length: 400 }, (_, i) => LampFlame.level(i * 0.013, brightness));

describe('LampFlame', () => {
  it('погасшая лампа не светит', () => {
    expect(LampFlame.level(1.23, 0)).toBe(0);
  });

  it('полная лампа дрожит слабо, на исходе масла — сильно', () => {
    const spread = (values: number[]): number => Math.max(...values) - Math.min(...values);
    const full = samples(1);
    const low = samples(0.3);
    expect(spread(full)).toBeLessThan(0.1);
    expect(spread(low) / 0.3).toBeGreaterThan(spread(full) * 3);
    expect(Math.min(...low)).toBeGreaterThanOrEqual(0);
  });

  it('нагрев виден на фонаре только после 40 %', () => {
    expect(LampFlame.heatGlow(30)).toBe(0);
    expect(LampFlame.heatGlow(70)).toBeCloseTo(0.5);
    expect(LampFlame.heatGlow(100)).toBe(1);
  });
});

describe('LampHint', () => {
  const hint = new LampHint();
  const { warningHeat, lowOil } = GameConfig.lamp;

  it('без проблем — без подсказки', () => {
    expect(hint.resolve(lamp(), 'lamp', false)).toBeNull();
    expect(hint.resolve(null, 'lamp', false)).toBeNull();
  });

  it('перегрев близко — убрать лампу; перегрелась — остывает', () => {
    expect(hint.resolve(lamp({ heat: warningHeat }), 'lamp', false)).toBe(
      'Лампа перегревается — передай напарнику (E) или убери (2)',
    );
    expect(hint.resolve(lamp({ heat: 100, lit: false, overheated: true }), 'lamp', false)).toBe(
      'Лампа перегрелась и остывает',
    );
  });

  it('убранная горячая лампа не требует подсказки «убери»', () => {
    expect(hint.resolve(lamp({ heat: 90 }), 'compass', false)).toBeNull();
  });

  it('масло на исходе и кончилось', () => {
    expect(hint.resolve(lamp({ oil: lowOil - 1 }), 'lamp', false)).toBe('Масло на исходе');
    expect(hint.resolve(lamp({ oil: 0, lit: false }), 'compass', false)).toBe('Масло кончилось');
  });

  it('в тамбуре подсказок нет', () => {
    expect(hint.resolve(lamp({ heat: 99 }), 'lamp', true)).toBeNull();
  });
});
