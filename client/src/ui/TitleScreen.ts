import type { Screen } from './Screen.ts';
import type { ServerStatusIndicator } from './ServerStatusIndicator.ts';
import { StickmanIcon } from './StickmanIcon.ts';

/** Титульный экран. */
export class TitleScreen implements Screen {
  public readonly element: HTMLElement;

  public constructor(
    private readonly statusIndicator: ServerStatusIndicator,
    onStartSolo: () => void,
  ) {
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

    const start = document.createElement('button');
    start.type = 'button';
    start.className = 'button';
    start.textContent = 'Пройтись одному';
    start.addEventListener('click', onStartSolo);

    this.element.append(heroes, name, tagline, start, statusIndicator.element);
  }

  public mount(): void {
    void this.statusIndicator.refresh();
  }

  public dispose(): void {}
}
