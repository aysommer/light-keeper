import type { Group, InstancedMesh, Mesh } from 'three';
import type { CeilingPanelLight } from './CeilingLightPool.ts';
import type { MaterialLibrary } from './MaterialLibrary.ts';

/** Трёхмерное представление пространства: меши и его собственные материалы. */
export class SpaceView {
  public constructor(
    public readonly index: number,
    public readonly group: Group,
    public readonly materials: MaterialLibrary,
    /** Горящие панели этого этажа — их свет падает в комнаты. */
    public readonly panelLights: readonly CeilingPanelLight[] = [],
  ) {}

  public update(time: number): void {
    this.materials.update(time);
  }

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
    this.materials.dispose();
  }
}
