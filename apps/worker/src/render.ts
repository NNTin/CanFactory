import { execFile } from 'node:child_process';
import { copyFile, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { zipSync } from 'fflate';
import { activeParts, findModel, FONTS_DIR, isAssembly, scadDefines, validateParameters, type ApiError, type ModelDefinition, type ModelPart, type ParameterValues } from '@canfactory/contracts';
import {
  asyncStorage, combineParts, firstDegenerateTriangle, inspectStl, repairFloat32Slivers, RENDER_TIMEOUT_MS, RENDERER_FINGERPRINT, sourceFingerprint,
  type AssemblyPart, type MeshInfo, type RenderJob, type Storage, type Store,
} from '@canfactory/server';

/** Why a render failed. The retryable ones may pass on another attempt or with other settings; the rest are defects in a model or
 * the renderer that the same request will hit again, and must reach an operator. */
export type RenderFailureCode = 'RENDER_TIMEOUT' | 'OPENSCAD_FAILED' | 'GEOMETRY_INVALID' | 'MODEL_CHANGED' | 'SETTINGS_INVALID' | 'RENDERER_INTERNAL';

/** A classified render failure: `message` is for the person who asked for the render, `detail` for whoever fixes it (no paths). */
export class RenderFailure extends Error {
  constructor(public readonly code: RenderFailureCode, message: string, public readonly detail: string, public readonly retryable: boolean, options?: ErrorOptions) {
    super(message, options);
    this.name = 'RenderFailure';
  }
  envelope(reference: string): ApiError { return { code: this.code, message: this.message, issues: [], detail: this.detail, reference, retryable: this.retryable }; }
}

const DEFECT = 'This combination of settings hits a defect in the model, not a mistake in your settings. It has been logged; please pick slightly different values meanwhile.';

/** Any error thrown while rendering, as a RenderFailure. An unclassified one is a renderer bug. */
export function classifyRenderError(error: unknown): RenderFailure {
  if (error instanceof RenderFailure) return error;
  const detail = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  return new RenderFailure('RENDERER_INTERNAL', 'The renderer failed unexpectedly. It has been logged; please try again.', detail, true, { cause: error });
}

/** Paths on the worker say nothing to a reader and are not theirs to see. */
function withoutPaths(text: string, ...roots: string[]): string {
  return roots.reduce((result, root) => root ? result.split(root).join('…') : result, text);
}

/** The test harness may supply an equivalent Docker invocation; production executes OpenSCAD directly. `fontPath` is the folder of
 * bundled fonts (models/fonts): text must not depend on whatever fonts the host has. */
export type OpenScadRunner = (args: string[], signal: AbortSignal, fontPath: string) => Promise<void>;

export const runOpenScad: OpenScadRunner = (args, signal, fontPath) => new Promise((resolveRun, reject) => {
  execFile('openscad', args, { signal, timeout: RENDER_TIMEOUT_MS, killSignal: 'SIGKILL', maxBuffer: 1_048_576, env: { ...process.env, OPENSCAD_FONT_PATH: fontPath } }, (error, _stdout, stderr) => {
    if (error) {
      if (error.killed) reject(new RenderFailure('RENDER_TIMEOUT', 'Rendering exceeded the 120-second limit. Reduce size or slot density and try again.', `OpenSCAD was stopped after ${RENDER_TIMEOUT_MS} ms.`, true, { cause: error }));
      else reject(new RenderFailure('OPENSCAD_FAILED', DEFECT, `OpenSCAD exited with ${error.code ?? error.signal ?? 'an error'}: ${withoutPaths(stderr.slice(-1500), process.cwd(), fontPath)}`, false, { cause: error }));
    } else resolveRun();
  });
});

/** Blanks the free-form 80-byte STL header and stamps attribution, matching the production worker's convention. */
function stampAttribution(bytes: Buffer, model: ModelDefinition): void {
  bytes.fill(0, 0, 80);
  Buffer.from(`CanFactory | ${model.license} | ${model.attribution}`, 'utf8').copy(bytes, 0, 0, 80);
}

/** `-D NAME=value` overrides for one SCAD file (`scadDefines`): the parameters its scadMapping consumes and the dimensions of the
 * chosen parts its partDefines names; only mapped, validated values reach the command. */
function mappedDefines(model: ModelDefinition, source: Pick<ModelPart, 'scadMapping' | 'partDefines' | 'scadConstants'>, parameters: ParameterValues): string[] {
  return scadDefines(model, source, parameters).flatMap(([name, literal]) => ['-D', `${name}=${literal}`]);
}

/** Render one self-contained SCAD file to a binary STL. An assembly part receives only the overrides its own mapping
 * names: its other constants (e.g. `ROUNDNESS`) must apply exactly as verified, not the fruit-fly-trap-specific defaults. */
async function renderPart(run: OpenScadRunner, signal: AbortSignal, projectRoot: string, model: ModelDefinition, part: ModelPart, parameters: ParameterValues, output: string): Promise<void> {
  await run(['--backend', 'Manifold', '--export-format', 'binstl', '-o', output, ...mappedDefines(model, part, parameters), resolve(projectRoot, part.sourcePath)], signal, resolve(projectRoot, FONTS_DIR));
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
export async function renderJob(storage: Store | Storage, job: RenderJob, signal: AbortSignal, run: OpenScadRunner = runOpenScad, onRepair?: (repair: MeshRepair) => void): Promise<boolean> {
  const store = asyncStorage(storage);
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
      // parts that are the same generator call (source and overrides), such as the window cat guard's splice bars, render once
      const rendered = new Map<string, string>();
      for (const part of activeParts(model, job.parameters)) {
        const output = join(directory, `${part.id}.stl`);
        const call = JSON.stringify([part.sourcePath, scadDefines(model, part, job.parameters)]);
        const same = rendered.get(call);
        if (same) await copyFile(same, output);
        else { await renderPart(run, signal, store.projectRoot, model, part, job.parameters, output); rendered.set(call, output); }
        signal.throwIfAborted();
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
    const args = ['--backend', 'Manifold', '--export-format', 'binstl', '-o', output,
      '-D', 'ROUNDNESS=48', '-D', 'OBJECT="flytrap"', ...mappedDefines(model, model, job.parameters)];
    args.push(resolve(store.projectRoot, model.sourcePath));
    await run(args, signal, resolve(store.projectRoot, FONTS_DIR));
    signal.throwIfAborted();
    const { bytes, info } = await finishStl(output, model, { id: model.id, title: model.title }, repairs);
    await writeFile(output, bytes);
    report();
    return await store.complete(job.id, job.leaseToken, info, output, signal);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}
