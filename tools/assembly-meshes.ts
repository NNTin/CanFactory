/**
 * Renders a model's parts and its assembly's reference objects as the worker and the preview do, for the tools that check an
 * assembly (check-assembly.ts, physics/check-physics.ts). Needs an OpenSCAD runtime (see stl-to-scad/openscad.ts) for the
 * model's parts; the parts library's procedural parts come from @canfactory/part-geometry, as in the browser.
 */
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { partGeometry } from '@canfactory/part-geometry';
import { activeParts, findPart, partAssetPath, scadDefines, type Assembly, type ParameterValues, type Part } from '../packages/contracts/src/index.ts';
import { renderScad } from './stl-to-scad/openscad.ts';
import { bounds, g, parseStl, type Mesh } from './stl-to-scad/stl.ts';

/** A part's geometry from the parts library's builders (@canfactory/part-geometry) as an STL's triangles. */
function procedural(part: Part): Mesh | undefined {
  const geometry = partGeometry(part);
  if (!geometry) return undefined;
  const position = geometry.getAttribute('position');
  const tris = new Float64Array(position.count * 3);
  for (let i = 0; i < position.count; i++) tris.set([position.getX(i), position.getY(i), position.getZ(i)], i * 3);
  geometry.dispose();
  return { tris };
}

/** Every active part and reference object of the model for these parameters, by its key in the assembly's poses. */
export async function renderAssemblyMeshes(model: Parameters<typeof activeParts>[0], assembly: Assembly, parameters: ParameterValues, overrides: Record<string, string> = {}): Promise<Map<string, Mesh>> {
  const parts = new Map<string, Mesh>();
  for (const part of activeParts(model, parameters)) {
    // As apps/worker/src/render.ts: each part gets only its own mapped parameters and chosen parts' dimensions.
    const defines = { ...Object.fromEntries(scadDefines(model, part, parameters)), ...overrides };
    const render = await renderScad(resolve(part.sourcePath), defines);
    parts.set(part.id, parseStl(render.stl));
    console.log(`rendered ${part.id} (${render.runner}, ${(render.milliseconds / 1000).toFixed(1)} s)`);
  }
  // Reference objects are checked like parts, as the editor shows them: a procedural part (a magnet, a screw, ...) built from its
  // dimensions, or one with an STL preview (e.g. a lighter in its bay) rendered from its SCAD source, which its STL must match.
  for (const reference of assembly.references ?? []) {
    const part = findPart(reference.part);
    if (!part) throw new Error(`${model.id}: reference ${reference.id} is not in the parts library.`);
    const built = procedural(part);
    if (built) {
      parts.set(reference.id, built);
      console.log(`built reference ${reference.id} (${part.id})`);
      continue;
    }
    const [scad, stl] = [partAssetPath(part, 'scad'), partAssetPath(part, 'stl')];
    if (!scad || !stl) throw new Error(`${model.id}: reference ${reference.id} has neither an STL preview nor a procedural one.`);
    const render = await renderScad(resolve(scad), {});
    const mesh = parseStl(render.stl);
    const committed = parseStl(await readFile(resolve(stl)));
    const [fresh, stored] = [bounds(mesh), bounds(committed)];
    if ([...fresh.min, ...fresh.max].some((value, index) => Math.abs(value - g([...stored.min, ...stored.max], index)) > 0.01))
      throw new Error(`${stl} is out of date: render ${scad} again.`);
    parts.set(reference.id, mesh);
    console.log(`rendered reference ${reference.id} (${render.runner}, ${(render.milliseconds / 1000).toFixed(1)} s)`);
  }
  return parts;
}
