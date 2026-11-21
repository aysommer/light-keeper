import { describe, expect, it } from 'vitest';
import { SpaceGenerator } from '@light-keeper/shared';
import type { ExitKind, ExitSnapshot, Space } from '@light-keeper/shared';
import { InteractionPrompt } from '../src/game/InteractionPrompt.ts';

const spaceWith = (kind: ExitKind, keys = 0): Space => {
  const generator = new SpaceGenerator(31337);
  for (let index = 0; index < 80; index++) {
    const space = generator.generate(index);
    if (space.exit.kind === kind && space.keys.length >= keys && space.floorCount === 1)
      return space;
  }
  throw new Error(`Нет двери ${kind}`);
};

const closed: ExitSnapshot = {
  open: false,
  openerId: null,
  openProgress: 0,
  secondsLeft: null,
  keysTaken: [],
  keysInserted: 0,
  noteHolderId: null,
  codeFailures: 0,
};

describe('InteractionPrompt', () => {
  const prompt = new InteractionPrompt();
  const plain = spaceWith('plain');
  const atDoor = plain.exit.frontPoint(0.6);

  it('у закрытой двери — открыть, у открытой — войти', () => {
    expect(prompt.resolve(plain, closed, atDoor, false)).toBe('Удерживай E — открыть дверь');
    expect(prompt.resolve(plain, { ...closed, open: true, secondsLeft: 20 }, atDoor, false)).toBe(
      'Нажми E — войти',
    );
  });

  it('вдалеке, в тамбуре или без данных — без подсказки', () => {
    expect(prompt.resolve(plain, closed, plain.startPositions[0], false)).toBeNull();
    expect(prompt.resolve(plain, closed, atDoor, true)).toBeNull();
    expect(prompt.resolve(plain, null, atDoor, false)).toBeNull();
  });

  it('запертая дверь: без ключа, ключ не в руке, ключ в руке', () => {
    const locked = spaceWith('locked', 2);
    const required = locked.keys.length;
    const near = locked.exit.frontPoint(0.6);
    expect(prompt.resolve(locked, closed, near, false, { item: 'lamp', keys: 0 })).toBe(
      `Заперто: нужно ключей — ${required}, вставлено 0 из ${required}`,
    );
    expect(prompt.resolve(locked, closed, near, false, { item: 'lamp', keys: 1 })).toBe(
      'Возьми ключ в руку (3)',
    );
    expect(
      prompt.resolve(locked, { ...closed, keysInserted: 1 }, near, false, { item: 'key', keys: 1 }),
    ).toBe(`Удерживай E — вставить ключ (вставлено 1 из ${required})`);
    expect(prompt.resolve(locked, closed, near, false, { item: 'key', keys: 2 })).toBe(
      `Удерживай E — вставить ключи (вставлено 0 из ${required})`,
    );
  });

  it('дверь на другом этаже — без подсказки', () => {
    const generator = new SpaceGenerator(31337);
    let multi: Space | null = null;
    for (let index = 1; index < 80 && !multi; index++) {
      const space = generator.generate(index);
      if (space.floorCount > 1) multi = space;
    }
    const space = multi!;
    const near = space.exit.frontPoint(0.6);
    expect(prompt.resolve(space, closed, near, false, undefined, space.exitFloor)).not.toBeNull();
    expect(prompt.resolve(space, closed, near, false, undefined, space.exitFloor - 1)).toBeNull();
  });

  it('дверь с кодом — панель', () => {
    const code = spaceWith('code');
    expect(prompt.resolve(code, closed, code.exit.frontPoint(0.6), false)).toBe(
      'E — кодовая панель',
    );
  });
});
