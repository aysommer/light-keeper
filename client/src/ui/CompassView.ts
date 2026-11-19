/**
 * Компас: стрелка указывает на напарника относительно взгляда.
 * Виден, только когда компас в руке. Расстояние не показывает.
 */
export class CompassView {
  public readonly element: HTMLElement;
  private readonly needle: HTMLElement;

  public constructor() {
    this.element = document.createElement('div');
    this.element.className = 'compass';
    this.element.hidden = true;
    this.element.setAttribute('role', 'img');
    this.element.setAttribute('aria-label', 'Компас: направление на напарника');

    const ring = document.createElement('div');
    ring.className = 'compass__ring';
    const mark = document.createElement('div');
    mark.className = 'compass__mark';
    this.needle = document.createElement('div');
    this.needle.className = 'compass__needle';
    const hub = document.createElement('div');
    hub.className = 'compass__hub';
    ring.append(mark, this.needle, hub);
    this.element.append(ring);
  }

  /**
   * @param visible компас в руке
   * @param clockwiseRad угол по часовой от взгляда до напарника; `null` — направление неизвестно
   */
  public update(visible: boolean, clockwiseRad: number | null): void {
    this.element.hidden = !visible;
    if (!visible) {
      return;
    }
    this.element.classList.toggle('compass--lost', clockwiseRad === null);
    if (clockwiseRad !== null) {
      this.needle.style.transform = `rotate(${clockwiseRad}rad)`;
    }
  }
}
