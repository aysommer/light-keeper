import { GameConfig, PlayerMovement, Vector2 } from '@light-keeper/shared';
import type { HeldItem, PlayerInput, PlayerSettings } from '@light-keeper/shared';
import type { PerspectiveCamera } from 'three';
import type { InputController } from '../input/InputController.ts';
import { SceneCoords } from '../scene/SceneCoords.ts';
import type { MovementProvider } from './ActiveSpace.ts';
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
  private stepPhase = 0;
  private bobOffset = 0;
  private commandListener: ((command: PlayerInput) => void) | null = null;
  /** Во время перехода и в тамбуре ходить нельзя (осматриваться можно). */
  public frozen = false;
  /** Предмет в руке — уходит на сервер, чтобы напарник видел, что у тебя в руке. */
  public item: HeldItem = 'lamp';
  private running = false;

  public constructor(
    private readonly player: LocalPlayer,
    private readonly input: InputController,
    private readonly rules: MovementProvider,
    private readonly settings: PlayerSettings = GameConfig.player,
  ) {}

  public onCommand(listener: (command: PlayerInput) => void): void {
    this.commandListener = listener;
  }

  public update(deltaSeconds: number): void {
    this.updateLook();
    const axis = this.frozen ? Vector2.ZERO : this.input.movementAxis();
    const command: PlayerInput = {
      seq: this.nextSeq++,
      dt: Math.min(deltaSeconds, PlayerMovement.MAX_COMMAND_DT),
      moveX: axis.x,
      moveY: axis.y,
      yaw: this.player.yaw,
      pitch: this.player.pitch,
      run: this.input.isPressed('ShiftLeft') || this.input.isPressed('ShiftRight'),
      // Короткое нажатие может уложиться между кадрами — учитываем и его.
      interact: this.input.consumePress('KeyE') || this.input.isPressed('KeyE'),
      item: this.item,
      space: this.rules.spaceIndex,
    };
    this.player.isMoving = axis.lengthSquared() > 0;
    this.running = command.run && this.player.isMoving;
    this.player.moveTo(this.rules.movement.apply(this.player.position, command));
    this.player.updateSmoothing(deltaSeconds);
    this.commandListener?.(command);
    this.updateBob(deltaSeconds);
  }

  /** Фаза покачивания головы (для покачивания руки с лампой). */
  public get bobPhase(): number {
    return this.stepPhase;
  }

  public get isRunning(): boolean {
    return this.running;
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
      this.stepPhase += deltaSeconds * FirstPersonController.BOB_FREQUENCY * Math.PI * 2;
      this.bobOffset = Math.sin(this.stepPhase) * FirstPersonController.BOB_AMPLITUDE;
    } else {
      this.bobOffset *= Math.max(0, 1 - deltaSeconds * 8);
    }
  }
}
