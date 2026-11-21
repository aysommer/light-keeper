import type { ExitCode, HeldItem } from '@light-keeper/shared';
import { CodeSymbols } from './CodeSymbols.ts';

/**
 * Что в руке, кроме лампы и компаса: связка ключей (слот 3) — значок со
 * счётчиком, записка (слот 4) — листок с кодом крупно внизу экрана.
 */
export class HandItemHud {
  public readonly element: HTMLElement;
  private readonly keys: HTMLElement;
  private readonly keysCount: HTMLElement;
  private readonly note: HTMLElement;
  private readonly noteCode: HTMLElement;
  private shownCode: ExitCode | null = null;

  public constructor() {
    this.element = document.createElement('div');
    this.element.className = 'hand-item';

    this.keys = document.createElement('div');
    this.keys.className = 'hand-item__keys';
    this.keys.innerHTML = `<svg viewBox="0 0 48 24" aria-hidden="true">
      <circle cx="9" cy="12" r="7" fill="none" stroke="currentColor" stroke-width="3"/>
      <path d="M16 10h28v4h-4v6h-4v-6h-4v4h-4v-4H16z" fill="currentColor"/></svg>`;
    this.keysCount = document.createElement('span');
    this.keysCount.className = 'hand-item__count';
    this.keys.append(this.keysCount);
    this.keys.hidden = true;

    this.note = document.createElement('div');
    this.note.className = 'hand-item__note';
    const title = document.createElement('p');
    title.className = 'hand-item__note-title';
    title.textContent = 'Код от двери';
    this.noteCode = document.createElement('div');
    this.noteCode.className = 'hand-item__note-code';
    this.note.append(title, this.noteCode);
    this.note.hidden = true;

    this.element.append(this.keys, this.note);
  }

  /**
   * @param item что в руке
   * @param keys сколько ключей у игрока
   * @param code код из записки (`null` — записки нет)
   */
  public update(item: HeldItem, keys: number, code: ExitCode | null): void {
    this.keys.hidden = item !== 'key' || keys === 0;
    const count = `×${keys}`;
    if (this.keysCount.textContent !== count) this.keysCount.textContent = count;

    const showNote = item === 'note' && code !== null;
    this.note.hidden = !showNote;
    if (showNote && code !== this.shownCode) {
      this.shownCode = code;
      this.noteCode.replaceChildren(...code.symbols.map((symbol) => CodeSymbols.element(symbol)));
      this.noteCode.dataset['alphabet'] = code.alphabet;
    }
  }
}
