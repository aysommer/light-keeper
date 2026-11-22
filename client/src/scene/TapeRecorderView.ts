import {
  BoxGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
} from 'three';
import type { BufferGeometry, Material } from 'three';
import type { Vector2 } from '@light-keeper/shared';
import { SceneCoords } from './SceneCoords.ts';

/**
 * Кассетный магнитофон на полу: тёмный корпус, окошко с двумя катушками
 * (крутятся, пока играет запись), ручка сверху и мигающий красный огонёк.
 * Сам голос — см. TapeRecorderVoice.
 */
export class TapeRecorderView {
  public readonly root = new Group();
  private readonly reels: Mesh[] = [];
  private readonly led: Mesh;
  private readonly ledMaterial = new MeshBasicMaterial({ color: '#ff2a1a' });
  private readonly geometries: BufferGeometry[] = [];
  private readonly materials: Material[] = [];

  public constructor(position: Vector2, floor: number) {
    const body = this.own(new MeshStandardMaterial({ color: '#2a2724', roughness: 0.7 }));
    const metal = this.own(
      new MeshStandardMaterial({ color: '#8d8a82', metalness: 0.6, roughness: 0.4 }),
    );
    const window = this.own(new MeshStandardMaterial({ color: '#141210', roughness: 0.2 }));
    const reelMaterial = this.own(new MeshStandardMaterial({ color: '#d8d2c0', roughness: 0.6 }));

    const box = new Mesh(this.geometry(new BoxGeometry(0.36, 0.16, 0.1)), body);
    box.position.y = 0.08;
    this.root.add(box);
    // Окошко кассеты и катушки — на передней стороне (+Z).
    const pane = new Mesh(this.geometry(new BoxGeometry(0.16, 0.07, 0.005)), window);
    pane.position.set(-0.05, 0.1, 0.051);
    this.root.add(pane);
    const reelGeometry = this.geometry(new CylinderGeometry(0.022, 0.022, 0.006, 6));
    for (const x of [-0.09, -0.01]) {
      const reel = new Mesh(reelGeometry, reelMaterial);
      reel.rotation.x = Math.PI / 2;
      reel.position.set(x, 0.1, 0.055);
      this.root.add(reel);
      this.reels.push(reel);
    }
    // Динамик-решётка справа.
    const grille = new Mesh(this.geometry(new CylinderGeometry(0.045, 0.045, 0.006, 16)), metal);
    grille.rotation.x = Math.PI / 2;
    grille.position.set(0.1, 0.085, 0.052);
    this.root.add(grille);
    const handle = new Mesh(this.geometry(new BoxGeometry(0.26, 0.015, 0.02)), metal);
    handle.position.set(0, 0.2, 0);
    this.root.add(handle);
    for (const x of [-0.12, 0.12]) {
      const post = new Mesh(this.geometry(new BoxGeometry(0.015, 0.04, 0.02)), metal);
      post.position.set(x, 0.18, 0);
      this.root.add(post);
    }
    this.led = new Mesh(this.geometry(new BoxGeometry(0.012, 0.012, 0.006)), this.ledMaterial);
    this.led.position.set(0.1, 0.145, 0.052);
    this.root.add(this.led);

    this.root.position.copy(SceneCoords.toScene(position, 0, floor));
    // Немного повёрнут — как будто его бросили.
    this.root.rotation.y = 0.6;
  }

  public update(_exit: unknown, time: number): void {
    this.reels.forEach((reel) => (reel.rotation.y = time * 3));
    this.led.visible = Math.sin(time * 4) > -0.2;
  }

  public dispose(): void {
    this.root.removeFromParent();
    this.geometries.forEach((geometry) => geometry.dispose());
    this.materials.forEach((material) => material.dispose());
    this.ledMaterial.dispose();
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
