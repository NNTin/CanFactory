/**
 * A running simulation of one scene: steps it, reports poses, joint values and contacts, and drags bodies. The same class runs
 * in a browser Web Worker (interactive mode) and in Node (CI scenarios).
 */
import { contacts, OBJ, STATE_PHYSICS, type DoubleBuffer, type Engine, type MjData, type MjModel } from './engine.ts';
import { geomName, toMjcf } from './mjcf.ts';
import type { Quat, Scene, Vec3 } from './scene.ts';
import { add, cross, rotate, scale, sub } from './transform.ts';

export interface BodyPose { pos: Vec3; quat: Quat }

export interface Contact { body1: string; body2: string; dist: number; pos: Vec3 }

/** A body point held by the drag spring: its body, the point in the body's frame, and its target (world frame, metres). */
interface Drag { name: string; body: number; local: Vec3; target: Vec3 }

/**
 * The drag spring's natural frequency (rad/s) for the dragged body's own mass, and its damping ratio. The spring is explicit (a
 * force each step), so ω·Δt must stay well under 2: 300 rad/s at the 0.5 ms step is 0.15. Its force is capped (`DRAG_MAX_FORCE`, N)
 * so that a light part dragged far away does not fly, and the body's spin is damped (`DRAG_SPIN_DAMPING`, as a frequency) so
 * that a part held by one point does not whirl about it. Tuned in spike 5 (docs/physics-plan.md).
 */
const DRAG_OMEGA = 300;
const DRAG_DAMPING = 1;
const DRAG_MAX_FORCE = 20;
const DRAG_SPIN_DAMPING = 100;

export class Simulation {
  readonly model: MjModel;
  readonly data: MjData;
  readonly xml: string;
  readonly bodies: readonly string[];
  private readonly bodyIds = new Map<string, number>();
  private readonly geomBody: string[] = [];
  private drag: Drag | undefined;
  private readonly velocity: DoubleBuffer;
  private disposed = false;

  constructor(private readonly engine: Engine, readonly scene: Scene) {
    this.xml = toMjcf(scene);
    this.model = engine.MjModel.from_xml_string(this.xml);
    this.data = new engine.MjData(this.model);
    this.velocity = new engine.DoubleBuffer(6);
    this.bodies = scene.bodies.map(body => body.name);
    for (const name of this.bodies) this.bodyIds.set(name, this.id(OBJ.body, name));
    for (const body of scene.bodies) body.geoms.forEach((_, index) => { this.geomBody[this.id(OBJ.geom, geomName(body.name, index))] = body.name; });
    this.setInitialJoints();
    engine.mj_forward(this.model, this.data);
  }

  private id(type: number, name: string): number {
    const id = this.engine.mj_name2id(this.model, type, name);
    if (id < 0) throw new Error(`The model has no ${name}.`);
    return id;
  }

  private setInitialJoints(): void {
    for (const body of this.scene.bodies) {
      if (typeof body.motion !== 'object' || body.motion.type === 'ball' || body.motion.initial === undefined) continue;
      const joint = this.id(OBJ.joint, body.name);
      this.data.qpos[this.model.jnt_qposadr[joint] ?? -1] = body.motion.initial;
    }
  }

  get time(): number { return this.data.time; }

  /** Advances `steps` time steps. */
  step(steps = 1): void {
    if (this.disposed) throw new Error('The simulation has been disposed.');
    for (let i = 0; i < steps; i++) {
      this.applyDrag();
      this.engine.mj_step(this.model, this.data);
    }
  }

  /** Advances by `seconds` (rounded to whole steps). */
  advance(seconds: number): void { this.step(Math.round(seconds / this.scene.options.timestep)); }

  private bodyId(name: string): number {
    const id = this.bodyIds.get(name);
    if (id === undefined) throw new Error(`The scene has no body ${name}.`);
    return id;
  }

  /** A body's frame in the world: the pose of its part's STL. */
  pose(name: string): BodyPose {
    const id = this.bodyId(name);
    const p = this.data.xpos, q = this.data.xquat;
    return {
      pos: [p[3 * id] ?? 0, p[3 * id + 1] ?? 0, p[3 * id + 2] ?? 0],
      quat: [q[4 * id] ?? 1, q[4 * id + 1] ?? 0, q[4 * id + 2] ?? 0, q[4 * id + 3] ?? 0],
    };
  }

