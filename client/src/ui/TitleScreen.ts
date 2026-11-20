import { LobbyCode } from '@light-keeper/shared';
import type { ApiClient } from '../core/ApiClient.ts';
import { RecordsTable } from './RecordsTable.ts';
import type { Screen } from './Screen.ts';
import type { ServerStatusIndicator } from './ServerStatusIndicator.ts';
import { StickmanIcon } from './StickmanIcon.ts';

export interface TitleScreenActions {
  onCreateLobby(): void;
  onJoinLobby(code: string): void;
}

/** Титульный экран: создать комнату или войти по коду. Игра только на двоих. */
export class TitleScreen implements Screen {
  public readonly element: HTMLElement;
  private readonly error: HTMLElement;
  private readonly buttons: HTMLButtonElement[] = [];
  private readonly codeInput: HTMLInputElement;
  private readonly records = new RecordsTable();

  public constructor(
    private readonly statusIndicator: ServerStatusIndicator,
    private readonly api: ApiClient,
    actions: TitleScreenActions,
    initialError: string | null = null,
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
    tagline.textContent = 'Игра на двоих. Найдите выход — вместе.';

    const create = this.button('Создать комнату', () => actions.onCreateLobby());

    const joinForm = document.createElement('form');
    joinForm.className = 'join-form';
    this.codeInput = document.createElement('input');
    this.codeInput.className = 'join-form__input';
    this.codeInput.placeholder = 'КОД';
    this.codeInput.maxLength = LobbyCode.LENGTH;
    this.codeInput.autocomplete = 'off';
    this.codeInput.spellcheck = false;
    this.codeInput.setAttribute('aria-label', 'Код комнаты');
    this.codeInput.addEventListener('input', () => {
      this.codeInput.value = LobbyCode.normalize(this.codeInput.value);
    });
    const join = this.button('Войти', () => undefined, 'button--secondary');
    join.type = 'submit';
    joinForm.append(this.codeInput, join);
    joinForm.addEventListener('submit', (event) => {
      event.preventDefault();
      const code = LobbyCode.normalize(this.codeInput.value);
      if (!LobbyCode.isValid(code)) {
        this.showError(`Код — ${LobbyCode.LENGTH} латинские буквы.`);
        return;
      }
      actions.onJoinLobby(code);
    });

    const menu = document.createElement('div');
    menu.className = 'title-screen__menu';
    menu.append(create, joinForm);

    this.error = document.createElement('p');
    this.error.className = 'title-screen__error';
    this.error.setAttribute('role', 'alert');

    this.records.element.classList.add('records--title');
    this.element.append(
      heroes,
      name,
      tagline,
      menu,
      this.error,
      statusIndicator.element,
      this.records.element,
    );
    this.showError(initialError);
  }

  public mount(): void {
    void this.statusIndicator.refresh();
    this.api
      .getRecords()
      .then((records) => this.records.update(records, null))
      .catch(() => (this.records.element.hidden = true));
  }

  public dispose(): void {}

  public setBusy(busy: boolean): void {
    this.buttons.forEach((button) => (button.disabled = busy));
    this.codeInput.disabled = busy;
    if (busy) this.showError(null);
  }

  public showError(text: string | null): void {
    this.error.textContent = text ?? '';
    this.error.hidden = text === null;
  }

  private button(label: string, onClick: () => void, modifier = ''): HTMLButtonElement {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `button ${modifier}`.trim();
    button.textContent = label;
    button.addEventListener('click', onClick);
    this.buttons.push(button);
    return button;
  }
}
