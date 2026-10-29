/**
 * The treat dispenser's singulation study (docs/treat-dispenser.md, "Simulation results"): many fills and treat variations, each
 * primed and then pressed a fixed number of times, counting the treats that actually leave per press. CI runs only a few scenarios
 * (`npm run check:physics -- treat-dispenser`); this runs the wider set in parallel and prints a table. Slow: tens of minutes.
 *
 *   npx tsx tools/physics/treat-dispenser-trials.ts [--presses 8] [--jobs 8] [--quick] [--magnets] [--band 14 --notch 3] [--json out.json]
 *
 * `--magnets` runs them with the flap's repelling magnets (`flapMagnets`); `--band` with a rubber band (`flapBand`) in notch `--notch`.
 *
 * Needs an OpenSCAD runtime (the parts are rendered once, for their mass properties).
 */
import { fork } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { availableParallelism } from 'node:os';
import { dirname } from 'node:path';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';
import { DEFAULT_TREAT_DISPENSER, findModel, resolveAssembly, treatDispenserPhysics, treatDispenserLayout, treatVertices, type FillMode, type TreatDispenserParameters } from '@canfactory/contracts';
import { buildScene, CycleController, loadEngine, Simulation, type BodyGeometry } from '@canfactory/physics';
import { meshCacheFile } from './treat-trial-cache.ts';

const { values } = parseArgs({ options: { presses: { type: 'string', default: '8' }, jobs: { type: 'string' }, quick: { type: 'boolean', default: false }, magnets: { type: 'boolean', default: false }, band: { type: 'string', default: 'none' }, notch: { type: 'string', default: '2' }, json: { type: 'string' }, child: { type: 'string' } } });

/** One trial: a fill and, optionally, treats that differ from the nominal ones the dispenser is sized for. */
export interface Trial {
  name: string; group: string; seed: number; mode: FillMode; count: number;
  /** The treats themselves (the dispenser stays sized for 14 × 9 × 5 mm, r 1.5). */
  treat?: { length?: number; width?: number; thickness?: number; radius?: number; mass?: number; friction?: number };
}
/**
 * perPress: treats past the chute's mouth from each press until the next (0.5 s after its cycle ends); faults: cycles that stalled
 * (lost more than the controller's limit: a wedged treat or a jam); maxSpeed: the fastest a treat moved (m/s) while still in the
 * mechanism — far above a falling treat's ~1 m/s means the solver flung it (instability), not physics.
 */
export interface TrialResult { trial: Trial; prime: number; perPress: number[]; idle: number; dry: number; lost: number; faults: number; maxSpeed: number; maxFlap: number; flapAbove: Record<number, number>; error?: string; seconds: number }


function trials(quick: boolean): Trial[] {
  const list: Trial[] = [];
  const seeds = quick ? [1, 2] : [1, 2, 3, 4, 5, 6];
  for (const seed of seeds) list.push({ name: `random ${seed}`, group: 'Random fills, 10 treats', seed, mode: 'random', count: 10 });
  for (const mode of ['flat', 'edge', 'end', 'diagonal'] as const) list.push({ name: `${mode} 1`, group: 'One orientation, 10 treats', seed: 1, mode, count: 10 });
  if (quick) return list;
  const variations: [string, Trial['treat'], number?][] = [
    ['friction 0.3', { friction: 0.3 }], ['friction 0.55', { friction: 0.55 }],
    ['mass 0.3 g', { mass: 0.3 }], ['mass 0.8 g', { mass: 0.8 }],
    ['13 × 8.5 × 4.5', { length: 13, width: 8.5, thickness: 4.5 }], ['15 × 9.5 × 5.5', { length: 15, width: 9.5, thickness: 5.5 }],
    ['corner r 1.0', { radius: 1 }], ['corner r 2.2', { radius: 2.2 }],
    ['6 treats', undefined, 6], ['12 treats', undefined, 12],
  ];
  for (const [name, treat, count] of variations) for (const seed of [1, 2, 3]) list.push({ name: `${name}, random ${seed}`, group: name, seed, mode: 'random', count: count ?? 10, ...(treat ? { treat } : {}) });
  return list;
}

/** Renders the parts once per geometry (mass properties come from their meshes, as in CI); `file` is keyed on their sources. */
/** The settings every trial starts from: the defaults, with or without the flap's magnets and band. */
const base = (): TreatDispenserParameters => ({ ...DEFAULT_TREAT_DISPENSER, flapMagnets: values.magnets, flapBand: values.band as TreatDispenserParameters['flapBand'], flapBandNotch: Number(values.notch) });

