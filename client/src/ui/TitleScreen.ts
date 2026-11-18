import type { ServerStatusIndicator } from './ServerStatusIndicator.ts';

/** Титульный экран-заглушка этапа 0. */
export class TitleScreen {
  public readonly element: HTMLElement;

  public constructor(statusIndicator: ServerStatusIndicator) {
    this.element = document.createElement('main');
    this.element.className = 'title-screen';
    this.element.innerHTML = `
      <div class="title-screen__signs" aria-hidden="true">
        <span class="sign sign--male">М</span>
        <span class="sign sign--female">Ж</span>
      </div>
      <h1 class="title-screen__name">Light Keeper</h1>
      <p class="title-screen__tagline">Не дай свету погаснуть.</p>
    `;
    this.element.append(statusIndicator.element);
  }
}
