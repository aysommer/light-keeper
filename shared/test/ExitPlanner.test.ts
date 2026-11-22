import { describe, expect, it } from 'vitest';
import { ExitCode, GameConfig, OccupancyGrid, RoomGraph, SpaceGenerator } from '../src/index.ts';
import type { Space } from '../src/index.ts';

const SEEDS = Array.from({ length: 40 }, (_, i) => 500 + i * 104729);

/** Куда можно дойти на этаже `floor` от старта (первый этаж) или от лестницы, ведущей на этаж. */
const reachable = (space: Space, floor = 0) => {
  const grid = new OccupancyGrid(space.bounds.expand(1), 0.1);
  space
    .floor(floor)
    .colliders.forEach((collider) => grid.block(collider, GameConfig.player.radius));
  return grid.reachableFrom(
    floor === 0 ? space.startPositions[0] : space.stairs[floor - 1]!.position,
  );
};

/** Комната, с которой игрок начинает этаж: стартовая или та, куда приводит лестница. */
const entryRoom = (space: Space, floor: number) =>
  floor === 0 ? space.startRoom : space.floor(floor).roomAt(space.stairs[floor - 1]!.position)!;

describe('ExitPlanner: тип двери', () => {
  it('в первом пространстве дверь всегда обычная', () => {
    for (const seed of SEEDS) {
      expect(new SpaceGenerator(seed).generate(0).exit.kind).toBe('plain');
    }
  });

  it('дальше встречаются все три типа примерно поровну', () => {
    const counts = { plain: 0, locked: 0, code: 0 };
    for (const seed of SEEDS) {
      for (let index = 1; index <= 6; index++) {
        counts[new SpaceGenerator(seed).generate(index).exit.kind] += 1;
      }
    }
    const total = SEEDS.length * 6;
    for (const count of Object.values(counts)) {
      expect(count / total).toBeGreaterThan(0.2);
      expect(count / total).toBeLessThan(0.47);
    }
  });

  it('ключи есть только у запертой двери, записка и код — только у двери с панелью', () => {
    for (const seed of SEEDS) {
      for (let index = 0; index <= 4; index++) {
        const space = new SpaceGenerator(seed).generate(index);
        expect(space.keys.length > 0).toBe(space.exit.kind === 'locked');
        expect(space.note !== null).toBe(space.exit.kind === 'code');
        expect(space.code !== null).toBe(space.exit.kind === 'code');
      }
    }
  });

  it('невидимых дверей нет: только обычная, запертая и с панелью', () => {
    for (const seed of SEEDS) {
      for (let index = 0; index <= 8; index++) {
        expect(['plain', 'locked', 'code']).toContain(
          new SpaceGenerator(seed).generate(index).exit.kind,
        );
      }
    }
  });
});

describe('ExitPlanner: размещение двери', () => {
  it('дверь висит на сплошной стене своей комнаты, не в стартовой комнате', () => {
    for (const seed of SEEDS) {
      const space = new SpaceGenerator(seed).generate(3);
      const { exit } = space;
      const floor = space.floor(space.exitFloor);
      expect(exit.roomId).not.toBe(entryRoom(space, space.exitFloor).id);
      expect(floor.doors.some((door) => door.edge.key === exit.edge.key)).toBe(false);
      // На осевой линии двери — стена.
      expect(floor.walls.some((wall) => wall.bounds.containsPoint(exit.position))).toBe(true);
      // Перед дверью — её комната.
      expect(floor.roomAt(exit.frontPoint())?.id).toBe(exit.roomId);
    }
  });

  it('к двери можно подойти вплотную', () => {
    for (const seed of SEEDS) {
      const space = new SpaceGenerator(seed).generate(2);
      const front = space.exit.frontPoint(GameConfig.world.wallThickness / 2 + 0.35);
      expect(reachable(space, space.exitFloor).contains(front), `seed ${seed}`).toBe(true);
    }
  });

  it('дверь далеко: её комната среди самой дальней трети', () => {
    for (const seed of SEEDS) {
      const space = new SpaceGenerator(seed).generate(4);
      const floor = space.floor(space.exitFloor);
      const from = entryRoom(space, space.exitFloor).id;
      const graph = new RoomGraph(floor.rooms, floor.doors);
      const distances = [...graph.distancesFrom(from).values()].sort((a, b) => b - a);
      const exitDistance = graph.distancesFrom(from).get(space.exit.roomId)!;
      const threshold = distances[Math.ceil(distances.length * 0.5) - 1]!;
      expect(exitDistance).toBeGreaterThanOrEqual(threshold);
    }
  });

  it('детерминизм: та же дверь и тот же ключ при том же seed', () => {
    const a = new SpaceGenerator(9).generate(5);
    const b = new SpaceGenerator(9).generate(5);
    expect(a.exit).toEqual(b.exit);
    expect(a.keys).toEqual(b.keys);
    expect(a.note).toEqual(b.note);
    expect(a.code).toEqual(b.code);
  });
});

