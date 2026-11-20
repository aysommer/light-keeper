import { describe, expect, it } from 'vitest';
import { Scene } from 'three';
import { GameConfig, Vector2 } from '@light-keeper/shared';
import { GhostsView } from '../src/game/GhostsView.ts';
import { ScareLevel } from '../src/game/ScareLevel.ts';

const settle = (scare: ScareLevel, distance: number | null, light: number): number => {
  let level = 0;
  for (let i = 0; i < 300; i++) level = scare.update(1 / 60, distance, light);
  return level;
};

describe('ScareLevel', () => {
  const far = GameConfig.ghosts.scareDistance;

  it('без привидений и вдали — не страшно, вплотную — страшно', () => {
    expect(settle(new ScareLevel(), null, 0)).toBe(0);
    expect(settle(new ScareLevel(), far + 1, 0)).toBe(0);
    expect(settle(new ScareLevel(), 0.5, 0)).toBeGreaterThan(0.85);
  });

  it('свой свет успокаивает', () => {
    expect(settle(new ScareLevel(), 2, 1)).toBeLessThan(settle(new ScareLevel(), 2, 0));
  });

  it('страх нарастает быстро, а отпускает медленно', () => {
    const scare = new ScareLevel();
    let up = 0;
    for (let i = 0; i < 12; i++) up = scare.update(1 / 60, 1, 0);
    settle(scare, 1, 0);
    let down = 1;
    for (let i = 0; i < 12; i++) down = scare.update(1 / 60, null, 0);
    expect(up).toBeGreaterThan(0.5);
    expect(down).toBeGreaterThan(0.6);
  });
});

describe('GhostsView', () => {
  it('создаёт, двигает и убирает привидения по снимкам; растворяющиеся не опасны', () => {
    const scene = new Scene();
    const view = new GhostsView(scene);
    view.push(0, [
      { id: 1, x: 5, y: 5, fading: false },
      { id: 2, x: 9, y: 5, fading: true },
    ]);
    view.push(100, [
      { id: 1, x: 6, y: 5, fading: false },
      { id: 2, x: 9, y: 5, fading: true },
    ]);
    view.update(50, 0, 0.016);
    expect(view.nearestThreat(new Vector2(5.5, 7))).toBeCloseTo(2);
    view.push(200, [{ id: 2, x: 9, y: 5, fading: true }]);
    view.update(150, 0.1, 0.016);
    expect(view.nearestThreat(new Vector2(5.5, 7))).toBeNull();
    view.clear();
    expect(scene.children).toHaveLength(0);
  });
});
