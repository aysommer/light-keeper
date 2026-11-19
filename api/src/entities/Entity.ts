import type { Vector2 } from '@light-keeper/shared';

/** Базовая сущность мира на сервере. */
export abstract class Entity {
  protected constructor(
    public readonly id: string,
    public position: Vector2,
  ) {}
}
