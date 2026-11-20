import { PLAYER_COLORS } from '@light-keeper/shared';
import type { LobbySnapshot, PlayerColor } from '@light-keeper/shared';
import type { Screen } from './Screen.ts';
import { Clipboard } from '../core/Clipboard.ts';
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
  private readonly copyButton: HTMLButtonElement;
  private copyResetTimer: number | null = null;
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
    heading.textContent = 'Код комнаты — отправь его напарнику';

    this.code = document.createElement('div');
    this.code.className = 'lobby-screen__code';

    this.copyButton = document.createElement('button');
    this.copyButton.type = 'button';
    this.copyButton.className = 'button button--secondary lobby-screen__copy';
    this.copyButton.textContent = 'Скопировать';
    this.copyButton.addEventListener('click', () => void this.copyCode());

    const codeRow = document.createElement('div');
    codeRow.className = 'lobby-screen__code-row';
    codeRow.append(this.code, this.copyButton);

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

    this.element.append(heading, codeRow, slots, this.status, this.notice, controls);
    this.update(snapshot);
  }

  public mount(): void {}

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

  public dispose(): void {
    if (this.copyResetTimer !== null) window.clearTimeout(this.copyResetTimer);
  }

  private async copyCode(): Promise<void> {
    const copied = await Clipboard.copy(this.code.textContent ?? '');
    this.copyButton.textContent = copied ? 'Скопировано ✓' : 'Не вышло — выдели код';
    this.copyButton.classList.toggle('lobby-screen__copy--done', copied);
    this.code.classList.toggle('lobby-screen__code--copied', copied);
    if (this.copyResetTimer !== null) window.clearTimeout(this.copyResetTimer);
    this.copyResetTimer = window.setTimeout(() => {
      this.copyButton.textContent = 'Скопировать';
      this.copyButton.classList.remove('lobby-screen__copy--done');
      this.code.classList.remove('lobby-screen__code--copied');
    }, 1800);
  }
}
