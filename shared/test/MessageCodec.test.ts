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
