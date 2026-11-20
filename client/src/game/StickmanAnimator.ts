import { GameConfig } from '@light-keeper/shared';
import type { HeldItem, PlayerSettings } from '@light-keeper/shared';

/**
 * Поза стикмена: углы суставов в радианах.
 * Положительный угол бедра и плеча — конечность вперёд; колено и локоть —
 * сгиб голени назад (отрицательный) и предплечья вперёд (положительный).
 */
export interface StickmanPose {
  readonly leftHip: number;
  readonly rightHip: number;
  readonly leftKnee: number;
  readonly rightKnee: number;
  readonly leftShoulder: number;
  readonly rightShoulder: number;
  readonly leftElbow: number;
  readonly rightElbow: number;
  /** Наклон корпуса вперёд, рад. */
  readonly lean: number;
  /** Подпрыгивание корпуса при шаге, м. */
  readonly bounce: number;
  /** Угол лампы на ручке относительно предплечья, рад (маятник). */
  readonly lampSwing: number;
}

/**
 * Процедурная анимация стикмена: шаг, бег с наклоном и согнутыми локтями,
 * дыхание в покое. Лампа висит на ручке как маятник: стремится к вертикали
 * и раскачивается с запаздыванием.
 */
export class StickmanAnimator {
  /** Длина полного цикла шагов (левый + правый), м. */
  public static readonly STRIDE_LENGTH = 1.5;
  private static readonly BLEND_RATE = 8;
  private static readonly LAMP_STIFFNESS = 80;
  private static readonly LAMP_DAMPING = 7;

  private phase = 0;
  private time = 0;
  private moveBlend = 0;
  private runBlend = 0;
  private lampAngle = 0;
  private lampVelocity = 0;

  public constructor(private readonly settings: PlayerSettings = GameConfig.player) {}

  /**
   * @param signedSpeed скорость, м/с; отрицательная — идёт спиной вперёд
   * @param item что в правой руке
   */
  public update(deltaSeconds: number, signedSpeed: number, item: HeldItem): StickmanPose {
    const dt = Math.max(0, Math.min(deltaSeconds, 0.1));
    this.time += dt;
    const speed = Math.abs(signedSpeed);
    const { walkSpeed, runSpeed } = this.settings;
    const blend = 1 - Math.exp(-dt * StickmanAnimator.BLEND_RATE);
    this.moveBlend +=
      (StickmanAnimator.clamp01(speed / (walkSpeed * 0.6)) - this.moveBlend) * blend;
    this.runBlend +=
      (StickmanAnimator.clamp01((speed - walkSpeed) / (runSpeed - walkSpeed)) - this.runBlend) *
      blend;
    this.phase =
      (this.phase + (2 * Math.PI * signedSpeed * dt) / StickmanAnimator.STRIDE_LENGTH) %
      (2 * Math.PI);

    const move = this.moveBlend;
    const run = this.runBlend * move;
    const swing = Math.sin(this.phase);
    const hipAmp = (0.42 + 0.22 * this.runBlend) * move;
    const kneeAmp = (0.5 + 0.7 * this.runBlend) * move;
    const armAmp = (0.35 + 0.35 * this.runBlend) * move;
    const breathe = Math.sin(this.time * 1.6) * 0.04 * (1 - move);

    const rightShoulder = item === 'lamp' ? swing * armAmp * 0.4 + 0.1 + breathe : 1.0;
    const rightElbow = item === 'lamp' ? 0.25 + 0.4 * run : 0.7;
    const lean = 0.04 * move + 0.22 * run;

    // Лампа стремится висеть вертикально: компенсирует наклон корпуса и руки.
    const lampTarget = lean - rightShoulder - rightElbow;
    const acceleration =
      -StickmanAnimator.LAMP_STIFFNESS * (this.lampAngle - lampTarget) -
      StickmanAnimator.LAMP_DAMPING * this.lampVelocity;
    this.lampVelocity += acceleration * dt;
    this.lampAngle += this.lampVelocity * dt;

    return {
      leftHip: swing * hipAmp,
      rightHip: -swing * hipAmp,
      leftKnee: -Math.max(0, Math.cos(this.phase)) * kneeAmp - 0.05 * move,
      rightKnee: -Math.max(0, -Math.cos(this.phase)) * kneeAmp - 0.05 * move,
      leftShoulder: -swing * armAmp + breathe,
      rightShoulder,
      leftElbow: 0.15 + 0.9 * run,
      rightElbow,
      lean,
      bounce: Math.abs(Math.cos(this.phase)) * (0.025 + 0.03 * this.runBlend) * move,
      lampSwing: this.lampAngle,
    };
  }

  private static clamp01(value: number): number {
    return Math.min(1, Math.max(0, value));
  }
}
