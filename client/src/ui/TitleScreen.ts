import type { ServerStatusIndicator } from './ServerStatusIndicator.ts';
import { StickmanIcon } from './StickmanIcon.ts';

/** Титульный экран-заглушка этапа 0. */
export class TitleScreen {
  public readonly element: HTMLElement;

  public constructor(statusIndicator: ServerStatusIndicator) {
    this.element = document.createElement('main');
    this.element.className = 'title-screen';

    const heroes = document.createElement('div');
    heroes.className = 'title-screen__heroes';
    heroes.append(new StickmanIcon('red').element, new StickmanIcon('blue', true).element);

    const name = document.createElement('h1');
    name.className = 'title-screen__name';
    name.textContent = 'Light Keeper';

    const tagline = document.createElement('p');
    tagline.className = 'title-screen__tagline';
    tagline.textContent = 'Не дай свету погаснуть.';

    this.element.append(heroes, name, tagline, statusIndicator.element);
  }
}
