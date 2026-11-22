import type { HeldItem } from '@light-keeper/shared';

export type { HeldItem };

/** Что игрок держит в руках: 1 — лампа, 2 — компас, 3 — ключи, 4 — записка, 5 — флажок. */
export class HeldItems {
  private static readonly KEYS: Readonly<Record<string, HeldItem>> = {
    Digit1: 'lamp',
    Numpad1: 'lamp',
    Digit2: 'compass',
    Numpad2: 'compass',
    Digit3: 'key',
    Numpad3: 'key',
    Digit4: 'note',
    Numpad4: 'note',
    Digit5: 'flag',
    Numpad5: 'flag',
  };

  private selected: HeldItem = 'lamp';

  public get current(): HeldItem {
    return this.selected;
  }

  public select(item: HeldItem): void {
    this.selected = item;
  }

  /** Выбирает предмет по клавише; `true`, если выбор изменился. */
  public selectByKey(code: string): boolean {
    const item = HeldItems.KEYS[code];
    if (!item || item === this.selected) {
      return false;
    }
    this.selected = item;
    return true;
  }

  /** Какой предмет означает клавиша (без выбора). */
  public static itemFor(code: string): HeldItem | undefined {
    return HeldItems.KEYS[code];
  }

  /**
   * Следующий предмет по колесу мыши среди доступных (по кругу, в порядке слотов).
   * @param steps шаги колеса: + вперёд, − назад
   */
  public static cycle(current: HeldItem, steps: number, available: readonly HeldItem[]): HeldItem {
    const order: readonly HeldItem[] = ['lamp', 'compass', 'key', 'note', 'flag'];
    const slots = order.filter((item) => available.includes(item));
    if (slots.length === 0 || steps === 0) {
      return current;
    }
    const at = Math.max(0, slots.indexOf(current));
    const next = (((at + steps) % slots.length) + slots.length) % slots.length;
    return slots[next] ?? current;
  }

  public static get keyCodes(): string[] {
    return Object.keys(HeldItems.KEYS);
  }
}
