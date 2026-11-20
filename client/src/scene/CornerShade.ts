import type { MeshStandardMaterial } from 'three';
import { GameConfig } from '@light-keeper/shared';

/**
 * Затенение углов «для бедных»: стена плавно темнеет у пола и у потолка,
 * как в настоящих помещениях, куда в стыки попадает меньше света.
 * Это не экранный проход: в шейдер стены добавляются пара строк по высоте точки,
 * поэтому нагрузка почти нулевая. Выключенное — исходный шейдер без изменений.
 */
export class CornerShade {
  private static readonly CEILING = GameConfig.world.ceilingHeight.toFixed(2);
  private enabled = false;

  public apply(material: MeshStandardMaterial, enabled: boolean): void {
    if (enabled === this.enabled) {
      return;
    }
    this.enabled = enabled;
    if (enabled) {
      material.onBeforeCompile = (shader): void => {
        shader.vertexShader = shader.vertexShader
          .replace('#include <common>', '#include <common>\nvarying float vShadeHeight;')
          .replace(
            '#include <project_vertex>',
            '#include <project_vertex>\nvShadeHeight = (modelMatrix * vec4(transformed, 1.0)).y;',
          );
        shader.fragmentShader = shader.fragmentShader
          .replace('#include <common>', '#include <common>\nvarying float vShadeHeight;')
          .replace(
            '#include <opaque_fragment>',
            [
              // Высота потолка — 3 м (GameConfig.world.ceilingHeight).
              'float shadeFloor = 1.0 - smoothstep(0.0, 0.55, vShadeHeight);',
              `float shadeCeiling = 1.0 - smoothstep(0.0, 0.4, ${CornerShade.CEILING} - vShadeHeight);`,
              'outgoingLight *= 1.0 - 0.45 * shadeFloor * shadeFloor - 0.35 * shadeCeiling * shadeCeiling;',
              '#include <opaque_fragment>',
            ].join('\n'),
          );
      };
      material.customProgramCacheKey = (): string => 'corner-shade';
    } else {
      material.onBeforeCompile = (): void => undefined;
      material.customProgramCacheKey = (): string => '';
    }
    material.needsUpdate = true;
  }
}
