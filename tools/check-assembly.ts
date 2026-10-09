/**
 * Checks a model's assembly (ModelDefinition.assembly) against its rendered parts: renders every part (as the worker does,
 * with the model defaults or `--parameters '<json>'`), places them as the preview's assembly slider does, and measures the
 * volume shared by parts that must not collide:
 * - the finished assembly (every pair of parts);
 * - the exploded layout (every pair), which must also stay above the print bed;
 * - each step, sampled along its path (the moving parts against all the others);
 * - the last CLOSING mm of each step, where snaps engage, in fine steps: a detent's bump shares volume there while it passes the
 *   mating wall, so these samples have their own, looser tolerance (`--snap-tolerance`). A pose that collides for real still
 *   fails it, and the assembled state is held to `--tolerance`;
 * - every frame of each movement (`Assembly.motion`, e.g. a latch opening and closing), every pair, held to `--tolerance`.
 *
 *   npm run check:assembly -- [model-id] [--parameters '{"snap":"detent"}'] [--tolerance 1] [--snap-tolerance 10]
 *
 * Needs an OpenSCAD runtime (see tools/stl-to-scad/openscad.ts). Exits 1 if any check fails.
 */
import { parseArgs } from 'node:util';
import { assemblyOffset, assemblyScale, motionFrames, isAssembly, models, resolveAssembly, validateParameters, type Assembly, type AssemblyState, type ModelDefinition, type ParameterValues } from '../packages/contracts/src/index.ts';
import { renderAssemblyMeshes } from './assembly-meshes.ts';
import { intersectionVolume } from './stl-to-scad/compare.ts';
import { bounds, g, type Mesh } from './stl-to-scad/stl.ts';

const SAMPLES = 16;
/** The last millimetres of each step's travel, sampled every CLOSING_STEP mm and held to the snap tolerance. */
const CLOSING = 10;
const CLOSING_STEP = 0.25;
const CELL = 0.25;

/** Scales (per axis), then rotates about X, then Y, then Z (degrees), then translates. */
function place(mesh: Mesh, rotation: readonly number[], position: readonly number[], scale: readonly number[] = [1, 1, 1]): Mesh {
  const [ax, ay, az] = rotation.map(degrees => degrees * Math.PI / 180) as [number, number, number];
  const tris = new Float64Array(mesh.tris.length);
  for (let i = 0; i < tris.length; i += 3) {
    let x = g(mesh.tris, i) * g(scale, 0), y = g(mesh.tris, i + 1) * g(scale, 1), z = g(mesh.tris, i + 2) * g(scale, 2);
    [y, z] = [y * Math.cos(ax) - z * Math.sin(ax), y * Math.sin(ax) + z * Math.cos(ax)];
    [x, z] = [x * Math.cos(ay) + z * Math.sin(ay), -x * Math.sin(ay) + z * Math.cos(ay)];
    [x, y] = [x * Math.cos(az) - y * Math.sin(az), x * Math.sin(az) + y * Math.cos(az)];
    tris[i] = x + g(position, 0); tris[i + 1] = y + g(position, 1); tris[i + 2] = z + g(position, 2);
  }
  return { tris };
}

function layout(assembly: Assembly, parts: Map<string, Mesh>, state: AssemblyState): Map<string, Mesh> {
  const placed = new Map<string, Mesh>();
  for (const [id, mesh] of parts) {
    const pose = assembly.poses[id];
    if (!pose) continue;
    const offset = assemblyOffset(assembly, id, state);
    placed.set(id, place(mesh, pose.rotation ?? [0, 0, 0], pose.position.map((value, axis) => value + g(offset, axis)), assemblyScale(assembly, id, state)));
  }
  return placed;
}

interface Finding { check: string; volume: number; snap?: boolean }

function pairs(check: string, placed: Map<string, Mesh>): Finding[] {
  const entries = [...placed];
  return entries.flatMap(([a, meshA], index) => entries.slice(index + 1).map(([b, meshB]) => ({ check: `${check}: ${a} × ${b}`, volume: intersectionVolume(meshA, meshB, CELL) })));
}

interface Tolerances { parts: number; snaps: number }

