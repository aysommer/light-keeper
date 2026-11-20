import { describe, expect, it } from 'vitest';
import type { SettingsStorage } from '../src/core/GraphicsSettings.ts';
import { GraphicsSettings } from '../src/core/GraphicsSettings.ts';

class MemoryStorage implements SettingsStorage {
  public readonly data = new Map<string, string>();
  public getItem(key: string): string | null {
    return this.data.get(key) ?? null;
  }
  public setItem(key: string, value: string): void {
    this.data.set(key, value);
  }
}

describe('GraphicsSettings', () => {
  it('по умолчанию все галочки выключены', () => {
    expect(new GraphicsSettings(new MemoryStorage()).options).toEqual({ antialias: false });
    expect(new GraphicsSettings(null).options.antialias).toBe(false);
  });

  it('сохраняет выбор и читает его при следующем запуске', () => {
    const storage = new MemoryStorage();
    new GraphicsSettings(storage).set('antialias', true);
    expect(new GraphicsSettings(storage).options.antialias).toBe(true);
  });

  it('сообщает подписчикам только о настоящих изменениях', () => {
    const settings = new GraphicsSettings(new MemoryStorage());
    const seen: boolean[] = [];
    const unsubscribe = settings.onChange((options) => seen.push(options.antialias));
    settings.set('antialias', true);
    settings.set('antialias', true);
    unsubscribe();
    settings.set('antialias', false);
    expect(seen).toEqual([true]);
  });

  it('повреждённая запись даёт значения по умолчанию', () => {
    for (const raw of ['{не json', '42', 'null', '{"antialias":"да"}']) {
      const storage = new MemoryStorage();
      storage.setItem('light-keeper:graphics', raw);
      expect(new GraphicsSettings(storage).options.antialias).toBe(false);
    }
  });

  it('недоступное хранилище не ломает игру', () => {
    const broken: SettingsStorage = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    };
    const settings = new GraphicsSettings(broken);
    expect(() => settings.set('antialias', true)).not.toThrow();
    expect(settings.options.antialias).toBe(true);
  });
});
