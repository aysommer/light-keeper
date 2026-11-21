/**
 * Фон главного меню — бесконечный лиминальный коридор: жёлтые обои, ковролин,
 * подвесной потолок с лампами дневного света, тьма в глубине. Коридор медленно
 * «едет» навстречу, одна из ламп иногда мерцает. Только CSS (3D-перспектива),
 * без WebGL. Движение — анимация transform всего коридора: плоскости рисуются
 * один раз, а сдвигает их видеокарта (анимация фона перерисовывала бы их каждый кадр).
 */
export class LiminalBackdrop {
  public readonly element: HTMLElement;

  public constructor() {
    this.element = document.createElement('div');
    this.element.className = 'liminal';
    this.element.setAttribute('aria-hidden', 'true');
    const tunnel = document.createElement('div');
    tunnel.className = 'liminal__tunnel';
    // Стены, пол и потолок едут навстречу целиком (transform — без перерисовки),
    // дальний конец стоит на месте.
    const mover = document.createElement('div');
    mover.className = 'liminal__mover';
    for (const face of ['floor', 'ceiling', 'left', 'right']) {
      mover.append(this.face(face));
    }
    tunnel.append(mover, this.face('end'));
    const haze = document.createElement('div');
    haze.className = 'liminal__haze';
    const grain = document.createElement('div');
    grain.className = 'liminal__grain';
    this.element.append(tunnel, haze, grain);
  }

  private face(name: string): HTMLElement {
    const element = document.createElement('div');
    element.className = `liminal__face liminal__face--${name}`;
    return element;
  }
}
