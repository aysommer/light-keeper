/** Тёмный тамбур за дверью: вернуться нельзя, ждём напарника. */
export class TambourOverlay {
  public readonly element: HTMLElement;
  private readonly countdown: HTMLElement;

  public constructor() {
    this.element = document.createElement('div');
    this.element.className = 'tambour-overlay';
    this.element.hidden = true;
    const title = document.createElement('div');
    title.className = 'tambour-overlay__title';
    title.textContent = 'Тамбур';
    const text = document.createElement('p');
    text.className = 'tambour-overlay__text';
    text.textContent = 'Дверь за тобой закрылась. Ждём напарника.';
    this.countdown = document.createElement('div');
    this.countdown.className = 'tambour-overlay__countdown';
    this.element.append(title, text, this.countdown);
  }

  public update(visible: boolean, secondsLeft: number | null): void {
    this.element.hidden = !visible;
    if (visible) {
      const text = secondsLeft === null ? '' : `${Math.ceil(secondsLeft)} с`;
      if (this.countdown.textContent !== text) {
        this.countdown.textContent = text;
      }
    }
  }
}
