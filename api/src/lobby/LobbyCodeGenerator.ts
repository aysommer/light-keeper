import { randomInt } from 'node:crypto';
import { LobbyCode } from '@light-keeper/shared';

/** Генерирует свободные коды комнат. */
export class LobbyCodeGenerator {
  private static readonly MAX_ATTEMPTS = 100;

  public constructor(
    private readonly randomIndex: (max: number) => number = (max) => randomInt(max),
  ) {}

  public generate(isTaken: (code: string) => boolean): string {
    for (let attempt = 0; attempt < LobbyCodeGenerator.MAX_ATTEMPTS; attempt++) {
      let code = '';
      for (let i = 0; i < LobbyCode.LENGTH; i++) {
        code += LobbyCode.ALPHABET[this.randomIndex(LobbyCode.ALPHABET.length)];
      }
      if (!isTaken(code)) {
        return code;
      }
    }
    throw new Error('Не удалось подобрать свободный код комнаты');
  }
}
