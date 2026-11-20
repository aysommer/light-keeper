import { GameConfig } from '@light-keeper/shared';

/**
 * Состояние лампы без цифр: тёплая дымка по краям экрана при сильном нагреве
 * (пульсирует, когда перегрев близко) и короткая подсказка внизу.
 */
export class LampHud {
  /** С какого нагрева (%) появляется дымка. */
  private static readonly VIGNETTE_FROM = 55;

  public readonly element: HTMLElement;
  private readonly vignette: HTMLElement;
  private readonly hint: HTMLElement;

  public constructor() {
    this.element = document.createElement('div');
    this.element.className = 'lamp-hud';
    this.vignette = document.createElement('div');
    this.vignette.className = 'lamp-hud__vignette';
    this.hint = document.createElement('div');
    this.hint.className = 'lamp-hud__hint';
    this.hint.setAttribute('role', 'status');
    this.element.append(this.vignette, this.hint);
    this.update(0, null);
  }

  public update(heat: number, hint: string | null): void {
    const share = Math.min(
      1,
      Math.max(0, (heat - LampHud.VIGNETTE_FROM) / (100 - LampHud.VIGNETTE_FROM)),
    );
    this.vignette.style.opacity = (share * 0.75).toFixed(3);
    this.vignette.classList.toggle(
      'lamp-hud__vignette--pulse',
      heat >= GameConfig.lamp.warningHeat,
    );
    if (this.hint.textContent !== (hint ?? '')) {
      this.hint.textContent = hint ?? '';
    }
    this.hint.hidden = hint === null;
  }
}
