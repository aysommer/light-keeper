import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { RecordRanking } from '@light-keeper/shared';
import type { RecordEntry } from '@light-keeper/shared';

/** Где хранится таблица рекордов. */
export interface RecordStore {
  load(): Promise<RecordEntry[]>;
  save(entries: readonly RecordEntry[]): Promise<void>;
}

/** Хранение в памяти (тесты, запуск без файла). */
export class MemoryRecordStore implements RecordStore {
  private entries: RecordEntry[] = [];

  public async load(): Promise<RecordEntry[]> {
    return [...this.entries];
  }

  public async save(entries: readonly RecordEntry[]): Promise<void> {
    this.entries = [...entries];
  }
}

/**
 * Хранение в JSON-файле. Запись атомарная (во временный файл и переименование),
 * записи идут строго по очереди — файл не повредится при частых сохранениях.
 */
export class FileRecordStore implements RecordStore {
  private queue: Promise<void> = Promise.resolve();

  public constructor(private readonly path: string) {}

  public async load(): Promise<RecordEntry[]> {
    try {
      const data: unknown = JSON.parse(await readFile(this.path, 'utf8'));
      return RecordRanking.isRecordsResponse(data) ? [...data.records] : [];
    } catch {
      // Файла ещё нет или он повреждён — начинаем с пустой таблицы.
      return [];
    }
  }

  public save(entries: readonly RecordEntry[]): Promise<void> {
    const body = JSON.stringify({ records: entries }, null, 2);
    this.queue = this.queue.then(async () => {
      await mkdir(dirname(this.path), { recursive: true });
      // Уникальное имя: даже параллельные записи не мешают друг другу.
      const temporary = `${this.path}.${randomUUID()}.tmp`;
      await writeFile(temporary, body, 'utf8');
      await rename(temporary, this.path);
    });
    return this.queue;
  }
}
