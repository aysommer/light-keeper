import type { AudioEngine } from './AudioEngine.ts';

/**
 * Непрерывный звук с плавно меняющейся громкостью: гул ламп, шум помещения,
 * бульканье при заправке, шёпот привидения.
 */
export class LoopSound {
  private readonly gain: GainNode;
  private readonly nodes: AudioScheduledSourceNode[] = [];

  private constructor(
    private readonly engine: AudioEngine,
    gain: GainNode,
  ) {
    this.gain = gain;
  }

  /** Гул ламп дневного света (50 Гц с гармониками) и тихий шум помещения. */
  public static hum(engine: AudioEngine): LoopSound | null {
    const ctx = engine.ctx;
    const noise = engine.noiseSource(true);
    if (!ctx || !noise || !engine.master) return null;
    const loop = new LoopSound(engine, LoopSound.silentGain(ctx, engine.master));
    const lowpass = ctx.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.frequency.value = 220;
    const buzz = ctx.createOscillator();
    buzz.type = 'sawtooth';
    buzz.frequency.value = 50;
    const buzzGain = ctx.createGain();
    buzzGain.gain.value = 0.5;
    buzz.connect(buzzGain).connect(lowpass).connect(loop.gain);
    const harmonic = ctx.createOscillator();
    harmonic.frequency.value = 100;
    const harmonicGain = ctx.createGain();
    harmonicGain.gain.value = 0.25;
    harmonic.connect(harmonicGain).connect(loop.gain);
    const room = ctx.createBiquadFilter();
    room.type = 'lowpass';
    room.frequency.value = 320;
    const roomGain = ctx.createGain();
    roomGain.gain.value = 0.6;
    noise.connect(room).connect(roomGain).connect(loop.gain);
    loop.start([buzz, harmonic, noise]);
    return loop;
  }

  /** Бульканье масла при заправке. */
  public static pour(engine: AudioEngine): LoopSound | null {
    const ctx = engine.ctx;
    const noise = engine.noiseSource(true);
    if (!ctx || !noise || !engine.master) return null;
    const loop = new LoopSound(engine, LoopSound.silentGain(ctx, engine.master));
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 500;
    filter.Q.value = 4;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 7;
    const depth = ctx.createGain();
    depth.gain.value = 260;
    lfo.connect(depth).connect(filter.frequency);
    noise.connect(filter).connect(loop.gain);
    loop.start([noise, lfo]);
    return loop;
  }

  /** Шёпот привидения: дышащий шум с дрожанием, звучит из точки `panner`. */
  public static whisper(engine: AudioEngine, panner: PannerNode): LoopSound | null {
    const ctx = engine.ctx;
    const noise = engine.noiseSource(true);
    if (!ctx || !noise) return null;
    const loop = new LoopSound(engine, LoopSound.silentGain(ctx, panner));
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 1400 + Math.random() * 500;
    filter.Q.value = 3;
    const sway = ctx.createOscillator();
    sway.frequency.value = 0.3 + Math.random() * 0.4;
    const swayDepth = ctx.createGain();
    swayDepth.gain.value = 500;
    sway.connect(swayDepth).connect(filter.frequency);
    // Дрожание громкости — «слоги» шёпота.
    const tremolo = ctx.createGain();
    tremolo.gain.value = 0.5;
    const flutter = ctx.createOscillator();
    flutter.frequency.value = 5 + Math.random() * 4;
    const flutterDepth = ctx.createGain();
    flutterDepth.gain.value = 0.5;
    flutter.connect(flutterDepth).connect(tremolo.gain);
    noise.connect(filter).connect(tremolo).connect(loop.gain);
    loop.start([noise, sway, flutter]);
    return loop;
  }

  /** Плавно сменить громкость. */
  public setVolume(volume: number, smoothing = 0.15): void {
    const ctx = this.engine.ctx;
    if (!ctx) return;
    this.gain.gain.setTargetAtTime(Math.max(0, volume), ctx.currentTime, smoothing);
  }

  public stop(): void {
    const ctx = this.engine.ctx;
    if (ctx) {
      this.gain.gain.setTargetAtTime(0, ctx.currentTime, 0.05);
    }
    const stopAt = (ctx?.currentTime ?? 0) + 0.3;
    this.nodes.forEach((node) => {
      try {
        node.stop(stopAt);
      } catch {
        // Уже остановлен.
      }
    });
  }

  private start(nodes: AudioScheduledSourceNode[]): void {
    nodes.forEach((node) => node.start());
    this.nodes.push(...nodes);
  }

  private static silentGain(ctx: AudioContext, destination: AudioNode): GainNode {
    const gain = ctx.createGain();
    gain.gain.value = 0;
    gain.connect(destination);
    return gain;
  }
}
