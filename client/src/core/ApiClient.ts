import { ProtocolGuard, RecordRanking } from '@light-keeper/shared';
import type { HealthResponse, RecordEntry } from '@light-keeper/shared';

/** HTTP-клиент игрового сервера. */
export class ApiClient {
  public constructor(private readonly baseUrl: string = '/api') {}

  public async getHealth(): Promise<HealthResponse> {
    const response = await fetch(`${this.baseUrl}/health`);
    if (!response.ok) {
      throw new Error(`Сервер ответил ${response.status}`);
    }
    const body: unknown = await response.json();
    if (!ProtocolGuard.isHealthResponse(body)) {
      throw new Error('Некорректный ответ /health');
    }
    return body;
  }

  public async getRecords(): Promise<RecordEntry[]> {
    const response = await fetch(`${this.baseUrl}/records`);
    if (!response.ok) {
      throw new Error(`Сервер ответил ${response.status}`);
    }
    const body: unknown = await response.json();
    if (!RecordRanking.isRecordsResponse(body)) {
      throw new Error('Некорректный ответ /records');
    }
    return [...body.records];
  }
}
