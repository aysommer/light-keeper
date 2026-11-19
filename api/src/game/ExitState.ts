import type { ExitSnapshot, Space } from '@light-keeper/shared';

/** Изменяемое состояние двери выхода и ключа в текущем пространстве. */
export class ExitState {
  public open = false;
  /** Скрытая дверь проявлена. Остальные типы видны сразу. */
  public revealed: boolean;
  /** Ключ лежит на своём месте (ещё не подобран). */
  public keyOnGround: boolean;
  public keyHolderId: string | null = null;
  public openerId: string | null = null;
  /** Сколько секунд уже удерживается `E`. */
  public openSeconds = 0;
  /** Сколько секунд осталось войти; `null`, пока дверь закрыта. */
  public secondsLeft: number | null = null;

  public constructor(space: Space) {
    this.revealed = space.exit.kind !== 'hidden';
    this.keyOnGround = space.key !== null;
  }

  public snapshot(openDuration: number): ExitSnapshot {
    return {
      open: this.open,
      revealed: this.revealed,
      openerId: this.openerId,
      openProgress: Math.min(1, this.openSeconds / openDuration),
      secondsLeft: this.secondsLeft === null ? null : Math.max(0, this.secondsLeft),
      keyHolderId: this.keyHolderId,
    };
  }
}
