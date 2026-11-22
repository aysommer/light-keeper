import { Color, Vector3 } from 'three';
import { SeedHasher } from '@light-keeper/shared';
import type { Space } from '@light-keeper/shared';

/**
 * Цветовой тон картинки пространства — множитель цвета в плёночном шейдере.
 * У каждого пространства свой, по seed (одинаковый у обоих игроков):
 * жёлтый «как в Backrooms», холодный люминесцентный, болезненно-зелёный
 * или под цвет обоев. Яркость тона ≈ 1 — картинка не темнеет.
 */
export class SpaceTone {
  private static readonly PRESETS: readonly (readonly [number, number, number])[] = [
    [1.07, 1.0, 0.8],
    [0.9, 0.98, 1.1],
    [0.95, 1.05, 0.84],
  ];
  /** Сила тона «под обои». */
  private static readonly WALL_STRENGTH = 0.22;

  public static for(space: Space): Vector3 {
    const roll = SeedHasher.hash(space.seed, 'tone') / 2 ** 32;
    if (roll < 0.4) return SpaceTone.normalized(SpaceTone.PRESETS[0]!);
    if (roll < 0.6) return SpaceTone.normalized(SpaceTone.PRESETS[1]!);
    if (roll < 0.75) return SpaceTone.normalized(SpaceTone.PRESETS[2]!);
    const wall = new Color(space.palette.wall.toHex());
    const k = SpaceTone.WALL_STRENGTH;
    return SpaceTone.normalized([
      1 - k + k * wall.r * 2,
      1 - k + k * wall.g * 2,
      1 - k + k * wall.b * 2,
    ]);
  }

  /** Приводит тон к яркости 1 (по весам яркости глаза). */
  private static normalized([r, g, b]: readonly [number, number, number]): Vector3 {
    const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    return new Vector3(r / luminance, g / luminance, b / luminance);
  }
}
