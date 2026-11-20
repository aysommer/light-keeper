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
  private readonly canisters: HTMLElement;
  private readonly ring: SVGSVGElement;
  private readonly ringProgress: SVGCircleElement;
  private readonly circumference = 2 * Math.PI * 22;
  private shownCanisters = -1;

  public constructor() {
    this.element = document.createElement('div');
    this.element.className = 'lamp-hud';
    this.vignette = document.createElement('div');
    this.vignette.className = 'lamp-hud__vignette';
    this.hint = document.createElement('div');
    this.hint.className = 'lamp-hud__hint';
    this.hint.setAttribute('role', 'status');
    this.canisters = document.createElement('div');
    this.canisters.className = 'lamp-hud__canisters';
    this.canisters.setAttribute('aria-label', 'Канистры с маслом');

    const template = document.createElement('template');
    template.innerHTML = `
      <svg class="lamp-hud__ring" viewBox="0 0 60 60" aria-hidden="true">
        <circle class="lamp-hud__ring-track" cx="30" cy="30" r="22" />
        <circle class="lamp-hud__ring-progress" cx="30" cy="30" r="22"
          stroke-dasharray="${this.circumference}" stroke-dashoffset="${this.circumference}" />
      </svg>`.trim();
    this.ring = template.content.firstElementChild as SVGSVGElement;
    this.ringProgress = this.ring.querySelector('.lamp-hud__ring-progress') as SVGCircleElement;

    this.element.append(this.vignette, this.ring, this.canisters, this.hint);
    this.update(0, null);
  }

  /** Канистры в руках (значки внизу слева) и прогресс заправки (кольцо у прицела). */
  public updateOil(canisters: number, refuelProgress: number): void {
    if (canisters !== this.shownCanisters) {
      this.shownCanisters = canisters;
      this.canisters.replaceChildren(
        ...Array.from({ length: canisters }, () => {
          const icon = document.createElement('span');
          icon.className = 'lamp-hud__canister';
          return icon;
        }),
      );
      this.canisters.hidden = canisters === 0;
    }
    this.ring.classList.toggle('lamp-hud__ring--visible', refuelProgress > 0);
    this.ringProgress.setAttribute(
      'stroke-dashoffset',
      String(this.circumference * (1 - refuelProgress)),
    );
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
