import { Vector2 } from 'three';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';

/**
 * Мягкий ореол вокруг ярких предметов (панели, лампы).
 * Считается в уменьшенном разрешении: ореол размытый, мелкие детали ему не нужны,
 * а нагрузка на видеокарту падает в разы.
 */
export class SoftBloomPass extends UnrealBloomPass {
  /** Во сколько раз уменьшать буфер перед размытием (сверх встроенного ½). */
  private static readonly DOWNSCALE = 2;
  private static readonly STRENGTH = 0.55;
  private static readonly RADIUS = 0.5;
  /** Порог яркости (линейный цвет до тонмаппинга): светятся только панели и лампы. */
  private static readonly THRESHOLD = 0.82;

  public constructor() {
    super(
      new Vector2(256, 256),
      SoftBloomPass.STRENGTH,
      SoftBloomPass.RADIUS,
      SoftBloomPass.THRESHOLD,
    );
  }

  public override setSize(width: number, height: number): void {
    super.setSize(
      Math.max(1, Math.round(width / SoftBloomPass.DOWNSCALE)),
      Math.max(1, Math.round(height / SoftBloomPass.DOWNSCALE)),
    );
  }
}
