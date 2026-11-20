import {
  Color,
  ConeGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  TorusGeometry,
} from 'three';
import type { BufferGeometry } from 'three';

/**
 * Масляный фонарь: основание, светящееся стекло, крышка и кольцо-ручка.
 * Точка подвеса (верх кольца) — в начале координат, фонарь висит вниз.
 */
export class LanternModel {
  /** Центр стекла относительно точки подвеса — сюда ставится источник света. */
  public static readonly GLASS_CENTER_Y = -0.15;

  private static readonly WARM = new Color('#ffcf7a');
  private static readonly HOT = new Color('#ff4a1c');
  private static readonly METAL_HOT = new Color('#ff3a10');

  public readonly root = new Group();
  private readonly geometries: BufferGeometry[] = [];
  private readonly metal = new MeshStandardMaterial({
    color: '#2d2a24',
    metalness: 0.6,
    roughness: 0.45,
  });
  private readonly glass = new MeshStandardMaterial({
    color: '#3a3328',
    emissive: '#ffcf7a',
    emissiveIntensity: 1.6,
    roughness: 0.2,
  });

  public constructor() {
    const handle = this.mesh(new TorusGeometry(0.035, 0.006, 8, 20), this.metal);
    handle.position.y = -0.035;
    const cap = this.mesh(new ConeGeometry(0.055, 0.04, 16), this.metal);
    cap.position.y = -0.085;
    const glass = this.mesh(new CylinderGeometry(0.042, 0.045, 0.11, 16), this.glass);
    glass.position.y = LanternModel.GLASS_CENTER_Y;
    const base = this.mesh(new CylinderGeometry(0.055, 0.055, 0.02, 16), this.metal);
    base.position.y = -0.215;
  }

  /**
   * Свечение фонаря.
   * @param level уровень света 0…~1 (яркость с мерцанием; 0 — не горит)
   * @param heatGlow заметность нагрева 0–1: стекло краснеет, металл раскаляется
   */
  public setGlow(level: number, heatGlow: number): void {
    this.glass.emissive.copy(LanternModel.WARM).lerp(LanternModel.HOT, heatGlow ** 1.5);
    this.glass.emissiveIntensity = 1.6 * level;
    this.metal.emissive.copy(LanternModel.METAL_HOT);
    this.metal.emissiveIntensity = heatGlow ** 2 * 0.8;
  }

  public dispose(): void {
    this.root.removeFromParent();
    this.geometries.forEach((geometry) => geometry.dispose());
    this.metal.dispose();
    this.glass.dispose();
  }

  private mesh(geometry: BufferGeometry, material: MeshStandardMaterial): Mesh {
    this.geometries.push(geometry);
    const mesh = new Mesh(geometry, material);
    this.root.add(mesh);
    return mesh;
  }
}