async function geometry(file: string): Promise<Record<string, number[]>> {
  try { return JSON.parse(await readFile(file, 'utf8')) as Record<string, number[]>; } catch { /* render below */ }
  const { renderAssemblyMeshes } = await import('../assembly-meshes.ts');
  const model = findModel('treat-dispenser');
  if (!model?.assembly) throw new Error('No treat dispenser model.');
  const assembly = resolveAssembly(model, model.assemblyForParameters?.(base()) ?? model.assembly, base()) ?? model.assembly;
  const meshes = await renderAssemblyMeshes(model as never, assembly, base());
  const result: Record<string, number[]> = {};
  for (const id of ['rotor', 'inner-body', 'chute', 'flap']) { const mesh = meshes.get(id); if (mesh) result[id] = Array.from(mesh.tris); }
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify(result));
  return result;
}

async function runTrial(trial: Trial, presses: number, meshes: Record<string, number[]>): Promise<TrialResult> {
  const started = performance.now();
  const p: TreatDispenserParameters = base();
  const spec = treatDispenserPhysics(p, { treats: trial.count, seed: trial.seed, mode: trial.mode, scenarios: false });
  if (trial.treat) {
    const t = trial.treat;
    const vertices = treatVertices({ treatLength: t.length ?? p.treatLength, treatWidth: t.width ?? p.treatWidth, treatThickness: t.thickness ?? p.treatThickness, treatCornerRadius: t.radius ?? p.treatCornerRadius });
    spec.items = (spec.items ?? []).map(item => ({ ...item, vertices, ...(t.mass ? { mass: t.mass } : {}), ...(t.friction ? { friction: t.friction } : {}) }));
  }
  const model = findModel('treat-dispenser');
  if (!model?.assembly) throw new Error('No treat dispenser model.');
  const geometryById: Record<string, BodyGeometry> = Object.fromEntries(Object.entries(meshes).map(([id, tris]) => [id, { triangles: tris }]));
  const engine = await loadEngine();
  const simulation = new Simulation(engine, buildScene({ spec, poses: model.assembly.poses, geometry: geometryById }));
  try {
    const settings = spec.controller;
    if (!settings) throw new Error('No controller.');
    const controller = new CycleController(simulation, settings);
    let maxSpeed = 0, faults = 0, maxFlap = 0;
    // how far the flap opens: its widest, and how long it spends past 20°, 30° and 40° (s)
    const flapAbove: Record<number, number> = { 20: 0, 30: 0, 40: 0 };
    const items = (spec.items ?? []).map(item => item.id);
    const l = treatDispenserLayout(p);
    const [cx, cy, cz] = [0, 0, l.axisZ / 1000];
    const last = new Map<string, number[]>(items.map(id => [id, simulation.pose(id).pos]));
    const step = (seconds: number) => {
      for (let done = 0; done < seconds - 1e-9; done += 0.005) {
        simulation.advance(0.005);
        const open = simulation.jointValue('flap') * 180 / Math.PI;
        maxFlap = Math.max(maxFlap, open);
        for (const limit of [20, 30, 40]) if (open > limit) flapAbove[limit] = (flapAbove[limit] ?? 0) + 0.005;
      }
      for (const id of items) {
        const now = simulation.pose(id).pos, before = last.get(id) ?? now;
        // only treats still in the mechanism (within 120 mm of the rotor's axis): one that has left falls freely, with no floor
        if (Math.hypot(now[0] - cx, now[1] - cy, now[2] - cz) < 0.12) maxSpeed = Math.max(maxSpeed, Math.hypot(now[0] - (before[0] ?? 0), now[1] - (before[1] ?? 0), now[2] - (before[2] ?? 0)) / seconds);
        last.set(id, now);
      }
    };
    const tap = (control: string) => { controller.press(control, true); step(0.1); controller.press(control, false); };
    const wait = () => {
      let guard = 0;
      while (controller.report().state === 'running' && guard++ < 400) step(0.1);
      if (controller.report().state === 'fault') {
        // a stall: count it, then reset and re-align as the owner would, and carry on
        faults++;
        tap('reset'); step(1); tap('aligned'); step(0.1);
      }
      step(0.5);
    };
    step(0.8);
    tap('prime'); wait();
    const prime = controller.report().exits;
    const perPress: number[] = [];
    for (let k = 0; k < presses; k++) {
      const before = controller.report().exits;
      tap('boot'); wait();
      perPress.push(controller.report().exits - before);
    }
    const report = controller.report();
    return { trial, prime, perPress, idle: report.idleExits, dry: simulation.counted('stray').length + simulation.counted('stray-motor').length, lost: report.lost, faults, maxSpeed, maxFlap, flapAbove, seconds: (performance.now() - started) / 1000 };
  } finally { simulation.dispose(); }
}

