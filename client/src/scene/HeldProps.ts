import {
  BoxGeometry,
  CanvasTexture,
  ConeGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  SRGBColorSpace,
  TorusGeometry,
} from 'three';
import type { BufferGeometry, Material, Texture } from 'three';
import type { ExitCode, HeldItem } from '@light-keeper/shared';
import { CodeSymbols } from '../ui/CodeSymbols.ts';

/**
 * Предметы в руке от первого лица (кроме лампы): компас со стрелкой на
 * напарника, связка найденных ключей и записка с кодом — код читается прямо
 * на листке. Все предметы — в локальных координатах руки вьюмодели.
 */
export class HeldProps {
  /** Сколько ключей может быть на связке. */
  private static readonly MAX_KEYS = 3;

  public readonly compass = new Group();
  public readonly keys = new Group();
  public readonly note = new Group();
  private readonly needle = new Group();
  private readonly keyMeshes: Group[] = [];
  private readonly geometries: BufferGeometry[] = [];
  private readonly materials: Material[] = [];
  private readonly textures: Texture[] = [];
  private readonly noteTexture: CanvasTexture;
  private readonly noteCanvas: HTMLCanvasElement;
  private readonly noteMaterial: MeshStandardMaterial;
  private shownCode: ExitCode | null | undefined = undefined;

  public constructor() {
    const brass = this.own(
      new MeshStandardMaterial({ color: '#c9a227', metalness: 0.75, roughness: 0.35 }),
    );
    this.buildCompass(brass);
    // Ключи слегка светятся: лампа в это время убрана, а связку должно быть видно.
    this.buildKeys(
      this.own(
        new MeshStandardMaterial({
          color: '#d4ad2f',
          emissive: '#8a6a10',
          emissiveIntensity: 0.8,
          metalness: 0.7,
          roughness: 0.3,
        }),
      ),
    );
    this.noteCanvas = document.createElement('canvas');
    this.noteCanvas.width = 512;
    this.noteCanvas.height = 352;
    this.noteTexture = new CanvasTexture(this.noteCanvas);
    this.noteTexture.colorSpace = SRGBColorSpace;
    this.noteTexture.anisotropy = 8;
    this.noteMaterial = this.own(
      new MeshStandardMaterial({ map: this.noteTexture, roughness: 0.95, emissive: '#3a362a' }),
    );
    const sheet = new Mesh(this.geometry(new PlaneGeometry(0.22, 0.15)), this.noteMaterial);
    this.note.add(sheet);
    this.drawNote(null);
  }

  /**
   * @param item что сейчас в руке
   * @param bearing направление на напарника, рад (по часовой от «вперёд»); `null` — неизвестно
   * @param keys сколько ключей у игрока
   * @param code код из записки (`null` — записки нет)
   */
  public update(
    item: HeldItem,
    time: number,
    bearing: number | null,
    keys: number,
    code: ExitCode | null,
  ): void {
    this.compass.visible = item === 'compass';
    this.keys.visible = item === 'key';
    this.note.visible = item === 'note';
    if (this.compass.visible) {
      // Неизвестно, где напарник, — стрелка беспокойно гуляет.
      const angle = bearing ?? Math.sin(time * 1.7) * 1.2 + Math.sin(time * 0.6) * 2;
      this.needle.rotation.y = -angle;
    }
    this.keyMeshes.forEach((key, index) => (key.visible = index < keys));
    if (code !== this.shownCode) {
      this.shownCode = code;
      this.drawNote(code);
    }
  }

  public dispose(): void {
    this.geometries.forEach((geometry) => geometry.dispose());
    this.materials.forEach((material) => material.dispose());
    this.noteTexture.dispose();
    this.textures.forEach((texture) => texture.dispose());
  }

  /** Латунный компас: корпус, светлый циферблат, красно-белая стрелка. */
  private buildCompass(brass: Material): void {
    const body = new Mesh(this.geometry(new CylinderGeometry(0.06, 0.06, 0.018, 28)), brass);
    this.compass.add(body);
    const face = new Mesh(
      this.geometry(new CylinderGeometry(0.052, 0.052, 0.002, 28)),
      this.own(new MeshStandardMaterial({ map: this.dialTexture(), roughness: 0.8 })),
    );
    face.position.y = 0.0095;
    this.compass.add(face);
    this.needle.position.y = 0.013;
    const north = new Mesh(
      this.geometry(
        new ConeGeometry(0.008, 0.045, 8).rotateX(-Math.PI / 2).translate(0, 0, -0.0225),
      ),
      this.own(new MeshBasicMaterial({ color: '#d63a3a' })),
    );
    const south = new Mesh(
      this.geometry(new ConeGeometry(0.008, 0.035, 8).rotateX(Math.PI / 2).translate(0, 0, 0.0175)),
      this.own(new MeshBasicMaterial({ color: '#e8e2cf' })),
    );
    const pin = new Mesh(this.geometry(new CylinderGeometry(0.004, 0.004, 0.006, 10)), brass);
    this.needle.add(north, south, pin);
    this.compass.add(this.needle);
    // Циферблатом к глазам.
    this.compass.rotation.x = 1.05;
  }

