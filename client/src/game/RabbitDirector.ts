import { Frustum, Matrix4, Vector3 } from 'three';
import type { Camera, Scene } from 'three';
import { NavigationField, Vector2 } from '@light-keeper/shared';
import type { AudioEngine } from '../audio/AudioEngine.ts';
import type { Synth } from '../audio/Synth.ts';
import { RabbitModel } from '../scene/RabbitModel.ts';
import { SceneCoords } from '../scene/SceneCoords.ts';
import type { ActiveSpace } from './ActiveSpace.ts';

/** Что нужно знать о кадре, чтобы решить, где выскочить зайцу. */
export interface RabbitFrame {
  readonly position: Vector2;
  readonly camera: Camera;
  /** Можно ли сейчас пугать (не в тамбуре, не при переходе). */
  readonly active: boolean;
}

interface Rabbit {
  readonly model: RabbitModel;
  /** Путь к проёму, через который заяц уходит из комнаты (`null` — уже у проёма). */
  escape: NavigationField | null;
  readonly exit: Vector2 | null;
  position: Vector2;
  floor: number;
  age: number;
  hiddenFor: number;
  /** Сколько осталось растворяться; `null` — ещё не растворяется. */
  fadeLeft: number | null;
  patterIn: number;
  heading: number;
}

/**
 * Белые зайцы — жутковатая деталь непонятного помещения. Очень редко заяц
 * резко выскакивает из угла комнаты прямо в поле зрения, с топотом и писком
 * убегает от героя по лабиринту и, как только скрылся из виду, исчезает
 * (чтобы ничего не считать впустую). Зайцы есть только у этого игрока:
 * сервер и напарник о них не знают — на игру и сеть они не влияют.
 */
export class RabbitDirector {
  /** Через сколько секунд после начала может появиться первый заяц. */
  private static readonly FIRST_DELAY: readonly [number, number] = [50, 110];
  /** Пауза между зайцами, с. */
  private static readonly INTERVAL: readonly [number, number] = [90, 200];
  private static readonly SPEED = 5.5;
  /** Где может выскочить заяц: не ближе и не дальше этого, м. */
  private static readonly MIN_DISTANCE = 3;
  private static readonly MAX_DISTANCE = 10;
  /** Отступ от стен в углу комнаты, м. */
  private static readonly CORNER_INSET = 0.75;
  /** Сколько заяц должен пробыть вне видимости, чтобы исчезнуть, с. */
  private static readonly VANISH_AFTER = 0.25;
  /** Убежал так далеко или бежит так долго, что пора раствориться в темноте. */
  private static readonly FADE_DISTANCE = 13;
  private static readonly FADE_AFTER = 6;
  private static readonly FADE_SECONDS = 0.7;

  private rabbit: Rabbit | null = null;
  private nextIn: number;
  private field: NavigationField | null = null;
  private fieldKey = '';
  private fieldRefreshIn = 0;
  private readonly frustum = new Frustum();
  private readonly matrix = new Matrix4();
  private readonly probe = new Vector3();

  public constructor(
    private readonly scene: Scene,
    private readonly space: ActiveSpace,
    private readonly audio: AudioEngine,
    private readonly synth: Synth,
    private readonly random: () => number = Math.random,
  ) {
    this.nextIn = this.between(RabbitDirector.FIRST_DELAY);
    void RabbitModel.load();
  }

  /** Почему заяц выскочил или нет в последней попытке (для отладки). */
  public lastAttempt: {
    corners: number;
    inRange: number;
    free: number;
    visible: number;
  } | null = null;

  /** Заяц сейчас на сцене (для отладки и проверок). */
  public get running(): boolean {
    return this.rabbit !== null;
  }

  /** Отладка: выпустить зайца сейчас (если есть подходящий угол). */
  public spawnSoon(): void {
    this.nextIn = 0;
  }

  public update(deltaSeconds: number, frame: RabbitFrame): void {
    frame.camera.updateMatrixWorld();
    this.matrix.multiplyMatrices(frame.camera.projectionMatrix, frame.camera.matrixWorldInverse);
    this.frustum.setFromProjectionMatrix(this.matrix);
    if (this.rabbit) {
      this.run(this.rabbit, deltaSeconds, frame);
      return;
    }
    if (!frame.active) {
      return;
    }
    this.nextIn -= deltaSeconds;
    if (this.nextIn > 0) {
      return;
    }
    // Нет подходящего угла — попробуем чуть позже.
    this.nextIn = this.trySpawn(frame) ? this.between(RabbitDirector.INTERVAL) : 3;
  }

  public dispose(): void {
    this.rabbit?.model.dispose();
    this.rabbit = null;
  }

