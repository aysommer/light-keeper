import { describe, expect, it } from 'vitest';
import { GameConfig } from '@light-keeper/shared';
import { Lamp } from '../src/entities/Lamp.ts';

const settings = GameConfig.lamp;
const STEP = 0.05;

/** Держать (или не держать) лампу заданное время. */
const run = (lamp: Lamp, seconds: number, inHand: boolean): void => {
  for (let t = 0; t < seconds - 1e-9; t += STEP) lamp.update(STEP, inHand);
};

describe('Lamp', () => {
  it('новая лампа полная, холодная и горит', () => {
    const lamp = new Lamp();
    expect(lamp.snapshot()).toEqual({ oil: 100, heat: 0, lit: true, overheated: false });
    expect(lamp.brightness).toBe(1);
  });

  it('в руке тратит масло и греется, убранная — нет', () => {
    const held = new Lamp();
    run(held, 10, true);
    expect(held.oil).toBeCloseTo(100 - (100 / settings.oilSeconds) * 10, 1);
    expect(held.heat).toBeGreaterThan(5);

    const stowed = new Lamp();
    run(stowed, 10, false);
    expect(stowed.oil).toBe(100);
    expect(stowed.heat).toBe(0);
  });

  it('убранная лампа остывает и «привычка» держать проходит', () => {
    const lamp = new Lamp();
    run(lamp, 20, true);
    const { heat, holdSeconds } = lamp;
    run(lamp, 4, false);
    expect(lamp.heat).toBeCloseTo(heat - settings.stowedCoolRate * 4, 1);
    expect(lamp.holdSeconds).toBeLessThan(holdSeconds);
  });

  it('перегрев примерно через 40 с: гаснет, остывает и загорается снова', () => {
    const lamp = new Lamp();
    let seconds = 0;
    while (!lamp.overheated && seconds < 120) {
      lamp.update(STEP, true);
      seconds += STEP;
    }
    expect(seconds).toBeGreaterThan(35);
    expect(seconds).toBeLessThan(47);
    expect(lamp.lit).toBe(false);
    expect(lamp.brightness).toBe(0);

    // Пока перегрета — масло не тратится, даже в руке.
    const oil = lamp.oil;
    let dark = 0;
    while (lamp.overheated) {
      lamp.update(STEP, true);
      dark += STEP;
    }
    expect(lamp.oil).toBe(oil);
    const expected = (100 - settings.relightHeat) / settings.overheatCoolRate;
    expect(dark).toBeCloseTo(expected, 0);
    expect(lamp.lit).toBe(true);
    expect(lamp.holdSeconds).toBeLessThan(STEP * 2);
  });

  it('масло кончилось — лампа гаснет и остывает', () => {
    const lamp = new Lamp();
    lamp.oil = 0.1;
    lamp.heat = 50;
    lamp.update(1, true);
    expect(lamp.oil).toBe(0);
    expect(lamp.lit).toBe(false);
    lamp.update(1, true);
    expect(lamp.heat).toBeLessThan(50);
  });

  it('на исходе масла лампа тускнеет', () => {
    const lamp = new Lamp();
    lamp.oil = settings.dimBelowOil / 2;
    expect(lamp.brightness).toBeLessThan(1);
    expect(lamp.brightness).toBeGreaterThan(0);
  });

  it('refill() возвращает полную холодную лампу', () => {
    const lamp = new Lamp();
    run(lamp, 50, true);
    lamp.refill();
    expect(lamp.snapshot()).toEqual({ oil: 100, heat: 0, lit: true, overheated: false });
  });
});
