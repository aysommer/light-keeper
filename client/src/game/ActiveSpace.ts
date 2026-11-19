import type { Scene } from 'three';
import { CollisionWorld, PlayerMovement, SpaceGenerator } from '@light-keeper/shared';
import type { Space } from '@light-keeper/shared';
import { SpaceMeshBuilder } from '../scene/SpaceMeshBuilder.ts';
import type { SpaceView } from '../scene/SpaceView.ts';

/** Источник правила движения для текущего пространства. */
export interface MovementProvider {
  readonly movement: PlayerMovement;
  readonly spaceIndex: number;
}

/**
 * Текущее пространство на клиенте: карта, коллизии и 3D-представление.
 * При переходе старое пространство полностью освобождается и строится новое.
 */
export class ActiveSpace implements MovementProvider {
  private readonly generator: SpaceGenerator;
  private readonly builder = new SpaceMeshBuilder();
  private currentSpace: Space;
  private currentMovement: PlayerMovement;
  private view: SpaceView;

  public constructor(
    matchSeed: number,
    private readonly scene: Scene,
  ) {
    this.generator = new SpaceGenerator(matchSeed);
    this.currentSpace = this.generator.generate(0);
    this.currentMovement = new PlayerMovement(CollisionWorld.fromSpace(this.currentSpace));
    this.view = this.builder.build(this.currentSpace);
    scene.add(this.view.group);
  }

  public get space(): Space {
    return this.currentSpace;
  }

  public get spaceIndex(): number {
    return this.currentSpace.index;
  }

  public get movement(): PlayerMovement {
    return this.currentMovement;
  }

  public enter(index: number): void {
    if (index === this.currentSpace.index) {
      return;
    }
    this.view.dispose();
    this.currentSpace = this.generator.generate(index);
    this.currentMovement = new PlayerMovement(CollisionWorld.fromSpace(this.currentSpace));
    this.view = this.builder.build(this.currentSpace);
    this.scene.add(this.view.group);
  }

  public update(time: number): void {
    this.view.update(time);
  }

  public dispose(): void {
    this.view.dispose();
  }
}
