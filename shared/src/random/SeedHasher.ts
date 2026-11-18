/**
 * Детерминированное хеширование набора значений в 32-битный seed.
 * Нужно, чтобы получать независимые seed для чанков, границ и комнат
 * из одного seed партии: `hash(seed, 'chunk', 7)`.
 */
export class SeedHasher {
  private static readonly FNV_OFFSET = 0x811c9dc5;
  private static readonly FNV_PRIME = 0x01000193;

  public static hash(...parts: ReadonlyArray<string | number>): number {
    let hash = SeedHasher.FNV_OFFSET;
    for (const part of parts) {
      const text = `${typeof part}:${part}|`;
      for (let i = 0; i < text.length; i++) {
        hash ^= text.charCodeAt(i);
        hash = Math.imul(hash, SeedHasher.FNV_PRIME);
      }
    }
    return SeedHasher.avalanche(hash);
  }

  /** Финализатор MurmurHash3: хорошо перемешивает биты. */
  private static avalanche(value: number): number {
    let h = value;
    h ^= h >>> 16;
    h = Math.imul(h, 0x85ebca6b);
    h ^= h >>> 13;
    h = Math.imul(h, 0xc2b2ae35);
    h ^= h >>> 16;
    return h >>> 0;
  }
}
