import { BoxGeometry, Group, Mesh, MeshStandardMaterial, TorusGeometry } from 'three';
import type { BufferGeometry } from 'three';
import type { ExitSnapshot, Vector2 } from '@light-keeper/shared';
import { SceneCoords } from './SceneCoords.ts';

/** Один из ключей запертой двери: латунный, слегка светится, парит и вращается. */
export class KeyView {
  private static readonly HEIGHT = 0.9;

  public readonly root = new Group();
  private readonly geometries: BufferGeometry[] = [];
  private readonly material = new MeshStandardMaterial({
    color: '#d4ad2f',
    emissive: '#8a6a10',
    emissiveIntensity: 0.9,
    metalness: 0.7,
    roughness: 0.3,
  });

  /** @param index номер ключа в `Space.keys` */
  public constructor(
    position: Vector2,
    private readonly index: number,
  ) {
    this.root.position.copy(SceneCoords.toScene(position, KeyView.HEIGHT));
    const bow = this.mesh(new TorusGeometry(0.06, 0.018, 8, 20));
    bow.position.x = -0.1;
    const shaft = this.mesh(new BoxGeometry(0.17, 0.024, 0.02));
    shaft.position.x = 0.03;
    const toothA = this.mesh(new BoxGeometry(0.02, 0.05, 0.02));
    toothA.position.set(0.09, -0.03, 0);
    const toothB = this.mesh(new BoxGeometry(0.02, 0.035, 0.02));
    toothB.position.set(0.05, -0.022, 0);
  }

  public update(state: ExitSnapshot | null, time: number): void {
    // Ключ лежит, пока его никто не подобрал (подобранный ключ не теряется).
    this.root.visible = !(state?.keysTaken.includes(this.index) ?? false);
    this.root.rotation.y = time * 1.6 + this.index * 2.1;
    this.root.position.y = KeyView.HEIGHT + Math.sin(time * 2.2) * 0.05;
  }

  public dispose(): void {
    this.root.removeFromParent();
    this.geometries.forEach((geometry) => geometry.dispose());
    this.material.dispose();
  }

  private mesh(geometry: BufferGeometry): Mesh {
    this.geometries.push(geometry);
    const mesh = new Mesh(geometry, this.material);
    this.root.add(mesh);
    return mesh;
  }
}
