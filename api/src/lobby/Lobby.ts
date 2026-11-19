import { PLAYER_COLORS } from '@light-keeper/shared';
import type { LobbySnapshot, LobbyStatus, PlayerColor, ServerMessage } from '@light-keeper/shared';
import { Match } from '../game/Match.ts';
import type { MatchOptions } from '../game/Match.ts';
import { LobbyError } from './LobbyError.ts';
import type { LobbyParticipant } from './LobbyParticipant.ts';

export interface LobbyOptions {
  /** Длительность обратного отсчёта перед стартом, с. 0 — старт сразу. */
  readonly countdownSeconds: number;
  /** Источник seed для новой партии. */
  readonly createSeed: () => number;
  /** Настройки партии; по умолчанию `Match.DEFAULT_OPTIONS`. */
  readonly match?: MatchOptions;
}

class LobbyMember {
  public ready = false;

  public constructor(
    public readonly participant: LobbyParticipant,
    public readonly color: PlayerColor,
  ) {}
}

/**
 * Комната на двоих. Когда оба игрока готовы — обратный отсчёт и старт партии.
 * Если кто-то передумал или вышел во время отсчёта — отсчёт отменяется.
 */
export class Lobby {
  public static readonly CAPACITY = PLAYER_COLORS.length;

  private readonly members = new Map<string, LobbyMember>();
  private currentStatus: LobbyStatus = 'waiting';
  private countdownLeft = 0;
  private countdownTimer: ReturnType<typeof setInterval> | null = null;
  private currentMatch: Match | null = null;

  public constructor(
    public readonly code: string,
    private readonly options: LobbyOptions,
  ) {}

  public get status(): LobbyStatus {
    return this.currentStatus;
  }

  public get size(): number {
    return this.members.size;
  }

  public get isEmpty(): boolean {
    return this.members.size === 0;
  }

  /** Идущая партия или `null`. */
  public get match(): Match | null {
    return this.currentMatch;
  }

  public has(participantId: string): boolean {
    return this.members.has(participantId);
  }

  public add(participant: LobbyParticipant): void {
    if (this.currentStatus === 'in_game') {
      throw new LobbyError('lobby_in_game', 'Партия в этой комнате уже идёт');
    }
    if (this.members.size >= Lobby.CAPACITY) {
      throw new LobbyError('lobby_full', 'В комнате уже двое');
    }
    const taken = new Set([...this.members.values()].map((member) => member.color));
    const color = PLAYER_COLORS.find((candidate) => !taken.has(candidate));
    if (!color) {
      throw new LobbyError('lobby_full', 'В комнате уже двое');
    }
    this.members.set(participant.id, new LobbyMember(participant, color));
    this.broadcastState();
  }

  public remove(participantId: string): void {
    if (!this.members.delete(participantId)) {
      return;
    }
    if (this.currentStatus === 'in_game') {
      this.stopMatch();
      this.broadcast({ type: 'match:aborted', reason: 'partner_left' });
    }
    this.cancelCountdown();
    this.currentStatus = 'waiting';
    this.members.forEach((member) => (member.ready = false));
    this.broadcastState();
  }

  public setReady(participantId: string, ready: boolean): void {
    const member = this.members.get(participantId);
    if (!member) {
      throw new LobbyError('not_in_lobby', 'Ты не в этой комнате');
    }
    if (this.currentStatus === 'in_game' || member.ready === ready) {
      return;
    }
    member.ready = ready;
    if (this.allReady()) {
      this.startCountdown();
    } else {
      this.cancelCountdown();
      this.broadcastState();
    }
  }

  public snapshot(): LobbySnapshot {
    return {
      code: this.code,
      status: this.currentStatus,
      players: [...this.members.values()].map((member) => ({
        id: member.participant.id,
        color: member.color,
        ready: member.ready,
      })),
      countdownSeconds: this.currentStatus === 'countdown' ? this.countdownLeft : null,
    };
  }

  public dispose(): void {
    this.cancelCountdown();
    this.stopMatch();
    this.members.clear();
  }

  private allReady(): boolean {
    return (
      this.members.size === Lobby.CAPACITY &&
      [...this.members.values()].every((member) => member.ready)
    );
  }

  private startCountdown(): void {
    if (this.options.countdownSeconds <= 0) {
      this.startMatch();
      return;
    }
    this.currentStatus = 'countdown';
    this.countdownLeft = this.options.countdownSeconds;
    this.broadcastState();
    this.countdownTimer = setInterval(() => {
      this.countdownLeft -= 1;
      if (this.countdownLeft <= 0) {
        this.cancelCountdown();
        this.startMatch();
      } else {
        this.broadcastState();
      }
    }, 1000);
  }

  private cancelCountdown(): void {
    if (this.countdownTimer !== null) {
      clearInterval(this.countdownTimer);
      this.countdownTimer = null;
    }
    if (this.currentStatus === 'countdown') {
      this.currentStatus = 'waiting';
    }
  }

  private startMatch(): void {
    this.currentStatus = 'in_game';
    const match = new Match(this.options.createSeed(), [...this.members.values()], {
      ...(this.options.match ?? Match.DEFAULT_OPTIONS),
      onEnd: () => this.handleMatchEnd(),
    });
    this.currentMatch = match;
    this.broadcastState();
    for (const member of this.members.values()) {
      member.participant.send({
        type: 'match:start',
        seed: match.seed,
        you: member.color,
        players: match.playerInfo,
        tickRate: match.tickRate,
      });
    }
    match.start();
  }

  /** Партия закончилась по правилам: комната снова ждёт готовности обоих. */
  private handleMatchEnd(): void {
    this.currentMatch = null;
    this.currentStatus = 'waiting';
    this.members.forEach((member) => (member.ready = false));
    this.broadcastState();
  }

  private stopMatch(): void {
    this.currentMatch?.stop();
    this.currentMatch = null;
  }

  private broadcastState(): void {
    this.broadcast({ type: 'lobby:state', lobby: this.snapshot() });
  }

  private broadcast(message: ServerMessage): void {
    this.members.forEach((member) => member.participant.send(message));
  }
}
