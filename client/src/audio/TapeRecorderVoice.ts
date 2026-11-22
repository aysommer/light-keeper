import type { Vector3 } from 'three';
import type { Space, Vector2 } from '@light-keeper/shared';
import { SceneCoords } from '../scene/SceneCoords.ts';
import type { AudioEngine } from './AudioEngine.ts';

/**
 * Голос магнитофона: по кругу повторяет код двери по-английски — «one… four…
 * seven… two…» — со случайными паузами 1–3 с между цифрами, как старая запись: узкая полоса частот, чуть
 * замедленно и «плавает», под шипение плёнки. Звук объёмный: слышен со
 * стороны магнитофона и тише вдали, поэтому его можно найти на слух.
 * Слышен только в той комнате, где стоит магнитофон: вышел за порог — запись
 * плавно стихает (стены глушат), вернулся — снова слышно.
 */
export class TapeRecorderVoice {
  private static readonly HEAR_DISTANCE = 14;
  /** За сколько секунд стихает/возвращается звук при выходе из комнаты и входе в неё. */
  private static readonly FADE_SECONDS = 0.35;
  /** Сколько молчать за пределами комнаты, прежде чем совсем остановить запись, с. */
  private static readonly STOP_AFTER = 1.5;
  /** Пауза после каждой цифры — случайная, от и до, с. */
  private static readonly DIGIT_GAP_MIN = 1;
  private static readonly DIGIT_GAP_MAX = 3;
  /** Пауза после всего кода — заметно длиннее любой паузы между цифрами, чтобы было слышно, где код кончился, с. */
  private static readonly LOOP_GAP = 5;
  private static buffers: Promise<AudioBuffer[]> | null = null;

  private panner: PannerNode | null = null;
  private hiss: AudioBufferSourceNode | null = null;
  private filter: BiquadFilterNode | null = null;
  private roomGain: GainNode | null = null;
  private inRoom = false;
  private leftRoomAt = 0;
  private spaceKey = '';
  private nextCycleAt = 0;
  private loaded: AudioBuffer[] | null = null;
  private readonly sources = new Set<AudioBufferSourceNode>();

  public constructor(private readonly engine: AudioEngine) {}

  /**
   * @param space текущее пространство (магнитофон есть, если `codeHint === 'tape'`)
   * @param listener где игрок и на каком этаже
   * @param active можно ли сейчас играть (не переход, не тамбур)
   */
  public update(space: Space, listener: Vector2, floor: number, active: boolean): void {
    const ctx = this.engine.ctx;
    const tape = space.codeHint === 'tape' ? space.note : null;
    const key = `${space.index}`;
    if (key !== this.spaceKey) {
      this.stop();
      this.spaceKey = key;
    }
    const playable = ctx !== null && tape !== null && space.code !== null && active;
    if (!playable || !ctx || !tape || !space.code) {
      this.stop();
      return;
    }
    const tapeFloor = space.floor(space.noteFloor);
    const room = tapeFloor.roomAt(tape);
    const inRoom =
      floor === space.noteFloor && room !== undefined && tapeFloor.roomAt(listener) === room;
    if (!inRoom) {
      if (this.inRoom) {
        this.inRoom = false;
        this.leftRoomAt = ctx.currentTime;
        this.roomGain?.gain.setTargetAtTime(0, ctx.currentTime, TapeRecorderVoice.FADE_SECONDS);
      }
      if (ctx.currentTime - this.leftRoomAt > TapeRecorderVoice.STOP_AFTER) {
        this.stop();
      }
      return;
    }
    if (!this.loaded) {
      void this.load(ctx);
      return;
    }
    this.ensureChain(ctx, SceneCoords.toScene(tape, 0.12, space.noteFloor));
    if (!this.inRoom) {
      this.inRoom = true;
      this.roomGain?.gain.setTargetAtTime(1, ctx.currentTime, TapeRecorderVoice.FADE_SECONDS);
    }
    if (ctx.currentTime >= this.nextCycleAt - 0.05) {
      this.scheduleCycle(ctx, space.code.symbols, Math.max(ctx.currentTime, this.nextCycleAt));
    }
  }

  public dispose(): void {
    this.stop();
  }

  private async load(ctx: AudioContext): Promise<void> {
    TapeRecorderVoice.buffers ??= Promise.all(
      Array.from({ length: 10 }, async (_, digit) => {
        const response = await fetch(`/audio/digits/${digit}.mp3`);
        return ctx.decodeAudioData(await response.arrayBuffer());
      }),
    );
    try {
      this.loaded = await TapeRecorderVoice.buffers;
    } catch {
      // Нет файлов — магнитофон молчит, но код можно подобрать на панели вслепую.
    }
  }

  /** Полоса частот «как из динамика магнитофона», шипение и пространственный узел. */
  private ensureChain(ctx: AudioContext, position: Vector3): void {
    if (this.panner) {
      return;
    }
    this.panner = this.engine.panner(position, 2, TapeRecorderVoice.HEAR_DISTANCE);
    if (!this.panner) return;
    // Громкость «в комнате / за стеной»: начинаем с тишины и плавно открываем.
    this.roomGain = ctx.createGain();
    this.roomGain.gain.value = 0;
    this.roomGain.connect(this.panner);
    this.filter = ctx.createBiquadFilter();
    this.filter.type = 'bandpass';
    this.filter.frequency.value = 1300;
    this.filter.Q.value = 0.6;
    this.filter.connect(this.roomGain);
    const hiss = this.engine.noiseSource(true);
    if (hiss) {
      const hissFilter = ctx.createBiquadFilter();
      hissFilter.type = 'highpass';
      hissFilter.frequency.value = 2500;
      const hissGain = ctx.createGain();
      hissGain.gain.value = 0.025;
      hiss.connect(hissFilter).connect(hissGain).connect(this.roomGain);
      hiss.start();
      this.hiss = hiss;
    }
    this.nextCycleAt = ctx.currentTime + 0.4;
  }

  private scheduleCycle(ctx: AudioContext, symbols: readonly string[], start: number): void {
    if (!this.filter || !this.loaded) return;
    let t = start;
    for (const symbol of symbols) {
      const buffer = this.loaded[Number(symbol)];
      if (!buffer) continue;
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      // Плёнка тянется: чуть медленнее и каждый раз немного по-разному.
      const rate = 0.9 + Math.random() * 0.05;
      source.playbackRate.value = rate;
      const gain = ctx.createGain();
      gain.gain.value = 1.6;
      source.connect(gain).connect(this.filter);
      source.start(t);
      this.sources.add(source);
      source.onended = () => this.sources.delete(source);
      const gap =
        TapeRecorderVoice.DIGIT_GAP_MIN +
        Math.random() * (TapeRecorderVoice.DIGIT_GAP_MAX - TapeRecorderVoice.DIGIT_GAP_MIN);
      t += buffer.duration / rate + gap;
    }
    this.nextCycleAt = t + TapeRecorderVoice.LOOP_GAP;
  }

  private stop(): void {
    this.sources.forEach((source) => {
      try {
        source.stop();
      } catch {
        // Уже остановлен.
      }
    });
    this.sources.clear();
    try {
      this.hiss?.stop();
    } catch {
      // Уже остановлен.
    }
    this.hiss = null;
    this.panner?.disconnect();
    this.panner = null;
    this.filter = null;
    this.roomGain = null;
    this.inRoom = false;
  }
}
