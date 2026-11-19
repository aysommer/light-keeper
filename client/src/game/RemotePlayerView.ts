import type { Scene } from 'three';
import type { PlayerColor } from '@light-keeper/shared';
import type { RemotePlayerState } from '../network/RemotePlayerTrack.ts';
import { RemotePlayerTrack } from '../network/RemotePlayerTrack.ts';
import { SceneCoords } from '../scene/SceneCoords.ts';
import { StickmanModel } from '../scene/StickmanModel.ts';

/** Напарник на сцене: стикмен, плавно следующий за снимками сервера. */
export class RemotePlayerView {
  public readonly track = new RemotePlayerTrack();
  private readonly model: StickmanModel;
  private current: RemotePlayerState | null = null;
  private hiddenInTambour = false;

  public constructor(
    public readonly id: string,
    public readonly color: PlayerColor,
    scene: Scene,
  ) {
    this.model = new StickmanModel(color);
    this.model.root.visible = false;
    scene.add(this.model.root);
  }

  /** Последнее отрисованное состояние. */
  public get state(): RemotePlayerState | null {
    return this.current;
  }

  /** Напарник ушёл в тамбур — его модель скрывается. */
  public get inTambour(): boolean {
    return this.hiddenInTambour;
  }

  public setInTambour(inTambour: boolean): void {
    this.hiddenInTambour = inTambour;
  }

  public update(renderTime: number, time: number): void {
    const state = this.track.sample(renderTime);
    this.current = state;
    if (!state) {
      return;
    }
    this.model.root.visible = !this.hiddenInTambour;
    this.model.root.position.copy(SceneCoords.toScene(state.position));
    this.model.root.rotation.set(0, state.yaw, 0);
    this.model.setLampFlicker(time);
  }

  public dispose(): void {
    this.model.dispose();
  }
}
