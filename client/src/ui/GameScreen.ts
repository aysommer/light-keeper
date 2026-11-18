import { ChunkGenerator, CollisionWorld, WorldLayout } from '@light-keeper/shared';
import { GameLoop } from '../core/GameLoop.ts';
import { FirstPersonController } from '../game/FirstPersonController.ts';
import { LocalPlayer } from '../game/LocalPlayer.ts';
import { InputController } from '../input/InputController.ts';
import { ChunkMeshBuilder } from '../scene/ChunkMeshBuilder.ts';
import { HandLampLight } from '../scene/HandLampLight.ts';
import { MaterialLibrary } from '../scene/MaterialLibrary.ts';
import { SceneManager } from '../scene/SceneManager.ts';
import { WorldRenderer } from '../scene/WorldRenderer.ts';
import { Hud } from './Hud.ts';
import type { Screen } from './Screen.ts';

/** Одиночная прогулка по миру (этап 2): рендер, ходьба, коллизии. */
export class GameScreen implements Screen {
  public readonly element: HTMLElement;
  private sceneManager: SceneManager | null = null;
  private input: InputController | null = null;
  private materials: MaterialLibrary | null = null;
  private worldRenderer: WorldRenderer | null = null;
  private lamp: HandLampLight | null = null;
  private loop: GameLoop | null = null;
  private readonly hud: Hud;

  public constructor(
    private readonly seed: number,
    onExit: () => void,
  ) {
    this.element = document.createElement('div');
    this.element.className = 'game-screen';
    this.hud = new Hud(seed, onExit);
  }

  public mount(): void {
    const sceneManager = new SceneManager(this.element);
    this.element.append(this.hud.element);

    const generator = new ChunkGenerator(this.seed);
    const world = new WorldLayout(generator, 12);
    const collisions = new CollisionWorld(world);
    const materials = new MaterialLibrary();
    const worldRenderer = new WorldRenderer(
      sceneManager.scene,
      world,
      new ChunkMeshBuilder(materials, this.seed),
    );
    const input = new InputController(sceneManager.canvas);
    const player = new LocalPlayer(generator.startPositions()[0]);
    const controller = new FirstPersonController(player, input, collisions);
    const lamp = new HandLampLight(sceneManager.camera);

    input.onPointerLockChange((locked) => this.hud.setPointerLocked(locked));
    this.hud.setPointerLocked(false);

    this.loop = new GameLoop((delta, time) => {
      controller.update(delta);
      controller.applyToCamera(sceneManager.camera);
      worldRenderer.update(player.position.y);
      materials.update(time);
      lamp.update(time);
      this.hud.setDistance(player.distance);
      sceneManager.render();
    });
    this.loop.start();

    this.sceneManager = sceneManager;
    this.input = input;
    this.materials = materials;
    this.worldRenderer = worldRenderer;
    this.lamp = lamp;
  }

  public dispose(): void {
    this.loop?.stop();
    this.input?.dispose();
    this.lamp?.dispose();
    this.worldRenderer?.dispose();
    this.materials?.dispose();
    this.sceneManager?.dispose();
  }
}
