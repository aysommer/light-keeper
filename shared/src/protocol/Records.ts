/** Запись в таблице рекордов. */
export interface RecordEntry {
  /** Сколько пространств пройдено. */
  readonly spaces: number;
  /** Общее время партии, с. */
  readonly seconds: number;
  /** Когда поставлен рекорд (ISO 8601). */
  readonly date: string;
}

/** Ответ `GET /records`. */
export interface RecordsResponse {
  readonly records: readonly RecordEntry[];
}

/** Порядок в таблице рекордов: больше пространств выше, при равенстве — быстрее. */
export class RecordRanking {
  public static compare(a: RecordEntry, b: RecordEntry): number {
    return b.spaces - a.spaces || a.seconds - b.seconds || a.date.localeCompare(b.date);
  }

  public static isRecordsResponse(value: unknown): value is RecordsResponse {
    if (typeof value !== 'object' || value === null) {
      return false;
    }
    const records = (value as Record<string, unknown>)['records'];
    return (
      Array.isArray(records) &&
      records.every(
        (entry: unknown) =>
          typeof entry === 'object' &&
          entry !== null &&
          typeof (entry as Record<string, unknown>)['spaces'] === 'number' &&
          typeof (entry as Record<string, unknown>)['seconds'] === 'number' &&
          typeof (entry as Record<string, unknown>)['date'] === 'string',
      )
    );
  }
}
