import { GameConfig } from '../config/GameConfig.ts';
import type { LampSettings } from '../config/GameConfig.ts';
import type { PlayerColor } from '../protocol/Messages.ts';

/** Минимум о лампе, чтобы судить о её свете. */
export interface LampLightState {
  readonly lit: boolean;
  /** Масло, %. */
  readonly oil: number;
}

/** Правила лампы, общие для сервера (симуляция) и клиента (отображение). */
export class LampRules {
  /**
   * Лампа одна на двоих. В начале партии она у этого игрока; дальше её
   * передают из рук в руки, а у второго в руке компас.
   */
  public static readonly FIRST_HOLDER: PlayerColor = 'red';

  /**
   * Скорость нагрева горящей лампы в руке, %/с. Растёт с временем непрерывного
   * удержания одним игроком — поэтому лампами выгодно меняться.
   */
  public static heatRate(holdSeconds: number, settings: LampSettings = GameConfig.lamp): number {
    return (
      settings.heatBaseRate *
      (settings.heatMinFactor + Math.max(0, holdSeconds) / settings.heatRampSeconds)
    );
  }

  /** Яркость лампы 0–1: полная, пока масла хватает, затем тускнеет; погасшая — 0. */
  public static brightness(lamp: LampLightState, settings: LampSettings = GameConfig.lamp): number {
    if (!lamp.lit || lamp.oil <= 0) {
      return 0;
    }
    if (lamp.oil >= settings.dimBelowOil) {
      return 1;
    }
    const share = lamp.oil / settings.dimBelowOil;
    return settings.minBrightness + (1 - settings.minBrightness) * share;
  }
}