describe('ExitPlanner: ключ', () => {
  const lockedSpaces = (): Space[] =>
    SEEDS.flatMap((seed) =>
      Array.from({ length: 8 }, (_, i) => new SpaceGenerator(seed).generate(i + 1)),
    ).filter((space) => space.exit.kind === 'locked');

  it('ключей от 1 до 3, встречается каждое количество', () => {
    const spaces = lockedSpaces();
    const counts = new Set(spaces.map((space) => space.keys.length));
    expect(counts).toEqual(new Set([1, 2, 3]));
  });

  it('ключи достижимы, лежат в разных клетках, не в стартовой комнате и не в комнате двери', () => {
    const spaces = lockedSpaces();
    expect(spaces.length).toBeGreaterThan(20);
    for (const space of spaces) {
      const cells = new Set(space.keys.map((key) => `${key.x}:${key.y}`));
      expect(cells.size).toBe(space.keys.length);
      space.keys.forEach((key, i) => {
        const floor = space.keyFloors[i]!;
        const keyRoom = space.floor(floor).roomAt(key)!;
        expect(keyRoom.id).not.toBe(space.exit.roomId);
        if (floor === space.exitFloor && space.floor(floor).rooms.length > 2) {
          expect(keyRoom.id).not.toBe(entryRoom(space, floor).id);
        }
        expect(reachable(space, floor).contains(key)).toBe(true);
      });
    }
  });

  it('ключ не на кратчайшем пути к двери (если в лабиринте есть ответвления)', () => {
    for (const space of lockedSpaces()) {
      const floor = space.floor(space.exitFloor);
      const graph = new RoomGraph(floor.rooms, floor.doors);
      const path = graph.path(entryRoom(space, space.exitFloor).id, space.exit.roomId);
      const offPathExists = floor.rooms.some((room) => !path.includes(room.id));
      if (offPathExists) {
        space.keys.forEach((key, i) => {
          if (space.keyFloors[i] === space.exitFloor) {
            expect(path).not.toContain(floor.roomAt(key)!.id);
          }
        });
      }
    }
  });
});

describe('ExitPlanner: записка с кодом', () => {
  const codeSpaces = (): Space[] =>
    SEEDS.flatMap((seed) =>
      Array.from({ length: 8 }, (_, i) => new SpaceGenerator(seed).generate(i + 1)),
    ).filter((space) => space.exit.kind === 'code');

  it('записка достижима и лежит не в комнате двери', () => {
    const spaces = codeSpaces();
    expect(spaces.length).toBeGreaterThan(20);
    for (const space of spaces) {
      expect(space.floor(space.noteFloor).roomAt(space.note!)!.id).not.toBe(space.exit.roomId);
      expect(reachable(space, space.noteFloor).contains(space.note!)).toBe(true);
    }
  });

  it('код из 4 символов одного алфавита; встречаются цифры, буквы и фигуры', () => {
    const alphabets = new Set<string>();
    for (const space of codeSpaces()) {
      const code = space.code!;
      alphabets.add(code.alphabet);
      expect(code.symbols).toHaveLength(ExitCode.LENGTH);
      for (const symbol of code.symbols) expect(ExitCode.keypad(code.alphabet)).toContain(symbol);
      expect(code.matches(code.symbols)).toBe(true);
      expect(code.matches(code.symbols.slice(0, 3))).toBe(false);
    }
    expect(alphabets).toEqual(new Set(['digits', 'letters', 'shapes']));
  });
});

