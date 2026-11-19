import { describe, expect, it } from 'vitest';
import {
  CollisionWorld,
  GameConfig,
  MessageCodec,
  PlayerMovement,
  SpaceGenerator,
  Vector2,
} from '../src/index.ts';
import type { PlayerInput } from '../src/index.ts';

/** Движение без стен: проверяем само правило движения. */
const createMovement = (): { movement: PlayerMovement; start: Vector2 } => ({
  movement: new PlayerMovement(new CollisionWorld([])),
  start: new Vector2(10, 10),
});

const input = (overrides: Partial<PlayerInput> = {}): PlayerInput => ({
  seq: 1,
  dt: 0.05,
  moveX: 0,
  moveY: 1,
  yaw: 0,
  pitch: 0,
  run: false,
  space: 0,
  ...overrides,
});

describe('PlayerMovement', () => {
  it('шаг вперёд с нулевым поворотом увеличивает y', () => {
    const { movement, start } = createMovement();
    const next = movement.apply(start, input());
    expect(next.x).toBeCloseTo(start.x);
    expect(next.y - start.y).toBeCloseTo(GameConfig.player.walkSpeed * 0.05);
  });

  it('бег быстрее ходьбы', () => {
    const { movement, start } = createMovement();
    const walk = movement.apply(start, input()).y - start.y;
    const run = movement.apply(start, input({ run: true })).y - start.y;
    expect(run).toBeGreaterThan(walk);
  });

  it('диагональ не быстрее прямого движения', () => {
    const { movement, start } = createMovement();
    const straight = movement.apply(start, input()).distanceTo(start);
    const diagonal = movement.apply(start, input({ moveX: 1 })).distanceTo(start);
    expect(diagonal).toBeCloseTo(straight);
  });

  it('длинный кадр обрезается до MAX_COMMAND_DT', () => {
    const { movement, start } = createMovement();
    const capped = movement.apply(start, input({ dt: 0.1 })).y;
    expect(movement.apply(start, input({ dt: 5 })).y).toBeCloseTo(capped);
  });

  it('детерминизм: одинаковые команды на двух экземплярах дают одну позицию', () => {
    const space = new SpaceGenerator(9).generate(1);
    const a = { movement: new PlayerMovement(CollisionWorld.fromSpace(space)) };
    const b = { movement: new PlayerMovement(CollisionWorld.fromSpace(space)) };
    let pa = space.startPositions[0];
    let pb = space.startPositions[0];
    for (let i = 0; i < 400; i++) {
      const command = input({
        seq: i,
        dt: 1 / 60 + (i % 7) * 0.001,
        moveX: i % 50 < 20 ? 1 : 0,
        yaw: Math.sin(i / 30),
        run: i % 3 === 0,
      });
      pa = a.movement.apply(pa, command);
      pb = b.movement.apply(pb, command);
    }
    expect(pa.x).toBe(pb.x);
    expect(pa.y).toBe(pb.y);
  });
});

describe('MessageCodec: input', () => {
  const codec = new MessageCodec();
  const decode = (commands: unknown): unknown =>
    codec.decodeClientMessage(JSON.stringify({ type: 'input', commands }));

  it('принимает корректную пачку команд', () => {
    expect(decode([input(), input({ seq: 2 })])).toEqual({
      type: 'input',
      commands: [input(), input({ seq: 2 })],
    });
  });

  it.each([
    ['пустая пачка', []],
    ['слишком много команд', Array.from({ length: 17 }, (_, i) => input({ seq: i }))],
    ['отрицательный seq', [input({ seq: -1 })]],
    ['дробный seq', [input({ seq: 1.5 })]],
    ['dt вне диапазона', [input({ dt: 2 })]],
    ['moveX вне диапазона', [input({ moveX: 3 })]],
    ['pitch вне диапазона', [input({ pitch: 4 })]],
    ['run не boolean', [{ ...input(), run: 1 }]],
    ['без номера пространства', [{ ...input(), space: undefined }]],
    ['дробный номер пространства', [input({ space: 1.5 })]],
    ['не массив', 'abc'],
  ])('отклоняет: %s', (_name, commands) => {
    expect(decode(commands)).toBeNull();
  });
});
