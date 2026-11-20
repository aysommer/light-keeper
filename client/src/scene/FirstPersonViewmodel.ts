import {
  CylinderGeometry,
  Group,
  HemisphereLight,
  Mesh,
  PointLight,
  SphereGeometry,
  Vector3,
} from 'three';
import type { BufferGeometry, MeshStandardMaterial, Scene } from 'three';
import type { HeldItem, PlayerColor } from '@light-keeper/shared';
import { ItemSwitcher } from '../game/ItemSwitcher.ts';
import { LanternModel } from './LanternModel.ts';
import { StickmanModel } from './StickmanModel.ts';
import { StickmanRig } from './StickmanRig.ts';

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
}

/**
 * Своя рука от первого лица: тонкая рука цвета игрока с висящим фонарём.
 * Рисуется отдельной сценой поверх мира (см. SceneManager), поэтому не утопает
 * в стенах. Рука качается при ходьбе, запаздывает при поворотах; фонарь —
 * маятник. При смене предмета рука опускается и поднимается; с компасом
 * в руке фонарь убран (сам компас — на экране, см. CompassView).
 */
export class FirstPersonViewmodel {
  private static readonly HAND = new Vector3(0.22, -0.1, -0.6);
  /** Фонарь в руке чуть меньше настоящего, чтобы не загораживать обзор. */
  private static readonly LANTERN_SCALE = 0.8;
  private static readonly SHOULDER = new Vector3(0.44, -0.62, 0.05);
  private static readonly LOWERED_OFFSET = 0.5;
  private static readonly ARM_RADIUS = 0.016;
  private static readonly FIST_RADIUS = 0.024;

  private readonly root = new Group();
  private readonly lampPivot = new Group();
  private readonly lantern = new LanternModel();
  private readonly glow = new PointLight('#ffcf8a', 1.2, 1.5, 1.5);
  private readonly material: MeshStandardMaterial;
  private readonly geometries: BufferGeometry[] = [];
  private readonly switcher = new ItemSwitcher();
  private swayX = 0;
  private swayY = 0;
  private swingSide = 0;
  private swingSideVelocity = 0;
  private swingForward = 0;
  private swingForwardVelocity = 0;
  private walkAmount = 0;

  public constructor(
    private readonly scene: Scene,
    color: PlayerColor,
  ) {
    this.material = StickmanRig.bodyMaterial(StickmanModel.COLORS[color]);
    scene.add(new HemisphereLight('#fff1c4', '#2b2414', 0.45));
    scene.add(this.root);

    const hand = FirstPersonViewmodel.HAND;
    const shoulder = FirstPersonViewmodel.SHOULDER;
    const direction = hand.clone().sub(shoulder);
    const armGeometry = this.geometry(
      new CylinderGeometry(
        FirstPersonViewmodel.ARM_RADIUS,
        FirstPersonViewmodel.ARM_RADIUS,
        direction.length(),
        12,
      ),
    );
    const arm = new Mesh(armGeometry, this.material);
    arm.position.copy(shoulder).add(hand).multiplyScalar(0.5);
    arm.quaternion.setFromUnitVectors(new Vector3(0, 1, 0), direction.normalize());
    this.root.add(arm);
    const fist = new Mesh(
      this.geometry(new SphereGeometry(FirstPersonViewmodel.FIST_RADIUS, 14, 10)),
      this.material,
    );
    fist.position.copy(hand);
    this.root.add(fist);

    this.lampPivot.position.copy(hand).add(new Vector3(0, -0.02, 0));
    this.root.add(this.lampPivot);
    this.lampPivot.add(this.lantern.root);
    this.lantern.root.scale.setScalar(FirstPersonViewmodel.LANTERN_SCALE);
    this.glow.position.y = LanternModel.GLASS_CENTER_Y * FirstPersonViewmodel.LANTERN_SCALE;
    this.lampPivot.add(this.glow);
  }

  /** Виден ли фонарь в руке и поднят ли он (тогда лампа светит в мир). */
  public get lampRaised(): boolean {
    return this.lantern.root.visible && this.root.visible;
  }

  public update(deltaSeconds: number, time: number, motion: ViewmodelMotion): void {
    const dt = Math.max(1e-4, Math.min(deltaSeconds, 0.1));
    const shown = this.switcher.update(dt, motion.wanted);
    const lampShown = shown.item === 'lamp';
    this.lantern.root.visible = lampShown;
    this.glow.visible = lampShown;
    // С компасом рука пустая — её не показываем, компас на экране.
    this.root.visible = lampShown && shown.raise > 0;

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
    this.root.position.set(this.swayX + bobX, this.swayY + bobY + breathe - lowered, 0);

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
    this.lampPivot.rotation.set(this.swingForward, 0, this.swingSide);

    const flicker = 1 + Math.sin(time * 11) * 0.04 + Math.sin(time * 27.7) * 0.03;
    this.lantern.setLit(true, flicker);
    this.glow.intensity = 1.2 * flicker;
  }

  public dispose(): void {
    this.root.removeFromParent();
    this.lantern.dispose();
    this.glow.dispose();
    this.material.dispose();
    this.geometries.forEach((geometry) => geometry.dispose());
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

  private geometry<T extends BufferGeometry>(geometry: T): T {
    this.geometries.push(geometry);
    return geometry;
  }
}
