import {
  ACESFilmicToneMapping,
  Color,
  Fog,
  HemisphereLight,
  PerspectiveCamera,
  Scene,
  SRGBColorSpace,
  Vector3,
  WebGLRenderer,
} from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { DustField } from './DustField.ts';
import { FilmShader } from './FilmShader.ts';
import { GroundShadow } from './GroundShadow.ts';
import { SoftBloomPass } from './SoftBloomPass.ts';

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
    const viewmodelPass = new RenderPass(this.viewmodelScene, this.viewmodelCamera);
    viewmodelPass.clear = false;
    viewmodelPass.clearDepth = true;
    this.composer.addPass(viewmodelPass);
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
    this.composer.render();
  }

  public dispose(): void {
    this.resizeObserver.disconnect();
    this.setBloom(false);
    this.setDust(false);
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
