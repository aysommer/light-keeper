import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  Points,
  ShaderMaterial,
} from 'three';
import type { Scene } from 'three';
import { GameConfig } from '@light-keeper/shared';

/**
 * Пыль в воздухе: облако пылинок вокруг камеры, видимых в свете своей лампы.
 *
 * Всё движение считается на видеокарте: пылинка дрейфует от времени, а когда
 * выходит за облако, переносится на противоположную сторону (облако «едет»
 * вместе с игроком). На процессоре за кадр меняются только две переменные,
 * геометрия создаётся один раз и не зависит от пространства.
 */
export class DustField {
  private static readonly COUNT = 1400;
  /** Размер облака по горизонтали, м (по высоте — от пола до потолка). */
  private static readonly SPAN = 7;
  /** Дальше этого пылинки не видны (свет лампы до них не достаёт), м. */
  private static readonly VISIBLE_DISTANCE = 4;

  private readonly points: Points;
  private readonly material: ShaderMaterial;

  public constructor(private readonly scene: Scene) {
    const count = DustField.COUNT;
    const positions = new Float32Array(count * 3);
    const seeds = new Float32Array(count);
    let state = 0x2f6b9a1d;
    const random = (): number => {
      // Простой ГПСЧ: картинка одинакова при каждом включении.
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
      return state / 2 ** 32;
    };
    for (let i = 0; i < count; i++) {
      positions[i * 3] = random() * DustField.SPAN;
      positions[i * 3 + 1] = random();
      positions[i * 3 + 2] = random() * DustField.SPAN;
      seeds[i] = random();
    }
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new BufferAttribute(positions, 3));
    geometry.setAttribute('seed', new BufferAttribute(seeds, 1));

    this.material = new ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uLight: { value: 1 },
        uPixelRatio: { value: 1 },
        uSpan: { value: DustField.SPAN },
        uCeiling: { value: GameConfig.world.ceilingHeight },
        uVisible: { value: DustField.VISIBLE_DISTANCE },
        uColor: { value: new Color('#ffe2a8') },
      },
      vertexShader: /* glsl */ `
        attribute float seed;
        uniform float uTime;
        uniform float uPixelRatio;
        uniform float uSpan;
        uniform float uCeiling;
        uniform float uVisible;
        varying float vAlpha;

        void main() {
          float t = uTime + seed * 100.0;
          // Медленный дрейф с лёгким покачиванием; пыль чуть оседает.
          vec3 drift = vec3(
            0.05 * t + 0.12 * sin(t * 0.37 + seed * 6.28),
            -0.015 * t + 0.08 * sin(t * 0.23 + seed * 12.1),
            0.03 * t + 0.12 * cos(t * 0.31 + seed * 3.7)
          );
          vec3 p = position * vec3(1.0, uCeiling, 1.0) + drift;
          // Облако вокруг камеры: заворачиваем координаты по горизонтали.
          vec2 half_ = vec2(uSpan * 0.5);
          p.xz = mod(p.xz - cameraPosition.xz + half_, uSpan) - half_ + cameraPosition.xz;
          p.y = mod(p.y, uCeiling);

          vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
          float distance = length(mvPosition.xyz);
          float twinkle = 0.55 + 0.45 * sin(uTime * (0.8 + seed * 1.6) + seed * 40.0);
          vAlpha = (1.0 - smoothstep(0.6, uVisible, distance)) * smoothstep(0.15, 0.45, distance) * twinkle;
          gl_PointSize = (1.5 + seed * 2.0) * uPixelRatio * (3.0 / max(distance, 0.3));
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 uColor;
        uniform float uLight;
        varying float vAlpha;

        void main() {
          // Круглая мягкая пылинка.
          float d = length(gl_PointCoord - 0.5);
          float alpha = smoothstep(0.5, 0.1, d) * vAlpha * uLight * 0.9;
          if (alpha < 0.004) discard;
          gl_FragColor = vec4(uColor * alpha, alpha);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
    });

    this.points = new Points(geometry, this.material);
    // Облако всегда вокруг камеры — отсечение по рамке не нужно.
    this.points.frustumCulled = false;
    scene.add(this.points);
  }

  /** @param time время, с; @param light свет своей лампы 0…~1; @param pixelRatio плотность пикселей */
  public update(time: number, light: number, pixelRatio: number): void {
    const uniforms = this.material.uniforms;
    uniforms['uTime']!.value = time % 10000;
    uniforms['uLight']!.value = Math.min(1, Math.max(0, light));
    uniforms['uPixelRatio']!.value = pixelRatio;
  }

  public dispose(): void {
    this.scene.remove(this.points);
    this.points.geometry.dispose();
    this.material.dispose();
  }
}
