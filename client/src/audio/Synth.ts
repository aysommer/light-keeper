import type { AudioEngine } from './AudioEngine.ts';

/**
 * Процедурные звуки игры: всё синтезируется из шума и осцилляторов,
 * без звуковых файлов. Каждый метод проигрывает короткий звук в `destination`
 * (по умолчанию — общий выход; для пространственных звуков — PannerNode).
 */
export class Synth {
  public constructor(private readonly engine: AudioEngine) {}

  /** Шаг: глухой удар по ковролину. */
  public footstep(volume = 1, destination?: AudioNode): void {
    this.noiseBurst(
      { type: 'lowpass', frequency: 380, q: 0.7 },
      0.004,
      0.13,
      0.32 * volume,
      destination,
    );
    this.tone('sine', 72, 52, 0.003, 0.09, 0.18 * volume, destination);
  }

  /** Крик скримера: резкий шумовой удар и визгливый нисходящий аккорд. */
  public scream(): void {
    this.noiseBurst({ type: 'bandpass', frequency: 1800, q: 0.7 }, 0.005, 0.9, 1.2);
    this.tone('sawtooth', 1400, 380, 0.01, 1.1, 0.35);
    this.tone('sawtooth', 1870, 520, 0.01, 1.0, 0.25);
    this.tone('square', 95, 40, 0.005, 0.5, 0.5);
  }

  /** «Га-га!» — гоготание гуся: два коротких гнусавых крика. */
  public honk(destination?: AudioNode): void {
    const ctx = this.engine.ctx;
    if (!ctx) return;
    const cry = (delayMs: number, pitch: number): void => {
      window.setTimeout(() => {
        this.tone('sawtooth', 520 * pitch, 380 * pitch, 0.015, 0.16, 0.18, destination);
        this.tone('square', 1040 * pitch, 760 * pitch, 0.015, 0.12, 0.05, destination);
      }, delayMs);
    };
    cry(0, 1);
    cry(190, 0.94);
  }

  /** Треск мерцающей лампы дневного света: сухой щелчок и короткое жужжание. */
  public fluorescentCrackle(destination?: AudioNode): void {
    this.noiseBurst({ type: 'bandpass', frequency: 3400, q: 1.5 }, 0.001, 0.03, 0.12, destination);
    this.tone('sawtooth', 120, 118, 0.002, 0.06, 0.05, destination);
  }

  /** Лёгкий быстрый топоток лапок (заяц). */
  public patter(destination?: AudioNode): void {
    this.noiseBurst({ type: 'bandpass', frequency: 900, q: 1.2 }, 0.002, 0.035, 0.22, destination);
  }

  /** Короткий высокий писк — неприятный, будто не к месту. */
  public squeak(destination?: AudioNode): void {
    this.tone('triangle', 1500, 2700, 0.01, 0.1, 0.1, destination);
    window.setTimeout(() => this.tone('triangle', 2300, 1300, 0.005, 0.12, 0.07, destination), 90);
  }

  /** Потрескивание фитиля. */
  public crackle(volume = 1): void {
    const frequency = 2500 + Math.random() * 2500;
    this.noiseBurst(
      { type: 'bandpass', frequency, q: 1.2 },
      0.001,
      0.025 + Math.random() * 0.03,
      (0.04 + Math.random() * 0.06) * volume,
    );
  }

  /** Шипение перегревшейся лампы с хлопком. */
  public hiss(): void {
    this.noiseBurst({ type: 'highpass', frequency: 3800, q: 0.5 }, 0.02, 1.3, 0.14);
    this.tone('sine', 140, 60, 0.002, 0.12, 0.2);
  }

  /** Скрип открывающейся двери. */
  public creak(destination?: AudioNode): void {
    const ctx = this.engine.ctx;
    if (!ctx) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(85, t);
    osc.frequency.linearRampToValueAtTime(150, t + 0.5);
    osc.frequency.linearRampToValueAtTime(95, t + 1.1);
    osc.frequency.linearRampToValueAtTime(120, t + 1.4);
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 900;
    filter.Q.value = 7;
    const gain = this.envelope(0.08, 0.3, 1.5);
    if (!gain) return;
    osc
      .connect(filter)
      .connect(gain)
      .connect(destination ?? this.engine.master!);
    osc.start(t);
    osc.stop(t + 1.6);
  }

