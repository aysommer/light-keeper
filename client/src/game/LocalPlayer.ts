import { Vector2 } from '@light-keeper/shared';

/** Состояние игрока на этом клиенте: позиция, направление взгляда, пройденный путь. */
export class LocalPlayer {
  /** Поворот головы вокруг вертикали, рад. 0 — взгляд вперёд по пути (+y мира). */
  public yaw = 0;
  /** Наклон головы, рад. Положительный — вверх. */
  public pitch = 0;
  public isMoving = false;
  private farthestY: number;

  public constructor(
    public position: Vector2,
    private readonly startY: number = position.y,
  ) {
    this.farthestY = position.y;
  }

  /** Направление «вперёд» в координатах мира. */
  public get forward(): Vector2 {
    return new Vector2(-Math.sin(this.yaw), Math.cos(this.yaw));
  }

  /** Направление «вправо» в координатах мира. */
  public get right(): Vector2 {
    return new Vector2(Math.cos(this.yaw), Math.sin(this.yaw));
  }

  /** Максимальное продвижение вперёд от старта, м. */
  public get distance(): number {
    return Math.max(0, this.farthestY - this.startY);
  }

  public moveTo(position: Vector2): void {
    this.position = position;
    this.farthestY = Math.max(this.farthestY, position.y);
  }
}
