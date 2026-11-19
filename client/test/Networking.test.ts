import { describe, expect, it } from 'vitest';
import { CollisionWorld, PlayerMovement, Vector2 } from '@light-keeper/shared';
import type { PlayerInput } from '@light-keeper/shared';
import type { MovementProvider } from '../src/game/ActiveSpace.ts';
import { LocalPlayer } from '../src/game/LocalPlayer.ts';
import { PredictionReconciler } from '../src/network/PredictionReconciler.ts';
import { RemotePlayerTrack } from '../src/network/RemotePlayerTrack.ts';
import { ServerClock } from '../src/network/ServerClock.ts';

// Пустой мир без стен: проверяем логику согласования, а не коллизии.
const movement = new PlayerMovement(new CollisionWorld([]));
const rules: MovementProvider = { movement, spaceIndex: 0 };
const start = new Vector2(10, 10);
const step = (seq: number): PlayerInput => ({
  seq,
  dt: 1 / 60,
  moveX: 0,
  moveY: 1,
  yaw: 0,
  pitch: 0,
  run: false,
  interact: false,
  space: 0,
});

describe('PredictionReconciler', () => {
  it('если сервер согласен, позиция не меняется', () => {
    const player = new LocalPlayer(start);
    const reconciler = new PredictionReconciler(rules);
    let serverPosition = start;
    for (let seq = 0; seq < 30; seq++) {
      const command = step(seq);
      player.moveTo(movement.apply(player.position, command));
      reconciler.record(command);
      if (seq < 20) serverPosition = movement.apply(serverPosition, command);
    }
    const predicted = player.position;
    reconciler.reconcile(player, serverPosition, 19);
    expect(player.position.x).toBe(predicted.x);
    expect(player.position.y).toBe(predicted.y);
    expect(reconciler.pendingCount).toBe(10);
  });

  it('поправка сервера применяется и неподтверждённые команды переигрываются', () => {
    const player = new LocalPlayer(start);
    const reconciler = new PredictionReconciler(rules);
    for (let seq = 0; seq < 10; seq++) {
      const command = step(seq);
      player.moveTo(movement.apply(player.position, command));
      reconciler.record(command);
    }
    // Сервер говорит: после команды 4 игрок оказался на 1 м левее.
    let corrected = start.add(new Vector2(-1, 0));
    for (let seq = 0; seq <= 4; seq++) corrected = movement.apply(corrected, step(seq));
    reconciler.reconcile(player, corrected, 4);
    let expected = corrected;
    for (let seq = 5; seq < 10; seq++) expected = movement.apply(expected, step(seq));
    expect(player.position.equals(expected)).toBe(true);
    // Камера сдвигается плавно: сразу после поправки она ещё у старой позиции.
    expect(player.renderPosition.x).toBeGreaterThan(player.position.x + 0.9);
    player.updateSmoothing(1);
    expect(player.renderPosition.distanceTo(player.position)).toBeLessThan(0.001);
  });
});

describe('PredictionReconciler: смена пространства', () => {
  it('clear() забывает неподтверждённые команды', () => {
    const reconciler = new PredictionReconciler(rules);
    reconciler.record(step(1));
    reconciler.record(step(2));
    reconciler.clear();
    expect(reconciler.pendingCount).toBe(0);
  });

  it('команды прошлого пространства не переигрываются на новой карте', () => {
    const player = new LocalPlayer(start);
    const nextRules: MovementProvider = { movement, spaceIndex: 1 };
    const reconciler = new PredictionReconciler(nextRules);
    reconciler.record(step(1)); // space: 0
    reconciler.reconcile(player, start, 0);
    expect(player.position.equals(start)).toBe(true);
  });

  it('teleport() переносит без сглаживания', () => {
    const player = new LocalPlayer(start);
    player.correctTo(start.add(new Vector2(1, 0)));
    player.yaw = 2;
    player.teleport(new Vector2(50, 50), 1);
    expect(player.renderPosition.equals(new Vector2(50, 50))).toBe(true);
    expect(player.yaw).toBe(1);
  });
});

describe('RemotePlayerTrack', () => {
  const track = new RemotePlayerTrack();
  track.push(0, { position: new Vector2(0, 0), yaw: 3, pitch: 0 });
  track.push(100, { position: new Vector2(10, 20), yaw: -3, pitch: 0.4 });

  it('интерполирует между снимками', () => {
    const middle = track.sample(50)!;
    expect(middle.position.equals(new Vector2(5, 10))).toBe(true);
    expect(middle.pitch).toBeCloseTo(0.2);
  });

  it('угол идёт по кратчайшей дуге (через ±π, а не через 0)', () => {
    const middle = track.sample(50)!;
    expect(Math.abs(Math.abs(middle.yaw) - Math.PI)).toBeLessThan(0.01);
  });

  it('вне истории — ближайшее состояние', () => {
    expect(track.sample(-10)!.position.equals(new Vector2(0, 0))).toBe(true);
    expect(track.sample(500)!.position.equals(new Vector2(10, 20))).toBe(true);
    expect(new RemotePlayerTrack().sample(0)).toBeNull();
  });

  it('clear() очищает историю', () => {
    const local = new RemotePlayerTrack();
    local.push(1, { position: new Vector2(1, 1), yaw: 0, pitch: 0 });
    local.clear();
    expect(local.sample(1)).toBeNull();
  });

  it('устаревшие снимки отбрасываются', () => {
    const local = new RemotePlayerTrack();
    local.push(100, { position: new Vector2(1, 1), yaw: 0, pitch: 0 });
    local.push(50, { position: new Vector2(9, 9), yaw: 0, pitch: 0 });
    expect(local.sample(100)!.position.equals(new Vector2(1, 1))).toBe(true);
  });
});

describe('ServerClock', () => {
  it('оценивает время сервера и сглаживает джиттер', () => {
    const clock = new ServerClock();
    expect(clock.serverNow(0)).toBeNull();
    clock.observe(1000, 5000);
    expect(clock.serverNow(5100)).toBe(1100);
    clock.observe(1050, 5100); // пакет опоздал на 50 мс
    const estimate = clock.serverNow(5100)!;
    expect(estimate).toBeGreaterThan(1050);
    expect(estimate).toBeLessThan(1100);
  });
});