  /** Every body's pose, in scene order (for the viewer). */
  poses(): BodyPose[] { return this.bodies.map(name => this.pose(name)); }

  /** The value of the joint that moves this body (radians or metres from its assembled pose). */
  jointValue(name: string): number {
    const joint = this.id(OBJ.joint, name);
    return this.data.qpos[this.model.jnt_qposadr[joint] ?? -1] ?? Number.NaN;
  }

  /** The contacts at this moment, by body. */
  contacts(): Contact[] {
    return contacts(this.data).map(contact => ({
      body1: this.geomBody[contact.geom1] ?? '(world)',
      body2: this.geomBody[contact.geom2] ?? '(world)',
      dist: contact.dist,
      pos: contact.pos,
    }));
  }

  /** Starts dragging `body` by the world point `point` (metres), which it then follows towards `dragTo`'s target. */
  grab(body: string, point: Vec3): void {
    const id = this.bodyId(body);
    const pose = this.pose(body);
    const inverse: Quat = [pose.quat[0], -pose.quat[1], -pose.quat[2], -pose.quat[3]];
    this.drag = { name: body, body: id, local: rotate(inverse, sub(point, pose.pos)), target: point };
  }

  dragTo(target: Vec3): void { if (this.drag) this.drag.target = target; }

  release(): void {
    if (this.drag) this.data.xfrc_applied.fill(0, 6 * this.drag.body, 6 * this.drag.body + 6);
    this.drag = undefined;
  }

  get dragging(): string | undefined { return this.drag?.name; }

  /**
   * The drag spring: a force at the held point towards the target, critically damped by the point's velocity, applied at the
   * body's centre of mass together with the torque of its lever arm, plus a torque damping the body's spin. As MuJoCo's own
   * `mjv_applyPerturbForce`, with the stiffness scaled to the body's own mass and its force capped.
   */
  private applyDrag(): void {
    const drag = this.drag;
    if (!drag) return;
    const id = drag.body;
    const pose = this.pose(drag.name);
    const point = add(pose.pos, rotate(pose.quat, drag.local));
    const com: Vec3 = [this.data.xipos[3 * id] ?? 0, this.data.xipos[3 * id + 1] ?? 0, this.data.xipos[3 * id + 2] ?? 0];
    const arm = sub(point, com);
    this.engine.mj_objectVelocity(this.model, this.data, OBJ.body, id, this.velocity, 0);
    const v = this.velocity.GetView();
    const spin: Vec3 = [v[0] ?? 0, v[1] ?? 0, v[2] ?? 0];
    const velocity = add([v[3] ?? 0, v[4] ?? 0, v[5] ?? 0], cross(spin, arm));
    const mass = this.model.body_mass[id] ?? 0;
    let force = sub(scale(sub(drag.target, point), mass * DRAG_OMEGA ** 2), scale(velocity, 2 * DRAG_DAMPING * mass * DRAG_OMEGA));
    const magnitude = Math.hypot(...force);
    if (magnitude > DRAG_MAX_FORCE) force = scale(force, DRAG_MAX_FORCE / magnitude);
    const inertia = Math.max(this.model.body_inertia[3 * id] ?? 0, this.model.body_inertia[3 * id + 1] ?? 0, this.model.body_inertia[3 * id + 2] ?? 0);
    const torque = sub(cross(arm, force), scale(spin, inertia * DRAG_SPIN_DAMPING));
    this.data.xfrc_applied.set([...force, ...torque], 6 * id);
  }

  /** A hash of the physics state (time, positions, velocities), to compare runs bit for bit. */
  stateHash(): string {
    const size = this.engine.mj_stateSize(this.model, STATE_PHYSICS);
    const buffer = new this.engine.DoubleBuffer(size);
    try {
      this.engine.mj_getState(this.model, this.data, buffer, STATE_PHYSICS);
      return fnv1a(new Uint8Array(Float64Array.from(buffer.GetView()).buffer));
    } finally {
      buffer.delete();
    }
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.velocity.delete();
    this.data.delete();
    this.model.delete();
  }
}

/** 64-bit FNV-1a, as 16 hex digits. */
export function fnv1a(bytes: Uint8Array): string {
  let hash = 0xcbf29ce484222325n;
  for (const byte of bytes) hash = BigInt.asUintN(64, (hash ^ BigInt(byte)) * 0x100000001b3n);
  return hash.toString(16).padStart(16, '0');
}
