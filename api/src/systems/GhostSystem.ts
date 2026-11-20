import { GameConfig } from '@light-keeper/shared';
import type { GhostSettings, Vector2 } from '@light-keeper/shared';
import type { Ghost } from '../entities/Ghost.ts';
import type { ServerPlayer } from '../entities/ServerPlayer.ts';
import type { MatchWorld } from '../game/MatchWorld.ts';
import type { System } from './System.ts';

/** Источник света, отгоняющий привидения: горящая лампа в руке игрока. */
interface LightSource {
  readonly position: Vector2;
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

    population.fieldRefreshIn -= deltaSeconds;
    if (population.fieldRefreshIn <= 0) {
      population.field.computeFrom(targets.map((player) => player.position));
      population.fieldRefreshIn = this.settings.fieldRefreshSeconds;
    }

    this.spawn(world, deltaSeconds);

    const lights = this.lights(world, targets);
    const speed = population.rules.speed(world.spaceIndex);
    for (const ghost of [...population.ghosts]) {
      if (ghost.fadeLeft !== null) {
        ghost.fadeLeft -= deltaSeconds;
        if (ghost.fadeLeft <= 0) population.remove(ghost);
        continue;
      }
      const lit = lights.some((light) => light.position.distanceTo(ghost.position) < light.radius);
      if (lit) {
        ghost.exposure += deltaSeconds;
        ghost.position = population.field.step(
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
      ghost.position = population.field.step(ghost.position, speed * deltaSeconds);
      if (this.catches(ghost, targets)) {
        world.finish('ghost_caught');
        return;
      }
    }
  }

  private spawn(world: MatchWorld, deltaSeconds: number): void {
    const population = world.ghostPopulation;
    population.nextSpawnIn -= deltaSeconds;
    if (population.nextSpawnIn > 0) {
      return;
    }
    population.nextSpawnIn = population.rules.interval(world.spaceIndex);
    const active = population.ghosts.filter((ghost) => !ghost.fading).length;
    if (active < population.rules.maxConcurrent(world.spaceIndex)) {
      population.spawnFar();
    }
  }

  private lights(world: MatchWorld, players: readonly ServerPlayer[]): LightSource[] {
    return players
      .filter((player) => player.lampShining)
      .map((player) => ({
        position: player.position,
        radius: world.ghostPopulation.rules.lightRadius(player.lamp.brightness, world.spaceIndex),
      }));
  }

  private catches(ghost: Ghost, players: readonly ServerPlayer[]): boolean {
    return players.some(
      (player) => player.position.distanceTo(ghost.position) <= this.settings.catchDistance,
    );
  }
}
