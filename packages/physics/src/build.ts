/**
 * The scene compiler's first half: a model's mechanism spec (contracts, engine-neutral, millimetres, grams and degrees) and its
 * parts' geometry (meshes and convex pieces, millimetres, each part in its own frame) become a scene in SI units. `toMjcf` is
 * the second half. Nothing here reads files or renders: the geometry comes in as numbers.
 */
import { physicsMaterial, type PhysicsBody, type PhysicsJoint, type PhysicsSpec } from '@canfactory/contracts';
import { inertialOf, massProperties } from './massProperties.ts';
import { DEFAULT_OPTIONS, DEG, GRAM, MM, type Inertial, type Scene, type SceneBody, type SceneGeom, type SceneJoint, type SceneOptions, type Vec3 } from './scene.ts';
import { IDENTITY, quatAxisAngle, quatFromPoseRotation, relative, rotate, scale, sub, type Transform } from './transform.ts';

/** An assembly pose (`Assembly['poses']`): the part's STL turned (degrees, X then Y then Z), then moved (mm). */
export interface PartPose { position: number[]; rotation?: number[] | undefined; scale?: number[] | undefined }

/** A body's geometry, in millimetres in its part's own frame. */
export interface BodyGeometry {
  /** The part's closed mesh, 9 numbers per triangle: its mass properties come from it. */
  triangles?: ArrayLike<number>;
  /** Its convex collision pieces, each a list of vertices (x, y, z, ...): decomposed or authored. */
  pieces?: number[][];
}

export interface BuildInput {
  spec: PhysicsSpec;
  poses: Record<string, PartPose>;
  geometry: Record<string, BodyGeometry | undefined>;
  /** The direction gravity pulls in, in the assembled frame; down (−Z) by default. */
  gravity?: Vec3;
  options?: Partial<SceneOptions>;
  /** Bodies whose joint is driven (`Scene.drives`). */
  drives?: string[];
}

/** Torsional and rolling friction, which the materials do not give: MuJoCo's defaults for a body of a few centimetres. */
const TORSION = 0.005;
const ROLLING = 0.0001;

const toSI = (values: readonly number[]): Vec3 => [(values[0] ?? 0) * MM, (values[1] ?? 0) * MM, (values[2] ?? 0) * MM];

function worldPose(id: string, poses: Record<string, PartPose>): Transform {
  const pose = poses[id];
  if (!pose) throw new Error(`Physics body ${id} has no pose in the assembly.`);
  if (pose.scale && pose.scale.some(value => value !== 1)) throw new Error(`Physics body ${id} is scaled in the assembly; a rigid body cannot be.`);
  return { pos: toSI(pose.position), quat: quatFromPoseRotation(pose.rotation) };
}

/** A joint's spring, damping, friction, range and initial value in SI units: radians for a hinge, metres for a slide. */
function jointValues(joint: PhysicsJoint): Omit<SceneJoint, 'type' | 'pos' | 'axis'> {
  const hinge = joint.type === 'hinge';
  const value = hinge ? DEG : MM; // degrees or mm → radians or m
  // N·mm/° → N·m/rad, N/mm → N/m; N·mm·s/° → N·m·s/rad, N·s/mm → N·s/m; N·mm → N·m, N → N
  const stiffness = hinge ? MM / DEG : 1 / MM;
  const result: Omit<SceneJoint, 'type' | 'pos' | 'axis'> = {};
  if (joint.range) result.range = [(joint.range[0] ?? 0) * value, (joint.range[1] ?? 0) * value];
  if (joint.spring) { result.stiffness = joint.spring.stiffness * stiffness; result.springRef = joint.spring.rest * value; }
  if (joint.damping !== undefined) result.damping = joint.damping * stiffness;
  if (joint.friction !== undefined) result.frictionLoss = joint.friction * (hinge ? MM : 1);
  if (joint.initial !== undefined) result.initial = joint.initial * value;
  return result;
}

function primitive(body: PhysicsBody): SceneGeom[] {
  const collision = body.collision ?? { kind: 'decompose' };
  switch (collision.kind) {
    case 'sphere': return [{ type: 'sphere', radius: collision.diameter / 2 * MM, pos: toSI(collision.centre) }];
    case 'box': return [{ type: 'box', halfSize: scale(toSI(collision.size), 0.5), pos: toSI(collision.centre), quat: IDENTITY }];
    case 'cylinder': {
      // MuJoCo's cylinder lies along its own Z: turn Z onto the axis
      const axis = collision.axis as Vec3;
      const length = Math.hypot(...axis);
      const z: Vec3 = [0, 0, 1];
      const turn: Vec3 = [z[1] * axis[2] - z[2] * axis[1], z[2] * axis[0] - z[0] * axis[2], z[0] * axis[1] - z[1] * axis[0]];
      const angle = Math.acos(Math.max(-1, Math.min(1, axis[2] / length)));
      const quat = Math.hypot(...turn) < 1e-12 ? (axis[2] > 0 ? IDENTITY : quatAxisAngle([1, 0, 0], Math.PI)) : quatAxisAngle(turn, angle);
      return [{ type: 'cylinder', radius: collision.diameter / 2 * MM, halfLength: collision.length / 2 * MM, pos: toSI(collision.centre), quat }];
    }
    default: return [];
  }
}

