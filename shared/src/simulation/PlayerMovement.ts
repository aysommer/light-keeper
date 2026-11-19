import { GameConfig } from '../config/GameConfig.ts';
import type { PlayerSettings } from '../config/GameConfig.ts';
import { Vector2 } from '../math/Vector2.ts';
import type { CollisionWorld } from '../physics/CollisionWorld.ts';
import type { PlayerInput } from './PlayerInput.ts';

/**
 * Правило движения игрока — общее для сервера (авторитетная симуляция)
 * и клиента (предсказание). Одинаковые входные данные дают одинаковый результат.
 */
export class PlayerMovement {
  /** Самый длинный шаг одной команды, с. Защищает от «телепортов». */
  public static readonly MAX_COMMAND_DT = 0.1;
  public static readonly MAX_PITCH = Math.PI / 2 - 0.05;

  public constructor(
    private readonly collisions: CollisionWorld,
    private readonly settings: PlayerSettings = GameConfig.player,
  ) {}

  /** Направление «вперёд» для поворота `yaw` в координатах мира. */
  public static forward(yaw: number): Vector2 {
    return new Vector2(-Math.sin(yaw), Math.cos(yaw));
  }

  /** Направление «вправо» для поворота `yaw` в координатах мира. */
  public static right(yaw: number): Vector2 {
    return new Vector2(Math.cos(yaw), Math.sin(yaw));
  }

  public static clampPitch(pitch: number): number {
    return Math.min(PlayerMovement.MAX_PITCH, Math.max(-PlayerMovement.MAX_PITCH, pitch));
  }

  /** Новая позиция после применения команды. */
  public apply(position: Vector2, input: PlayerInput): Vector2 {
    const dt = Math.min(PlayerMovement.MAX_COMMAND_DT, Math.max(0, input.dt));
    const moveX = Math.sign(input.moveX);
    const moveY = Math.sign(input.moveY);
    if (dt === 0 || (moveX === 0 && moveY === 0)) {
      return position;
    }
    const speed = input.run ? this.settings.runSpeed : this.settings.walkSpeed;
    const direction = PlayerMovement.forward(input.yaw)
      .scale(moveY)
      .add(PlayerMovement.right(input.yaw).scale(moveX))
      .normalize();
    return this.collisions.move(position, direction.scale(speed * dt), this.settings.radius);
  }
}
