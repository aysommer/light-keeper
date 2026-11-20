import type { RecordEntry } from '@light-keeper/shared';
import { TimeFormat } from '../core/TimeFormat.ts';

/** Таблица рекордов: место, пройдено пространств, время, дата. */
export class RecordsTable {
  public readonly element: HTMLElement;

  public constructor(caption = 'Рекорды') {
    this.element = document.createElement('section');
    this.element.className = 'records';
    const title = document.createElement('h2');
    title.className = 'records__title';
    title.textContent = caption;
    this.element.append(title);
    this.update([], null);
  }

  /** @param highlight место (с 1), которое нужно выделить */
  public update(records: readonly RecordEntry[], highlight: number | null): void {
    this.element.querySelector('table, .records__empty')?.remove();
    if (records.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'records__empty';
      empty.textContent = 'Пока пусто — пройдите хотя бы одно пространство.';
      this.element.append(empty);
      return;
    }
    const table = document.createElement('table');
    table.className = 'records__table';
    table.innerHTML =
      '<thead><tr><th>#</th><th>Пространств</th><th>Время</th><th>Дата</th></tr></thead>';
    const body = document.createElement('tbody');
    records.forEach((record, index) => {
      const row = document.createElement('tr');
      if (index + 1 === highlight) row.className = 'records__row--mine';
      for (const text of [
        String(index + 1),
        String(record.spaces),
        TimeFormat.duration(record.seconds),
        TimeFormat.date(record.date),
      ]) {
        const cell = document.createElement('td');
        cell.textContent = text;
        row.append(cell);
      }
      body.append(row);
    });
    table.append(body);
    this.element.append(table);
  }
}
