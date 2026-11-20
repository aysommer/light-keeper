import type { HeldItem } from '@light-keeper/shared';

/** Что видно в руке от первого лица и насколько рука поднята (0 — опущена, 1 — поднята). */
export interface ShownItem {
  readonly item: HeldItem;
  readonly raise: number;
}

/**
 * Смена предмета от первого лица: рука опускается, предмет меняется,
 * рука поднимается. Повторный выбор во время смены просто меняет цель.
 */
export class ItemSwitcher {
  /** Длительность опускания (и подъёма), с. */
  public static readonly HALF_DURATION = 0.2;

  private shown: HeldItem;
  private raise = 1;

  public constructor(initial: HeldItem = 'lamp') {
    this.shown = initial;
  }

  public update(deltaSeconds: number, wanted: HeldItem): ShownItem {
    const step = deltaSeconds / ItemSwitcher.HALF_DURATION;
    if (wanted !== this.shown) {
      this.raise = Math.max(0, this.raise - step);
      if (this.raise === 0) {
        this.shown = wanted;
      }
    } else {
      this.raise = Math.min(1, this.raise + step);
    }
    return { item: this.shown, raise: this.raise };
  }
}
