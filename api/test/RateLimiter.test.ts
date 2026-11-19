import { describe, expect, it } from 'vitest';
import { RateLimiter } from '../src/server/RateLimiter.ts';

describe('RateLimiter', () => {
  it('пропускает залп и восстанавливается со временем', () => {
    let now = 0;
    const limiter = new RateLimiter(10, 3, () => now);
    expect([1, 2, 3].map(() => limiter.tryConsume())).toEqual([true, true, true]);
    expect(limiter.tryConsume()).toBe(false);
    now += 100; // +1 жетон
    expect(limiter.tryConsume()).toBe(true);
    expect(limiter.tryConsume()).toBe(false);
  });
});
