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
  floor: number;
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
        entry = {
          model,
          track: new RemotePlayerTrack(),
          fading: false,
          floor: ghost.floor,
          position: null,
        };
        this.ghosts.set(ghost.id, entry);
      }
      entry.fading = ghost.fading;
      entry.floor = ghost.floor;
      entry.track.push(serverTime, { position: new Vector2(ghost.x, ghost.y), yaw: 0, pitch: 0 });
    }
    for (const [id, entry] of this.ghosts) {
      if (!alive.has(id)) {
        entry.model.dispose();
        this.ghosts.delete(id);
      }
    }
  }

  private viewerFloor = 0;

  /**
   * @param viewer где стоит этот игрок — привидения смотрят на него
   * @param viewerFloor его этаж — пугают и слышны только привидения этого этажа
   */
  public update(
    renderTime: number,
    time: number,
    deltaSeconds: number,
    viewer: Vector2,
    viewerFloor = 0,
  ): void {
    this.viewerFloor = viewerFloor;
    for (const entry of this.ghosts.values()) {
      const state = entry.track.sample(renderTime);
      if (!state) continue;
      entry.position = state.position;
      entry.model.root.visible = true;
      entry.model.root.position.copy(SceneCoords.toScene(state.position, 0, entry.floor));
      // В сцене мир y → −Z, поэтому знак у y-компоненты обратный.
      const facing = Math.atan2(viewer.x - state.position.x, -(viewer.y - state.position.y));
      entry.model.update(time, deltaSeconds, entry.fading, facing);
    }
  }

  /** Привидения, видимые сейчас (для звука). */
  public list(): Array<{ id: number; position: Vector2; fading: boolean }> {
    const result: Array<{ id: number; position: Vector2; fading: boolean }> = [];
    for (const [id, entry] of this.ghosts) {
      if (entry.position && entry.floor === this.viewerFloor)
        result.push({ id, position: entry.position, fading: entry.fading });
    }
    return result;
  }

  /** Расстояние до ближайшего опасного (не растворяющегося) привидения, м. */
  public nearestThreat(from: Vector2): number | null {
    let nearest: number | null = null;
    for (const entry of this.ghosts.values()) {
      if (entry.fading || !entry.position || entry.floor !== this.viewerFloor) continue;
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
