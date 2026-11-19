import { PlayerMovement, Vector2 } from '@light-keeper/shared';
import type { MatchPlayerInfo, PlayerColor } from '@light-keeper/shared';
import { GameLoop } from '../core/GameLoop.ts';
import { ActiveSpace } from '../game/ActiveSpace.ts';
import { FirstPersonController } from '../game/FirstPersonController.ts';
import { InteractionPrompt } from '../game/InteractionPrompt.ts';
import { LocalPlayer } from '../game/LocalPlayer.ts';
import { NetworkSession } from '../game/NetworkSession.ts';
import { InputController } from '../input/InputController.ts';
import type { NetworkClient } from '../network/NetworkClient.ts';
import { HandLampLight } from '../scene/HandLampLight.ts';
import { SceneManager } from '../scene/SceneManager.ts';
import { ExitHud } from './ExitHud.ts';
import { Hud } from './Hud.ts';
import type { Screen } from './Screen.ts';
import { TambourOverlay } from './TambourOverlay.ts';
import { TransitionOverlay } from './TransitionOverlay.ts';

export interface GameScreenOptions {
  readonly seed: number;
  readonly network: NetworkClient;
  readonly playerId: string;
  readonly color: PlayerColor;
  readonly players: readonly MatchPlayerInfo[];
  readonly onExit: () => void;
}

/** Игровой экран партии: пространство, игрок от первого лица, напарник, переходы. */
export class GameScreen implements Screen {
  /** Сколько держать надпись «Пространство N» после входа, с. */
  private static readonly TITLE_HOLD_SECONDS = 1.2;

  public readonly element: HTMLElement;
  private readonly hud: Hud;
  private readonly overlay = new TransitionOverlay();
  private readonly exitHud = new ExitHud();
  private readonly tambour = new TambourOverlay();
  private readonly prompt = new InteractionPrompt();
  private readonly disposables: Array<{ dispose(): void }> = [];
  private loop: GameLoop | null = null;

  public constructor(private readonly options: GameScreenOptions) {
    this.element = document.createElement('div');
    this.element.className = 'game-screen';
    this.hud = new Hud(options.seed, options.color, options.onExit);
  }

  public mount(): void {
    const options = this.options;
    const sceneManager = this.own(new SceneManager(this.element));
    // Затемнение — поверх HUD, чтобы подсказки не перекрывали надпись.
    this.element.append(
      this.hud.element,
      this.exitHud.element,
      this.tambour.element,
      this.overlay.element,
    );

    const space = this.own(new ActiveSpace(options.seed, sceneManager.scene));
    const input = this.own(new InputController(sceneManager.canvas));
    const [redStart, blueStart] = space.space.startPositions;
    const player = new LocalPlayer(options.color === 'blue' ? blueStart : redStart);
    player.yaw = space.space.startYaw;
    const controller = new FirstPersonController(player, input, space);
    const lamp = this.own(new HandLampLight(sceneManager.camera));
    const session = this.own(
      new NetworkSession(
        options.network,
        options.playerId,
        options.players,
        player,
        controller,
        space,
        sceneManager.scene,
      ),
    );

    input.onPointerLockChange((locked) => this.hud.setPointerLocked(locked));
    this.hud.setPointerLocked(false);

    // Затемнение: во время перехода и ещё немного после входа в пространство.
    let shownSpace = space.spaceIndex;
    let titleUntil = GameScreen.TITLE_HOLD_SECONDS;
    this.overlay.showEntering(shownSpace + 1);

    this.loop = new GameLoop((delta, time) => {
      if (import.meta.env.DEV) {
        this.handleDebugKeys(input, session, player, space);
      }
      if (space.spaceIndex !== shownSpace) {
        shownSpace = space.spaceIndex;
        titleUntil = time + GameScreen.TITLE_HOLD_SECONDS;
        this.overlay.showEntering(shownSpace + 1);
      }
      const inTransition = session.phase === 'transition';
      if (inTransition) {
        this.overlay.showEntering(shownSpace + 2);
      } else if (time >= titleUntil) {
        this.overlay.hide();
      }
      controller.frozen = inTransition || session.inTambour;

      controller.update(delta);
      session.update(delta, time);
      controller.applyToCamera(sceneManager.camera);
      space.update(session.exit, delta, time);
      const exit = session.exit;
      this.exitHud.update(
        exit,
        options.playerId,
        this.prompt.resolve(
          space.space,
          exit,
          options.playerId,
          player.position,
          session.inTambour,
        ),
      );
      this.tambour.update(session.inTambour && !inTransition, exit?.secondsLeft ?? null);
      lamp.update(time);
      this.hud.setSpace(space.spaceIndex);
      this.hud.setNetworkInfo(session.pingMs, session.partnerDistance());
      sceneManager.render();
    });
    this.loop.start();
  }

  /** Клавиши отладки (только `npm run dev`): N — дальше, T — к двери, K — к ключу (в шаге от него). */
  private handleDebugKeys(
    input: InputController,
    session: NetworkSession,
    player: LocalPlayer,
    space: ActiveSpace,
  ): void {
    if (input.consumePress('KeyN')) {
      session.requestNextSpace();
    }
    if (input.consumePress('KeyT')) {
      session.requestGoto('exit');
      // Повернуться лицом к двери (взгляд управляется клиентом).
      player.yaw = PlayerMovement.yawTowards(space.space.exit.normal.scale(-1));
      player.pitch = 0;
    }
    if (input.consumePress('KeyK')) {
      session.requestGoto('key');
      // Сервер ставит в шаге правее ключа — смотрим налево, на ключ.
      player.yaw = PlayerMovement.yawTowards(new Vector2(-1, 0));
      player.pitch = 0;
    }
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
