import { copyFile, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { zipSync } from 'fflate';
import { activeParts, findModel, FONTS_DIR, isAssembly, scadDefines, validateParameters, type ModelDefinition, type ModelPart, type ParameterValues } from '@canfactory/contracts';
import { RENDERER_FINGERPRINT } from './config.ts';
import { DEFECT, RenderFailure } from './errors.ts';
import { combineParts, firstDegenerateTriangle, inspectStl, repairFloat32Slivers, type AssemblyPart, type MeshInfo } from './mesh.ts';
import { openScadArgs, runOpenScad, type Defines, type OpenScadRunner } from './openscad.ts';
import { sourceFingerprint, type PostgresStorage, type RenderJob } from './postgres.ts';

/** Blanks the free-form 80-byte STL header and stamps attribution, matching the production worker's convention. */
function stampAttribution(bytes: Buffer, model: ModelDefinition): void {
  bytes.fill(0, 0, 80);
  Buffer.from(`CanFactory | ${model.license} | ${model.attribution}`, 'utf8').copy(bytes, 0, 0, 80);
}

/** The `-D` overrides for one SCAD file (`scadDefines`): the parameters its scadMapping consumes and the dimensions of the chosen
 * parts its partDefines names; only mapped, validated values reach the command. `overrides` (diagnostics, never the worker)
 * replace or add to them. */
function mappedDefines(model: ModelDefinition, source: Pick<ModelPart, 'scadMapping' | 'partDefines' | 'scadConstants'>, parameters: ParameterValues, overrides: Defines = {}): [string, string][] {
  return [...scadDefines(model, source, parameters).filter(([name]) => !Object.hasOwn(overrides, name)), ...Object.entries(overrides)];
}

/**
 * Render each active part of an assembly model to a binary STL in `directory`, yielding each as soon as it is written. An assembly
 * part receives only the overrides its own mapping names: its other constants (e.g. `ROUNDNESS`) must apply exactly as verified,
 * not the fruit-fly-trap-specific defaults. Parts that are the same generator call (source and overrides), such as the window cat
 * guard's splice bars, render once.
 */
export async function* renderActiveParts(run: OpenScadRunner, signal: AbortSignal, projectRoot: string, model: Parameters<typeof activeParts>[0], parameters: ParameterValues, directory: string, overrides: Defines = {}): AsyncGenerator<{ part: ModelPart; output: string }> {
  const rendered = new Map<string, string>();
  for (const part of activeParts(model, parameters)) {
    const output = join(directory, `${part.id}.stl`);
    const defines = mappedDefines(model, part, parameters, overrides);
    const call = JSON.stringify([part.sourcePath, defines]);
    const same = rendered.get(call);
    if (same) await copyFile(same, output);
    else { await run(openScadArgs(output, defines, resolve(projectRoot, part.sourcePath)), signal, resolve(projectRoot, FONTS_DIR)); rendered.set(call, output); }
    signal.throwIfAborted();
    yield { part, output };
  }
}

/** Float32 slivers repaired (`repairFloat32Slivers`) in one rendered file: valid output, but a sign of fragile geometry. */
export interface MeshRepair { part: string; repaired: number }

/** Read a rendered STL, repair float32 slivers, stamp attribution and validate it. Every failure is a GEOMETRY_INVALID defect
 * naming the part and, for a zero-area triangle, where it is. */
async function finishStl(output: string, model: ModelDefinition, part: { id: string; title: string; separateBodies?: boolean; sealedVoids?: boolean }, repairs: MeshRepair[]): Promise<{ bytes: Buffer; info: MeshInfo }> {
  const raw = await readFile(output);
  const where = `"${part.title}" (${part.id})`;
  if (raw.length < 84) throw new RenderFailure('GEOMETRY_INVALID', DEFECT, `${where}: OpenSCAD produced an incomplete STL (${raw.length} bytes).`, false);
  let bytes: Buffer = raw;
  try {
    const repaired = repairFloat32Slivers(raw);
    bytes = repaired.bytes;
    stampAttribution(bytes, model);
    const info = inspectStl(bytes, { allowDisconnected: part.separateBodies === true, allowVoids: part.sealedVoids === true });
    if (!repaired.repaired) return { bytes, info };
    repairs.push({ part: part.id, repaired: repaired.repaired });
    return { bytes, info: { ...info, meshRepairs: repaired.repaired } };
  } catch (error) {
    const culprit = firstDegenerateTriangle(bytes);
    const at = culprit ? ` Triangle #${culprit.index}: a=${JSON.stringify(culprit.a)} b=${JSON.stringify(culprit.b)} c=${JSON.stringify(culprit.c)}.` : '';
    throw new RenderFailure('GEOMETRY_INVALID', DEFECT, `${where}: ${error instanceof Error ? error.message : String(error)}${at}`, false, { cause: error });
  }
}

/** Revalidate trusted model/version and queued parameters before invoking the geometry engine. `onRepair` hears of every
 * repaired part (the worker logs and counts them; the renderer tests insist there are none). */
export async function renderJob(store: PostgresStorage, job: RenderJob, signal: AbortSignal, run: OpenScadRunner = runOpenScad, onRepair?: (repair: MeshRepair) => void): Promise<boolean> {
  const model = findModel(job.modelId);
  if (!model || model.version !== job.modelVersion || sourceFingerprint(store.projectRoot, model) !== job.sourceHash || job.rendererFingerprint !== RENDERER_FINGERPRINT)
    throw new RenderFailure('MODEL_CHANGED', 'The model or renderer changed. Refresh the catalogue and generate again.', `Queued for ${job.modelId}@${job.modelVersion}; the worker has ${model ? `${model.id}@${model.version}` : 'no such model'}.`, false);
  const invalid = validateParameters(model, job.parameters);
  if (invalid.length) throw new RenderFailure('SETTINGS_INVALID', 'The queued settings are no longer valid. Adjust them and generate again.', invalid.map(issue => `${issue.field}: ${issue.message}`).join(' '), false);
  if (!job.leaseToken) throw new RenderFailure('RENDERER_INTERNAL', 'The renderer failed unexpectedly. It has been logged; please try again.', 'A render must be claimed before execution.', true);
  const repairs: MeshRepair[] = [];
  const report = () => { for (const repair of repairs) onRepair?.(repair); };
  const directory = await mkdtemp(join(store.temporaryDir, `${job.id}-`));
  try {
    if (isAssembly(model)) {
      const entries: Record<string, Uint8Array> = {};
      const parts: AssemblyPart[] = [];
      for await (const { part, output } of renderActiveParts(run, signal, store.projectRoot, model, job.parameters, directory)) {
        const { bytes, info } = await finishStl(output, model, part, repairs);
        entries[`${part.id}.stl`] = bytes;
        parts.push({ id: part.id, title: part.title, bytes: info.bytes, triangles: info.triangles, dimensions: info.dimensions, volume: info.volume, ...info.meshRepairs ? { meshRepairs: info.meshRepairs } : {} });
      }
      const zipBytes = Buffer.from(zipSync(entries, { level: 6 }));
      const output = join(directory, 'model.zip');
      await writeFile(output, zipBytes);
      report();
      return await store.complete(job.id, job.leaseToken, combineParts(zipBytes, parts), output, signal, 'zip');
    }
    if (!model.sourcePath) throw new RenderFailure('RENDERER_INTERNAL', DEFECT, `${model.id} declares neither a generator source nor parts.`, false);
    const output = join(directory, 'model.stl');
    await run(openScadArgs(output, [['ROUNDNESS', '48'], ['OBJECT', '"flytrap"'], ...mappedDefines(model, model, job.parameters)], resolve(store.projectRoot, model.sourcePath)), signal, resolve(store.projectRoot, FONTS_DIR));
    signal.throwIfAborted();
    const { bytes, info } = await finishStl(output, model, { id: model.id, title: model.title }, repairs);
    await writeFile(output, bytes);
    report();
    return await store.complete(job.id, job.leaseToken, info, output, signal);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}
