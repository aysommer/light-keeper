import type { Scene } from 'three';
import { Vector2 } from '@light-keeper/shared';
import type {
  DebugGotoTarget,
  DebugLampPreset,
  DroppedCanister,
  ExchangeSnapshot,
  ExitSnapshot,
  LampSnapshot,
  MatchPlayerInfo,
  MatchSnapshot,
  SpacePhase,
} from '@light-keeper/shared';
import { InputSender } from '../network/InputSender.ts';
import type { NetworkClient } from '../network/NetworkClient.ts';
import { PredictionReconciler } from '../network/PredictionReconciler.ts';
import { ServerClock } from '../network/ServerClock.ts';
import type { ActiveSpace } from './ActiveSpace.ts';
import type { FirstPersonController } from './FirstPersonController.ts';
import type { LocalPlayer } from './LocalPlayer.ts';
import { GhostsView } from './GhostsView.ts';
import { RemotePlayerView } from './RemotePlayerView.ts';

/**
 * Сетевая часть партии на клиенте: отправка ввода, согласование своей позиции
 * с сервером, интерполяция напарника, смена пространств.
 */
export class NetworkSession {
  /** Насколько «в прошлом» рисуется напарник, мс (≈2 тика сервера). */
  private static readonly INTERPOLATION_DELAY_MS = 100;

  private readonly sender: InputSender;
  private readonly reconciler: PredictionReconciler;
  private readonly clock = new ServerClock();
  private readonly remotes = new Map<string, RemotePlayerView>();
  private readonly ghostsView: GhostsView;
  private readonly unsubscribe: Array<() => void> = [];
  private currentPhase: SpacePhase = 'playing';
  private latestExit: ExitSnapshot | null = null;
  private selfInTambour = false;
  private selfLamp: LampSnapshot | null = null;
  /** Лампа одна на двоих: у этого ли игрока она сейчас. */
  private selfHasLamp = false;
  /** Состояние общей лампы, у кого бы она ни была. */
  private latestSharedLamp: LampSnapshot | null = null;
  private latestExchange: ExchangeSnapshot | null = null;
  private latestOilTaken: readonly number[] | null = null;
  private latestOilDropped: readonly DroppedCanister[] | null = null;
  private selfCanisters = 0;
  private selfRefuel = 0;

  public constructor(
    private readonly network: NetworkClient,
    private readonly playerId: string,
    players: readonly MatchPlayerInfo[],
    private readonly player: LocalPlayer,
    controller: FirstPersonController,
    private readonly space: ActiveSpace,
    scene: Scene,
  ) {
    this.sender = new InputSender(network);
    // Кому достанется лампа, решает сервер (жребий в каждом пространстве);
    // до первого снимка считаем, что её нет — это скрыто заставкой пространства.
    this.ghostsView = new GhostsView(scene);
    this.reconciler = new PredictionReconciler(space);
    for (const info of players) {
      if (info.id !== playerId) {
        this.remotes.set(info.id, new RemotePlayerView(info.id, info.color, scene));
      }
    }
    controller.onCommand((command) => {
      this.reconciler.record(command);
      this.sender.push(command);
    });
    this.unsubscribe.push(
      network.on('match:snapshot', (message) => this.applySnapshot(message.snapshot)),
    );
  }

  public get phase(): SpacePhase {
    return this.currentPhase;
  }

  /** Последнее известное состояние двери и ключа. */
  public get exit(): ExitSnapshot | null {
    return this.latestExit;
  }

  /** Обмен лампами: предложение и счётчик обменов. */
  public get exchange(): ExchangeSnapshot | null {
    return this.latestExchange;
  }

  /** Номера подобранных канистр текущего пространства. */
  public get oilTaken(): readonly number[] | null {
    return this.latestOilTaken;
  }

  /** Пустые канистры, брошенные после заправки. */
  public get oilDropped(): readonly DroppedCanister[] | null {
    return this.latestOilDropped;
  }

  /** Сколько канистр несёт этот игрок. */
  public get ownCanisters(): number {
    return this.selfCanisters;
  }

  /** Прогресс заправки своей лампы, 0–1. */
  public get ownRefuelProgress(): number {
    return this.selfRefuel;
  }

  /** Состояние общей лампы, если она сейчас у этого игрока; иначе `null`. */
  public get ownLamp(): LampSnapshot | null {
    return this.selfHasLamp ? this.selfLamp : null;
  }

