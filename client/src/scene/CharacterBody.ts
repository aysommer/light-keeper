import { AnimationMixer, CanvasTexture, Group, MeshStandardMaterial, SRGBColorSpace } from 'three';
import type { AnimationAction, Bone, Object3D, SkinnedMesh, Vector3 } from 'three';
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import type { PlayerColor } from '@light-keeper/shared';
import type { LoadedCharacters } from './CharacterAssets.ts';

/**
 * Тело героя из модели Kenney: скелетная анимация покоя и бега (бег замедляется
 * при ходьбе и проигрывается назад, когда герой пятится) и моргание —
 * подменой текстуры лица на копию с закрытыми глазами.
 */
export class CharacterBody {
  /** Рост героя, м. */
  private static readonly HEIGHT = 1.75;
  /** При какой скорости анимация бега идёт с обычной скоростью, м/с. */
  private static readonly RUN_ANIMATION_SPEED = 3.6;

  public readonly root = new Group();
  private readonly mixer: AnimationMixer;
  private readonly idle: AnimationAction;
  private readonly run: AnimationAction;
  private readonly hand: Bone | null;
  private readonly material: MeshStandardMaterial;
  private readonly openTexture: CanvasTexture;
  private readonly closedTexture: CanvasTexture;
  /** Доля бега в смеси анимаций, 0 — покой, 1 — бег. */
  private runBlend = 0;

  public constructor(assets: LoadedCharacters, color: PlayerColor) {
    const model = clone(assets.model);
    const height = 376.5;
    model.scale.setScalar(CharacterBody.HEIGHT / height);
    // Модель Kenney смотрит в +Z, а у нас герой смотрит в −Z.
    model.rotation.y = Math.PI;
    this.root.add(model);

    const skin = assets.skins[color];
    this.openTexture = this.texture(skin.open);
    this.closedTexture = this.texture(skin.closed);
    this.material = new MeshStandardMaterial({ map: this.openTexture, roughness: 0.85 });
    let hand: Bone | null = null;
    model.traverse((object: Object3D) => {
      const mesh = object as SkinnedMesh;
      if (mesh.isSkinnedMesh) {
        mesh.material = this.material;
        mesh.frustumCulled = false;
      }
      if ((object as Bone).isBone && object.name === 'RightHand') hand = object as Bone;
    });
    this.hand = hand;

    this.mixer = new AnimationMixer(model);
    this.idle = this.mixer.clipAction(assets.idle);
    this.run = this.mixer.clipAction(assets.run);
    // Обе анимации играют всегда, а смешиваются весами — без рывков и Т-позы.
    this.idle.play();
    this.run.play();
    this.applyBlend();
  }

  /**
   * @param signedSpeed скорость, м/с (отрицательная — пятится)
   * @param eyesOpen насколько открыты глаза (0 — закрыты)
   */
  public update(deltaSeconds: number, signedSpeed: number, eyesOpen: number): void {
    const dt = Math.max(0, Math.min(deltaSeconds, 0.1));
    const speed = Math.abs(signedSpeed);
    const target = speed > 0.25 ? 1 : 0;
    this.runBlend += (target - this.runBlend) * (1 - Math.exp(-dt * 10));
    this.applyBlend();
    if (speed > 0.25) {
      const rate = Math.max(0.45, Math.min(1.4, speed / CharacterBody.RUN_ANIMATION_SPEED));
      this.run.timeScale = (signedSpeed < 0 ? -1 : 1) * rate;
    }
    this.mixer.update(dt);
    const map = eyesOpen < 0.5 ? this.closedTexture : this.openTexture;
    if (this.material.map !== map) {
      this.material.map = map;
    }
  }

  /** Где сейчас правая кисть (мировые координаты). */
  public handPosition(target: Vector3): Vector3 | null {
    return this.hand ? this.hand.getWorldPosition(target) : null;
  }

  public dispose(): void {
    this.mixer.stopAllAction();
    this.root.removeFromParent();
    this.material.dispose();
    this.openTexture.dispose();
    this.closedTexture.dispose();
  }

  private applyBlend(): void {
    this.idle.setEffectiveWeight(1 - this.runBlend);
    this.run.setEffectiveWeight(this.runBlend);
  }

  private texture(canvas: HTMLCanvasElement): CanvasTexture {
    const texture = new CanvasTexture(canvas);
    texture.colorSpace = SRGBColorSpace;
    return texture;
  }
}
