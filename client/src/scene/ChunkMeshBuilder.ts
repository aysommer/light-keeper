import { Group, InstancedMesh, Matrix4, Mesh, PlaneGeometry } from 'three';
import type { BufferGeometry } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { GameConfig, SeedHasher } from '@light-keeper/shared';
import type { Chunk, WorldSettings } from '@light-keeper/shared';
import { BoxGeometryFactory } from './BoxGeometryFactory.ts';
import { MaterialLibrary } from './MaterialLibrary.ts';
import type { PanelState } from './MaterialLibrary.ts';
import { SceneCoords } from './SceneCoords.ts';
import { ChunkView } from './ChunkView.ts';

/** Собирает меши чанка: пол, потолок, стены, колонны, столы и потолочные лампы. */
export class ChunkMeshBuilder {
  private static readonly DESK_HEIGHT = 0.75;
  private static readonly PANEL_WIDTH = 1.2;
  private static readonly PANEL_DEPTH = 0.6;

  private readonly wallBoxes = new BoxGeometryFactory(MaterialLibrary.WALL_TILE_METERS);

  public constructor(
    private readonly materials: MaterialLibrary,
    private readonly seed: number,
    private readonly settings: WorldSettings = GameConfig.world,
  ) {}

  public build(chunk: Chunk): ChunkView {
    const group = new Group();
    group.name = `chunk-${chunk.index}`;
    group.add(this.buildFloor(chunk), this.buildCeiling(chunk));

    const walls = this.buildWalls(chunk);
    if (walls) group.add(walls);
    const desks = this.buildDesks(chunk);
    if (desks) group.add(desks);
    group.add(...this.buildPanels(chunk));

    return new ChunkView(chunk.index, group);
  }

  private buildFloor(chunk: Chunk): Mesh {
    const geometry = this.surface(chunk, MaterialLibrary.FLOOR_TILE_METERS);
    geometry.rotateX(-Math.PI / 2);
    this.placeSurface(geometry, chunk, 0);
    const mesh = new Mesh(geometry, this.materials.floor);
    mesh.name = 'floor';
    return mesh;
  }

  private buildCeiling(chunk: Chunk): Mesh {
    const geometry = this.surface(chunk, MaterialLibrary.CEILING_TILE_METERS);
    geometry.rotateX(Math.PI / 2);
    this.placeSurface(geometry, chunk, this.settings.ceilingHeight);
    const mesh = new Mesh(geometry, this.materials.ceiling);
    mesh.name = 'ceiling';
    return mesh;
  }

  /** Стены и колонны — одна объединённая геометрия на чанк (один draw call). */
  private buildWalls(chunk: Chunk): Mesh | null {
    const height = this.settings.ceilingHeight;
    const geometries = [
      ...chunk.walls.map((wall) => this.wallBoxes.create(wall.bounds, 0, height)),
      ...chunk.obstacles
        .filter((obstacle) => obstacle.kind === 'pillar')
        .map((pillar) => this.wallBoxes.create(pillar.bounds, 0, height)),
    ];
    return this.merged(geometries, this.materials.wall, 'walls');
  }

  private buildDesks(chunk: Chunk): Mesh | null {
    const geometries = chunk.obstacles
      .filter((obstacle) => obstacle.kind === 'desk')
      .map((desk) => this.wallBoxes.create(desk.bounds, 0, ChunkMeshBuilder.DESK_HEIGHT));
    return this.merged(geometries, this.materials.desk, 'desks');
  }

  /** Панели дневного света в центре каждой клетки; состояние детерминировано seed. */
  private buildPanels(chunk: Chunk): InstancedMesh[] {
    const byState: Record<PanelState, Matrix4[]> = { on: [], off: [], flicker: [] };
    const height = this.settings.ceilingHeight - 0.01;
    const size = this.settings.cellSize;

    for (let row = 0; row < this.settings.rowsPerChunk; row++) {
      for (let col = 0; col < this.settings.columns; col++) {
        const roll = SeedHasher.hash(this.seed, 'panel', chunk.index, col, row) / 2 ** 32;
        const state: PanelState = roll < 0.6 ? 'off' : roll < 0.85 ? 'flicker' : 'on';
        const x = (col + 0.5) * size;
        const z = SceneCoords.sceneZ(chunk.bounds.minY + (row + 0.5) * size);
        byState[state].push(new Matrix4().makeTranslation(x, height, z));
      }
    }

    const geometry = new PlaneGeometry(ChunkMeshBuilder.PANEL_WIDTH, ChunkMeshBuilder.PANEL_DEPTH);
    geometry.rotateX(Math.PI / 2);
    return (Object.keys(byState) as PanelState[])
      .filter((state) => byState[state].length > 0)
      .map((state) => {
        const matrices = byState[state];
        const mesh = new InstancedMesh(
          geometry.clone(),
          this.materials.panel(state),
          matrices.length,
        );
        matrices.forEach((matrix, i) => mesh.setMatrixAt(i, matrix));
        mesh.name = `panels-${state}`;
        return mesh;
      });
  }

  private surface(chunk: Chunk, metersPerTile: number): PlaneGeometry {
    const width = chunk.bounds.width;
    const length = chunk.bounds.height;
    const geometry = new PlaneGeometry(width, length);
    const uv = geometry.getAttribute('uv');
    for (let i = 0; i < uv.count; i++) {
      uv.setXY(i, (uv.getX(i) * width) / metersPerTile, (uv.getY(i) * length) / metersPerTile);
    }
    return geometry;
  }

  private placeSurface(geometry: BufferGeometry, chunk: Chunk, height: number): void {
    const center = chunk.bounds.center;
    geometry.translate(center.x, height, SceneCoords.sceneZ(center.y));
  }

  private merged(
    geometries: BufferGeometry[],
    material: MaterialLibrary['wall'],
    name: string,
  ): Mesh | null {
    if (geometries.length === 0) {
      return null;
    }
    const geometry = mergeGeometries(geometries);
    geometries.forEach((part) => part.dispose());
    if (!geometry) {
      throw new Error(`Не удалось объединить геометрию «${name}»`);
    }
    const mesh = new Mesh(geometry, material);
    mesh.name = name;
    return mesh;
  }
}
