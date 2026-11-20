import { describe, expect, it } from 'vitest';
import { GameConfig, PlayerMovement, Vector2 } from '@light-keeper/shared';
import type { PlayerInput, ServerMessage } from '@light-keeper/shared';
import { Match } from '../src/game/Match.ts';
import type { LobbyParticipant } from '../src/lobby/LobbyParticipant.ts';

class FakeParticipant implements LobbyParticipant {
  public readonly inbox: ServerMessage[] = [];
  public constructor(public readonly id: string) {}
  public send(message: ServerMessage): void {
    this.inbox.push(message);
  }
}

type Id = 'red' | 'blue';
const settings = GameConfig.exchange;

const setup = () => {
  let now = 0;
  const match = new Match(
    777,
    [
      { participant: new FakeParticipant('red'), color: 'red' },
      { participant: new FakeParticipant('blue'), color: 'blue' },
    ],
    { tickRate: 20, now: () => now },
  );
  const player = (id: Id) => match.world.players.get(id)!;
  const seq = { red: 0, blue: 0 };
  const yaw = { red: 0, blue: 0 };

  /** Поставить игроков в стартовую комнату в 1.2 м друг от друга лицом к лицу. */
  const faceEachOther = (): void => {
    const center = match.world.space.startPositions[0]
      .add(match.world.space.startPositions[1])
      .scale(0.5);
    player('red').position = center.add(new Vector2(-0.6, 0));
    player('blue').position = center.add(new Vector2(0.6, 0));
    yaw.red = PlayerMovement.yawTowards(new Vector2(1, 0));
    yaw.blue = PlayerMovement.yawTowards(new Vector2(-1, 0));
  };
  const tick = (interact: Partial<Record<Id, boolean>> = {}): void => {
    for (const id of ['red', 'blue'] as const) {
      const command: PlayerInput = {
        seq: ++seq[id],
        dt: 0.05,
        moveX: 0,
        moveY: 0,
        yaw: yaw[id],
        pitch: 0,
        run: false,
        interact: interact[id] ?? false,
        item: 'lamp',
        refuel: false,
        space: match.world.spaceIndex,
      };
      match.receiveInput(id, [command]);
    }
    now += 50;
    match.step();
  };
  /** Нажать и отпустить E. */
  const press = (id: Id): void => {
    tick({ [id]: true });
    tick();
  };
  return { match, player, yaw, faceEachOther, tick, press };
};

