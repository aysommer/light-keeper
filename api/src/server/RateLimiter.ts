/** Ограничитель частоты по алгоритму «ведро с жетонами». */
export class RateLimiter {
  private tokens: number;
  private lastRefill: number;

  public constructor(
    /** Сколько сообщений в секунду разрешено в среднем. */
    private readonly ratePerSecond: number,
    /** Сколько сообщений можно отправить залпом. */
    private readonly burst: number,
    private readonly now: () => number = () => Date.now(),
  ) {
    this.tokens = burst;
    this.lastRefill = now();
  }

  /** Тратит жетон. `false` — лимит превышен. */
  public tryConsume(): boolean {
    const current = this.now();
    const elapsedSeconds = (current - this.lastRefill) / 1000;
    this.tokens = Math.min(this.burst, this.tokens + elapsedSeconds * this.ratePerSecond);
    this.lastRefill = current;
    if (this.tokens < 1) {
      return false;
    }
    this.tokens -= 1;
    return true;
  }
}
