import { describe, expect, it } from 'vitest';
import { CollisionWorld, PlayerMovement, Vector2 } from '@light-keeper/shared';
import type { PlayerInput } from '@light-keeper/shared';
import { FirstPersonController } from '../src/game/FirstPersonController.ts';
import { LocalPlayer } from '../src/game/LocalPlayer.ts';
import type { InputController } from '../src/input/InputController.ts';

/** Ввод-заглушка: управляем нажатиями вручную. */
class FakeInput {
  public held = new Set<string>();
  public pressed = new Set<string>();
  public isPressed(code: string): boolean {
    return this.held.has(code);
  }
  public consumePress(code: string): boolean {
    return this.pressed.delete(code);
  }
  public movementAxis(): Vector2 {
    return Vector2.ZERO;
  }
  public consumeMouseDelta(): Vector2 {
    return Vector2.ZERO;
  }
}

describe('FirstPersonController: клавиша действия', () => {
  const setup = () => {
    const input = new FakeInput();
    const commands: PlayerInput[] = [];
    const controller = new FirstPersonController(
      new LocalPlayer(new Vector2(5, 5)),
      input as unknown as InputController,
      { movement: new PlayerMovement(new CollisionWorld([])), spaceIndex: 0 },
    );
    controller.onCommand((command) => commands.push(command));
    return { input, commands, controller };
  };

  it('удержание E передаётся в каждой команде', () => {
    const { input, commands, controller } = setup();
    input.held.add('KeyE');
    controller.update(0.016);
    controller.update(0.016);
    expect(commands.map((c) => c.interact)).toEqual([true, true]);
  });

  it('короткое нажатие между кадрами не теряется', () => {
    const { input, commands, controller } = setup();
    input.pressed.add('KeyE'); // нажали и отпустили до кадра
    controller.update(0.016);
    controller.update(0.016);
    expect(commands.map((c) => c.interact)).toEqual([true, false]);
  });
});
