import { PlayerMovement, Vector2 } from '@light-keeper/shared';

/** Состояние игрока на этом клиенте: позиция, направление взгляда, пройденный путь. */
export class LocalPlayer {
  /** Ошибка предсказания больше этой — не сглаживаем, а сразу переносим камеру. */
  private static readonly SNAP_DISTANCE = 2;
  /** Скорость гашения визуальной поправки, 1/с. */
  private static readonly SMOOTHING_RATE = 12;

  /** Поворот головы вокруг вертикали, рад. 0 — взгляд вперёд по пути (+y мира). */
  public yaw = 0;
  /** Наклон головы, рад. Положительный — вверх. */
  public pitch = 0;
  public isMoving = false;
  private farthestY: number;
  /** Визуальная поправка: камера плавно догоняет исправленную сервером позицию. */
  private visualOffset = Vector2.ZERO;

  public constructor(
    public position: Vector2,
    private readonly startY: number = position.y,
  ) {
    this.farthestY = position.y;
  }

  public get forward(): Vector2 {
    return PlayerMovement.forward(this.yaw);
  }

  public get right(): Vector2 {
    return PlayerMovement.right(this.yaw);
  }

  /** Максимальное продвижение вперёд от старта, м. */
  public get distance(): number {
    return Math.max(0, this.farthestY - this.startY);
  }

  /** Позиция для отрисовки камеры (с учётом сглаживания поправок). */
  public get renderPosition(): Vector2 {
    return this.position.add(this.visualOffset);
  }

  public moveTo(position: Vector2): void {
    this.position = position;
    this.farthestY = Math.max(this.farthestY, position.y);
  }

  /** Сервер поправил позицию: переносим игрока, а камеру сдвигаем плавно. */
  public correctTo(position: Vector2): void {
    const error = this.renderPosition.sub(position);
    this.visualOffset = error.length() > LocalPlayer.SNAP_DISTANCE ? Vector2.ZERO : error;
    this.moveTo(position);
  }

  public updateSmoothing(deltaSeconds: number): void {
    const decay = Math.exp(-LocalPlayer.SMOOTHING_RATE * deltaSeconds);
    this.visualOffset =
      this.visualOffset.lengthSquared() < 1e-8 ? Vector2.ZERO : this.visualOffset.scale(decay);
  }
}
