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
  /** Поля путей по этажам. */
  public readonly fields: NavigationField[];
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
    this.fields = space.floors.map(
      (_, floor) => new NavigationField(space, settings.radius, 0.5, floor),
    );
    this.nextSpawnIn = this.rules.firstDelay(space.index);
    this.rng = new SeededRandom(SeedHasher.hash(matchSeed, 'ghosts', space.index));
  }

  /** Поле путей первого этажа. */
  public get field(): NavigationField {
    return this.fields[0]!;
  }

  /** Поле путей этажа. */
  public fieldOn(floor: number): NavigationField {
    return this.fields[floor] ?? this.fields[0]!;
  }

  public get spaceIndex(): number {
    return this.space.index;
  }

  /**
   * Привидение появляется на этаже `floor` в случайной клетке не ближе
   * `spawnMinDistance` к игрокам этого этажа (по лабиринту), а если таких нет —
   * в самой дальней. Поле путей этажа должно быть посчитано от игроков на нём.
   */
  public spawnFar(floor = 0): Ghost | null {
    const field = this.fieldOn(floor);
    const minSteps = Math.ceil(this.settings.spawnMinDistance / field.resolution);
    const cells = field.cellsFartherThan(minSteps);
    const position = cells.length > 0 ? this.rng.pick(cells) : field.farthestCell();
    return position ? this.add(position, floor) : null;
  }

  /** Случайный номер из `count` (для выбора этажа появления). */
  public pickIndex(count: number): number {
    return this.rng.int(0, Math.max(0, count - 1));
  }

  public add(position: Vector2, floor = 0): Ghost {
    const ghost = new Ghost(this.nextId++, position, floor);
    this.ghosts.push(ghost);
    return ghost;
  }

  public remove(ghost: Ghost): void {
    const index = this.ghosts.indexOf(ghost);
    if (index >= 0) this.ghosts.splice(index, 1);
  }
}
