import {
  BufferGeometry,
  Float32BufferAttribute,
  CanvasTexture,
  Group,
  Mesh,
  MeshStandardMaterial,
  Quaternion,
  SRGBColorSpace,
  Vector3,
} from 'three';
import type { Bone, Object3D, SkinnedMesh } from 'three';
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import type { PlayerColor } from '@light-keeper/shared';
import type { LoadedCharacters } from './CharacterAssets.ts';

/**
 * Правая рука героя от первого лица — из его же модели (Kenney): рукав и кисть
 * с пальцами, в цветах его скина. Из скелетной модели вырезаются треугольники,
 * которые двигает рука (плечо, предплечье, кисть, пальцы), и ставятся так, чтобы
 * плечо было внизу справа, а кисть — там, где висит фонарь.
 */
export class HeroArm {
  /** Как сгибать кости пальцев в кулак. */
  public static readonly CURL: { axis: 'x' | 'y' | 'z'; angle: number } = {
    axis: 'z',
    angle: -0.95,
  };
  public readonly root = new Group();
  private readonly geometry: BufferGeometry;
  private readonly texture: CanvasTexture;
  private readonly material: MeshStandardMaterial;

  /**
   * @param shoulder где плечо в координатах руки от первого лица
   * @param hand где должна быть кисть (там висит фонарь)
   */
  public constructor(
    assets: LoadedCharacters,
    color: PlayerColor,
    shoulder: Vector3,
    hand: Vector3,
    curl: { axis: 'x' | 'y' | 'z'; angle: number } = HeroArm.CURL,
    /** Поворот руки вокруг её оси, рад: чтобы кулак смотрел пальцами вниз, на дужку. */
    roll = 0,
  ) {
    const model = clone(assets.model);
    model.updateMatrixWorld(true);
    let skinned: SkinnedMesh | null = null;
    const bones = new Map<string, Bone>();
    model.traverse((object: Object3D) => {
      if ((object as SkinnedMesh).isSkinnedMesh) skinned = object as SkinnedMesh;
      if ((object as Bone).isBone) bones.set(object.name, object as Bone);
    });
    if (!skinned) {
      throw new Error('В модели героя нет скелетной сетки');
    }
    const mesh: SkinnedMesh = skinned;
    // Пальцы сжаты в кулак — кисть держит дужку фонаря.
    // Запястье согнуто вниз — к дужке фонаря.
    const wrist = bones.get('RightHand');
    if (wrist) wrist.rotation[curl.axis] += curl.angle * 0.55;
    for (const [name, bone] of bones) {
      if (/^RightHand(Index|Thumb)\d$/.test(name)) {
        const factor = name.includes('Thumb') ? 0.5 : 1;
        bone.rotation[curl.axis] += curl.angle * factor;
      }
    }
    model.updateMatrixWorld(true);
    mesh.skeleton.update();
    this.geometry = HeroArm.extractArm(mesh);

    // Точки руки в позе модели (T-поза): плечо и середина ладони.
    const point = (name: string): Vector3 =>
      bones.get(name)?.getWorldPosition(new Vector3()) ?? new Vector3();
    const from = point('RightArm');
    const grip = point('RightHand').add(point('RightHandIndex1')).multiplyScalar(0.5);

    // Сдвигаем руку плечом в начало координат, поворачиваем вдоль нужного
    // направления и масштабируем под длину руки от первого лица.
    this.geometry.translate(-from.x, -from.y, -from.z);
    const modelDirection = grip.clone().sub(from);
    const target = hand.clone().sub(shoulder);
    const scale = target.length() / modelDirection.length();
    const axis = target.clone().normalize();
    this.root.quaternion
      .copy(new Quaternion().setFromAxisAngle(axis, roll))
      .multiply(new Quaternion().setFromUnitVectors(modelDirection.normalize(), axis));
    this.root.scale.setScalar(scale);
    this.root.position.copy(shoulder);

    this.texture = new CanvasTexture(assets.skins[color].open);
    this.texture.colorSpace = SRGBColorSpace;
    this.material = new MeshStandardMaterial({ map: this.texture, roughness: 0.85 });
    const arm = new Mesh(this.geometry, this.material);
    arm.frustumCulled = false;
    this.root.add(arm);
  }

  public dispose(): void {
    this.root.removeFromParent();
    this.geometry.dispose();
    this.material.dispose();
    this.texture.dispose();
  }

  /** Треугольники, которые двигают кости правой руки (без ключицы и тела). */
  private static extractArm(mesh: SkinnedMesh): BufferGeometry {
    const source = mesh.geometry;
    const armBones = new Set<number>();
    mesh.skeleton.bones.forEach((bone, index) => {
      if (/^Right(Arm|ForeArm|Hand)/.test(bone.name)) armBones.add(index);
    });
    const skinIndex = source.getAttribute('skinIndex');
    const skinWeight = source.getAttribute('skinWeight');
    const dominant = (vertex: number): number => {
      let best = -1;
      let bestWeight = -1;
      for (let k = 0; k < 4; k++) {
        const weight = skinWeight.getComponent(vertex, k);
        if (weight > bestWeight) {
          bestWeight = weight;
          best = skinIndex.getComponent(vertex, k);
        }
      }
      return best;
    };
    const indices: number[] = [];
    const index = source.getIndex();
    const triangles = index ? index.count / 3 : source.getAttribute('position').count / 3;
    for (let t = 0; t < triangles; t++) {
      const corners = [0, 1, 2].map((k) => (index ? index.getX(t * 3 + k) : t * 3 + k));
      if (corners.every((vertex) => armBones.has(dominant(vertex)))) indices.push(...corners);
    }
    const geometry = new BufferGeometry();
    // Вершины в текущей позе скелета (с согнутыми пальцами) — в координатах модели.
    const sourcePositions = source.getAttribute('position');
    const positions = new Float32Array(sourcePositions.count * 3);
    const vertex = new Vector3();
    for (let i = 0; i < sourcePositions.count; i++) {
      vertex.fromBufferAttribute(sourcePositions, i);
      mesh.applyBoneTransform(i, vertex);
      vertex.applyMatrix4(mesh.matrixWorld);
      positions.set([vertex.x, vertex.y, vertex.z], i * 3);
    }
    geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
    const uv = source.getAttribute('uv');
    if (uv) geometry.setAttribute('uv', uv.clone());
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    return geometry;
  }
}
