/**
 * The interactive mode's simulation (docs/physics-plan.md, spike 5): what the editor's physics Web Worker runs. It builds the scene
 * from a model's mechanism spec and the meshes the viewer already shows, decomposes the bodies that have no given pieces, then steps
 * in real time and moves bodies by the pointer. The messages are plain data, so that the worker only forwards them.
 */
import type { PhysicsSpec } from '@canfactory/contracts';
import { buildScene, type BodyGeometry, type PartPose } from './build.ts';
import { decompose, type DecomposeSettings } from './decompose.ts';
import type { Engine } from './engine.ts';
import { MM, type Vec3 } from './scene.ts';
import { Simulation } from './simulation.ts';
import { CycleController, type ControllerReport } from './controller.ts';

/** Millimetres, in the assembly's frame (the parts' SCAD frame, Z up). */
export type PhysicsRequest =
  | { type: 'start'; spec: PhysicsSpec; poses: Record<string, PartPose>; meshes: Record<string, Float32Array>; gravity?: Vec3 }
  | { type: 'grab'; body: string; point: Vec3 }
  | { type: 'drag'; point: Vec3 }
  | { type: 'release' }
  | { type: 'gravity'; direction: Vec3 }
  | { type: 'magnet'; id: string; enabled: boolean }
  /** A controller button (`PhysicsController.controls`) pressed down or let go. */
  | { type: 'control'; id: string; pressed: boolean }
  | { type: 'restart' }
  | { type: 'stop' };

/** Poses: per body in `bodies` order, its position (mm) and orientation (w, x, y, z). */
export type PhysicsUpdate =
  | { type: 'status'; text: string }
  | { type: 'ready'; bodies: string[]; movable: string[] }
  | { type: 'magnets'; enabled: Record<string, boolean> }
  | { type: 'controller'; report: ControllerReport }
  | { type: 'poses'; poses: Float64Array; time: number; realtime: number }
  | { type: 'error'; message: string };

/** The decomposer for bodies without given pieces (spike 2: V-HACD, the faster of the two). */
const DECOMPOSER: DecomposeSettings = { decomposer: 'vhacd' };

/** At most this much simulated time per tick, so that a slow device runs in slow motion rather than falling ever further behind. */
const MAX_TICK = 0.05;

/** A cache of decompositions, by a key of the mesh and the settings (the browser keeps them in IndexedDB). */
export interface PieceCache {
  get(key: string): Promise<number[][] | undefined>;
  set(key: string, pieces: number[][]): Promise<void>;
}

/** A key for a mesh's decomposition: FNV-1a of its bytes and the settings. */
export function pieceKey(mesh: Float32Array, settings: DecomposeSettings): string {
  let hash = 0xcbf29ce484222325n;
  const bytes = new Uint8Array(mesh.buffer, mesh.byteOffset, mesh.byteLength);
  for (const byte of bytes) hash = BigInt.asUintN(64, (hash ^ BigInt(byte)) * 0x100000001b3n);
  return `${hash.toString(16)}:${JSON.stringify(settings)}`;
}

export class InteractiveSession {
  private simulation: Simulation | undefined;
  private start: Extract<PhysicsRequest, { type: 'start' }> | undefined;
  private geometry: Record<string, BodyGeometry> = {};
  private gravity: Vec3 = [0, 0, -1];
  private lag = 0;
  private magnetStates: Record<string, boolean> = {};
  private controller: CycleController | undefined;
  private reported = '';

  constructor(private readonly engine: Engine, private readonly report: (update: PhysicsUpdate) => void, private readonly cache?: PieceCache) {}

  get running(): boolean { return this.simulation !== undefined; }

  async handle(request: PhysicsRequest): Promise<void> {
    switch (request.type) {
      case 'start': await this.begin(request); return;
      case 'grab': this.simulation?.grab(request.body, toMetres(request.point)); return;
      case 'drag': this.simulation?.dragTo(toMetres(request.point)); return;
      case 'release': this.simulation?.release(); return;
      case 'gravity': this.gravity = request.direction; this.rebuild(); return;
      case 'magnet': {
        this.simulation?.setMagnetEnabled(request.id, request.enabled);
        this.reportMagnets();
        break;
      }
      case 'control': this.controller?.press(request.id, request.pressed); return;
      case 'restart': this.rebuild(); return;
      case 'stop': this.simulation?.dispose(); this.simulation = undefined; return;
    }
  }

