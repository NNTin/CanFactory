/**
 * Spike 2 (docs/physics-plan.md): runs the convex decomposers on the test candidates' parts and reports, per part and decomposer,
 * how long it took, how many pieces it made, and how well they fit (packages/physics/src/pieceFit.ts): how deep the pieces reach
 * into free space, and how far the part's surface lies outside them.
 *
 *   npx tsx tools/physics/decomposers.ts [--only vhacd|coacd] [--parts lighter,case-box,...]
 *
 * Needs an OpenSCAD runtime (see tools/stl-to-scad/openscad.ts).
 */
import { readFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { findModel, isAssembly, resolveAssembly, type ParameterValues } from '../../packages/contracts/src/index.ts';
import { decompose, type DecomposeSettings } from '../../packages/physics/src/decompose.ts';
import { pieceFit } from '../../packages/physics/src/pieceFit.ts';
import { renderAssemblyMeshes } from '../assembly-meshes.ts';
import { parseStl, type Mesh } from '../stl-to-scad/stl.ts';

const { values } = parseArgs({ options: { only: { type: 'string' }, parts: { type: 'string' } } });

const SETTINGS: { name: string; settings: DecomposeSettings }[] = [
  { name: 'V-HACD (defaults)', settings: { decomposer: 'vhacd' } },
  { name: 'V-HACD (2M voxels, 128 hulls)', settings: { decomposer: 'vhacd', resolution: 2_000_000, maxHulls: 128 } },
  { name: 'CoACD (defaults)', settings: { decomposer: 'coacd' } },
];

async function modelMeshes(id: string, parts: string[]): Promise<[string, Mesh][]> {
  const model = findModel(id);
  if (!model?.assembly || !isAssembly(model)) throw new Error(`${id} is not an assembly.`);
  const parameters: ParameterValues = { ...model.defaults };
  const assembly = resolveAssembly(model, model.assembly, parameters) ?? model.assembly;
  const meshes = await renderAssemblyMeshes(model, assembly, parameters);
  return parts.map(part => {
    const mesh = meshes.get(part);
    if (!mesh) throw new Error(`${id} has no part ${part}.`);
    return [`${id}/${part}`, mesh];
  });
}

const wanted = values.parts?.split(',');
const candidates: [string, Mesh][] = [
  ['bic-j25-mini-lighter', parseStl(await readFile('parts/everyday-objects/bic-j25-mini-lighter.stl'))],
  ...await modelMeshes('cigarette-case', ['case-box', 'mini-holder']),
  ...await modelMeshes('spring-ball-detent', ['body']),
  ...await modelMeshes('toggle-latch', ['base', 'lever', 'link', 'catch']),
];
const rows: string[] = ['| Part | Triangles | Decomposer | Time | Pieces | Deepest intrusion | 99 % intrusion | Widest gap | 99 % gap |', '| --- | --- | --- | --- | --- | --- | --- | --- | --- |'];
for (const [name, mesh] of candidates) {
  if (wanted && !wanted.some(part => name.endsWith(part))) continue;
  for (const { name: setting, settings } of SETTINGS) {
    if (values.only && settings.decomposer !== values.only) continue;
    const start = performance.now();
    let pieces;
    try {
      pieces = await decompose(mesh.tris, settings);
    } catch (error) {
      // CoACD throws an uncaught C++ exception on some meshes (the honeycomb case box): record it and go on
      const row = `| ${name} | ${mesh.tris.length / 9} | ${setting} | failed: ${error instanceof Error ? error.message : String(error)} | | | | | |`;
      rows.push(row);
      console.log(row);
      continue;
    }
    const seconds = (performance.now() - start) / 1000;
    const fit = pieceFit(mesh.tris, pieces);
    const row = `| ${name} | ${mesh.tris.length / 9} | ${setting} | ${seconds.toFixed(1)} s | ${pieces.length} | ${fit.intrusion.toFixed(3)} mm | ${fit.intrusion99.toFixed(3)} mm | ${fit.gap.toFixed(3)} mm | ${fit.gap99.toFixed(3)} mm |`;
    rows.push(row);
    console.log(row);
  }
}
console.log(`\n${rows.join('\n')}`);
