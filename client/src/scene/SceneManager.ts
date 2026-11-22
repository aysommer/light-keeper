import {
  ACESFilmicToneMapping,
  Color,
  Fog,
  HemisphereLight,
  Mesh,
  MeshBasicMaterial,
  PCFShadowMap,
  PerspectiveCamera,
  PointLight,
  Scene,
  SRGBColorSpace,
  Vector2,
  Vector3,
  WebGLRenderer,
} from 'three';
import type { Material, Object3D } from 'three';
import { GTAOPass } from 'three/examples/jsm/postprocessing/GTAOPass.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { DustField } from './DustField.ts';
import { FilmShader } from './FilmShader.ts';
import { GroundShadow } from './GroundShadow.ts';
import { SoftBloomPass } from './SoftBloomPass.ts';
import { VolumetricFogPass } from './VolumetricFogPass.ts';

/** Рендерер, сцена, камера и реакция на изменение размера окна. */
export class SceneManager {
  private static readonly DARKNESS = '#14110a';
  private static readonly MSAA_SAMPLES = 4;

  public readonly scene = new Scene();
  public readonly camera = new PerspectiveCamera(75, 1, 0.05, 60);
  /**
   * Сцена «вида от первого лица» (рука с фонарём). Рисуется вторым проходом
   * поверх мира с очищенным буфером глубины — рука не утопает в стенах.
   * Её камера неподвижна: предметы задаются прямо в координатах взгляда.
   */
  public readonly viewmodelScene = new Scene();
  public readonly viewmodelCamera = new PerspectiveCamera(70, 1, 0.01, 5);
  public readonly renderer: WebGLRenderer;
  private readonly resizeObserver: ResizeObserver;
  /**
   * Цепочка отрисовки: мир → рука от первого лица поверх (с очищенной
   * глубиной) → плёнка (зерно, виньетка) → вывод с тональной компрессией.
   */
  private readonly composer: EffectComposer;
  private readonly film: ShaderPass;
  private readonly toneTarget = new Vector3(1, 1, 1);
  /** Свечение: создаётся только при включении, чтобы выключенное ничего не стоило. */
  private bloom: SoftBloomPass | null = null;
  /** Пыль: тоже создаётся только при включении. */
  private dust: DustField | null = null;
  private readonly viewmodelPass: RenderPass;
  /** Мягкое затенение щелей и углов (GTAO) — создаётся только при включении. */
  private ambientOcclusion: GTAOPass | null = null;
  /** Объёмный туман — создаётся только при включении. */
  private volumetricFog: VolumetricFogPass | null = null;
  private lampShadows = false;
  /** Источники для тумана (`userData.volumetric`) — обновляются обходом сцены. */
  private volumetricLights: PointLight[] = [];
  private framesToScan = 0;