/** A primitive's inertial at this density (kg/m³), for a body without a mesh. */
function primitiveInertial(geom: SceneGeom, density: number): Inertial | undefined {
  switch (geom.type) {
    case 'sphere': {
      const mass = density * 4 / 3 * Math.PI * geom.radius ** 3, i = 0.4 * mass * geom.radius ** 2;
      return { mass, pos: geom.pos, inertia: [i, i, i, 0, 0, 0] };
    }
    case 'box': {
      const [a, b, c] = scale(geom.halfSize, 2);
      const mass = density * a * b * c;
      return { mass, pos: geom.pos, inertia: [mass * (b * b + c * c) / 12, mass * (a * a + c * c) / 12, mass * (a * a + b * b) / 12, 0, 0, 0] };
    }
    default: return undefined;
  }
}

function inertialFor(body: PhysicsBody, geometry: BodyGeometry | undefined, geoms: SceneGeom[]): Inertial | undefined {
  const density = physicsMaterial(body.material).density * 1000; // g/cm³ → kg/m³
  let inertial: Inertial | undefined;
  if (geometry?.triangles) inertial = inertialOf(massProperties(geometry.triangles), density, MM);
  else if (geoms.length === 1 && geoms[0]) inertial = primitiveInertial(geoms[0], density);
  if (!inertial) return undefined;
  if (body.mass === undefined) return inertial;
  const ratio = body.mass * GRAM / inertial.mass;
  return { mass: body.mass * GRAM, pos: inertial.pos, inertia: inertial.inertia.map(value => value * ratio) as Inertial['inertia'] };
}

function collisionGeoms(body: PhysicsBody, geometry: BodyGeometry | undefined): SceneGeom[] {
  const kind = body.collision?.kind ?? 'decompose';
  if (kind !== 'decompose' && kind !== 'pieces') return primitive(body);
  const pieces = geometry?.pieces;
  if (!pieces) throw new Error(`Physics body ${body.id} needs its convex pieces (${kind}).`);
  return pieces.filter(piece => piece.length >= 12).map(piece => ({ type: 'mesh', vertices: piece.map(value => value * MM) }));
}

function driveOf(spec: PhysicsSpec, body: string): { body: string; type: 'hinge' | 'slide' } {
  const joint = spec.bodies.find(candidate => candidate.id === body)?.joint;
  if (!joint || joint.model === 'contact' || joint.type === 'ball') throw new Error(`Physics body ${body} has no ideal hinge or slide to drive.`);
  return { body, type: joint.type };
}

/** The scene for this spec, these poses and this geometry. */
export function buildScene(input: BuildInput): Scene {
  const { spec, poses, geometry } = input;
  const ids = new Set(spec.bodies.map(body => body.id));
  const world = new Map(spec.bodies.map(body => [body.id, worldPose(body.id, poses)]));
  const bodies: SceneBody[] = spec.bodies.map(body => {
    const joint = body.joint;
    if (joint?.parent !== undefined && !ids.has(joint.parent)) throw new Error(`Physics body ${body.id}: its joint's parent ${joint.parent} is not a body.`);
    const pose = world.get(body.id) ?? { pos: [0, 0, 0], quat: IDENTITY };
    const contactModel = joint?.model === 'contact';
    const parent = joint && !contactModel ? joint.parent ?? null : null;
    const parentPose = parent === null ? undefined : world.get(parent);
    const local = parentPose ? relative(parentPose, pose) : pose;
    let motion: SceneBody['motion'];
    if (body.fixed === true) motion = 'weld';
    else if (!joint || contactModel) motion = 'free';
    else {
      const inverse: Transform['quat'] = [pose.quat[0], -pose.quat[1], -pose.quat[2], -pose.quat[3]];
      const axis = joint.axis ?? [0, 0, 1];
      motion = {
        type: joint.type,
        pos: rotate(inverse, sub(toSI(joint.anchor), pose.pos)),
        axis: rotate(inverse, [axis[0] ?? 0, axis[1] ?? 0, axis[2] ?? 0]),
        ...jointValues(joint),
      };
    }
    const geoms = collisionGeoms(body, geometry[body.id]);
    const friction = physicsMaterial(body.material).friction;
    const result: SceneBody = { name: body.id, parent, pos: local.pos, quat: local.quat, motion, geoms, friction: [friction, TORSION, ROLLING] };
    const inertial = body.fixed === true ? undefined : inertialFor(body, geometry[body.id], geoms);
    if (inertial) result.inertial = inertial;
    if (joint?.collideWithParent === true && parent !== null) result.collideWithParent = true;
    return result;
  });
  const gravity = input.gravity ?? [0, 0, -1];
  const g = Math.hypot(...gravity);
  if (g === 0) throw new Error('Gravity needs a direction.');
  return {
    options: { ...DEFAULT_OPTIONS, ...input.options, gravity: scale(gravity, 9.81 / g) },
    bodies,
    exclude: (spec.exclude ?? []).map(([a = '', b = '']) => [a, b] as [string, string]),
    ...(input.drives && input.drives.length > 0 ? { drives: input.drives.map(body => driveOf(spec, body)) } : {}),
  };
}
