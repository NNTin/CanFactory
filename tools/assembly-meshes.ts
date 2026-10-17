/**
 * Renders a model's parts and its assembly's reference objects as the worker and the preview do, for the tools that check an
 * assembly (check-assembly.ts, physics/check-physics.ts). Needs an OpenSCAD runtime (selectRunner in @canfactory/server) for the
 * model's parts; the parts library's procedural parts come from @canfactory/part-geometry, as in the browser.
 */
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { findPart, partAssetPath, type Assembly, type ParameterValues, type Part } from '@canfactory/contracts';
import { partGeometry } from '@canfactory/part-geometry';
import { fontsPath, openScadArgs, renderActiveParts, repositoryRoot, selectRunner, type Defines } from '@canfactory/server';
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

const seconds = (started: number) => `${((Date.now() - started) / 1000).toFixed(1)} s`;

/** Every active part and reference object of the model for these parameters, by its key in the assembly's poses. */
export async function renderAssemblyMeshes(model: Parameters<typeof renderActiveParts>[3], assembly: Assembly, parameters: ParameterValues, overrides: Defines = {}): Promise<Map<string, Mesh>> {
  const parts = new Map<string, Mesh>();
  const directory = await mkdtemp(join(tmpdir(), 'canfactory-assembly-'));
  try {
    const { run, kind } = await selectRunner(directory);
    const signal = new AbortController().signal;
    let started = Date.now();
    for await (const { part, output } of renderActiveParts(run, signal, repositoryRoot, model, parameters, directory, overrides)) {
      parts.set(part.id, parseStl(await readFile(output)));
      console.log(`rendered ${part.id} (${kind}, ${seconds(started)})`);
      started = Date.now();
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
      const output = join(directory, `reference-${reference.id}.stl`);
      started = Date.now();
      await run(openScadArgs(output, [], resolve(repositoryRoot, scad)), signal, fontsPath);
      const mesh = parseStl(await readFile(output));
      const committed = parseStl(await readFile(resolve(repositoryRoot, stl)));
      const [fresh, stored] = [bounds(mesh), bounds(committed)];
      if ([...fresh.min, ...fresh.max].some((value, index) => Math.abs(value - g([...stored.min, ...stored.max], index)) > 0.01))
        throw new Error(`${stl} is out of date: render ${scad} again.`);
      parts.set(reference.id, mesh);
      console.log(`rendered reference ${reference.id} (${kind}, ${seconds(started)})`);
    }
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
  return parts;
}
