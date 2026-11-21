import { describe, expect, it } from 'vitest';
import { LobbyCode, MessageCodec } from '../src/index.ts';

const codec = new MessageCodec();
const decode = (value: unknown): unknown => codec.decodeClientMessage(JSON.stringify(value));

describe('MessageCodec.decodeClientMessage', () => {
  it('принимает корректные сообщения', () => {
    expect(decode({ type: 'hello', protocolVersion: 2 })).toEqual({
      type: 'hello',
      protocolVersion: 2,
    });
    expect(decode({ type: 'lobby:create' })).toEqual({ type: 'lobby:create' });
    expect(decode({ type: 'lobby:ready', ready: true })).toEqual({
      type: 'lobby:ready',
      ready: true,
    });
    expect(decode({ type: 'ping', sentAt: 123 })).toEqual({ type: 'ping', sentAt: 123 });
    expect(decode({ type: 'debug:next-space' })).toEqual({ type: 'debug:next-space' });
    expect(decode({ type: 'debug:goto', target: 'key' })).toEqual({
      type: 'debug:goto',
      target: 'key',
    });
    expect(decode({ type: 'debug:goto', target: 'moon' })).toBeNull();
    expect(decode({ type: 'debug:lamp', preset: 'hot' })).toEqual({
      type: 'debug:lamp',
      preset: 'hot',
    });
    expect(decode({ type: 'debug:lamp', preset: 'cold' })).toBeNull();
  });

  it('нормализует код комнаты', () => {
    expect(decode({ type: 'lobby:join', code: ' abcd ' })).toEqual({
      type: 'lobby:join',
      code: 'ABCD',
    });
  });

  it('отбрасывает лишние поля', () => {
    expect(decode({ type: 'lobby:create', admin: true })).toEqual({ type: 'lobby:create' });
  });

  it.each([
    'не json',
    '[]',
    'null',
    '42',
    JSON.stringify({ type: 'unknown' }),
    JSON.stringify({ type: 'hello' }),
    JSON.stringify({ type: 'hello', protocolVersion: '2' }),
    JSON.stringify({ type: 'lobby:join', code: 'AB' }),
    JSON.stringify({ type: 'lobby:join', code: 'AB1D' }),
    JSON.stringify({ type: 'lobby:join', code: 42 }),
    JSON.stringify({ type: 'lobby:ready', ready: 'yes' }),
    JSON.stringify({ type: 'ping', sentAt: null }),
    JSON.stringify({ type: 'ping', sentAt: 1, padding: 'x'.repeat(5000) }),
  ])('отклоняет %s', (raw) => {
    expect(codec.decodeClientMessage(raw)).toBeNull();
  });
});

describe('MessageCodec.decodeServerMessage', () => {
  it('принимает известные типы и отклоняет неизвестные', () => {
    expect(codec.decodeServerMessage(JSON.stringify({ type: 'lobby:left' }))).toEqual({
      type: 'lobby:left',
    });
    expect(codec.decodeServerMessage(JSON.stringify({ type: 'hack' }))).toBeNull();
    expect(codec.decodeServerMessage('{')).toBeNull();
  });
});

describe('LobbyCode', () => {
  it('заменяет кириллических двойников и поднимает регистр', () => {
    expect(LobbyCode.normalize('мак')).toBe('MAK');
    expect(LobbyCode.normalize('ТЕМА')).toBe('TEMA');
  });

  it('проверяет формат', () => {
    expect(LobbyCode.isValid('ABCD')).toBe(true);
    expect(LobbyCode.isValid('ABCI')).toBe(false); // I исключена
    expect(LobbyCode.isValid('ABC')).toBe(false);
    expect(LobbyCode.isValid('abcd')).toBe(false);
  });
});

describe('MessageCodec: код двери и предметы в руке', () => {
  const codec = new MessageCodec();

  it('ввод кода: массив коротких строк', () => {
    expect(codec.decodeClientMessage('{"type":"exit:code","code":["1","2","3","4"]}')).toEqual({
      type: 'exit:code',
      code: ['1', '2', '3', '4'],
    });
    expect(
      codec.decodeClientMessage('{"type":"exit:code","code":["circle","star","moon","heart"]}'),
    ).not.toBeNull();
  });

  it('ввод кода: мусор отбрасывается', () => {
    for (const raw of [
      '{"type":"exit:code"}',
      '{"type":"exit:code","code":"1234"}',
      '{"type":"exit:code","code":[1,2,3,4]}',
      '{"type":"exit:code","code":[""]}',
      '{"type":"exit:code","code":["very-long-symbol"]}',
      `{"type":"exit:code","code":${JSON.stringify(Array(20).fill('1'))}}`,
    ]) {
      expect(codec.decodeClientMessage(raw), raw).toBeNull();
    }
  });

  it('в руке может быть ключ или записка, но не что попало', () => {
    const command = (item: string) =>
      JSON.stringify({
        type: 'input',
        commands: [
          {
            seq: 1,
            dt: 0.05,
            moveX: 0,
            moveY: 0,
            yaw: 0,
            pitch: 0,
            run: false,
            interact: false,
            item,
            refuel: false,
            space: 0,
            floor: 0,
          },
        ],
      });
    expect(codec.decodeClientMessage(command('key'))).not.toBeNull();
    expect(codec.decodeClientMessage(command('note'))).not.toBeNull();
    expect(codec.decodeClientMessage(command('sword'))).toBeNull();
  });
});
