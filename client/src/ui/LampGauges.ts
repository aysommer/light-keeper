import { GameConfig } from '@light-keeper/shared';
import type { LampSnapshot } from '@light-keeper/shared';

/** Один круговой индикатор с процентом в центре и подписью под ним. */
class Gauge {
  private static readonly RADIUS = 22;
  public readonly element: HTMLElement;
  private readonly progress: SVGCircleElement;
  private readonly value: HTMLElement;
  private readonly caption: HTMLElement;
  private readonly circumference = 2 * Math.PI * Gauge.RADIUS;
  private shown = '';

  public constructor(
    modifier: string,
    private readonly label: string,
  ) {
    this.element = document.createElement('div');
    this.element.className = `lamp-gauge lamp-gauge--${modifier}`;
    const template = document.createElement('template');
    template.innerHTML = `
      <svg class="lamp-gauge__ring" viewBox="0 0 60 60" aria-hidden="true">
        <circle class="lamp-gauge__track" cx="30" cy="30" r="${Gauge.RADIUS}" />
        <circle class="lamp-gauge__progress" cx="30" cy="30" r="${Gauge.RADIUS}"
          stroke-dasharray="${this.circumference}" stroke-dashoffset="${this.circumference}" />
      </svg>`.trim();
    const ring = template.content.firstElementChild as SVGSVGElement;
    this.progress = ring.querySelector('.lamp-gauge__progress') as SVGCircleElement;
    this.value = document.createElement('span');
    this.value.className = 'lamp-gauge__value';
    const dial = document.createElement('div');
    dial.className = 'lamp-gauge__dial';
    dial.append(ring, this.value);
    this.caption = document.createElement('span');
    this.caption.className = 'lamp-gauge__label';
    this.caption.textContent = label;
    this.element.append(dial, this.caption);
  }

  /**
   * @param percent 0–100
   * @param state оттенок: обычный, предупреждение или тревога
   * @param caption подпись (по умолчанию — название индикатора)
   */
  public update(percent: number, state: 'ok' | 'warn' | 'alarm', caption = this.label): void {
    const clamped = Math.max(0, Math.min(100, percent));
    const key = `${Math.round(clamped)}|${state}|${caption}`;
    if (key === this.shown) {
      return;
    }
    this.shown = key;
    this.progress.setAttribute(
      'stroke-dashoffset',
      String(this.circumference * (1 - clamped / 100)),
    );
    this.value.textContent = `${Math.round(clamped)}%`;
    this.element.dataset['state'] = state;
    this.caption.textContent = caption;
    this.element.setAttribute('aria-label', `${caption}: ${Math.round(clamped)}%`);
  }
}

/**
 * Состояние общей лампы в углу экрана: два круговых индикатора — «Нагрев» и
 * «Масло». Лампа одна на двоих, поэтому индикаторы видны обоим; если лампа
 * у напарника, под ними подпись «Лампа у напарника».
 */
export class LampGauges {
  public readonly element: HTMLElement;
  private readonly heat = new Gauge('heat', 'Нагрев');
  private readonly oil = new Gauge('oil', 'Масло');
  private readonly owner: HTMLElement;

  public constructor() {
    this.element = document.createElement('div');
    this.element.className = 'lamp-gauges';
    this.element.setAttribute('role', 'group');
    this.element.setAttribute('aria-label', 'Лампа');
    const row = document.createElement('div');
    row.className = 'lamp-gauges__row';
    row.append(this.heat.element, this.oil.element);
    this.owner = document.createElement('p');
    this.owner.className = 'lamp-gauges__owner';
    this.owner.textContent = 'Лампа у напарника';
    this.element.append(row, this.owner);
    this.element.hidden = true;
  }

  /**
   * @param lamp общая лампа (`null` — ещё нет данных или идёт переход)
   * @param mine лампа у этого игрока
   * @param onFloor лампа выпала и лежит на полу
   */
  public update(lamp: LampSnapshot | null, mine: boolean, onFloor = false): void {
    this.element.hidden = lamp === null;
    if (!lamp) {
      return;
    }
    const settings = GameConfig.lamp;
    this.heat.update(
      lamp.heat,
      lamp.overheated ? 'alarm' : lamp.heat >= settings.warningHeat ? 'warn' : 'ok',
      lamp.overheated ? 'Остывает' : 'Нагрев',
    );
    this.oil.update(lamp.oil, lamp.oil <= 0 ? 'alarm' : lamp.oil < settings.lowOil ? 'warn' : 'ok');
    this.owner.hidden = mine;
    const owner = onFloor ? 'Лампа на полу' : 'Лампа у напарника';
    if (this.owner.textContent !== owner) this.owner.textContent = owner;
  }
}
