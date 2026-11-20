import { PlayerMovement, Vector2 } from '@light-keeper/shared';
import type { MatchPlayerInfo, PlayerColor } from '@light-keeper/shared';
import { AudioEngine } from '../audio/AudioEngine.ts';
import { SoundDirector } from '../audio/SoundDirector.ts';
import { GameLoop } from '../core/GameLoop.ts';
import type { GraphicsOptions, GraphicsSettings } from '../core/GraphicsSettings.ts';
import { ActiveSpace } from '../game/ActiveSpace.ts';
import { FirstPersonController } from '../game/FirstPersonController.ts';
import { HeldItems } from '../game/HeldItems.ts';
import { CanisterHint } from '../game/CanisterHint.ts';
import { ExchangePrompt } from '../game/ExchangePrompt.ts';
import { HandOverMotion } from '../game/HandOverMotion.ts';
import { InteractionPrompt } from '../game/InteractionPrompt.ts';
import { LampHint } from '../game/LampHint.ts';
import { LocalPlayer } from '../game/LocalPlayer.ts';
import { NetworkSession } from '../game/NetworkSession.ts';
import { PartnerBearing } from '../game/PartnerBearing.ts';
import { ScareLevel } from '../game/ScareLevel.ts';
import { InputController } from '../input/InputController.ts';
import type { NetworkClient } from '../network/NetworkClient.ts';
import { FirstPersonViewmodel } from '../scene/FirstPersonViewmodel.ts';
import { HandLampLight } from '../scene/HandLampLight.ts';
import { SceneManager } from '../scene/SceneManager.ts';
import { CompassView } from './CompassView.ts';
import { ExitHud } from './ExitHud.ts';
import { Hud } from './Hud.ts';
import { ScareOverlay } from './ScareOverlay.ts';
import { SettingsPanel } from './SettingsPanel.ts';
import { LampHud } from './LampHud.ts';
import type { Screen } from './Screen.ts';
import { TambourOverlay } from './TambourOverlay.ts';
import { TransitionOverlay } from './TransitionOverlay.ts';

export interface GameScreenOptions {
  readonly seed: number;
  readonly network: NetworkClient;
  readonly playerId: string;
  readonly color: PlayerColor;
  readonly players: readonly MatchPlayerInfo[];
  readonly graphics: GraphicsSettings;
  readonly onExit: () => void;
}

/** Игровой экран партии: пространство, игрок от первого лица, напарник, переходы. */
export class GameScreen implements Screen {
  /** Сколько держать надпись «Пространство N» после входа, с. */
  private static readonly TITLE_HOLD_SECONDS = 1.2;

  public readonly element: HTMLElement;
  private readonly hud: Hud;
  private readonly settings: SettingsPanel;
  private readonly overlay = new TransitionOverlay();
  private readonly exitHud = new ExitHud();
  private readonly compass = new CompassView();
  private readonly lampHud = new LampHud();
  private readonly scare = new ScareLevel();
  private readonly scareOverlay = new ScareOverlay();
  private readonly lampHint = new LampHint();
  private readonly canisterHint = new CanisterHint();
  private readonly held = new HeldItems();
  private readonly tambour = new TambourOverlay();
  private readonly prompt = new InteractionPrompt();
  private readonly exchangePrompt = new ExchangePrompt();
  private readonly handOver = new HandOverMotion();
  private readonly disposables: Array<{ dispose(): void }> = [];
  private loop: GameLoop | null = null;

  public constructor(private readonly options: GameScreenOptions) {
    this.element = document.createElement('div');
    this.element.className = 'game-screen';
    this.settings = new SettingsPanel(options.graphics);
    this.hud = new Hud(options.onExit, () => this.settings.show());
  }