async function checkModel(model: ModelDefinition & { assembly: Assembly }, parameters: ParameterValues, tolerances: Tolerances, overrides: Record<string, string>): Promise<boolean> {
  if (!isAssembly(model)) throw new Error(`${model.id} has an assembly but no parts.`);
  const issues = validateParameters(model, parameters);
  if (issues.length > 0) throw new Error(`Invalid parameters for ${model.id}: ${issues.map(issue => issue.message).join(' ')}`);
  // With the reference objects these parameters add (e.g. the magnets of a magnet snap).
  const assembly = resolveAssembly(model, model.assembly, parameters) ?? model.assembly;
  const parts = await renderAssemblyMeshes(model, assembly, parameters, overrides);
  const ids = [...model.parts.map(part => part.id), ...(assembly.references ?? []).map(reference => reference.id)];
  const unknown = [...Object.keys(assembly.poses), ...assembly.steps.flatMap(step => step.parts)].filter(id => !ids.includes(id));
  if (unknown.length > 0) throw new Error(`${model.id}: the assembly names parts that do not exist: ${unknown.join(', ')}`);

  const findings: Finding[] = [];
  const done = { arrange: 1, steps: assembly.steps.map(() => 1) };
  const exploded = { arrange: 1, steps: assembly.steps.map(() => 0) };
  findings.push(...pairs('assembled', layout(assembly, parts, done)));
  const explodedLayout = layout(assembly, parts, exploded);
  findings.push(...pairs('exploded', explodedLayout));
  const floor = Math.min(...[...explodedLayout.values()].map(mesh => bounds(mesh).min[2]));
  assembly.steps.forEach((step, index) => {
    const shared = (progress: number) => {
      const state = { arrange: 1, steps: assembly.steps.map((_, k) => k < index ? 1 : k === index ? progress : 0) };
      const placed = layout(assembly, parts, state);
      const moving = [...placed].filter(([id]) => step.parts.includes(id));
      const still = [...placed].filter(([id]) => !step.parts.includes(id));
      let volume = 0;
      for (const [, a] of moving) for (const [, b] of still) volume = Math.max(volume, intersectionVolume(a, b, CELL));
      return volume;
    };
    const travel = Math.hypot(...step.from);
    const closing = Math.min(CLOSING, travel);
    let worst = 0;
    for (let sample = 0; sample <= SAMPLES; sample++) {
      const left = travel * (1 - sample / SAMPLES);
      if (left > 1e-9 && left < closing - 1e-9) continue;
      worst = Math.max(worst, shared(sample / SAMPLES));
    }
    findings.push({ check: `step ${index + 1} “${step.title}” (worst sample)`, volume: worst });
    let snap = 0, at = 0;
    for (let left = closing; left > 1e-9; left -= CLOSING_STEP) {
      const volume = shared(1 - left / travel);
      if (volume > snap) { snap = volume; at = left; }
    }
    findings.push({ check: `step ${index + 1} last ${closing.toFixed(0)} mm (snaps engaging; worst ${snap > 0 ? `${at.toFixed(2)} mm before seated` : 'sample'})`, volume: snap, snap: true });
  });

  motionFrames(assembly).forEach((frames, index) => {
    let worst: Finding = { check: '', volume: 0 };
    frames.slice(1).forEach((poses, frame) => {
      const placed = new Map<string, Mesh>();
      for (const [id, mesh] of parts) {
        const pose = poses[id];
        if (pose) placed.set(id, place(mesh, pose.rotation ?? [0, 0, 0], pose.position, pose.scale));
      }
      for (const finding of pairs('', placed)) if (finding.volume > worst.volume) worst = { check: `${finding.check.slice(2)}, frame ${frame + 1} of ${frames.length - 1}`, volume: finding.volume };
    });
    findings.push({ check: `movement ${index + 1} “${assembly.motion?.[index]?.title ?? ''}” (worst frame: ${worst.check || 'none'})`, volume: worst.volume });
  });

  let ok = floor >= 0;
  console.log(`\n${model.id} ${JSON.stringify(parameters)}\nlowest point of the exploded layout: ${floor.toFixed(2)} mm ${floor >= 0 ? 'ok' : 'FAIL (below the print bed)'}`);
  for (const finding of findings) {
    const pass = finding.volume <= (finding.snap ? tolerances.snaps : tolerances.parts);
    ok &&= pass;
    console.log(`${pass ? 'ok  ' : 'FAIL'} ${finding.volume.toFixed(2).padStart(8)} mm³  ${finding.check}`);
  }
  return ok;
}

const { values, positionals } = parseArgs({ allowPositionals: true, options: { parameters: { type: 'string' }, tolerance: { type: 'string', default: '1' }, 'snap-tolerance': { type: 'string', default: '10' }, defines: { type: 'string' } } });
// Local diagnostic overrides, never used by the worker/API. E.g. --defines '{"RIBS":false}'
// proves that only the duck's intentional crush ribs interfere; all core surfaces must clear.
const raw: unknown = values.defines ? JSON.parse(values.defines) : {};
if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('--defines must be a JSON object of literal values.');
const overrides = Object.fromEntries(Object.entries(raw).map(([key, value]) => {
  if (!/^[A-Z_]+$/.test(key) || !['number', 'string', 'boolean'].includes(typeof value) || (typeof value === 'number' && !Number.isFinite(value)))
    throw new Error('--defines accepts uppercase names and finite literal values only.');
  return [key, JSON.stringify(value)];
}));
if (values.defines) console.log(`Diagnostic SCAD overrides: ${JSON.stringify(overrides)}`);
const selected = models.filter((model): model is ModelDefinition & { assembly: Assembly } => model.assembly !== undefined && (positionals.length === 0 || positionals.includes(model.id)));
if (selected.length === 0) throw new Error('No model with an assembly matches.');
let passed = true;
for (const model of selected) {
  const parameters = { ...model.defaults, ...(values.parameters ? JSON.parse(values.parameters) as ParameterValues : {}) };
  passed = await checkModel(model, parameters, { parts: Number(values.tolerance), snaps: Number(values['snap-tolerance']) }, overrides) && passed;
}
process.exitCode = passed ? 0 : 1;
