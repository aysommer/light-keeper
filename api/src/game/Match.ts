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
import { ExchangeSystem } from '../systems/ExchangeSystem.ts';
import { ExitSystem } from '../systems/ExitSystem.ts';
import { GhostSystem } from '../systems/GhostSystem.ts';
import { LampSystem } from '../systems/LampSystem.ts';
import { OilSystem } from '../systems/OilSystem.ts';
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
      new OilSystem(),
      new ExchangeSystem(),
      new GhostSystem(),
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
    // К ключу и канистре — в шаге от них, чтобы их было видно и подобрать можно было самому.
    const destination =
      target === 'exit'
        ? space.exit.frontPoint(0.6)
        : target === 'key'
          ? space.key?.add(Match.KEY_GOTO_OFFSET)
          : this.nearestCanister(player?.position)?.add(Match.KEY_GOTO_OFFSET);
    if (player && !player.inTambour && destination) {
      player.position = destination;
    }
  }

  /** Отладка: вызвать привидение примерно в 8 м от игрока (по лабиринту). */
  public debugGhost(playerId: string): void {
    const player = this.world.players.get(playerId);
    if (!player) {
      return;
    }
    const population = this.world.ghostPopulation;
    population.field.computeFrom([player.position]);
    const steps = Math.round(8 / population.field.resolution);
    const ring = population.field
      .cellsFartherThan(steps)
      .filter((cell) => population.field.stepsAt(cell) <= steps + 2);
    const at = ring[0] ?? population.field.farthestCell();
    if (at) population.add(at);
    population.fieldRefreshIn = 0;
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

  /** Ближайшая ещё не подобранная полная канистра. */
  private nearestCanister(from: Vector2 | undefined): Vector2 | undefined {
    if (!from) return undefined;
    let best: Vector2 | undefined;
    this.world.space.oilSpawns.forEach((spawn, index) => {
      if (this.world.oil.isTaken(index) || !this.world.space.isOilFull(index)) return;
      if (!best || spawn.distanceTo(from) < best.distanceTo(from)) best = spawn;
    });
    return best;
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
        exchange: this.world.exchange.snapshot(),
        oilTaken: this.world.oil.snapshot(),
        oilDropped: this.world.oil.droppedSnapshot(),
        ghosts: this.world.ghostPopulation.ghosts.map((ghost) => ghost.snapshot()),
        players: [...this.world.players.values()].map((player) => player.snapshot()),
      },
    };
    this.broadcast(message);
  }

  private broadcast(message: ServerMessage): void {
    this.world.players.forEach((player) => player.participant.send(message));
  }
}
