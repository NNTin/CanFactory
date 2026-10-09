/**
 * The MuJoCo engine (WebAssembly), loaded once per process or Web Worker. See docs/physics-plan.md.
 *
 * The bindings type most arrays as `any`; this file narrows the part of the API that the physics package uses to real types,
 * so that nothing else touches the untyped surface. Known gaps in 3.14.0: reading `MjData.eq_active` (an `mjtBool` array) throws
 * a binding error, so equality constraints are never toggled at run time. Every handle (`MjModel`, `MjData`, buffers, contact vectors) lives on the
 * WebAssembly heap and must be freed with `delete()` exactly once.
 */
import loadMujoco from '@mujoco/mujoco';

export interface Handle { delete(): void }

/** The compiled model (read-only after compilation, except the arrays noted). */
export interface MjModel extends Handle {
  readonly nbody: number;
  readonly ngeom: number;
  readonly njnt: number;
  readonly nq: number;
  readonly nv: number;
  readonly nu: number;
  readonly neq: number;
  readonly nmocap: number;
  readonly body_mass: Float64Array;
  /** Per body: its inertia matrix's diagonal (principal moments about its centre of mass). */
  readonly body_inertia: Float64Array;
  readonly body_parentid: Int32Array;
  readonly body_mocapid: Int32Array;
  readonly geom_bodyid: Int32Array;
  readonly jnt_qposadr: Int32Array;
  readonly jnt_dofadr: Int32Array;
  readonly jnt_type: Int32Array;
  readonly jnt_bodyid: Int32Array;
  /** Per equality constraint: its data (for a `connect`, the anchor in body 1's frame, then in body 2's); writable. */
  readonly eq_data: Float64Array;
  readonly eq_obj1id: Int32Array;
  readonly eq_obj2id: Int32Array;
}

/** The simulation state. Its arrays are live views into WebAssembly memory: valid until the data is deleted. */
export interface MjData extends Handle {
  time: number;
  readonly ncon: number;
  readonly qpos: Float64Array;
  readonly qvel: Float64Array;
  readonly ctrl: Float64Array;
  /** Per body: position (3) of its frame in the world. */
  readonly xpos: Float64Array;
  /** Per body: orientation (w, x, y, z) of its frame in the world. */
  readonly xquat: Float64Array;
  /** Per body: rotation matrix (row-major 3×3) of its frame. */
  readonly xmat: Float64Array;
  /** Per body: position of its centre of mass. */
  readonly xipos: Float64Array;
  /** Per body: force (3) and torque (3) applied at its centre of mass, in the world frame. */
  readonly xfrc_applied: Float64Array;
  readonly mocap_pos: Float64Array;
  readonly mocap_quat: Float64Array;
  /** Per joint degree of freedom: the constraint force (contacts, limits, equalities) on it. */
  readonly qfrc_constraint: Float64Array;
  readonly sensordata: Float64Array;
}

export interface MjContact extends Handle {
  readonly geom1: number;
  readonly geom2: number;
  readonly dist: number;
  readonly pos: Float64Array;
  readonly frame: Float64Array;
}

interface ContactVector extends Handle { size(): number; get(index: number): MjContact | undefined }

export interface DoubleBuffer extends Handle { GetView(): Float64Array }

/** The functions of the MuJoCo module that the physics package calls. */
export interface Engine {
  MjModel: { from_xml_string(xml: string): MjModel };
  MjData: new (model: MjModel) => MjData;
  /** A zeroed buffer of this many doubles. */
  DoubleBuffer: new (size: number) => DoubleBuffer;
  mj_step(model: MjModel, data: MjData): void;
  mj_forward(model: MjModel, data: MjData): void;
  mj_resetData(model: MjModel, data: MjData): void;
  mj_name2id(model: MjModel, type: number, name: string): number;
  mj_stateSize(model: MjModel, signature: number): number;
  mj_getState(model: MjModel, data: MjData, state: DoubleBuffer, signature: number): void;
  mj_contactForce(model: MjModel, data: MjData, index: number, result: DoubleBuffer): void;
  /** The object's 6D velocity (angular, then linear) about its centre (a body's centre of mass), in world axes when `local` is 0. */
  mj_objectVelocity(model: MjModel, data: MjData, type: number, id: number, result: DoubleBuffer, local: number): void;
  mj_versionString(): string;
}

/** `mjtObj` values. */
export const OBJ = { body: 1, joint: 3, geom: 5, site: 6, actuator: 19, equality: 17, sensor: 20 } as const;
/** `mjSTATE_PHYSICS`: time, positions, velocities and actuator activations. */
export const STATE_PHYSICS = 30;

/** Copies of the contacts at this moment (`data.contact` is a copy, not a view). */
export function contacts(data: MjData): { geom1: number; geom2: number; dist: number; pos: [number, number, number] }[] {
  const vector = (data as unknown as { contact: ContactVector }).contact;
  try {
    const result = [];
    for (let i = 0; i < vector.size(); i++) {
      const contact = vector.get(i);
      if (!contact) continue;
      result.push({ geom1: contact.geom1, geom2: contact.geom2, dist: contact.dist, pos: [contact.pos[0] ?? 0, contact.pos[1] ?? 0, contact.pos[2] ?? 0] as [number, number, number] });
      contact.delete();
    }
    return result;
  } finally {
    vector.delete();
  }
}

/** Where the browser finds `mujoco.wasm`; Node finds it next to the module. */
export interface EngineOptions { wasmUrl?: string }

let engine: Promise<Engine> | undefined;

/**
 * The engine, loaded on first use.
 *
 * This is the single-threaded build. The multithreaded one (`@mujoco/mujoco/mt`) parallelises the solver, but it needs
 * `SharedArrayBuffer`, so the site would have to be cross-origin isolated: every response sent with
 * `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: require-corp` (Cloudflare, Traefik and the web
 * server), and every cross-origin resource the page loads allowing it. Switch only if the interactive mode's frame rate demands
 * it (docs/physics-plan.md, "Threading"); decomposition already runs in parallel in plain Web Workers.
 */
export function loadEngine(options: EngineOptions = {}): Promise<Engine> {
  engine ??= loadMujoco(options.wasmUrl === undefined ? undefined : { locateFile: (file: string) => file.endsWith('.wasm') ? options.wasmUrl : file })
    .then(module => module as unknown as Engine);
  return engine;
}
