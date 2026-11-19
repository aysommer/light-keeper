import type { PlayerColor } from '@light-keeper/shared';

/** Игровой интерфейс поверх 3D-сцены: дистанция, прицел, подсказка управления. */
export class Hud {
  private static readonly COLOR_LABELS: Record<PlayerColor, string> = {
    red: 'Ты — красный',
    blue: 'Ты — голубой',
  };

  public readonly element: HTMLElement;
  private readonly spaceLabel: HTMLElement;
  private readonly overlay: HTMLElement;
  private readonly network: HTMLElement;
  private lastShownSpace = -1;
  private lastNetworkText = '';

  public constructor(seed: number, color: PlayerColor, onExit: () => void) {
    this.element = document.createElement('div');
    this.element.className = 'hud';

    this.spaceLabel = document.createElement('div');
    this.spaceLabel.className = 'hud__space';

    const seedLabel = document.createElement('div');
    seedLabel.className = 'hud__seed';
    seedLabel.textContent = `seed ${seed}`;

    this.network = document.createElement('div');
    this.network.className = 'hud__network';

    const crosshair = document.createElement('div');
    crosshair.className = 'hud__crosshair';

    this.overlay = document.createElement('div');
    this.overlay.className = 'hud__overlay';
    const hint = document.createElement('div');
    hint.className = 'hud__hint';
    hint.innerHTML = `
      <p class="hud__hint-title">Кликни, чтобы осмотреться</p>
      <p><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> — идти · <kbd>Shift</kbd> — бежать ·
        мышь — смотреть · <kbd>E</kbd> — дверь · <kbd>Esc</kbd> — пауза</p>
    `;
    const exit = document.createElement('button');
    exit.type = 'button';
    exit.className = 'button button--ghost';
    exit.textContent = 'Выйти в меню';
    exit.addEventListener('click', (event) => {
      event.stopPropagation();
      onExit();
    });
    hint.append(exit);
    this.overlay.append(hint);

    this.element.append(this.spaceLabel, this.network, seedLabel, crosshair, this.overlay);
    const chip = document.createElement('div');
    chip.className = `hud__player hud__player--${color}`;
    chip.textContent = Hud.COLOR_LABELS[color];
    this.element.append(chip);
    this.setSpace(0);
  }

  /** Номер текущего пространства (0 — первое); показываем с единицы. */
  public setSpace(index: number): void {
    if (index !== this.lastShownSpace) {
      this.lastShownSpace = index;
      this.spaceLabel.textContent = `Пространство ${index + 1}`;
    }
  }

  /** Пинг и расстояние до напарника. */
  public setNetworkInfo(pingMs: number | null, partnerMeters: number | null): void {
    const partner =
      partnerMeters === null ? 'напарник: —' : `напарник: ${partnerMeters.toFixed(0)} м`;
    const ping = pingMs === null ? '' : ` · пинг ${pingMs} мс`;
    const text = partner + ping;
    if (text !== this.lastNetworkText) {
      this.lastNetworkText = text;
      this.network.textContent = text;
    }
  }

  public setPointerLocked(locked: boolean): void {
    this.overlay.hidden = locked;
  }
}
