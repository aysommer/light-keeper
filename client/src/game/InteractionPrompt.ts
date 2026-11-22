import { GameConfig } from '@light-keeper/shared';
import type { ExitSettings, ExitSnapshot, HeldItem, Space, Vector2 } from '@light-keeper/shared';

/** Что у игрока в руках — для подсказки у запертой двери. */
export interface Hands {
  readonly item: HeldItem;
  /** Сколько ключей несёт. */
  readonly keys: number;
}

/** Подсказка о действии рядом с дверью: что можно сделать прямо сейчас. */
export class InteractionPrompt {
  public constructor(private readonly settings: ExitSettings = GameConfig.exit) {}

  /** Игрок стоит у двери (там, где работает `E`) и на её этаже. */
  public isNearDoor(space: Space, position: Vector2, floor = 0): boolean {
    return (
      floor === space.exitFloor &&
      space.exit.reachableFrom(position, this.settings.interactDistance)
    );
  }

  public resolve(
    space: Space,
    exit: ExitSnapshot | null,
    position: Vector2,
    inTambour: boolean,
    hands: Hands = { item: 'lamp', keys: 0 },
    floor = 0,
  ): string | null {
    if (!exit || inTambour || !this.isNearDoor(space, position, floor)) {
      return null;
    }
    if (exit.open) {
      return 'Нажми E — войти';
    }
    switch (space.exit.kind) {
      case 'code':
        return 'E — кодовая панель';
      case 'locked':
        return this.lockedPrompt(space.keys.length, exit.keysInserted, hands);
      default:
        return 'Удерживай E — открыть дверь';
    }
  }

  private lockedPrompt(required: number, inserted: number, hands: Hands): string {
    const progress = `вставлено ${inserted} из ${required}`;
    if (hands.keys > 0 && hands.item === 'key') {
      return `Удерживай E — вставить ${hands.keys > 1 ? 'ключи' : 'ключ'} (${progress})`;
    }
    if (hands.keys > 0) {
      return 'Возьми ключ в руку (3)';
    }
    return `Заперто: нужно ключей — ${required}, ${progress}`;
  }
}
