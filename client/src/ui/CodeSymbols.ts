/**
 * Символы кода двери на экране: цифры и буквы — текстом, фигуры — рисунком.
 * Одни и те же символы видны в записке и на кнопках панели.
 */
export class CodeSymbols {
  /** Контуры фигур (SVG path, поле 24×24) — для экрана и для текстуры записки. */
  public static readonly PATHS: Readonly<Record<string, string>> = {
    circle: 'M12 4a8 8 0 1 0 0.001 0z',
    triangle: 'M12 3L21 20H3z',
    square: 'M4 4H20V20H4z',
    star: 'M12 2L14.9 8.6 22 9.2 16.6 13.9 18.2 21 12 17.3 5.8 21 7.4 13.9 2 9.2 9.1 8.6z',
    diamond: 'M12 2L22 12 12 22 2 12z',
    heart:
      'M12 21C5 15 2 11.5 2 8c0-3 2.5-5 5-5 2 0 4 1.5 5 3 1-1.5 3-3 5-3 2.5 0 5 2 5 5 0 3.5-3 7-10 13z',
    cross: 'M9 3h6v6h6v6h-6v6H9v-6H3V9h6z',
    moon: 'M15 3a9 9 0 1 0 6 12 7 7 0 1 1-6-12z',
  };

  /** Названия фигур — для подсказок экранного диктора. */
  private static readonly NAMES: Readonly<Record<string, string>> = {
    circle: 'круг',
    triangle: 'треугольник',
    square: 'квадрат',
    star: 'звезда',
    diamond: 'ромб',
    heart: 'сердце',
    cross: 'крест',
    moon: 'месяц',
  };

  /** Элемент с символом: текст или фигура. */
  public static element(symbol: string): HTMLElement {
    const element = document.createElement('span');
    element.className = 'code-symbol';
    element.dataset['symbol'] = symbol;
    const shape = CodeSymbols.PATHS[symbol];
    if (shape) {
      element.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor"><path d="${shape}"/></svg>`;
      element.setAttribute('aria-label', CodeSymbols.NAMES[symbol] ?? symbol);
    } else {
      element.textContent = symbol;
    }
    return element;
  }
}
