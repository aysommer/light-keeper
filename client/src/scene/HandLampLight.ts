import { PointLight } from 'three';
import type { Camera } from 'three';

/**
 * Свет своей лампы в мире. Источник привязан к камере чуть позади и сбоку
 * (так он не уходит за стену, когда игрок стоит вплотную к ней).
 * Яркость и дальность задаются уровнем света лампы.
 */
export class HandLampLight {
  private readonly light: PointLight;
  private readonly baseIntensity = 8;

  public constructor(camera: Camera) {
    this.light = new PointLight('#ffcf8a', this.baseIntensity, 16, 1.6);
    this.light.position.set(0.15, -0.35, 0.25);
    camera.add(this.light);
  }

  /** Уровень света 0…~1 (см. LampFlame.level); 0 — лампа убрана или не горит. */
  public setLevel(level: number): void {
    this.light.visible = level > 0;
    this.light.intensity = this.baseIntensity * level;
    this.light.distance = 5 + 11 * Math.min(1, level);
  }

  public dispose(): void {
    this.light.removeFromParent();
    this.light.dispose();
  }
}
