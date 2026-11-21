import { GameConfig, PlayerMovement } from '@light-keeper/shared';
import type {
  HeldItem,
  PlayerColor,
  PlayerInput,
  PlayerSnapshot,
  Vector2,
} from '@light-keeper/shared';
import type { LobbyParticipant } from '../lobby/LobbyParticipant.ts';
import { InputBudget } from '../game/InputBudget.ts';
import { Entity } from './Entity.ts';
import type { Lamp } from './Lamp.ts';

/** Игрок в партии: позиция, взгляд, очередь команд ввода. */
export class ServerPlayer extends Entity {
  /** Предел очереди: всё сверх него отбрасывается. */
  public static readonly MAX_QUEUED_COMMANDS = 64;

  public yaw = 0;
  public pitch = 0;
  public lastSeq = -1;
  /** Клавиша действия удерживается (по последней команде). */
  public interacting = false;
  /** Клавиша действия нажата заново в этом тике (фронт нажатия). */
  public interactPressed = false;
  /** Игрок вошёл в дверь и ждёт в тамбуре. */
  public inTambour = false;
  /** Этаж игрока (0 — первый; меняется по лестнице). */
  public floor = 0;
  /** Смотрит на напарника рядом — клавиша действия означает обмен, а не дверь. */
  public aimingAtPartner = false;
  /** Предмет в руке (по последней команде). */
  public item: HeldItem = 'lamp';
  /** Зажата клавиша заправки (по последней команде). */
  public refueling = false;
  /** Игрок идёт (по последней команде) — заправляться можно только стоя. */
  public moving = false;
  /** Сколько канистр несёт. */
  public canisters = 0;
  /** Сколько ключей несёт (ещё не вставленных в замок). */
  public keys = 0;
  /** Код, введённый на панели двери и ещё не проверенный сервером. */
  public pendingCode: readonly string[] | null = null;
  /** Сколько секунд уже идёт заправка. */
  public refuelSeconds = 0;
  /** Общая лампа, если она сейчас у этого игрока (лампа одна на двоих). */
  public lamp: Lamp | null = null;
  public readonly budget = new InputBudget();
  private readonly queue: PlayerInput[] = [];

  public constructor(
    public readonly participant: LobbyParticipant,
    public readonly color: PlayerColor,
    position: Vector2,
  ) {
    super(participant.id, position);
  }

  /** Принимает команды клиента; повторы и устаревшие номера игнорируются. */
  public enqueue(commands: readonly PlayerInput[]): void {
    const newestQueued = this.queue.at(-1)?.seq ?? this.lastSeq;
    let newest = newestQueued;
    for (const command of commands) {
      if (command.seq <= newest || this.queue.length >= ServerPlayer.MAX_QUEUED_COMMANDS) {
        continue;
      }
      this.queue.push(command);
      newest = command.seq;
    }
  }

  /** Забирает накопленные команды. */
  public drainCommands(): PlayerInput[] {
    return this.queue.splice(0);
  }

  /** Ставит игрока на старт пространства и поворачивает взглядом в заданную сторону. */
  public placeAt(position: Vector2, yaw: number): void {
    this.position = position;
    this.yaw = yaw;
    this.pitch = 0;
    this.floor = 0;
    this.inTambour = false;
    this.interactPressed = false;
    this.canisters = 0;
    this.keys = 0;
    this.pendingCode = null;
    this.refuelSeconds = 0;
  }

  /** Лампа у игрока и в руке (а не убрана ради компаса и не в тамбуре). */
  public get lampInHand(): boolean {
    return this.lamp !== null && this.item === 'lamp' && !this.inTambour;
  }

  /** Лампа в руке и горит — светит в мир (проявляет скрытую дверь). */
  public get lampShining(): boolean {
    return this.lampInHand && (this.lamp?.lit ?? false);
  }

  /** Насколько ярко светит лампа этого игрока в мир, 0–1. */
  public get lightBrightness(): number {
    return this.lampShining ? (this.lamp?.brightness ?? 0) : 0;
  }

  /** Учитывает клавишу действия из команды: удержание и фронт нажатия. */
  public applyInteract(held: boolean): void {
    if (held && !this.interacting) {
      this.interactPressed = true;
    }
    this.interacting = held;
  }

  public applyLook(command: PlayerInput): void {
    this.yaw = command.yaw;
    this.pitch = PlayerMovement.clampPitch(command.pitch);
  }

  public snapshot(): PlayerSnapshot {
    return {
      id: this.id,
      x: this.position.x,
      y: this.position.y,
      yaw: this.yaw,
      pitch: this.pitch,
      floor: this.floor,
      lastSeq: this.lastSeq,
      inTambour: this.inTambour,
      // Без лампы вместо неё в руке компас.
      item: this.item === 'lamp' && !this.lamp ? 'compass' : this.item,
      lamp: this.lamp?.snapshot() ?? null,
      canisters: this.canisters,
      keys: this.keys,
      refuelProgress: Math.min(1, this.refuelSeconds / GameConfig.canister.refuelSeconds),
    };
  }
}
