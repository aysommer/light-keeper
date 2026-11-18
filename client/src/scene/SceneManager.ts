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

/** Рендерер, сцена, камера и реакция на изменение размера окна. */
export class SceneManager {
  private static readonly DARKNESS = '#14110a';

  public readonly scene = new Scene();
  public readonly camera = new PerspectiveCamera(75, 1, 0.05, 60);
  public readonly renderer: WebGLRenderer;
  private readonly resizeObserver: ResizeObserver;

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

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
    this.resize();
  }

  public get canvas(): HTMLCanvasElement {
    return this.renderer.domElement;
  }

  public render(): void {
    this.renderer.render(this.scene, this.camera);
  }

  public dispose(): void {
    this.resizeObserver.disconnect();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }

  private resize(): void {
    const width = Math.max(1, this.container.clientWidth);
    const height = Math.max(1, this.container.clientHeight);
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }
}
