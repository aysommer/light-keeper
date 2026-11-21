/**
 * Этажи в многоэтажном пространстве: на каком этаже ты и где напарник.
 * В одноэтажном пространстве скрыт.
 */
export class FloorHud {
  public readonly element: HTMLElement;
  private shown = '';

  public constructor() {
    this.element = document.createElement('div');
    this.element.className = 'floor-hud';
    this.element.setAttribute('role', 'status');
    this.element.hidden = true;
  }

  /**
   * @param floor свой этаж (0 — первый)
   * @param count сколько этажей в пространстве
   * @param partnerFloor этаж напарника (`null` — неизвестно)
   */
  public update(floor: number, count: number, partnerFloor: number | null): void {
    let text = '';
    if (count > 1) {
      text = `Этаж ${floor + 1} из ${count}`;
      if (partnerFloor !== null && partnerFloor !== floor) {
        text += ` · напарник ${partnerFloor > floor ? 'выше' : 'ниже'} (${partnerFloor + 1}-й)`;
      }
    }
    if (text === this.shown) {
      return;
    }
    this.shown = text;
    this.element.textContent = text;
    this.element.hidden = text === '';
  }
}
