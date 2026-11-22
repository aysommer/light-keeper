import { GameConfig, PlayerMovement, Vector2 } from '@light-keeper/shared';
import type { HeldItem, MatchPlayerInfo, PlayerColor, Space } from '@light-keeper/shared';
import { AudioEngine } from '../audio/AudioEngine.ts';
import { SoundDirector } from '../audio/SoundDirector.ts';
import { Synth } from '../audio/Synth.ts';
import { PanelHum } from '../audio/PanelHum.ts';
import { TapeRecorderVoice } from '../audio/TapeRecorderVoice.ts';
import { SpaceTone } from '../scene/SpaceTone.ts';
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
import { RabbitDirector } from '../game/RabbitDirector.ts';
import { ScareLevel } from '../game/ScareLevel.ts';
import { InputController } from '../input/InputController.ts';
import type { NetworkClient } from '../network/NetworkClient.ts';
import { FirstPersonViewmodel } from '../scene/FirstPersonViewmodel.ts';
import { HandLampLight } from '../scene/HandLampLight.ts';
import { SceneManager } from '../scene/SceneManager.ts';
import { CodePanel } from './CodePanel.ts';
import { ExitHud } from './ExitHud.ts';
import { FloorHud } from './FloorHud.ts';
import { Hud } from './Hud.ts';
import { Hotbar } from './Hotbar.ts';
import { Jumpscare } from './Jumpscare.ts';
import { ScareOverlay } from './ScareOverlay.ts';
import { SettingsPanel } from './SettingsPanel.ts';
import { LampGauges } from './LampGauges.ts';
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
  /** Откуда работает лестница (как на сервере, StairSystem.REACH), м. */
  private static readonly STAIR_REACH = 0.9;
  /** Откуда поднимается флажок (как на сервере, FlagSystem.REACH), м. */
  private static readonly FLAG_REACH = 1;
  /** Сколько показывать «лампа у напарника» после нажатия 1 без лампы, с. */
  private static readonly NO_LAMP_HINT_SECONDS = 2;

  public readonly element: HTMLElement;
  private readonly hud: Hud;
  private readonly settings: SettingsPanel;
  private readonly overlay = new TransitionOverlay();
  private readonly exitHud = new ExitHud();
  private readonly floorHud = new FloorHud();
  private submitCode: ((code: readonly string[]) => void) | null = null;
  private readonly codePanel = new CodePanel((code) => this.submitCode?.(code));
  private readonly lampHud = new LampHud();
  private readonly lampGauges = new LampGauges();
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
  private readonly jumpscare = new Jumpscare();
  private readonly hotbar = new Hotbar();
  private scream: (() => void) | null = null;

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
      this.lampGauges.element,
      this.hud.element,
      this.exitHud.element,
      this.floorHud.element,
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
    const viewmodel = this.own(new FirstPersonViewmodel(sceneManager.viewmodelScene));
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
    session.setAudio(audio);
    const screamSynth = new Synth(audio);
    this.scream = () => screamSynth.scream();
    this.element.append(this.hotbar.element, this.jumpscare.element);
    const sound = this.own(new SoundDirector(audio));
    const tapeVoice = this.own(new TapeRecorderVoice(audio));
    const panelHum = this.own(new PanelHum(audio));
    // Редкие белые зайцы — только у этого игрока, на сеть не влияют.
    const rabbits = this.own(
      new RabbitDirector(sceneManager.scene, space, audio, new Synth(audio)),
    );
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
    sceneManager.setTone(SpaceTone.for(space.space));
    let titleUntil = GameScreen.TITLE_HOLD_SECONDS;
    this.overlay.showEntering(shownSpace + 1);

    let hadLamp = session.hasLamp;
    let askedForLampUntil = 0;
    /** Короткая подсказка по нажатию клавиши предмета, которого нет. */
    let flash: { text: string; until: number } | null = null;
    let codeFailuresSeen = 0;
    let hadGoose = false;
    this.submitCode = (code) => session.submitCode(code);
    this.element.append(this.codePanel.element);
    this.loop = new GameLoop((delta, time) => {
      if (import.meta.env.DEV) {
        this.handleDebugKeys(input, session, player, space);
        // B — выпустить зайца (если есть видимый угол).
        if (input.consumePress('KeyB')) rabbits.spawnSoon();
        (window as unknown as { __lkRabbit?: () => boolean }).__lkRabbit = () => rabbits.running;
        (window as unknown as { __lkRabbits?: unknown }).__lkRabbits = rabbits;
      }
      if (space.spaceIndex !== shownSpace) {
        shownSpace = space.spaceIndex;
        sceneManager.setTone(SpaceTone.for(space.space));
        titleUntil = time + GameScreen.TITLE_HOLD_SECONDS;
        this.overlay.showEntering(shownSpace + 1);
      }
      const inTransition = session.phase === 'transition';
      if (inTransition) {
        this.overlay.showEntering(shownSpace + 2);
      } else if (time >= titleUntil) {
        this.overlay.hide();
      }
      // Пока открыта кодовая панель, игрок стоит на месте.
      controller.frozen = inTransition || session.inTambour || this.codePanel.visible;

      // Предмет в руке: 1 — лампа, 2 — компас, 3 — ключи, 4 — записка.
      // Уходит на сервер вместе с командой. Лампа одна на двоих: без неё — компас.
      for (const code of HeldItems.keyCodes) {
        if (!input.consumePress(code)) continue;
        const wanted = HeldItems.itemFor(code);
        if (wanted === 'key' && session.ownKeys === 0) {
          flash = { text: 'Ключей нет — найди их', until: time + GameScreen.NO_LAMP_HINT_SECONDS };
          continue;
        }
        if (wanted === 'flag' && session.ownFlags === 0) {
          flash = { text: 'Флажков нет — найди их', until: time + GameScreen.NO_LAMP_HINT_SECONDS };
          continue;
        }
        if (wanted === 'note' && !session.hasNote) {
          flash = { text: 'Записки нет — найди её', until: time + GameScreen.NO_LAMP_HINT_SECONDS };
          continue;
        }
        if (wanted === 'goose' && !session.hasGoose) {
          flash = { text: 'Гуся нет — поймай его', until: time + GameScreen.NO_LAMP_HINT_SECONDS };
          continue;
        }
        this.held.selectByKey(code);
        if (!session.hasLamp && this.held.current === 'lamp') {
          askedForLampUntil = time + GameScreen.NO_LAMP_HINT_SECONDS;
        }
      }
      // Колесо мыши листает доступные предметы (как в других играх).
      const wheel = input.consumeWheel();
      if (wheel !== 0 && !this.codePanel.visible) {
        const available: HeldItem[] = [session.hasLamp ? 'lamp' : 'compass', 'compass'];
        if (session.ownKeys > 0) available.push('key');
        if (session.hasNote) available.push('note');
        if (session.ownFlags > 0) available.push('flag');
        if (session.hasGoose) available.push('goose');
        const shown =
          this.held.current === 'lamp' && !session.hasLamp ? 'compass' : this.held.current;
        this.held.select(HeldItems.cycle(shown, wheel, available));
      }
      // Лампу только что передали — она сразу в руке (если руки не заняты гусем).
      if (session.hasLamp && !hadLamp && !session.hasGoose) this.held.select('lamp');
      hadLamp = session.hasLamp;
      // Гуся поймали — он сразу в руках. Взял другой предмет — сервер отпустит гуся.
      if (session.hasGoose && !hadGoose) {
        this.held.select('goose');
        flash = {
          text: 'Гусь пойман! Неси его в руках к двери. Возьмёшь другой предмет — вырвется',
          until: time + 4,
        };
      } else if (!session.hasGoose && hadGoose && session.goose !== null) {
        flash = { text: 'Гусь вырвался — лови заново!', until: time + 3 };
      }
      hadGoose = session.hasGoose;
      // Ключи вставлены или записка пропала (новое пространство) — рука возвращается к лампе.
      if (
        (this.held.current === 'key' && session.ownKeys === 0) ||
        (this.held.current === 'note' && !session.hasNote) ||
        (this.held.current === 'flag' && session.ownFlags === 0) ||
        (this.held.current === 'goose' && !session.hasGoose)
      ) {
        this.held.select('lamp');
      }
      const item = this.held.current === 'lamp' && !session.hasLamp ? 'compass' : this.held.current;
      controller.item = item;
      // Нажатие E — до того, как его заберёт управление (для кодовой панели).
      const interactPressed = input.peekPress('KeyE');
      controller.update(delta);
      session.update(delta, time);
      controller.applyToCamera(sceneManager.camera);
      tapeVoice.update(
        space.space,
        player.position,
        space.floor,
        !session.inTambour && !inTransition,
      );
      rabbits.update(delta, {
        position: player.position,
        camera: sceneManager.camera,
        active: !session.inTambour && !inTransition,
      });
      space.update(
        session.exit,
        session.oilTaken,
        session.oilDropped,
        delta,
        time,
        sceneManager.camera.position,
      );
      panelHum.update(
        space.nearbyPanels,
        sceneManager.camera.position,
        space.flickerLit,
        !session.inTambour && !inTransition,
      );
      const exit = session.exit;
      const partnerPosition = session.partnerPosition();
      const partnerFloor = session.partnerFloor();
      const floor = space.floor;
      this.floorHud.update(floor, space.space.floorCount, partnerFloor);
      // Смотришь на напарника рядом — подсказка об обмене важнее подсказки двери.
      const exchangeHint = this.exchangePrompt.resolve(
        session.exchange,
        options.playerId,
        player.position,
        player.yaw,
        partnerPosition && partnerFloor === floor ? { position: partnerPosition } : null,
        space.collisions,
        session.inTambour,
        session.hasLamp,
      );
      // Лампа на полу рядом — поднять её важнее всего остального.
      const dropped = session.droppedLamp;
      const pickupHint =
        dropped &&
        dropped.floor === floor &&
        !session.inTambour &&
        player.position.distanceTo(new Vector2(dropped.x, dropped.y)) <=
          GameConfig.lamp.pickupDistance
          ? 'E — поднять лампу'
          : null;
      // Флажок на полу рядом — поднять; флажок в руке — поставить.
      const groundFlag = session.inTambour
        ? undefined
        : session.flags.find(
            (flag) =>
              flag.holderId === null &&
              flag.floor === floor &&
              player.position.distanceTo(new Vector2(flag.x, flag.y)) <= GameScreen.FLAG_REACH,
          );
      const flagHint = groundFlag
        ? 'E — поднять флажок'
        : item === 'flag' && session.ownFlags > 0 && !session.inTambour
          ? 'E — поставить флажок'
          : null;
      // Гусь в руках и дверь рядом — E откроет её гусем.
      const gooseDoorHint =
        session.hasGoose &&
        item === 'goose' &&
        exit !== null &&
        !exit.open &&
        this.prompt.isNearDoor(space.space, player.position, floor)
          ? 'E — открыть дверь гусем'
          : null;
      // Лестница рядом: E — на соседний этаж.
      const stair = session.inTambour
        ? null
        : space.space.stairNear(floor, player.position, GameScreen.STAIR_REACH);
      const stairHint = stair
        ? `E — ${stair.to > floor ? 'подняться' : 'спуститься'} на ${stair.to + 1}-й этаж`
        : null;
      this.exitHud.update(
        exit,
        options.playerId,
        pickupHint ??
          exchangeHint ??
          stairHint ??
          gooseDoorHint ??
          flagHint ??
          this.prompt.resolve(
            space.space,
            exit,
            player.position,
            session.inTambour,
            {
              item,
              keys: session.ownKeys,
            },
            floor,
          ),
        space.space.exit.kind === 'locked'
          ? {
              own: session.ownKeys,
              inserted: exit?.keysInserted ?? 0,
              required: space.space.keys.length,
            }
          : null,
      );
      // Кодовая панель: E у двери с панелью открывает её; набранный код проверяет сервер.
      const atPanel =
        space.space.exit.kind === 'code' &&
        exit !== null &&
        !exit.open &&
        !session.inTambour &&
        !inTransition &&
        this.prompt.isNearDoor(space.space, player.position, floor);
      const panelCode = space.space.code;
      if (
        interactPressed &&
        atPanel &&
        exchangeHint === null &&
        pickupHint === null &&
        stairHint === null &&
        gooseDoorHint === null &&
        flagHint === null &&
        panelCode
      ) {
        codeFailuresSeen = exit.codeFailures;
        this.codePanel.show(panelCode.alphabet);
        document.exitPointerLock();
      }
      if (this.codePanel.visible) {
        if (!atPanel) {
          this.codePanel.hide();
        } else if (exit.codeFailures > codeFailuresSeen) {
          codeFailuresSeen = exit.codeFailures;
          this.codePanel.showWrong();
        }
      }
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
        wanted: item,
        lamp: session.ownLamp,
        reach: this.handOver.update(delta, session.exchange?.count ?? null),
        refueling: session.ownRefuelProgress > 0,
        bearing: partnerPosition
          ? PartnerBearing.clockwiseFromForward(player.position, player.yaw, partnerPosition)
          : null,
        keys: session.ownKeys,
        code: session.hasNote ? space.space.code : null,
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
      // Гусь бегает рядом — позвать в погоню.
      const freeGoose = session.goose && session.goose.holderId === null ? session.goose : null;
      const gooseNear =
        freeGoose !== null &&
        freeGoose.floor === floor &&
        player.position.distanceTo(new Vector2(freeGoose.x, freeGoose.y)) < 7;
      if (gooseNear && (flash === null || time >= flash.until)) {
        flash = { text: 'Гусь-призрак! Догони — он откроет дверь', until: time + 0.5 };
      }
      // В тамбуре и при переходе слоты не нужны — экран тёмный.
      this.hotbar.element.hidden = session.inTambour || inTransition;
      this.hotbar.update({
        selected: item,
        hasLamp: session.hasLamp,
        keys: session.ownKeys,
        hasNote: session.hasNote,
        flags: session.ownFlags,
        hasGoose: session.hasGoose,
      });
      const ownLamp = session.ownLamp;
      // Индикаторы нагрева и масла общей лампы — видны обоим (в тамбуре и при переходе скрыты).
      this.lampGauges.update(
        session.inTambour || inTransition ? null : session.sharedLamp,
        session.hasLamp,
        session.droppedLamp !== null,
      );
      this.lampHud.update(
        session.inTambour ? 0 : (ownLamp?.heat ?? 0),
        (flash !== null && time < flash.until ? flash.text : null) ??
          (session.hasLamp
            ? this.lampHint.resolve(ownLamp, item, session.inTambour, {
                canisters: session.ownCanisters,
                refueling: session.ownRefuelProgress > 0,
              })
            : this.lampHint.resolvePartnerLamp(
                session.sharedLamp,
                session.inTambour,
                session.ownCanisters,
                time < askedForLampUntil,
                session.droppedLamp !== null,
              )) ??
          (session.inTambour
            ? null
            : (this.canisterHint.resolve(
                space.space,
                session.oilTaken,
                session.oilDropped,
                player.position,
                floor,
              ) ?? this.tapeHint(space.space, player.position, floor))),
      );
      this.lampHud.updateOil(
        session.inTambour ? 0 : session.ownCanisters,
        session.ownRefuelProgress,
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
        pickups: (session.exit?.keysTaken.length ?? 0) + (session.exit?.noteHolderId ? 1 : 0),
        canisters: session.ownCanisters,
        overheated: session.sharedLamp?.overheated ?? false,
        exchangeCount: session.exchange?.count ?? 0,
        bobPhase: controller.bobPhase,
        moving: player.isMoving,
        running: controller.isRunning,
        lampLevel: viewmodel.lightLevel,
        lampHeat: ownLampState?.heat ?? 0,
        refueling: session.ownRefuelProgress > 0,
        scare,
        door: space.space.exit.position,
        doorFloor: space.space.exitFloor,
        floor,
        partner: session.partnerMotion(),
        ghosts: session.ghosts.list(),
      });
      sceneManager.render(time, scare, viewmodel.lightLevel);
    });
    this.loop.start();
  }

  /** Подсказка у магнитофона: он повторяет код вслух. */
  private tapeHint(space: Space, position: Vector2, floor: number): string | null {
    const tape = space.codeHint === 'tape' ? space.note : null;
    return tape && floor === space.noteFloor && tape.distanceTo(position) <= 2.5
      ? 'Магнитофон повторяет код — слушай и набери на панели'
      : null;
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
    if (input.consumePress('KeyF')) {
      session.requestGoto('flag');
      player.yaw = PlayerMovement.yawTowards(new Vector2(1, 0));
      player.pitch = -0.3;
    }
    if (input.consumePress('KeyY')) {
      session.requestGoto('goose');
      player.yaw = PlayerMovement.yawTowards(new Vector2(1, 0));
      player.pitch = -0.2;
    }
    if (input.consumePress('KeyU')) {
      session.requestGoto('stair');
      player.yaw = PlayerMovement.yawTowards(new Vector2(1, 0));
      player.pitch = 0;
    }
    if (input.consumePress('KeyJ')) {
      session.requestGoto('note');
      player.yaw = PlayerMovement.yawTowards(new Vector2(-1, 0));
      player.pitch = 0;
    }
    if (input.consumePress('KeyK')) {
      session.requestGoto('key');
      // Сервер ставит в шаге правее ключа — смотрим налево, на ключ.
      player.yaw = PlayerMovement.yawTowards(new Vector2(-1, 0));
      player.pitch = 0;
    }
  }

  /** Привидение поймало героя: лицо призрака на весь экран и крик. */
  public playJumpscare(): Promise<void> {
    this.scream?.();
    document.exitPointerLock();
    return this.jumpscare.play();
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
