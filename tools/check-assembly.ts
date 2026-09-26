/**
 * Checks a model's assembly (ModelDefinition.assembly) against its rendered parts: renders every part (as the worker does,
 * with the model defaults or `--parameters '<json>'`), places them as the preview's assembly slider does, and measures the
 * volume shared by parts that must not collide:
 * - the finished assembly (every pair of parts);
 * - the exploded layout (every pair), which must also stay above the print bed;
 * - each step, sampled along its path (the moving parts against all the others).
 *
 *   npm run check:assembly -- [model-id] [--parameters '{"snap":"detent"}'] [--tolerance 1]
 *
 * Needs an OpenSCAD runtime (see tools/stl-to-scad/openscad.ts). Exits 1 if any check fails.
 */
import { parseArgs } from 'node:util';
import { resolve } from 'node:path';
import { activeParts, assemblyOffset, isAssembly, models, validateParameters, type Assembly, type AssemblyState, type ModelDefinition, type ParameterValues } from '../packages/contracts/src/index.ts';
import { intersectionVolume } from './stl-to-scad/compare.ts';
import { renderScad } from './stl-to-scad/openscad.ts';
import { bounds, g, parseStl, type Mesh } from './stl-to-scad/stl.ts';

const SAMPLES = 16;
const CELL = 0.25;

/** Rotates about X, then Y, then Z (degrees), then translates. */
function place(mesh: Mesh, rotation: readonly number[], position: readonly number[]): Mesh {
  const [ax, ay, az] = rotation.map(degrees => degrees * Math.PI / 180) as [number, number, number];
  const tris = new Float64Array(mesh.tris.length);
  for (let i = 0; i < tris.length; i += 3) {
    let x = g(mesh.tris, i), y = g(mesh.tris, i + 1), z = g(mesh.tris, i + 2);
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
    placed.set(id, place(mesh, pose.rotation ?? [0, 0, 0], pose.position.map((value, axis) => value + g(offset, axis))));
  }
  return placed;
}

interface Finding { check: string; volume: number }

function pairs(check: string, placed: Map<string, Mesh>): Finding[] {
  const entries = [...placed];
  return entries.flatMap(([a, meshA], index) => entries.slice(index + 1).map(([b, meshB]) => ({ check: `${check}: ${a} × ${b}`, volume: intersectionVolume(meshA, meshB, CELL) })));
}

async function checkModel(model: ModelDefinition & { assembly: Assembly }, parameters: ParameterValues, tolerance: number): Promise<boolean> {
  if (!isAssembly(model)) throw new Error(`${model.id} has an assembly but no parts.`);
  const issues = validateParameters(model, parameters);
  if (issues.length > 0) throw new Error(`Invalid parameters for ${model.id}: ${issues.map(issue => issue.message).join(' ')}`);
  const assembly = model.assembly;
  const parts = new Map<string, Mesh>();
  for (const part of activeParts(model, parameters)) {
    // As apps/worker/src/render.ts: each part gets only its own mapped parameters, as JSON literals.
    const defines = Object.fromEntries(Object.entries(part.scadMapping ?? {}).flatMap(([key, name]) => { const value = parameters[key]; return value === undefined ? [] : [[name, JSON.stringify(value)]]; }));
    const render = await renderScad(resolve(part.sourcePath), defines);
    parts.set(part.id, parseStl(render.stl));
    console.log(`rendered ${part.id} (${render.runner}, ${(render.milliseconds / 1000).toFixed(1)} s)`);
  }
  const unknown = [...Object.keys(assembly.poses), ...assembly.steps.flatMap(step => step.parts)].filter(id => !model.parts.some(part => part.id === id));
  if (unknown.length > 0) throw new Error(`${model.id}: the assembly names parts that do not exist: ${unknown.join(', ')}`);

  const findings: Finding[] = [];
  const done = { arrange: 1, steps: assembly.steps.map(() => 1) };
  const exploded = { arrange: 1, steps: assembly.steps.map(() => 0) };
  findings.push(...pairs('assembled', layout(assembly, parts, done)));
  const explodedLayout = layout(assembly, parts, exploded);
  findings.push(...pairs('exploded', explodedLayout));
  const floor = Math.min(...[...explodedLayout.values()].map(mesh => bounds(mesh).min[2]));
  assembly.steps.forEach((step, index) => {
    let worst = 0;
    for (let sample = 0; sample <= SAMPLES; sample++) {
      const state = { arrange: 1, steps: assembly.steps.map((_, k) => k < index ? 1 : k === index ? sample / SAMPLES : 0) };
      const placed = layout(assembly, parts, state);
      const moving = [...placed].filter(([id]) => step.parts.includes(id));
      const still = [...placed].filter(([id]) => !step.parts.includes(id));
      for (const [, a] of moving) for (const [, b] of still) worst = Math.max(worst, intersectionVolume(a, b, CELL));
    }
    findings.push({ check: `step ${index + 1} “${step.title}” (worst sample)`, volume: worst });
  });

  let ok = floor >= 0;
  console.log(`\n${model.id} ${JSON.stringify(parameters)}\nlowest point of the exploded layout: ${floor.toFixed(2)} mm ${floor >= 0 ? 'ok' : 'FAIL (below the print bed)'}`);
  for (const finding of findings) {
    const pass = finding.volume <= tolerance;
    ok &&= pass;
    console.log(`${pass ? 'ok  ' : 'FAIL'} ${finding.volume.toFixed(2).padStart(8)} mm³  ${finding.check}`);
  }
  return ok;
}

const { values, positionals } = parseArgs({ allowPositionals: true, options: { parameters: { type: 'string' }, tolerance: { type: 'string', default: '1' } } });
const selected = models.filter((model): model is ModelDefinition & { assembly: Assembly } => model.assembly !== undefined && (positionals.length === 0 || positionals.includes(model.id)));
if (selected.length === 0) throw new Error('No model with an assembly matches.');
let passed = true;
for (const model of selected) {
  const parameters = { ...model.defaults, ...(values.parameters ? JSON.parse(values.parameters) as ParameterValues : {}) };
  passed = await checkModel(model, parameters, Number(values.tolerance)) && passed;
}
process.exitCode = passed ? 0 : 1;
