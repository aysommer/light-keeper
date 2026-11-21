import { CanvasTexture, DoubleSide, Group, Mesh, MeshStandardMaterial, PlaneGeometry } from 'three';
import type { ExitSnapshot, Vector2 } from '@light-keeper/shared';
import { SceneCoords } from './SceneCoords.ts';

/**
 * Записка с кодом двери: сложенный тетрадный лист, слегка светится, парит и
 * медленно вращается (как ключ — чтобы её можно было заметить). Сам код виден
 * только тому, кто записку подобрал и достал (слот 4).
 */
export class NoteView {
  private static readonly HEIGHT = 0.9;

  public readonly root = new Group();
  private readonly geometry = new PlaneGeometry(0.21, 0.28);
  private readonly texture: CanvasTexture;
  private readonly material: MeshStandardMaterial;

  public constructor(position: Vector2) {
    this.texture = NoteView.createTexture();
    this.material = new MeshStandardMaterial({
      map: this.texture,
      emissive: '#6b6450',
      emissiveIntensity: 0.6,
      roughness: 0.9,
      side: DoubleSide,
    });
    const sheet = new Mesh(this.geometry, this.material);
    sheet.rotation.x = -0.35;
    this.root.add(sheet);
    this.root.position.copy(SceneCoords.toScene(position, NoteView.HEIGHT));
  }

  public update(state: ExitSnapshot | null, time: number): void {
    this.root.visible = (state?.noteHolderId ?? null) === null;
    this.root.rotation.y = time * 0.9;
    this.root.position.y = NoteView.HEIGHT + Math.sin(time * 1.8) * 0.04;
  }

  public dispose(): void {
    this.root.removeFromParent();
    this.geometry.dispose();
    this.material.dispose();
    this.texture.dispose();
  }

  /** Лист в клетку с неразборчивыми строчками. */
  private static createTexture(): CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 96;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#f1ead2';
      ctx.fillRect(0, 0, 96, 128);
      ctx.strokeStyle = 'rgba(80, 110, 160, 0.35)';
      for (let y = 12; y < 128; y += 10) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(96, y);
        ctx.stroke();
      }
      ctx.strokeStyle = 'rgba(40, 40, 60, 0.8)';
      ctx.lineWidth = 2;
      for (let y = 30; y < 80; y += 20) {
        ctx.beginPath();
        ctx.moveTo(18, y);
        ctx.bezierCurveTo(35, y - 6, 55, y + 6, 78, y - 2);
        ctx.stroke();
      }
    }
    return new CanvasTexture(canvas);
  }
}
