import {
  DepthTexture,
  MeshBasicMaterial,
  ShaderMaterial,
  UnsignedIntType,
  Vector3,
  WebGLRenderTarget,
} from 'three';
import type { PerspectiveCamera, PointLight, Scene, WebGLRenderer } from 'three';
import { FullScreenQuad, Pass } from 'three/examples/jsm/postprocessing/Pass.js';

/**
 * Объёмный туман: воздух светится вокруг источников света — каждый луч от
 * камеры до ближайшей поверхности собирает рассеянный свет ламп. Рассеяние от
 * точечного источника в однородном воздухе считается точно (интеграл по лучу
 * в виде арктангенсов), без пошагового прохода — поэтому цена: один лишний
 * проход глубины сцены и по 8 источников на пиксель.
 * Свет учитывается только от источников с `userData.volumetric` (своя лампа и
 * потолочные панели вокруг игрока); тени в тумане не считаются.
 */
export class VolumetricFogPass extends Pass {
  public static readonly MAX_LIGHTS = 8;
  /** Плотность тумана: сколько света он рассеивает. */
  private static readonly DENSITY = 0.0016;
  /** Дальше этого луч не собирает свет, м. */
  private static readonly MAX_DISTANCE = 30;

  private readonly depthTarget: WebGLRenderTarget;
  private readonly depthOnly = new MeshBasicMaterial({ colorWrite: false });
  private readonly material: ShaderMaterial;
  private readonly quad: FullScreenQuad;
  private readonly cameraPosition = new Vector3();
  private readonly lightPosition = new Vector3();

  public constructor(
    private readonly scene: Scene,
    private readonly camera: PerspectiveCamera,
    private readonly lights: () => readonly PointLight[],
  ) {
    super();
    this.depthTarget = new WebGLRenderTarget(1, 1);
    this.depthTarget.depthTexture = new DepthTexture(1, 1, UnsignedIntType);
    this.material = new ShaderMaterial({
      name: 'VolumetricFog',
      uniforms: {
        tDiffuse: { value: null },
        tDepth: { value: this.depthTarget.depthTexture },
        uInvProjection: { value: camera.projectionMatrixInverse },
        uCameraWorld: { value: camera.matrixWorld },
        uCameraPos: { value: new Vector3() },
        uLightPos: {
          value: Array.from({ length: VolumetricFogPass.MAX_LIGHTS }, () => new Vector3()),
        },
        uLightColor: {
          value: Array.from({ length: VolumetricFogPass.MAX_LIGHTS }, () => new Vector3()),
        },
        uLightCount: { value: 0 },
        uDensity: { value: VolumetricFogPass.DENSITY },
        uMaxDistance: { value: VolumetricFogPass.MAX_DISTANCE },
      },
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        #define MAX_LIGHTS ${VolumetricFogPass.MAX_LIGHTS}
        uniform sampler2D tDiffuse;
        uniform sampler2D tDepth;
        uniform mat4 uInvProjection;
        uniform mat4 uCameraWorld;
        uniform vec3 uCameraPos;
        uniform vec3 uLightPos[MAX_LIGHTS];
        uniform vec3 uLightColor[MAX_LIGHTS];
        uniform int uLightCount;
        uniform float uDensity;
        uniform float uMaxDistance;
        varying vec2 vUv;

        void main() {
          vec4 color = texture2D(tDiffuse, vUv);
          float depth = texture2D(tDepth, vUv).x;
          vec4 view = uInvProjection * vec4(vUv * 2.0 - 1.0, depth * 2.0 - 1.0, 1.0);
          view /= view.w;
          float travel = min(length(view.xyz), uMaxDistance);
          vec3 dir = normalize((uCameraWorld * vec4(view.xyz, 0.0)).xyz);
          vec3 scatter = vec3(0.0);
          for (int i = 0; i < MAX_LIGHTS; i++) {
            if (i >= uLightCount) break;
            vec3 toLight = uLightPos[i] - uCameraPos;
            float along = dot(toLight, dir);
            // Не ближе 0,6 м к лучу: своя лампа у самой камеры не заливает весь кадр.
            float h = sqrt(max(dot(toLight, toLight) - along * along, 0.36));
            // ∫ dt / (h² + (t − along)²) от 0 до travel.
            float amount = (atan((travel - along) / h) - atan(-along / h)) / h;
            scatter += uLightColor[i] * amount;
          }
          color.rgb += scatter * uDensity;
          gl_FragColor = color;
        }
      `,
    });
    this.quad = new FullScreenQuad(this.material);
  }

  public override setSize(width: number, height: number): void {
    this.depthTarget.setSize(width, height);
  }

  public override render(
    renderer: WebGLRenderer,
    writeBuffer: WebGLRenderTarget,
    readBuffer: WebGLRenderTarget,
  ): void {
    // Глубина сцены — без цвета, одним дешёвым материалом.
    const override = this.scene.overrideMaterial;
    const background = this.scene.background;
    this.scene.overrideMaterial = this.depthOnly;
    this.scene.background = null;
    renderer.setRenderTarget(this.depthTarget);
    renderer.clear();
    renderer.render(this.scene, this.camera);
    this.scene.overrideMaterial = override;
    this.scene.background = background;

    const uniforms = this.material.uniforms;
    uniforms['tDiffuse']!.value = readBuffer.texture;
    this.camera.getWorldPosition(this.cameraPosition);
    (uniforms['uCameraPos']!.value as Vector3).copy(this.cameraPosition);
    const positions = uniforms['uLightPos']!.value as Vector3[];
    const colors = uniforms['uLightColor']!.value as Vector3[];
    let count = 0;
    for (const light of this.lights()) {
      if (count >= VolumetricFogPass.MAX_LIGHTS) break;
      if (!light.visible || light.intensity <= 0) continue;
      light.getWorldPosition(this.lightPosition);
      positions[count]!.copy(this.lightPosition);
      colors[count]!.set(light.color.r, light.color.g, light.color.b).multiplyScalar(
        light.intensity,
      );
      count++;
    }
    uniforms['uLightCount']!.value = count;

    renderer.setRenderTarget(this.renderToScreen ? null : writeBuffer);
    this.quad.render(renderer);
  }

  public override dispose(): void {
    this.depthTarget.depthTexture?.dispose();
    this.depthTarget.dispose();
    this.depthOnly.dispose();
    this.material.dispose();
    this.quad.dispose();
  }
}
