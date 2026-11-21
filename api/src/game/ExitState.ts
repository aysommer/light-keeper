import type { ExitSnapshot } from '@light-keeper/shared';

/** Изменяемое состояние двери выхода, ключей и записки в текущем пространстве. */
export class ExitState {
  public open = false;
  /** Подобранные ключи (индексы в `Space.keys`). */
  public readonly keysTaken = new Set<number>();
  /** Сколько ключей уже вставлено в замок. */
  public keysInserted = 0;
  /** У кого записка с кодом; `null` — лежит на месте или её нет. */
  public noteHolderId: string | null = null;
  /** Сколько раз ввели неверный код. */
  public codeFailures = 0;
  /** Сколько секунд ждать до следующей попытки ввода кода. */
  public codeCooldown = 0;
  public openerId: string | null = null;
  /** Сколько секунд уже удерживается `E`. */
  public openSeconds = 0;
  /** Сколько секунд осталось войти; `null`, пока дверь закрыта. */
  public secondsLeft: number | null = null;

  public snapshot(openDuration: number): ExitSnapshot {
    return {
      open: this.open,
      openerId: this.openerId,
      openProgress: Math.min(1, this.openSeconds / openDuration),
      secondsLeft: this.secondsLeft === null ? null : Math.max(0, this.secondsLeft),
      keysTaken: [...this.keysTaken].sort((a, b) => a - b),
      keysInserted: this.keysInserted,
      noteHolderId: this.noteHolderId,
      codeFailures: this.codeFailures,
    };
  }
}
