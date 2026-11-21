import { SRGBColorSpace, TextureLoader } from 'three';
import type { AnimationClip, Group } from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import type { PlayerColor } from '@light-keeper/shared';

/** Скин героя: текстура и где на ней нарисованы глаза (для моргания). */
export interface CharacterSkin {
  /** Имя героя для интерфейса. */
  readonly name: string;
  /** Цвет рукава — рука героя от первого лица. */
  readonly sleeve: string;
  /** Портрет для лобби. */
  readonly portrait: string;
  readonly texture: string;
  /** Центры глаз на текстуре (пиксели 1024×1024) и радиус зрачка. */
  readonly eyes: readonly { readonly x: number; readonly y: number }[];
  readonly eyeRadius: number;
  /** Цвет кожи вокруг глаз — им «закрываются» веки. */
  readonly skinColor: string;
}

/** Загруженные модель и анимации героев (Kenney «Animated Characters: Protagonists», CC0). */
export interface LoadedCharacters {
  readonly model: Group;
  readonly idle: AnimationClip;
  readonly run: AnimationClip;
  readonly skins: Readonly<
    Record<PlayerColor, { open: HTMLCanvasElement; closed: HTMLCanvasElement }>
  >;
}

/**
 * Модели главных героев: мальчик в рыжей футболке (красный игрок) и усатый
 * мужчина в белом костюме (голубой игрок). Одна модель и анимации на обоих,
 * отличаются текстурой. Загружаются один раз на страницу.
 */
export class CharacterAssets {
  private static readonly BASE = '/models/characters/';
  public static readonly SKINS: Readonly<Record<PlayerColor, CharacterSkin>> = {
    red: {
      name: 'Мальчик',
      portrait: '/images/hero-boy.png',
      sleeve: '#ecebe6',
      texture: 'skaterMaleA.png',
      eyes: [
        { x: 287, y: 220 },
        { x: 357, y: 220 },
      ],
      eyeRadius: 10,
      skinColor: '#f59474',
    },
    blue: {
      name: 'Усач',
      portrait: '/images/hero-man.png',
      sleeve: '#f6f5f0',
      texture: 'criminalMaleA.png',
      eyes: [
        { x: 287, y: 220 },
        { x: 357, y: 220 },
      ],
      eyeRadius: 10,
      skinColor: '#f59474',
    },
  };

  private static pending: Promise<LoadedCharacters> | null = null;

  /** Загрузить (или получить уже загруженные) модели. */
  public static load(): Promise<LoadedCharacters> {
    CharacterAssets.pending ??= CharacterAssets.loadAll();
    return CharacterAssets.pending;
  }

  private static async loadAll(): Promise<LoadedCharacters> {
    const loader = new FBXLoader();
    const [model, idle, run, red, blue] = await Promise.all([
      loader.loadAsync(`${CharacterAssets.BASE}characterMedium.fbx`),
      loader.loadAsync(`${CharacterAssets.BASE}idle.fbx`),
      loader.loadAsync(`${CharacterAssets.BASE}run.fbx`),
      CharacterAssets.loadSkin(CharacterAssets.SKINS.red),
      CharacterAssets.loadSkin(CharacterAssets.SKINS.blue),
    ]);
    const idleClip = idle.animations.find((clip) => /idle/i.test(clip.name));
    const runClip = run.animations.find((clip) => /run/i.test(clip.name));
    if (!idleClip || !runClip) {
      throw new Error('Нет анимаций idle/run');
    }
    return { model, idle: idleClip, run: runClip, skins: { red, blue } };
  }

  /** Текстура скина и её копия с закрытыми глазами (веки цвета кожи и тёмная черта). */
  private static async loadSkin(
    skin: CharacterSkin,
  ): Promise<{ open: HTMLCanvasElement; closed: HTMLCanvasElement }> {
    const texture = await new TextureLoader().loadAsync(`${CharacterAssets.BASE}${skin.texture}`);
    texture.colorSpace = SRGBColorSpace;
    const image = texture.image as HTMLImageElement;
    const open = document.createElement('canvas');
    open.width = image.width;
    open.height = image.height;
    open.getContext('2d')?.drawImage(image, 0, 0);
    const closed = document.createElement('canvas');
    closed.width = image.width;
    closed.height = image.height;
    const ctx = closed.getContext('2d');
    if (ctx) {
      ctx.drawImage(image, 0, 0);
      for (const eye of skin.eyes) {
        ctx.save();
        // Брови выше глаз не трогаем.
        ctx.beginPath();
        ctx.rect(eye.x - 20, eye.y - skin.eyeRadius + 2, 40, 40);
        ctx.clip();
        ctx.fillStyle = skin.skinColor;
        ctx.beginPath();
        ctx.ellipse(eye.x, eye.y + 1, skin.eyeRadius + 1, skin.eyeRadius, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        ctx.strokeStyle = '#3a1a10';
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(eye.x - skin.eyeRadius, eye.y + 1);
        ctx.quadraticCurveTo(eye.x, eye.y + 6, eye.x + skin.eyeRadius, eye.y + 1);
        ctx.stroke();
      }
    }
    texture.dispose();
    return { open, closed };
  }
}
