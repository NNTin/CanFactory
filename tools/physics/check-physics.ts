/**
 * Runs the physics scenarios of every model with a mechanism (`ModelDefinition.physics`), or of the named ones: renders the parts
 * as the worker does, decomposes them into convex pieces, simulates each scenario with packages/physics, and checks its outcome.
 * Exits 1 if any check fails. docs/physics-plan.md.
 *
 *   npm run check:physics -- [model-id ...] [--parameters '<json>'] [--decomposer vhacd|coacd] [--fit]
 *
 * --fit also reports how well each decomposed part's pieces fit it. Decompositions are cached in node_modules/.cache by the mesh's
 * hash and the settings. Needs an OpenSCAD runtime (see tools/stl-to-scad/openscad.ts).
 */
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { isAssembly, models, resolveAssembly, validateParameters, type ModelDefinition, type ParameterValues } from '../../packages/contracts/src/index.ts';
import { decompose, hullTriangles, loadEngine, pieceFit, runScenario, type BodyGeometry, type ConvexPiece, type DecomposeSettings } from '../../packages/physics/src/index.ts';
import { renderAssemblyMeshes } from '../assembly-meshes.ts';

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: { parameters: { type: 'string' }, decomposer: { type: 'string', default: 'vhacd' }, fit: { type: 'boolean', default: false } },
});
const decomposer = values.decomposer === 'coacd' ? 'coacd' : 'vhacd';
const SETTINGS: DecomposeSettings = { decomposer };
const CACHE = 'node_modules/.cache/canfactory-physics';

async function piecesOf(triangles: Float64Array): Promise<ConvexPiece[]> {
  const key = createHash('sha256').update(new Uint8Array(triangles.buffer, triangles.byteOffset, triangles.byteLength)).update(JSON.stringify(SETTINGS)).digest('hex');
  const file = join(CACHE, `${key}.json`);
  try {
    return JSON.parse(await readFile(file, 'utf8')) as ConvexPiece[];
  } catch {
    const pieces = await decompose(triangles, SETTINGS);
    await mkdir(CACHE, { recursive: true });
    await writeFile(file, JSON.stringify(pieces));
    return pieces;
  }
}

async function checkModel(model: ModelDefinition, parameters: ParameterValues): Promise<boolean> {
  const physics = model.physics;
  if (!physics || !model.assembly || !isAssembly(model)) throw new Error(`${model.id} has no mechanism.`);
  const issues = validateParameters(model, parameters);
  if (issues.length > 0) throw new Error(`Invalid parameters for ${model.id}: ${issues.map(issue => issue.message).join(' ')}`);
  const assembly = resolveAssembly(model, model.assembly, parameters) ?? model.assembly;
  const spec = physics(parameters);
  const meshes = await renderAssemblyMeshes(model, assembly, parameters);
  const geometry: Record<string, BodyGeometry> = {};
  for (const body of spec.bodies) {
    const mesh = meshes.get(body.id);
    if (!mesh) throw new Error(`${model.id}: physics body ${body.id} is neither a part nor a reference object.`);
    const collision = body.collision ?? { kind: 'decompose' };
    if (collision.kind === 'pieces' && collision.pieces) {
      geometry[body.id] = { triangles: mesh.tris };
      if (values.fit) {
        const fit = pieceFit(mesh.tris, collision.pieces.map(vertices => ({ vertices, triangles: hullTriangles(vertices) })));
        console.log(`${body.id}: ${collision.pieces.length} given pieces; deepest intrusion ${fit.intrusion.toFixed(3)} mm (99 %: ${fit.intrusion99.toFixed(3)}), widest gap ${fit.gap.toFixed(3)} mm`);
      }
      continue;
    }
    if (collision.kind !== 'decompose') { geometry[body.id] = { triangles: mesh.tris }; continue; }
    const start = performance.now();
    const pieces = await piecesOf(mesh.tris);
    const vertices = pieces.map(piece => piece.vertices);
    geometry[body.id] = { triangles: mesh.tris, pieces: vertices };
    let line = `decomposed ${body.id}: ${pieces.length} pieces (${decomposer}, ${((performance.now() - start) / 1000).toFixed(1)} s)`;
    if (values.fit) {
      const fit = pieceFit(mesh.tris, pieces);
      line += `; deepest intrusion ${fit.intrusion.toFixed(3)} mm (99 %: ${fit.intrusion99.toFixed(3)}), widest gap ${fit.gap.toFixed(3)} mm`;
    }
    console.log(line);
  }
  const engine = await loadEngine();
  let pass = true;
  for (const scenario of spec.scenarios ?? []) {
    const start = performance.now();
    const result = runScenario(engine, { spec, poses: assembly.poses, geometry }, scenario);
    console.log(`${result.pass ? 'PASS' : 'FAIL'} ${model.id} › ${scenario.title} (${((performance.now() - start) / 1000).toFixed(1)} s)`);
    for (const check of result.checks) console.log(`  ${check.pass ? 'ok  ' : 'FAIL'} ${check.description}`);
    pass &&= result.pass;
  }
  return pass;
}

const selected = positionals.length > 0 ? positionals.map(id => {
  const model = models.find(candidate => candidate.id === id);
  if (!model) throw new Error(`No model ${id}.`);
  return model;
}) : models.filter(model => model.physics);
let pass = true;
for (const model of selected) {
  const parameters: ParameterValues = { ...model.defaults, ...(values.parameters ? JSON.parse(values.parameters) as ParameterValues : {}) };
  pass = await checkModel(model, parameters) && pass;
}
process.exit(pass ? 0 : 1);
