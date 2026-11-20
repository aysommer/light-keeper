import { describe, expect, it } from 'vitest';
import { AABB, CollisionWorld, PlayerMovement, Vector2 } from '@light-keeper/shared';
import type { ExchangeSnapshot } from '@light-keeper/shared';
import { ExchangePrompt } from '../src/game/ExchangePrompt.ts';
import { HandOverMotion } from '../src/game/HandOverMotion.ts';

const open = new CollisionWorld([]);
const me = new Vector2(5, 5);
const partner = { position: new Vector2(6.2, 5) };
const facing = PlayerMovement.yawTowards(new Vector2(1, 0));
const away = facing + Math.PI;
const idle: ExchangeSnapshot = { offerFromId: null, count: 0 };

describe('ExchangePrompt', () => {
  const prompt = new ExchangePrompt();

  it('смотришь на напарника рядом — можно обменяться', () => {
    expect(prompt.resolve(idle, 'me', me, facing, partner, open, false)).toBe(
      'E — обменяться лампами',
    );
    expect(prompt.resolve(idle, 'me', me, away, partner, open, false)).toBeNull();
  });

  it('своё предложение — ждём напарника', () => {
    expect(
      prompt.resolve({ offerFromId: 'me', count: 0 }, 'me', me, facing, partner, open, false),
    ).toBe('Ждём, пока напарник нажмёт E');
  });

  it('предложение напарника — ответить или подойти', () => {
    const offer = { offerFromId: 'mate', count: 0 };
    expect(prompt.resolve(offer, 'me', me, facing, partner, open, false)).toBe(
      'Напарник предлагает обмен — нажми E',
    );
    expect(prompt.resolve(offer, 'me', me, away, partner, open, false)).toBe(
      'Напарник предлагает обмен — подойди и посмотри на него',
    );
  });

  it('стена, тамбур или неизвестный напарник — без подсказки', () => {
    const wall = new CollisionWorld([new AABB(5.5, 3, 5.7, 7)]);
    expect(prompt.resolve(idle, 'me', me, facing, partner, wall, false)).toBeNull();
    expect(prompt.resolve(idle, 'me', me, facing, partner, open, true)).toBeNull();
    expect(prompt.resolve(idle, 'me', me, facing, null, open, false)).toBeNull();
  });
});

describe('HandOverMotion', () => {
  it('рука протягивается при росте счётчика обменов и возвращается', () => {
    const motion = new HandOverMotion();
    expect(motion.update(0.016, 0)).toBe(0);
    const reach: number[] = [];
    for (let i = 0; i < 40; i++) reach.push(motion.update(0.016, 1));
    expect(Math.max(...reach)).toBeGreaterThan(0.95);
    expect(reach.at(-1)).toBeCloseTo(0, 5);
  });

  it('первый снимок (счётчик уже не ноль) движения не вызывает', () => {
    const motion = new HandOverMotion();
    expect(motion.update(0.1, 5)).toBe(0);
    expect(motion.update(0.1, 5)).toBe(0);
  });
});