  private async begin(request: Extract<PhysicsRequest, { type: 'start' }>): Promise<void> {
    this.simulation?.dispose();
    this.simulation = undefined;
    this.start = request;
    this.magnetStates = Object.fromEntries((request.spec.magnets ?? []).map(magnet => [magnet.id, magnet.enabled ?? true]));
    this.gravity = request.gravity ?? [0, 0, -1];
    const geometry: Record<string, BodyGeometry> = {};
    const bodies = request.spec.bodies;
    for (const [index, body] of bodies.entries()) {
      const triangles = request.meshes[body.id];
      if (!triangles) throw new Error(`The preview has no mesh for ${body.id}.`);
      const kind = body.collision?.kind ?? 'decompose';
      if (kind !== 'decompose') { geometry[body.id] = { triangles }; continue; }
      this.report({ type: 'status', text: `Preparing ${body.id} for collisions (${index + 1} of ${bodies.length})` });
      const key = pieceKey(triangles, DECOMPOSER);
      let pieces = await this.cache?.get(key).catch(() => undefined);
      if (!pieces) {
        pieces = (await decompose(triangles, DECOMPOSER)).map(piece => piece.vertices);
        await this.cache?.set(key, pieces).catch(() => undefined);
      }
      geometry[body.id] = { triangles, pieces };
    }
    this.geometry = geometry;
    this.rebuild();
  }

  /** A fresh simulation from the start poses, with the current gravity. */
  private rebuild(): void {
    const start = this.start;
    if (!start) return;
    this.simulation?.dispose();
    this.simulation = new Simulation(this.engine, buildScene({ spec: start.spec, poses: start.poses, geometry: this.geometry, gravity: this.gravity, floor: true }));
    this.lag = 0;
    const simulation = this.simulation;
    // a scene restart is a refill: the device restarts with it (its controller starts afresh), unlike the controller's reset button
    this.controller = start.spec.controller ? new CycleController(simulation, start.spec.controller) : undefined;
    this.reported = '';
    for (const [id, enabled] of Object.entries(this.magnetStates)) simulation.setMagnetEnabled(id, enabled);
    this.report({ type: 'ready', bodies: [...simulation.bodies], movable: simulation.bodies.filter(id => simulation.movableBody(id)) });
    this.reportMagnets();
    this.report(this.poses(1));
  }

  /** Advances by `seconds` of real time (at most `MAX_TICK`), and reports the poses. */
  tick(seconds: number): void {
    const simulation = this.simulation;
    if (!simulation) return;
    const wanted = Math.min(seconds, MAX_TICK) + this.lag;
    const steps = Math.floor(wanted / simulation.scene.options.timestep);
    this.lag = wanted - steps * simulation.scene.options.timestep;
    const begun = performance.now();
    simulation.step(steps);
    const spent = (performance.now() - begun) / 1000;
    this.report(this.poses(spent > 0 ? steps * simulation.scene.options.timestep / spent : 1));
    this.reportController();
  }

  /** The controller's state, when it has changed (its travel rounded to a degree, so that it is not sent every frame). */
  private reportController(): void {
    if (!this.controller) return;
    const report = this.controller.report();
    const key = JSON.stringify({ ...report, commanded: Math.round(report.commanded), actual: Math.round(report.actual), lost: Math.round(report.lost * 10) });
    if (key === this.reported) return;
    this.reported = key;
    this.report({ type: 'controller', report });
  }

  private reportMagnets(): void {
    this.magnetStates = this.simulation?.magnetStates() ?? this.magnetStates;
    this.report({ type: 'magnets', enabled: { ...this.magnetStates } });
  }

  private poses(realtime: number): Extract<PhysicsUpdate, { type: 'poses' }> {
    const simulation = this.simulation;
    const poses = new Float64Array(7 * (simulation?.bodies.length ?? 0));
    simulation?.poses().forEach((pose, index) => {
      poses.set([pose.pos[0] / MM, pose.pos[1] / MM, pose.pos[2] / MM, ...pose.quat], 7 * index);
    });
    return { type: 'poses', poses, time: simulation?.time ?? 0, realtime };
  }
}

const toMetres = (point: Vec3): Vec3 => [point[0] * MM, point[1] * MM, point[2] * MM];