describe('Этажи', () => {
  const all = (): Space[] =>
    SEEDS.flatMap((seed) =>
      Array.from({ length: 6 }, (_, i) => new SpaceGenerator(seed).generate(i + 1)),
    );

  it('первое пространство одноэтажное, дальше бывает 1, 2 и 3 этажа', () => {
    for (const seed of SEEDS) expect(new SpaceGenerator(seed).generate(0).floorCount).toBe(1);
    const counts = new Set(all().map((space) => space.floorCount));
    expect(counts).toEqual(new Set([1, 2, 3]));
  });

  it('лестниц на одну меньше, чем этажей; дверь — на верхнем этаже', () => {
    for (const space of all()) {
      expect(space.stairs).toHaveLength(space.floorCount - 1);
      expect(space.exitFloor).toBe(space.floorCount - 1);
      space.stairs.forEach((stair, i) => expect(stair.lower).toBe(i));
    }
  });

  it('у лестницы свободно на обоих этажах, и на любой этаж можно дойти', () => {
    for (const space of all().filter((s) => s.floorCount > 1)) {
      for (const stair of space.stairs) {
        for (const floor of [stair.lower, stair.lower + 1]) {
          expect(space.floor(floor).colliders.some((c) => c.containsPoint(stair.position))).toBe(
            false,
          );
          expect(reachable(space, floor).contains(stair.position)).toBe(true);
        }
      }
      // С первого этажа до лестницы наверх можно дойти от старта.
      expect(reachable(space, 0).contains(space.stairs[0]!.position)).toBe(true);
      // Канистры есть на всех этажах и учтены вместе с этажом.
      expect(space.oilFloors).toHaveLength(space.oilSpawns.length);
    }
  });

  it('пролёт лестницы твёрдый, в своей клетке и не упирается в проём', () => {
    for (const space of all().filter((s) => s.floorCount > 1)) {
      for (const stair of space.stairs) {
        const block = stair.block();
        const [col, row] = space.grid.cellAt(stair.position);
        const cell = space.grid.cellBounds(col, row);
        // Внутри клетки (с запасом на полстены).
        expect(block.minX).toBeGreaterThanOrEqual(cell.minX + 0.1);
        expect(block.maxX).toBeLessThanOrEqual(cell.maxX - 0.1);
        expect(block.minY).toBeGreaterThanOrEqual(cell.minY + 0.1);
        expect(block.maxY).toBeLessThanOrEqual(cell.maxY - 0.1);
        for (const floor of [stair.lower, stair.lower + 1]) {
          // Пролёт — среди препятствий этажа (сквозь него не пройти).
          expect(space.floor(floor).colliders).toContainEqual(block);
          // Ни один проём этажа не перекрыт пролётом.
          for (const door of space.floor(floor).doors) {
            expect(block.expand(0.3).containsPoint(door.position)).toBe(false);
          }
        }
      }
    }
  });

  it('stairNear: снизу ведёт наверх, сверху — вниз, на другом этаже — ничего', () => {
    const space = all().find((s) => s.floorCount === 3)!;
    const [first, second] = space.stairs;
    expect(space.stairNear(0, first!.position, 0.5)?.to).toBe(1);
    expect(space.stairNear(1, first!.position, 0.5)?.to).toBe(0);
    expect(space.stairNear(1, second!.position, 0.5)?.to).toBe(2);
    expect(space.stairNear(2, first!.position, 0.5)).toBeNull();
  });
});

describe('RoomGraph', () => {
  it('путь начинается со старта и заканчивается целью', () => {
    const space = new SpaceGenerator(3).generate(2);
    const graph = new RoomGraph(space.rooms, space.doors);
    const path = graph.path(space.startRoom.id, space.exit.roomId);
    expect(path[0]).toBe(space.startRoom.id);
    expect(path.at(-1)).toBe(space.exit.roomId);
    expect(path.length - 1).toBe(graph.distancesFrom(space.startRoom.id).get(space.exit.roomId));
  });
});