  /** Связка ключей: до трёх латунных ключей на кольце, видно столько, сколько найдено. */
  private buildKeys(brass: Material): void {
    const ring = new Mesh(this.geometry(new TorusGeometry(0.022, 0.003, 6, 18)), brass);
    this.keys.add(ring);
    const bow = this.geometry(new TorusGeometry(0.014, 0.004, 6, 14));
    const shaft = this.geometry(new BoxGeometry(0.006, 0.07, 0.004));
    const tooth = this.geometry(new BoxGeometry(0.014, 0.008, 0.004));
    for (let i = 0; i < HeldProps.MAX_KEYS; i++) {
      const key = new Group();
      const keyBow = new Mesh(bow, brass);
      keyBow.position.y = -0.03;
      const keyShaft = new Mesh(shaft, brass);
      keyShaft.position.y = -0.078;
      const keyTooth = new Mesh(tooth, brass);
      keyTooth.position.set(0.008, -0.105, 0);
      key.add(keyBow, keyShaft, keyTooth);
      key.rotation.z = (i - 1) * 0.45;
      key.position.z = i * 0.004;
      this.keys.add(key);
      this.keyMeshes.push(key);
    }
    this.keys.rotation.set(0.2, -0.3, 0);
    this.keys.scale.setScalar(1.6);
  }

  /** Записка: тетрадный лист, сверху «Код от двери», ниже — крупно символы кода. */
  private drawNote(code: ExitCode | null): void {
    const ctx = this.noteCanvas.getContext('2d');
    if (!ctx) return;
    const { width, height } = this.noteCanvas;
    ctx.fillStyle = '#f1ead2';
    ctx.fillRect(0, 0, width, height);
    ctx.strokeStyle = 'rgba(80, 110, 160, 0.3)';
    ctx.lineWidth = 2;
    for (let y = 40; y < height; y += 32) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }
    ctx.fillStyle = 'rgba(38, 35, 51, 0.75)';
    ctx.font = '28px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Код от двери', width / 2, 62);
    if (code) {
      const cell = width / (code.symbols.length + 1);
      const size = 110;
      code.symbols.forEach((symbol, index) => {
        const x = cell * (index + 1);
        const y = 200;
        ctx.fillStyle = '#262333';
        const path = CodeSymbols.PATHS[symbol];
        if (path) {
          ctx.save();
          ctx.translate(x - size / 2, y - size / 2);
          ctx.scale(size / 24, size / 24);
          ctx.fill(new Path2D(path));
          ctx.restore();
        } else {
          ctx.font = `bold ${size}px Arial`;
          ctx.textBaseline = 'middle';
          ctx.fillText(symbol, x, y + 6);
          ctx.textBaseline = 'alphabetic';
        }
      });
    }
    this.noteTexture.needsUpdate = true;
  }

  /** Циферблат: светлый круг с делениями и буквой «С». */
  private dialTexture(): Texture {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#efe6cc';
      ctx.fillRect(0, 0, 128, 128);
      ctx.strokeStyle = '#5a4a2a';
      ctx.lineWidth = 3;
      for (let i = 0; i < 12; i++) {
        const angle = (i / 12) * Math.PI * 2;
        const inner = i % 3 === 0 ? 44 : 52;
        ctx.beginPath();
        ctx.moveTo(64 + Math.sin(angle) * inner, 64 - Math.cos(angle) * inner);
        ctx.lineTo(64 + Math.sin(angle) * 60, 64 - Math.cos(angle) * 60);
        ctx.stroke();
      }
    }
    const texture = new CanvasTexture(canvas);
    texture.colorSpace = SRGBColorSpace;
    return this.ownTexture(texture);
  }

  private ownTexture(texture: Texture): Texture {
    this.textures.push(texture);
    return texture;
  }

  private own<T extends Material>(material: T): T {
    this.materials.push(material);
    return material;
  }

  private geometry<T extends BufferGeometry>(geometry: T): T {
    this.geometries.push(geometry);
    return geometry;
  }
}
