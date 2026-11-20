import { describe, expect, it } from 'vitest';
import { GameConfig, LampRules } from '../src/index.ts';

const settings = GameConfig.lamp;

describe('LampRules.heatRate', () => {
  it('у только что взятой лампы нагрев медленный и растёт со временем удержания', () => {
    expect(LampRules.heatRate(0)).toBeCloseTo(settings.heatBaseRate * settings.heatMinFactor);
    expect(LampRules.heatRate(20)).toBeGreaterThan(LampRules.heatRate(5));
  });

  it('держать одну лампу без перерыва — перегрев примерно за 40 секунд', () => {
    let heat = 0;
    let seconds = 0;
    while (heat < 100) {
      heat += LampRules.heatRate(seconds) * 0.05;
      seconds += 0.05;
    }
    expect(seconds).toBeGreaterThan(35);
    expect(seconds).toBeLessThan(47);
  });
});

describe('LampRules.brightness', () => {
  it('полная, пока масла достаточно; тусклее на исходе; погасшая — ноль', () => {
    expect(LampRules.brightness({ lit: true, oil: 100 })).toBe(1);
    expect(LampRules.brightness({ lit: true, oil: settings.dimBelowOil })).toBe(1);
    const dim = LampRules.brightness({ lit: true, oil: settings.dimBelowOil / 2 });
    expect(dim).toBeGreaterThan(settings.minBrightness);
    expect(dim).toBeLessThan(1);
    expect(LampRules.brightness({ lit: true, oil: 0.01 })).toBeCloseTo(settings.minBrightness, 2);
    expect(LampRules.brightness({ lit: true, oil: 0 })).toBe(0);
    expect(LampRules.brightness({ lit: false, oil: 80 })).toBe(0);
  });
});
