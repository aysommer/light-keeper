import type { Group, Mesh, InstancedMesh } from 'three';

/** Трёхмерное представление одного чанка. */
export class ChunkView {
  public constructor(
    public readonly index: number,
    public readonly group: Group,
  ) {}

  /** Освобождает геометрию (материалы общие и остаются в MaterialLibrary). */
  public dispose(): void {
    this.group.traverse((object) => {
      const mesh = object as Mesh | InstancedMesh;
      if (mesh.isMesh) {
        mesh.geometry.dispose();
        if ('isInstancedMesh' in mesh && mesh.isInstancedMesh) {
          mesh.dispose();
        }
      }
    });
    this.group.removeFromParent();
  }
}
