/**
 * Короткое движение «протянуть лампу» при обмене: рука уходит вперёд
 * и возвращается. Срабатывает, когда растёт счётчик обменов из снимка.
 */
export class HandOverMotion {
  public static readonly DURATION = 0.45;

  private lastCount: number | null = null;
  private elapsed = HandOverMotion.DURATION;

  /** @returns насколько рука вытянута, 0–1. */
  public update(deltaSeconds: number, exchangeCount: number | null): number {
    if (exchangeCount !== null) {
      if (this.lastCount !== null && exchangeCount > this.lastCount) {
        this.elapsed = 0;
      }
      this.lastCount = exchangeCount;
    }
    this.elapsed = Math.min(HandOverMotion.DURATION, this.elapsed + deltaSeconds);
    if (this.elapsed >= HandOverMotion.DURATION) {
      return 0;
    }
    return Math.sin((Math.PI * this.elapsed) / HandOverMotion.DURATION);
  }
}
