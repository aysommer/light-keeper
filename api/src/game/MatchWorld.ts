import { ChunkGenerator, CollisionWorld, WorldLayout } from '@light-keeper/shared';
import type { ServerPlayer } from '../entities/ServerPlayer.ts';

/** Состояние мира одной партии: генератор, коллизии, игроки, прогресс. */
export class MatchWorld {
  public readonly generator: ChunkGenerator;
  public readonly layout: WorldLayout;
  public readonly collisions: CollisionWorld;
  public readonly players = new Map<string, ServerPlayer>();
  private readonly startY: number;
  private farthestY: number;

  public constructor(public readonly seed: number) {
    this.generator = new ChunkGenerator(seed);
    this.layout = new WorldLayout(this.generator, 12);
    this.collisions = new CollisionWorld(this.layout);
    this.startY = this.generator.startPositions()[0].y;
    this.farthestY = this.startY;
  }

  /** Пройденное командой расстояние — по самому далеко продвинувшемуся игроку, м. */
  public get distance(): number {
    return Math.max(0, this.farthestY - this.startY);
  }

  public recordProgress(y: number): void {
    this.farthestY = Math.max(this.farthestY, y);
  }
}
