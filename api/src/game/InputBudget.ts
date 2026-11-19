/**
 * Бюджет игрового времени игрока — защита от ускорения (speedhack).
 * Каждый тик сервера добавляет реально прошедшее время; каждая команда ввода
 * тратит свой `dt`. Нельзя потратить больше, чем накопилось.
 */
export class InputBudget {
  private available: number;

  public constructor(
    /** Сколько секунд можно накопить (компенсирует задержки сети). */
    private readonly capacity = 1,
    initial = 0.25,
  ) {
    this.available = Math.min(initial, capacity);
  }

  public get seconds(): number {
    return this.available;
  }

  public credit(seconds: number): void {
    this.available = Math.min(this.capacity, this.available + Math.max(0, seconds));
  }

  /** Списывает время команды; возвращает, сколько разрешено потратить. */
  public spend(requested: number): number {
    const granted = Math.min(Math.max(0, requested), this.available);
    this.available -= granted;
    return granted;
  }
}
