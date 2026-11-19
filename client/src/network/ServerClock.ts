/**
 * Оценка времени сервера на клиенте по снимкам.
 * Смещение сглаживается, чтобы джиттер сети не дёргал интерполяцию.
 */
export class ServerClock {
  private static readonly SMOOTHING = 0.1;
  private offset: number | null = null;

  /** Учитывает снимок с временем сервера `serverTime`, полученный в момент `localNow`. */
  public observe(serverTime: number, localNow: number): void {
    const sample = serverTime - localNow;
    if (this.offset === null || Math.abs(sample - this.offset) > 1000) {
      this.offset = sample;
      return;
    }
    this.offset += (sample - this.offset) * ServerClock.SMOOTHING;
  }

  /** Оценка текущего времени сервера; `null`, пока не было снимков. */
  public serverNow(localNow: number): number | null {
    return this.offset === null ? null : localNow + this.offset;
  }
}
