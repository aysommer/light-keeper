import type { Scene } from 'three';
import type { WorldLayout } from '@light-keeper/shared';
import type { ChunkMeshBuilder } from './ChunkMeshBuilder.ts';
import type { ChunkView } from './ChunkView.ts';

/** Подгружает чанки вокруг игрока и выгружает пройденные. */
export class WorldRenderer {
  private readonly views = new Map<number, ChunkView>();

  public constructor(
    private readonly scene: Scene,
    private readonly world: WorldLayout,
    private readonly builder: ChunkMeshBuilder,
    /** Сколько чанков держать позади игрока. */
    private readonly chunksBehind = 1,
    /** Сколько чанков держать впереди игрока. */
    private readonly chunksAhead = 2,
  ) {}

  public get loadedChunks(): number[] {
    return [...this.views.keys()].sort((a, b) => a - b);
  }

  public update(viewerY: number): void {
    const current = this.world.chunkIndexAt(viewerY);
    const first = Math.max(0, current - this.chunksBehind);
    const last = current + this.chunksAhead;

    for (const [index, view] of this.views) {
      if (index < first || index > last) {
        view.dispose();
        this.views.delete(index);
      }
    }
    for (let index = first; index <= last; index++) {
      if (!this.views.has(index)) {
        const view = this.builder.build(this.world.getChunk(index));
        this.scene.add(view.group);
        this.views.set(index, view);
      }
    }
  }

  public dispose(): void {
    this.views.forEach((view) => view.dispose());
    this.views.clear();
  }
}
