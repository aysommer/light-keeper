import { GameConfig, Vector2 } from '@light-keeper/shared';
import type {
  DebugGotoTarget,
  DebugLampPreset,
  MatchPlayerInfo,
  PlayerColor,
  PlayerInput,
  ServerMessage,
} from '@light-keeper/shared';
import { ServerPlayer } from '../entities/ServerPlayer.ts';
import type { LobbyParticipant } from '../lobby/LobbyParticipant.ts';
import { ExitSystem } from '../systems/ExitSystem.ts';
import { LampSystem } from '../systems/LampSystem.ts';
import { MovementSystem } from '../systems/MovementSystem.ts';
import type { System } from '../systems/System.ts';
import { TransitionSystem } from '../systems/TransitionSystem.ts';
import { MatchWorld } from './MatchWorld.ts';

export interface MatchOptions {
  /** Частота симуляции и рассылки снимков, Гц. */
  readonly tickRate: number;
  /** Длительность перехода между пространствами, с. */
  readonly transitionSeconds?: number;
  readonly now?: () => number;
  /** Вызывается, когда партия закончилась по правилам игры. */
  readonly onEnd?: () => void;
}

export interface MatchMember {
  readonly participant: LobbyParticipant;
  readonly color: PlayerColor;
}

/**
 * Партия: авторитетная симуляция мира с фиксированной частотой тиков.
 * Каждый тик — системы обновляют мир, игрокам уходит снимок `match:snapshot`.
 */
export class Match {
  public static readonly DEFAULT_OPTIONS: MatchOptions = { tickRate: 20 };
  /** Отладочный перенос к ключу ставит игрока на 1.2 м правее ключа (внутри той же клетки). */
  public static readonly KEY_GOTO_OFFSET = new Vector2(1.2, 0);

  public readonly world: MatchWorld;
  private readonly systems: System[];
  private readonly now: () => number;
  private timer: ReturnType<typeof setInterval> | null = null;
  private tick = 0;
  private startedAt = 0;
  private lastTickAt = 0;
  /** Партия закончилась: больше не симулируем и не рассылаем. */
  private ended = false;

  public constructor(
    seed: number,
    members: readonly MatchMember[],
    private readonly options: MatchOptions = Match.DEFAULT_OPTIONS,
  ) {
    this.now = options.now ?? (() => performance.now());
    this.world = new MatchWorld(seed);
    for (const member of members) {
      const start = this.world.space.startPositions[0];
      this.world.addPlayer(new ServerPlayer(member.participant, member.color, start));
    }
    this.systems = [
      new MovementSystem(),
      new LampSystem(),
      new ExitSystem(GameConfig.exit, {
        transitionSeconds: options.transitionSeconds ?? GameConfig.match.transitionSeconds,
      }),
      new TransitionSystem(),
    ];
  }

  public get seed(): number {
    return this.world.seed;
  }

  public get tickRate(): number {
    return this.options.tickRate;
  }

  public get playerInfo(): MatchPlayerInfo[] {
    return [...this.world.players.values()].map((player) => ({
      id: player.id,
      color: player.color,
    }));
  }

  public start(): void {
    if (this.timer !== null) {
      return;
    }
    this.startedAt = this.now();
    this.lastTickAt = this.startedAt;
    this.timer = setInterval(() => this.step(), 1000 / this.options.tickRate);
  }

  public stop(): void {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /** Начать переход в следующее пространство (пока — отладочная команда; на этапе 6 — дверь). */
  public requestNextSpace(): void {
    this.world.beginTransition(
      this.options.transitionSeconds ?? GameConfig.match.transitionSeconds,
    );
  }

  /** Отладка: перенести игрока к двери выхода или к ключу. */
  public debugGoto(playerId: string, target: DebugGotoTarget): void {
    const player = this.world.players.get(playerId);
    const space = this.world.space;
    // К ключу — в шаге от него, чтобы его было видно и подобрать можно было самому.
    const destination =
      target === 'exit' ? space.exit.frontPoint(0.6) : space.key?.add(Match.KEY_GOTO_OFFSET);
    if (player && !player.inTambour && destination) {
      player.position = destination;
    }
  }

  /** Отладка: нагреть лампу игрока или почти слить из неё масло. */
  public debugLamp(playerId: string, preset: DebugLampPreset): void {
    const lamp = this.world.players.get(playerId)?.lamp;
    if (!lamp) {
      return;
    }
    if (preset === 'hot') {
      lamp.heat = Math.max(lamp.heat, 85);
    } else {
      lamp.oil = Math.min(lamp.oil, 12);
    }
  }

  public receiveInput(playerId: string, commands: readonly PlayerInput[]): void {
    this.world.players.get(playerId)?.enqueue(commands);
  }

  /** Один тик симуляции (публичный — для тестов). */
  public step(): void {
    if (this.ended) {
      return;
    }
    const now = this.now();
    const deltaSeconds = Math.max(0, (now - this.lastTickAt) / 1000);
    this.lastTickAt = now;
    this.tick += 1;
    for (const system of this.systems) {
      system.update(this.world, deltaSeconds);
    }
    this.broadcastSnapshot(now);
    const reason = this.world.over;
    if (reason !== null) {
      this.ended = true;
      this.stop();
      this.broadcast({ type: 'match:over', reason, spacesCleared: this.world.spaceIndex });
      this.options.onEnd?.();
    }
  }

  private broadcastSnapshot(now: number): void {
    const message: ServerMessage = {
      type: 'match:snapshot',
      snapshot: {
        tick: this.tick,
        serverTime: Math.round(now - this.startedAt),
        spaceIndex: this.world.spaceIndex,
        phase: this.world.phase,
        exit: this.world.exit.snapshot(GameConfig.exit.openSeconds),
        players: [...this.world.players.values()].map((player) => player.snapshot()),
      },
    };
    this.broadcast(message);
  }

  private broadcast(message: ServerMessage): void {
    this.world.players.forEach((player) => player.participant.send(message));
  }
}
