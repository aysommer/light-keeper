import {
  BoxGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  TorusGeometry,
} from 'three';
import type { BufferGeometry, Scene } from 'three';
import type { Vector2 } from '@light-keeper/shared';
import { SceneCoords } from './SceneCoords.ts';

/**
 * Канистры с маслом в пространстве: тёмно-красные с латунной крышкой,
 * которая слегка поблёскивает в темноте. Подобранные скрываются.
 * Геометрия и материалы общие для всех канистр.
 */
export class CanisterField {
  private readonly root = new Group();
  private readonly canisters: Group[] = [];
  private readonly geometries: BufferGeometry[] = [];
  private readonly body = new MeshStandardMaterial({
    color: '#8c2a1e',
    metalness: 0.4,
    roughness: 0.5,
  });
  private readonly cap = new MeshStandardMaterial({
    color: '#c9a227',
    emissive: '#5a4208',
    emissiveIntensity: 0.6,
    metalness: 0.8,
    roughness: 0.3,
  });

  public constructor(scene: Scene, spawns: readonly Vector2[]) {
    const bodyGeometry = this.geometry(new BoxGeometry(0.24, 0.32, 0.12));
    const handleGeometry = this.geometry(new TorusGeometry(0.05, 0.012, 6, 12, Math.PI));
    const spoutGeometry = this.geometry(new CylinderGeometry(0.022, 0.026, 0.06, 10));
    spawns.forEach((spawn, index) => {
      const canister = new Group();
      const body = new Mesh(bodyGeometry, this.body);
      body.position.y = 0.16;
      const handle = new Mesh(handleGeometry, this.body);
      handle.position.set(-0.04, 0.32, 0);
      const spout = new Mesh(spoutGeometry, this.cap);
      spout.position.set(0.08, 0.35, 0);
      canister.add(body, handle, spout);
      canister.position.copy(SceneCoords.toScene(spawn));
      // Поворот детерминирован номером, чтобы у обоих игроков картинка совпадала.
      canister.rotation.y = index * 1.7;
      this.root.add(canister);
      this.canisters.push(canister);
    });
    scene.add(this.root);
  }

  /** Скрывает подобранные канистры. */
  public update(taken: readonly number[] | null): void {
    const set = new Set(taken ?? []);
    this.canisters.forEach((canister, index) => (canister.visible = !set.has(index)));
  }

  public dispose(): void {
    this.root.removeFromParent();
    this.geometries.forEach((geometry) => geometry.dispose());
    this.body.dispose();
    this.cap.dispose();
  }

  private geometry<T extends BufferGeometry>(geometry: T): T {
    this.geometries.push(geometry);
    return geometry;
  }
}
