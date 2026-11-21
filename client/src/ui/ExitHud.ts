import type { ExitSnapshot } from '@light-keeper/shared';

/**
 * Интерфейс двери: круговой индикатор открытия вокруг прицела,
 * подсказка действия, таймер открытой двери и отметка о ключе.
 */
export class ExitHud {
  /** Меньше этого числа секунд таймер становится тревожным. */
  private static readonly URGENT_SECONDS = 10;
  private static readonly RING_RADIUS = 22;

  public readonly element: HTMLElement;
  private readonly ring: SVGSVGElement;
  private readonly ringProgress: SVGCircleElement;
  private readonly prompt: HTMLElement;
  private readonly timer: HTMLElement;
  private readonly key: HTMLElement;
  private readonly circumference = 2 * Math.PI * ExitHud.RING_RADIUS;

  public constructor() {
    this.element = document.createElement('div');
    this.element.className = 'exit-hud';

    const template = document.createElement('template');
    const r = ExitHud.RING_RADIUS;
    template.innerHTML = `
      <svg class="exit-hud__ring" viewBox="0 0 60 60" aria-hidden="true">
        <circle class="exit-hud__ring-track" cx="30" cy="30" r="${r}" />
        <circle class="exit-hud__ring-progress" cx="30" cy="30" r="${r}"
          stroke-dasharray="${this.circumference}" stroke-dashoffset="${this.circumference}" />
      </svg>`.trim();
    this.ring = template.content.firstElementChild as SVGSVGElement;
    this.ringProgress = this.ring.querySelector('.exit-hud__ring-progress') as SVGCircleElement;

    this.prompt = this.div('exit-hud__prompt');
    this.timer = this.div('exit-hud__timer');
    this.key = this.div('exit-hud__key');
    this.element.append(this.ring, this.prompt, this.timer, this.key);
    this.update(null, 'me', null);
  }

  /**
   * @param keys что известно о ключах: сколько у тебя, сколько вставлено и сколько нужно
   *   (`null` — у двери нет замка)
   */
  public update(
    exit: ExitSnapshot | null,
    playerId: string,
    prompt: string | null,
    keys: {
      readonly own: number;
      readonly inserted: number;
      readonly required: number;
    } | null = null,
  ): void {
    const opening = exit !== null && exit.openerId === playerId;
    this.ring.classList.toggle('exit-hud__ring--visible', opening);
    const progress = opening ? exit.openProgress : 0;
    this.ringProgress.setAttribute(
      'stroke-dashoffset',
      String(this.circumference * (1 - progress)),
    );

    this.setText(this.prompt, prompt);

    const secondsLeft = exit?.open ? exit.secondsLeft : null;
    this.setText(
      this.timer,
      secondsLeft === null ? null : `Дверь открыта · ${Math.ceil(secondsLeft)} с`,
    );
    this.timer.classList.toggle(
      'exit-hud__timer--urgent',
      secondsLeft !== null && secondsLeft <= ExitHud.URGENT_SECONDS,
    );

    this.setText(this.key, this.keysText(exit, keys));
  }

  /** Строка про ключи: сколько найдено и вставлено из нужных. */
  private keysText(
    exit: ExitSnapshot | null,
    keys: { readonly own: number; readonly inserted: number; readonly required: number } | null,
  ): string | null {
    if (!exit || !keys || exit.open || exit.keysTaken.length === 0) {
      return null;
    }
    const parts = [`Ключи: найдено ${exit.keysTaken.length} из ${keys.required}`];
    if (keys.own > 0) parts.push(`у тебя ${keys.own} (3)`);
    if (keys.inserted > 0) parts.push(`вставлено ${keys.inserted}`);
    return parts.join(' · ');
  }

  private div(className: string): HTMLElement {
    const element = document.createElement('div');
    element.className = className;
    return element;
  }

  private setText(element: HTMLElement, text: string | null): void {
    if (element.textContent !== (text ?? '')) {
      element.textContent = text ?? '';
    }
    element.hidden = text === null;
  }
}
