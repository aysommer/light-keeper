import { ChunkGenerator, CollisionWorld, PlayerMovement, WorldLayout } from '@light-keeper/shared';
import type { MatchPlayerInfo, PlayerColor } from '@light-keeper/shared';
import { GameLoop } from '../core/GameLoop.ts';
import { FirstPersonController } from '../game/FirstPersonController.ts';
import { LocalPlayer } from '../game/LocalPlayer.ts';
import { NetworkSession } from '../game/NetworkSession.ts';
import { InputController } from '../input/InputController.ts';
import type { NetworkClient } from '../network/NetworkClient.ts';
import { ChunkMeshBuilder } from '../scene/ChunkMeshBuilder.ts';
import { HandLampLight } from '../scene/HandLampLight.ts';
import { MaterialLibrary } from '../scene/MaterialLibrary.ts';
import { SceneManager } from '../scene/SceneManager.ts';
import { WorldRenderer } from '../scene/WorldRenderer.ts';
import { Hud } from './Hud.ts';
import type { Screen } from './Screen.ts';

/** Данные сетевой партии. */
export interface MatchConnection {
  readonly network: NetworkClient;
  readonly playerId: string;
  readonly color: PlayerColor;
  readonly players: readonly MatchPlayerInfo[];
}

export interface GameScreenOptions {
  readonly seed: number;
  /** Сетевая партия; `null` — одиночная прогулка. */
  readonly match: MatchConnection | null;
  readonly onExit: () => void;
}

/** Игровой экран: мир, игрок от первого лица и (в сетевой игре) напарник. */
export class GameScreen implements Screen {
  public readonly element: HTMLElement;
  private readonly hud: Hud;
  private readonly disposables: Array<{ dispose(): void }> = [];
  private loop: GameLoop | null = null;

  public constructor(private readonly options: GameScreenOptions) {
    this.element = document.createElement('div');
    this.element.className = 'game-screen';
    this.hud = new Hud(options.seed, options.match?.color ?? null, options.onExit);
  }

  public mount(): void {
    const { seed, match } = this.options;
    const sceneManager = this.own(new SceneManager(this.element));
    this.element.append(this.hud.element);

    const generator = new ChunkGenerator(seed);
    const world = new WorldLayout(generator, 12);
    const movement = new PlayerMovement(new CollisionWorld(world));
    const materials = this.own(new MaterialLibrary());
    const worldRenderer = this.own(
      new WorldRenderer(sceneManager.scene, world, new ChunkMeshBuilder(materials, seed)),
    );
    const input = this.own(new InputController(sceneManager.canvas));
    const [redStart, blueStart] = generator.startPositions();
    const player = new LocalPlayer(match?.color === 'blue' ? blueStart : redStart);
    const controller = new FirstPersonController(player, input, movement);
    const lamp = this.own(new HandLampLight(sceneManager.camera));
    const session = match
      ? this.own(
          new NetworkSession(
            match.network,
            match.playerId,
            match.players,
            player,
            controller,
            movement,
            sceneManager.scene,
          ),
        )
      : null;

    input.onPointerLockChange((locked) => this.hud.setPointerLocked(locked));
    this.hud.setPointerLocked(false);

    this.loop = new GameLoop((delta, time) => {
      controller.update(delta);
      session?.update(delta, time);
      controller.applyToCamera(sceneManager.camera);
      worldRenderer.update(player.position.y);
      materials.update(time);
      lamp.update(time);
      this.hud.setDistance(session ? session.distance : player.distance);
      if (session) {
        this.hud.setNetworkInfo(session.pingMs, session.partnerDistance());
      }
      sceneManager.render();
    });
    this.loop.start();
  }

  public dispose(): void {
    this.loop?.stop();
    // Освобождаем в обратном порядке создания: сцена — последней.
    this.disposables.reverse().forEach((item) => item.dispose());
    this.disposables.length = 0;
  }

  private own<T extends { dispose(): void }>(item: T): T {
    this.disposables.push(item);
    return item;
  }
}
