import {
  BoxGeometry,
  CylinderGeometry,
  DoubleSide,
  Group,
  Mesh,
  MeshStandardMaterial,
  Shape,
  ShapeGeometry,
} from 'three';
import type { BufferGeometry, Material } from 'three';

/** Флажок-ориентир: тонкое древко и треугольное красно-оранжевое полотнище (слегка светится). */
export class FlagModel {
  public readonly root = new Group();
  private readonly cloth: Mesh;
  private readonly geometries: BufferGeometry[] = [];
  private readonly materials: Material[] = [];

  public constructor(height = 0.9) {
    const pole = this.own(new MeshStandardMaterial({ color: '#c8c2b0', metalness: 0.4 }));
    const fabric = this.own(
      new MeshStandardMaterial({
        color: '#ff5a2a',
        emissive: '#8a1f05',
        emissiveIntensity: 0.6,
        side: DoubleSide,
        flatShading: true,
      }),
    );
    const stick = new Mesh(this.geometry(new CylinderGeometry(0.012, 0.012, height, 6)), pole);
    stick.position.y = height / 2;
    const base = new Mesh(this.geometry(new BoxGeometry(0.12, 0.03, 0.12)), pole);
    base.position.y = 0.015;
    // Вымпел: треугольник от древка в сторону (+X), сверху.
    const pennant = new Shape();
    pennant.moveTo(0, 0);
    pennant.lineTo(0.3, -0.08);
    pennant.lineTo(0, -0.17);
    pennant.closePath();
    this.cloth = new Mesh(this.geometry(new ShapeGeometry(pennant)), fabric);
    this.cloth.position.set(0.012, height - 0.02, 0);
    this.root.add(stick, base, this.cloth);
  }

  /** Полотнище чуть колышется. */
  public update(time: number): void {
    this.cloth.rotation.y = Math.sin(time * 2.3) * 0.3;
  }

  public dispose(): void {
    this.root.removeFromParent();
    this.geometries.forEach((geometry) => geometry.dispose());
    this.materials.forEach((material) => material.dispose());
  }

  private geometry<T extends BufferGeometry>(geometry: T): T {
    this.geometries.push(geometry);
    return geometry;
  }

  private own<T extends Material>(material: T): T {
    this.materials.push(material);
    return material;
  }
}
