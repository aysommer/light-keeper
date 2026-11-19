import type { Scene } from 'three';
import { Vector2 } from '@light-keeper/shared';
import type { MatchPlayerInfo, MatchSnapshot, SpacePhase } from '@light-keeper/shared';
import { InputSender } from '../network/InputSender.ts';
import type { NetworkClient } from '../network/NetworkClient.ts';
import { PredictionReconciler } from '../network/PredictionReconciler.ts';
import { ServerClock } from '../network/ServerClock.ts';
import type { ActiveSpace } from './ActiveSpace.ts';
import type { FirstPersonController } from './FirstPersonController.ts';
import type { LocalPlayer } from './LocalPlayer.ts';
import { RemotePlayerView } from './RemotePlayerView.ts';

/**
 * Сетевая часть партии на клиенте: отправка ввода, согласование своей позиции
 * с сервером, интерполяция напарника, смена пространств, пинг.
 */
export class NetworkSession {
  /** Насколько «в прошлом» рисуется напарник, мс (≈2 тика сервера). */
  private static readonly INTERPOLATION_DELAY_MS = 100;
  private static readonly PING_INTERVAL_MS = 2000;

  private readonly sender: InputSender;
  private readonly reconciler: PredictionReconciler;
  private readonly clock = new ServerClock();
  private readonly remotes = new Map<string, RemotePlayerView>();
  private readonly unsubscribe: Array<() => void> = [];
  private sincePingMs = NetworkSession.PING_INTERVAL_MS;
  private latestPingMs: number | null = null;
  private currentPhase: SpacePhase = 'playing';

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
      network.on('pong', (message) => {
        this.latestPingMs = Math.round(performance.now() - message.sentAt);
      }),
    );
  }

  public get phase(): SpacePhase {
    return this.currentPhase;
  }

  public get pingMs(): number | null {
    return this.latestPingMs;
  }

  /** Расстояние до ближайшего напарника, м; `null`, если его ещё не видно. */
  public partnerDistance(): number | null {
    let nearest: number | null = null;
    for (const remote of this.remotes.values()) {
      const state = remote.state;
      if (state) {
        const distance = state.position.distanceTo(this.player.position);
        nearest = nearest === null ? distance : Math.min(nearest, distance);
      }
    }
    return nearest;
  }

  /** Отладка: попросить сервер перейти в следующее пространство. */
  public requestNextSpace(): void {
    this.network.send({ type: 'debug:next-space' });
  }

  public update(deltaSeconds: number, time: number): void {
    this.sender.update(deltaSeconds);
    const serverNow = this.clock.serverNow(performance.now());
    if (serverNow !== null) {
      const renderTime = serverNow - NetworkSession.INTERPOLATION_DELAY_MS;
      this.remotes.forEach((remote) => remote.update(renderTime, time));
    }
    this.sincePingMs += deltaSeconds * 1000;
    if (this.sincePingMs >= NetworkSession.PING_INTERVAL_MS) {
      this.sincePingMs = 0;
      this.network.send({ type: 'ping', sentAt: performance.now() });
    }
  }

  public dispose(): void {
    this.unsubscribe.forEach((off) => off());
    this.remotes.forEach((remote) => remote.dispose());
    this.remotes.clear();
  }

  private applySnapshot(snapshot: MatchSnapshot): void {
    this.clock.observe(snapshot.serverTime, performance.now());
    this.currentPhase = snapshot.phase;
    const enteredNewSpace = snapshot.spaceIndex !== this.space.spaceIndex;
    if (enteredNewSpace) {
      this.space.enter(snapshot.spaceIndex);
      this.reconciler.clear();
      this.remotes.forEach((remote) => remote.track.clear());
    }
    for (const state of snapshot.players) {
      const position = new Vector2(state.x, state.y);
      if (state.id === this.playerId) {
        if (enteredNewSpace) {
          this.player.teleport(position, this.space.space.startYaw);
        } else {
          this.reconciler.reconcile(this.player, position, state.lastSeq);
        }
        continue;
      }
      this.remotes
        .get(state.id)
        ?.track.push(snapshot.serverTime, { position, yaw: state.yaw, pitch: state.pitch });
    }
  }
}
