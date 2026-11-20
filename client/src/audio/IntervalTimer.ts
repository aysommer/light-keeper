/**
 * Повторяющееся событие с меняющимся интервалом: шаги напарника, стук сердца,
 * треск лампы. Интервал задаётся каждый кадр; `null` — пауза.
 */
export class IntervalTimer {
  private elapsed = 0;

  public constructor(private readonly jitter: () => number = () => 0) {}

  /** @returns сработало ли событие в этом кадре */
  public update(deltaSeconds: number, interval: number | null): boolean {
    if (interval === null || !Number.isFinite(interval) || interval <= 0) {
      this.elapsed = 0;
      return false;
    }
    this.elapsed += deltaSeconds;
    if (this.elapsed >= interval) {
      this.elapsed = -interval * this.jitter();
      return true;
    }
    return false;
  }
}
