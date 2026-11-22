import {
  BoxGeometry,
  CanvasTexture,
  ConeGeometry,
  CylinderGeometry,
  Group,
  InstancedMesh,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  PlaneGeometry,
  SRGBColorSpace,
} from 'three';
import type { BufferGeometry, Material, Texture, Matrix4 } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { AABB, GameConfig, SeedHasher, SeededRandom, Vector2 } from '@light-keeper/shared';
import type { Room, Space, SpaceFloor } from '@light-keeper/shared';
import { BoxGeometryFactory } from './BoxGeometryFactory.ts';
import { SceneCoords } from './SceneCoords.ts';

/** Что строит убранство этажа: группа мешей и то, что надо освободить вместе с ней. */
export interface DecorParts {
  readonly group: Group;
  dispose(): void;
}

/**
 * Убранство этажа — только для вида, без столкновений и без сети: всё
 * детерминировано seed пространства, поэтому у обоих игроков одинаково.
 * - плинтус вдоль стен и наличники у проёмов между комнатами;
 * - пятна: подтёки на потолке, пятна на ковре, потёки на стенах;
 * - мебель: стулья у столов, шкафы, кулеры, корзины и цветы в углах офисов.
 * Мебель не ставится у проёмов, двери, лестниц и предметов (канистр, ключей,
 * записки, флажков) — ничего не прячет и не загораживает проход.
 */
export class SpaceDecor {
  private static readonly BASEBOARD_HEIGHT = 0.1;
  private static readonly BASEBOARD_DEPTH = 0.012;
  private static readonly JAMB_WIDTH = 0.08;
  private static readonly JAMB_DEPTH = 0.025;
  /** Сколько пятен на клетку: на потолке, на полу, на стенах. */
  private static readonly CEILING_STAINS = 0.35;
  private static readonly FLOOR_STAINS = 0.3;
  private static readonly WALL_STREAKS = 0.25;
  /** Не ближе стольких метров от предметов и проёмов. */
  private static readonly KEEP_FROM_ITEMS = 1.1;
  private static readonly KEEP_FROM_DOORS = 1.4;

  private readonly geometries: BufferGeometry[] = [];
  private readonly materials: Material[] = [];
  private readonly textures: Texture[] = [];
  private readonly boxes = new BoxGeometryFactory(1);
  private readonly settings = GameConfig.world;

  public build(space: Space, floorIndex: number, trimHex: string): DecorParts {
    const floor = space.floor(floorIndex);
    const group = new Group();
    group.name = 'decor';
    const rng = new SeededRandom(SeedHasher.hash(space.seed, 'decor', floorIndex));
    const stairCells = new Set(
      space.stairs
        .filter((stair) => stair.lower === floorIndex || stair.lower + 1 === floorIndex)
        .map((stair) => space.grid.cellAt(stair.position).join(':')),
    );

    const trim = this.own(new MeshStandardMaterial({ color: trimHex, roughness: 0.6 }));
    this.addMerged(group, this.baseboards(space, floor, floorIndex), trim, 'baseboards');
    this.addMerged(group, this.jambs(floor), trim, 'door-jambs');
    group.add(...this.stains(space, floor, floorIndex, stairCells, rng.fork('stains')));
    group.add(this.furniture(space, floor, floorIndex, stairCells, trimHex, rng.fork('furniture')));

    return {
      group,
      dispose: () => {
        this.geometries.forEach((geometry) => geometry.dispose());
        this.materials.forEach((material) => material.dispose());
        this.textures.forEach((texture) => texture.dispose());
      },
    };
  }

  /** Плинтус: низкая полоса вдоль каждой стены, чуть выступает из неё (у двери выхода — разрыв). */
  private baseboards(space: Space, floor: SpaceFloor, floorIndex: number): BufferGeometry[] {
    const margin = GameConfig.exit.doorWidth / 2 + 0.08;
    return floor.walls
      .flatMap((wall) =>
        floorIndex === space.exitFloor
          ? SpaceDecor.cutAround(wall.bounds, space.exit.position, margin)
          : [wall.bounds],
      )
      .map((bounds) =>
        this.boxes.create(
          bounds.expand(SpaceDecor.BASEBOARD_DEPTH),
          0,
          SpaceDecor.BASEBOARD_HEIGHT,
        ),
      );
  }

