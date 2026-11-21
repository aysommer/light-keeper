import {
  CollisionWorld,
  PLAYER_COLORS,
  PlayerMovement,
  SeedHasher,
  SpaceGenerator,
} from '@light-keeper/shared';
import type { MatchOverReason, Space, SpacePhase } from '@light-keeper/shared';
import { Lamp } from '../entities/Lamp.ts';
import type { ServerPlayer } from '../entities/ServerPlayer.ts';
import { ExchangeState } from './ExchangeState.ts';
import { ExitState } from './ExitState.ts';
import { GhostPopulation } from './GhostPopulation.ts';
import { OilState } from './OilState.ts';

/**
 * Мир партии: текущее пространство, его коллизии, игроки и фаза
 * (игра или переход в следующее пространство).
 */
export class MatchWorld {
  public readonly generator: SpaceGenerator;
  public readonly players = new Map<string, ServerPlayer>();
  private currentSpace: Space;
  private currentMovement: PlayerMovement;
  private currentCollisions: CollisionWorld;
  /** Обмен лампами (счётчик обменов — на всю партию). */
  public readonly exchange = new ExchangeState();
  private currentPhase: SpacePhase = 'playing';
  private transitionLeft = 0;
  private currentExit: ExitState;
  private currentOil = new OilState();
  private currentGhosts: GhostPopulation;
  private overReason: MatchOverReason | null = null;
  /** Лампа одна на двоих; кто её держит — решается заново в каждом пространстве. */
  private readonly sharedLamp = new Lamp();

  public constructor(public readonly seed: number) {
    this.generator = new SpaceGenerator(seed);
    this.currentSpace = this.generator.generate(0);
    this.currentCollisions = CollisionWorld.fromSpace(this.currentSpace);
    this.currentMovement = new PlayerMovement(this.currentCollisions);
    this.currentExit = new ExitState();
    this.currentGhosts = new GhostPopulation(this.currentSpace, seed);
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

  /** Коллизии текущего пространства (для прямой видимости). */
  public get collisions(): CollisionWorld {
    return this.currentCollisions;
  }

  public get phase(): SpacePhase {
    return this.currentPhase;
  }

  /** Привидения текущего пространства (в новое пространство не переходят). */
  public get ghostPopulation(): GhostPopulation {
    return this.currentGhosts;
  }

  /** Какие канистры текущего пространства уже подобраны. */
  public get oil(): OilState {
    return this.currentOil;
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

  /** Общая лампа (одна на двоих). */
  public get lamp(): Lamp {
    return this.sharedLamp;
  }

  /**
   * Вход в пространство: кому достаётся лампа, решает случай — красному или
   * синему. Жребий выводится из зерна партии и номера пространства, поэтому
   * сервер не хранит лишнего, а сами партии (с разными зёрнами) непредсказуемы.
   */
  public dealLamp(): void {
    const colors = [...this.players.values()].map((player) => player.color);
    if (colors.length === 0) {
      return;
    }
    const ordered = PLAYER_COLORS.filter((color) => colors.includes(color));
    const color =
      ordered[SeedHasher.hash(this.seed, 'lamp-holder', this.spaceIndex) % ordered.length];
    const holder = [...this.players.values()].find((player) => player.color === color);
    if (holder) this.giveLampTo(holder.id);
  }

  /** Отдать лампу игроку (у второго она пропадает из рук). */
  public giveLampTo(playerId: string): void {
    this.players.forEach((player) => {
      player.lamp = player.id === playerId ? this.sharedLamp : null;
    });
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
    this.currentCollisions = CollisionWorld.fromSpace(this.currentSpace);
    this.currentMovement = new PlayerMovement(this.currentCollisions);
    this.currentExit = new ExitState();
    this.currentOil = new OilState();
    this.currentGhosts = new GhostPopulation(this.currentSpace, this.seed);
    this.exchange.clearOffer();
    this.currentPhase = 'playing';
    this.transitionLeft = 0;
    this.players.forEach((player) =>
      player.placeAt(this.startPositionFor(player), this.currentSpace.startYaw),
    );
    this.sharedLamp.refill();
    this.dealLamp();
  }

  private startPositionFor(player: ServerPlayer): ServerPlayer['position'] {
    const starts = this.currentSpace.startPositions;
    return starts[PLAYER_COLORS.indexOf(player.color)] ?? starts[0];
  }
}
