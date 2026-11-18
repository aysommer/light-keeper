/** Цвет персонажа-стикмена. */
export type StickmanColor = 'red' | 'blue';

/** SVG-иконка стикмена с лампой в руке. */
export class StickmanIcon {
  public readonly element: SVGSVGElement;

  public constructor(color: StickmanColor, mirrored = false) {
    const template = document.createElement('template');
    template.innerHTML = `
      <svg class="stickman stickman--${color}" viewBox="0 0 64 96" aria-hidden="true">
        <g class="stickman__body" ${mirrored ? 'transform="translate(64 0) scale(-1 1)"' : ''}>
          <circle cx="32" cy="16" r="10" />
          <line x1="32" y1="26" x2="32" y2="58" />
          <line x1="32" y1="36" x2="16" y2="50" />
          <line x1="32" y1="36" x2="50" y2="44" />
          <line x1="32" y1="58" x2="20" y2="88" />
          <line x1="32" y1="58" x2="44" y2="88" />
          <line class="stickman__lamp-handle" x1="50" y1="44" x2="50" y2="52" />
          <circle class="stickman__lamp" cx="50" cy="58" r="6" />
        </g>
      </svg>
    `.trim();
    this.element = template.content.firstElementChild as SVGSVGElement;
  }
}
