import { ChunkGenerator, CollisionWorld, WorldLayout } from '@light-keeper/shared';
import type { PlayerColor } from '@light-keeper/shared';
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

export interface GameScreenOptions {
  readonly seed: number;
  /** Цвет игрока в сетевой партии; `null` — одиночная прогулка. */
  readonly color: PlayerColor | null;
  readonly onExit: () => void;
}

/**
 * Игровой экран: рендер, ходьба, коллизии. Синхронизация с напарником — этап 4;
 * пока каждый игрок идёт по своей копии мира с общим seed.
 */
export class GameScreen implements Screen {
  public readonly element: HTMLElement;
  private sceneManager: SceneManager | null = null;
  private input: InputController | null = null;
  private materials: MaterialLibrary | null = null;
  private worldRenderer: WorldRenderer | null = null;
  private lamp: HandLampLight | null = null;
  private loop: GameLoop | null = null;
  private readonly hud: Hud;

  private readonly seed: number;
  private readonly color: PlayerColor | null;

  public constructor(options: GameScreenOptions) {
    this.seed = options.seed;
    this.color = options.color;
    this.element = document.createElement('div');
    this.element.className = 'game-screen';
    this.hud = new Hud(options.seed, options.color, options.onExit);
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
    const [redStart, blueStart] = generator.startPositions();
    const player = new LocalPlayer(this.color === 'blue' ? blueStart : redStart);
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
