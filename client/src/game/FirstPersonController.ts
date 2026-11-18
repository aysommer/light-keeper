import { GameConfig } from '@light-keeper/shared';
import type { CollisionWorld, PlayerSettings } from '@light-keeper/shared';
import type { PerspectiveCamera } from 'three';
import type { InputController } from '../input/InputController.ts';
import { SceneCoords } from '../scene/SceneCoords.ts';
import type { LocalPlayer } from './LocalPlayer.ts';

/** Управление от первого лица: взгляд мышью, ходьба WASD, бег Shift, покачивание головы. */
export class FirstPersonController {
  private static readonly MOUSE_SENSITIVITY = 0.0022;
  private static readonly MAX_PITCH = Math.PI / 2 - 0.05;
  private static readonly BOB_AMPLITUDE = 0.035;
  private static readonly BOB_FREQUENCY = 1.9;

  private bobPhase = 0;
  private bobOffset = 0;

  public constructor(
    private readonly player: LocalPlayer,
    private readonly input: InputController,
    private readonly collisions: CollisionWorld,
    private readonly settings: PlayerSettings = GameConfig.player,
  ) {}

  public update(deltaSeconds: number): void {
    this.updateLook();
    this.updateMovement(deltaSeconds);
    this.updateBob(deltaSeconds);
  }

  public applyToCamera(camera: PerspectiveCamera): void {
    const position = SceneCoords.toScene(
      this.player.position,
      this.settings.eyeHeight + this.bobOffset,
    );
    camera.position.copy(position);
    camera.rotation.set(this.player.pitch, this.player.yaw, 0, 'YXZ');
  }

  private updateLook(): void {
    const delta = this.input.consumeMouseDelta();
    const sensitivity = FirstPersonController.MOUSE_SENSITIVITY;
    this.player.yaw -= delta.x * sensitivity;
    this.player.pitch = Math.min(
      FirstPersonController.MAX_PITCH,
      Math.max(-FirstPersonController.MAX_PITCH, this.player.pitch - delta.y * sensitivity),
    );
  }

  private updateMovement(deltaSeconds: number): void {
    const axis = this.input.movementAxis();
    this.player.isMoving = axis.lengthSquared() > 0;
    if (!this.player.isMoving) {
      return;
    }
    const running = this.input.isPressed('ShiftLeft') || this.input.isPressed('ShiftRight');
    const speed = running ? this.settings.runSpeed : this.settings.walkSpeed;
    const direction = this.player.forward
      .scale(axis.y)
      .add(this.player.right.scale(axis.x))
      .normalize();
    const next = this.collisions.move(
      this.player.position,
      direction.scale(speed * deltaSeconds),
      this.settings.radius,
    );
    this.player.moveTo(next);
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
