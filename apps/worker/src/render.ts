import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { zipSync } from 'fflate';
import { activeParts, findModel, FONTS_DIR, isAssembly, validateParameters, type ModelDefinition, type ModelPart, type ParameterValues } from '@canfactory/contracts';
import {
  asyncStorage, combineParts, firstDegenerateTriangle, inspectStl, RENDER_TIMEOUT_MS, RENDERER_FINGERPRINT, sourceFingerprint,
  type AssemblyPart, type RenderJob, type Storage, type Store,
} from '@canfactory/server';

/** The test harness may supply an equivalent Docker invocation; production executes OpenSCAD directly. `fontPath` is the folder of
 * bundled fonts (models/fonts): text must not depend on whatever fonts the host has. */
export type OpenScadRunner = (args: string[], signal: AbortSignal, fontPath: string) => Promise<void>;

export const runOpenScad: OpenScadRunner = (args, signal, fontPath) => new Promise((resolveRun, reject) => {
  execFile('openscad', args, { signal, timeout: RENDER_TIMEOUT_MS, killSignal: 'SIGKILL', maxBuffer: 1_048_576, env: { ...process.env, OPENSCAD_FONT_PATH: fontPath } }, (error, _stdout, stderr) => {
    if (error) {
      if (error.killed) reject(new Error('Rendering exceeded the 120-second limit. Reduce size or slot density and try again.'));
      else reject(new Error(`OpenSCAD could not generate this configuration. ${stderr.slice(-1000)}`));
    } else resolveRun();
  });
});

/** Blanks the free-form 80-byte STL header and stamps attribution, matching the production worker's convention. */
function stampAttribution(bytes: Buffer, model: ModelDefinition): void {
  bytes.fill(0, 0, 80);
  Buffer.from(`CanFactory | ${model.license} | ${model.attribution}`, 'utf8').copy(bytes, 0, 0, 80);
}

/** `-D NAME=value` overrides for the parameters a scadMapping consumes; only mapped, validated values reach the command. */
function mappedDefines(mapping: Record<string, string> | undefined, parameters: ParameterValues): string[] {
  const args: string[] = [];
  for (const [key, scadName] of Object.entries(mapping ?? {})) {
    const value = parameters[key];
    if (value === undefined || !/^[A-Z_]+$/.test(scadName)) throw new Error('Invalid generator parameter mapping.');
    args.push('-D', `${scadName}=${JSON.stringify(value)}`);
  }
  return args;
}

/** Render one self-contained SCAD file to a binary STL. An assembly part receives only the overrides its own mapping
 * names: its other constants (e.g. `ROUNDNESS`) must apply exactly as verified, not the fruit-fly-trap-specific defaults. */
async function renderPart(run: OpenScadRunner, signal: AbortSignal, projectRoot: string, part: ModelPart, parameters: ParameterValues, output: string): Promise<void> {
  await run(['--backend', 'Manifold', '--export-format', 'binstl', '-o', output, ...mappedDefines(part.scadMapping, parameters), resolve(projectRoot, part.sourcePath)], signal, resolve(projectRoot, FONTS_DIR));
}

/** Revalidate trusted model/version and queued parameters before invoking the geometry engine. */
export async function renderJob(storage: Store | Storage, job: RenderJob, signal: AbortSignal, run: OpenScadRunner = runOpenScad): Promise<boolean> {
  const store = asyncStorage(storage);
  const model = findModel(job.modelId);
  if (!model || model.version !== job.modelVersion || sourceFingerprint(store.projectRoot, model) !== job.sourceHash || job.rendererFingerprint !== RENDERER_FINGERPRINT)
    throw new Error('The model or renderer changed. Refresh the catalogue and generate again.');
  if (validateParameters(model, job.parameters).length) throw new Error('The queued settings are no longer valid. Adjust them and generate again.');
  if (!job.leaseToken) throw new Error('A render must be claimed before execution.');
  const directory = await mkdtemp(join(store.temporaryDir, `${job.id}-`));
  try {
    if (isAssembly(model)) {
      const entries: Record<string, Uint8Array> = {};
      const parts: AssemblyPart[] = [];
      for (const part of activeParts(model, job.parameters)) {
        const output = join(directory, `${part.id}.stl`);
        await renderPart(run, signal, store.projectRoot, part, job.parameters, output);
        signal.throwIfAborted();
        const bytes = await readFile(output);
        if (bytes.length < 84) throw new Error(`OpenSCAD produced an incomplete STL for "${part.title}".`);
        stampAttribution(bytes, model);
        let info;
        try { info = inspectStl(bytes, { allowDisconnected: part.separateBodies === true }); }
        catch (error) {
          const culprit = firstDegenerateTriangle(bytes);
          const detail = culprit ? ` triangle #${culprit.index}: a=${JSON.stringify(culprit.a)} b=${JSON.stringify(culprit.b)} c=${JSON.stringify(culprit.c)}` : '';
          throw new Error(`"${part.title}" (${part.id}): ${error instanceof Error ? error.message : String(error)}${detail}`, { cause: error });
        }
        entries[`${part.id}.stl`] = bytes;
        parts.push({ id: part.id, title: part.title, bytes: info.bytes, triangles: info.triangles, dimensions: info.dimensions, volume: info.volume });
      }
      const zipBytes = Buffer.from(zipSync(entries, { level: 6 }));
      const output = join(directory, 'model.zip');
      await writeFile(output, zipBytes);
      return await store.complete(job.id, job.leaseToken, combineParts(zipBytes, parts), output, signal, 'zip');
    }
    if (!model.sourcePath) throw new Error('This model declares neither a generator source nor parts.');
    const output = join(directory, 'model.stl');
    const args = ['--backend', 'Manifold', '--export-format', 'binstl', '-o', output,
      '-D', 'ROUNDNESS=48', '-D', 'OBJECT="flytrap"', ...mappedDefines(model.scadMapping, job.parameters)];
    args.push(resolve(store.projectRoot, model.sourcePath));
    await run(args, signal, resolve(store.projectRoot, FONTS_DIR));
    signal.throwIfAborted();
    const bytes = await readFile(output);
    if (bytes.length < 84) throw new Error('The renderer produced an incomplete STL.');
    stampAttribution(bytes, model);
    const metadata = inspectStl(bytes);
    await writeFile(output, bytes);
    return await store.complete(job.id, job.leaseToken, metadata, output, signal);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}
