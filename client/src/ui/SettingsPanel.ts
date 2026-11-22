import type { GraphicsOptions, GraphicsSettings } from '../core/GraphicsSettings.ts';

interface Toggle {
  readonly key: keyof GraphicsOptions;
  /** Короткое название, без пояснений. */
  readonly label: string;
}

/** Окно настроек графики: галочки применяются сразу. */
export class SettingsPanel {
  private static readonly TOGGLES: readonly Toggle[] = [
    { key: 'antialias', label: 'Сглаживание' },
    { key: 'bloom', label: 'Свечение' },
    { key: 'dust', label: 'Пыль' },
    { key: 'sharpTextures', label: 'Чёткие текстуры' },
    { key: 'groundShadows', label: 'Тени под ногами' },
    { key: 'cornerShade', label: 'Затенение углов' },
    { key: 'lampShadows', label: 'Тени от лампы' },
    { key: 'ambientOcclusion', label: 'Мягкое затенение' },
    { key: 'reflections', label: 'Отражения' },
    { key: 'volumetricFog', label: 'Объёмный туман' },
  ];

  public readonly element: HTMLElement;
  private readonly inputs = new Map<keyof GraphicsOptions, HTMLInputElement>();
  private readonly unsubscribe: () => void;

  public constructor(settings: GraphicsSettings) {
    this.element = document.createElement('div');
    this.element.className = 'settings';
    this.element.hidden = true;
    this.element.setAttribute('role', 'dialog');
    this.element.setAttribute('aria-modal', 'true');
    this.element.setAttribute('aria-label', 'Настройки');
    // Клики внутри окна не должны захватывать мышь для игры.
    this.element.addEventListener('click', (event) => event.stopPropagation());

    const box = document.createElement('div');
    box.className = 'settings__box';
    const title = document.createElement('h2');
    title.className = 'settings__title';
    title.textContent = 'Настройки';
    const section = document.createElement('p');
    section.className = 'settings__section';
    section.textContent = 'Графика';
    box.append(title, section);

    for (const toggle of SettingsPanel.TOGGLES) {
      const label = document.createElement('label');
      label.className = 'settings__toggle';
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.checked = settings.options[toggle.key];
      input.addEventListener('change', () => settings.set(toggle.key, input.checked));
      const text = document.createElement('span');
      text.className = 'settings__label';
      text.textContent = toggle.label;
      label.append(input, text);
      box.append(label);
      this.inputs.set(toggle.key, input);
    }

    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'button button--ghost settings__close';
    close.textContent = 'Готово';
    close.addEventListener('click', () => this.hide());
    box.append(close);
    this.element.append(box);

    this.element.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') this.hide();
    });
    this.unsubscribe = settings.onChange((options) => {
      this.inputs.forEach((input, key) => (input.checked = options[key]));
    });
  }

  public get visible(): boolean {
    return !this.element.hidden;
  }

  public show(): void {
    this.element.hidden = false;
    this.inputs.values().next().value?.focus();
  }

  public hide(): void {
    this.element.hidden = true;
  }

  public dispose(): void {
    this.unsubscribe();
    this.element.remove();
  }
}
