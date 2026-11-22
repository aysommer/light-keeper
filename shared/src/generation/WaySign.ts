import type { Vector2 } from '../math/Vector2.ts';

/** Куда указывает табличка: к лестнице на верхний этаж или к двери выхода. */
export type WaySignTarget = 'stairs' | 'exit';

/**
 * Табличка-указатель на стене стартовой комнаты (одна на пространство):
 * стрелка влево или вправо — к проёму, через который короче всего идти
 * к лестнице (если этажей несколько) или к двери выхода.
 */
export class WaySign {
  public constructor(
    /** Точка на поверхности стены (по осевой линии стены + полстены). */
    public readonly position: Vector2,
    /** Нормаль стены внутрь комнаты (табличка смотрит в комнату). */
    public readonly normal: Vector2,
    /** Стрелка — для того, кто смотрит на табличку. */
    public readonly arrow: 'left' | 'right',
    public readonly target: WaySignTarget,
  ) {}
}
