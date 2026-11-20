import {
  DoubleSide,
  Group,
  LatheGeometry,
  Mesh,
  MeshStandardMaterial,
  Vector2 as Point,
} from 'three';

/**
 * Привидение: белая полупрозрачная «простыня» без лица, светится в темноте,
 * парит, покачивается, подол колышется. При растворении тает.
 */
export class GhostModel {
  private static readonly OPACITY = 0.55;
  private static readonly FLOAT_HEIGHT = 0.12;

  public readonly root = new Group();
  private readonly sheet: Mesh;
  private readonly geometry: LatheGeometry;
  private readonly material = new MeshStandardMaterial({
    color: '#eef2ff',
    emissive: '#cfd8ff',
    emissiveIntensity: 0.45,
    transparent: true,
    opacity: GhostModel.OPACITY,
    roughness: 0.9,
    side: DoubleSide,
    depthWrite: false,
  });
  private readonly phase = Math.random() * Math.PI * 2;
  private fade = 1;

  public constructor() {
    // Профиль «простыни» от макушки вниз: голова, плечи, расширяющийся подол.
    const profile = [
      [0.001, 1.85],
      [0.12, 1.82],
      [0.19, 1.7],
      [0.2, 1.55],
      [0.17, 1.42],
      [0.24, 1.3],
      [0.3, 0.9],
      [0.36, 0.45],
      [0.42, 0.08],
    ].map(([x, y]) => new Point(x, y));
    this.geometry = new LatheGeometry(profile, 24);
    this.sheet = new Mesh(this.geometry, this.material);
    this.root.add(this.sheet);
  }

  /** @param fading растворяется в свете */
  public update(time: number, deltaSeconds: number, fading: boolean): void {
    const t = time + this.phase;
    this.sheet.position.y = GhostModel.FLOAT_HEIGHT + Math.sin(t * 1.7) * 0.06;
    this.sheet.rotation.z = Math.sin(t * 1.1) * 0.05;
    this.sheet.rotation.y = t * 0.3;
    // Подол «дышит».
    const breathe = 1 + Math.sin(t * 2.3) * 0.04;
    this.sheet.scale.set(breathe, 1, 2 - breathe);
    this.fade = fading
      ? Math.max(0, this.fade - deltaSeconds * 1.2)
      : Math.min(1, this.fade + deltaSeconds * 2);
    this.material.opacity = GhostModel.OPACITY * this.fade;
    this.material.emissiveIntensity = 0.45 * this.fade;
  }

  public dispose(): void {
    this.root.removeFromParent();
    this.geometry.dispose();
    this.material.dispose();
  }
}
