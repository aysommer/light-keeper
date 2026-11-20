import type { Scene } from 'three';
import { Vector2 } from '@light-keeper/shared';
import type { GhostSnapshot } from '@light-keeper/shared';
import { RemotePlayerTrack } from '../network/RemotePlayerTrack.ts';
import { GhostModel } from '../scene/GhostModel.ts';
import { SceneCoords } from '../scene/SceneCoords.ts';

interface GhostEntry {
  readonly model: GhostModel;
  readonly track: RemotePlayerTrack;
  fading: boolean;
  /** Где привидение нарисовано сейчас. */
  position: Vector2 | null;
}

/** Привидения на сцене: появляются, плавно движутся по снимкам сервера, исчезают. */
export class GhostsView {
  private readonly ghosts = new Map<number, GhostEntry>();

  public constructor(private readonly scene: Scene) {}

  /** Учесть снимок: новые привидения создать, пропавшие убрать. */
  public push(serverTime: number, ghosts: readonly GhostSnapshot[]): void {
    const alive = new Set<number>();
    for (const ghost of ghosts) {
      alive.add(ghost.id);
      let entry = this.ghosts.get(ghost.id);
      if (!entry) {
        const model = new GhostModel();
        model.root.visible = false;
        this.scene.add(model.root);
        entry = { model, track: new RemotePlayerTrack(), fading: false, position: null };
        this.ghosts.set(ghost.id, entry);
      }
      entry.fading = ghost.fading;
      entry.track.push(serverTime, { position: new Vector2(ghost.x, ghost.y), yaw: 0, pitch: 0 });
    }
    for (const [id, entry] of this.ghosts) {
      if (!alive.has(id)) {
        entry.model.dispose();
        this.ghosts.delete(id);
      }
    }
  }

  /** @param viewer где стоит этот игрок — привидения смотрят на него */
  public update(renderTime: number, time: number, deltaSeconds: number, viewer: Vector2): void {
    for (const entry of this.ghosts.values()) {
      const state = entry.track.sample(renderTime);
      if (!state) continue;
      entry.position = state.position;
      entry.model.root.visible = true;
      entry.model.root.position.copy(SceneCoords.toScene(state.position));
      // В сцене мир y → −Z, поэтому знак у y-компоненты обратный.
      const facing = Math.atan2(viewer.x - state.position.x, -(viewer.y - state.position.y));
      entry.model.update(time, deltaSeconds, entry.fading, facing);
    }
  }

  /** Расстояние до ближайшего опасного (не растворяющегося) привидения, м. */
  public nearestThreat(from: Vector2): number | null {
    let nearest: number | null = null;
    for (const entry of this.ghosts.values()) {
      if (entry.fading || !entry.position) continue;
      const distance = entry.position.distanceTo(from);
      nearest = nearest === null ? distance : Math.min(nearest, distance);
    }
    return nearest;
  }

  public clear(): void {
    this.ghosts.forEach((entry) => entry.model.dispose());
    this.ghosts.clear();
  }
}
