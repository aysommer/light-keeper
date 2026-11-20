import { GameConfig } from '@light-keeper/shared';
import type { ExitSettings, MatchSettings } from '@light-keeper/shared';
import type { ServerPlayer } from '../entities/ServerPlayer.ts';
import type { MatchWorld } from '../game/MatchWorld.ts';
import type { System } from './System.ts';

/**
 * Дверь выхода и ключ:
 * - игрок подбирает ключ, подойдя к нему;
 * - скрытая дверь проявляется, когда рядом игрок с горящей лампой в руке;
 * - удержание `E` у двери 3 с открывает её (запертую — только владелец ключа);
 *   отпустил или отошёл — прогресс сбрасывается;
 * - после открытия есть 30 с: игрок у двери нажимает `E` и попадает в тамбур;
 *   вошли оба — переход, не успели — конец партии.
 */
export class ExitSystem implements System {
  /** Допуск сравнения времени: сумма шагов по 0.05 с даёт 2.9999… вместо 3. */
  private static readonly TIME_EPSILON = 1e-6;

  public constructor(
    private readonly exitSettings: ExitSettings = GameConfig.exit,
    private readonly matchSettings: MatchSettings = GameConfig.match,
  ) {}

  public update(world: MatchWorld, deltaSeconds: number): void {
    if (world.phase === 'playing' && world.over === null) {
      const active = [...world.players.values()].filter((player) => !player.inTambour);
      this.pickUpKey(world, active);
      this.reveal(world, active);
      if (world.exit.open) {
        this.updateOpenDoor(world, active, deltaSeconds);
      } else {
        this.updateOpening(world, active, deltaSeconds);
      }
    }
    world.players.forEach((player) => (player.interactPressed = false));
  }

  private pickUpKey(world: MatchWorld, active: readonly ServerPlayer[]): void {
    const key = world.space.key;
    if (!key || !world.exit.keyOnGround) {
      return;
    }
    const finder = active.find(
      (player) => player.position.distanceTo(key) <= this.exitSettings.keyPickupDistance,
    );
    if (finder) {
      world.exit.keyOnGround = false;
      world.exit.keyHolderId = finder.id;
    }
  }

  /** Скрытая дверь проявляется в свете лампы игрока поблизости. */
  private reveal(world: MatchWorld, active: readonly ServerPlayer[]): void {
    if (world.exit.revealed) {
      return;
    }
    const front = world.space.exit.frontPoint();
    const revealer = active.find(
      (player) =>
        player.lampShining && player.position.distanceTo(front) <= this.exitSettings.revealDistance,
    );
    if (revealer) {
      world.exit.revealed = true;
    }
  }

  private updateOpening(
    world: MatchWorld,
    active: readonly ServerPlayer[],
    deltaSeconds: number,
  ): void {
    const exit = world.exit;
    const canOpen = (player: ServerPlayer): boolean =>
      exit.revealed &&
      player.interacting &&
      this.isNearDoor(world, player) &&
      (world.space.exit.kind !== 'locked' || exit.keyHolderId === player.id);

    const current = exit.openerId ? world.players.get(exit.openerId) : undefined;
    const opener = current && canOpen(current) ? current : active.find(canOpen);
    if (!opener) {
      exit.openerId = null;
      exit.openSeconds = 0;
      return;
    }
    if (opener.id !== exit.openerId) {
      exit.openerId = opener.id;
      exit.openSeconds = 0;
    }
    exit.openSeconds += deltaSeconds;
    if (exit.openSeconds + ExitSystem.TIME_EPSILON >= this.exitSettings.openSeconds) {
      exit.open = true;
      exit.openerId = null;
      exit.openSeconds = 0;
      exit.secondsLeft = this.exitSettings.timerSeconds;
      // Удержание `E` не должно сразу завести открывшего в тамбур — нужно новое нажатие.
      world.players.forEach((player) => (player.interactPressed = false));
    }
  }

  private updateOpenDoor(
    world: MatchWorld,
    active: readonly ServerPlayer[],
    deltaSeconds: number,
  ): void {
    for (const player of active) {
      if (player.interactPressed && this.isNearDoor(world, player)) {
        player.inTambour = true;
      }
    }
    const everyoneInside = [...world.players.values()].every((player) => player.inTambour);
    if (everyoneInside) {
      world.beginTransition(this.matchSettings.transitionSeconds);
      return;
    }
    const exit = world.exit;
    exit.secondsLeft = (exit.secondsLeft ?? 0) - deltaSeconds;
    if (exit.secondsLeft <= ExitSystem.TIME_EPSILON) {
      world.finish('door_timeout');
    }
  }

  private isNearDoor(world: MatchWorld, player: ServerPlayer): boolean {
    return (
      player.position.distanceTo(world.space.exit.frontPoint()) <=
      this.exitSettings.interactDistance
    );
  }
}
