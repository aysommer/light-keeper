import type { MatchWorld } from '../game/MatchWorld.ts';
import type { System } from './System.ts';

/**
 * Гусь-призрак: убегает от игроков своего этажа по лабиринту — быстрее шага,
 * но медленнее бега, поэтому его можно загнать в угол. Коснулся — пойман:
 * гусь сидит у игрока на спине и путешествует с ним. Открывают им дверь в ExitSystem.
 */
export class GooseSystem implements System {
  public static readonly SPEED = 3.3;
  /** Насколько близко надо подбежать, чтобы поймать, м. */
  public static readonly CATCH_DISTANCE = 0.8;

  public update(world: MatchWorld, deltaSeconds: number): void {
    const goose = world.goose;
    if (!goose || goose.gone || world.phase !== 'playing' || world.over !== null) {
      return;
    }
    if (goose.holderId !== null) {
      const holder = world.players.get(goose.holderId);
      if (holder) {
        goose.position = holder.position;
        goose.floor = holder.floor;
      }
      return;
    }
    const hunters = [...world.players.values()].filter(
      (player) => !player.inTambour && player.floor === goose.floor,
    );
    const catcher = hunters.find(
      (player) => player.position.distanceTo(goose.position) <= GooseSystem.CATCH_DISTANCE,
    );
    if (catcher) {
      goose.holderId = catcher.id;
      return;
    }
    if (hunters.length > 0) {
      // Поле путей этажа ведёт к игрокам — гусь бежит по нему прочь.
      goose.position = world.ghostPopulation
        .fieldOn(goose.floor)
        .step(goose.position, GooseSystem.SPEED * deltaSeconds, true);
    }
  }
}