describe('ExitPlanner: магнитофон', () => {
  const codeSpaces = (): Space[] =>
    SEEDS.flatMap((seed) =>
      Array.from({ length: 10 }, (_, i) => new SpaceGenerator(seed).generate(i + 1)),
    ).filter((space) => space.exit.kind === 'code');

  it('магнитофон бывает только у кода из цифр; у букв и фигур — записка', () => {
    const spaces = codeSpaces();
    const tapes = spaces.filter((space) => space.codeHint === 'tape');
    expect(tapes.length).toBeGreaterThan(3);
    expect(spaces.some((s) => s.code!.alphabet === 'digits' && s.codeHint === 'note')).toBe(true);
    for (const space of tapes) expect(space.code!.alphabet).toBe('digits');
  });

  it('у остальных дверей подсказка по умолчанию — записка (без кода её нет)', () => {
    const plain = new SpaceGenerator(1).generate(0);
    expect(plain.code).toBeNull();
    expect(plain.codeHint).toBe('note');
  });
});

describe('ExitDoor.reachableFrom', () => {
  it('перед дверью — можно, за стеной (с другой стороны) — нельзя', () => {
    for (const seed of SEEDS.slice(0, 10)) {
      const { exit } = new SpaceGenerator(seed).generate(2);
      expect(exit.reachableFrom(exit.frontPoint(0.6), 1.3)).toBe(true);
      // С обратной стороны стены, вплотную к ней.
      const behind = exit.position.sub(exit.normal.scale(0.4));
      expect(exit.position.distanceTo(behind)).toBeLessThan(1.3);
      expect(exit.reachableFrom(behind, 1.3)).toBe(false);
    }
  });
});

describe('Табличка-указатель', () => {
  const spaces = (): Space[] =>
    SEEDS.flatMap((seed) =>
      Array.from({ length: 6 }, (_, i) => new SpaceGenerator(seed).generate(i)),
    );

  it('одна на пространство, на стене стартовой комнаты, лицом в комнату, не в проёме', () => {
    for (const space of spaces()) {
      const sign = space.sign!;
      expect(sign).not.toBeNull();
      expect(['left', 'right']).toContain(sign.arrow);
      expect(sign.target).toBe(space.floorCount > 1 ? 'stairs' : 'exit');
      // Перед табличкой — комната первого этажа; за ней — стена.
      expect(space.roomAt(sign.position.add(sign.normal.scale(0.5)))).toBeDefined();
      expect(
        space.walls.some((wall) =>
          wall.bounds.containsPoint(sign.position.sub(sign.normal.scale(0.05))),
        ),
      ).toBe(true);
      for (const door of space.doors) {
        expect(door.position.distanceTo(sign.position)).toBeGreaterThan(0.7);
      }
    }
  });
});

describe('Флажки и гусь', () => {
  const many = (): Space[] =>
    SEEDS.flatMap((seed) =>
      Array.from({ length: 12 }, (_, i) => new SpaceGenerator(seed).generate(i + 1)),
    );

  it('флажки — примерно в 15 % пространств, по 1–2, на свободном месте своего этажа', () => {
    const spaces = many();
    const withFlags = spaces.filter((space) => space.flags.length > 0);
    expect(withFlags.length / spaces.length).toBeGreaterThan(0.07);
    expect(withFlags.length / spaces.length).toBeLessThan(0.25);
    for (const space of withFlags) {
      expect(space.flags.length).toBeLessThanOrEqual(2);
      for (const flag of space.flags) {
        expect(space.floor(flag.floor).colliders.some((c) => c.containsPoint(flag.position))).toBe(
          false,
        );
      }
    }
  });

  it('гусь — только у двери с ключом или кодом, примерно в 10 % таких', () => {
    const spaces = many();
    for (const space of spaces.filter((s) => s.goose)) {
      expect(['locked', 'code']).toContain(space.exit.kind);
    }
    const eligible = spaces.filter((s) => s.exit.kind !== 'plain');
    const share = eligible.filter((s) => s.goose).length / eligible.length;
    expect(share).toBeGreaterThan(0.03);
    expect(share).toBeLessThan(0.2);
  });
});
