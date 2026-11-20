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

  it('с канистрой подсказка зовёт заправиться; во время заправки — «Заправка…»', () => {
    const supply = { canisters: 1, refueling: false };
    expect(hint.resolve(lamp({ oil: lowOil - 1 }), 'lamp', false, supply)).toBe(
      'Масло на исходе — удерживай R',
    );
    expect(hint.resolve(lamp({ oil: 0, lit: false }), 'lamp', false, supply)).toBe(
      'Масло кончилось — удерживай R',
    );
    expect(hint.resolve(lamp({ oil: 50 }), 'lamp', false, { canisters: 1, refueling: true })).toBe(
      'Заправка…',
    );
  });

  it('в тамбуре подсказок нет', () => {
    expect(hint.resolve(lamp({ heat: 99 }), 'lamp', true)).toBeNull();
  });
});

describe('LampHint: лампа у напарника', () => {
  const hint = new LampHint();
  const lamp = (over: Partial<LampSnapshot> = {}): LampSnapshot => ({
    oil: 80,
    heat: 20,
    lit: true,
    overheated: false,
    ...over,
  });

  it('напарник перегревает лампу — пора её взять', () => {
    expect(hint.resolvePartnerLamp(lamp({ heat: 90 }), false, 0, false)).toBe(
      'Лампа у напарника перегревается — возьми её (E)',
    );
    expect(hint.resolvePartnerLamp(lamp({ overheated: true, lit: false }), false, 0, false)).toBe(
      'Лампа перегрелась и остывает',
    );
  });

  it('масло: заправить может тот, у кого канистра, взяв лампу', () => {
    expect(hint.resolvePartnerLamp(lamp({ oil: 10 }), false, 1, false)).toBe(
      'Масло на исходе — возьми её и заправь (R)',
    );
    expect(hint.resolvePartnerLamp(lamp({ oil: 10 }), false, 0, false)).toBeNull();
  });

  it('нажал 1 без лампы — подсказка; в тамбуре и без данных — тишина', () => {
    expect(hint.resolvePartnerLamp(lamp(), false, 0, true)).toBe(
      'Лампа у напарника — попроси её (E)',
    );
    expect(hint.resolvePartnerLamp(lamp(), false, 0, false)).toBeNull();
    expect(hint.resolvePartnerLamp(lamp({ heat: 90 }), true, 0, true)).toBeNull();
    expect(hint.resolvePartnerLamp(null, false, 0, true)).toBeNull();
  });
});
