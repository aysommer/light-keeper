import { describe, expect, it } from 'vitest';
import { PROTOCOL_VERSION, ProtocolGuard } from '../src/index.ts';

describe('ProtocolGuard.isHealthResponse', () => {
  it('принимает корректный ответ', () => {
    expect(
      ProtocolGuard.isHealthResponse({
        status: 'ok',
        service: 'light-keeper-api',
        protocolVersion: PROTOCOL_VERSION,
        uptime: 12.5,
      }),
    ).toBe(true);
  });

  it.each([null, undefined, 42, 'ok', {}, { status: 'ok' }])('отклоняет %j', (value) => {
    expect(ProtocolGuard.isHealthResponse(value)).toBe(false);
  });
});
