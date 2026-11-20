import { GameConfig } from '@light-keeper/shared';
import type { GhostSettings } from '@light-keeper/shared';

/**
 * Насколько страшно игроку (0–1): привидение ближе `scareDistance` —
 * чем ближе, тем сильнее. Свой горящий свет успокаивает.
 */
export class ScareLevel {
  private level = 0;

  public constructor(private readonly settings: GhostSettings = GameConfig.ghosts) {}

  /**
   * @param nearestGhost расстояние до ближайшего опасного привидения, м
   * @param ownLight уровень своего света 0–1
   */
  public update(deltaSeconds: number, nearestGhost: number | null, ownLight: number): number {
    const closeness =
      nearestGhost === null ? 0 : Math.max(0, 1 - nearestGhost / this.settings.scareDistance);
    const target = closeness * (1 - 0.6 * Math.min(1, ownLight));
    // Страх нарастает быстро, отпускает медленно.
    const rate = target > this.level ? 6 : 1.5;
    this.level += (target - this.level) * (1 - Math.exp(-deltaSeconds * rate));
    return this.level;
  }
}
