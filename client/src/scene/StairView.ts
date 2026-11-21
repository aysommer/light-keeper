import {
  BoxGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  PointLight,
} from 'three';
import type { BufferGeometry, Material } from 'three';
import { GameConfig } from '@light-keeper/shared';
import type { Stair } from '@light-keeper/shared';
import { SceneCoords } from './SceneCoords.ts';

/**
 * Лестница между этажами: внизу — пролёт ступеней, уходящий в тёмный проём
 * в потолке; наверху — тёмный проём в полу с перилами. Над лестницей горит
 * лампа, чтобы её было видно издалека. Подъём — `E` у лестницы.
 */
export class StairView {
  private static readonly STEPS = 9;

  public readonly root = new Group();
  private readonly geometries: BufferGeometry[] = [];
  private readonly materials: Material[] = [];

  public constructor(stair: Stair) {
    const { ceilingHeight } = GameConfig.world;
    const wood = this.own(new MeshStandardMaterial({ color: '#6b5235', roughness: 0.85 }));
    const metal = this.own(
      new MeshStandardMaterial({ color: '#3d3a35', metalness: 0.6, roughness: 0.5 }),
    );
    const darkness = this.own(new MeshBasicMaterial({ color: '#050403' }));

    // Нижний этаж: ступени поднимаются вдоль +x к проёму в потолке.
    const lower = new Group();
    lower.position.copy(SceneCoords.toScene(stair.position, 0, stair.lower));
    const rise = ceilingHeight / StairView.STEPS;
    const stepGeometry = this.geometry(new BoxGeometry(0.32, rise, 1));
    for (let i = 0; i < StairView.STEPS; i++) {
      const step = new Mesh(stepGeometry, wood);
      step.position.set(0.5 + i * 0.3, rise * (i + 0.5), 0);
      step.scale.y = 1;
      lower.add(step);
    }
    const opening = new Mesh(this.geometry(new PlaneGeometry(1.4, 1.2)), darkness);
    opening.rotation.x = Math.PI / 2;
    opening.position.set(1.9, ceilingHeight - 0.01, 0);
    lower.add(opening);
    const light = new PointLight('#ffd590', 1.8, 4.5, 1.6);
    light.position.set(0, ceilingHeight - 0.4, 0);
    lower.add(light);
    const bulb = new Mesh(
      this.geometry(new BoxGeometry(0.2, 0.05, 0.2)),
      this.own(new MeshBasicMaterial({ color: '#ffe2a0' })),
    );
    bulb.position.set(0, ceilingHeight - 0.03, 0);
    lower.add(bulb);

    // Верхний этаж: проём в полу над ступенями и перила вокруг него.
    const upper = new Group();
    upper.position.copy(SceneCoords.toScene(stair.position, 0, stair.lower + 1));
    const hole = new Mesh(this.geometry(new PlaneGeometry(1.4, 1.2)), darkness);
    hole.rotation.x = -Math.PI / 2;
    hole.position.set(1.9, 0.01, 0);
    upper.add(hole);
    const railGeometry = this.geometry(new BoxGeometry(1.4, 0.05, 0.05));
    const postGeometry = this.geometry(new BoxGeometry(0.05, 0.95, 0.05));
    for (const side of [-1, 1]) {
      const rail = new Mesh(railGeometry, metal);
      rail.position.set(1.9, 0.95, side * 0.62);
      upper.add(rail);
      for (const x of [1.2, 2.6]) {
        const post = new Mesh(postGeometry, metal);
        post.position.set(x, 0.475, side * 0.62);
        upper.add(post);
      }
    }
    // Наверху — только светящийся плафон (без лишнего источника света: этажей бывает три).
    const upperBulb = new Mesh(bulb.geometry, bulb.material);
    upperBulb.position.copy(bulb.position);
    upper.add(upperBulb);

    this.root.add(lower, upper);
  }

  public dispose(): void {
    this.root.removeFromParent();
    this.root.traverse((object) => {
      if (object instanceof PointLight) object.dispose();
    });
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
