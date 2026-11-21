/**
 * Фон главного меню — бесконечный лиминальный коридор: жёлтые обои, ковролин,
 * подвесной потолок с лампами дневного света, тьма в глубине. Коридор медленно
 * «едет» навстречу, одна из ламп иногда мерцает. Только CSS (3D-перспектива),
 * без WebGL, поэтому меню открывается мгновенно и не грузит видеокарту.
 */
export class LiminalBackdrop {
  public readonly element: HTMLElement;

  public constructor() {
    this.element = document.createElement('div');
    this.element.className = 'liminal';
    this.element.setAttribute('aria-hidden', 'true');
    const tunnel = document.createElement('div');
    tunnel.className = 'liminal__tunnel';
    for (const face of ['floor', 'ceiling', 'left', 'right', 'end']) {
      const element = document.createElement('div');
      element.className = `liminal__face liminal__face--${face}`;
      tunnel.append(element);
    }
    const haze = document.createElement('div');
    haze.className = 'liminal__haze';
    const grain = document.createElement('div');
    grain.className = 'liminal__grain';
    this.element.append(tunnel, haze, grain);
  }
}