  public constructor(private readonly container: HTMLElement) {
    // Сглаживание холста не нужно: картинка идёт через буферы пост-обработки,
    // их сглаживание включается галочкой (setAntialias).
    this.renderer = new WebGLRenderer({ antialias: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = SRGBColorSpace;
    this.renderer.toneMapping = ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;
    this.renderer.domElement.className = 'game-canvas';
    container.append(this.renderer.domElement);

    this.scene.background = new Color(SceneManager.DARKNESS);
    this.scene.fog = new Fog(SceneManager.DARKNESS, 5, 30);
    // Рассеянный свет: без лампы сумрачно, но глазам не тяжело. Основной свет —
    // потолочные панели (CeilingLightPool) и лампа.
    this.scene.add(new HemisphereLight('#fff1c4', '#3a3220', 0.6));
    this.scene.add(this.camera);

    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.viewmodelPass = new RenderPass(this.viewmodelScene, this.viewmodelCamera);
    this.viewmodelPass.clear = false;
    this.viewmodelPass.clearDepth = true;
    this.composer.addPass(this.viewmodelPass);
    this.film = new ShaderPass(FilmShader);
    this.composer.addPass(this.film);
    this.composer.addPass(new OutputPass());

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
    this.resize();
  }

  public get canvas(): HTMLCanvasElement {
    return this.renderer.domElement;
  }

  /**
   * Сглаживание краёв: мультисэмплинг промежуточных буферов цепочки отрисовки
   * (сглаживание самого холста после пост-обработки не действует).
   */
  public setAntialias(enabled: boolean): void {
    const samples = enabled ? SceneManager.MSAA_SAMPLES : 0;
    for (const target of [this.composer.renderTarget1, this.composer.renderTarget2]) {
      if (target.samples !== samples) {
        target.samples = samples;
        // Буфер пересоздастся на видеокарте с новым числом сэмплов при следующем кадре.
        target.dispose();
      }
    }
  }

  /** Свечение вокруг ярких предметов — проход перед зерном плёнки. */
  public setBloom(enabled: boolean): void {
    if (enabled && !this.bloom) {
      this.bloom = new SoftBloomPass();
      this.composer.insertPass(this.bloom, this.composer.passes.indexOf(this.film));
    } else if (!enabled && this.bloom) {
      this.composer.removePass(this.bloom);
      this.bloom.dispose();
      this.bloom = null;
    }
  }

  /** Тени под ногами: камера начинает или перестаёт видеть их слой. */
  public setGroundShadows(enabled: boolean): void {
    if (enabled) {
      this.camera.layers.enable(GroundShadow.LAYER);
    } else {
      this.camera.layers.disable(GroundShadow.LAYER);
    }
  }

  /** Пыль в воздухе вокруг игрока. */
  public setDust(enabled: boolean): void {
    if (enabled && !this.dust) {
      this.dust = new DustField(this.scene);
    } else if (!enabled && this.dust) {
      this.dust.dispose();
      this.dust = null;
    }
  }

  /**
   * @param time время, с (для зерна); @param scare испуг 0–1;
   * @param light свет своей лампы 0…~1 (пыль видна в её свете)
   */
  /**
   * Тени от лампы: своя лампа и лампа напарника отбрасывают тени (стены,
   * мебель, герои). Точечный источник с тенью рисует сцену ещё 6 раз — тяжело.
   */
  public setLampShadows(enabled: boolean): void {
    if (enabled === this.lampShadows) return;
    this.lampShadows = enabled;
    this.renderer.shadowMap.enabled = enabled;
    this.renderer.shadowMap.type = PCFShadowMap;
    this.applyShadowFlags();
  }

  /** Мягкое затенение щелей, углов и под мебелью — по глубине кадра (GTAO). */
  public setAmbientOcclusion(enabled: boolean): void {
    if (enabled && !this.ambientOcclusion) {
      const size = this.renderer.getDrawingBufferSize(new Vector2());
      this.ambientOcclusion = new GTAOPass(this.scene, this.camera, size.x, size.y);
      this.ambientOcclusion.updateGtaoMaterial({ radius: 1.2, thickness: 2, scale: 1.4 });
      this.ambientOcclusion.blendIntensity = 1;
      this.composer.insertPass(this.ambientOcclusion, 1);
    } else if (!enabled && this.ambientOcclusion) {
      this.composer.removePass(this.ambientOcclusion);
      this.ambientOcclusion.dispose();
      this.ambientOcclusion = null;
    }
  }

  /** Объёмный туман: воздух светится вокруг лампы и потолочных панелей. */
  public setVolumetricFog(enabled: boolean): void {
    if (enabled && !this.volumetricFog) {
      this.volumetricFog = new VolumetricFogPass(
        this.scene,
        this.camera,
        () => this.volumetricLights,
      );
      this.composer.insertPass(
        this.volumetricFog,
        this.composer.passes.indexOf(this.viewmodelPass),
      );
      this.framesToScan = 0;
    } else if (!enabled && this.volumetricFog) {
      this.composer.removePass(this.volumetricFog);
      this.volumetricFog.dispose();
      this.volumetricFog = null;
    }
  }

  /** Тон картинки (см. SpaceTone): меняется плавно — при переходе в новое пространство. */
  public setTone(tone: Vector3): void {
    this.toneTarget.copy(tone);
  }

  public render(time = 0, scare = 0, light = 1): void {
    this.dust?.update(time, light, this.renderer.getPixelRatio());
    const tint = (this.film.uniforms as Record<string, { value: Vector3 }>)['uTint']!.value;
    tint.lerp(this.toneTarget, 0.05);
    const uniforms = this.film.uniforms as Record<string, { value: number }>;
    uniforms['uTime']!.value = time % 1000;
    uniforms['uScare']!.value = scare;
    // Сцена меняется (новые пространства, герои) — флаги теней и список
    // источников для тумана обновляются обходом раз в полсекунды.
    if ((this.lampShadows || this.volumetricFog) && --this.framesToScan <= 0) {
      this.framesToScan = 30;
      this.applyShadowFlags();
    }
    this.composer.render();
  }

  /**
   * Кто отбрасывает и принимает тени: непрозрачные меши (кроме помеченных
   * `userData.noShadow` — например, фонарь, внутри которого сам источник);
   * тень дают только источники с `userData.shadowCaster`.
   */
  private applyShadowFlags(): void {
    const enabled = this.lampShadows;
    const lights: PointLight[] = [];
    const visit = (object: Object3D, noShadow: boolean): void => {
      const skip = noShadow || object.userData['noShadow'] === true;
      if (object instanceof PointLight) {
        if (object.userData['volumetric'] === true) lights.push(object);
        const cast = enabled && object.userData['shadowCaster'] === true;
        if (cast && !object.castShadow) {
          object.shadow.mapSize.set(512, 512);
          object.shadow.bias = -0.003;
          object.shadow.normalBias = 0.03;
          object.shadow.camera.near = 0.1;
        }
        object.castShadow = cast;
      } else if (object instanceof Mesh) {
        const material = object.material as Material | Material[];
        const solid = ![material]
          .flat()
          .some((m) => m.transparent || m instanceof MeshBasicMaterial);
        object.castShadow = enabled && solid && !skip;
        object.receiveShadow = enabled && solid;
      }
      object.children.forEach((child) => visit(child, skip));
    };
    visit(this.scene, false);
    this.volumetricLights = lights;
  }

  public dispose(): void {
    this.resizeObserver.disconnect();
    this.setBloom(false);
    this.setDust(false);
    this.setAmbientOcclusion(false);
    this.setVolumetricFog(false);
    this.composer.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }

  private resize(): void {
    const width = Math.max(1, this.container.clientWidth);
    const height = Math.max(1, this.container.clientHeight);
    this.renderer.setSize(width, height, false);
    this.composer.setPixelRatio(this.renderer.getPixelRatio());
    this.composer.setSize(width, height);
    for (const camera of [this.camera, this.viewmodelCamera]) {
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    }
  }
}
