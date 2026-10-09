/**
 * A running simulation of one scene: steps it, reports poses, joint values and contacts, and moves bodies by points (the
 * interactive mode's dragging, a scenario's pushes), by forces, or by driving their joints. The same class runs in a browser Web
 * Worker (interactive mode) and in Node (CI scenarios).
 */
import { contacts, OBJ, STATE_PHYSICS, type DoubleBuffer, type Engine, type MjData, type MjModel } from './engine.ts';
import { driveName, geomName, toMjcf, TOUCH } from './mjcf.ts';
import type { Quat, Scene, Vec3 } from './scene.ts';
import { add, cross, rotate, scale, sub } from './transform.ts';

/** `mjNEQDATA`: numbers per equality constraint in `eq_data`. */
const NEQDATA = 11;

export interface BodyPose { pos: Vec3; quat: Quat }

export interface Contact { body1: string; body2: string; dist: number; pos: Vec3 }

/**
 * How a held point follows its target: a spring of natural frequency `omega` (rad/s) for the held body's own mass, damped at
 * `damping` (1 is critical), its force capped at `maxForce` (N), and the body's spin damped at `spinDamping` (rad/s) so that a part
 * held by one point does not whirl about it. The spring is explicit (a force each step), so ω·Δt must stay well under 2.
 */
export interface HoldOptions { omega: number; damping: number; maxForce: number; spinDamping: number }

/**
 * Dragging with the pointer: 300 rad/s is ω·Δt = 0.15 at the 0.5 ms step, and 20 N is about what a finger presses with. Tuned in
 * spike 5 (docs/physics-plan.md).
 */
export const DRAG: HoldOptions = { omega: 300, damping: 1, maxForce: 20, spinDamping: 100 };

/** A held body point: its body, the point in the body's frame, its target (world frame, metres), and the mass its spring is for. */
interface Hold { name: string; body: number; local: Vec3; target: Vec3; options: HoldOptions; mass: number }

/** A force (N, world frame) at a body point (body frame, metres). */
interface Load { name: string; body: number; local: Vec3; force: Vec3 }

