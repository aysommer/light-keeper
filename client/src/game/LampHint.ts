import { GameConfig } from '@light-keeper/shared';
import type { HeldItem, LampSettings, LampSnapshot } from '@light-keeper/shared';

/** Подсказка о состоянии своей лампы: перегрев, масло. */
export class LampHint {
  public constructor(private readonly settings: LampSettings = GameConfig.lamp) {}

  public resolve(lamp: LampSnapshot | null, item: HeldItem, inTambour: boolean): string | null {
    if (!lamp || inTambour) {
      return null;
    }
    if (lamp.overheated) {
      return 'Лампа перегрелась и остывает';
    }
    if (lamp.oil <= 0) {
      return 'Масло кончилось';
    }
    if (item !== 'lamp') {
      return null;
    }
    if (lamp.heat >= this.settings.warningHeat) {
      return 'Лампа перегревается — передай напарнику (E) или убери (2)';
    }
    if (lamp.oil < this.settings.lowOil) {
      return 'Масло на исходе';
    }
    return null;
  }
}
