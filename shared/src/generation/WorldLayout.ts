import type { Chunk } from './Chunk.ts';
import type { ChunkGenerator } from './ChunkGenerator.ts';

/**
 * Ленивый доступ к чанкам бесконечного мира с LRU-кешем.
 * Используется и сервером (коллизии, спавн), и клиентом (рендер).
 */
export class WorldLayout {
  private readonly cache = new Map<number, Chunk>();

  public constructor(
    private readonly generator: ChunkGenerator,
    private readonly maxCachedChunks = 8,
  ) {}

  public get chunkLength(): number {
    return this.generator.chunkLength;
  }

  public chunkIndexAt(y: number): number {
    return Math.max(0, Math.floor(y / this.generator.chunkLength));
  }

  public getChunk(index: number): Chunk {
    const cached = this.cache.get(index);
    if (cached) {
      // Перемещаем в конец — «недавно использованный».
      this.cache.delete(index);
      this.cache.set(index, cached);
      return cached;
    }
    const chunk = this.generator.generate(index);
    this.cache.set(index, chunk);
    this.evict();
    return chunk;
  }

  /** Чанки, пересекающие отрезок `[fromY, toY]` вдоль пути. */
  public getChunksBetween(fromY: number, toY: number): Chunk[] {
    const first = this.chunkIndexAt(Math.min(fromY, toY));
    const last = this.chunkIndexAt(Math.max(fromY, toY));
    const chunks: Chunk[] = [];
    for (let index = first; index <= last; index++) {
      chunks.push(this.getChunk(index));
    }
    return chunks;
  }

  private evict(): void {
    while (this.cache.size > this.maxCachedChunks) {
      const oldest = this.cache.keys().next();
      if (oldest.done) {
        return;
      }
      this.cache.delete(oldest.value);
    }
  }
}