describe('ExchangeSystem', () => {
  it('предложение и ответ — лампы меняются руками и остывают', () => {
    const ctx = setup();
    ctx.faceEachOther();
    ctx.tick();
    const redLamp = ctx.player('red').lamp;
    const blueLamp = ctx.player('blue').lamp;
    redLamp.heat = 80;
    redLamp.holdSeconds = 30;
    blueLamp.heat = 10;

    ctx.press('red');
    expect(ctx.match.world.exchange.offerFromId).toBe('red');
    expect(ctx.player('red').lamp).toBe(redLamp);
    ctx.press('blue');

    expect(ctx.player('red').lamp).toBe(blueLamp);
    expect(ctx.player('blue').lamp).toBe(redLamp);
    expect(redLamp.holdSeconds).toBeLessThan(0.2);
    expect(redLamp.heat).toBeLessThan(80 - settings.heatRelief + 2);
    expect(ctx.match.world.exchange.count).toBe(1);
    expect(ctx.match.world.exchange.offerFromId).toBeNull();
  });

  it('одновременное нажатие тоже меняет лампы', () => {
    const ctx = setup();
    ctx.faceEachOther();
    const redLamp = ctx.player('red').lamp;
    ctx.tick({ red: true, blue: true });
    expect(ctx.player('blue').lamp).toBe(redLamp);
  });

  it('без ответа предложение пропадает', () => {
    const ctx = setup();
    ctx.faceEachOther();
    const redLamp = ctx.player('red').lamp;
    ctx.press('red');
    for (let i = 0; i < Math.ceil(settings.offerSeconds * 20) + 2; i++) ctx.tick();
    expect(ctx.match.world.exchange.offerFromId).toBeNull();
    ctx.press('blue'); // теперь это новое предложение, а не ответ
    expect(ctx.player('red').lamp).toBe(redLamp);
    expect(ctx.match.world.exchange.offerFromId).toBe('blue');
  });

  it('повторное нажатие предложившего — не обмен', () => {
    const ctx = setup();
    ctx.faceEachOther();
    const redLamp = ctx.player('red').lamp;
    ctx.press('red');
    ctx.press('red');
    expect(ctx.player('red').lamp).toBe(redLamp);
  });

  it('нужно смотреть на напарника', () => {
    const ctx = setup();
    ctx.faceEachOther();
    ctx.yaw.blue += Math.PI; // голубой отвернулся
    const redLamp = ctx.player('red').lamp;
    ctx.press('red');
    ctx.press('blue');
    expect(ctx.player('red').lamp).toBe(redLamp);
    expect(ctx.player('blue').aimingAtPartner).toBe(false);
  });

  it('далеко или в тамбуре — обмена нет', () => {
    const ctx = setup();
    ctx.faceEachOther();
    ctx.player('blue').position = ctx.player('blue').position.add(new Vector2(3, 0));
    ctx.tick();
    expect(ctx.player('red').aimingAtPartner).toBe(false);

    ctx.faceEachOther();
    ctx.player('blue').inTambour = true;
    ctx.tick();
    expect(ctx.player('red').aimingAtPartner).toBe(false);
  });

  it('после обмена — пауза', () => {
    const ctx = setup();
    ctx.faceEachOther();
    ctx.tick({ red: true, blue: true });
    ctx.tick();
    ctx.tick({ red: true, blue: true });
    expect(ctx.match.world.exchange.count).toBe(1);
    for (let i = 0; i < settings.cooldownSeconds * 20; i++) ctx.tick();
    ctx.tick({ red: true, blue: true });
    expect(ctx.match.world.exchange.count).toBe(2);
  });

  it('перегретая лампа после обмена может сразу загореться, если остыла достаточно', () => {
    const ctx = setup();
    ctx.faceEachOther();
    const lamp = ctx.player('red').lamp;
    lamp.heat = GameConfig.lamp.relightHeat + settings.heatRelief - 5;
    lamp.overheated = true;
    ctx.tick({ red: true, blue: true });
    expect(lamp.overheated).toBe(false);
  });

  it('снимок сообщает о предложении и количестве обменов', () => {
    const ctx = setup();
    ctx.faceEachOther();
    ctx.press('red');
    const last = () =>
      (ctx.match.world.players.get('blue')!.participant as FakeParticipant).inbox
        .filter((m) => m.type === 'match:snapshot')
        .at(-1);
    const offered = last();
    expect(offered?.type === 'match:snapshot' && offered.snapshot.exchange.offerFromId).toBe('red');
    ctx.press('blue');
    const done = last();
    expect(done?.type === 'match:snapshot' && done.snapshot.exchange.count).toBe(1);
  });
});

describe('ExchangeSystem и дверь', () => {
  it('смотришь на напарника у двери — E значит обмен, а не дверь', () => {
    const ctx = setup();
    const front = ctx.match.world.space.exit.frontPoint(0.6);
    const normal = ctx.match.world.space.exit.normal;
    const side = new Vector2(-normal.y, normal.x);
    ctx.player('red').position = front.add(side.scale(-0.5));
    ctx.player('blue').position = front.add(side.scale(0.5));
    ctx.yaw.red = PlayerMovement.yawTowards(side);
    ctx.yaw.blue = PlayerMovement.yawTowards(side.scale(-1));
    for (let i = 0; i < 80; i++) ctx.tick({ red: true });
    expect(ctx.match.world.exit.openSeconds).toBe(0);
    expect(ctx.match.world.exit.open).toBe(false);
  });
});
