import { CanvasTexture, Mesh, MeshBasicMaterial, PlaneGeometry, SRGBColorSpace } from 'three';
import type { WaySign } from '@light-keeper/shared';
import { SceneCoords } from './SceneCoords.ts';

/**
 * Табличка-указатель на стене — как знак эвакуации: светящийся зелёный
 * прямоугольник с белой стрелкой и надписью «ВЫХОД» или «ЛЕСТНИЦА».
 */
export class WaySignView {
  private static readonly HEIGHT = 1.85;

  public readonly root: Mesh;
  private readonly texture: CanvasTexture;
  private readonly material: MeshBasicMaterial;

  public constructor(sign: WaySign) {
    this.texture = WaySignView.draw(sign);
    this.material = new MeshBasicMaterial({ map: this.texture, color: '#d8e8d8' });
    this.root = new Mesh(new PlaneGeometry(0.8, 0.4), this.material);
    this.root.position.copy(SceneCoords.toScene(sign.position, WaySignView.HEIGHT, 0));
    // Плоскость смотрит в +Z — разворачиваем лицом в комнату (как дверь).
    this.root.rotation.y = Math.atan2(sign.normal.x, -sign.normal.y);
  }

  public dispose(): void {
    this.root.removeFromParent();
    this.root.geometry.dispose();
    this.material.dispose();
    this.texture.dispose();
  }

  private static draw(sign: WaySign): CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#1f8a45';
      ctx.fillRect(0, 0, 256, 128);
      ctx.strokeStyle = '#f2fff4';
      ctx.lineWidth = 6;
      ctx.strokeRect(5, 5, 246, 118);
      // Стрелка.
      ctx.save();
      ctx.translate(sign.arrow === 'right' ? 200 : 56, 64);
      ctx.scale(sign.arrow === 'right' ? 1 : -1, 1);
      ctx.fillStyle = '#f2fff4';
      ctx.beginPath();
      ctx.moveTo(-36, -12);
      ctx.lineTo(4, -12);
      ctx.lineTo(4, -30);
      ctx.lineTo(38, 0);
      ctx.lineTo(4, 30);
      ctx.lineTo(4, 12);
      ctx.lineTo(-36, 12);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      // Надпись — с другой стороны от стрелки.
      ctx.fillStyle = '#f2fff4';
      ctx.font = 'bold 22px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(
        sign.target === 'stairs' ? 'ЛЕСТНИЦА' : 'ВЫХОД',
        sign.arrow === 'right' ? 98 : 158,
        66,
      );
    }
    const texture = new CanvasTexture(canvas);
    texture.colorSpace = SRGBColorSpace;
    return texture;
  }
}
