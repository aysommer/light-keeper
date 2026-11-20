/** Галочки графики. По умолчанию все выключены. */
export interface GraphicsOptions {
  /** Сглаживание краёв (мультисэмплинг). */
  readonly antialias: boolean;
}

/** Где хранить настройки (в браузере — localStorage; в тестах — заглушка). */
export interface SettingsStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/**
 * Настройки графики этого браузера: читаются при запуске, сохраняются при
 * изменении, подписчики узнают об изменениях сразу (применяются без перезагрузки).
 * На сервер ничего не уходит — сетевой игры настройки не касаются.
 */
export class GraphicsSettings {
  public static readonly DEFAULTS: GraphicsOptions = { antialias: false };
  private static readonly STORAGE_KEY = 'light-keeper:graphics';

  private current: GraphicsOptions;
  private readonly listeners = new Set<(options: GraphicsOptions) => void>();

  public constructor(
    private readonly storage: SettingsStorage | null = GraphicsSettings.browserStorage(),
  ) {
    this.current = this.load();
  }

  public get options(): GraphicsOptions {
    return this.current;
  }

  public set<K extends keyof GraphicsOptions>(key: K, value: GraphicsOptions[K]): void {
    if (this.current[key] === value) {
      return;
    }
    this.current = { ...this.current, [key]: value };
    try {
      this.storage?.setItem(GraphicsSettings.STORAGE_KEY, JSON.stringify(this.current));
    } catch {
      // Хранилище недоступно — настройка живёт до перезагрузки.
    }
    this.listeners.forEach((listener) => listener(this.current));
  }

  /** Подписка на изменения; возвращает функцию отписки. */
  public onChange(listener: (options: GraphicsOptions) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private load(): GraphicsOptions {
    try {
      const raw = this.storage?.getItem(GraphicsSettings.STORAGE_KEY);
      const saved: unknown = raw ? JSON.parse(raw) : null;
      if (typeof saved === 'object' && saved !== null) {
        const record = saved as Record<string, unknown>;
        return {
          antialias:
            typeof record['antialias'] === 'boolean'
              ? record['antialias']
              : GraphicsSettings.DEFAULTS.antialias,
        };
      }
    } catch {
      // Повреждённая запись — берём значения по умолчанию.
    }
    return GraphicsSettings.DEFAULTS;
  }

  private static browserStorage(): SettingsStorage | null {
    try {
      return typeof localStorage === 'undefined' ? null : localStorage;
    } catch {
      return null;
    }
  }
}
