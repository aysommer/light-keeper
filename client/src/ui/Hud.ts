/**
 * Минимальный интерфейс поверх 3D-сцены: прицел и пауза с подсказкой управления.
 * Номер пространства показывается только при переходе (см. TransitionOverlay).
 */
export class Hud {
  public readonly element: HTMLElement;
  private readonly overlay: HTMLElement;

  public constructor(onExit: () => void) {
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
        мышь — смотреть · <kbd>E</kbd> — дверь, обмен · <kbd>R</kbd> — заправить · <kbd>1</kbd> — лампа · <kbd>2</kbd> — компас ·
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
    hint.append(exit);
    this.overlay.append(hint);

    this.element.append(crosshair, this.overlay);
  }

  public setPointerLocked(locked: boolean): void {
    this.overlay.hidden = locked;
  }
}