  /**
   * Участок стены без куска шириной `2 × half` вокруг точки на ней (если точка
   * на этом участке): плинтус и планка не идут поперёк двери выхода.
   */
  public static cutAround(wall: AABB, point: Vector2, half: number): AABB[] {
    if (!wall.expand(0.01).containsPoint(point)) {
      return [wall];
    }
    const alongX = wall.width >= wall.height;
    const parts = alongX
      ? [
          new AABB(wall.minX, wall.minY, point.x - half, wall.maxY),
          new AABB(point.x + half, wall.minY, wall.maxX, wall.maxY),
        ]
      : [
          new AABB(wall.minX, wall.minY, wall.maxX, point.y - half),
          new AABB(wall.minX, point.y + half, wall.maxX, wall.maxY),
        ];
    return parts.filter((part) => part.width > 0.01 && part.height > 0.01);
  }

  /** Наличники: стойки по краям каждого проёма между комнатами, с обеих сторон стены. */
  private jambs(floor: SpaceFloor): BufferGeometry[] {
    const height = this.settings.ceilingHeight;
    const across = this.settings.wallThickness / 2 + SpaceDecor.JAMB_DEPTH;
    const width = SpaceDecor.JAMB_WIDTH;
    const result: BufferGeometry[] = [];
    for (const door of floor.doors) {
      const half = door.width / 2;
      const horizontal = door.edge.orientation === 'horizontal';
      for (const side of [-1, 1]) {
        // Стойка заходит в стену на `width` и чуть-чуть — в проём.
        const near = side * (half - 0.02);
        const far = side * (half + width);
        const from = Math.min(near, far);
        const to = Math.max(near, far);
        const bounds = horizontal
          ? new AABB(
              door.position.x + from,
              door.position.y - across,
              door.position.x + to,
              door.position.y + across,
            )
          : new AABB(
              door.position.x - across,
              door.position.y + from,
              door.position.x + across,
              door.position.y + to,
            );
        result.push(this.boxes.create(bounds, 0, height));
      }
    }
    return result;
  }