  /** Глухой удар (дверь тамбура закрылась за спиной). */
  public thud(): void {
    this.tone('sine', 60, 38, 0.003, 0.5, 0.45);
    this.noiseBurst({ type: 'lowpass', frequency: 220, q: 0.7 }, 0.003, 0.3, 0.3);
  }

  /** Металлический звон: ключ, обмен лампами. */
  public clink(pitch = 1): void {
    this.tone('sine', 2400 * pitch, 2380 * pitch, 0.002, 0.45, 0.07);
    this.tone('sine', 3620 * pitch, 3600 * pitch, 0.002, 0.3, 0.05);
  }

  /** Плеск масла в подобранной канистре. */
  public slosh(): void {
    const ctx = this.engine.ctx;
    const source = this.engine.noiseSource();
    if (!ctx || !source) return;
    const t = ctx.currentTime;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(700, t);
    filter.frequency.exponentialRampToValueAtTime(180, t + 0.4);
    const gain = this.envelope(0.02, 0.18, 0.45);
    if (!gain) return;
    source.connect(filter).connect(gain).connect(this.engine.master!);
    source.start(t);
    source.stop(t + 0.5);
  }

  /** Гул перехода между пространствами. */
  public whoosh(): void {
    const ctx = this.engine.ctx;
    const source = this.engine.noiseSource();
    if (!ctx || !source) return;
    const t = ctx.currentTime;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.Q.value = 1.5;
    filter.frequency.setValueAtTime(180, t);
    filter.frequency.exponentialRampToValueAtTime(1400, t + 0.7);
    filter.frequency.exponentialRampToValueAtTime(160, t + 1.6);
    const gain = this.envelope(0.5, 0.22, 1.7);
    if (!gain) return;
    source.connect(filter).connect(gain).connect(this.engine.master!);
    source.start(t);
    source.stop(t + 1.8);
  }

  /** Привидение растворилось в свете: нисходящий перелив. */
  public dissolve(destination?: AudioNode): void {
    this.tone('triangle', 900, 260, 0.05, 1.1, 0.07, destination);
    this.tone('sine', 1350, 390, 0.05, 1.0, 0.04, destination);
  }

  /** Удар сердца «тук-тук». */
  public heartbeat(volume = 1): void {
    this.tone('sine', 58, 42, 0.004, 0.16, 0.5 * volume);
    const ctx = this.engine.ctx;
    if (!ctx) return;
    window.setTimeout(() => this.tone('sine', 52, 38, 0.004, 0.14, 0.36 * volume), 180);
  }

  /** Короткий тон с глиссандо и огибающей. */
  public tone(
    type: OscillatorType,
    from: number,
    to: number,
    attack: number,
    decay: number,
    volume: number,
    destination?: AudioNode,
  ): void {
    const ctx = this.engine.ctx;
    if (!ctx) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(from, t);
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, to), t + attack + decay);
    const gain = this.envelope(attack, volume, attack + decay);
    if (!gain) return;
    osc.connect(gain).connect(destination ?? this.engine.master!);
    osc.start(t);
    osc.stop(t + attack + decay + 0.05);
  }

  private noiseBurst(
    filterSpec: { type: BiquadFilterType; frequency: number; q: number },
    attack: number,
    decay: number,
    volume: number,
    destination?: AudioNode,
  ): void {
    const ctx = this.engine.ctx;
    const source = this.engine.noiseSource();
    if (!ctx || !source) return;
    const t = ctx.currentTime;
    const filter = ctx.createBiquadFilter();
    filter.type = filterSpec.type;
    filter.frequency.value = filterSpec.frequency;
    filter.Q.value = filterSpec.q;
    const gain = this.envelope(attack, volume, attack + decay);
    if (!gain) return;
    source
      .connect(filter)
      .connect(gain)
      .connect(destination ?? this.engine.master!);
    // Случайный сдвиг в буфере — каждый всплеск звучит чуть иначе.
    source.start(t, Math.random() * 1.5);
    source.stop(t + attack + decay + 0.05);
  }

  /** Огибающая: быстрый подъём до `peak` и экспоненциальный спад к концу. */
  private envelope(attack: number, peak: number, total: number): GainNode | null {
    const ctx = this.engine.ctx;
    if (!ctx) return null;
    const t = ctx.currentTime;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + Math.max(0.001, attack));
    gain.gain.exponentialRampToValueAtTime(0.0001, t + Math.max(attack + 0.01, total));
    return gain;
  }
}
