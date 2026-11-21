import { GameConfig } from '@light-keeper/shared';
import type { GhostSettings, Vector2 } from '@light-keeper/shared';
import type { Ghost } from '../entities/Ghost.ts';
import type { ServerPlayer } from '../entities/ServerPlayer.ts';
import type { MatchWorld } from '../game/MatchWorld.ts';
import type { System } from './System.ts';

/** Источник света, отгоняющий привидения: горящая лампа в руке игрока. */
interface LightSource {
  readonly position: Vector2;
  readonly floor: number;
  readonly radius: number;
}

/**
 * Привидения: появление по расписанию, движение к игрокам по лабиринту,
 * отступление из света и растворение, поимка игрока.
 */
export class GhostSystem implements System {
  public constructor(private readonly settings: GhostSettings = GameConfig.ghosts) {}

  public update(world: MatchWorld, deltaSeconds: number): void {
    if (world.phase !== 'playing' || world.over !== null) {
      return;
    }
    const population = world.ghostPopulation;
    const targets = [...world.players.values()].filter((player) => !player.inTambour);
    if (targets.length === 0) {
      return;
    }

    // Поле путей каждого этажа ведёт к игрокам на этом этаже.
    const onFloor = (floor: number): ServerPlayer[] =>
      targets.filter((player) => player.floor === floor);
    population.fieldRefreshIn -= deltaSeconds;
    if (population.fieldRefreshIn <= 0) {
      population.fields.forEach((field, floor) => {
        const here = onFloor(floor);
        if (here.length > 0) field.computeFrom(here.map((player) => player.position));
      });
      population.fieldRefreshIn = this.settings.fieldRefreshSeconds;
    }

    this.spawn(world, deltaSeconds, targets);

    const lights = this.lights(world, targets);
    const speed = population.rules.speed(world.spaceIndex);
    for (const ghost of [...population.ghosts]) {
      if (ghost.fadeLeft !== null) {
        ghost.fadeLeft -= deltaSeconds;
        if (ghost.fadeLeft <= 0) population.remove(ghost);
        continue;
      }
      const field = population.fieldOn(ghost.floor);
      const lit = lights.some(
        (light) =>
          light.floor === ghost.floor && light.position.distanceTo(ghost.position) < light.radius,
      );
      if (lit) {
        ghost.exposure += deltaSeconds;
        ghost.position = field.step(
          ghost.position,
          this.settings.retreatSpeed * deltaSeconds,
          true,
        );
        if (ghost.exposure >= this.settings.dissolveSeconds) {
          ghost.fadeLeft = this.settings.fadeSeconds;
        }
        continue;
      }
      ghost.exposure = Math.max(0, ghost.exposure - deltaSeconds * 0.5);
      // Игроков на этаже нет — привидение ждёт на месте.
      const prey = onFloor(ghost.floor);
      if (prey.length === 0) continue;
      ghost.position = field.step(ghost.position, speed * deltaSeconds);
      if (this.catches(ghost, prey)) {
        world.finish('ghost_caught');
        return;
      }
    }
  }

  private spawn(world: MatchWorld, deltaSeconds: number, targets: readonly ServerPlayer[]): void {
    const population = world.ghostPopulation;
    population.nextSpawnIn -= deltaSeconds;
    if (population.nextSpawnIn > 0) {
      return;
    }
    population.nextSpawnIn = population.rules.interval(world.spaceIndex);
    const active = population.ghosts.filter((ghost) => !ghost.fading).length;
    if (active < population.rules.maxConcurrent(world.spaceIndex)) {
      // Привидение приходит на этаж случайного из игроков.
      const target = targets[population.pickIndex(targets.length)];
      population.spawnFar(target?.floor ?? 0);
    }
  }

  private lights(world: MatchWorld, players: readonly ServerPlayer[]): LightSource[] {
    return players
      .filter((player) => player.lampShining)
      .map((player) => ({
        position: player.position,
        floor: player.floor,
        radius: world.ghostPopulation.rules.lightRadius(player.lightBrightness, world.spaceIndex),
      }));
  }

  private catches(ghost: Ghost, players: readonly ServerPlayer[]): boolean {
    return players.some(
      (player) => player.position.distanceTo(ghost.position) <= this.settings.catchDistance,
    );
  }
}
