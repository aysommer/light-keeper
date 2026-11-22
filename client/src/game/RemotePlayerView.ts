import type { Scene } from 'three';
import type { HeldItem, LampSnapshot, PlayerColor } from '@light-keeper/shared';
import type { RemotePlayerState } from '../network/RemotePlayerTrack.ts';
import { RemotePlayerTrack } from '../network/RemotePlayerTrack.ts';
import { SceneCoords } from '../scene/SceneCoords.ts';
import { StickmanModel } from '../scene/StickmanModel.ts';
import { HandOverMotion } from './HandOverMotion.ts';
import { MotionEstimator } from './MotionEstimator.ts';

/** Напарник на сцене: стикмен, плавно следующий за снимками сервера. */
export class RemotePlayerView {
  public readonly track = new RemotePlayerTrack();
  private readonly model: StickmanModel;
  private current: RemotePlayerState | null = null;
  private hiddenInTambour = false;
  private floor = 0;
  private item: HeldItem = 'lamp';
  private lamp: LampSnapshot | null = null;
  private readonly motion = new MotionEstimator();
  private lastTime: number | null = null;
  private readonly handOver = new HandOverMotion();
  private exchangeCount: number | null = null;
  private currentSpeed = 0;

  public constructor(
    public readonly id: string,
    public readonly color: PlayerColor,
    scene: Scene,
  ) {
    this.model = new StickmanModel(color);
    this.model.root.visible = false;
    scene.add(this.model.root);
  }

  /** Скорость напарника по последним кадрам, м/с (для звука шагов). */
  public get speed(): number {
    return this.currentSpeed;
  }

  /** Последнее отрисованное состояние. */
  public get state(): RemotePlayerState | null {
    return this.current;
  }

  /** Напарник ушёл в тамбур — его модель скрывается. */
  public get inTambour(): boolean {
    return this.hiddenInTambour;
  }

  /** Пойманный гусь у напарника в руках. */
  public setGooseInHands(carrying: boolean): void {
    this.model.setGooseInHands(carrying);
  }

  /** Этаж напарника (из снимка); при смене этажа — не принимать перенос за бег. */
  public setFloor(floor: number): void {
    if (floor !== this.floor) {
      this.floor = floor;
      this.resetMotion();
    }
  }

  public get currentFloor(): number {
    return this.floor;
  }

  public setInTambour(inTambour: boolean): void {
    this.hiddenInTambour = inTambour;
  }

  /** Что напарник держит в руке и общая лампа, если она у него (из снимка сервера). */
  public setHands(item: HeldItem, lamp: LampSnapshot | null): void {
    this.item = item;
    this.lamp = lamp;
  }

  /** Счётчик обменов из снимка — по его росту напарник «протягивает» лампу. */
  public setExchangeCount(count: number): void {
    this.exchangeCount = count;
  }

  /** Напарника перенесли (новое пространство): не принимать перенос за бег. */
  public resetMotion(): void {
    this.track.clear();
    this.motion.reset();
  }

  public update(renderTime: number, time: number): void {
    const deltaSeconds = this.lastTime === null ? 0 : time - this.lastTime;
    this.lastTime = time;
    const state = this.track.sample(renderTime);
    this.current = state;
    if (!state) {
      return;
    }
    this.model.root.visible = !this.hiddenInTambour;
    this.model.root.position.copy(SceneCoords.toScene(state.position, 0, this.floor));
    this.model.root.rotation.set(0, state.yaw, 0);
    this.motion.update(state.position, deltaSeconds);
    this.currentSpeed = Math.abs(this.motion.signedSpeed(state.yaw));
    this.model.update(
      deltaSeconds,
      time,
      this.motion.signedSpeed(state.yaw),
      this.item,
      this.lamp,
      this.handOver.update(deltaSeconds, this.exchangeCount),
    );
  }

  public dispose(): void {
    this.model.dispose();
  }
}
