import { CylinderGeometry, Group, Mesh, MeshStandardMaterial, PointLight } from 'three';
import { LampRules } from '@light-keeper/shared';
import type { HeldItem, LampSnapshot, PlayerColor } from '@light-keeper/shared';
import { LampFlame } from '../game/LampFlame.ts';
import { StickmanAnimator } from '../game/StickmanAnimator.ts';
import { GroundShadow } from './GroundShadow.ts';
import { LanternModel } from './LanternModel.ts';
import { StickmanRig } from './StickmanRig.ts';

/**
 * Стикмен напарника: шарнирный скелет с процедурной анимацией шага и бега.
 * В правой руке — горящий фонарь (освещает мир) или компас (фонарь убран).
 */
export class StickmanModel {
  public static readonly COLORS: Record<PlayerColor, string> = {
    red: '#d63a3a',
    blue: '#2e9bd6',
  };
  private static readonly LAMP_INTENSITY = 6;

  public readonly root: Group;
  private readonly rig: StickmanRig;
  private readonly animator = new StickmanAnimator();
  private readonly bodyMaterial: MeshStandardMaterial;
  private readonly lampSwing = new Group();
  private readonly lantern = new LanternModel();
  private readonly lampLight: PointLight;
  private readonly compass: Mesh;
  private readonly shadow = new GroundShadow(0.85);
  private readonly compassMaterial = new MeshStandardMaterial({
    color: '#c9a227',
    metalness: 0.8,
    roughness: 0.35,
  });

  public constructor(color: PlayerColor) {
    this.bodyMaterial = StickmanRig.bodyMaterial(StickmanModel.COLORS[color]);
    this.rig = new StickmanRig(this.bodyMaterial);
    this.root = this.rig.root;

    this.rig.rightHand.add(this.lampSwing);
    this.lampSwing.add(this.lantern.root);
    this.lampLight = new PointLight('#ffcf8a', StickmanModel.LAMP_INTENSITY, 14, 1.6);
    this.lampLight.position.y = LanternModel.GLASS_CENTER_Y;
    this.lampSwing.add(this.lampLight);

    // Компас в руке — плоский латунный диск.
    this.compass = new Mesh(new CylinderGeometry(0.05, 0.05, 0.015, 20), this.compassMaterial);
    this.compass.position.set(0, -0.02, -0.03);
    this.compass.rotation.x = Math.PI / 2;
    this.rig.rightHand.add(this.compass);

    this.shadow.attach(this.root, 0.9);
  }

  /**
   * @param signedSpeed скорость, м/с (отрицательная — пятится)
   * @param item что в руке
   * @param lamp состояние его лампы (из снимка сервера)
   * @param reach насколько рука протянута при обмене лампами, 0–1
   */
  public update(
    deltaSeconds: number,
    time: number,
    signedSpeed: number,
    item: HeldItem,
    lamp: LampSnapshot | null,
    reach = 0,
  ): void {
    const animated = this.animator.update(deltaSeconds, signedSpeed, item);
    const pose = {
      ...animated,
      rightShoulder: animated.rightShoulder + reach * 1.1,
      rightElbow: animated.rightElbow * (1 - reach * 0.7),
    };
    this.rig.applyPose(pose);
    this.lampSwing.rotation.x = pose.lampSwing;

    const lampInHand = item === 'lamp';
    this.lantern.root.visible = lampInHand;
    this.compass.visible = item === 'compass';
    const brightness = lampInHand && lamp ? LampRules.brightness(lamp) : 0;
    const level = LampFlame.level(time, brightness, 1.3);
    this.lampLight.visible = level > 0;
    this.lampLight.intensity = StickmanModel.LAMP_INTENSITY * level;
    this.lampLight.distance = 5 + 9 * Math.min(1, level);
    this.lantern.setGlow(level, LampFlame.heatGlow(lamp?.heat ?? 0));
  }

  public dispose(): void {
    this.shadow.dispose();
    this.rig.dispose();
    this.lantern.dispose();
    this.lampLight.dispose();
    this.compass.geometry.dispose();
    this.compassMaterial.dispose();
    this.bodyMaterial.dispose();
  }
}
