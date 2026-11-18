import { Color, MeshBasicMaterial, MeshStandardMaterial } from 'three';
import type { Material } from 'three';
import { TextureFactory } from './TextureFactory.ts';

/** Состояние потолочной лампы-панели. */
export type PanelState = 'on' | 'off' | 'flicker';

/** Общие материалы сцены. Создаются один раз и переиспользуются всеми чанками. */
export class MaterialLibrary {
  public static readonly WALL_TILE_METERS = 1;
  public static readonly FLOOR_TILE_METERS = 2;
  public static readonly CEILING_TILE_METERS = 1.2;

  public readonly wall: MeshStandardMaterial;
  public readonly floor: MeshStandardMaterial;
  public readonly ceiling: MeshStandardMaterial;
  public readonly desk: MeshStandardMaterial;
  private readonly panels: Record<PanelState, MeshBasicMaterial>;
  private readonly flickerOn = new Color('#fff6d8');
  private readonly flickerOff = new Color('#4a4636');

  public constructor(textures: TextureFactory = new TextureFactory()) {
    this.wall = new MeshStandardMaterial({ map: textures.createWallpaper(), roughness: 0.95 });
    this.floor = new MeshStandardMaterial({ map: textures.createCarpet(), roughness: 1 });
    this.ceiling = new MeshStandardMaterial({ map: textures.createCeiling(), roughness: 0.9 });
    this.desk = new MeshStandardMaterial({ color: '#6e5a3c', roughness: 0.7 });
    this.panels = {
      on: new MeshBasicMaterial({ color: '#f3ead0' }),
      off: new MeshBasicMaterial({ color: '#4a4636' }),
      flicker: new MeshBasicMaterial({ color: this.flickerOn.clone() }),
    };
  }

  public panel(state: PanelState): MeshBasicMaterial {
    return this.panels[state];
  }

  /** Мерцание «умирающих» ламп дневного света. */
  public update(time: number): void {
    const signal = Math.sin(time * 23) + Math.sin(time * 7.3) + Math.sin(time * 1.7);
    this.panels.flicker.color.copy(signal > 1.2 ? this.flickerOff : this.flickerOn);
  }

  public dispose(): void {
    const materials: Material[] = [
      this.wall,
      this.floor,
      this.ceiling,
      this.desk,
      ...Object.values(this.panels),
    ];
    for (const material of materials) {
      if (material instanceof MeshStandardMaterial) {
        material.map?.dispose();
      }
      material.dispose();
    }
  }
}
