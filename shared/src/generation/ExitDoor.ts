import type { Vector2 } from '../math/Vector2.ts';
import type { GridEdge } from './GridEdge.ts';

/**
 * Тип двери выхода (все двери видны сразу — невидимых дверей нет):
 * - `plain` — обычная дверь, рядом подсказка (свет из-под двери);
 * - `locked` — запертая: нужно найти 1–3 ключа и вставить их в замок;
 * - `code` — с кодовой панелью: код записан в записке, спрятанной в пространстве.
 */
export type ExitKind = 'plain' | 'locked' | 'code';

/** Дверь выхода в стене комнаты. Это не проём: стена за ней остаётся сплошной. */
export class ExitDoor {
  public constructor(
    public readonly kind: ExitKind,
    /** Ребро сетки, на котором висит дверь. */
    public readonly edge: GridEdge,
    /** Середина двери на осевой линии стены. */
    public readonly position: Vector2,
    /** Единичный вектор нормали — из стены внутрь комнаты. */
    public readonly normal: Vector2,
    public readonly roomId: string,
  ) {}

  /** Точка перед дверью, от которой считаются расстояния взаимодействия. */
  public frontPoint(offset = 0.5): Vector2 {
    return this.position.add(this.normal.scale(offset));
  }
}
