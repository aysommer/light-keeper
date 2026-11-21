import type { HeldItem } from './HeldItem.ts';

/**
 * Команда ввода игрока за один кадр клиента. Сервер и клиент применяют её
 * одинаково (см. PlayerMovement), поэтому клиент может предсказывать движение.
 */
export interface PlayerInput {
  /** Порядковый номер команды; растёт на клиенте. */
  readonly seq: number;
  /** Длительность кадра, с. */
  readonly dt: number;
  /** Движение вбок: −1 влево, 1 вправо. */
  readonly moveX: number;
  /** Движение вперёд-назад: 1 вперёд, −1 назад. */
  readonly moveY: number;
  /** Поворот головы вокруг вертикали, рад. 0 — вперёд по пути (+y мира). */
  readonly yaw: number;
  /** Наклон головы, рад. */
  readonly pitch: number;
  readonly run: boolean;
  /** Зажата клавиша действия (`E`): открыть дверь, войти в неё. */
  readonly interact: boolean;
  /** Что игрок держит в руке. */
  readonly item: HeldItem;
  /** Зажата клавиша заправки (`R`). */
  readonly refuel: boolean;
  /** Номер пространства, в котором сформирована команда. Чужие команды сервер не двигает. */
  readonly space: number;
  /** Этаж, на котором сформирована команда. Команды с другого этажа сервер не двигает. */
  readonly floor: number;
}
