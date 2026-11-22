import type { MatchWorld } from '../game/MatchWorld.ts';
import type { System } from './System.ts';

/**
 * Гусь-призрак: убегает от игроков своего этажа по лабиринту — быстрее шага,
 * но медленнее бега, поэтому его можно загнать в угол. Коснулся — пойман:
 * гуся несут в руках (слот гуся), другие предметы взять нельзя — сменил слот,
 * и гусь вырвался: лови заново. Открывают им дверь в ExitSystem.
 */
export class GooseSystem implements System {
  public static readonly SPEED = 3.3;
  /** Насколько близко надо подбежать, чтобы поймать, м. */
  public static readonly CATCH_DISTANCE = 0.8;
  /** Сколько ждать, пока поймавший возьмёт гуся в руки (задержка сети), с. */
  public static readonly GRAB_GRACE = 1.5;
  /** Сколько вырвавшегося гуся нельзя поймать снова, с. */
  public static readonly SLIPPERY = 1.5;

  public update(world: MatchWorld, deltaSeconds: number): void {
    const goose = world.goose;
    if (!goose || goose.gone || world.phase !== 'playing' || world.over !== null) {
      return;
    }
    goose.slipperySeconds = Math.max(0, goose.slipperySeconds - deltaSeconds);
    if (goose.holderId !== null) {
      const holder = world.players.get(goose.holderId);
      if (holder) {
        goose.position = holder.position;
        goose.floor = holder.floor;
        if (holder.item === 'goose') {
          goose.inHands = true;
        }
        goose.graceSeconds = Math.max(0, goose.graceSeconds - deltaSeconds);
        // Взял другой предмет (или так и не взял гуся в руки) — гусь вырвался.
        const letGo = goose.inHands ? holder.item !== 'goose' : goose.graceSeconds <= 0;
        if (!letGo) {
          return;
        }
      }
      goose.release(GooseSystem.SLIPPERY);
    }
    const hunters = [...world.players.values()].filter(
      (player) => !player.inTambour && player.floor === goose.floor,
    );
    const catcher =
      goose.slipperySeconds > 0
        ? undefined
        : hunters.find(
            (player) => player.position.distanceTo(goose.position) <= GooseSystem.CATCH_DISTANCE,
          );
    if (catcher) {
      goose.catchBy(catcher.id, GooseSystem.GRAB_GRACE);
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
