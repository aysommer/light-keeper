/**
 * Скример: когда привидение ловит героя, на весь экран резко выскакивает его
 * лицо — белое полотно и тёмные провалы глаз (без рта), — дёргается и вспыхивает.
 * Затем партия заканчивается (экран конца игры).
 */
export class Jumpscare {
  /** Сколько длится скример, мс. */
  public static readonly DURATION_MS = 1600;

  public readonly element: HTMLElement;

  public constructor() {
    this.element = document.createElement('div');
    this.element.className = 'jumpscare';
    this.element.hidden = true;
    this.element.setAttribute('aria-hidden', 'true');
    this.element.innerHTML = `
      <svg class="jumpscare__face" viewBox="0 0 200 240" preserveAspectRatio="xMidYMid meet">
        <defs>
          <radialGradient id="jumpscare-sheet" cx="50%" cy="38%" r="70%">
            <stop offset="0%" stop-color="#f4f6ff" />
            <stop offset="70%" stop-color="#c9d0e6" />
            <stop offset="100%" stop-color="#6d7388" />
          </radialGradient>
          <radialGradient id="jumpscare-hole" cx="50%" cy="45%" r="60%">
            <stop offset="0%" stop-color="#000" />
            <stop offset="100%" stop-color="#1b1d26" />
          </radialGradient>
        </defs>
        <path fill="url(#jumpscare-sheet)"
          d="M100 6 C40 6 16 60 16 120 L16 232 L40 214 L62 236 L84 214 L100 236 L116 214 L138 236 L160 214 L184 232 L184 120 C184 60 160 6 100 6 Z" />
        <ellipse cx="68" cy="100" rx="22" ry="34" fill="url(#jumpscare-hole)" transform="rotate(-8 68 100)" />
        <ellipse cx="132" cy="100" rx="22" ry="34" fill="url(#jumpscare-hole)" transform="rotate(8 132 100)" />
      </svg>
      <div class="jumpscare__flash"></div>`;
  }

  /** Показать скример; промис завершается, когда он закончился. */
  public play(): Promise<void> {
    this.element.hidden = false;
    // Перезапустить анимацию, если скример уже показывали.
    this.element.classList.remove('jumpscare--active');
    void this.element.offsetWidth;
    this.element.classList.add('jumpscare--active');
    return new Promise((resolve) => window.setTimeout(resolve, Jumpscare.DURATION_MS));
  }
}
