import {
  CollisionWorld,
  PLAYER_COLORS,
  PlayerMovement,
  SpaceGenerator,
} from '@light-keeper/shared';
import type { MatchOverReason, Space, SpacePhase } from '@light-keeper/shared';
import type { ServerPlayer } from '../entities/ServerPlayer.ts';
import { ExitState } from './ExitState.ts';

/**
 * Мир партии: текущее пространство, его коллизии, игроки и фаза
 * (игра или переход в следующее пространство).
 */
export class MatchWorld {
  public readonly generator: SpaceGenerator;
  public readonly players = new Map<string, ServerPlayer>();
  private currentSpace: Space;
  private currentMovement: PlayerMovement;
  private currentPhase: SpacePhase = 'playing';
  private transitionLeft = 0;
  private currentExit: ExitState;
  private overReason: MatchOverReason | null = null;

  public constructor(public readonly seed: number) {
    this.generator = new SpaceGenerator(seed);
    this.currentSpace = this.generator.generate(0);
    this.currentMovement = new PlayerMovement(CollisionWorld.fromSpace(this.currentSpace));
    this.currentExit = new ExitState(this.currentSpace);
  }

  public get space(): Space {
    return this.currentSpace;
  }

  /** Номер текущего пространства = число пройденных пространств. */
  public get spaceIndex(): number {
    return this.currentSpace.index;
  }

  public get movement(): PlayerMovement {
    return this.currentMovement;
  }

  public get phase(): SpacePhase {
    return this.currentPhase;
  }

  /** Состояние двери и ключа текущего пространства. */
  public get exit(): ExitState {
    return this.currentExit;
  }

  /** Причина окончания партии; `null`, пока партия идёт. */
  public get over(): MatchOverReason | null {
    return this.overReason;
  }

  /** Закончить партию (например, не все успели войти в дверь). */
  public finish(reason: MatchOverReason): void {
    this.overReason ??= reason;
  }

  /** Сколько секунд осталось до конца перехода. */
  public get transitionSecondsLeft(): number {
    return this.transitionLeft;
  }

  public addPlayer(player: ServerPlayer): void {
    this.players.set(player.id, player);
    player.placeAt(this.startPositionFor(player), this.currentSpace.startYaw);
  }

  /** Начинает переход в следующее пространство. Повторный вызов во время перехода игнорируется. */
  public beginTransition(seconds: number): boolean {
    if (this.currentPhase !== 'playing') {
      return false;
    }
    this.currentPhase = 'transition';
    this.transitionLeft = seconds;
    return true;
  }

  /** Отсчитывает переход; по его окончании входит в следующее пространство. */
  public advanceTransition(deltaSeconds: number): void {
    if (this.currentPhase !== 'transition') {
      return;
    }
    this.transitionLeft -= deltaSeconds;
    if (this.transitionLeft <= 0) {
      this.enterSpace(this.currentSpace.index + 1);
    }
  }

  /** Новое пространство: генерация, коллизии, игроки на старт, ресурсы — заново. */
  public enterSpace(index: number): void {
    this.currentSpace = this.generator.generate(index);
    this.currentMovement = new PlayerMovement(CollisionWorld.fromSpace(this.currentSpace));
    this.currentExit = new ExitState(this.currentSpace);
    this.currentPhase = 'playing';
    this.transitionLeft = 0;
    this.players.forEach((player) => {
      player.placeAt(this.startPositionFor(player), this.currentSpace.startYaw);
      player.lamp.refill();
    });
  }

  private startPositionFor(player: ServerPlayer): ServerPlayer['position'] {
    const starts = this.currentSpace.startPositions;
    return starts[PLAYER_COLORS.indexOf(player.color)] ?? starts[0];
  }
}
