import type { LobbySnapshot, MatchOverReason, RecordEntry } from '@light-keeper/shared';
import { TimeFormat } from '../core/TimeFormat.ts';
import { RecordsTable } from './RecordsTable.ts';
import type { Screen } from './Screen.ts';

export interface GameOverResult {
  readonly reason: MatchOverReason;
  readonly spacesCleared: number;
  readonly elapsedSeconds: number;
  readonly place: number | null;
  readonly records: readonly RecordEntry[];
}

export interface GameOverActions {
  /** Снова в бой с тем же напарником. */
  onPlayAgain(): void;
  /** Напарник ушёл — вернуться в комнату и ждать нового. */
  onBackToRoom(): void;
  onExit(): void;
}

/**
 * Конец партии: причина, пройдено пространств, время, место в рекордах.
 * «Сыграть ещё раз» — готовность в той же комнате: когда готовы оба, начинается
 * новая партия. Здесь же видно, готов ли напарник.
 */
export class GameOverScreen implements Screen {
  private static readonly REASONS: Record<MatchOverReason, string> = {
    door_timeout: 'Не все успели войти в дверь.',
    ghost_caught: 'Привидение настигло одного из вас.',
  };

  public readonly element: HTMLElement;
  private readonly status: HTMLElement;
  private readonly playAgain: HTMLButtonElement;
  private readyPressed = false;
  private partnerGone = false;

  public constructor(
    private readonly playerId: string,
    result: GameOverResult,
    private readonly actions: GameOverActions,
  ) {
    this.element = document.createElement('main');
    this.element.className = 'game-over-screen';

    const title = document.createElement('h1');
    title.className = 'game-over-screen__title';
    title.textContent = 'Игра окончена';

    const why = document.createElement('p');
    why.className = 'game-over-screen__reason';
    why.textContent = GameOverScreen.REASONS[result.reason];

    const stats = document.createElement('div');
    stats.className = 'game-over-screen__stats';
    stats.append(
      this.stat('Пройдено', TimeFormat.spaces(result.spacesCleared)),
      this.stat('Время', TimeFormat.duration(result.elapsedSeconds)),
    );

    const badge = document.createElement('p');
    badge.className = 'game-over-screen__badge';
    badge.textContent =
      result.place === 1
        ? 'Новый рекорд!'
        : result.place !== null
          ? `Место в таблице рекордов: ${result.place}`
          : result.spacesCleared === 0
            ? 'В рекорды попадают партии хотя бы с одним пройденным пространством.'
            : 'В таблицу рекордов не попали — в следующий раз!';
    badge.classList.toggle('game-over-screen__badge--record', result.place === 1);

    const records = new RecordsTable();
    records.update(result.records, result.place);

    this.status = document.createElement('p');
    this.status.className = 'game-over-screen__status';
    this.status.setAttribute('aria-live', 'polite');

    this.playAgain = this.button('Сыграть ещё раз', () => this.handlePlayAgain());
    const exit = this.button('В меню', () => actions.onExit(), 'button--ghost-light');
    const controls = document.createElement('div');
    controls.className = 'game-over-screen__controls';
    controls.append(this.playAgain, exit);

    this.element.append(title, why, stats, badge, this.status, controls, records.element);
  }

  public mount(): void {}

  public dispose(): void {}

  /** Состояние комнаты: готов ли напарник, отсчёт, не ушёл ли он. */
  public updateLobby(snapshot: LobbySnapshot): void {
    const partner = snapshot.players.find((player) => player.id !== this.playerId);
    this.partnerGone = !partner;
    if (!partner) {
      this.setStatus('Напарник вышел из комнаты.');
      this.playAgain.textContent = 'Вернуться в комнату';
      this.playAgain.disabled = false;
      return;
    }
    if (snapshot.status === 'countdown') {
      this.setStatus(`Старт через ${snapshot.countdownSeconds ?? 0}…`);
    } else if (partner.ready && this.readyPressed) {
      this.setStatus('Оба готовы — начинаем…');
    } else if (partner.ready) {
      this.setStatus('Напарник хочет сыграть ещё раз.');
    } else if (this.readyPressed) {
      this.setStatus('Ждём напарника…');
    } else {
      this.setStatus(null);
    }
  }

  private handlePlayAgain(): void {
    if (this.partnerGone) {
      this.actions.onBackToRoom();
      return;
    }
    this.readyPressed = true;
    this.playAgain.disabled = true;
    this.setStatus('Ждём напарника…');
    this.actions.onPlayAgain();
  }

  private setStatus(text: string | null): void {
    this.status.textContent = text ?? '';
    this.status.hidden = text === null;
  }

  private stat(label: string, value: string): HTMLElement {
    const element = document.createElement('div');
    element.className = 'game-over-screen__stat';
    const name = document.createElement('span');
    name.className = 'game-over-screen__stat-label';
    name.textContent = label;
    const number = document.createElement('strong');
    number.className = 'game-over-screen__stat-value';
    number.textContent = value;
    element.append(name, number);
    return element;
  }

  private button(label: string, onClick: () => void, modifier = ''): HTMLButtonElement {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `button ${modifier}`.trim();
    button.textContent = label;
    button.addEventListener('click', onClick);
    return button;
  }
}
