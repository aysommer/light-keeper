/** Экран приложения (меню, игра, конец игры). */
export interface Screen {
  readonly element: HTMLElement;
  /** Вызывается после вставки `element` в документ. */
  mount(): void;
  /** Освобождает ресурсы перед удалением экрана. */
  dispose(): void;
}
