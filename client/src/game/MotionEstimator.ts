import { PlayerMovement, Vector2 } from '@light-keeper/shared';

/**
 * Оценка скорости по последовательным позициям (для анимации напарника,
 * о котором известны только позиции из снимков).
 */
export class MotionEstimator {
  /** Скачок быстрее этого — телепорт (переход, отладка), а не движение. */
  private static readonly TELEPORT_SPEED = 12;
  private static readonly SMOOTHING_RATE = 10;

  private last: Vector2 | null = null;
  private velocity = Vector2.ZERO;

  public update(position: Vector2, deltaSeconds: number): Vector2 {
    if (this.last === null || deltaSeconds <= 0) {
      this.last = position;
      return this.velocity;
    }
    let raw = position.sub(this.last).scale(1 / deltaSeconds);
    if (raw.length() > MotionEstimator.TELEPORT_SPEED) {
      raw = Vector2.ZERO;
    }
    const blend = 1 - Math.exp(-deltaSeconds * MotionEstimator.SMOOTHING_RATE);
    this.velocity = this.velocity.add(raw.sub(this.velocity).scale(blend));
    this.last = position;
    return this.velocity;
  }

  /**
   * Скорость со знаком относительно взгляда: отрицательная, если игрок
   * заметно пятится (тогда анимация шагов идёт назад).
   */
  public signedSpeed(yaw: number): number {
    const speed = this.velocity.length();
    if (speed < 1e-3) {
      return 0;
    }
    const forward = PlayerMovement.forward(yaw);
    const along = this.velocity.x * forward.x + this.velocity.y * forward.y;
    return along < -0.25 * speed ? -speed : speed;
  }

  public reset(): void {
    this.last = null;
    this.velocity = Vector2.ZERO;
  }
}
