import {
  AnimationMixer,
  ConeGeometry,
  Group,
  IcosahedronGeometry,
  Mesh,
  MeshStandardMaterial,
  SphereGeometry,
} from 'three';
import type { AnimationClip, BufferGeometry, Object3D } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js';

/** Модель зайца из файла (если её положили в `public/models/rabbit/rabbit.glb`). */
interface RabbitAsset {
  readonly scene: Group;
  readonly clips: readonly AnimationClip[];
}

/**
 * Белый низкополигональный заяц. Если в `public/models/rabbit/rabbit.glb`
 * лежит модель (например, «Low Poly Rabbit» с Sketchfab), берётся она —
 * перекрашенная в белый; иначе — своя модель из примитивов.
 * Заяц бежит прыжками: тело подскакивает, уши прижимаются.
 */
export class RabbitModel {
  private static readonly URL = '/models/rabbit/rabbit.glb';
  /** Длина зайца, м. */
  private static readonly LENGTH = 0.6;
  private static asset: Promise<RabbitAsset | null> | null = null;

  public readonly root = new Group();
  private readonly body = new Group();
  private readonly ears: Mesh[] = [];
  private readonly geometries: BufferGeometry[] = [];
  private readonly material = new MeshStandardMaterial({
    color: '#f4f2ec',
    roughness: 0.9,
    flatShading: true,
    // Чуть светится — белое пятно в темноте коридора.
    emissive: '#5a5a56',
  });
  private readonly eyeMaterial = new MeshStandardMaterial({ color: '#120404', roughness: 0.3 });
  private mixer: AnimationMixer | null = null;
  private phase = 0;
  private disposed = false;

  public constructor() {
    this.root.add(this.body);
    this.buildPrimitive();
    this.body.scale.setScalar(1.4);
    void RabbitModel.load().then((asset) => {
      if (asset && !this.disposed) this.useAsset(asset);
    });
  }

  /** Заранее подгрузить модель из файла (если он есть). */
  public static load(): Promise<RabbitAsset | null> {
    RabbitModel.asset ??= RabbitModel.fetchAsset();
    return RabbitModel.asset;
  }

  /** @param speed скорость бега, м/с (0 — сидит) */
  public update(deltaSeconds: number, speed: number): void {
    if (this.mixer) {
      this.mixer.update(deltaSeconds * Math.max(0.3, speed / 4));
    }
    this.phase += deltaSeconds * (speed > 0.1 ? 14 : 0);
    const hop = Math.abs(Math.sin(this.phase));
    this.body.position.y = speed > 0.1 ? hop * 0.12 : 0;
    this.body.rotation.x = speed > 0.1 ? (hop - 0.5) * 0.35 : 0;
    this.ears.forEach((ear) => (ear.rotation.x = -0.25 - Math.min(1, speed / 5) * 0.9));
  }

  /** Прозрачность (растворение в темноте): 1 — виден целиком. */
  public setOpacity(opacity: number): void {
    const transparent = opacity < 1;
    if (this.material.transparent !== transparent) {
      this.material.transparent = transparent;
      this.eyeMaterial.transparent = transparent;
      this.material.needsUpdate = true;
      this.eyeMaterial.needsUpdate = true;
    }
    this.material.opacity = opacity;
    this.eyeMaterial.opacity = opacity;
  }

  public dispose(): void {
    this.disposed = true;
    this.root.removeFromParent();
    this.geometries.forEach((geometry) => geometry.dispose());
    this.material.dispose();
    this.eyeMaterial.dispose();
  }

  /** Своя модель: тело, голова, длинные уши, хвост-пуховка, лапы. Смотрит в −Z. */
  private buildPrimitive(): void {
    const torso = this.mesh(new IcosahedronGeometry(0.15, 1));
    torso.scale.set(0.9, 0.85, 1.35);
    torso.position.set(0, 0.17, 0.03);
    const head = this.mesh(new IcosahedronGeometry(0.09, 1));
    head.position.set(0, 0.27, -0.16);
    for (const side of [-1, 1]) {
      const ear = this.mesh(new ConeGeometry(0.03, 0.2, 5));
      ear.geometry.translate(0, 0.1, 0);
      ear.position.set(side * 0.035, 0.33, -0.14);
      ear.rotation.z = -side * 0.12;
      this.ears.push(ear);
      const eye = new Mesh(this.geometry(new SphereGeometry(0.013, 6, 4)), this.eyeMaterial);
      eye.position.set(side * 0.05, 0.29, -0.23);
      this.body.add(eye);
      const paw = this.mesh(new IcosahedronGeometry(0.04, 0));
      paw.scale.set(0.8, 0.6, 1.4);
      paw.position.set(side * 0.07, 0.03, 0.08);
      const front = this.mesh(new IcosahedronGeometry(0.03, 0));
      front.position.set(side * 0.05, 0.04, -0.1);
    }
    const tail = this.mesh(new IcosahedronGeometry(0.045, 1));
    tail.position.set(0, 0.2, 0.2);
  }

  private useAsset(asset: RabbitAsset): void {
    this.body.clear();
    this.body.scale.setScalar(1);
    this.ears.length = 0;
    const model = clone(asset.scene);
    model.traverse((object: Object3D) => {
      const mesh = object as Mesh;
      if (mesh.isMesh) {
        mesh.material = this.material;
        mesh.castShadow = false;
      }
    });
    // Подогнать размер: самая длинная сторона — длина зайца.
    model.updateMatrixWorld(true);
    let maxSide = 0;
    model.traverse((object: Object3D) => {
      const mesh = object as Mesh;
      if (mesh.isMesh) {
        mesh.geometry.computeBoundingBox();
        const box = mesh.geometry.boundingBox;
        if (box) {
          const size = box.max.clone().sub(box.min).multiply(mesh.getWorldScale(box.min.clone()));
          maxSide = Math.max(maxSide, size.x, size.y, size.z);
        }
      }
    });
    if (maxSide > 0) model.scale.multiplyScalar(RabbitModel.LENGTH / maxSide);
    this.body.add(model);
    const clip = asset.clips[0];
    if (clip) {
      this.mixer = new AnimationMixer(model);
      this.mixer.clipAction(clip).play();
    }
  }

  private static async fetchAsset(): Promise<RabbitAsset | null> {
    try {
      const response = await fetch(RabbitModel.URL);
      const type = response.headers.get('content-type') ?? '';
      // Нет файла: сервер разработки отдаёт вместо него страницу.
      if (!response.ok || type.includes('text/html')) return null;
      const gltf = await new GLTFLoader().parseAsync(await response.arrayBuffer(), '');
      return { scene: gltf.scene, clips: gltf.animations };
    } catch {
      return null;
    }
  }

  private mesh(geometry: BufferGeometry): Mesh {
    const mesh = new Mesh(this.geometry(geometry), this.material);
    this.body.add(mesh);
    return mesh;
  }

  private geometry<T extends BufferGeometry>(geometry: T): T {
    this.geometries.push(geometry);
    return geometry;
  }
}
