import { PointLight, Vector3 } from 'three';
import type { Scene } from 'three';

/** Горящая панель на потолке: где она (в координатах сцены) и мерцает ли. */
export interface CeilingPanelLight {
  readonly position: Vector3;
  readonly floor: number;
  readonly flicker: boolean;
  /** Комната, над которой висит панель. */
  readonly roomId: string;
  /** Клетка панели: `столбец:строка`. */
  readonly cell: string;
}

/**
 * Свет офисных панелей на потолке. Источников света на каждую панель не
 * хватит (их сотни), поэтому есть небольшой постоянный набор: каждый кадр он
 * встаёт под ближайшие к игроку горящие панели его этажа. Число источников
 * не меняется — шейдеры не пересобираются; лишние просто гаснут.
 * Какие панели вообще могут светить игроку (своя комната и панели у проёмов
 * в соседние — свет не проходит сквозь стены), решает вызывающий.
 */
export class CeilingLightPool {
  public static readonly SIZE = 6;
  private static readonly INTENSITY = 2.4;
  private static readonly RANGE = 7.5;
  /** Свет висит чуть ниже панели, чтобы потолок вокруг неё тоже освещался. */
  private static readonly DROP = 0.35;

  private readonly lights: PointLight[] = [];
  private readonly viewer = new Vector3();
  private chosen: CeilingPanelLight[] = [];

  public constructor(private readonly scene: Scene) {
    for (let i = 0; i < CeilingLightPool.SIZE; i++) {
      const light = new PointLight('#fff0d2', 0, CeilingLightPool.RANGE, 1.5);
      light.name = `ceiling-light-${i}`;
      this.lights.push(light);
      scene.add(light);
    }
  }

  /**
   * @param panels горящие панели, которые могут светить игроку
   * @param viewer где игрок (сцена)
   * @param floor его этаж
   * @param flickerLit горят ли сейчас мерцающие панели
   */
  public update(
    panels: readonly CeilingPanelLight[],
    viewer: Vector3,
    floor: number,
    flickerLit: boolean,
  ): void {
    this.viewer.copy(viewer);
    const nearest = panels
      .filter((panel) => panel.floor === floor)
      .map((panel) => ({ panel, distance: panel.position.distanceToSquared(this.viewer) }))
      .sort((a, b) => a.distance - b.distance)
      .slice(0, CeilingLightPool.SIZE);
    this.chosen = nearest.map((entry) => entry.panel);
    this.lights.forEach((light, i) => {
      const entry = nearest[i];
      if (!entry) {
        light.intensity = 0;
        return;
      }
      light.position.copy(entry.panel.position);
      light.position.y -= CeilingLightPool.DROP;
      const lit = !entry.panel.flicker || flickerLit;
      light.intensity = lit ? CeilingLightPool.INTENSITY : 0;
    });
  }

  /** Панели, под которыми сейчас стоит свет, — от ближней к дальней. */
  public get active(): readonly CeilingPanelLight[] {
    return this.chosen;
  }

  public dispose(): void {
    this.lights.forEach((light) => {
      this.scene.remove(light);
      light.dispose();
    });
  }
}
