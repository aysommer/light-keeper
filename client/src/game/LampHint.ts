import { GameConfig } from '@light-keeper/shared';
import type { HeldItem, LampSettings, LampSnapshot } from '@light-keeper/shared';

/** Канистры и заправка — для подсказки «удерживай R». */
export interface OilSupply {
  readonly canisters: number;
  readonly refueling: boolean;
}

/** Подсказка о состоянии своей лампы: перегрев, масло. */
export class LampHint {
  public constructor(private readonly settings: LampSettings = GameConfig.lamp) {}

  public resolve(
    lamp: LampSnapshot | null,
    item: HeldItem,
    inTambour: boolean,
    oil: OilSupply = { canisters: 0, refueling: false },
  ): string | null {
    if (!lamp || inTambour) {
      return null;
    }
    if (oil.refueling) {
      return 'Заправка…';
    }
    const refuelHint = oil.canisters > 0 ? ' — удерживай R' : '';
    if (lamp.overheated) {
      return 'Лампа перегрелась и остывает';
    }
    if (lamp.oil <= 0) {
      return `Масло кончилось${refuelHint}`;
    }
    if (item !== 'lamp') {
      return null;
    }
    if (lamp.heat >= this.settings.warningHeat) {
      return 'Лампа перегревается — передай напарнику (E) или убери (2)';
    }
    if (lamp.oil < this.settings.lowOil) {
      return `Масло на исходе${refuelHint}`;
    }
    return null;
  }
}
