/** Цвет в модели HSL: оттенок 0–360°, насыщенность и светлота 0–1. */
export class HslColor {
  public readonly hue: number;
  public readonly saturation: number;
  public readonly lightness: number;

  public constructor(hue: number, saturation: number, lightness: number) {
    this.hue = ((hue % 360) + 360) % 360;
    this.saturation = Math.min(1, Math.max(0, saturation));
    this.lightness = Math.min(1, Math.max(0, lightness));
  }

  public withLightness(lightness: number): HslColor {
    return new HslColor(this.hue, this.saturation, lightness);
  }

  /** Цвет в формате `#rrggbb`. */
  public toHex(): string {
    const { hue, saturation: s, lightness: l } = this;
    const chroma = (1 - Math.abs(2 * l - 1)) * s;
    const channel = (n: number): string => {
      const k = (n + hue / 30) % 12;
      const value = l - (chroma / 2) * Math.max(-1, Math.min(k - 3, 9 - k, 1));
      return Math.round(value * 255)
        .toString(16)
        .padStart(2, '0');
    };
    return `#${channel(0)}${channel(8)}${channel(4)}`;
  }
}
