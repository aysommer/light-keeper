import { GameConfig } from '@light-keeper/shared';
import type { ExitSettings, MatchSettings, Vector2 } from '@light-keeper/shared';
import type { ServerPlayer } from '../entities/ServerPlayer.ts';
import type { MatchWorld } from '../game/MatchWorld.ts';
import type { System } from './System.ts';

/**
 * Дверь выхода, ключи и записка (все двери видны сразу):
 * - игрок подбирает ключ или записку, подойдя к ним;
 * - обычная дверь: удержание `E` у двери 3 с открывает её;
 * - запертая: нужно вставить все её ключи (1–3) — игрок с ключом в руке
 *   (слот 3) удерживает `E` 3 с и вставляет все свои ключи; ключи могут быть
 *   у разных игроков; когда вставлены все, дверь открывается;
 * - с панелью: код из записки вводят на панели у двери; неверный код — пауза;
 * - отпустил `E` или отошёл — прогресс сбрасывается;
 * - после открытия есть 30 с: игрок у двери нажимает `E` и попадает в тамбур;
 *   вошли оба — переход, не успели — конец партии.
 */
export class ExitSystem implements System {
  /** Допуск сравнения времени: сумма шагов по 0.05 с даёт 2.9999… вместо 3. */
  private static readonly TIME_EPSILON = 1e-6;
  /** Запас расстояния для панели: пока набираешь код, можно чуть отступить, м. */
  private static readonly PANEL_SLACK = 0.5;

  public constructor(
    private readonly exitSettings: ExitSettings = GameConfig.exit,
    private readonly matchSettings: MatchSettings = GameConfig.match,
  ) {}

  public update(world: MatchWorld, deltaSeconds: number): void {
    if (world.phase === 'playing' && world.over === null) {
      const active = [...world.players.values()].filter((player) => !player.inTambour);
      this.pickUpKeys(world, active);
      this.pickUpNote(world, active);
      world.exit.codeCooldown = Math.max(0, world.exit.codeCooldown - deltaSeconds);
      if (!world.exit.open) this.checkCodes(world, active);
      if (world.exit.open) {
        this.updateOpenDoor(world, active, deltaSeconds);
      } else {
        this.updateOpening(world, active, deltaSeconds);
      }
    }
    world.players.forEach((player) => {
      player.interactPressed = false;
      player.pendingCode = null;
    });
  }

  private pickUpKeys(world: MatchWorld, active: readonly ServerPlayer[]): void {
    world.space.keys.forEach((key, index) => {
      if (world.exit.keysTaken.has(index)) {
        return;
      }
      const finder = this.finderOf(key, world.space.keyFloors[index] ?? 0, active);
      if (finder) {
        world.exit.keysTaken.add(index);
        finder.keys += 1;
      }
    });
  }

  private pickUpNote(world: MatchWorld, active: readonly ServerPlayer[]): void {
    const note = world.space.note;
    // Магнитофон не подбирают — он стоит на месте и повторяет код вслух.
    if (!note || world.space.codeHint !== 'note' || world.exit.noteHolderId !== null) {
      return;
    }
    const finder = this.finderOf(note, world.space.noteFloor, active);
    if (finder) {
      world.exit.noteHolderId = finder.id;
    }
  }

  private finderOf(
    point: Vector2,
    floor: number,
    active: readonly ServerPlayer[],
  ): ServerPlayer | undefined {
    return active.find(
      (player) =>
        player.floor === floor &&
        player.position.distanceTo(point) <= this.exitSettings.keyPickupDistance,
    );
  }

  /** Коды, введённые на панели: верный открывает дверь, неверный — пауза. */
  private checkCodes(world: MatchWorld, active: readonly ServerPlayer[]): void {
    const code = world.space.code;
    const exit = world.exit;
    for (const player of active) {
      const entered = player.pendingCode;
      if (!entered || !code || world.space.exit.kind !== 'code' || exit.open) {
        continue;
      }
      // Ввод — только у самой панели и не чаще раза в `codeCooldownSeconds`.
      if (!this.isNearDoor(world, player, ExitSystem.PANEL_SLACK) || exit.codeCooldown > 0) {
        continue;
      }
      if (code.matches(entered)) {
        this.openDoor(world);
      } else {
        exit.codeFailures += 1;
        exit.codeCooldown = this.exitSettings.codeCooldownSeconds;
      }
    }
  }

  private updateOpening(
    world: MatchWorld,
    active: readonly ServerPlayer[],
    deltaSeconds: number,
  ): void {
    const exit = world.exit;
    const kind = world.space.exit.kind;
    // Гусь-призрак открывает любую дверь: с гусем на спине нажать E у двери.
    const goose = world.goose;
    if (goose && !goose.gone && goose.holderId !== null) {
      const holder = world.players.get(goose.holderId);
      if (
        holder &&
        holder.interactPressed &&
        !holder.aimingAtPartner &&
        this.isNearDoor(world, holder)
      ) {
        goose.gone = true;
        goose.holderId = null;
        this.openDoor(world);
        return;
      }
    }
    // Дверь с панелью открывают кодом, а не удержанием `E`.
    const canOpen = (player: ServerPlayer): boolean =>
      kind !== 'code' &&
      player.interacting &&
      !player.aimingAtPartner &&
      this.isNearDoor(world, player) &&
      (kind !== 'locked' || (player.item === 'key' && player.keys > 0));

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
    if (exit.openSeconds + ExitSystem.TIME_EPSILON < this.exitSettings.openSeconds) {
      return;
    }
    exit.openerId = null;
    exit.openSeconds = 0;
    if (kind === 'locked') {
      // Игрок вставил все свои ключи; дверь откроется, когда вставлены все.
      exit.keysInserted += opener.keys;
      opener.keys = 0;
      if (exit.keysInserted < world.space.keys.length) {
        return;
      }
    }
    this.openDoor(world);
  }

  private openDoor(world: MatchWorld): void {
    const exit = world.exit;
    exit.open = true;
    exit.openerId = null;
    exit.openSeconds = 0;
    exit.secondsLeft = this.exitSettings.timerSeconds;
    // Удержание `E` не должно сразу завести открывшего в тамбур — нужно новое нажатие.
    world.players.forEach((player) => (player.interactPressed = false));
  }

  private updateOpenDoor(
    world: MatchWorld,
    active: readonly ServerPlayer[],
    deltaSeconds: number,
  ): void {
    for (const player of active) {
      if (player.interactPressed && !player.aimingAtPartner && this.isNearDoor(world, player)) {
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

  private isNearDoor(world: MatchWorld, player: ServerPlayer, slack = 0): boolean {
    return (
      player.floor === world.space.exitFloor &&
      world.space.exit.reachableFrom(player.position, this.exitSettings.interactDistance + slack)
    );
  }
}
