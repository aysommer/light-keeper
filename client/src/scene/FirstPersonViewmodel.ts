import { Group, HemisphereLight, PointLight, Vector3 } from 'three';
import type { Scene } from 'three';
import { LampRules } from '@light-keeper/shared';
import type { ExitCode, HeldItem, LampSnapshot } from '@light-keeper/shared';
import { LampFlame } from '../game/LampFlame.ts';
import { ItemSwitcher } from '../game/ItemSwitcher.ts';
import { HeldProps } from './HeldProps.ts';
import { LanternModel } from './LanternModel.ts';

/** Что нужно руке от первого лица, чтобы двигаться вместе с игроком. */
export interface ViewmodelMotion {
  /** Фаза покачивания головы при ходьбе. */
  readonly bobPhase: number;
  readonly moving: boolean;
  readonly running: boolean;
  /** Поворот головы за кадр, рад (для инерции руки). */
  readonly yawDelta: number;
  readonly pitchDelta: number;
  /** Какой предмет игрок хочет держать. */
  readonly wanted: HeldItem;
  /** Состояние своей лампы (по данным сервера). */
  readonly lamp: LampSnapshot | null;
  /** Насколько рука протянута при обмене лампами, 0–1. */
  readonly reach: number;
  /** Идёт заправка — фонарь опущен и наклонён. */
  readonly refueling: boolean;
  /** Направление на напарника для стрелки компаса, рад (по часовой от «вперёд»). */
  readonly bearing: number | null;
  /** Сколько ключей у игрока (видно на связке). */
  readonly keys: number;
  /** Код из записки; `null` — записки нет. */
  readonly code: ExitCode | null;
}

/**
 * Предмет в руках от первого лица — без самой руки: висящий фонарь, компас со
 * стрелкой на напарника, связка ключей или записка с кодом (код читается прямо
 * на листке, см. HeldProps). Рисуется отдельной сценой поверх мира (см.
 * SceneManager), поэтому не утопает в стенах. Предмет качается при ходьбе,
 * запаздывает при поворотах; фонарь — маятник. При смене предмета он опускается
 * за край экрана и поднимается снова.
 */
export class FirstPersonViewmodel {
  /** Где предмет «в руке»: низко справа (сама рука не рисуется — только предмет). */
  private static readonly HAND = new Vector3(0.24, -0.11, -0.5);
  /** Фонарь в руке чуть меньше настоящего, чтобы не загораживать обзор. */
  private static readonly LANTERN_SCALE = 0.8;
  private static readonly LOWERED_OFFSET = 0.5;

  private readonly root = new Group();
  private readonly lampPivot = new Group();
  private readonly lantern = new LanternModel();
  private readonly glow = new PointLight('#ffcf8a', 1.2, 1.5, 1.5);
  private readonly switcher = new ItemSwitcher();
  private readonly props = new HeldProps();
  private swayX = 0;
  private swayY = 0;
  private swingSide = 0;
  private swingSideVelocity = 0;
  private swingForward = 0;
  private swingForwardVelocity = 0;
  private walkAmount = 0;
  private refuelAmount = 0;

  public constructor(private readonly scene: Scene) {
    scene.add(new HemisphereLight('#fff1c4', '#2b2414', 0.45));
    scene.add(this.root);

    const hand = FirstPersonViewmodel.HAND;
    this.lampPivot.position.copy(hand).add(new Vector3(0, -0.02, 0));
    this.root.add(this.lampPivot);
    this.lampPivot.add(this.lantern.root);
    this.lantern.root.scale.setScalar(FirstPersonViewmodel.LANTERN_SCALE);
    this.glow.position.y = LanternModel.GLASS_CENTER_Y * FirstPersonViewmodel.LANTERN_SCALE;
    this.lampPivot.add(this.glow);

    // Компас и ключи — в кисти; записка — перед глазами, чтобы код можно было прочитать.
    this.props.compass.position.copy(hand).add(new Vector3(-0.03, -0.025, -0.01));
    this.props.keys.position.copy(hand).add(new Vector3(-0.01, -0.005, 0));
    this.props.note.position.set(0.04, -0.13, -0.42);
    this.props.note.rotation.set(-0.42, -0.12, 0.03);
    // Флажок в руке — маленький, древко наклонено вперёд.
    this.props.flag.position.copy(hand).add(new Vector3(0.02, -0.14, 0.02));
    this.props.flag.scale.setScalar(0.55);
    this.props.flag.rotation.set(-0.35, 0.4, 0);
    // Гусь — в обеих руках перед собой, внизу кадра, спиной к игроку.
    this.props.goose.position.set(0.06, -0.6, -0.72);
    this.props.goose.scale.setScalar(0.7);
    this.props.goose.rotation.set(0.2, 0.55, 0);
    this.root.add(
      this.props.compass,
      this.props.keys,
      this.props.note,
      this.props.flag,
      this.props.goose,
    );
  }

