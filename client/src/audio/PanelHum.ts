import { Vector3 } from 'three';
import type { CeilingPanelLight } from '../scene/CeilingLightPool.ts';
import { AudioEngine } from './AudioEngine.ts';
import { Synth } from './Synth.ts';

/**
 * Звук офисных ламп: ровный тихий гул ближайшей горящей панели (100 Гц —
 * удвоенная частота сети — и гармоники, как у старых дросселей) и сухой треск мерцающих, когда они
 * вспыхивают. Звук объёмный — идёт с потолка, от самой панели.
 */
export class PanelHum {
  /** Дальше этого гул не слышен, м. */
  private static readonly HEAR_DISTANCE = 6;
  private static readonly HUM_VOLUME = 0.035;
  /** Треск не чаще, с. */
  private static readonly CRACKLE_GAP = 0.18;

  private readonly synth: Synth;
  private panner: PannerNode | null = null;
  private gain: GainNode | null = null;
  private oscillators: OscillatorNode[] = [];
  private crackler: PannerNode | null = null;
  private wasLit = true;
  private lastCrackle = 0;

  public constructor(private readonly engine: AudioEngine) {
    this.synth = new Synth(engine);
  }

  /**
   * @param panels панели со светом рядом с игроком, ближние первыми
   * @param viewer где игрок (сцена)
   * @param flickerLit горят ли сейчас мерцающие панели
   * @param active можно ли сейчас звучать (не тамбур и не переход)
   */
  public update(
    panels: readonly CeilingPanelLight[],
    viewer: Vector3,
    flickerLit: boolean,
    active: boolean,
  ): void {
    const ctx = this.engine.ctx;
    if (!ctx) return;
    const near = active
      ? panels.find(
          (panel) => !panel.flicker && panel.position.distanceTo(viewer) <= PanelHum.HEAR_DISTANCE,
        )
      : undefined;
    this.ensureHum(ctx);
    if (this.panner && this.gain) {
      if (near) AudioEngine.place(this.panner, near.position, ctx.currentTime);
      this.gain.gain.setTargetAtTime(near ? PanelHum.HUM_VOLUME : 0, ctx.currentTime, 0.3);
    }
    // Мерцающая вспыхнула — треск с её стороны.
    const flickering = active
      ? panels.find(
          (panel) => panel.flicker && panel.position.distanceTo(viewer) <= PanelHum.HEAR_DISTANCE,
        )
      : undefined;
    if (
      flickering &&
      flickerLit &&
      !this.wasLit &&
      ctx.currentTime - this.lastCrackle > PanelHum.CRACKLE_GAP
    ) {
      this.lastCrackle = ctx.currentTime;
      this.crackler ??= this.engine.panner(flickering.position, 1.5, PanelHum.HEAR_DISTANCE);
      if (this.crackler) {
        AudioEngine.place(this.crackler, flickering.position, ctx.currentTime);
        this.synth.fluorescentCrackle(this.crackler);
      }
    }
    this.wasLit = flickerLit;
  }

  public dispose(): void {
    this.oscillators.forEach((oscillator) => {
      try {
        oscillator.stop();
      } catch {
        // Уже остановлен.
      }
    });
    this.oscillators = [];
    this.panner?.disconnect();
    this.crackler?.disconnect();
    this.panner = null;
    this.crackler = null;
    this.gain = null;
  }

  /** Гул: 100 Гц и гармоники, приглушённые фильтром; начинается с тишины. */
  private ensureHum(ctx: AudioContext): void {
    if (this.panner) return;
    const panner = this.engine.panner(new Vector3(), 1.2, PanelHum.HEAR_DISTANCE);
    if (!panner) return;
    this.panner = panner;
    this.gain = ctx.createGain();
    this.gain.gain.value = 0;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 900;
    filter.connect(this.gain).connect(panner);
    for (const [frequency, level] of [
      [100, 1],
      [200, 0.5],
      [300, 0.25],
    ] as const) {
      const oscillator = ctx.createOscillator();
      oscillator.type = 'sawtooth';
      oscillator.frequency.value = frequency;
      const partial = ctx.createGain();
      partial.gain.value = level;
      oscillator.connect(partial).connect(filter);
      oscillator.start();
      this.oscillators.push(oscillator);
    }
  }
}
