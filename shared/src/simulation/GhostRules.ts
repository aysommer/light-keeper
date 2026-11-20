import { GameConfig } from '../config/GameConfig.ts';
import type { GhostSettings } from '../config/GameConfig.ts';

/** Правила привидений, зависящие от номера пространства. */
export class GhostRules {
  public constructor(private readonly settings: GhostSettings = GameConfig.ghosts) {}

  /** Через сколько секунд после входа в пространство приходит первое привидение. */
  public firstDelay(spaceIndex: number): number {
    const decay = Math.pow(this.settings.intervalDecay, spaceIndex);
    return Math.max(this.settings.minIntervalSeconds, this.settings.firstDelaySeconds * decay);
  }

  /** Интервал между появлениями, с. */
  public interval(spaceIndex: number): number {
    const decay = Math.pow(this.settings.intervalDecay, spaceIndex);
    return Math.max(this.settings.minIntervalSeconds, this.settings.intervalSeconds * decay);
  }

  /** Сколько привидений может быть одновременно. */
  public maxConcurrent(spaceIndex: number): number {
    return Math.min(
      this.settings.maxConcurrentCap,
      this.settings.maxConcurrentBase + Math.floor(spaceIndex / this.settings.maxConcurrentEvery),
    );
  }

  /** Скорость привидения в темноте, м/с. */
  public speed(spaceIndex: number): number {
    return Math.min(
      this.settings.maxSpeed,
      this.settings.speed + this.settings.speedPerSpace * spaceIndex,
    );
  }

  /** Радиус, в котором свет лампы яркости `brightness` (0–1) отгоняет привидение, м. */
  public lightRadius(brightness: number, spaceIndex: number): number {
    if (brightness <= 0) {
      return 0;
    }
    const factor = Math.max(
      this.settings.minLightFactor,
      1 - this.settings.lightShrinkPerSpace * spaceIndex,
    );
    return (
      (this.settings.lightRadiusBase + this.settings.lightRadiusPerBrightness * brightness) * factor
    );
  }
}