  public mount(): void {
    const options = this.options;
    const sceneManager = this.own(new SceneManager(this.element));
    this.own(this.settings);
    // Затемнение — поверх HUD, чтобы подсказки не перекрывали надпись.
    this.element.append(
      this.scareOverlay.element,
      this.lampHud.element,
      this.hud.element,
      this.exitHud.element,
      this.compass.element,
      this.tambour.element,
      this.overlay.element,
      this.settings.element,
    );

    const space = this.own(
      new ActiveSpace(options.seed, sceneManager.scene, options.graphics.options),
    );
    // Настройки графики применяются сразу, без перезагрузки; сети они не касаются.
    const applyGraphics = (graphics: GraphicsOptions): void => {
      sceneManager.setAntialias(graphics.antialias);
      sceneManager.setBloom(graphics.bloom);
      sceneManager.setDust(graphics.dust);
      sceneManager.setGroundShadows(graphics.groundShadows);
      space.setDetail(graphics);
    };
    applyGraphics(options.graphics.options);
    const unsubscribeGraphics = options.graphics.onChange(applyGraphics);
    this.own({ dispose: unsubscribeGraphics });
    const input = this.own(new InputController(sceneManager.canvas));
    const [redStart, blueStart] = space.space.startPositions;
    const player = new LocalPlayer(options.color === 'blue' ? blueStart : redStart);
    player.yaw = space.space.startYaw;
    const controller = new FirstPersonController(player, input, space);
    const lamp = this.own(new HandLampLight(sceneManager.camera));
    const viewmodel = this.own(
      new FirstPersonViewmodel(sceneManager.viewmodelScene, options.color),
    );
    let previousYaw = player.yaw;
    let previousPitch = player.pitch;
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

    // Звук разрешается только после действия пользователя — первый клик или клавиша.
    const audio = this.own(new AudioEngine());
    const sound = this.own(new SoundDirector(audio));
    const unlockAudio = (): void => audio.unlock();
    this.element.addEventListener('pointerdown', unlockAudio);
    window.addEventListener('keydown', unlockAudio);
    this.own({
      dispose: () => {
        this.element.removeEventListener('pointerdown', unlockAudio);
        window.removeEventListener('keydown', unlockAudio);
      },
    });
    this.hud.setMuted(audio.muted);

    input.onPointerLockChange((locked) => {
      this.hud.setPointerLocked(locked);
      if (locked) this.settings.hide();
    });
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

      // Предмет в руке: 1 — лампа, 2 — компас. Уходит на сервер вместе с командой.
      for (const code of HeldItems.keyCodes) {
        if (input.consumePress(code)) this.held.selectByKey(code);
      }
      controller.item = this.held.current;
      controller.update(delta);
      session.update(delta, time);
      controller.applyToCamera(sceneManager.camera);
      space.update(session.exit, session.oilTaken, session.oilDropped, delta, time);
      const exit = session.exit;
      const partnerPosition = session.partnerPosition();
      // Смотришь на напарника рядом — подсказка об обмене важнее подсказки двери.
      const exchangeHint = this.exchangePrompt.resolve(
        session.exchange,
        options.playerId,
        player.position,
        player.yaw,
        partnerPosition ? { position: partnerPosition } : null,
        space.collisions,
        session.inTambour,
      );
      this.exitHud.update(
        exit,
        options.playerId,
        exchangeHint ??
          this.prompt.resolve(
            space.space,
            exit,
            options.playerId,
            player.position,
            session.inTambour,
          ),
      );
      this.tambour.update(session.inTambour && !inTransition, exit?.secondsLeft ?? null);
      // Рука с фонарём от первого лица; лампа светит в мир, только пока фонарь поднят.
      const yawDelta = Math.atan2(
        Math.sin(player.yaw - previousYaw),
        Math.cos(player.yaw - previousYaw),
      );
      viewmodel.update(delta, time, {
        bobPhase: controller.bobPhase,
        moving: player.isMoving,
        running: controller.isRunning,
        yawDelta,
        pitchDelta: player.pitch - previousPitch,
        wanted: this.held.current,
        lamp: session.ownLamp,
        reach: this.handOver.update(delta, session.exchange?.count ?? null),
        refueling: session.ownRefuelProgress > 0,
      });
      previousYaw = player.yaw;
      previousPitch = player.pitch;
      lamp.setLevel(viewmodel.lightLevel);
      // Испуг: привидение рядом — тёмная виньетка и дрожь камеры.
      const scare = session.inTambour
        ? 0
        : this.scare.update(
            delta,
            session.ghosts.nearestThreat(player.position),
            viewmodel.lightLevel,
          );
      this.scareOverlay.update(scare);
      if (scare > 0.01) {
        sceneManager.camera.position.x += (Math.random() - 0.5) * 0.03 * scare;
        sceneManager.camera.position.y += (Math.random() - 0.5) * 0.03 * scare;
        sceneManager.camera.rotation.z += (Math.random() - 0.5) * 0.02 * scare;
      }
      const ownLamp = session.ownLamp;
      this.lampHud.update(
        session.inTambour ? 0 : (ownLamp?.heat ?? 0),
        this.lampHint.resolve(ownLamp, this.held.current, session.inTambour, {
          canisters: session.ownCanisters,
          refueling: session.ownRefuelProgress > 0,
        }) ??
          (session.inTambour
            ? null
            : this.canisterHint.resolve(
                space.space,
                session.oilTaken,
                session.oilDropped,
                player.position,
              )),
      );
      this.lampHud.updateOil(
        session.inTambour ? 0 : session.ownCanisters,
        session.ownRefuelProgress,
      );
      const compassInHand = this.held.current === 'compass' && !session.inTambour;
      this.compass.update(
        compassInHand,
        partnerPosition
          ? PartnerBearing.clockwiseFromForward(player.position, player.yaw, partnerPosition)
          : null,
      );
      if (input.consumePress('KeyM')) {
        this.hud.setMuted(audio.toggleMute());
      }
      const ownLampState = session.ownLamp;
      sound.update(delta, {
        camera: sceneManager.camera,
        spaceIndex: space.spaceIndex,
        phase: session.phase,
        inTambour: session.inTambour,
        exitOpen: session.exit?.open ?? false,
        keyHolderId: session.exit?.keyHolderId ?? null,
        canisters: session.ownCanisters,
        overheated: ownLampState?.overheated ?? false,
        exchangeCount: session.exchange?.count ?? 0,
        bobPhase: controller.bobPhase,
        moving: player.isMoving,
        running: controller.isRunning,
        lampLevel: viewmodel.lightLevel,
        lampHeat: ownLampState?.heat ?? 0,
        refueling: session.ownRefuelProgress > 0,
        scare,
        door: space.space.exit.position,
        partner: session.partnerMotion(),
        ghosts: session.ghosts.list(),
      });
      sceneManager.render(time, scare, viewmodel.lightLevel);
    });
    this.loop.start();
  }

  /**
   * Клавиши отладки (только `npm run dev`): N — следующее пространство, T — к двери,
   * K — к ключу (в шаге от него), O — к ближайшей канистре, G — вызвать привидение,
   * H — нагреть лампу, L — почти слить масло.
   */
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
    if (input.consumePress('KeyG')) {
      session.requestGhost();
    }
    if (input.consumePress('KeyH')) {
      session.requestLamp('hot');
    }
    if (input.consumePress('KeyL')) {
      session.requestLamp('low-oil');
    }
    if (input.consumePress('KeyO')) {
      session.requestGoto('oil');
      // Сервер ставит в шаге правее канистры — смотрим налево и вниз, на неё.
      player.yaw = PlayerMovement.yawTowards(new Vector2(-1, 0));
      player.pitch = -0.6;
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
