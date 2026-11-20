/**
 * Шаги по фазе покачивания: один шаг на каждые полпериода (левая и правая нога).
 * Срабатывает при переходе фазы через очередную границу kπ.
 */
export class StepDetector {
  private lastHalfCycle: number | null = null;

  /** @returns сделан ли новый шаг с прошлого вызова */
  public update(phase: number, moving: boolean): boolean {
    const halfCycle = Math.floor(phase / Math.PI);
    if (!moving || this.lastHalfCycle === null) {
      this.lastHalfCycle = halfCycle;
      return false;
    }
    const stepped = halfCycle !== this.lastHalfCycle;
    this.lastHalfCycle = halfCycle;
    return stepped;
  }
}
