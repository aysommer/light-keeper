import {
  GameConfig,
  GhostRules,
  NavigationField,
  SeededRandom,
  SeedHasher,
} from '@light-keeper/shared';
import type { GhostSettings, Space, Vector2 } from '@light-keeper/shared';
import { Ghost } from '../entities/Ghost.ts';

/**
 * Привидения текущего пространства: кто сейчас бродит, когда придёт следующее,
 * поле путей по лабиринту к игрокам.
 */
export class GhostPopulation {
  public readonly ghosts: Ghost[] = [];
  public readonly field: NavigationField;
  public readonly rules: GhostRules;
  /** Через сколько секунд придёт следующее привидение. */
  public nextSpawnIn: number;
  /** Сколько секунд до пересчёта поля путей. */
  public fieldRefreshIn = 0;
  private readonly rng: SeededRandom;
  private nextId = 1;

  public constructor(
    public readonly space: Space,
    matchSeed: number,
    private readonly settings: GhostSettings = GameConfig.ghosts,
  ) {
    this.rules = new GhostRules(settings);
    this.field = new NavigationField(space, settings.radius);
    this.nextSpawnIn = this.rules.firstDelay(space.index);
    this.rng = new SeededRandom(SeedHasher.hash(matchSeed, 'ghosts', space.index));
  }

  public get spaceIndex(): number {
    return this.space.index;
  }

  /**
   * Привидение появляется в случайной клетке не ближе `spawnMinDistance`
   * к игрокам (по лабиринту), а если таких нет — в самой дальней.
   * Поле путей должно быть посчитано от текущих позиций игроков.
   */
  public spawnFar(): Ghost | null {
    const minSteps = Math.ceil(this.settings.spawnMinDistance / this.field.resolution);
    const cells = this.field.cellsFartherThan(minSteps);
    const position = cells.length > 0 ? this.rng.pick(cells) : this.field.farthestCell();
    return position ? this.add(position) : null;
  }

  public add(position: Vector2): Ghost {
    const ghost = new Ghost(this.nextId++, position);
    this.ghosts.push(ghost);
    return ghost;
  }

  public remove(ghost: Ghost): void {
    const index = this.ghosts.indexOf(ghost);
    if (index >= 0) this.ghosts.splice(index, 1);
  }
}
