import { describe, expect, it } from 'vitest';
import { TimeFormat } from '../src/core/TimeFormat.ts';

describe('TimeFormat', () => {
  it('длительность: минуты и секунды, часы — если дольше часа', () => {
    expect(TimeFormat.duration(0)).toBe('0:00');
    expect(TimeFormat.duration(65.4)).toBe('1:05');
    expect(TimeFormat.duration(3729)).toBe('1:02:09');
  });

  it('склонение «пространство»', () => {
    expect(TimeFormat.spaces(1)).toBe('1 пространство');
    expect(TimeFormat.spaces(3)).toBe('3 пространства');
    expect(TimeFormat.spaces(5)).toBe('5 пространств');
    expect(TimeFormat.spaces(11)).toBe('11 пространств');
    expect(TimeFormat.spaces(21)).toBe('21 пространство');
    expect(TimeFormat.spaces(0)).toBe('0 пространств');
  });

  it('дата рекорда', () => {
    expect(TimeFormat.date('2026-11-20T10:00:00Z')).toMatch(/^\d\d\.11\.2026$/);
    expect(TimeFormat.date('ерунда')).toBe('');
  });
});
