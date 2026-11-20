import type { ExchangeSnapshot } from '@light-keeper/shared';

/** Состояние обмена лампами: висящее предложение, пауза после обмена, счётчик. */
export class ExchangeState {
  public offerFromId: string | null = null;
  public offerSecondsLeft = 0;
  public cooldownLeft = 0;
  public count = 0;

  public clearOffer(): void {
    this.offerFromId = null;
    this.offerSecondsLeft = 0;
  }

  public snapshot(): ExchangeSnapshot {
    return { offerFromId: this.offerFromId, count: this.count };
  }
}
