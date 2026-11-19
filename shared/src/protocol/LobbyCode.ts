/**
 * Код комнаты: 4 латинские буквы без похожих на цифры I и O.
 * При вводе кириллические двойники (А, В, Е, К, М, Н, Р, С, Т, Х, У)
 * заменяются латинскими — игроки часто забывают переключить раскладку.
 */
export class LobbyCode {
  public static readonly ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  public static readonly LENGTH = 4;

  private static readonly CYRILLIC_LOOKALIKES: Readonly<Record<string, string>> = {
    А: 'A',
    В: 'B',
    Е: 'E',
    К: 'K',
    М: 'M',
    Н: 'H',
    Р: 'P',
    С: 'C',
    Т: 'T',
    Х: 'X',
    У: 'Y',
  };

  private static readonly PATTERN = new RegExp(`^[${LobbyCode.ALPHABET}]{${LobbyCode.LENGTH}}$`);

  public static normalize(input: string): string {
    return [...input.trim().toUpperCase()]
      .map((char) => LobbyCode.CYRILLIC_LOOKALIKES[char] ?? char)
      .join('');
  }

  public static isValid(code: string): boolean {
    return LobbyCode.PATTERN.test(code);
  }
}
