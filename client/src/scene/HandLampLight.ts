import { PointLight } from 'three';
import type { Camera } from 'three';

/**
 * Свет лампы в руке игрока. Пока это временный источник света,
 * привязанный к камере; на этапе 6 его заменит настоящая лампа с маслом и нагревом.
 */
export class HandLampLight {
  private readonly light: PointLight;
  private readonly baseIntensity = 8;

  public constructor(camera: Camera) {
    this.light = new PointLight('#ffcf8a', this.baseIntensity, 16, 1.6);
    this.light.position.set(0.15, -0.35, 0.25);
    camera.add(this.light);
  }

  /** Лампа в руке (включена) или убрана — тогда свет от неё не идёт. */
  public setEnabled(enabled: boolean): void {
    this.light.visible = enabled;
  }

  /** Лёгкое дрожание пламени. */
  public update(time: number): void {
    const flicker = Math.sin(time * 11) * 0.04 + Math.sin(time * 27.7) * 0.03;
    this.light.intensity = this.baseIntensity * (1 + flicker);
  }

  public dispose(): void {
    this.light.removeFromParent();
    this.light.dispose();
  }
}
