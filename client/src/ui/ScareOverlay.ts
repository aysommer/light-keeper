/** Испуг: тёмная зернистая виньетка по краям экрана. */
export class ScareOverlay {
  public readonly element: HTMLElement;

  public constructor() {
    this.element = document.createElement('div');
    this.element.className = 'scare-overlay';
    const grain = document.createElement('div');
    grain.className = 'scare-overlay__grain';
    this.element.append(grain);
  }

  public update(level: number): void {
    this.element.style.opacity = level.toFixed(3);
  }
}
