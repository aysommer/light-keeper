import { Color, MeshBasicMaterial, MeshStandardMaterial } from 'three';
import type { Material, Texture } from 'three';
import type { SpacePalette } from '@light-keeper/shared';
import { CornerShade } from './CornerShade.ts';
import { TextureFactory } from './TextureFactory.ts';

/** Галочки графики, которые касаются материалов пространства. */
export interface SpaceDetail {
  /** Текстуры с удвоенным разрешением и сильной анизотропной фильтрацией. */
  readonly sharpTextures: boolean;
  /** Стены темнеют у пола и потолка. */
  readonly cornerShade: boolean;
}

/** Состояние потолочной лампы-панели. */
export type PanelState = 'on' | 'off' | 'flicker';

/** Материалы одного пространства, окрашенные по его палитре. */
export class MaterialLibrary {
  public static readonly WALL_TILE_METERS = 1;
  public static readonly FLOOR_TILE_METERS = 2;
  public static readonly CEILING_TILE_METERS = 1.2;
  public static readonly NO_DETAIL: SpaceDetail = { sharpTextures: false, cornerShade: false };

  public readonly wall: MeshStandardMaterial;
  public readonly floor: MeshStandardMaterial;
  public readonly ceiling: MeshStandardMaterial;
  public readonly desk: MeshStandardMaterial;
  /** Отделка: шпалера на однотонных обоях. */
  public readonly trim: MeshStandardMaterial;
  private readonly panels: Record<PanelState, MeshBasicMaterial>;
  private readonly flickerOn = new Color('#fff6d8');
  private readonly flickerOff = new Color('#4a4636');
  private sharp: boolean;
  private readonly cornerShade = new CornerShade();

  public constructor(
    private readonly palette: SpacePalette,
    detail: SpaceDetail = MaterialLibrary.NO_DETAIL,
  ) {
    this.sharp = detail.sharpTextures;
    const textures = new TextureFactory(palette, this.sharp ? 2 : 1);
    this.wall = new MeshStandardMaterial({ map: textures.createWallpaper(), roughness: 0.95 });
    this.floor = new MeshStandardMaterial({ map: textures.createCarpet(), roughness: 1 });
    this.ceiling = new MeshStandardMaterial({ map: textures.createCeiling(), roughness: 0.9 });
    this.cornerShade.apply(this.wall, detail.cornerShade);
    this.desk = new MeshStandardMaterial({
      color: palette.trim.withLightness(palette.trim.lightness * 0.7).toHex(),
      roughness: 0.7,
    });
    this.trim = new MeshStandardMaterial({ color: palette.trim.toHex(), roughness: 0.6 });
    this.panels = {
      on: new MeshBasicMaterial({ color: '#f3ead0' }),
      off: new MeshBasicMaterial({ color: '#4a4636' }),
      flicker: new MeshBasicMaterial({ color: this.flickerOn.clone() }),
    };
  }

  /** Применяет галочки к уже построенному пространству — сразу, без перестройки мешей. */
  public setDetail(detail: SpaceDetail): void {
    this.cornerShade.apply(this.wall, detail.cornerShade);
    if (detail.sharpTextures === this.sharp) {
      return;
    }
    this.sharp = detail.sharpTextures;
    const textures = new TextureFactory(this.palette, this.sharp ? 2 : 1);
    this.replaceMap(this.wall, textures.createWallpaper());
    this.replaceMap(this.floor, textures.createCarpet());
    this.replaceMap(this.ceiling, textures.createCeiling());
  }

  public panel(state: PanelState): MeshBasicMaterial {
    return this.panels[state];
  }

  /** Мерцание «умирающих» ламп дневного света. */
  public update(time: number): void {
    const signal = Math.sin(time * 23) + Math.sin(time * 7.3) + Math.sin(time * 1.7);
    this.panels.flicker.color.copy(signal > 1.2 ? this.flickerOff : this.flickerOn);
  }

  private replaceMap(material: MeshStandardMaterial, map: Texture): void {
    // Та же «форма» материала (карта была и осталась) — шейдер не пересобирается.
    material.map?.dispose();
    material.map = map;
  }

  public dispose(): void {
    const materials: Material[] = [
      this.wall,
      this.floor,
      this.ceiling,
      this.desk,
      this.trim,
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
