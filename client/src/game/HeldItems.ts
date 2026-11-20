import type { HeldItem } from '@light-keeper/shared';

export type { HeldItem };

/** Что игрок держит в руках: клавиша 1 — лампа, клавиша 2 — компас. */
export class HeldItems {
  private static readonly KEYS: Readonly<Record<string, HeldItem>> = {
    Digit1: 'lamp',
    Numpad1: 'lamp',
    Digit2: 'compass',
    Numpad2: 'compass',
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

  public static get keyCodes(): string[] {
    return Object.keys(HeldItems.KEYS);
  }
}