  /** Подтёки на потолке, пятна на ковре и потёки на стенах — плоские полупрозрачные пятна. */
  private stains(
    space: Space,
    floor: SpaceFloor,
    floorIndex: number,
    stairCells: ReadonlySet<string>,
    rng: SeededRandom,
  ): InstancedMesh[] {
    const cells = space.grid.columns * space.grid.rows;
    const height = this.settings.ceilingHeight;
    const dummy = new Object3D();
    const freeSpot = (): Vector2 | null => {
      for (let attempt = 0; attempt < 6; attempt++) {
        const point = new Vector2(
          rng.float(0.4, space.grid.width - 0.4),
          rng.float(0.4, space.grid.length - 0.4),
        );
        if (!stairCells.has(space.grid.cellAt(point).join(':'))) return point;
      }
      return null;
    };

    const ceilingMatrices: Matrix4[] = [];
    for (let i = 0; i < Math.round(cells * SpaceDecor.CEILING_STAINS); i++) {
      const spot = freeSpot();
      if (!spot) continue;
      const size = rng.float(0.5, 1.5);
      dummy.position.set(spot.x, height - 0.004, SceneCoords.sceneZ(spot.y));
      dummy.rotation.set(Math.PI / 2, 0, rng.float(0, Math.PI * 2));
      dummy.scale.set(size, size * rng.float(0.6, 1), 1);
      dummy.updateMatrix();
      ceilingMatrices.push(dummy.matrix.clone());
    }

    const floorMatrices: Matrix4[] = [];
    for (let i = 0; i < Math.round(cells * SpaceDecor.FLOOR_STAINS); i++) {
      const spot = freeSpot();
      if (!spot) continue;
      const size = rng.float(0.35, 1.1);
      dummy.position.set(spot.x, 0.004, SceneCoords.sceneZ(spot.y));
      dummy.rotation.set(-Math.PI / 2, 0, rng.float(0, Math.PI * 2));
      dummy.scale.set(size, size * rng.float(0.5, 1), 1);
      dummy.updateMatrix();
      floorMatrices.push(dummy.matrix.clone());
    }

    // Потёки — с потолка вниз по стене, только на сторонах, обращённых в комнату.
    const wallMatrices: Matrix4[] = [];
    const halfWall = this.settings.wallThickness / 2;
    const exitFace =
      floorIndex === space.exitFloor ? space.exit.position : new Vector2(-1000, -1000);
    for (let i = 0; i < Math.round(cells * SpaceDecor.WALL_STREAKS); i++) {
      const wall = rng.pick(floor.walls);
      const bounds = wall.bounds;
      const alongX = bounds.width >= bounds.height;
      if ((alongX ? bounds.width : bounds.height) < 1) continue;
      const normal = alongX
        ? new Vector2(0, rng.chance(0.5) ? 1 : -1)
        : new Vector2(rng.chance(0.5) ? 1 : -1, 0);
      const t = rng.float(0.3, (alongX ? bounds.width : bounds.height) - 0.3);
      const line = bounds.center;
      const point = alongX
        ? new Vector2(bounds.minX + t, line.y)
        : new Vector2(line.x, bounds.minY + t);
      const inside = point.add(normal.scale(0.4));
      if (!floor.roomAt(inside) || point.distanceTo(exitFace) < 1.4) continue;
      if (space.sign && floorIndex === 0 && point.distanceTo(space.sign.position) < 0.9) continue;
      const length = rng.float(0.6, 1.7);
      const face = point.add(normal.scale(halfWall + 0.004));
      dummy.position.set(face.x, height - length / 2, SceneCoords.sceneZ(face.y));
      // Плоскость смотрит по нормали стены (в координатах сцены z = −y).
      dummy.rotation.set(0, Math.atan2(normal.x, -normal.y), 0);
      dummy.scale.set(rng.float(0.25, 0.6), length, 1);
      dummy.updateMatrix();
      wallMatrices.push(dummy.matrix.clone());
    }

    const blot = this.blotTexture(new SeededRandom(SeedHasher.hash(space.seed, 'blot')));
    const streak = this.streakTexture(new SeededRandom(SeedHasher.hash(space.seed, 'streak')));
    return [
      this.instanced(ceilingMatrices, blot, '#8a6a2e', 0.5, 'ceiling-stains'),
      this.instanced(floorMatrices, blot, '#1c140a', 0.45, 'floor-stains'),
      this.instanced(wallMatrices, streak, '#5a4520', 0.4, 'wall-streaks'),
    ].filter((mesh): mesh is InstancedMesh => mesh !== null);
  }

  private instanced(
    matrices: readonly Matrix4[],
    texture: Texture,
    color: string,
    opacity: number,
    name: string,
  ): InstancedMesh | null {
    if (matrices.length === 0) return null;
    const material = this.own(
      new MeshStandardMaterial({
        color,
        alphaMap: texture,
        transparent: true,
        opacity,
        depthWrite: false,
        roughness: 1,
        polygonOffset: true,
        polygonOffsetFactor: -2,
      }),
    );
    const mesh = new InstancedMesh(
      this.geometry(new PlaneGeometry(1, 1)),
      material,
      matrices.length,
    );
    matrices.forEach((matrix, i) => mesh.setMatrixAt(i, matrix));
    mesh.name = name;
    return mesh;
  }

  /** Неровное пятно с тёмным ободком (как высохший подтёк) — маска прозрачности. */
  private blotTexture(rng: SeededRandom): Texture {
    const size = 128;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, size, size);
    for (let i = 0; i < 7; i++) {
      const x = size / 2 + rng.float(-18, 18);
      const y = size / 2 + rng.float(-18, 18);
      const r = rng.float(18, 40);
      const gradient = ctx.createRadialGradient(x, y, 0, x, y, r);
      gradient.addColorStop(0, 'rgba(255,255,255,0.35)');
      gradient.addColorStop(0.8, 'rgba(255,255,255,0.55)');
      gradient.addColorStop(0.95, 'rgba(255,255,255,0.9)');
      gradient.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    return this.canvasTexture(canvas);
  }

