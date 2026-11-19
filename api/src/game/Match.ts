import { PLAYER_COLORS, PlayerMovement } from '@light-keeper/shared';
import type {
  MatchPlayerInfo,
  PlayerColor,
  PlayerInput,
  ServerMessage,
} from '@light-keeper/shared';
import { ServerPlayer } from '../entities/ServerPlayer.ts';
import type { LobbyParticipant } from '../lobby/LobbyParticipant.ts';
import { MovementSystem } from '../systems/MovementSystem.ts';
import type { System } from '../systems/System.ts';
import { MatchWorld } from './MatchWorld.ts';

export interface MatchOptions {
  /** Частота симуляции и рассылки снимков, Гц. */
  readonly tickRate: number;
  readonly now?: () => number;
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

  public readonly world: MatchWorld;
  private readonly systems: System[];
  private readonly now: () => number;
  private timer: ReturnType<typeof setInterval> | null = null;
  private tick = 0;
  private startedAt = 0;
  private lastTickAt = 0;

  public constructor(
    seed: number,
    members: readonly MatchMember[],
    private readonly options: MatchOptions = Match.DEFAULT_OPTIONS,
  ) {
    this.now = options.now ?? (() => performance.now());
    this.world = new MatchWorld(seed);
    const starts = this.world.generator.startPositions();
    for (const member of members) {
      const start = starts[PLAYER_COLORS.indexOf(member.color)] ?? starts[0];
      this.world.players.set(
        member.participant.id,
        new ServerPlayer(member.participant, member.color, start),
      );
    }
    this.systems = [new MovementSystem(new PlayerMovement(this.world.collisions))];
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

  public receiveInput(playerId: string, commands: readonly PlayerInput[]): void {
    this.world.players.get(playerId)?.enqueue(commands);
  }

  /** Один тик симуляции (публичный — для тестов). */
  public step(): void {
    const now = this.now();
    const deltaSeconds = Math.max(0, (now - this.lastTickAt) / 1000);
    this.lastTickAt = now;
    this.tick += 1;
    for (const system of this.systems) {
      system.update(this.world, deltaSeconds);
    }
    this.broadcastSnapshot(now);
  }

  private broadcastSnapshot(now: number): void {
    const message: ServerMessage = {
      type: 'match:snapshot',
      snapshot: {
        tick: this.tick,
        serverTime: Math.round(now - this.startedAt),
        distance: this.world.distance,
        players: [...this.world.players.values()].map((player) => player.snapshot()),
      },
    };
    this.world.players.forEach((player) => player.participant.send(message));
  }
}
