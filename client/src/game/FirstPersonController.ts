import { GameConfig, PlayerMovement } from '@light-keeper/shared';
import type { PlayerInput, PlayerSettings } from '@light-keeper/shared';
import type { PerspectiveCamera } from 'three';
import type { InputController } from '../input/InputController.ts';
import { SceneCoords } from '../scene/SceneCoords.ts';
import type { LocalPlayer } from './LocalPlayer.ts';

/**
 * Управление от первого лица. Каждый кадр превращает ввод в команду `PlayerInput`,
 * сразу применяет её к игроку (предсказание) и отдаёт подписчику — в сетевой
 * игре команда уходит на сервер.
 */
export class FirstPersonController {
  private static readonly MOUSE_SENSITIVITY = 0.0022;
  private static readonly BOB_AMPLITUDE = 0.035;
  private static readonly BOB_FREQUENCY = 1.9;

  private nextSeq = 0;
  private bobPhase = 0;
  private bobOffset = 0;
  private commandListener: ((command: PlayerInput) => void) | null = null;

  public constructor(
    private readonly player: LocalPlayer,
    private readonly input: InputController,
    private readonly movement: PlayerMovement,
    private readonly settings: PlayerSettings = GameConfig.player,
  ) {}

  public onCommand(listener: (command: PlayerInput) => void): void {
    this.commandListener = listener;
  }

  public update(deltaSeconds: number): void {
    this.updateLook();
    const axis = this.input.movementAxis();
    const command: PlayerInput = {
      seq: this.nextSeq++,
      dt: Math.min(deltaSeconds, PlayerMovement.MAX_COMMAND_DT),
      moveX: axis.x,
      moveY: axis.y,
      yaw: this.player.yaw,
      pitch: this.player.pitch,
      run: this.input.isPressed('ShiftLeft') || this.input.isPressed('ShiftRight'),
    };
    this.player.isMoving = axis.lengthSquared() > 0;
    this.player.moveTo(this.movement.apply(this.player.position, command));
    this.player.updateSmoothing(deltaSeconds);
    this.commandListener?.(command);
    this.updateBob(deltaSeconds);
  }

  public applyToCamera(camera: PerspectiveCamera): void {
    const position = SceneCoords.toScene(
      this.player.renderPosition,
      this.settings.eyeHeight + this.bobOffset,
    );
    camera.position.copy(position);
    camera.rotation.set(this.player.pitch, this.player.yaw, 0, 'YXZ');
  }

  private updateLook(): void {
    const delta = this.input.consumeMouseDelta();
    const sensitivity = FirstPersonController.MOUSE_SENSITIVITY;
    // Держим yaw в (−π, π], чтобы он не рос бесконечно.
    const yaw = this.player.yaw - delta.x * sensitivity;
    this.player.yaw = Math.atan2(Math.sin(yaw), Math.cos(yaw));
    this.player.pitch = PlayerMovement.clampPitch(this.player.pitch - delta.y * sensitivity);
  }

  private updateBob(deltaSeconds: number): void {
    if (this.player.isMoving) {
      this.bobPhase += deltaSeconds * FirstPersonController.BOB_FREQUENCY * Math.PI * 2;
      this.bobOffset = Math.sin(this.bobPhase) * FirstPersonController.BOB_AMPLITUDE;
    } else {
      this.bobOffset *= Math.max(0, 1 - deltaSeconds * 8);
    }
  }
}