  /** Потёк: сверху гуще, книзу тает неровными струйками. */
  private streakTexture(rng: SeededRandom): Texture {
    const width = 64;
    const height = 256;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, width, height);
    for (let i = 0; i < 6; i++) {
      const x = rng.float(8, width - 8);
      const w = rng.float(4, 14);
      const length = rng.float(0.4, 1) * height;
      const gradient = ctx.createLinearGradient(0, 0, 0, length);
      gradient.addColorStop(0, 'rgba(255,255,255,0.8)');
      gradient.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = gradient;
      ctx.fillRect(x - w / 2, 0, w, length);
    }
    return this.canvasTexture(canvas);
  }

  private canvasTexture(canvas: HTMLCanvasElement): Texture {
    const texture = new CanvasTexture(canvas);
    texture.colorSpace = SRGBColorSpace;
    this.textures.push(texture);
    return texture;
  }

  /** Мебель: стулья у столов и по предмету в углах офисных комнат и залов. */
  private furniture(
    space: Space,
    floor: SpaceFloor,
    floorIndex: number,
    stairCells: ReadonlySet<string>,
    trimHex: string,
    rng: SeededRandom,
  ): Group {
    const group = new Group();
    group.name = 'furniture';
    const parts = new FurnitureKit(this, trimHex);
    const avoid = this.itemSpots(space, floorIndex);
    const doors = [
      ...floor.doors.map((door) => door.position),
      ...(floorIndex === space.exitFloor ? [space.exit.position] : []),
    ];
    const clear = (point: Vector2, radius: number): boolean =>
      !stairCells.has(space.grid.cellAt(point).join(':')) &&
      avoid.every((spot) => spot.distanceTo(point) >= SpaceDecor.KEEP_FROM_ITEMS + radius) &&
      doors.every((door) => door.distanceTo(point) >= SpaceDecor.KEEP_FROM_DOORS + radius);

    for (const room of floor.rooms) {
      // Стулья — наполовину задвинуты под стол (стол твёрдый, сквозь стул не пройти).
      for (const desk of room.obstacles.filter((obstacle) => obstacle.kind === 'desk')) {
        if (!rng.chance(0.65)) continue;
        const bounds = desk.bounds;
        const alongX = bounds.width >= bounds.height;
        const side = rng.chance(0.5) ? 1 : -1;
        const center = bounds.center;
        const edge = alongX
          ? new Vector2(
              center.x + rng.float(-0.25, 0.25) * bounds.width,
              side > 0 ? bounds.maxY : bounds.minY,
            )
          : new Vector2(
              side > 0 ? bounds.maxX : bounds.minX,
              center.y + rng.float(-0.25, 0.25) * bounds.height,
            );
        if (!clear(edge, 0)) continue;
        // Спинка — со стороны прохода; стул смотрит на стол.
        const facing = alongX ? new Vector2(0, -side) : new Vector2(-side, 0);
        group.add(parts.chair(edge, facing, rng.float(-0.25, 0.25)));
      }
      if (room.kind === 'corridor' || !rng.chance(0.7)) continue;
      const spot = this.cornerSpot(room, rng, clear);
      if (!spot) continue;
      const kind = rng.pick(['cabinet', 'cooler', 'bin', 'plant'] as const);
      group.add(parts.build(kind, spot.position, spot.facing));
    }
    return group;
  }

  /** Свободный угол комнаты (в стороне от проёмов и предметов) и куда смотреть — в комнату. */
  private cornerSpot(
    room: Room,
    rng: SeededRandom,
    clear: (point: Vector2, radius: number) => boolean,
  ): { position: Vector2; facing: Vector2 } | null {
    const inset = this.settings.wallThickness / 2 + 0.32;
    const { minX, minY, maxX, maxY } = room.bounds;
    const corners = [
      { position: new Vector2(minX + inset, minY + inset), facing: new Vector2(0, 1) },
      { position: new Vector2(maxX - inset, minY + inset), facing: new Vector2(0, 1) },
      { position: new Vector2(minX + inset, maxY - inset), facing: new Vector2(0, -1) },
      { position: new Vector2(maxX - inset, maxY - inset), facing: new Vector2(0, -1) },
    ];
    const start = rng.int(0, 3);
    for (let i = 0; i < 4; i++) {
      const corner = corners[(start + i) % 4]!;
      const blocked = room.obstacles.some((obstacle) =>
        obstacle.bounds.expand(0.45).containsPoint(corner.position),
      );
      if (!blocked && clear(corner.position, 0.3)) return corner;
    }
    return null;
  }

  /** Где на этаже лежат предметы и откуда стартуют: мебель их не загораживает. */
  private itemSpots(space: Space, floorIndex: number): Vector2[] {
    const spots: Vector2[] = [];
    space.oilSpawns.forEach((oil, i) => {
      if ((space.oilFloors[i] ?? 0) === floorIndex) spots.push(oil);
    });
    space.keys.forEach((key, i) => {
      if ((space.keyFloors[i] ?? 0) === floorIndex) spots.push(key);
    });
    if (space.note && space.noteFloor === floorIndex) spots.push(space.note);
    space.flags.forEach((flag) => {
      if (flag.floor === floorIndex) spots.push(flag.position);
    });
    if (space.goose && space.goose.floor === floorIndex) spots.push(space.goose.position);
    if (floorIndex === 0) spots.push(...space.startPositions);
    if (floorIndex === space.exitFloor) spots.push(space.exit.frontPoint());
    if (space.sign && floorIndex === 0) spots.push(space.sign.position);
    space.stairs.forEach((stair) => {
      if (stair.lower === floorIndex || stair.lower + 1 === floorIndex) spots.push(stair.position);
    });
    return spots;
  }

  private addMerged(
    group: Group,
    geometries: BufferGeometry[],
    material: Material,
    name: string,
  ): void {
    if (geometries.length === 0) return;
    const merged = mergeGeometries(geometries);
    geometries.forEach((geometry) => geometry.dispose());
    if (!merged) return;
    const mesh = new Mesh(this.geometry(merged), material);
    mesh.name = name;
    group.add(mesh);
  }

  public own<T extends Material>(material: T): T {
    this.materials.push(material);
    return material;
  }

  public geometry<T extends BufferGeometry>(geometry: T): T {
    this.geometries.push(geometry);
    return geometry;
  }
}

