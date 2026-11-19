import { GameConfig } from '@light-keeper/shared';
import type { ExitSettings, ExitSnapshot, Space, Vector2 } from '@light-keeper/shared';

/** Подсказка о действии рядом с дверью: что можно сделать прямо сейчас. */
export class InteractionPrompt {
  public constructor(private readonly settings: ExitSettings = GameConfig.exit) {}

  public resolve(
    space: Space,
    exit: ExitSnapshot | null,
    playerId: string,
    position: Vector2,
    inTambour: boolean,
  ): string | null {
    if (!exit || inTambour || !exit.revealed) {
      return null;
    }
    const near = position.distanceTo(space.exit.frontPoint()) <= this.settings.interactDistance;
    if (!near) {
      return null;
    }
    if (exit.open) {
      return 'Нажми E — войти';
    }
    if (space.exit.kind === 'locked' && exit.keyHolderId !== playerId) {
      return exit.keyHolderId === null ? 'Заперто. Нужен ключ' : 'Ключ у напарника';
    }
    return 'Удерживай E — открыть дверь';
  }
}
