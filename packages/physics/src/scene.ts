/**
 * The physics scene: what the scene compiler (`buildScene`) makes of a mechanism spec and the parts' collision geometry, and what
 * `toMjcf` turns into a MuJoCo model. It is in SI units (metres, kilograms, seconds, radians), unlike the spec (millimetres, grams,
 * degrees), and it is the only description of a scene that the engine side reads.
 */
export type Vec3 = [number, number, number];
/** A unit quaternion (w, x, y, z). */
export type Quat = [number, number, number, number];

export const MM = 1e-3;
export const GRAM = 1e-3;
export const DEG = Math.PI / 180;

/** A convex collision shape, in its body's frame. */
export type SceneGeom =
  | { type: 'mesh'; /** Vertices (x, y, z, ...) of a convex piece; MuJoCo collides their convex hull. */ vertices: number[] }
  | { type: 'sphere'; radius: number; pos: Vec3 }
  | { type: 'cylinder'; radius: number; halfLength: number; pos: Vec3; quat: Quat }
  | { type: 'capsule'; radius: number; halfLength: number; pos: Vec3; quat: Quat }
  | { type: 'box'; halfSize: Vec3; pos: Vec3; quat: Quat };

export interface SceneJoint {
  type: 'hinge' | 'slide' | 'ball';
  /** In the body's frame. */
  pos: Vec3;
  /** In the body's frame (hinge, slide). */
  axis: Vec3;
  /** Radians (hinge) or metres (slide). */
  range?: [number, number];
  /** N/m or N·m/rad, towards `springRef`. */
  stiffness?: number;
  /** The joint value at which the spring is relaxed (the assembled pose is 0). */
  springRef?: number;
  damping?: number;
  /** Inertia added to the joint (kg or kg·m²): see `jointArmature` in build.ts. */
  armature?: number;
  /** Dry friction: N (slide) or N·m (hinge). */
  frictionLoss?: number;
  /** The joint's value at the start (the assembled pose is 0). */
  initial?: number;
}

export interface Inertial {
  mass: number;
  /** Centre of mass in the body's frame. */
  pos: Vec3;
  /** Inertia about the centre of mass, in the body's frame: xx, yy, zz, xy, xz, yz. */
  inertia: [number, number, number, number, number, number];
}

export interface SceneBody {
  name: string;
  /** The parent body's name, or null for the world. */
  parent: string | null;
  /** Pose in the parent's frame. */
  pos: Vec3;
  quat: Quat;
  /** How it moves relative to its parent: a joint, free (6 degrees of freedom), or welded. */
  motion: SceneJoint | 'free' | 'weld';
  inertial?: Inertial;
  geoms: SceneGeom[];
  /** Friction coefficients (sliding, torsional, rolling) of its geoms. */
  friction: Vec3;
  /** Whether it collides with its parent body (MuJoCo's default is not to). */
  collideWithParent?: boolean;
}

export interface SceneOptions {
  timestep: number;
  gravity: Vec3;
  /** `solref` (time constant, damping ratio) and `solimp` of every contact and limit. */
  solref: [number, number];
  solimp: [number, number, number];
}

export interface Scene {
  options: SceneOptions;
  bodies: SceneBody[];
  /** Pairs of bodies that never collide. */
  exclude: [string, string][];
  /**
   * Bodies whose joint a scenario drives: each gets an equality constraint holding its joint at a target the simulation moves
   * (`Simulation.driveJoint`). It is always active, since equality constraints cannot be switched at run time (engine.ts).
   */
  drives?: { body: string; type: 'hinge' | 'slide' }[];
  /** Fingertips: spheres a scenario moves (mocap bodies), pushing what they meet. They start out of the way. */
  fingers?: { name: string; radius: number }[];
}

/**
 * Defaults chosen in spike 1 (docs/physics-plan.md, "Units and scale"). MuJoCo's own defaults (2 ms step, `solref` 0.02 1,
 * `solimp` 0.9 0.95 0.001) let a 10 g box sink 0.11 mm into the floor and a 4.5 mm steel ball 0.37 mm: as much as the clearances
 * the models are built with. A 0.5 ms step, a 2 ms time constant and `solimp` 0.99 0.999 0.0001 bring both under 1 µm and still
 * simulate a second in about 30 ms.
 */
export const DEFAULT_OPTIONS: SceneOptions = {
  timestep: 0.0005,
  gravity: [0, 0, -9.81],
  solref: [0.002, 1],
  solimp: [0.99, 0.999, 0.0001],
};