/** Простая низкополигональная мебель; общие геометрии и материалы на весь этаж. */
class FurnitureKit {
  private readonly metal: MeshStandardMaterial;
  private readonly fabric: MeshStandardMaterial;
  private readonly wood: MeshStandardMaterial;
  private readonly plastic: MeshStandardMaterial;
  private readonly water: MeshStandardMaterial;
  private readonly leaf: MeshStandardMaterial;

  public constructor(
    private readonly decor: SpaceDecor,
    trimHex: string,
  ) {
    this.metal = decor.own(
      // Без карты окружения металл темнеет — делаем крашеную сталь, почти без металличности.
      new MeshStandardMaterial({ color: '#9a9ea4', metalness: 0.15, roughness: 0.55 }),
    );
    this.fabric = decor.own(new MeshStandardMaterial({ color: '#3d4049', roughness: 0.95 }));
    this.wood = decor.own(new MeshStandardMaterial({ color: trimHex, roughness: 0.7 }));
    this.plastic = decor.own(new MeshStandardMaterial({ color: '#d9d4c6', roughness: 0.6 }));
    this.water = decor.own(
      new MeshStandardMaterial({
        color: '#6fa8d8',
        roughness: 0.15,
        transparent: true,
        opacity: 0.7,
      }),
    );
    this.leaf = decor.own(
      new MeshStandardMaterial({ color: '#4d6b3a', roughness: 0.85, flatShading: true }),
    );
  }

