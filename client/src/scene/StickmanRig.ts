import { CylinderGeometry, Group, Mesh, MeshStandardMaterial, SphereGeometry } from 'three';
import type { BufferGeometry, Material } from 'three';
import type { StickmanPose } from '../game/StickmanAnimator.ts';

/**
 * Скелет стикмена из примитивов с шарнирами: корпус, голова, бёдра и колени,
 * плечи и локти. Модель стоит на полу и смотрит в −Z.
 * Позу задаёт `applyPose` (углы из StickmanAnimator).
 */
export class StickmanRig {
  public static readonly HIP_HEIGHT = 0.92;
  private static readonly LIMB_RADIUS = 0.045;
  private static readonly THIGH = 0.44;
  private static readonly SHIN = 0.44;
  private static readonly UPPER_ARM = 0.3;
  private static readonly FOREARM = 0.28;

  public readonly root = new Group();
  /** Точка правой кисти: сюда вешается лампа или компас. */
  public readonly rightHand = new Group();
  private readonly body = new Group();
  private readonly leftHip = new Group();
  private readonly rightHip = new Group();
  private readonly leftKnee = new Group();
  private readonly rightKnee = new Group();
  private readonly leftShoulder = new Group();
  private readonly rightShoulder = new Group();
  private readonly leftElbow = new Group();
  private readonly rightElbow = new Group();
  private readonly geometries: BufferGeometry[] = [];

  public constructor(private readonly material: Material) {
    this.body.position.y = StickmanRig.HIP_HEIGHT;
    this.root.add(this.body);

    this.segment(this.body, 0.52, true);
    const head = new Mesh(this.geometry(new SphereGeometry(0.15, 20, 14)), material);
    head.position.y = 0.7;
    this.body.add(head);

    this.leg(this.leftHip, this.leftKnee, -0.07);
    this.leg(this.rightHip, this.rightKnee, 0.07);
    this.arm(this.leftShoulder, this.leftElbow, -0.04, -0.12);
    this.arm(this.rightShoulder, this.rightElbow, 0.04, 0.12);
    this.rightHand.position.y = -StickmanRig.FOREARM;
    this.rightElbow.add(this.rightHand);
  }

  public applyPose(pose: StickmanPose): void {
    this.body.position.y = StickmanRig.HIP_HEIGHT + pose.bounce;
    this.body.rotation.x = -pose.lean;
    this.leftHip.rotation.x = pose.leftHip;
    this.rightHip.rotation.x = pose.rightHip;
    this.leftKnee.rotation.x = pose.leftKnee;
    this.rightKnee.rotation.x = pose.rightKnee;
    this.leftShoulder.rotation.x = pose.leftShoulder;
    this.rightShoulder.rotation.x = pose.rightShoulder;
    this.leftElbow.rotation.x = pose.leftElbow;
    this.rightElbow.rotation.x = pose.rightElbow;
  }

  public dispose(): void {
    this.root.removeFromParent();
    this.geometries.forEach((geometry) => geometry.dispose());
  }

  private leg(hip: Group, knee: Group, x: number): void {
    hip.position.set(x, 0, 0);
    this.body.add(hip);
    this.segment(hip, StickmanRig.THIGH);
    knee.position.y = -StickmanRig.THIGH;
    hip.add(knee);
    this.segment(knee, StickmanRig.SHIN);
  }

  private arm(shoulder: Group, elbow: Group, x: number, splay: number): void {
    // Плечо разворачивается чуть в сторону, чтобы руки не прилипали к корпусу.
    const socket = new Group();
    socket.position.set(x, 0.46, 0);
    socket.rotation.z = splay;
    this.body.add(socket);
    socket.add(shoulder);
    this.segment(shoulder, StickmanRig.UPPER_ARM);
    elbow.position.y = -StickmanRig.UPPER_ARM;
    shoulder.add(elbow);
    this.segment(elbow, StickmanRig.FOREARM);
  }

  /** Цилиндр длиной `length` от шарнира вниз (или вверх, если `upward`). */
  private segment(parent: Group, length: number, upward = false): void {
    const geometry = this.geometry(
      new CylinderGeometry(StickmanRig.LIMB_RADIUS, StickmanRig.LIMB_RADIUS, length, 10),
    );
    geometry.translate(0, upward ? length / 2 : -length / 2, 0);
    const mesh = new Mesh(geometry, this.material);
    parent.add(mesh);
    // Сустав-шарик скрывает стык сегментов.
    const joint = new Mesh(
      this.geometry(new SphereGeometry(StickmanRig.LIMB_RADIUS, 10, 8)),
      this.material,
    );
    parent.add(joint);
  }

  private geometry<T extends BufferGeometry>(geometry: T): T {
    this.geometries.push(geometry);
    return geometry;
  }

  /** Материал тела стикмена его цвета. */
  public static bodyMaterial(color: string): MeshStandardMaterial {
    return new MeshStandardMaterial({
      color,
      roughness: 0.6,
      emissive: color,
      emissiveIntensity: 0.15,
    });
  }
}
