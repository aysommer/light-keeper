import {
  CylinderGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PointLight,
  Quaternion,
  SphereGeometry,
  Vector3,
} from 'three';
import type { BufferGeometry, Material } from 'three';
import type { PlayerColor } from '@light-keeper/shared';

/**
 * Трёхмерный стикмен из примитивов: шар-голова и тонкие цилиндры-конечности.
 * В правой руке — лампа с источником света. Модель смотрит в −Z (как камера с yaw = 0).
 * Анимация ходьбы появится на этапе 5.
 */
export class StickmanModel {
  public static readonly COLORS: Record<PlayerColor, string> = {
    red: '#d63a3a',
    blue: '#2e9bd6',
  };
  private static readonly LIMB_RADIUS = 0.045;

  public readonly root = new Group();
  private readonly geometries: BufferGeometry[] = [];
  private readonly materials: Material[] = [];
  private readonly lampLight: PointLight;

  public constructor(color: PlayerColor) {
    const body = new MeshStandardMaterial({
      color: StickmanModel.COLORS[color],
      roughness: 0.6,
      emissive: StickmanModel.COLORS[color],
      emissiveIntensity: 0.15,
    });
    this.materials.push(body);

    const head = new SphereGeometry(0.16, 20, 14);
    this.geometries.push(head);
    const headMesh = new Mesh(head, body);
    headMesh.position.set(0, 1.62, 0);
    this.root.add(headMesh);

    const hip = new Vector3(0, 0.92, 0);
    const neck = new Vector3(0, 1.46, 0);
    const shoulder = new Vector3(0, 1.36, 0);
    const rightHand = new Vector3(0.32, 0.98, -0.12);
    this.limb(body, hip, neck);
    this.limb(body, shoulder, new Vector3(-0.3, 1.0, 0.05));
    this.limb(body, shoulder, rightHand);
    this.limb(body, hip, new Vector3(-0.16, 0.02, 0));
    this.limb(body, hip, new Vector3(0.16, 0.02, 0));

    const lampGlass = new SphereGeometry(0.07, 16, 12);
    const lampMaterial = new MeshBasicMaterial({ color: '#fff1c4' });
    this.geometries.push(lampGlass);
    this.materials.push(lampMaterial);
    const lamp = new Mesh(lampGlass, lampMaterial);
    lamp.position.copy(rightHand).add(new Vector3(0, -0.12, 0));
    this.root.add(lamp);

    this.lampLight = new PointLight('#ffcf8a', 6, 14, 1.6);
    this.lampLight.position.copy(lamp.position);
    this.root.add(this.lampLight);
  }

  public setLampFlicker(time: number): void {
    this.lampLight.intensity =
      6 * (1 + Math.sin(time * 13.1) * 0.04 + Math.sin(time * 31.7) * 0.03);
  }

  public dispose(): void {
    this.root.removeFromParent();
    this.geometries.forEach((geometry) => geometry.dispose());
    this.materials.forEach((material) => material.dispose());
    this.lampLight.dispose();
  }

  /** Цилиндр-конечность между двумя точками. */
  private limb(material: Material, from: Vector3, to: Vector3): void {
    const direction = to.clone().sub(from);
    const geometry = new CylinderGeometry(
      StickmanModel.LIMB_RADIUS,
      StickmanModel.LIMB_RADIUS,
      direction.length(),
      10,
    );
    this.geometries.push(geometry);
    const mesh = new Mesh(geometry, material);
    mesh.position.copy(from).add(to).multiplyScalar(0.5);
    mesh.quaternion.copy(
      new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), direction.normalize()),
    );
    this.root.add(mesh);
  }
}
