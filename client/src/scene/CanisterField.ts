import {
  BoxGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  TorusGeometry,
} from 'three';
import type { BufferGeometry, Material, Scene } from 'three';
import { Vector2 } from '@light-keeper/shared';
import type { DroppedCanister } from '@light-keeper/shared';
import { SceneCoords } from './SceneCoords.ts';

/**
 * Канистры пространства. Полные — тёмно-красные, пустые — серые; у тех
 * и других одинаковая латунная крышка, поэтому издалека и в темноте их
 * не отличить. Подобранные скрываются, брошенные после заправки — добавляются.
 */
export class CanisterField {
  private readonly root = new Group();
  private readonly placed: Group[] = [];
  private readonly dropped: Group[] = [];
  private readonly geometries: BufferGeometry[] = [];
  private readonly full = new MeshStandardMaterial({
    color: '#8c2a1e',
    metalness: 0.4,
    roughness: 0.5,
  });
  private readonly empty = new MeshStandardMaterial({
    color: '#6b6a66',
    metalness: 0.4,
    roughness: 0.55,
  });
  private readonly cap = new MeshStandardMaterial({
    color: '#c9a227',
    emissive: '#5a4208',
    emissiveIntensity: 0.6,
    metalness: 0.8,
    roughness: 0.3,
  });
  private readonly bodyGeometry = this.geometry(new BoxGeometry(0.24, 0.32, 0.12));
  private readonly handleGeometry = this.geometry(new TorusGeometry(0.05, 0.012, 6, 12, Math.PI));
  private readonly spoutGeometry = this.geometry(new CylinderGeometry(0.022, 0.026, 0.06, 10));

  /**
   * @param spawns все канистры пространства
   * @param isFull полная ли канистра с данным номером
   */
  public constructor(scene: Scene, spawns: readonly Vector2[], isFull: (index: number) => boolean) {
    spawns.forEach((spawn, index) => {
      // Поворот детерминирован номером, чтобы у обоих игроков картинка совпадала.
      this.placed.push(this.create(spawn, index * 1.7, isFull(index) ? this.full : this.empty));
    });
    scene.add(this.root);
  }

  /** Скрывает подобранные канистры и добавляет брошенные пустые. */
  public update(taken: readonly number[] | null, dropped: readonly DroppedCanister[] | null): void {
    const set = new Set(taken ?? []);
    this.placed.forEach((canister, index) => (canister.visible = !set.has(index)));
    const drops = dropped ?? [];
    for (let i = this.dropped.length; i < drops.length; i++) {
      const drop = drops[i]!;
      this.dropped.push(this.create(new Vector2(drop.x, drop.y), 0.6 + i * 2.3, this.empty));
    }
  }

  public dispose(): void {
    this.root.removeFromParent();
    this.geometries.forEach((geometry) => geometry.dispose());
    [this.full, this.empty, this.cap].forEach((material) => material.dispose());
  }

  private create(position: Vector2, rotation: number, body: Material): Group {
    const canister = new Group();
    const shell = new Mesh(this.bodyGeometry, body);
    shell.position.y = 0.16;
    const handle = new Mesh(this.handleGeometry, body);
    handle.position.set(-0.04, 0.32, 0);
    const spout = new Mesh(this.spoutGeometry, this.cap);
    spout.position.set(0.08, 0.35, 0);
    canister.add(shell, handle, spout);
    canister.position.copy(SceneCoords.toScene(position));
    canister.rotation.y = rotation;
    this.root.add(canister);
    return canister;
  }

  private geometry<T extends BufferGeometry>(geometry: T): T {
    this.geometries.push(geometry);
    return geometry;
  }
}
