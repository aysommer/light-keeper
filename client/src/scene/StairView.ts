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
import { GameConfig, Stair } from '@light-keeper/shared';
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

    // Пролёт строим вдоль +X от точки подъёма и разворачиваем по направлению лестницы.
    const { RUN_START, RUN_END, HALF_WIDTH } = Stair;
    const run = RUN_END - RUN_START;
    const middle = (RUN_START + RUN_END) / 2;
    const heading = Math.atan2(stair.direction.y, stair.direction.x);

    // Нижний этаж: крутые ступени до проёма в потолке.
    const lower = new Group();
    lower.position.copy(SceneCoords.toScene(stair.position, 0, stair.lower));
    lower.rotation.y = heading;
    const rise = ceilingHeight / StairView.STEPS;
    const depth = run / StairView.STEPS;
    const stepGeometry = this.geometry(new BoxGeometry(depth, rise, HALF_WIDTH * 2));
    for (let i = 0; i < StairView.STEPS; i++) {
      // Каждая ступень — сплошной блок до пола (без щелей под ней).
      const step = new Mesh(stepGeometry, wood);
      step.scale.y = i + 1;
      step.position.set(RUN_START + depth * (i + 0.5), (rise * (i + 1)) / 2, 0);
      lower.add(step);
    }
    const opening = new Mesh(this.geometry(new PlaneGeometry(run, HALF_WIDTH * 2)), darkness);
    opening.rotation.x = Math.PI / 2;
    opening.position.set(middle, ceilingHeight - 0.01, 0);
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

    // Верхний этаж: проём в полу над пролётом и перила с трёх сторон (вход — со стороны точки).
    const upper = new Group();
    upper.position.copy(SceneCoords.toScene(stair.position, 0, stair.lower + 1));
    upper.rotation.y = heading;
    const hole = new Mesh(this.geometry(new PlaneGeometry(run, HALF_WIDTH * 2)), darkness);
    hole.rotation.x = -Math.PI / 2;
    hole.position.set(middle, 0.01, 0);
    upper.add(hole);
    const sideRail = this.geometry(new BoxGeometry(run, 0.05, 0.05));
    const endRail = this.geometry(new BoxGeometry(0.05, 0.05, HALF_WIDTH * 2));
    const postGeometry = this.geometry(new BoxGeometry(0.05, 0.95, 0.05));
    for (const side of [-1, 1]) {
      const rail = new Mesh(sideRail, metal);
      rail.position.set(middle, 0.95, side * HALF_WIDTH);
      upper.add(rail);
      for (const x of [RUN_START, RUN_END]) {
        const post = new Mesh(postGeometry, metal);
        post.position.set(x, 0.475, side * HALF_WIDTH);
        upper.add(post);
      }
    }
    const end = new Mesh(endRail, metal);
    end.position.set(RUN_END, 0.95, 0);
    upper.add(end);
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
