import { describe, expect, it } from 'vitest';
import { RecordRanking } from '../src/index.ts';

describe('RecordRanking', () => {
  it('больше пространств — выше; при равенстве — быстрее', () => {
    const entries = [
      { spaces: 3, seconds: 400, date: '2026-01-01' },
      { spaces: 5, seconds: 900, date: '2026-01-02' },
      { spaces: 3, seconds: 300, date: '2026-01-03' },
    ];
    const sorted = [...entries].sort(RecordRanking.compare);
    expect(sorted.map((e) => [e.spaces, e.seconds])).toEqual([
      [5, 900],
      [3, 300],
      [3, 400],
    ]);
  });

  it('проверяет форму ответа /records', () => {
    expect(RecordRanking.isRecordsResponse({ records: [] })).toBe(true);
    expect(
      RecordRanking.isRecordsResponse({ records: [{ spaces: 1, seconds: 2, date: 'x' }] }),
    ).toBe(true);
    expect(RecordRanking.isRecordsResponse({ records: [{ spaces: '1' }] })).toBe(false);
    expect(RecordRanking.isRecordsResponse(null)).toBe(false);
  });
});
