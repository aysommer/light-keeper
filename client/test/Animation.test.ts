import { describe, expect, it } from 'vitest';
import { GameConfig, PlayerMovement, Vector2 } from '@light-keeper/shared';
import { ItemSwitcher } from '../src/game/ItemSwitcher.ts';
import { MotionEstimator } from '../src/game/MotionEstimator.ts';
import { StickmanAnimator } from '../src/game/StickmanAnimator.ts';
import type { StickmanPose } from '../src/game/StickmanAnimator.ts';

const run = (
  animator: StickmanAnimator,
  seconds: number,
  speed: number,
  item: 'lamp' | 'compass' = 'lamp',
): StickmanPose[] => {
  const poses: StickmanPose[] = [];
  for (let t = 0; t < seconds; t += 1 / 60) poses.push(animator.update(1 / 60, speed, item));
  return poses;
};

const range = (values: number[]): number => Math.max(...values) - Math.min(...values);

describe('StickmanAnimator', () => {
  const { walkSpeed, runSpeed } = GameConfig.player;

  it('в покое ноги стоят, а корпус «дышит» едва заметно', () => {
    const poses = run(new StickmanAnimator(), 3, 0);
    const last = poses.at(-1)!;
    expect(Math.abs(last.leftHip)).toBeLessThan(1e-6);
    expect(Math.abs(last.rightHip)).toBeLessThan(1e-6);
    expect(last.bounce).toBeLessThan(1e-6);
    expect(range(poses.slice(-120).map((p) => p.leftShoulder))).toBeGreaterThan(0.02);
  });

  it('при ходьбе ноги движутся в противофазе, рука — против ноги', () => {
    const poses = run(new StickmanAnimator(), 3, walkSpeed).slice(-60);
    for (const pose of poses) {
      expect(pose.leftHip).toBeCloseTo(-pose.rightHip, 6);
    }
    const correlation = poses.reduce((sum, p) => sum + p.leftHip * p.leftShoulder, 0);
    expect(correlation).toBeLessThan(0);
    expect(range(poses.map((p) => p.leftHip))).toBeGreaterThan(0.6);
  });

  it('бег: шире шаг, сильнее наклон и согнутые локти', () => {
    const walk = run(new StickmanAnimator(), 3, walkSpeed).slice(-60);
    const sprint = run(new StickmanAnimator(), 3, runSpeed).slice(-60);
    expect(range(sprint.map((p) => p.leftHip))).toBeGreaterThan(range(walk.map((p) => p.leftHip)));
    expect(sprint.at(-1)!.lean).toBeGreaterThan(walk.at(-1)!.lean + 0.1);
    expect(sprint.at(-1)!.leftElbow).toBeGreaterThan(walk.at(-1)!.leftElbow + 0.5);
  });

  it('колени гнутся только назад', () => {
    for (const pose of run(new StickmanAnimator(), 3, runSpeed)) {
      expect(pose.leftKnee).toBeLessThanOrEqual(0);
      expect(pose.rightKnee).toBeLessThanOrEqual(0);
    }
  });

  it('пятясь, шаг идёт в обратную сторону', () => {
    const forward = new StickmanAnimator();
    const backward = new StickmanAnimator();
    const f = run(forward, 0.2, walkSpeed);
    const b = run(backward, 0.2, -walkSpeed);
    expect(Math.sign(f.at(-1)!.leftHip)).toBe(-Math.sign(b.at(-1)!.leftHip));
  });

  it('фонарь в покое висит вертикально', () => {
    const last = run(new StickmanAnimator(), 4, 0).at(-1)!;
    const worldAngle = -last.lean + last.rightShoulder + last.rightElbow + last.lampSwing;
    expect(Math.abs(worldAngle)).toBeLessThan(0.02);
  });

  it('при старте фонарь раскачивается и успокаивается', () => {
    const animator = new StickmanAnimator();
    run(animator, 2, 0);
    const swings = run(animator, 0.6, runSpeed).map((p) => p.lampSwing);
    expect(range(swings)).toBeGreaterThan(0.05);
  });

  it('с компасом правая рука поднята вперёд', () => {
    const last = run(new StickmanAnimator(), 1, 0, 'compass').at(-1)!;
    expect(last.rightShoulder).toBeGreaterThan(0.8);
  });
});

describe('MotionEstimator', () => {
  it('оценивает скорость и знак относительно взгляда', () => {
    const motion = new MotionEstimator();
    for (let i = 0; i <= 60; i++) motion.update(new Vector2(0, (i / 60) * 2), 1 / 60);
    const yawForward = PlayerMovement.yawTowards(new Vector2(0, 1));
    expect(motion.signedSpeed(yawForward)).toBeCloseTo(2, 1);
    expect(motion.signedSpeed(yawForward + Math.PI)).toBeCloseTo(-2, 1);
  });

  it('телепорт не считается бегом, reset забывает историю', () => {
    const motion = new MotionEstimator();
    motion.update(new Vector2(0, 0), 1 / 60);
    motion.update(new Vector2(30, 30), 1 / 60);
    expect(motion.signedSpeed(0)).toBe(0);
    motion.reset();
    expect(motion.update(new Vector2(5, 5), 1 / 60).length()).toBe(0);
  });
});

describe('ItemSwitcher', () => {
  it('опускает руку, меняет предмет и поднимает её', () => {
    const switcher = new ItemSwitcher('lamp');
    let shown = switcher.update(0.1, 'compass');
    expect(shown).toEqual({ item: 'lamp', raise: 0.5 });
    shown = switcher.update(0.1, 'compass');
    expect(shown).toEqual({ item: 'compass', raise: 0 });
    shown = switcher.update(0.2, 'compass');
    expect(shown).toEqual({ item: 'compass', raise: 1 });
  });

  it('передумал на полпути — рука поднимается обратно с тем же предметом', () => {
    const switcher = new ItemSwitcher('lamp');
    switcher.update(0.1, 'compass');
    expect(switcher.update(0.1, 'lamp')).toEqual({ item: 'lamp', raise: 1 });
  });
});
