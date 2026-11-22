import type { Scene } from 'three';
import { Vector2 } from '@light-keeper/shared';
import type { FlagSnapshot, GooseSnapshot } from '@light-keeper/shared';
import type { AudioEngine } from '../audio/AudioEngine.ts';
import { Synth } from '../audio/Synth.ts';
import { FlagModel } from '../scene/FlagModel.ts';
import { GooseModel } from '../scene/GooseModel.ts';
import { SceneCoords } from '../scene/SceneCoords.ts';

/**
 * Флажки на полу и гусь-призрак на свободе. Гусь плавно догоняет позицию из
 * снимков сервера, смотрит по ходу бега и время от времени гогочет «га-га»
 * (объёмный звук). Пойманного гуся рисует тот, у кого он в руках.
 */
export class WorldItemsView {
  private readonly flags = new Map<number, FlagModel>();
  private goose: GooseModel | null = null;
  private gooseAt: Vector2 | null = null;
  private gooseHeading = 0;
  private honkIn = 2;
  private audio: AudioEngine | null = null;
  private synth: Synth | null = null;

  public constructor(private readonly scene: Scene) {}

  /** Подключить звук (гогот гуся). */
  public setAudio(audio: AudioEngine): void {
    this.audio = audio;
    this.synth = new Synth(audio);
  }

  /**
   * @param listenerFloor этаж игрока — гогот слышен только со своего этажа
   * @param carrierAt где игрок, у которого гусь в руках (для звука)
   */
  public update(
    flags: readonly FlagSnapshot[],
    goose: GooseSnapshot | null,
    deltaSeconds: number,
    time: number,
    listenerFloor: number,
    carrierAt: { position: Vector2; floor: number } | null,
  ): void {
    this.updateFlags(flags, time);
    this.updateGoose(goose, deltaSeconds);
    this.updateHonk(goose, deltaSeconds, listenerFloor, carrierAt);
  }

  public dispose(): void {
    this.flags.forEach((flag) => flag.dispose());
    this.flags.clear();
    this.goose?.dispose();
    this.goose = null;
  }

  private updateFlags(flags: readonly FlagSnapshot[], time: number): void {
    const onFloor = new Set<number>();
    for (const flag of flags) {
      if (flag.holderId !== null) continue;
      onFloor.add(flag.id);
      let model = this.flags.get(flag.id);
      if (!model) {
        model = new FlagModel();
        this.scene.add(model.root);
        this.flags.set(flag.id, model);
      }
      model.root.position.copy(SceneCoords.toScene(new Vector2(flag.x, flag.y), 0, flag.floor));
      model.update(time + flag.id);
    }
    for (const [id, model] of this.flags) {
      if (!onFloor.has(id)) {
        model.dispose();
        this.flags.delete(id);
      }
    }
  }

  private updateGoose(goose: GooseSnapshot | null, deltaSeconds: number): void {
    const free = goose !== null && goose.holderId === null;
    if (!free) {
      this.goose?.dispose();
      this.goose = null;
      this.gooseAt = null;
      return;
    }
    if (!this.goose) {
      this.goose = new GooseModel();
      this.scene.add(this.goose.root);
    }
    const target = new Vector2(goose.x, goose.y);
    const from = this.gooseAt ?? target;
    // Плавно догоняем позицию из снимков (20 раз в секунду).
    const next = from.add(target.sub(from).scale(Math.min(1, deltaSeconds * 12)));
    const moved = next.sub(from);
    const speed = deltaSeconds > 0 ? moved.length() / deltaSeconds : 0;
    if (moved.length() > 1e-4) this.gooseHeading = Math.atan2(-moved.x, moved.y);
    this.gooseAt = next;
    this.goose.root.position.copy(SceneCoords.toScene(next, 0, goose.floor));
    this.goose.root.rotation.y = this.gooseHeading;
    this.goose.update(deltaSeconds, speed);
  }

  private updateHonk(
    goose: GooseSnapshot | null,
    deltaSeconds: number,
    listenerFloor: number,
    carrierAt: { position: Vector2; floor: number } | null,
  ): void {
    if (!goose || !this.audio || !this.synth) return;
    this.honkIn -= deltaSeconds;
    if (this.honkIn > 0) return;
    this.honkIn = 2 + Math.random() * 3;
    const where =
      goose.holderId !== null && carrierAt
        ? carrierAt
        : { position: this.gooseAt ?? new Vector2(goose.x, goose.y), floor: goose.floor };
    if (where.floor !== listenerFloor) return;
    const panner = this.audio.panner(SceneCoords.toScene(where.position, 1.1, where.floor), 2, 25);
    if (panner) this.synth.honk(panner);
  }
}
