/**
 * Затемнение при переходе между пространствами с надписью
 * «Пространство N». Плавность обеспечивает CSS-переход прозрачности.
 */
export class TransitionOverlay {
  public readonly element: HTMLElement;
  private readonly title: HTMLElement;

  public constructor() {
    this.element = document.createElement('div');
    this.element.className = 'transition-overlay';
    this.element.setAttribute('aria-live', 'polite');
    this.title = document.createElement('div');
    this.title.className = 'transition-overlay__title';
    this.element.append(this.title);
  }

  /** Затемнить экран и показать номер следующего пространства (с 1). */
  public showEntering(spaceNumber: number): void {
    this.title.textContent = `Пространство ${spaceNumber}`;
    this.element.classList.add('transition-overlay--visible');
  }

  public hide(): void {
    this.element.classList.remove('transition-overlay--visible');
  }
}
