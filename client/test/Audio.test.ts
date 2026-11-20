import { describe, expect, it } from 'vitest';
import { GameAudioEvents } from '../src/audio/GameAudioEvents.ts';
import type { AudioFrame } from '../src/audio/GameAudioEvents.ts';
import { IntervalTimer } from '../src/audio/IntervalTimer.ts';
import { StepDetector } from '../src/audio/StepDetector.ts';

describe('StepDetector', () => {
  it('шаг на каждые полпериода фазы, только пока игрок идёт', () => {
    const steps = new StepDetector();
    let count = 0;
    for (let phase = 0; phase < 4 * Math.PI; phase += 0.1) {
      if (steps.update(phase, true)) count++;
    }
    expect(count).toBe(3); // 0→π, π→2π, 2π→3π, 3π→4π — первая граница служит отсчётом
    expect(steps.update(20, false)).toBe(false);
    expect(steps.update(20 + Math.PI, false)).toBe(false);
  });
});

describe('IntervalTimer', () => {
  it('срабатывает с заданным интервалом и молчит на паузе', () => {
    const timer = new IntervalTimer();
    let fired = 0;
    for (let i = 0; i < 100; i++) if (timer.update(0.1, 2)) fired++;
    expect(fired).toBe(5);
    expect(timer.update(10, null)).toBe(false);
  });

  it('интервал можно менять на ходу (сердце бьётся чаще)', () => {
    const timer = new IntervalTimer();
    let fast = 0;
    for (let i = 0; i < 100; i++) if (timer.update(0.1, 0.5)) fast++;
    expect(fast).toBeGreaterThanOrEqual(19);
  });
});

describe('GameAudioEvents', () => {
  const base: AudioFrame = {
    spaceIndex: 0,
    phase: 'playing',
    inTambour: false,
    exitOpen: false,
    keyHolderId: null,
    canisters: 0,
    overheated: false,
    exchangeCount: 0,
  };

  it('первый кадр событий не даёт', () => {
    expect(new GameAudioEvents().update({ ...base, exitOpen: true, canisters: 2 })).toEqual([]);
  });

  it('находит события по изменениям', () => {
    const events = new GameAudioEvents();
    events.update(base);
    expect(events.update({ ...base, exitOpen: true })).toEqual(['door-open']);
    expect(events.update({ ...base, exitOpen: true, canisters: 1, keyHolderId: 'x' })).toEqual([
      'key',
      'canister-pickup',
    ]);
    expect(events.update({ ...base, exitOpen: true, canisters: 0, keyHolderId: 'x' })).toEqual([
      'refuel-done',
    ]);
    expect(
      events.update({
        ...base,
        exitOpen: true,
        keyHolderId: 'x',
        overheated: true,
        exchangeCount: 1,
      }),
    ).toEqual(['overheat', 'exchange']);
    expect(
      events.update({
        ...base,
        exitOpen: true,
        keyHolderId: 'x',
        overheated: true,
        exchangeCount: 1,
        inTambour: true,
        phase: 'transition',
      }),
    ).toEqual(['transition', 'tambour']);
  });

  it('при смене пространства сброс состояния не даёт ложных событий', () => {
    const events = new GameAudioEvents();
    events.update({ ...base, canisters: 2, exitOpen: true });
    expect(events.update({ ...base, spaceIndex: 1 })).toEqual([]);
  });
});
