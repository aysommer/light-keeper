import { CanvasTexture, RepeatWrapping, SRGBColorSpace } from 'three';
import { SeededRandom } from '@light-keeper/shared';

/** Процедурные текстуры лиминального пространства (без внешних файлов). */
export class TextureFactory {
  private static readonly SIZE = 256;

  /** Блёклые жёлтые обои с вертикальными полосами. Плитка — 1 м. */
  public createWallpaper(): CanvasTexture {
    return this.paint(17, (ctx, rng, size) => {
      ctx.fillStyle = '#c9b765';
      ctx.fillRect(0, 0, size, size);
      for (let x = 0; x < size; x += 32) {
        ctx.fillStyle = 'rgba(255, 245, 190, 0.18)';
        ctx.fillRect(x, 0, 12, size);
        ctx.fillStyle = 'rgba(120, 100, 40, 0.10)';
        ctx.fillRect(x + 14, 0, 2, size);
      }
      this.speckle(ctx, rng, size, 2500, 'rgba(90, 75, 30, 0.10)');
    });
  }

  /** Пёстрый ковролин. Плитка — 2 м. */
  public createCarpet(): CanvasTexture {
    return this.paint(29, (ctx, rng, size) => {
      ctx.fillStyle = '#8f8048';
      ctx.fillRect(0, 0, size, size);
      this.speckle(ctx, rng, size, 9000, 'rgba(60, 50, 20, 0.25)');
      this.speckle(ctx, rng, size, 6000, 'rgba(200, 185, 120, 0.18)');
      for (let i = 0; i < 6; i++) {
        ctx.fillStyle = 'rgba(50, 40, 15, 0.12)';
        ctx.beginPath();
        ctx.ellipse(
          rng.float(0, size),
          rng.float(0, size),
          rng.float(10, 40),
          rng.float(6, 24),
          rng.float(0, Math.PI),
          0,
          Math.PI * 2,
        );
        ctx.fill();
      }
    });
  }

  /** Подвесной потолок «Армстронг»: 2×2 плитки на текстуру. Плитка текстуры — 1.2 м. */
  public createCeiling(): CanvasTexture {
    return this.paint(41, (ctx, rng, size) => {
      ctx.fillStyle = '#d6d0b4';
      ctx.fillRect(0, 0, size, size);
      this.speckle(ctx, rng, size, 3000, 'rgba(110, 100, 70, 0.25)');
      ctx.fillStyle = '#8f8a72';
      const half = size / 2;
      for (const offset of [0, half]) {
        ctx.fillRect(offset, 0, 3, size);
        ctx.fillRect(0, offset, size, 3);
      }
    });
  }

  private paint(
    seed: number,
    draw: (ctx: CanvasRenderingContext2D, rng: SeededRandom, size: number) => void,
  ): CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = TextureFactory.SIZE;
    canvas.height = TextureFactory.SIZE;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Canvas 2D недоступен');
    }
    draw(ctx, new SeededRandom(seed), TextureFactory.SIZE);
    const texture = new CanvasTexture(canvas);
    texture.wrapS = RepeatWrapping;
    texture.wrapT = RepeatWrapping;
    texture.colorSpace = SRGBColorSpace;
    texture.anisotropy = 4;
    return texture;
  }

  private speckle(
    ctx: CanvasRenderingContext2D,
    rng: SeededRandom,
    size: number,
    count: number,
    color: string,
  ): void {
    ctx.fillStyle = color;
    for (let i = 0; i < count; i++) {
      ctx.fillRect(rng.float(0, size), rng.float(0, size), 1.5, 1.5);
    }
  }
}
