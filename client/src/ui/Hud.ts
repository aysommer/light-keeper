/**
 * Минимальный интерфейс поверх 3D-сцены: прицел и пауза с подсказкой управления.
 * Номер пространства показывается только при переходе (см. TransitionOverlay).
 */
export class Hud {
  public readonly element: HTMLElement;
  private readonly overlay: HTMLElement;
  private readonly sound: HTMLElement;

  public constructor(onExit: () => void, onSettings: () => void) {
    this.element = document.createElement('div');
    this.element.className = 'hud';

    const crosshair = document.createElement('div');
    crosshair.className = 'hud__crosshair';

    this.overlay = document.createElement('div');
    this.overlay.className = 'hud__overlay';
    const hint = document.createElement('div');
    hint.className = 'hud__hint';
    hint.innerHTML = `
      <p class="hud__hint-title">Кликни, чтобы осмотреться</p>
      <p><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> — идти · <kbd>Shift</kbd> — бежать ·
        мышь — смотреть · <kbd>E</kbd> — дверь, обмен · <kbd>R</kbd> — заправить · <kbd>1</kbd> — лампа · <kbd>2</kbd> — компас · <kbd>3</kbd> — ключи · <kbd>4</kbd> — записка · <kbd>M</kbd> — звук ·
        <kbd>Esc</kbd> — пауза</p>
    `;
    const exit = document.createElement('button');
    exit.type = 'button';
    exit.className = 'button button--ghost';
    exit.textContent = 'Выйти в меню';
    exit.addEventListener('click', (event) => {
      event.stopPropagation();
      onExit();
    });
    const settings = document.createElement('button');
    settings.type = 'button';
    settings.className = 'button button--ghost';
    settings.textContent = 'Настройки';
    settings.addEventListener('click', (event) => {
      event.stopPropagation();
      onSettings();
    });
    const buttons = document.createElement('div');
    buttons.className = 'hud__buttons';
    buttons.append(settings, exit);
    hint.append(buttons);
    this.overlay.append(hint);

    this.sound = document.createElement('div');
    this.sound.className = 'hud__sound';
    this.sound.textContent = 'Звук выключен (M)';
    this.sound.hidden = true;

    this.element.append(crosshair, this.sound, this.overlay);
  }

  public setMuted(muted: boolean): void {
    this.sound.hidden = !muted;
  }

  public setPointerLocked(locked: boolean): void {
    this.overlay.hidden = locked;
  }
}
