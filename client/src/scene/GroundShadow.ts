import { CanvasTexture, Mesh, MeshBasicMaterial, PlaneGeometry } from 'three';
import type { Object3D } from 'three';

/**
 * Мягкая тень под ногами: тёмное размытое пятно на полу под фигурой или предметом.
 * Пятна лежат на отдельном слое отрисовки — галочка просто включает этот слой
 * у камеры, поэтому выключенные пятна не рисуются и ничего не стоят.
 * Один экземпляр — общие текстура, материал и геометрия для всех своих пятен.
 */
export class GroundShadow {
  /** Слой отрисовки пятен (камера видит его, только когда галочка включена). */
  public static readonly LAYER = 1;
  /** Чуть над полом, чтобы не мерцать вместе с ним. */
  private static readonly LIFT = 0.012;

  private readonly texture: CanvasTexture;
  private readonly material: MeshBasicMaterial;
  private readonly geometry = new PlaneGeometry(1, 1).rotateX(-Math.PI / 2);

  /** @param darkness непрозрачность центра пятна, 0–1 */
  public constructor(darkness = 0.55) {
    this.texture = GroundShadow.createTexture();
    this.material = new MeshBasicMaterial({
      map: this.texture,
      color: '#000000',
      transparent: true,
      opacity: darkness,
      depthWrite: false,
      fog: true,
    });
  }

  /**
   * Добавляет пятно под объектом (объект стоит на полу в своём начале координат).
   * @param width ширина пятна, м; @param depth глубина пятна, м
   */
  public attach(parent: Object3D, width: number, depth = width): Mesh {
    const mesh = new Mesh(this.geometry, this.material);
    mesh.scale.set(width, 1, depth);
    mesh.position.y = GroundShadow.LIFT;
    mesh.renderOrder = -1;
    mesh.layers.set(GroundShadow.LAYER);
    parent.add(mesh);
    return mesh;
  }

  public dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
    this.texture.dispose();
  }

  private static createTexture(): CanvasTexture {
    const size = 64;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const gradient = ctx.createRadialGradient(
        size / 2,
        size / 2,
        0,
        size / 2,
        size / 2,
        size / 2,
      );
      gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
      gradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.8)');
      gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, size, size);
    }
    return new CanvasTexture(canvas);
  }
}
