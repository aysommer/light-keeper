/** Ответ эндпоинта `/health`. */
export interface HealthResponse {
  readonly status: 'ok';
  readonly service: 'light-keeper-api';
  readonly protocolVersion: number;
  /** Время работы сервера в секундах. */
  readonly uptime: number;
}

/** Проверки формы входящих данных протокола. */
export class ProtocolGuard {
  public static isHealthResponse(value: unknown): value is HealthResponse {
    if (typeof value !== 'object' || value === null) {
      return false;
    }
    const candidate = value as Record<string, unknown>;
    return (
      candidate['status'] === 'ok' &&
      candidate['service'] === 'light-keeper-api' &&
      typeof candidate['protocolVersion'] === 'number' &&
      typeof candidate['uptime'] === 'number'
    );
  }
}