if (values.child) {
  // a worker process: run the trials it is sent, one at a time
  const meshes = JSON.parse(await readFile(values.child, 'utf8')) as Record<string, number[]>;
  process.on('message', (message: { trial: Trial; presses: number } | 'exit') => {
    if (message === 'exit') { process.exit(0); }
    void runTrial(message.trial, message.presses, meshes)
      .then(result => process.send?.(result))
      .catch((error: unknown) => process.send?.({ trial: message.trial, prime: 0, perPress: [], idle: 0, dry: 0, lost: 0, faults: 0, maxSpeed: 0, maxFlap: 0, flapAbove: {}, seconds: 0, error: error instanceof Error ? error.message : String(error) } satisfies TrialResult));
  });
} else {
  const presses = Number(values.presses);
  const list = trials(values.quick);
  const meshFile = await meshCacheFile(base());
  await geometry(meshFile);
  const jobs = Math.min(list.length, Number(values.jobs ?? Math.max(1, availableParallelism() - 1)));
  console.log(`${list.length} trials, ${presses} presses each after Prime, ${jobs} processes`);
  const results: TrialResult[] = [];
  const queue = [...list];
  await Promise.all(Array.from({ length: jobs }, () => new Promise<void>(resolve => {
    const child = fork(fileURLToPath(import.meta.url), ['--child', meshFile, ...(values.magnets ? ['--magnets'] : []), '--band', values.band, '--notch', values.notch], { execArgv: ['--import', 'tsx'] });
    const next = () => { const trial = queue.shift(); if (trial) child.send({ trial, presses }); else { child.send('exit'); resolve(); } };
    child.on('message', (result: TrialResult) => {
      results.push(result);
      const exact = result.perPress.filter(n => n === 1).length;
      console.log(`${result.error ? 'ERROR' : exact === result.perPress.length ? 'ok   ' : 'MISS '} ${result.trial.name}: prime ${result.prime}, presses ${result.perPress.join(' ')} (${exact}/${result.perPress.length} exactly one), idle ${result.idle}, stray ${result.dry}, lost ${result.lost.toFixed(1)}°, stalls ${result.faults}, max speed ${result.maxSpeed.toFixed(2)} m/s, flap at most ${result.maxFlap.toFixed(0)}° (past 20/30/40°: ${[20, 30, 40].map(k => (result.flapAbove[k] ?? 0).toFixed(2)).join('/')} s) ${result.error ?? ''} [${result.seconds.toFixed(0)} s]`);
      next();
    });
    next();
  })));
  // per group: presses with 0, 1, 2+ treats
  const groups = [...new Set(list.map(trial => trial.group))];
  console.log('\n| Trials | Presses | First press: 0 / 1 / 2+ | All presses: 0 / 1 / 2+ | Stalls | Leaked between cycles | Strayed into the electronics | Fastest treat |\n| --- | --- | --- | --- | --- | --- | --- | --- |');
  const line = (name: string, rs: TrialResult[]) => {
    const all = rs.flatMap(r => r.perPress), first = rs.map(r => r.perPress[0] ?? 0);
    const split = (ns: number[]) => `${ns.filter(n => n === 0).length} / ${ns.filter(n => n === 1).length} / ${ns.filter(n => n >= 2).length}`;
    console.log(`| ${name} (${rs.length}) | ${all.length} | ${split(first)} | ${split(all)} | ${rs.reduce((s, r) => s + r.faults, 0)} | ${rs.reduce((s, r) => s + r.idle, 0)} | ${rs.reduce((s, r) => s + r.dry, 0)} | ${Math.max(0, ...rs.map(r => r.maxSpeed)).toFixed(2)} m/s |`);
  };
  for (const group of groups) line(group, results.filter(r => r.trial.group === group && !r.error));
  line('All', results.filter(r => !r.error));
  if (values.json) await writeFile(values.json, JSON.stringify(results, null, 2));
}
