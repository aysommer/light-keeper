import type { Camera } from 'three';
import type { Vector2 } from '@light-keeper/shared';
import { StickmanAnimator } from '../game/StickmanAnimator.ts';
import { SceneCoords } from '../scene/SceneCoords.ts';
import { AudioEngine } from './AudioEngine.ts';
import { GameAudioEvents } from './GameAudioEvents.ts';
import type { AudioFrame } from './GameAudioEvents.ts';
import { IntervalTimer } from './IntervalTimer.ts';
import { LoopSound } from './LoopSound.ts';
import { StepDetector } from './StepDetector.ts';
import { Synth } from './Synth.ts';

/** Всё, что нужно звуку в кадре, помимо событий. */
export interface SoundScene extends AudioFrame {
  readonly camera: Camera;
  /** Свои шаги: фаза покачивания головы. */
  readonly bobPhase: number;
  readonly moving: boolean;
  readonly running: boolean;
  /** Свет своей лампы 0–1 и её нагрев, %. */
  readonly lampLevel: number;
  readonly lampHeat: number;
  readonly refueling: boolean;
  /** Испуг 0–1. */
  readonly scare: number;
  readonly door: Vector2;
  readonly partner: { readonly position: Vector2; readonly speed: number } | null;
  readonly ghosts: ReadonlyArray<{
    readonly id: number;
    readonly position: Vector2;
    readonly fading: boolean;
  }>;
}

interface GhostVoice {
  readonly panner: PannerNode;
  readonly loop: LoopSound | null;
  position: Vector2;
  fading: boolean;
}

/**
 * Звукорежиссёр: фон (гул ламп), шаги свои и напарника, треск лампы,
 * шёпот привидений, стук сердца и разовые события. Все звуки синтезируются
 * (см. Synth), пространственные — слышны с нужной стороны.
 */
export class SoundDirector {
  private static readonly HUM_VOLUME = 0.035;
  private static readonly WHISPER_VOLUME = 0.35;

  private readonly synth: Synth;
  private readonly events = new GameAudioEvents();
  private readonly steps = new StepDetector();
  private readonly partnerSteps = new IntervalTimer();
  private readonly crackles = new IntervalTimer(() => Math.random() * 0.8);
  private readonly heart = new IntervalTimer();
  private readonly voices = new Map<number, GhostVoice>();
  private hum: LoopSound | null = null;
  private pour: LoopSound | null = null;

  public constructor(private readonly engine: AudioEngine) {
    this.synth = new Synth(engine);
  }

  public update(deltaSeconds: number, scene: SoundScene): void {
    if (!this.engine.ready) {
      return;
    }
    this.engine.updateListener(scene.camera);
    this.ensureLoops();
    this.hum?.setVolume(scene.inTambour ? 0.005 : SoundDirector.HUM_VOLUME, 0.5);
    this.pour?.setVolume(scene.refueling ? 0.12 : 0, 0.08);

    for (const event of this.events.update(scene)) {
      this.play(event, scene);
    }
    if (scene.inTambour) {
      this.silenceGhosts();
      return;
    }

    if (this.steps.update(scene.bobPhase, scene.moving)) {
      this.synth.footstep(scene.running ? 1.2 : 0.8);
    }
    this.updatePartnerSteps(deltaSeconds, scene);

    const crackleRate = scene.lampLevel > 0 ? 0.4 + (scene.lampHeat / 100) * 3 : 0;
    if (this.crackles.update(deltaSeconds, crackleRate > 0 ? 1.2 / crackleRate : null)) {
      this.synth.crackle(0.6 + scene.lampHeat / 150);
    }
    const heartInterval = scene.scare > 0.15 ? 60 / (60 + 90 * scene.scare) : null;
    if (this.heart.update(deltaSeconds, heartInterval)) {
      this.synth.heartbeat(Math.min(1, scene.scare * 1.2));
    }
    this.updateGhosts(scene);
  }

  public dispose(): void {
    this.hum?.stop();
    this.pour?.stop();
    this.silenceGhosts();
  }

  private ensureLoops(): void {
    this.hum ??= LoopSound.hum(this.engine);
    this.pour ??= LoopSound.pour(this.engine);
  }

  private play(event: ReturnType<GameAudioEvents['update']>[number], scene: SoundScene): void {
    switch (event) {
      case 'door-open': {
        const panner = this.engine.panner(SceneCoords.toScene(scene.door, 1.2), 2.5, 40);
        if (panner) this.synth.creak(panner);
        return;
      }
      case 'tambour':
        this.synth.thud();
        return;
      case 'key':
        this.synth.clink(0.8);
        return;
      case 'canister-pickup':
        this.synth.slosh();
        return;
      case 'refuel-done':
        this.synth.clink(0.6);
        return;
      case 'overheat':
        this.synth.hiss();
        return;
      case 'exchange':
        this.synth.clink(1);
        return;
      case 'transition':
        this.synth.whoosh();
        this.silenceGhosts();
        return;
    }
  }

  private updatePartnerSteps(deltaSeconds: number, scene: SoundScene): void {
    const partner = scene.partner;
    const interval =
      partner && partner.speed > 0.3 ? StickmanAnimator.STRIDE_LENGTH / 2 / partner.speed : null;
    if (this.partnerSteps.update(deltaSeconds, interval) && partner) {
      const panner = this.engine.panner(SceneCoords.toScene(partner.position, 0.1), 1.5, 30);
      if (panner) this.synth.footstep(partner.speed > 3 ? 1.1 : 0.8, panner);
    }
  }

  private updateGhosts(scene: SoundScene): void {
    const ctx = this.engine.ctx;
    if (!ctx) return;
    const alive = new Set<number>();
    for (const ghost of scene.ghosts) {
      alive.add(ghost.id);
      let voice = this.voices.get(ghost.id);
      if (!voice) {
        const panner = this.engine.panner(SceneCoords.toScene(ghost.position, 1.5), 1.2, 30);
        if (!panner) continue;
        voice = {
          panner,
          loop: LoopSound.whisper(this.engine, panner),
          position: ghost.position,
          fading: false,
        };
        this.voices.set(ghost.id, voice);
      }
      voice.position = ghost.position;
      AudioEngine.place(voice.panner, SceneCoords.toScene(ghost.position, 1.5), ctx.currentTime);
      if (ghost.fading && !voice.fading) {
        this.synth.dissolve(voice.panner);
      }
      voice.fading = ghost.fading;
      voice.loop?.setVolume(ghost.fading ? 0 : SoundDirector.WHISPER_VOLUME, 0.3);
    }
    for (const [id, voice] of this.voices) {
      if (!alive.has(id)) {
        voice.loop?.stop();
        this.voices.delete(id);
      }
    }
  }

  private silenceGhosts(): void {
    this.voices.forEach((voice) => voice.loop?.stop());
    this.voices.clear();
  }
}