  /** Заяц выскакивает из угла, который сейчас видно. */
  private trySpawn(frame: RabbitFrame): boolean {
    const floor = this.space.floor;
    const field = this.fieldFor(floor, frame.position);
    const rooms = this.space.space.floor(floor).rooms;
    const inset = RabbitDirector.CORNER_INSET;
    const corners = rooms.flatMap((room) => {
      const { minX, minY, maxX, maxY } = room.bounds;
      return [
        new Vector2(minX + inset, minY + inset),
        new Vector2(maxX - inset, minY + inset),
        new Vector2(minX + inset, maxY - inset),
        new Vector2(maxX - inset, maxY - inset),
      ];
    });
    const inRange = corners.filter((corner) => {
      const distance = corner.distanceTo(frame.position);
      return distance >= RabbitDirector.MIN_DISTANCE && distance <= RabbitDirector.MAX_DISTANCE;
    });
    const free = inRange.filter((corner) => field.stepsAt(corner) >= 0);
    const candidates = free.filter((corner) => this.visible(corner, floor, frame.position, 0.75));
    this.lastAttempt = {
      corners: corners.length,
      inRange: inRange.length,
      free: free.length,
      visible: candidates.length,
    };
    if (candidates.length === 0) {
      return false;
    }
    const start = candidates[Math.floor(this.random() * candidates.length)]!;
    // Уходит через проём своей комнаты — тот, что дальше от героя.
    const floorPlan = this.space.space.floor(floor);
    const room = floorPlan.roomAt(start);
    const exit =
      floorPlan.doors
        .filter((door) => room && (door.roomA === room.id || door.roomB === room.id))
        .map((door) => door.position)
        .sort((a, b) => b.distanceTo(frame.position) - a.distanceTo(frame.position))[0] ?? null;
    let escape: NavigationField | null = null;
    if (exit) {
      escape = new NavigationField(this.space.space, 0.15, 0.25, floor);
      escape.computeFrom([exit]);
    }
    const model = new RabbitModel();
    model.root.position.copy(SceneCoords.toScene(start, 0, floor));
    this.scene.add(model.root);
    this.rabbit = {
      model,
      escape,
      exit,
      position: start,
      floor,
      age: 0,
      hiddenFor: 0,
      fadeLeft: null,
      patterIn: 0,
      heading: 0,
    };
    const panner = this.audio.panner(SceneCoords.toScene(start, 0.2, floor), 2, 25);
    if (panner) this.synth.squeak(panner);
    return true;
  }

  /** Бег прочь от героя; скрылся из виду — исчез. */
  private run(rabbit: Rabbit, deltaSeconds: number, frame: RabbitFrame): void {
    rabbit.age += deltaSeconds;
    const sameFloor = rabbit.floor === this.space.floor;
    if (sameFloor) {
      const step = RabbitDirector.SPEED * deltaSeconds;
      // Сначала — к проёму своей комнаты, потом — прочь от героя по лабиринту.
      if (rabbit.escape && rabbit.exit && rabbit.position.distanceTo(rabbit.exit) < 0.5) {
        rabbit.escape = null;
      }
      const next = rabbit.escape
        ? rabbit.escape.step(rabbit.position, step)
        : this.fieldFor(rabbit.floor, frame.position, deltaSeconds).step(
            rabbit.position,
            step,
            true,
          );
      const moved = next.sub(rabbit.position);
      if (moved.length() > 1e-4) {
        // Модель смотрит в −Z сцены, а мировая ось y в сцене — это −Z.
        rabbit.heading = Math.atan2(-moved.x, moved.y);
      }
      rabbit.position = next;
    }
    const speed = sameFloor ? RabbitDirector.SPEED : 0;
    rabbit.model.root.position.copy(SceneCoords.toScene(rabbit.position, 0, rabbit.floor));
    rabbit.model.root.rotation.y = rabbit.heading;
    rabbit.model.update(deltaSeconds, speed);

    rabbit.patterIn -= deltaSeconds;
    if (rabbit.patterIn <= 0 && sameFloor) {
      rabbit.patterIn = 0.085;
      const panner = this.audio.panner(
        SceneCoords.toScene(rabbit.position, 0.1, rabbit.floor),
        1.5,
        20,
      );
      if (panner) this.synth.patter(panner);
    }

    const seen = sameFloor && this.visible(rabbit.position, rabbit.floor, frame.position, 1);
    rabbit.hiddenFor = seen ? 0 : rabbit.hiddenFor + deltaSeconds;
    // Далеко или долго на виду — растворяется в темноте.
    const far = rabbit.position.distanceTo(frame.position) > RabbitDirector.FADE_DISTANCE;
    if (rabbit.fadeLeft === null && (far || rabbit.age > RabbitDirector.FADE_AFTER)) {
      rabbit.fadeLeft = RabbitDirector.FADE_SECONDS;
    }
    if (rabbit.fadeLeft !== null) {
      rabbit.fadeLeft -= deltaSeconds;
      rabbit.model.setOpacity(Math.max(0, rabbit.fadeLeft / RabbitDirector.FADE_SECONDS));
    }
    const faded = rabbit.fadeLeft !== null && rabbit.fadeLeft <= 0;
    if (rabbit.hiddenFor >= RabbitDirector.VANISH_AFTER || faded) {
      rabbit.model.dispose();
      this.rabbit = null;
    }
  }

  /**
   * Видит ли герой точку: она в кадре (`margin` — доля экрана от центра)
   * и между ними нет стены.
   */
  private visible(point: Vector2, floor: number, from: Vector2, margin: number): boolean {
    this.probe.copy(SceneCoords.toScene(point, 0.2, floor));
    if (!this.frustum.containsPoint(this.probe)) {
      return false;
    }
    this.probe.applyMatrix4(this.matrix);
    if (Math.abs(this.probe.x) > margin || Math.abs(this.probe.y) > 1) {
      return false;
    }
    return this.space.collisions.lineOfSight(from, point);
  }

  /** Поле путей текущего этажа от героя (пересчёт — не чаще трёх раз в секунду). */
  private fieldFor(floor: number, from: Vector2, deltaSeconds = 0): NavigationField {
    const key = `${this.space.spaceIndex}:${floor}`;
    if (!this.field || key !== this.fieldKey) {
      this.field = new NavigationField(this.space.space, 0.15, 0.25, floor);
      this.fieldKey = key;
      this.fieldRefreshIn = 0;
    }
    this.fieldRefreshIn -= deltaSeconds;
    if (this.fieldRefreshIn <= 0) {
      this.field.computeFrom([from]);
      this.fieldRefreshIn = 0.3;
    }
    return this.field;
  }

  private between([min, max]: readonly [number, number]): number {
    return min + (max - min) * this.random();
  }
}
