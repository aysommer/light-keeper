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

  /**
   * Может ли игрок в этой точке взаимодействовать с дверью: рядом и именно перед
   * ней, со стороны комнаты. Из-за тонкой стены (а не перед дверью) — нельзя:
   * иначе за стеной появлялась бы подсказка двери, которой с этой стороны нет.
   */
  public reachableFrom(point: Vector2, distance: number): boolean {
    const offset = point.sub(this.position);
    const inFront = offset.x * this.normal.x + offset.y * this.normal.y;
    return inFront > ExitDoor.MIN_IN_FRONT && point.distanceTo(this.frontPoint()) <= distance;
  }

  /** Насколько игрок должен быть перед осевой линией стены, м (полстены + запас). */
  private static readonly MIN_IN_FRONT = 0.2;

  /** Точка перед дверью, от которой считаются расстояния взаимодействия. */
  public frontPoint(offset = 0.5): Vector2 {
    return this.position.add(this.normal.scale(offset));
  }
}
