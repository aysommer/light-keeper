import {
  BoxGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  PointLight,
  SphereGeometry,
} from 'three';
import type { BufferGeometry, Material } from 'three';
import { GameConfig } from '@light-keeper/shared';
import type { ExitDoor, ExitSnapshot } from '@light-keeper/shared';
import type { MaterialLibrary } from './MaterialLibrary.ts';
import { SceneCoords } from './SceneCoords.ts';

/**
 * Дверь выхода в стене. Вид зависит от типа:
 * - обычная — деревянная, из-под неё пробивается тёплый свет;
 * - скрытая — полотно в тех же обоях, видна только после проявления;
 * - запертая — стальная, с латунной накладкой замка.
 * Открытая дверь распахивается в комнату, за ней — темнота тамбура.
 */
export class ExitDoorView {
  private static readonly OPEN_ANGLE = -1.35;
  private static readonly FRAME_WIDTH = 0.07;

  public readonly root = new Group();
  private readonly hinge = new Group();
  private readonly glow: Group | null;
  private readonly geometries: BufferGeometry[] = [];
  private readonly materials: Material[] = [];
  private angle = 0;

  public constructor(exit: ExitDoor, spaceMaterials: MaterialLibrary) {
    const { doorWidth: width, doorHeight: height } = GameConfig.exit;
    const halfWall = GameConfig.world.wallThickness / 2;

    // Группа стоит на поверхности стены; её локальная ось +Z смотрит в комнату.
    const face = exit.position.add(exit.normal.scale(halfWall));
    this.root.position.copy(SceneCoords.toScene(face));
    this.root.rotation.y = Math.atan2(exit.normal.x, -exit.normal.y);

    const darkness = this.own(new MeshBasicMaterial({ color: '#000000' }));
    const panelMaterial =
      exit.kind === 'hidden'
        ? spaceMaterials.wall
        : this.own(
            new MeshStandardMaterial({
              color: exit.kind === 'locked' ? '#4f555c' : '#6b4a2f',
              roughness: exit.kind === 'locked' ? 0.45 : 0.8,
              metalness: exit.kind === 'locked' ? 0.6 : 0,
            }),
          );
    const frameMaterial =
      exit.kind === 'hidden'
        ? this.own(new MeshStandardMaterial({ color: '#2b2618', roughness: 0.9 }))
        : spaceMaterials.trim;
    const brass = this.own(
      new MeshStandardMaterial({ color: '#c9a227', metalness: 0.8, roughness: 0.35 }),
    );

    // Темнота за дверью.
    const voidPlane = new Mesh(this.geometry(new PlaneGeometry(width, height)), darkness);
    voidPlane.position.set(0, height / 2, 0.004);
    this.root.add(voidPlane);

    // Наличник: две стойки и перекладина. У скрытой двери — лишь тонкий контур.
    const frameWidth = exit.kind === 'hidden' ? 0.015 : ExitDoorView.FRAME_WIDTH;
    const frameDepth = exit.kind === 'hidden' ? 0.012 : 0.05;
    for (const side of [-1, 1]) {
      const post = new Mesh(
        this.geometry(new BoxGeometry(frameWidth, height + frameWidth, frameDepth)),
        frameMaterial,
      );
      post.position.set(
        side * (width / 2 + frameWidth / 2),
        (height + frameWidth) / 2,
        frameDepth / 2,
      );
      this.root.add(post);
    }
    const lintel = new Mesh(
      this.geometry(new BoxGeometry(width + frameWidth * 2, frameWidth, frameDepth)),
      frameMaterial,
    );
    lintel.position.set(0, height + frameWidth / 2, frameDepth / 2);
    this.root.add(lintel);

    // Полотно на петлях (петли — у левого края).
    this.hinge.position.set(-width / 2, 0, 0.02);
    this.root.add(this.hinge);
    const panel = new Mesh(
      this.geometry(new BoxGeometry(width - 0.02, height - 0.02, 0.04)),
      panelMaterial,
    );
    panel.position.set(width / 2, height / 2 + 0.01, 0.02);
    this.hinge.add(panel);
    const handle = new Mesh(this.geometry(new SphereGeometry(0.035, 12, 8)), brass);
    handle.position.set(width - 0.12, 1.0, 0.06);
    this.hinge.add(handle);
    if (exit.kind === 'locked') {
      const plate = new Mesh(this.geometry(new BoxGeometry(0.07, 0.16, 0.012)), brass);
      plate.position.set(width - 0.12, 0.86, 0.045);
      this.hinge.add(plate);
    }

    // Подсказка обычной двери: полоска тёплого света из-под неё и отсвет на полу.
    this.glow = exit.kind === 'plain' ? this.createGlow(width) : null;

    this.root.visible = exit.kind !== 'hidden';
  }

  public update(state: ExitSnapshot | null, deltaSeconds: number): void {
    if (!state) {
      return;
    }
    this.root.visible = state.revealed;
    const target = state.open ? ExitDoorView.OPEN_ANGLE : 0;
    this.angle += (target - this.angle) * Math.min(1, deltaSeconds * 4);
    this.hinge.rotation.y = this.angle;
    if (this.glow) {
      this.glow.visible = !state.open;
    }
  }

  public dispose(): void {
    this.root.removeFromParent();
    this.geometries.forEach((geometry) => geometry.dispose());
    this.materials.forEach((material) => material.dispose());
    this.root.traverse((object) => {
      if (object instanceof PointLight) object.dispose();
    });
  }

  private createGlow(width: number): Group {
    const glow = new Group();
    const strip = new Mesh(
      this.geometry(new PlaneGeometry(width - 0.06, 0.025)),
      this.own(new MeshBasicMaterial({ color: '#ffd88a' })),
    );
    strip.position.set(0, 0.0125, 0.045);
    glow.add(strip);
    const light = new PointLight('#ffc46b', 2.2, 4.5, 1.8);
    light.position.set(0, 0.06, 0.35);
    glow.add(light);
    this.root.add(glow);
    return glow;
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