  public build(
    kind: 'cabinet' | 'cooler' | 'bin' | 'plant',
    position: Vector2,
    facing: Vector2,
  ): Group {
    switch (kind) {
      case 'cabinet':
        return this.cabinet(position, facing);
      case 'cooler':
        return this.cooler(position, facing);
      case 'bin':
        return this.bin(position);
      case 'plant':
        return this.plant(position);
    }
  }

  /** Офисный стул: сиденье, спинка, стойка и крестовина. */
  public chair(position: Vector2, facing: Vector2, turn: number): Group {
    const chair = this.placed(position, facing, turn);
    chair.add(
      this.mesh(new BoxGeometry(0.44, 0.07, 0.42), this.fabric, 0, 0.47, 0),
      this.mesh(new BoxGeometry(0.42, 0.45, 0.06), this.fabric, 0, 0.75, 0.21),
      this.mesh(new CylinderGeometry(0.025, 0.025, 0.38, 6), this.metal, 0, 0.25, 0),
      this.mesh(new BoxGeometry(0.5, 0.03, 0.05), this.metal, 0, 0.05, 0),
      this.mesh(new BoxGeometry(0.05, 0.03, 0.5), this.metal, 0, 0.05, 0),
    );
    return chair;
  }

  /** Металлический шкаф для бумаг с ящиками. */
  private cabinet(position: Vector2, facing: Vector2): Group {
    const cabinet = this.placed(position, facing, 0);
    cabinet.add(this.mesh(new BoxGeometry(0.5, 1.3, 0.45), this.metal, 0, 0.65, 0));
    for (let i = 0; i < 4; i++) {
      cabinet.add(
        this.mesh(new BoxGeometry(0.16, 0.025, 0.02), this.plastic, 0, 0.25 + i * 0.3, -0.235),
      );
    }
    return cabinet;
  }

  /** Кулер: белый корпус и синяя бутыль сверху. */
  private cooler(position: Vector2, facing: Vector2): Group {
    const cooler = this.placed(position, facing, 0);
    cooler.add(
      this.mesh(new BoxGeometry(0.32, 0.95, 0.32), this.plastic, 0, 0.475, 0),
      this.mesh(new CylinderGeometry(0.13, 0.13, 0.4, 12), this.water, 0, 1.15, 0),
      this.mesh(new BoxGeometry(0.06, 0.04, 0.04), this.metal, 0, 0.75, -0.17),
    );
    return cooler;
  }

  /** Мусорная корзина. */
  private bin(position: Vector2): Group {
    const bin = this.placed(position, new Vector2(0, 1), 0);
    bin.add(this.mesh(new CylinderGeometry(0.16, 0.12, 0.36, 10, 1, true), this.metal, 0, 0.18, 0));
    return bin;
  }

  /** Цветок в горшке — немного зелени в мёртвом офисе. */
  private plant(position: Vector2): Group {
    const plant = this.placed(position, new Vector2(0, 1), 0);
    plant.add(this.mesh(new CylinderGeometry(0.17, 0.13, 0.32, 10), this.wood, 0, 0.16, 0));
    for (let i = 0; i < 5; i++) {
      const angle = (i / 5) * Math.PI * 2;
      const leaf = this.mesh(
        new ConeGeometry(0.07, 0.55, 4),
        this.leaf,
        Math.cos(angle) * 0.06,
        0.55,
        Math.sin(angle) * 0.06,
      );
      leaf.rotation.set(Math.sin(angle) * 0.35, 0, -Math.cos(angle) * 0.35);
      plant.add(leaf);
    }
    return plant;
  }

  /** Группа предмета в мировой точке; локальная −Z смотрит по `facing`. */
  private placed(position: Vector2, facing: Vector2, turn: number): Group {
    const group = new Group();
    group.position.copy(SceneCoords.toScene(position));
    // В сцене z = −y: «вперёд» (−Z) должен совпасть с facing.
    group.rotation.y = Math.atan2(-facing.x, facing.y) + turn;
    return group;
  }

  private mesh(
    geometry: BufferGeometry,
    material: Material,
    x: number,
    y: number,
    z: number,
  ): Mesh {
    const mesh = new Mesh(this.decor.geometry(geometry), material);
    mesh.position.set(x, y, z);
    return mesh;
  }
}
