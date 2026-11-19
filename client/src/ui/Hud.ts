import type { PlayerColor } from '@light-keeper/shared';

/** Игровой интерфейс поверх 3D-сцены: дистанция, прицел, подсказка управления. */
export class Hud {
  private static readonly COLOR_LABELS: Record<PlayerColor, string> = {
    red: 'Ты — красный',
    blue: 'Ты — голубой',
  };

  public readonly element: HTMLElement;
  private readonly distance: HTMLElement;
  private readonly overlay: HTMLElement;
  private lastShownMeters = -1;

  public constructor(seed: number, color: PlayerColor | null, onExit: () => void) {
    this.element = document.createElement('div');
    this.element.className = 'hud';

    this.distance = document.createElement('div');
    this.distance.className = 'hud__distance';

    const seedLabel = document.createElement('div');
    seedLabel.className = 'hud__seed';
    seedLabel.textContent = `seed ${seed}`;

    const crosshair = document.createElement('div');
    crosshair.className = 'hud__crosshair';

    this.overlay = document.createElement('div');
    this.overlay.className = 'hud__overlay';
    const hint = document.createElement('div');
    hint.className = 'hud__hint';
    hint.innerHTML = `
      <p class="hud__hint-title">Кликни, чтобы осмотреться</p>
      <p><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> — идти · <kbd>Shift</kbd> — бежать ·
        мышь — смотреть · <kbd>Esc</kbd> — пауза</p>
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

    this.element.append(this.distance, seedLabel, crosshair, this.overlay);
    if (color) {
      const chip = document.createElement('div');
      chip.className = `hud__player hud__player--${color}`;
      chip.textContent = Hud.COLOR_LABELS[color];
      this.element.append(chip);
    }
    this.setDistance(0);
  }

  public setDistance(meters: number): void {
    const rounded = Math.floor(meters);
    if (rounded !== this.lastShownMeters) {
      this.lastShownMeters = rounded;
      this.distance.textContent = `${rounded} м`;
    }
  }

  public setPointerLocked(locked: boolean): void {
    this.overlay.hidden = locked;
  }
}
