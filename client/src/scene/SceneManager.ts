import {
  ACESFilmicToneMapping,
  Color,
  Fog,
  HemisphereLight,
  PerspectiveCamera,
  Scene,
  SRGBColorSpace,
  WebGLRenderer,
} from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { FilmShader } from './FilmShader.ts';

/** Рендерер, сцена, камера и реакция на изменение размера окна. */
export class SceneManager {
  private static readonly DARKNESS = '#14110a';

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

  public constructor(private readonly container: HTMLElement) {
    this.renderer = new WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = SRGBColorSpace;
    this.renderer.toneMapping = ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;
    this.renderer.domElement.className = 'game-canvas';
    container.append(this.renderer.domElement);

    this.scene.background = new Color(SceneManager.DARKNESS);
    this.scene.fog = new Fog(SceneManager.DARKNESS, 3, 22);
    // Слабый рассеянный свет: без лампы почти темно, но очертания видны.
    this.scene.add(new HemisphereLight('#fff1c4', '#2b2414', 0.35));
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

  /** @param time время, с (для зерна); @param scare испуг 0–1 */
  public render(time = 0, scare = 0): void {
    const uniforms = this.film.uniforms as Record<string, { value: number }>;
    uniforms['uTime']!.value = time % 1000;
    uniforms['uScare']!.value = scare;
    this.composer.render();
  }

  public dispose(): void {
    this.resizeObserver.disconnect();
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