  private level = 0;

  /** Уровень света своей лампы в мир: 0, если фонарь убран, опущен или не горит. */
  public get lightLevel(): number {
    return this.lantern.root.visible && this.root.visible ? this.level : 0;
  }

  public update(deltaSeconds: number, time: number, motion: ViewmodelMotion): void {
    const dt = Math.max(1e-4, Math.min(deltaSeconds, 0.1));
    const shown = this.switcher.update(dt, motion.wanted);
    const lampShown = shown.item === 'lamp';
    this.lantern.root.visible = lampShown;
    this.glow.visible = lampShown;
    this.root.visible = shown.raise > 0;
    this.props.update(shown.item, time, motion.bearing, motion.keys, motion.code);

    // Инерция: рука отстаёт от поворота головы.
    const follow = 1 - Math.exp(-dt * 10);
    const targetX = Math.max(-0.06, Math.min(0.06, (motion.yawDelta / dt) * 0.012));
    const targetY = Math.max(-0.05, Math.min(0.05, (-motion.pitchDelta / dt) * 0.012));
    this.swayX += (targetX - this.swayX) * follow;
    this.swayY += (targetY - this.swayY) * follow;

    // Покачивание при ходьбе (при беге — сильнее).
    this.walkAmount +=
      ((motion.moving ? (motion.running ? 1.6 : 1) : 0) - this.walkAmount) * follow;
    const bobX = Math.sin(motion.bobPhase) * 0.012 * this.walkAmount;
    const bobY = -Math.abs(Math.cos(motion.bobPhase)) * 0.014 * this.walkAmount;
    const breathe = Math.sin(time * 1.6) * 0.004;
    const lowered = (1 - this.easeOut(shown.raise)) * FirstPersonViewmodel.LOWERED_OFFSET;
    this.refuelAmount += ((motion.refueling ? 1 : 0) - this.refuelAmount) * follow;
    // При обмене рука с лампой уходит вперёд-влево, к напарнику, и возвращается.
    const reachX = -motion.reach * 0.12;
    const reachZ = -motion.reach * 0.22;
    this.root.position.set(
      this.swayX + bobX + reachX,
      this.swayY + bobY + breathe - lowered + motion.reach * 0.06 - this.refuelAmount * 0.07,
      reachZ,
    );

    // Фонарь — маятник: раскачивается от поворотов и шагов.
    const sideTarget = -this.swayX * 6;
    const forwardTarget = Math.sin(motion.bobPhase * 2) * 0.12 * this.walkAmount;
    [this.swingSide, this.swingSideVelocity] = this.spring(
      this.swingSide,
      this.swingSideVelocity,
      sideTarget,
      dt,
    );
    [this.swingForward, this.swingForwardVelocity] = this.spring(
      this.swingForward,
      this.swingForwardVelocity,
      forwardTarget,
      dt,
    );
    this.lampPivot.rotation.set(this.swingForward, 0, this.swingSide + this.refuelAmount * 0.35);

    const brightness = motion.lamp ? LampRules.brightness(motion.lamp) : 1;
    this.level = LampFlame.level(time, brightness);
    this.lantern.setGlow(this.level, LampFlame.heatGlow(motion.lamp?.heat ?? 0));
    this.glow.intensity = 1.2 * this.level;
  }

  public dispose(): void {
    this.root.removeFromParent();
    this.lantern.dispose();
    this.props.dispose();
    this.glow.dispose();
    this.scene.clear();
  }

  private spring(angle: number, velocity: number, target: number, dt: number): [number, number] {
    const acceleration = -60 * (angle - target) - 6 * velocity;
    const nextVelocity = velocity + acceleration * dt;
    return [angle + nextVelocity * dt, nextVelocity];
  }

  private easeOut(t: number): number {
    return 1 - (1 - t) * (1 - t);
  }
}
