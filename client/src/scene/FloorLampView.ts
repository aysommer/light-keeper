import { PointLight } from 'three';
import type { Scene } from 'three';
import { LampRules, Vector2 } from '@light-keeper/shared';
import type { DroppedLampSnapshot } from '@light-keeper/shared';
import { LampFlame } from '../game/LampFlame.ts';
import { LanternModel } from './LanternModel.ts';
import { SceneCoords } from './SceneCoords.ts';

/**
 * Общая лампа, выпавшая из рук от перегрева: лежит на боку на полу и тлеет
 * (раскалённое стекло видно в темноте), пока её не поднимут.
 */
export class FloorLampView {
  private readonly lantern = new LanternModel();
  /** Слабый отсвет раскалённой лампы на полу — чтобы её можно было найти. */
  private readonly ember = new PointLight('#ff6a2a', 0, 2.5, 1.8);

  public constructor(private readonly scene: Scene) {
    this.lantern.root.visible = false;
    this.lantern.root.rotation.z = Math.PI / 2 - 0.15;
    this.ember.position.set(0, 0.15, 0);
    scene.add(this.lantern.root, this.ember);
  }

  public update(dropped: DroppedLampSnapshot | null, time: number): void {
    const visible = dropped !== null;
    this.lantern.root.visible = visible;
    this.ember.visible = visible;
    if (!dropped) {
      return;
    }
    const at = SceneCoords.toScene(new Vector2(dropped.x, dropped.y), 0.09);
    this.lantern.root.position.copy(at);
    this.ember.position.set(at.x, 0.15, at.z);
    const heatGlow = LampFlame.heatGlow(dropped.lamp.heat);
    const level = LampFlame.level(time, LampRules.brightness(dropped.lamp)) * 0.3;
    this.lantern.setGlow(level, heatGlow);
    this.ember.intensity = 0.4 + heatGlow * 1.2;
  }

  public dispose(): void {
    this.scene.remove(this.lantern.root, this.ember);
    this.lantern.dispose();
    this.ember.dispose();
  }
}
