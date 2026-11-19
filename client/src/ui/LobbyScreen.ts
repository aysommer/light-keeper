import { PLAYER_COLORS } from '@light-keeper/shared';
import type { LobbySnapshot, PlayerColor } from '@light-keeper/shared';
import type { Screen } from './Screen.ts';
import { StickmanIcon } from './StickmanIcon.ts';

export interface LobbyScreenActions {
  onReady(ready: boolean): void;
  onLeave(): void;
}

/** Комната ожидания: код, два слота игроков, готовность и обратный отсчёт. */
export class LobbyScreen implements Screen {
  private static readonly COLOR_NAMES: Record<PlayerColor, string> = {
    red: 'Красный',
    blue: 'Голубой',
  };

  public readonly element: HTMLElement;
  private readonly code: HTMLElement;
  private readonly slots = new Map<PlayerColor, HTMLElement>();
  private readonly readyButton: HTMLButtonElement;
  private readonly status: HTMLElement;
  private readonly notice: HTMLElement;
  private isReady = false;

  public constructor(
    private readonly playerId: string,
    snapshot: LobbySnapshot,
    actions: LobbyScreenActions,
  ) {
    this.element = document.createElement('main');
    this.element.className = 'lobby-screen';

    const heading = document.createElement('p');
    heading.className = 'lobby-screen__label';
    heading.textContent = 'Код комнаты — продиктуй его напарнику';

    this.code = document.createElement('button');
    this.code.className = 'lobby-screen__code';
    this.code.title = 'Скопировать';
    this.code.addEventListener('click', () => void this.copyCode());

    const slots = document.createElement('div');
    slots.className = 'lobby-screen__slots';
    for (const color of PLAYER_COLORS) {
      const slot = document.createElement('div');
      slot.className = `lobby-slot lobby-slot--${color}`;
      slot.append(new StickmanIcon(color, color === 'blue').element);
      const caption = document.createElement('div');
      caption.className = 'lobby-slot__caption';
      slot.append(caption);
      slots.append(slot);
      this.slots.set(color, slot);
    }

    this.status = document.createElement('p');
    this.status.className = 'lobby-screen__status';
    this.status.setAttribute('aria-live', 'polite');

    this.notice = document.createElement('p');
    this.notice.className = 'lobby-screen__notice';
    this.notice.hidden = true;

    this.readyButton = document.createElement('button');
    this.readyButton.type = 'button';
    this.readyButton.className = 'button';
    this.readyButton.addEventListener('click', () => actions.onReady(!this.isReady));

    const leave = document.createElement('button');
    leave.type = 'button';
    leave.className = 'button button--ghost-dark';
    leave.textContent = 'Выйти';
    leave.addEventListener('click', () => actions.onLeave());

    const controls = document.createElement('div');
    controls.className = 'lobby-screen__controls';
    controls.append(this.readyButton, leave);

    this.element.append(heading, this.code, slots, this.status, this.notice, controls);
    this.update(snapshot);
  }

  public mount(): void {}

  public dispose(): void {}

  public update(snapshot: LobbySnapshot): void {
    this.code.textContent = snapshot.code;
    for (const color of PLAYER_COLORS) {
      const slot = this.slots.get(color);
      const player = snapshot.players.find((candidate) => candidate.color === color);
      const caption = slot?.querySelector('.lobby-slot__caption');
      if (!slot || !caption) continue;
      slot.classList.toggle('lobby-slot--empty', !player);
      slot.classList.toggle('lobby-slot--ready', player?.ready ?? false);
      const who = player?.id === this.playerId ? 'Ты' : LobbyScreen.COLOR_NAMES[color];
      caption.textContent = player
        ? `${who} · ${player.ready ? 'готов' : 'не готов'}`
        : 'Ждём напарника…';
    }

    const me = snapshot.players.find((player) => player.id === this.playerId);
    this.isReady = me?.ready ?? false;
    this.readyButton.textContent = this.isReady ? 'Не готов' : 'Готов';
    this.readyButton.disabled = snapshot.players.length < 2;
    this.status.textContent = this.statusText(snapshot);
  }

  public showNotice(text: string): void {
    this.notice.textContent = text;
    this.notice.hidden = false;
  }

  private statusText(snapshot: LobbySnapshot): string {
    if (snapshot.status === 'in_game') {
      return 'Начинаем!';
    }
    if (snapshot.status === 'countdown') {
      return `Старт через ${snapshot.countdownSeconds ?? 0}…`;
    }
    if (snapshot.players.length < 2) {
      return 'Ждём, пока напарник войдёт по коду.';
    }
    return 'Когда оба нажмут «Готов» — начнём.';
  }

  private async copyCode(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.code.textContent ?? '');
      this.code.classList.add('lobby-screen__code--copied');
      setTimeout(() => this.code.classList.remove('lobby-screen__code--copied'), 800);
    } catch {
      // Буфер обмена недоступен (например, не HTTPS) — код и так виден.
    }
  }
}
