/**
 * Моргание «как у человека»: раз в 2–6 секунд через случайные промежутки,
 * быстрое закрытие, короткая пауза и чуть более медленное открытие;
 * иногда — двойное моргание.
 */
export class Blinker {
  public static readonly MIN_INTERVAL = 2;
  public static readonly MAX_INTERVAL = 6;
  private static readonly CLOSE = 0.05;
  private static readonly HOLD = 0.02;
  private static readonly OPEN = 0.1;
  private static readonly DOUBLE_CHANCE = 0.2;
  private static readonly DOUBLE_GAP = 0.25;

  private untilBlink: number;
  /** Время с начала текущего моргания; `null` — глаза открыты. */
  private blinkTime: number | null = null;

  public constructor(private readonly random: () => number = Math.random) {
    this.untilBlink = this.nextInterval();
  }

  /** Длительность одного моргания, с. */
  public static get DURATION(): number {
    return Blinker.CLOSE + Blinker.HOLD + Blinker.OPEN;
  }

  /** @returns насколько открыты глаза: 1 — открыты, 0 — закрыты. */
  public update(deltaSeconds: number): number {
    if (this.blinkTime === null) {
      this.untilBlink -= deltaSeconds;
      if (this.untilBlink > 0) {
        return 1;
      }
      this.blinkTime = 0;
    } else {
      this.blinkTime += deltaSeconds;
    }
    const t = this.blinkTime;
    if (t >= Blinker.DURATION) {
      this.blinkTime = null;
      this.untilBlink =
        this.random() < Blinker.DOUBLE_CHANCE ? Blinker.DOUBLE_GAP : this.nextInterval();
      return 1;
    }
    if (t < Blinker.CLOSE) {
      return 1 - t / Blinker.CLOSE;
    }
    if (t < Blinker.CLOSE + Blinker.HOLD) {
      return 0;
    }
    return (t - Blinker.CLOSE - Blinker.HOLD) / Blinker.OPEN;
  }

  private nextInterval(): number {
    return Blinker.MIN_INTERVAL + this.random() * (Blinker.MAX_INTERVAL - Blinker.MIN_INTERVAL);
  }
}
