import { CanvasTexture, RepeatWrapping, SRGBColorSpace } from 'three';
import { SeededRandom } from '@light-keeper/shared';
import type { SpacePalette, WallpaperPattern } from '@light-keeper/shared';

type Painter = (ctx: CanvasRenderingContext2D, size: number) => void;

/** Процедурные текстуры пространства по его палитре (без внешних файлов). */
export class TextureFactory {
  /** Логический размер текстуры: в нём рисуются все узоры. */
  private static readonly SIZE = 256;
  /** Анизотропная фильтрация: обычная и для чётких текстур (видеокарта ограничит сама). */
  private static readonly ANISOTROPY = 4;
  private static readonly SHARP_ANISOTROPY = 16;

  /**
   * @param scale во сколько раз больше пикселей у холста (1 — обычные текстуры,
   *   2 — чёткие): узоры те же, но края у них резче, а пол вдали не «плывёт».
   */
  public constructor(
    private readonly palette: SpacePalette,
    private readonly scale = 1,
  ) {}

  /** Обои: цвет и узор из палитры. Плитка — 1 м. */
  public createWallpaper(): CanvasTexture {
    const painters: Record<WallpaperPattern, Painter> = {
      stripes: (ctx, size) => this.paintStripes(ctx, size),
      diamonds: (ctx, size) => this.paintDiamonds(ctx, size),
      checks: (ctx, size) => this.paintChecks(ctx, size),
      plain: () => undefined,
      damask: (ctx, size) => this.paintDamask(ctx, size),
    };
    return this.paint(17, (ctx, rng, size) => {
      ctx.fillStyle = this.palette.wall.toHex();
      ctx.fillRect(0, 0, size, size);
      ctx.save();
      painters[this.palette.pattern](ctx, size);
      ctx.restore();
      this.speckle(ctx, rng, size, 2500, 'rgba(40, 35, 20, 0.08)');
    });
  }

  /** Ковролин в цвет пола. Плитка — 2 м. */
  public createCarpet(): CanvasTexture {
    const floor = this.palette.floor;
    return this.paint(29, (ctx, rng, size) => {
      ctx.fillStyle = floor.toHex();
      ctx.fillRect(0, 0, size, size);
      this.speckle(ctx, rng, size, 9000, floor.withLightness(floor.lightness * 0.6).toHex());
      this.speckle(ctx, rng, size, 6000, floor.withLightness(floor.lightness * 1.35).toHex());
      ctx.fillStyle = 'rgba(20, 15, 5, 0.12)';
      for (let i = 0; i < 6; i++) {
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

  /** Подвесной потолок: 2×2 плитки на текстуру. Плитка текстуры — 1.2 м. */
  public createCeiling(): CanvasTexture {
    const ceiling = this.palette.ceiling;
    return this.paint(41, (ctx, rng, size) => {
      ctx.fillStyle = ceiling.toHex();
      ctx.fillRect(0, 0, size, size);
      this.speckle(ctx, rng, size, 3000, ceiling.withLightness(0.55).toHex());
      ctx.fillStyle = ceiling.withLightness(0.5).toHex();
      const half = size / 2;
      for (const offset of [0, half]) {
        ctx.fillRect(offset, 0, 3, size);
        ctx.fillRect(0, offset, size, 3);
      }
    });
  }

  private paintStripes(ctx: CanvasRenderingContext2D, size: number): void {
    ctx.fillStyle = this.palette.accent.toHex();
    for (let x = 0; x < size; x += 32) {
      ctx.globalAlpha = 0.55;
      ctx.fillRect(x, 0, 12, size);
      ctx.globalAlpha = 0.35;
      ctx.fillRect(x + 15, 0, 2, size);
    }
  }

  private paintDiamonds(ctx: CanvasRenderingContext2D, size: number): void {
    ctx.strokeStyle = this.palette.accent.toHex();
    ctx.globalAlpha = 0.6;
    ctx.lineWidth = 3;
    const step = size / 4;
    for (let offset = -size; offset <= size; offset += step) {
      ctx.beginPath();
      ctx.moveTo(offset, 0);
      ctx.lineTo(offset + size, size);
      ctx.moveTo(offset + size, 0);
      ctx.lineTo(offset, size);
      ctx.stroke();
    }
    ctx.fillStyle = this.palette.accent.toHex();
    for (let y = 0; y < size; y += step) {
      for (let x = 0; x < size; x += step) {
        ctx.beginPath();
        ctx.arc(x + step / 2, y + step / 2, 4, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  private paintChecks(ctx: CanvasRenderingContext2D, size: number): void {
    ctx.fillStyle = this.palette.accent.toHex();
    const cell = 16;
    ctx.globalAlpha = 0.25;
    for (let y = 0; y < size; y += cell) {
      for (let x = (y / cell) % 2 === 0 ? 0 : cell; x < size; x += cell * 2) {
        ctx.fillRect(x, y, cell, cell);
      }
    }
    ctx.globalAlpha = 0.45;
    for (let i = 0; i < size; i += cell * 4) {
      ctx.fillRect(i, 0, 2, size);
      ctx.fillRect(0, i, size, 2);
    }
  }

  /** Цветочный трафарет: четыре лепестка и сердцевина, ряды со сдвигом. */
  private paintDamask(ctx: CanvasRenderingContext2D, size: number): void {
    ctx.fillStyle = this.palette.accent.toHex();
    ctx.globalAlpha = 0.6;
    const step = size / 4;
    for (let row = 0; row < 4; row++) {
      for (let col = 0; col < 4; col++) {
        const x = col * step + (row % 2 === 0 ? step / 2 : 0);
        const y = row * step + step / 2;
        for (let petal = 0; petal < 4; petal++) {
          ctx.beginPath();
          ctx.ellipse(
            x + Math.cos((petal * Math.PI) / 2) * 9,
            y + Math.sin((petal * Math.PI) / 2) * 9,
            8,
            4,
            (petal * Math.PI) / 2,
            0,
            Math.PI * 2,
          );
          ctx.fill();
        }
        ctx.beginPath();
        ctx.arc(x, y, 3.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  private paint(
    seed: number,
    draw: (ctx: CanvasRenderingContext2D, rng: SeededRandom, size: number) => void,
  ): CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = TextureFactory.SIZE * this.scale;
    canvas.height = TextureFactory.SIZE * this.scale;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Canvas 2D недоступен');
    }
    ctx.scale(this.scale, this.scale);
    draw(ctx, new SeededRandom(seed), TextureFactory.SIZE);
    const texture = new CanvasTexture(canvas);
    texture.wrapS = RepeatWrapping;
    texture.wrapT = RepeatWrapping;
    texture.colorSpace = SRGBColorSpace;
    texture.anisotropy =
      this.scale > 1 ? TextureFactory.SHARP_ANISOTROPY : TextureFactory.ANISOTROPY;
    return texture;
  }

  private speckle(
    ctx: CanvasRenderingContext2D,
    rng: SeededRandom,
    size: number,
    count: number,
    color: string,
  ): void {
    ctx.globalAlpha = 1;
    ctx.fillStyle = color;
    for (let i = 0; i < count; i++) {
      ctx.fillRect(rng.float(0, size), rng.float(0, size), 1.5, 1.5);
    }
  }
}