export class Simulation {
  readonly model: MjModel;
  readonly data: MjData;
  readonly xml: string;
  readonly bodies: readonly string[];
  private readonly bodyIds = new Map<string, number>();
  private readonly geomBody: string[] = [];
  private readonly holds = new Map<string, Hold>();
  private readonly loads = new Map<string, Load>();
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
    for (const finger of scene.fingers ?? []) this.geomBody[this.id(OBJ.geom, geomName(finger.name, 0))] = finger.name;
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
      this.data.qpos[this.qposAddress(body.name)] = body.motion.initial;
    }
  }

  private qposAddress(name: string): number { return this.model.jnt_qposadr[this.id(OBJ.joint, name)] ?? -1; }

  get time(): number { return this.data.time; }

  /** Advances `steps` time steps. */
  step(steps = 1): void {
    if (this.disposed) throw new Error('The simulation has been disposed.');
    for (let i = 0; i < steps; i++) {
      this.applyLoads();
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
  jointValue(name: string): number { return this.data.qpos[this.qposAddress(name)] ?? Number.NaN; }

  /**
   * Holds the joint of this body at `value` (radians or metres from its assembled pose) through its drive constraint, as stiff as
   * contact. Only for the bodies the scene lists in `drives`.
   */
  driveJoint(name: string, value: number): void {
    this.model.eq_data[NEQDATA * this.id(OBJ.equality, driveName(name))] = value;
  }

  /**
   * The constraint force on the joint of this body (N along a slide, N·m about a hinge): its drive's, its limits' and its
   * contacts' together.
   */
  jointConstraintForce(name: string): number {
    return this.data.qfrc_constraint[this.model.jnt_dofadr[this.id(OBJ.joint, name)] ?? -1] ?? Number.NaN;
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

  /** The smallest distance between two bodies' collision shapes, in metres (negative where they overlap), up to `limit`. */
  distance(a: string, b: string, limit = 0.01): number {
    let least = limit;
    for (const g1 of this.geomsOf(a)) for (const g2 of this.geomsOf(b)) least = Math.min(least, this.engine.mj_geomDistance(this.model, this.data, g1, g2, limit, null));
    return least;
  }

  /** Whether two bodies touch: within `TOUCH` (10 µm) of each other. */
  touching(a: string, b: string): boolean { return this.distance(a, b, 2 * TOUCH) < TOUCH; }

  private geomsOf(body: string): number[] {
    return this.geomBody.flatMap((name, id) => name === body ? [id] : []);
  }

  private local(body: string, point: Vec3): Vec3 {
    const pose = this.pose(body);
    return rotate([pose.quat[0], -pose.quat[1], -pose.quat[2], -pose.quat[3]], sub(point, pose.pos));
  }

  private world(body: string, local: Vec3): Vec3 {
    const pose = this.pose(body);
    return add(pose.pos, rotate(pose.quat, local));
  }

  /** Holds `body` by the world point `point` (metres) under `key`: the point then follows the target set by `moveHold`. */
  hold(key: string, body: string, point: Vec3, options: HoldOptions = DRAG): void {
    const id = this.bodyId(body);
    this.holds.set(key, { name: body, body: id, local: this.local(body, point), target: point, options, mass: this.massAt(body, id, point) });
  }

  /**
   * The mass a pull at `point` moves: the body's own, plus its joint's armature (build.ts adds it for quasi-static joints): as a mass
   * on a slide, and as an inertia over the point's squared distance from a hinge's axis. Without it a hinged lever, light but turning
   * against a heavy armature, barely followed the pointer.
   */
  private massAt(name: string, id: number, point: Vec3): number {
    const mass = this.model.body_mass[id] ?? 0;
    const motion = this.scene.bodies.find(body => body.name === name)?.motion;
    if (typeof motion !== 'object' || !motion.armature) return mass;
    if (motion.type === 'slide') return mass + motion.armature;
    const pose = this.pose(name);
    const anchor = add(pose.pos, rotate(pose.quat, motion.pos)), axis = rotate(pose.quat, motion.axis);
    const arm = sub(point, anchor);
    const along = (arm[0] * axis[0] + arm[1] * axis[1] + arm[2] * axis[2]) / Math.hypot(...axis);
    const r2 = Math.max(1e-6, arm[0] ** 2 + arm[1] ** 2 + arm[2] ** 2 - along ** 2);
    return mass + motion.armature / r2;
  }

  moveHold(key: string, target: Vec3): void {
    const hold = this.holds.get(key);
    if (hold) hold.target = target;
  }

  /** The held point's position now (world, metres). */
  heldPoint(key: string): Vec3 | undefined {
    const hold = this.holds.get(key);
    return hold ? this.world(hold.name, hold.local) : undefined;
  }

  releaseHold(key: string): void { this.holds.delete(key); }

  /** The body held under `key`. */
  held(key: string): string | undefined { return this.holds.get(key)?.name; }

  /** Applies `force` (N, world) at the world point `point` (metres) of `body`, under `key`, until `removeForce`. */
  addForce(key: string, body: string, point: Vec3, force: Vec3): void {
    this.loads.set(key, { name: body, body: this.bodyId(body), local: this.local(body, point), force });
  }

  removeForce(key: string): void { this.loads.delete(key); }

  hasForce(key: string): boolean { return this.loads.has(key); }

  /** Moves a fingertip (`Scene.fingers`) to `pos` (world, metres): a mocap body, moved as the scenario says, not by the physics. */
  moveFinger(name: string, pos: Vec3): void {
    const mocap = this.model.body_mocapid[this.id(OBJ.body, name)] ?? -1;
    if (mocap < 0) throw new Error(`${name} is not a finger.`);
    this.data.mocap_pos.set(pos, 3 * mocap);
  }

  /** Starts dragging with the pointer (`DRAG`). */
  grab(body: string, point: Vec3): void { this.hold('pointer', body, point); }
  dragTo(target: Vec3): void { this.moveHold('pointer', target); }
  release(): void { this.releaseHold('pointer'); }
  get dragging(): string | undefined { return this.held('pointer'); }

  /**
   * Every hold and force, as forces and torques at the bodies' centres of mass (`xfrc_applied`). A hold is a spring at its point
   * towards its target, damped by the point's velocity, as MuJoCo's own `mjv_applyPerturbForce` but scaled to the body's own mass
   * and capped.
   */
  private applyLoads(): void {
    const applied = this.data.xfrc_applied;
    applied.fill(0);
    const com = (id: number): Vec3 => [this.data.xipos[3 * id] ?? 0, this.data.xipos[3 * id + 1] ?? 0, this.data.xipos[3 * id + 2] ?? 0];
    const addAt = (id: number, point: Vec3, force: Vec3, torque: Vec3 = [0, 0, 0]) => {
      const moment = add(cross(sub(point, com(id)), force), torque);
      for (let k = 0; k < 3; k++) {
        applied[6 * id + k] = (applied[6 * id + k] ?? 0) + (force[k] ?? 0);
        applied[6 * id + 3 + k] = (applied[6 * id + 3 + k] ?? 0) + (moment[k] ?? 0);
      }
    };
    for (const load of this.loads.values()) addAt(load.body, this.world(load.name, load.local), load.force);
    for (const hold of this.holds.values()) {
      const id = hold.body, { omega, damping, maxForce, spinDamping } = hold.options;
      const point = this.world(hold.name, hold.local);
      this.engine.mj_objectVelocity(this.model, this.data, OBJ.body, id, this.velocity, 0);
      const v = this.velocity.GetView();
      const spin: Vec3 = [v[0] ?? 0, v[1] ?? 0, v[2] ?? 0];
      const velocity = add([v[3] ?? 0, v[4] ?? 0, v[5] ?? 0], cross(spin, sub(point, com(id))));
      const mass = hold.mass;
      let force = sub(scale(sub(hold.target, point), mass * omega ** 2), scale(velocity, 2 * damping * mass * omega));
      const magnitude = Math.hypot(...force);
      if (magnitude > maxForce) force = scale(force, maxForce / magnitude);
      const inertia = Math.max(this.model.body_inertia[3 * id] ?? 0, this.model.body_inertia[3 * id + 1] ?? 0, this.model.body_inertia[3 * id + 2] ?? 0);
      addAt(id, point, force, scale(spin, -inertia * spinDamping));
    }
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
