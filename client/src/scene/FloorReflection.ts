import { Color, PlaneGeometry } from 'three';
import { Reflector } from 'three/examples/jsm/objects/Reflector.js';
import type { Space } from '@light-keeper/shared';
import { SceneCoords } from './SceneCoords.ts';

/**
 * Отражение на полу этажа: зеркальная плоскость чуть над ковром, сквозь
 * которую пол просвечивает, — в ней едва видны панели, двери, напарник.
 * Это ещё одна отрисовка сцены (из отражённой камеры), поэтому тяжело;
 * видна только плоскость этажа игрока.
 */
export class FloorReflection {
  /** Насколько видно отражение поверх пола (0–1). */
  private static readonly STRENGTH = 0.22;
  /** Разрешение отражения относительно экрана: размытее и дешевле. */
  private static readonly RESOLUTION = 0.5;

  private static readonly SHADER = {
    name: 'FloorReflection',
    uniforms: {
      color: { value: null },
      tDiffuse: { value: null },
      textureMatrix: { value: null },
      uStrength: { value: FloorReflection.STRENGTH },
    },
    vertexShader: /* glsl */ `
      uniform mat4 textureMatrix;
      varying vec4 vUv;
      #include <common>
      #include <logdepthbuf_pars_vertex>
      void main() {
        vUv = textureMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        #include <logdepthbuf_vertex>
      }
    `,
    fragmentShader: /* glsl */ `
      uniform sampler2D tDiffuse;
      uniform float uStrength;
      varying vec4 vUv;
      #include <logdepthbuf_pars_fragment>
      void main() {
        #include <logdepthbuf_fragment>
        vec4 base = texture2DProj(tDiffuse, vUv);
        gl_FragColor = vec4(base.rgb, uStrength);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  };

  public readonly mirror: Reflector;

  public constructor(space: Space, floor: number) {
    const scale = Math.min(window.devicePixelRatio, 2) * FloorReflection.RESOLUTION;
    this.mirror = new Reflector(new PlaneGeometry(space.grid.width, space.grid.length), {
      color: new Color('#ffffff'),
      textureWidth: Math.round(window.innerWidth * scale),
      textureHeight: Math.round(window.innerHeight * scale),
      clipBias: 0.003,
      multisample: 0,
      shader: FloorReflection.SHADER,
    });
    const material = this.mirror.material as { transparent: boolean; depthWrite: boolean };
    material.transparent = true;
    material.depthWrite = false;
    this.mirror.rotation.x = -Math.PI / 2;
    // Чуть над ковром и пятнами на нём, но под проёмом лестницы.
    this.mirror.position.copy(SceneCoords.toScene(space.bounds.center, 0.006, floor));
    this.mirror.name = `floor-reflection-${floor}`;
  }

  public dispose(): void {
    this.mirror.removeFromParent();
    this.mirror.dispose();
  }
}
