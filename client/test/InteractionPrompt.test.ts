import { describe, expect, it } from 'vitest';
import { SpaceGenerator } from '@light-keeper/shared';
import type { ExitKind, ExitSnapshot, Space } from '@light-keeper/shared';
import { InteractionPrompt } from '../src/game/InteractionPrompt.ts';

const spaceWith = (kind: ExitKind): Space => {
  const generator = new SpaceGenerator(31337);
  for (let index = 0; index < 60; index++) {
    const space = generator.generate(index);
    if (space.exit.kind === kind) return space;
  }
  throw new Error(`Нет двери ${kind}`);
};

const closed: ExitSnapshot = {
  open: false,
  revealed: true,
  openerId: null,
  openProgress: 0,
  secondsLeft: null,
  keyHolderId: null,
};

describe('InteractionPrompt', () => {
  const prompt = new InteractionPrompt();
  const plain = spaceWith('plain');
  const atDoor = plain.exit.frontPoint(0.6);

  it('у закрытой двери — открыть, у открытой — войти', () => {
    expect(prompt.resolve(plain, closed, 'me', atDoor, false)).toBe('Удерживай E — открыть дверь');
    expect(
      prompt.resolve(plain, { ...closed, open: true, secondsLeft: 20 }, 'me', atDoor, false),
    ).toBe('Нажми E — войти');
  });

  it('вдалеке, в тамбуре или у непроявленной двери — без подсказки', () => {
    expect(prompt.resolve(plain, closed, 'me', plain.startPositions[0], false)).toBeNull();
    expect(prompt.resolve(plain, closed, 'me', atDoor, true)).toBeNull();
    expect(prompt.resolve(plain, { ...closed, revealed: false }, 'me', atDoor, false)).toBeNull();
    expect(prompt.resolve(plain, null, 'me', atDoor, false)).toBeNull();
  });

  it('запертая дверь: нужен ключ, ключ у напарника, ключ у тебя', () => {
    const locked = spaceWith('locked');
    const near = locked.exit.frontPoint(0.6);
    expect(prompt.resolve(locked, closed, 'me', near, false)).toBe('Заперто. Нужен ключ');
    expect(prompt.resolve(locked, { ...closed, keyHolderId: 'mate' }, 'me', near, false)).toBe(
      'Ключ у напарника',
    );
    expect(prompt.resolve(locked, { ...closed, keyHolderId: 'me' }, 'me', near, false)).toBe(
      'Удерживай E — открыть дверь',
    );
  });
});
