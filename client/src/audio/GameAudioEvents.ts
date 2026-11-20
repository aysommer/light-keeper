import type { SpacePhase } from '@light-keeper/shared';

/** Что важно для звука в текущем кадре. */
export interface AudioFrame {
  readonly spaceIndex: number;
  readonly phase: SpacePhase;
  readonly inTambour: boolean;
  readonly exitOpen: boolean;
  readonly keyHolderId: string | null;
  readonly canisters: number;
  readonly overheated: boolean;
  readonly exchangeCount: number;
}

/** Разовые звуковые события, найденные по изменению состояния. */
export type AudioEvent =
  | 'door-open'
  | 'tambour'
  | 'key'
  | 'canister-pickup'
  | 'refuel-done'
  | 'overheat'
  | 'exchange'
  | 'transition';

/**
 * Находит события по разнице между кадрами: дверь открылась, лампы обменяли,
 * подобрали канистру и т. п. Первый кадр — точка отсчёта, событий не даёт.
 * При смене пространства всё начинается заново (без ложных событий).
 */
export class GameAudioEvents {
  private previous: AudioFrame | null = null;

  public update(frame: AudioFrame): AudioEvent[] {
    const before = this.previous;
    this.previous = frame;
    if (!before) {
      return [];
    }
    const events: AudioEvent[] = [];
    if (frame.phase === 'transition' && before.phase !== 'transition') {
      events.push('transition');
    }
    if (frame.spaceIndex !== before.spaceIndex) {
      return events;
    }
    if (frame.exitOpen && !before.exitOpen) events.push('door-open');
    if (frame.inTambour && !before.inTambour) events.push('tambour');
    if (frame.keyHolderId !== null && before.keyHolderId === null) events.push('key');
    if (frame.canisters > before.canisters) events.push('canister-pickup');
    if (frame.canisters < before.canisters) events.push('refuel-done');
    if (frame.overheated && !before.overheated) events.push('overheat');
    if (frame.exchangeCount > before.exchangeCount) events.push('exchange');
    return events;
  }
}
