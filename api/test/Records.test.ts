import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { RecordBook } from '../src/records/RecordBook.ts';
import { FileRecordStore, MemoryRecordStore } from '../src/records/RecordStore.ts';

const clock = () => {
  let t = Date.UTC(2026, 10, 20);
  return () => new Date((t += 1000));
};

describe('RecordBook', () => {
  it('ставит партию на её место: больше пространств выше, при равенстве — быстрее', () => {
    const book = new RecordBook(new MemoryRecordStore(), clock());
    expect(book.submit(3, 400)).toBe(1);
    expect(book.submit(5, 900)).toBe(1);
    expect(book.submit(3, 300)).toBe(2);
    expect(book.top.map((e) => [e.spaces, e.seconds])).toEqual([
      [5, 900],
      [3, 300],
      [3, 400],
    ]);
  });

  it('партии без пройденных пространств не записываются', () => {
    const book = new RecordBook(new MemoryRecordStore(), clock());
    expect(book.submit(0, 12)).toBeNull();
    expect(book.top).toHaveLength(0);
  });

  it('хранит только лучшие; худший результат за пределами таблицы — null', () => {
    const book = new RecordBook(new MemoryRecordStore(), clock(), 3);
    book.submit(5, 100);
    book.submit(4, 100);
    book.submit(3, 100);
    expect(book.submit(1, 50)).toBeNull();
    expect(book.submit(6, 50)).toBe(1);
    expect(book.top.map((e) => e.spaces)).toEqual([6, 5, 4]);
  });
});

describe('FileRecordStore', () => {
  const dirs: string[] = [];
  afterEach(async () => {
    await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
  });

  it('сохраняет таблицу в файл и загружает её после перезапуска', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'lk-records-'));
    dirs.push(dir);
    const path = join(dir, 'nested', 'records.json');
    const first = new RecordBook(new FileRecordStore(path), clock());
    await first.load();
    first.submit(2, 120);
    first.submit(4, 300);
    await first.flush();
    const second = new RecordBook(new FileRecordStore(path), clock());
    await second.load();
    expect(second.top.map((e) => e.spaces)).toEqual([4, 2]);
    expect(JSON.parse(await readFile(path, 'utf8')).records).toHaveLength(2);
  });

  it('параллельные записи в один файл не мешают друг другу', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'lk-records-'));
    dirs.push(dir);
    const path = join(dir, 'records.json');
    const entry = { spaces: 1, seconds: 1, date: 'd' };
    await Promise.all([
      new FileRecordStore(path).save([entry]),
      new FileRecordStore(path).save([entry, entry]),
    ]);
    expect((await new FileRecordStore(path).load()).length).toBeGreaterThan(0);
  });

  it('нет файла или он повреждён — пустая таблица', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'lk-records-'));
    dirs.push(dir);
    expect(await new FileRecordStore(join(dir, 'none.json')).load()).toEqual([]);
  });
});
