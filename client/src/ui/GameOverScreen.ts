import type { MatchOverReason } from '@light-keeper/shared';
import type { Screen } from './Screen.ts';

/** Конец партии: почему и сколько пространств пройдено. Полная версия — на этапе 12. */
export class GameOverScreen implements Screen {
  private static readonly REASONS: Record<MatchOverReason, string> = {
    door_timeout: 'Не все успели войти в дверь.',
    ghost_caught: 'Привидение настигло одного из вас.',
  };

  public readonly element: HTMLElement;

  public constructor(reason: MatchOverReason, spacesCleared: number, onBack: () => void) {
    this.element = document.createElement('main');
    this.element.className = 'game-over-screen';

    const title = document.createElement('h1');
    title.className = 'game-over-screen__title';
    title.textContent = 'Игра окончена';

    const why = document.createElement('p');
    why.className = 'game-over-screen__reason';
    why.textContent = GameOverScreen.REASONS[reason];

    const score = document.createElement('p');
    score.className = 'game-over-screen__score';
    score.innerHTML = `Пройдено пространств: <strong>${spacesCleared}</strong>`;

    const back = document.createElement('button');
    back.type = 'button';
    back.className = 'button';
    back.textContent = 'Вернуться в комнату';
    back.addEventListener('click', onBack);

    this.element.append(title, why, score, back);
  }

  public mount(): void {}

  public dispose(): void {}
}
