import {
  ConeGeometry,
  Group,
  IcosahedronGeometry,
  Mesh,
  MeshStandardMaterial,
  SphereGeometry,
} from 'three';
import type { BufferGeometry, Material } from 'three';

/**
 * Гусь-призрак: низкополигональный, полупрозрачный и бледно светится (как
 * привидения), с оранжевым клювом. Смотрит в −Z. Переваливается на ходу.
 */
export class GooseModel {
  public readonly root = new Group();
  private readonly body = new Group();
  private readonly neck = new Group();
  private readonly geometries: BufferGeometry[] = [];
  private readonly materials: Material[] = [];
  private phase = Math.random() * 10;

  public constructor() {
    const ghost = this.own(
      new MeshStandardMaterial({
        color: '#f6f8ff',
        emissive: '#cfd8ff',
        emissiveIntensity: 0.5,
        roughness: 0.8,
        flatShading: true,
        transparent: true,
        opacity: 0.6,
        depthWrite: false,
      }),
    );
    const beak = this.own(
      new MeshStandardMaterial({
        color: '#ff9a2e',
        emissive: '#a24f00',
        emissiveIntensity: 0.5,
        flatShading: true,
        transparent: true,
        opacity: 0.85,
      }),
    );
    const eye = this.own(new MeshStandardMaterial({ color: '#101014' }));

    const torso = new Mesh(this.geometry(new IcosahedronGeometry(0.17, 1)), ghost);
    torso.scale.set(0.85, 0.75, 1.35);
    torso.position.y = 0.25;
    const tail = new Mesh(this.geometry(new ConeGeometry(0.07, 0.14, 5)), ghost);
    tail.rotation.x = -1.2;
    tail.position.set(0, 0.32, 0.22);
    this.body.add(torso, tail);

    this.neck.position.set(0, 0.32, -0.17);
    const neckMesh = new Mesh(this.geometry(new ConeGeometry(0.05, 0.32, 6)), ghost);
    neckMesh.position.y = 0.14;
    neckMesh.rotation.x = 0.25;
    const head = new Mesh(this.geometry(new IcosahedronGeometry(0.065, 1)), ghost);
    head.position.set(0, 0.31, -0.04);
    const beakMesh = new Mesh(this.geometry(new ConeGeometry(0.03, 0.1, 5)), beak);
    beakMesh.rotation.x = -Math.PI / 2;
    beakMesh.position.set(0, 0.3, -0.13);
    this.neck.add(neckMesh, head, beakMesh);
    for (const side of [-1, 1]) {
      const eyeMesh = new Mesh(this.geometry(new SphereGeometry(0.012, 6, 4)), eye);
      eyeMesh.position.set(side * 0.045, 0.33, -0.08);
      this.neck.add(eyeMesh);
    }
    this.body.add(this.neck);
    for (const side of [-1, 1]) {
      const leg = new Mesh(this.geometry(new ConeGeometry(0.02, 0.12, 4)), beak);
      leg.rotation.x = Math.PI;
      leg.position.set(side * 0.06, 0.07, 0);
      this.body.add(leg);
    }
    this.root.add(this.body);
  }

  /** @param speed скорость, м/с — гусь переваливается и вытягивает шею */
  public update(deltaSeconds: number, speed: number): void {
    this.phase += deltaSeconds * (speed > 0.1 ? 16 : 3);
    const waddle = Math.sin(this.phase);
    this.body.rotation.z = waddle * (speed > 0.1 ? 0.18 : 0.04);
    this.body.position.y = Math.abs(waddle) * (speed > 0.1 ? 0.04 : 0);
    this.neck.rotation.x = speed > 0.1 ? 0.5 : Math.sin(this.phase * 0.3) * 0.15;
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
