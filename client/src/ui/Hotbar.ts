import type { HeldItem } from '@light-keeper/shared';

/** Что сейчас есть у игрока — для подсветки слотов. */
export interface HotbarState {
  /** Что в руке. */
  readonly selected: HeldItem;
  readonly hasLamp: boolean;
  readonly keys: number;
  readonly hasNote: boolean;
  readonly flags: number;
  /** Гусь-призрак пойман: его несут в руках, остальные слоты заперты. */
  readonly hasGoose: boolean;
}

interface Slot {
  readonly item: HeldItem;
  readonly key: string;
  readonly title: string;
  readonly icon: string;
}

/**
 * Панель слотов внизу экрана, как в Minecraft: лампа, компас, ключи, записка,
 * флажки и гусь. Выбранный слот подсвечен, недоступные — тусклые, у ключей и
 * флажков — счётчик. Выбор — клавиши 1–6 или колесо мыши. Пока гусь в руках,
 * остальные слоты тусклые: взял другой предмет — гусь вырвался.
 */
export class Hotbar {
  private static readonly SLOTS: readonly Slot[] = [
    {
      item: 'lamp',
      key: '1',
      title: 'Лампа',
      icon: '<path d="M9 4h6M10 4a2 2 0 0 1 4 0M8 7h8l-1 2v8l1 2H8l1-2V9z" fill="none" stroke="currentColor" stroke-width="1.6"/><rect x="10" y="10" width="4" height="6" rx="1" fill="#ffd27a"/>',
    },
    {
      item: 'compass',
      key: '2',
      title: 'Компас',
      icon: '<circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M12 5l2.5 7h-5z" fill="#e34b3b"/><path d="M12 19l-2.5-7h5z" fill="#f2f2f2"/>',
    },
    {
      item: 'key',
      key: '3',
      title: 'Ключи',
      icon: '<circle cx="7" cy="12" r="4" fill="none" stroke="currentColor" stroke-width="2"/><path d="M11 11h10v2h-2v3h-2v-3h-2v2h-2v-2h-2z" fill="currentColor"/>',
    },
    {
      item: 'note',
      key: '4',
      title: 'Записка',
      icon: '<path d="M6 3h9l3 3v15H6z" fill="#efe6cc"/><path d="M8 9h8M8 12h8M8 15h6" stroke="#5a4a2a" stroke-width="1.2"/>',
    },
    {
      item: 'flag',
      key: '5',
      title: 'Флажки',
      icon: '<path d="M7 3v18" stroke="currentColor" stroke-width="1.8"/><path d="M8 4l11 4-11 4z" fill="#ff5a2a"/>',
    },
    {
      item: 'goose',
      key: '6',
      title: 'Гусь',
      icon: '<ellipse cx="11" cy="15" rx="7" ry="4.5" fill="#e8eeff"/><path d="M15 13c1-3 1-6 2-8" stroke="#e8eeff" stroke-width="2.6" fill="none"/><circle cx="17" cy="5" r="2" fill="#e8eeff"/><path d="M18.5 5l3 .8-3 .8z" fill="#ff9a2e"/>',
    },
  ];

  public readonly element: HTMLElement;
  private readonly slots = new Map<HeldItem, { root: HTMLElement; count: HTMLElement }>();
  private shown = '';

  public constructor() {
    this.element = document.createElement('div');
    this.element.className = 'hotbar';
    this.element.setAttribute('role', 'toolbar');
    this.element.setAttribute('aria-label', 'Предметы');
    for (const slot of Hotbar.SLOTS) {
      const root = document.createElement('div');
      root.className = 'hotbar__slot';
      root.title = slot.title;
      root.innerHTML = `<span class="hotbar__key">${slot.key}</span><svg class="hotbar__icon" viewBox="0 0 24 24" aria-hidden="true">${slot.icon}</svg>`;
      const count = document.createElement('span');
      count.className = 'hotbar__count';
      root.append(count);
      this.element.append(root);
      this.slots.set(slot.item, { root, count });
    }
  }

  public update(state: HotbarState): void {
    const key = JSON.stringify(state);
    if (key === this.shown) {
      return;
    }
    this.shown = key;
    const available: Record<HeldItem, boolean> = {
      lamp: state.hasLamp,
      compass: true,
      key: state.keys > 0,
      note: state.hasNote,
      flag: state.flags > 0,
      goose: state.hasGoose,
    };
    const counts: Partial<Record<HeldItem, number>> = { key: state.keys, flag: state.flags };
    for (const [item, slot] of this.slots) {
      slot.root.classList.toggle('hotbar__slot--selected', item === state.selected);
      const lockedByGoose = state.hasGoose && item !== 'goose';
      slot.root.classList.toggle('hotbar__slot--empty', !available[item] || lockedByGoose);
      const count = counts[item] ?? 0;
      slot.count.textContent = count > 1 ? String(count) : '';
    }
  }
}
