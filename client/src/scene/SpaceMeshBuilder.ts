import { Group, InstancedMesh, Matrix4, Mesh, PlaneGeometry } from 'three';
import type { BufferGeometry, Material } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { GameConfig, SeedHasher } from '@light-keeper/shared';
import type { Space, WorldSettings } from '@light-keeper/shared';
import { BoxGeometryFactory } from './BoxGeometryFactory.ts';
import { MaterialLibrary } from './MaterialLibrary.ts';
import type { PanelState, SpaceDetail } from './MaterialLibrary.ts';
import { SceneCoords } from './SceneCoords.ts';
import { SpaceView } from './SpaceView.ts';

/** Собирает меши пространства целиком: пол, потолок, стены, мебель, лампы, шпалеру. */
export class SpaceMeshBuilder {
  private static readonly DESK_HEIGHT = 0.75;
  private static readonly PANEL_WIDTH = 1.2;
  private static readonly PANEL_DEPTH = 0.6;
  /** Шпалера (отделочная полоса) на однотонных обоях: высота низа и верха, м. */
  private static readonly RAIL_BOTTOM = 0.86;
  private static readonly RAIL_TOP = 0.94;
  private static readonly RAIL_DEPTH = 0.015;

  private readonly boxes = new BoxGeometryFactory(MaterialLibrary.WALL_TILE_METERS);

  public constructor(private readonly settings: WorldSettings = GameConfig.world) {}

  /**
   * @param floorIndex какой этаж строить; группа этажа поднята на его высоту
   */
  public build(
    space: Space,
    detail: SpaceDetail = MaterialLibrary.NO_DETAIL,
    floorIndex = 0,
  ): SpaceView {
    const floor = space.floor(floorIndex);
    const materials = new MaterialLibrary(space.palette, detail);
    const group = new Group();
    group.name = `space-${space.index}-floor-${floorIndex}`;
    group.position.y = SceneCoords.floorY(floorIndex);
    group.add(this.buildFloor(space, materials), this.buildCeiling(space, materials));

    const height = this.settings.ceilingHeight;
    const wallBoxes = [
      ...floor.walls.map((wall) => this.boxes.create(wall.bounds, 0, height)),
      ...floor.obstacles
        .filter((obstacle) => obstacle.kind === 'pillar')
        .map((pillar) => this.boxes.create(pillar.bounds, 0, height)),
    ];
    this.addMerged(group, wallBoxes, materials.wall, 'walls');
    this.addMerged(
      group,
      floor.obstacles
        .filter((obstacle) => obstacle.kind === 'desk')
        .map((desk) => this.boxes.create(desk.bounds, 0, SpaceMeshBuilder.DESK_HEIGHT)),
      materials.desk,
      'desks',
    );
    if (space.palette.pattern === 'plain') {
      this.addMerged(
        group,
        floor.walls.map((wall) =>
          this.boxes.create(
            wall.bounds.expand(SpaceMeshBuilder.RAIL_DEPTH),
            SpaceMeshBuilder.RAIL_BOTTOM,
            SpaceMeshBuilder.RAIL_TOP,
          ),
        ),
        materials.trim,
        'rail',
      );
    }
    group.add(...this.buildPanels(space, materials, floorIndex));
    return new SpaceView(space.index, group, materials);
  }

  private buildFloor(space: Space, materials: MaterialLibrary): Mesh {
    const geometry = this.surface(space, MaterialLibrary.FLOOR_TILE_METERS);
    geometry.rotateX(-Math.PI / 2);
    this.placeSurface(geometry, space, 0);
    const mesh = new Mesh(geometry, materials.floor);
    mesh.name = 'floor';
    return mesh;
  }

  private buildCeiling(space: Space, materials: MaterialLibrary): Mesh {
    const geometry = this.surface(space, MaterialLibrary.CEILING_TILE_METERS);
    geometry.rotateX(Math.PI / 2);
    this.placeSurface(geometry, space, this.settings.ceilingHeight);
    const mesh = new Mesh(geometry, materials.ceiling);
    mesh.name = 'ceiling';
    return mesh;
  }

  /** Панели дневного света в центре каждой клетки; состояние детерминировано seed пространства. */
  private buildPanels(
    space: Space,
    materials: MaterialLibrary,
    floorIndex: number,
  ): InstancedMesh[] {
    const byState: Record<PanelState, Matrix4[]> = { on: [], off: [], flicker: [] };
    const height = this.settings.ceilingHeight - 0.01;
    // Подсказка обычной двери: лампа над ней всегда мерцает.
    const doorFront = space.exit.frontPoint();
    const hintCol = Math.floor(doorFront.x / space.grid.cellSize);
    const hintRow = Math.floor(doorFront.y / space.grid.cellSize);
    for (let row = 0; row < space.grid.rows; row++) {
      for (let col = 0; col < space.grid.columns; col++) {
        const roll = SeedHasher.hash(space.seed, 'panel', floorIndex, col, row) / 2 ** 32;
        const isHint =
          space.exit.kind === 'plain' &&
          floorIndex === space.exitFloor &&
          col === hintCol &&
          row === hintRow;
        const state: PanelState = isHint
          ? 'flicker'
          : roll < 0.6
            ? 'off'
            : roll < 0.85
              ? 'flicker'
              : 'on';
        const center = space.grid.cellCenter(col, row);
        byState[state].push(
          new Matrix4().makeTranslation(center.x, height, SceneCoords.sceneZ(center.y)),
        );
      }
    }
    const geometry = new PlaneGeometry(SpaceMeshBuilder.PANEL_WIDTH, SpaceMeshBuilder.PANEL_DEPTH);
    geometry.rotateX(Math.PI / 2);
    const meshes = (Object.keys(byState) as PanelState[])
      .filter((state) => byState[state].length > 0)
      .map((state) => {
        const matrices = byState[state];
        const mesh = new InstancedMesh(geometry.clone(), materials.panel(state), matrices.length);
        matrices.forEach((matrix, i) => mesh.setMatrixAt(i, matrix));
        mesh.name = `panels-${state}`;
        return mesh;
      });
    geometry.dispose();
    return meshes;
  }

  private surface(space: Space, metersPerTile: number): PlaneGeometry {
    const width = space.bounds.width;
    const length = space.bounds.height;
    const geometry = new PlaneGeometry(width, length);
    const uv = geometry.getAttribute('uv');
    for (let i = 0; i < uv.count; i++) {
      uv.setXY(i, (uv.getX(i) * width) / metersPerTile, (uv.getY(i) * length) / metersPerTile);
    }
    return geometry;
  }

  private placeSurface(geometry: BufferGeometry, space: Space, height: number): void {
    const center = space.bounds.center;
    geometry.translate(center.x, height, SceneCoords.sceneZ(center.y));
  }

  private addMerged(
    group: Group,
    geometries: BufferGeometry[],
    material: Material,
    name: string,
  ): void {
    if (geometries.length === 0) {
      return;
    }
    const geometry = mergeGeometries(geometries);
    geometries.forEach((part) => part.dispose());
    if (!geometry) {
      throw new Error(`Не удалось объединить геометрию «${name}»`);
    }
    const mesh = new Mesh(geometry, material);
    mesh.name = name;
    group.add(mesh);
  }
}
