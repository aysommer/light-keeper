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
}