  /** Лампа (одна на двоих) сейчас у этого игрока. */
  public get hasLamp(): boolean {
    return this.selfHasLamp;
  }

  /** Состояние общей лампы, у кого бы из двоих она ни была. */
  public get sharedLamp(): LampSnapshot | null {
    return this.latestSharedLamp;
  }

  /** Этот игрок уже в тамбуре. */
  public get inTambour(): boolean {
    return this.selfInTambour;
  }

  /** Где напарник и как быстро идёт; `null`, если он неизвестен или в тамбуре. */
  public partnerMotion(): { position: Vector2; speed: number } | null {
    for (const remote of this.remotes.values()) {
      if (remote.state && !remote.inTambour) {
        return { position: remote.state.position, speed: remote.speed };
      }
    }
    return null;
  }

  /** Где сейчас напарник; `null`, если он неизвестен или уже в тамбуре. */
  public partnerPosition(): Vector2 | null {
    for (const remote of this.remotes.values()) {
      if (remote.state && !remote.inTambour) {
        return remote.state.position;
      }
    }
    return null;
  }

  /** Привидения на сцене. */
  public get ghosts(): GhostsView {
    return this.ghostsView;
  }

  /** Отладка: вызвать привидение неподалёку. */
  public requestGhost(): void {
    this.network.send({ type: 'debug:ghost' });
  }

  /** Отладка: попросить сервер перейти в следующее пространство. */
  public requestNextSpace(): void {
    this.network.send({ type: 'debug:next-space' });
  }

  /** Отладка: нагреть свою лампу или почти слить масло. */
  public requestLamp(preset: DebugLampPreset): void {
    this.network.send({ type: 'debug:lamp', preset });
  }

  /** Отладка: перенестись к двери (`exit`) или к ключу (`key`). */
  public requestGoto(target: DebugGotoTarget): void {
    this.network.send({ type: 'debug:goto', target });
  }

  public update(deltaSeconds: number, time: number): void {
    this.sender.update(deltaSeconds);
    const serverNow = this.clock.serverNow(performance.now());
    if (serverNow !== null) {
      const renderTime = serverNow - NetworkSession.INTERPOLATION_DELAY_MS;
      this.remotes.forEach((remote) => remote.update(renderTime, time));
      this.ghostsView.update(renderTime, time, deltaSeconds, this.player.position);
    }
  }

  public dispose(): void {
    this.unsubscribe.forEach((off) => off());
    this.remotes.forEach((remote) => remote.dispose());
    this.remotes.clear();
    this.ghostsView.clear();
  }

  private applySnapshot(snapshot: MatchSnapshot): void {
    this.clock.observe(snapshot.serverTime, performance.now());
    this.currentPhase = snapshot.phase;
    this.latestExit = snapshot.exit;
    this.latestExchange = snapshot.exchange;
    this.latestOilTaken = snapshot.oilTaken;
    this.latestOilDropped = snapshot.oilDropped;
    const enteredNewSpace = snapshot.spaceIndex !== this.space.spaceIndex;
    if (enteredNewSpace) {
      this.space.enter(snapshot.spaceIndex);
      this.reconciler.clear();
      this.remotes.forEach((remote) => remote.resetMotion());
      this.ghostsView.clear();
    }
    this.ghostsView.push(snapshot.serverTime, snapshot.ghosts);
    this.latestSharedLamp = snapshot.players.find((state) => state.lamp)?.lamp ?? null;
    for (const state of snapshot.players) {
      const position = new Vector2(state.x, state.y);
      if (state.id === this.playerId) {
        this.selfInTambour = state.inTambour;
        this.selfLamp = state.lamp;
        this.selfHasLamp = state.lamp !== null;
        this.selfCanisters = state.canisters;
        this.selfRefuel = state.refuelProgress;
        if (enteredNewSpace) {
          this.player.teleport(position, this.space.space.startYaw);
        } else {
          this.reconciler.reconcile(this.player, position, state.lastSeq);
        }
        continue;
      }
      const remote = this.remotes.get(state.id);
      remote?.setInTambour(state.inTambour);
      remote?.setHands(state.item, state.lamp);
      remote?.setExchangeCount(snapshot.exchange.count);
      remote?.track.push(snapshot.serverTime, { position, yaw: state.yaw, pitch: state.pitch });
    }
  }
}
