import { PROTOCOL_VERSION } from '@light-keeper/shared';
import type { ApiClient } from '../core/ApiClient.ts';

/** Плашка с состоянием соединения с сервером. */
export class ServerStatusIndicator {
  public readonly element: HTMLElement;

  public constructor(private readonly api: ApiClient) {
    this.element = document.createElement('div');
    this.element.className = 'server-status';
    this.element.textContent = 'Проверяю сервер…';
  }

  public async refresh(): Promise<void> {
    try {
      const health = await this.api.getHealth();
      if (health.protocolVersion !== PROTOCOL_VERSION) {
        this.show(false, `Версии протокола не совпадают: ${health.protocolVersion}`);
        return;
      }
      this.show(true, `Сервер на связи · протокол v${health.protocolVersion}`);
    } catch {
      this.show(false, 'Сервер недоступен');
    }
  }

  private show(ok: boolean, text: string): void {
    this.element.classList.toggle('server-status--ok', ok);
    this.element.classList.toggle('server-status--bad', !ok);
    this.element.textContent = text;
  }
}
