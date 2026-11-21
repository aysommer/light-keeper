import { ExitCode } from '@light-keeper/shared';
import type { CodeAlphabet } from '@light-keeper/shared';
import { CodeSymbols } from './CodeSymbols.ts';

/**
 * Кодовая панель двери: экранчик на 4 символа, кнопки алфавита кода,
 * «Стереть» и «Ввести». Цифры и буквы можно набирать и с клавиатуры.
 * Проверяет код сервер — панель только отправляет набранное.
 */
export class CodePanel {
  public readonly element: HTMLElement;
  private readonly display: HTMLElement;
  private readonly keypad: HTMLElement;
  private readonly status: HTMLElement;
  private alphabet: CodeAlphabet | null = null;
  private entered: string[] = [];
  private symbols: readonly string[] = [];

  /** @param onSubmit набранный код (4 символа) */
  public constructor(private readonly onSubmit: (code: readonly string[]) => void) {
    this.element = document.createElement('div');
    this.element.className = 'code-panel';
    this.element.hidden = true;
    this.element.setAttribute('role', 'dialog');
    this.element.setAttribute('aria-modal', 'true');
    this.element.setAttribute('aria-label', 'Кодовая панель');
    // Клики и клавиши внутри панели не должны управлять игрой.
    this.element.addEventListener('click', (event) => event.stopPropagation());
    this.element.addEventListener('keydown', (event) => this.onKey(event));

    const box = document.createElement('div');
    box.className = 'code-panel__box';
    this.display = document.createElement('div');
    this.display.className = 'code-panel__display';
    this.status = document.createElement('p');
    this.status.className = 'code-panel__status';
    this.status.setAttribute('role', 'status');
    this.keypad = document.createElement('div');
    this.keypad.className = 'code-panel__keypad';

    const controls = document.createElement('div');
    controls.className = 'code-panel__controls';
    controls.append(
      this.button('Стереть', 'code-panel__erase', () => this.erase()),
      this.button('Ввести', 'code-panel__enter', () => this.submit()),
      this.button('Закрыть', 'code-panel__close', () => this.hide()),
    );
    box.append(this.display, this.status, this.keypad, controls);
    this.element.append(box);
  }

  public get visible(): boolean {
    return !this.element.hidden;
  }

  /** Открыть панель с кнопками нужного алфавита. */
  public show(alphabet: CodeAlphabet): void {
    if (alphabet !== this.alphabet) {
      this.alphabet = alphabet;
      this.symbols = ExitCode.keypad(alphabet);
      this.keypad.dataset['alphabet'] = alphabet;
      this.keypad.replaceChildren(
        ...this.symbols.map((symbol) => {
          const key = this.button('', 'code-panel__key', () => this.type(symbol));
          key.append(CodeSymbols.element(symbol));
          return key;
        }),
      );
    }
    this.entered = [];
    this.setStatus(null);
    this.render();
    this.element.hidden = false;
    (this.keypad.firstElementChild as HTMLElement | null)?.focus();
  }

  public hide(): void {
    this.element.hidden = true;
  }

  /** Сервер отверг код. */
  public showWrong(): void {
    this.entered = [];
    this.render();
    this.setStatus('Неверный код');
    this.display.classList.remove('code-panel__display--wrong');
    void this.display.offsetWidth;
    this.display.classList.add('code-panel__display--wrong');
  }

  private type(symbol: string): void {
    if (this.entered.length >= ExitCode.LENGTH) {
      return;
    }
    this.entered.push(symbol);
    this.setStatus(null);
    this.render();
  }

  private erase(): void {
    this.entered.pop();
    this.render();
  }

  private submit(): void {
    if (this.entered.length !== ExitCode.LENGTH) {
      this.setStatus(`Нужно ${ExitCode.LENGTH} символа`);
      return;
    }
    this.setStatus('Проверяю…');
    this.onSubmit([...this.entered]);
  }

  private onKey(event: KeyboardEvent): void {
    event.stopPropagation();
    if (event.key === 'Escape') {
      this.hide();
      return;
    }
    if (event.key === 'Backspace') {
      event.preventDefault();
      this.erase();
      return;
    }
    if (event.key === 'Enter' && !(event.target instanceof HTMLButtonElement)) {
      this.submit();
      return;
    }
    const typed = event.key.toUpperCase();
    if (this.symbols.includes(typed)) {
      event.preventDefault();
      this.type(typed);
    }
  }

  private render(): void {
    const cells = Array.from({ length: ExitCode.LENGTH }, (_, index) => {
      const cell = document.createElement('span');
      cell.className = 'code-panel__cell';
      const symbol = this.entered[index];
      if (symbol) cell.append(CodeSymbols.element(symbol));
      return cell;
    });
    this.display.replaceChildren(...cells);
  }

  private setStatus(text: string | null): void {
    this.status.textContent = text ?? '';
  }

  private button(label: string, className: string, onClick: () => void): HTMLButtonElement {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `code-panel__button ${className}`;
    button.textContent = label;
    button.addEventListener('click', onClick);
    return button;
  }
}
