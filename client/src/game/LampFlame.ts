/**
 * Живое пламя лампы для отображения: лёгкое дрожание на полной лампе
 * и сильное «чихание» на исходе масла.
 */
export class LampFlame {
  /** С какого нагрева (%) стекло начинает заметно краснеть. */
  private static readonly VISIBLE_HEAT_FROM = 40;

  /**
   * Итоговый уровень света 0…~1.1: яркость лампы с учётом мерцания.
   * @param brightness яркость лампы 0–1 (см. LampRules.brightness)
   * @param seed сдвиг фазы, чтобы две лампы мерцали не в такт
   */
  public static level(time: number, brightness: number, seed = 0): number {
    if (brightness <= 0) {
      return 0;
    }
    const sputter = 1 - brightness;
    const amplitude = 0.04 + sputter * 0.35;
    const wave =
      Math.sin(time * 11 + seed) * 0.6 +
      Math.sin(time * 27.7 + seed * 2) * 0.4 +
      (sputter > 0.3 ? Math.sin(time * 53.1 + seed * 3) * 0.5 : 0);
    return brightness * Math.max(0, 1 + wave * amplitude);
  }

  /** Насколько заметен нагрев на фонаре, 0–1. */
  public static heatGlow(heat: number): number {
    return Math.min(
      1,
      Math.max(0, (heat - LampFlame.VISIBLE_HEAT_FROM) / (100 - LampFlame.VISIBLE_HEAT_FROM)),
    );
  }
}
