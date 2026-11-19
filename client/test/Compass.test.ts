import { describe, expect, it } from 'vitest';
import { PlayerMovement, Vector2 } from '@light-keeper/shared';
import { HeldItems } from '../src/game/HeldItems.ts';
import { PartnerBearing } from '../src/game/PartnerBearing.ts';

const origin = new Vector2(10, 10);

describe('PartnerBearing', () => {
  it('напарник прямо по курсу — 0', () => {
    // При yaw = 0 взгляд направлен вдоль +y.
    expect(PartnerBearing.clockwiseFromForward(origin, 0, new Vector2(10, 20))).toBeCloseTo(0);
  });

  it('справа — +π/2, слева — −π/2, позади — π', () => {
    const angle = (x: number, y: number): number =>
      PartnerBearing.clockwiseFromForward(origin, 0, new Vector2(10 + x, 10 + y));
    expect(angle(5, 0)).toBeCloseTo(Math.PI / 2);
    expect(angle(-5, 0)).toBeCloseTo(-Math.PI / 2);
    expect(Math.abs(angle(0, -5))).toBeCloseTo(Math.PI);
  });

  it('учитывает поворот головы: повернулся к напарнику — стрелка вперёд', () => {
    const partner = new Vector2(25, 10); // справа от старта
    const yawToPartner = PlayerMovement.yawTowards(partner.sub(origin));
    expect(PartnerBearing.clockwiseFromForward(origin, yawToPartner, partner)).toBeCloseTo(0);
    expect(PartnerBearing.clockwiseFromForward(origin, 0, partner)).toBeCloseTo(Math.PI / 2);
  });

  it('совпавшие позиции не дают NaN', () => {
    expect(PartnerBearing.clockwiseFromForward(origin, 1, origin)).toBe(0);
  });
});

describe('HeldItems', () => {
  it('по умолчанию лампа; 2 — компас, 1 — снова лампа', () => {
    const items = new HeldItems();
    expect(items.current).toBe('lamp');
    expect(items.selectByKey('Digit2')).toBe(true);
    expect(items.current).toBe('compass');
    expect(items.selectByKey('Digit2')).toBe(false);
    expect(items.selectByKey('Digit1')).toBe(true);
    expect(items.current).toBe('lamp');
  });

  it('посторонние клавиши игнорируются', () => {
    const items = new HeldItems();
    expect(items.selectByKey('KeyW')).toBe(false);
    expect(items.current).toBe('lamp');
  });
});
