import { Vector2 } from '@light-keeper/shared';

export interface RemotePlayerState {
  readonly position: Vector2;
  readonly yaw: number;
  readonly pitch: number;
}

interface TimedState extends RemotePlayerState {
  readonly time: number;
}

/**
 * История состояний чужого игрока. Отрисовка идёт «в прошлом» — между двумя
 * известными снимками, поэтому движение плавное несмотря на 20 снимков в секунду.
 */
export class RemotePlayerTrack {
  private static readonly MAX_STATES = 32;
  private readonly states: TimedState[] = [];

  /** Забыть историю (напарник перенесён в новое пространство — интерполировать нечего). */
  public clear(): void {
    this.states.length = 0;
  }

  public push(time: number, state: RemotePlayerState): void {
    const last = this.states.at(-1);
    if (last && time <= last.time) {
      return;
    }
    this.states.push({ ...state, time });
    if (this.states.length > RemotePlayerTrack.MAX_STATES) {
      this.states.shift();
    }
  }

  /** Состояние на момент `time`; вне истории — ближайшее известное. */
  public sample(time: number): RemotePlayerState | null {
    const first = this.states[0];
    const last = this.states.at(-1);
    if (!first || !last) {
      return null;
    }
    if (time <= first.time) return first;
    if (time >= last.time) return last;

    for (let i = 1; i < this.states.length; i++) {
      const to = this.states[i]!;
      if (to.time >= time) {
        const from = this.states[i - 1]!;
        const t = (time - from.time) / (to.time - from.time);
        return {
          position: new Vector2(
            from.position.x + (to.position.x - from.position.x) * t,
            from.position.y + (to.position.y - from.position.y) * t,
          ),
          yaw: RemotePlayerTrack.lerpAngle(from.yaw, to.yaw, t),
          pitch: from.pitch + (to.pitch - from.pitch) * t,
        };
      }
    }
    return last;
  }

  /** Интерполяция угла по кратчайшей дуге. */
  public static lerpAngle(from: number, to: number, t: number): number {
    const delta = Math.atan2(Math.sin(to - from), Math.cos(to - from));
    return from + delta * t;
  }
}
