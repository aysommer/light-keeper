import type { SeededRandom } from '../random/SeededRandom.ts';
import { HslColor } from './HslColor.ts';

/** Узор обоев пространства. */
export type WallpaperPattern = 'stripes' | 'diamonds' | 'checks' | 'plain' | 'damask';

/**
 * Палитра пространства: случайный оттенок с приглушённой насыщенностью
 * и подобранные к нему пол, потолок и отделка. Определяется seed пространства,
 * поэтому одинакова у обоих игроков.
 */
export class SpacePalette {
  public static readonly PATTERNS: readonly WallpaperPattern[] = [
    'stripes',
    'diamonds',
    'checks',
    'plain',
    'damask',
  ];
  /** Предел насыщенности обоев — «приглушённость». */
  public static readonly MAX_WALL_SATURATION = 0.42;

  public constructor(
    /** Основной цвет обоев. */
    public readonly wall: HslColor,
    /** Цвет узора на обоях. */
    public readonly accent: HslColor,
    public readonly floor: HslColor,
    public readonly ceiling: HslColor,
    /** Отделка: шпалера, столы. */
    public readonly trim: HslColor,
    public readonly pattern: WallpaperPattern,
  ) {}

  public static generate(rng: SeededRandom): SpacePalette {
    const hue = rng.float(0, 360);
    const saturation = rng.float(0.22, SpacePalette.MAX_WALL_SATURATION);
    const lightness = rng.float(0.55, 0.68);
    const wall = new HslColor(hue, saturation, lightness);
    const accentShift = rng.chance(0.5) ? 0.08 : -0.1;
    return new SpacePalette(
      wall,
      new HslColor(hue, saturation * 0.9, lightness + accentShift),
      new HslColor(hue + rng.float(-25, 25), saturation * 0.6, rng.float(0.24, 0.34)),
      new HslColor(hue, 0.1, 0.82),
      new HslColor(hue, saturation * 0.8, lightness - 0.25),
      rng.pick(SpacePalette.PATTERNS),
    );
  }
}
