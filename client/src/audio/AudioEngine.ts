import type { Camera } from 'three';
import { Vector3 } from 'three';

/**
 * Звуковой движок поверх Web Audio API: контекст, общая громкость, слушатель
 * (следует за камерой), буфер белого шума для синтеза. Контекст создаётся
 * лениво — браузеры разрешают звук только после действия пользователя.
 */
export class AudioEngine {
  private static readonly MASTER_VOLUME = 0.8;
  private static readonly STORAGE_KEY = 'light-keeper:muted';

  private context: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private mutedState: boolean;
  private readonly forward = new Vector3();
  private readonly up = new Vector3();

  public constructor() {
    this.mutedState = AudioEngine.readMuted();
  }

  public get ready(): boolean {
    return this.context !== null && this.context.state === 'running';
  }

  public get ctx(): AudioContext | null {
    return this.context;
  }

  public get master(): GainNode | null {
    return this.masterGain;
  }

  public get muted(): boolean {
    return this.mutedState;
  }

  /** Создать/возобновить контекст. Вызывать из обработчика клика или клавиши. */
  public unlock(): void {
    if (!this.context) {
      const Context = window.AudioContext;
      if (!Context) return;
      this.context = new Context();
      this.masterGain = this.context.createGain();
      this.masterGain.gain.value = this.mutedState ? 0 : AudioEngine.MASTER_VOLUME;
      this.masterGain.connect(this.context.destination);
      this.noise = this.createNoise(this.context);
    }
    if (this.context.state === 'suspended') {
      void this.context.resume();
    }
  }

  public toggleMute(): boolean {
    this.mutedState = !this.mutedState;
    try {
      localStorage.setItem(AudioEngine.STORAGE_KEY, this.mutedState ? '1' : '0');
    } catch {
      // Хранилище недоступно — настройка живёт до перезагрузки.
    }
    if (this.context && this.masterGain) {
      this.masterGain.gain.setTargetAtTime(
        this.mutedState ? 0 : AudioEngine.MASTER_VOLUME,
        this.context.currentTime,
        0.05,
      );
    }
    return this.mutedState;
  }

  /** Источник белого шума (зациклен по желанию). */
  public noiseSource(loop = false): AudioBufferSourceNode | null {
    if (!this.context || !this.noise) return null;
    const source = this.context.createBufferSource();
    source.buffer = this.noise;
    source.loop = loop;
    return source;
  }

  /** Слушатель — там, где камера, и смотрит, куда она. */
  public updateListener(camera: Camera): void {
    const ctx = this.context;
    if (!ctx) return;
    const listener = ctx.listener;
    camera.getWorldDirection(this.forward);
    this.up.set(0, 1, 0).applyQuaternion(camera.quaternion);
    const t = ctx.currentTime;
    if (listener.positionX) {
      listener.positionX.setValueAtTime(camera.position.x, t);
      listener.positionY.setValueAtTime(camera.position.y, t);
      listener.positionZ.setValueAtTime(camera.position.z, t);
      listener.forwardX.setValueAtTime(this.forward.x, t);
      listener.forwardY.setValueAtTime(this.forward.y, t);
      listener.forwardZ.setValueAtTime(this.forward.z, t);
      listener.upX.setValueAtTime(this.up.x, t);
      listener.upY.setValueAtTime(this.up.y, t);
      listener.upZ.setValueAtTime(this.up.z, t);
    }
  }

  /** Пространственный узел в точке сцены (звук слышен с нужной стороны). */
  public panner(position: Vector3, refDistance = 1.5, maxDistance = 25): PannerNode | null {
    const ctx = this.context;
    if (!ctx || !this.masterGain) return null;
    const panner = ctx.createPanner();
    panner.panningModel = 'HRTF';
    panner.distanceModel = 'inverse';
    panner.refDistance = refDistance;
    panner.maxDistance = maxDistance;
    panner.rolloffFactor = 1.4;
    AudioEngine.place(panner, position, ctx.currentTime);
    panner.connect(this.masterGain);
    return panner;
  }

  public static place(panner: PannerNode, position: Vector3, time: number): void {
    if (panner.positionX) {
      panner.positionX.setValueAtTime(position.x, time);
      panner.positionY.setValueAtTime(position.y, time);
      panner.positionZ.setValueAtTime(position.z, time);
    }
  }

  public dispose(): void {
    void this.context?.close();
    this.context = null;
    this.masterGain = null;
  }

  private createNoise(ctx: AudioContext): AudioBuffer {
    const buffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    return buffer;
  }

  private static readMuted(): boolean {
    try {
      return localStorage.getItem(AudioEngine.STORAGE_KEY) === '1';
    } catch {
      return false;
    }
  }
}
