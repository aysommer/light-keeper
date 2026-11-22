import {
  BoxGeometry,
  CylinderGeometry,
  DoubleSide,
  Group,
  Mesh,
  MeshStandardMaterial,
  PlaneGeometry,
  PointLight,
  Vector3,
} from 'three';
import { LampRules } from '@light-keeper/shared';
import type { HeldItem, LampSnapshot, PlayerColor } from '@light-keeper/shared';
import { Blinker } from '../game/Blinker.ts';
import { LampFlame } from '../game/LampFlame.ts';
import { StickmanAnimator } from '../game/StickmanAnimator.ts';
import { CharacterAssets } from './CharacterAssets.ts';
import { CharacterBody } from './CharacterBody.ts';
import { GooseModel } from './GooseModel.ts';
import { GroundShadow } from './GroundShadow.ts';
import { LanternModel } from './LanternModel.ts';
import { StickmanRig } from './StickmanRig.ts';

/**
 * Напарник на сцене. Главные герои — модели Kenney (мальчик в рыжей футболке
 * у красного игрока, усач у голубого) со скелетной анимацией и морганием;
 * стикмен не показывается никогда (его скелет служит только точкой руки до загрузки).
 * В правой руке — горящий фонарь (освещает мир), компас, ключ или записка.
 */
export class StickmanModel {
  public static readonly COLORS: Record<PlayerColor, string> = {
    red: '#d63a3a',
    blue: '#2e9bd6',
  };
  private static readonly LAMP_INTENSITY = 6;

  public readonly root = new Group();
  private readonly rig: StickmanRig;
  /** Точка правой кисти (в координатах `root`): за ней следуют предметы в руке. */
  private readonly hand = new Group();
  private character: CharacterBody | null = null;
  /** Пойманный гусь-призрак сидит на спине (модель смотрит в −Z, спина — +Z). */
  private gooseOnBack: GooseModel | null = null;
  private disposed = false;
  private readonly handWorld = new Vector3();
  private readonly animator = new StickmanAnimator();
  private readonly blinker = new Blinker();
  private readonly bodyMaterial: MeshStandardMaterial;
  private readonly lampSwing = new Group();
  private readonly lantern = new LanternModel();
  private readonly lampLight: PointLight;
  private readonly compass: Mesh;
  private readonly shadow = new GroundShadow(0.85);
  /** Ключ и записка в руке напарника (издалека — просто латунь и белый листок). */
  private readonly key: Mesh;
  private readonly note: Mesh;
  private readonly noteMaterial = new MeshStandardMaterial({
    color: '#f1ead2',
    roughness: 0.9,
    side: DoubleSide,
  });
  private readonly compassMaterial = new MeshStandardMaterial({
    color: '#c9a227',
    metalness: 0.8,
    roughness: 0.35,
  });

  public constructor(color: PlayerColor) {
    this.bodyMaterial = StickmanRig.bodyMaterial(StickmanModel.COLORS[color]);
    this.rig = new StickmanRig(this.bodyMaterial);
    this.root.add(this.rig.root, this.hand);
    // Стикмен не показывается: его скелет нужен только чтобы знать, где рука,
    // пока не загрузилась модель героя.
    this.rig.root.visible = false;

    this.hand.add(this.lampSwing);
    this.lampSwing.add(this.lantern.root);
    this.lampLight = new PointLight('#ffcf8a', StickmanModel.LAMP_INTENSITY, 14, 1.6);
    this.lampLight.position.y = LanternModel.GLASS_CENTER_Y;
    this.lampSwing.add(this.lampLight);

    // Компас в руке — плоский латунный диск.
    this.compass = new Mesh(new CylinderGeometry(0.05, 0.05, 0.015, 20), this.compassMaterial);
    this.compass.position.set(0, -0.02, -0.03);
    this.compass.rotation.x = 0.6;
    this.hand.add(this.compass);

    this.key = new Mesh(new BoxGeometry(0.02, 0.1, 0.01), this.compassMaterial);
    this.key.position.set(0, -0.06, -0.02);
    this.hand.add(this.key);
    this.note = new Mesh(new PlaneGeometry(0.15, 0.1), this.noteMaterial);
    this.note.position.set(0, -0.02, -0.06);
    this.note.rotation.x = -0.6;
    this.hand.add(this.note);

    this.shadow.attach(this.root, 0.9);

    void CharacterAssets.load()
      .then((assets) => {
        if (this.disposed) return;
        this.character = new CharacterBody(assets, color);
        this.root.add(this.character.root);
        this.rig.root.visible = false;
      })
      .catch(() => {
        // Модели не загрузились — остаётся стикмен.
      });
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
    const eyesOpen = this.blinker.update(deltaSeconds);
    if (this.character) {
      this.character.update(deltaSeconds, signedSpeed, eyesOpen);
    } else {
      this.rig.applyPose(pose);
      this.rig.setEyesOpen(eyesOpen);
    }
    this.lampSwing.rotation.x = pose.lampSwing;
    this.gooseOnBack?.update(deltaSeconds, 0);
    this.followHand(reach);

    const lampInHand = item === 'lamp';
    this.lantern.root.visible = lampInHand;
    this.compass.visible = item === 'compass';
    this.key.visible = item === 'key';
    this.note.visible = item === 'note';
    const brightness = lampInHand && lamp ? LampRules.brightness(lamp) : 0;
    const level = LampFlame.level(time, brightness, 1.3);
    this.lampLight.visible = level > 0;
    this.lampLight.intensity = StickmanModel.LAMP_INTENSITY * level;
    this.lampLight.distance = 5 + 9 * Math.min(1, level);
    this.lantern.setGlow(level, LampFlame.heatGlow(lamp?.heat ?? 0));
  }

  /** Гусь на спине: показать или убрать. */
  public setGooseOnBack(carrying: boolean): void {
    if (carrying && !this.gooseOnBack) {
      this.gooseOnBack = new GooseModel();
      this.gooseOnBack.root.scale.setScalar(0.8);
      this.gooseOnBack.root.position.set(0, 1.05, 0.22);
      this.root.add(this.gooseOnBack.root);
    } else if (!carrying && this.gooseOnBack) {
      this.gooseOnBack.dispose();
      this.gooseOnBack = null;
    }
  }

  /** Предметы в руке следуют за кистью текущего тела (при передаче лампы — тянутся вперёд). */
  private followHand(reach: number): void {
    this.root.updateMatrixWorld(true);
    const world =
      this.character?.handPosition(this.handWorld) ??
      this.rig.rightHand.getWorldPosition(this.handWorld);
    this.hand.position.copy(this.root.worldToLocal(world));
    this.hand.position.z -= reach * 0.3;
    this.hand.position.y += reach * 0.15;
  }

  public dispose(): void {
    this.disposed = true;
    this.gooseOnBack?.dispose();
    this.character?.dispose();
    this.shadow.dispose();
    this.key.geometry.dispose();
    this.note.geometry.dispose();
    this.noteMaterial.dispose();
    this.rig.dispose();
    this.lantern.dispose();
    this.lampLight.dispose();
    this.compass.geometry.dispose();
    this.compassMaterial.dispose();
    this.bodyMaterial.dispose();
  }
}
