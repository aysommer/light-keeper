import { GameConfig, LampRules } from '@light-keeper/shared';
import type { LampSettings, LampSnapshot } from '@light-keeper/shared';

/**
 * Масляная лампа. Горит, пока есть масло и она не перегрелась.
 * В руке — тратит масло и нагревается (тем быстрее, чем дольше её держит
 * один игрок); убранная — остывает и масло не тратит. Перегревшись, гаснет,
 * остывает и загорается снова.
 */
export class Lamp {
  public oil = 100;
  public heat = 0;
  public overheated = false;
  /** Сколько секунд лампу непрерывно держит текущий игрок. */
  public holdSeconds = 0;

  public constructor(private readonly settings: LampSettings = GameConfig.lamp) {}

  public get lit(): boolean {
    return !this.overheated && this.oil > 0;
  }

  /** Светит ли лампа в мир, если она в руке. */
  public get brightness(): number {
    return LampRules.brightness(this, this.settings);
  }

  /** @param inHand лампа в руке (а не убрана ради компаса). */
  public update(deltaSeconds: number, inHand: boolean): void {
    const dt = Math.max(0, deltaSeconds);
    if (this.overheated) {
      this.holdSeconds = 0;
      this.heat = Math.max(0, this.heat - this.settings.overheatCoolRate * dt);
      if (this.heat <= this.settings.relightHeat) {
        this.overheated = false;
      }
      return;
    }
    if (inHand && this.lit) {
      this.oil = Math.max(0, this.oil - (100 / this.settings.oilSeconds) * dt);
      this.heat += LampRules.heatRate(this.holdSeconds, this.settings) * dt;
      this.holdSeconds += dt;
      if (this.heat >= 100) {
        this.heat = 100;
        this.overheated = true;
      }
      return;
    }
    this.heat = Math.max(0, this.heat - this.settings.stowedCoolRate * dt);
    // Пока лампа убрана, «привычка» держать её проходит.
    this.holdSeconds = Math.max(0, this.holdSeconds - 2 * dt);
  }

  /** Лампу передали из рук в руки: «привычка» сбрасывается, лампа остывает. */
  public handOver(heatRelief: number): void {
    this.holdSeconds = 0;
    this.heat = Math.max(0, this.heat - heatRelief);
    if (this.overheated && this.heat <= this.settings.relightHeat) {
      this.overheated = false;
    }
  }

  /** Новое пространство: масло полное, лампа холодная. */
  public refill(): void {
    this.oil = 100;
    this.heat = 0;
    this.overheated = false;
    this.holdSeconds = 0;
  }

  public snapshot(): LampSnapshot {
    return {
      oil: Math.round(this.oil * 10) / 10,
      heat: Math.round(this.heat * 10) / 10,
      lit: this.lit,
      overheated: this.overheated,
    };
  }
}
