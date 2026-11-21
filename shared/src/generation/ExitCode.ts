import type { SeededRandom } from '../random/SeededRandom.ts';

/** Чем записан код двери: цифрами, латинскими буквами или фигурами. */
export type CodeAlphabet = 'digits' | 'letters' | 'shapes';

/** Фигуры кодовой панели (рисуются на кнопках и в записке). */
export type CodeShape =
  'circle' | 'triangle' | 'square' | 'star' | 'diamond' | 'heart' | 'cross' | 'moon';

/**
 * Код двери с панелью: последовательность символов одного алфавита.
 * Код записан в записке, спрятанной в пространстве; ввести его можно на панели у двери.
 */
export class ExitCode {
  /** Длина кода. */
  public static readonly LENGTH = 4;
  /** Самый длинный символ (название фигуры) — для проверки входящих сообщений. */
  public static readonly MAX_SYMBOL_LENGTH = 8;
  public static readonly ALPHABETS: readonly CodeAlphabet[] = ['digits', 'letters', 'shapes'];
  private static readonly SYMBOLS: Readonly<Record<CodeAlphabet, readonly string[]>> = {
    digits: ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'],
    letters: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'J', 'K', 'L', 'M', 'N', 'P', 'R', 'S'],
    shapes: ['circle', 'triangle', 'square', 'star', 'diamond', 'heart', 'cross', 'moon'],
  };

  public constructor(
    public readonly alphabet: CodeAlphabet,
    public readonly symbols: readonly string[],
  ) {}

  /** Кнопки панели для алфавита (в порядке раскладки). */
  public static keypad(alphabet: CodeAlphabet): readonly string[] {
    return ExitCode.SYMBOLS[alphabet];
  }

  public static generate(rng: SeededRandom): ExitCode {
    const alphabet = rng.pick(ExitCode.ALPHABETS);
    const keypad = ExitCode.keypad(alphabet);
    const symbols = Array.from({ length: ExitCode.LENGTH }, () => rng.pick(keypad));
    return new ExitCode(alphabet, symbols);
  }

  /** Совпадает ли введённое с кодом. */
  public matches(entered: readonly string[]): boolean {
    return (
      entered.length === this.symbols.length &&
      entered.every((symbol, index) => symbol === this.symbols[index])
    );
  }
}
