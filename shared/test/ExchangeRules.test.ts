import { describe, expect, it } from 'vitest';
import { AABB, CollisionWorld, ExchangeRules, PlayerMovement, Vector2 } from '../src/index.ts';

const open = new CollisionWorld([]);
const me = new Vector2(10, 10);
const faceTo = (target: Vector2): number => PlayerMovement.yawTowards(target.sub(me));

describe('ExchangeRules.canReach', () => {
  it('рядом и смотрит на напарника — можно', () => {
    const partner = new Vector2(11.5, 10);
    expect(ExchangeRules.canReach(me, faceTo(partner), partner, open)).toBe(true);
  });

  it('далеко — нельзя', () => {
    const partner = new Vector2(13, 10);
    expect(ExchangeRules.canReach(me, faceTo(partner), partner, open)).toBe(false);
  });

  it('смотрит в сторону — нельзя, в пределах угла — можно', () => {
    const partner = new Vector2(11.5, 10);
    const direct = faceTo(partner);
    expect(ExchangeRules.canReach(me, direct + Math.PI / 2, partner, open)).toBe(false);
    expect(ExchangeRules.canReach(me, direct + 0.4, partner, open)).toBe(true);
  });

  it('через стену — нельзя', () => {
    const partner = new Vector2(11.5, 10);
    const wall = new CollisionWorld([new AABB(10.6, 8, 10.8, 12)]);
    expect(ExchangeRules.canReach(me, faceTo(partner), partner, wall)).toBe(false);
  });
});

describe('CollisionWorld.lineOfSight', () => {
  const world = new CollisionWorld([new AABB(4, 0, 4.2, 10)]);

  it('стена между точками перекрывает обзор', () => {
    expect(world.lineOfSight(new Vector2(2, 5), new Vector2(6, 5))).toBe(false);
    expect(world.lineOfSight(new Vector2(2, 5), new Vector2(6, 9))).toBe(false);
  });

  it('по одну сторону стены и мимо её края — видно', () => {
    expect(world.lineOfSight(new Vector2(1, 5), new Vector2(3, 7))).toBe(true);
    expect(world.lineOfSight(new Vector2(2, 11), new Vector2(6, 11))).toBe(true);
  });
});
