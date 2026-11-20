import { RecordRanking } from '@light-keeper/shared';
import type { RecordEntry } from '@light-keeper/shared';
import type { RecordStore } from './RecordStore.ts';

/**
 * Таблица рекордов: лучшие `capacity` партий. Партии без единого
 * пройденного пространства не записываются — иначе «быстрее всех погиб»
 * оказалось бы лучшим результатом.
 */
export class RecordBook {
  public static readonly CAPACITY = 10;

  private entries: RecordEntry[] = [];
  private lastSave: Promise<void> = Promise.resolve();

  public constructor(
    private readonly store: RecordStore,
    private readonly now: () => Date = () => new Date(),
    private readonly capacity = RecordBook.CAPACITY,
  ) {}

  public async load(): Promise<void> {
    this.entries = (await this.store.load()).sort(RecordRanking.compare).slice(0, this.capacity);
  }

  public get top(): RecordEntry[] {
    return [...this.entries];
  }

  /** Записать партию; возвращает место в таблице (с 1) или `null`, если не попала. */
  public submit(spaces: number, seconds: number): number | null {
    if (spaces < 1) {
      return null;
    }
    const entry: RecordEntry = {
      spaces,
      seconds: Math.round(seconds * 10) / 10,
      date: this.now().toISOString(),
    };
    const entries = [...this.entries, entry].sort(RecordRanking.compare);
    const index = entries.indexOf(entry);
    if (index >= this.capacity) {
      return null;
    }
    this.entries = entries.slice(0, this.capacity);
    this.lastSave = this.store.save(this.entries).catch((error: unknown) => {
      console.error('Не удалось сохранить рекорды:', error);
    });
    return index + 1;
  }

  /** Дождаться записи последних изменений (при остановке сервера, в тестах). */
  public flush(): Promise<void> {
    return this.lastSave;
  }
}
