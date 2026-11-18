/** Цикл кадров на requestAnimationFrame с ограничением шага времени. */
export class GameLoop {
  private static readonly MAX_DELTA_SECONDS = 0.1;

  private frameId: number | null = null;
  private lastTime = 0;
  private elapsed = 0;

  public constructor(private readonly onFrame: (deltaSeconds: number, time: number) => void) {}

  public start(): void {
    if (this.frameId !== null) {
      return;
    }
    this.lastTime = performance.now();
    this.frameId = requestAnimationFrame(this.tick);
  }

  public stop(): void {
    if (this.frameId !== null) {
      cancelAnimationFrame(this.frameId);
      this.frameId = null;
    }
  }

  private readonly tick = (now: number): void => {
    const delta = Math.min(GameLoop.MAX_DELTA_SECONDS, (now - this.lastTime) / 1000);
    this.lastTime = now;
    this.elapsed += delta;
    this.onFrame(delta, this.elapsed);
    this.frameId = requestAnimationFrame(this.tick);
  };
}
