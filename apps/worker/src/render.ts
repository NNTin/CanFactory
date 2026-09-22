import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { zipSync } from 'fflate';
import { findModel, isAssembly, validateParameters, type ModelDefinition } from '@canfactory/contracts';
import {
  asyncStorage, combineParts, inspectStl, RENDER_TIMEOUT_MS, RENDERER_FINGERPRINT, sourceFingerprint,
  type AssemblyPart, type RenderJob, type Storage, type Store,
} from '@canfactory/server';

/** The test harness may supply an equivalent Docker invocation; production executes OpenSCAD directly. */
export type OpenScadRunner = (args: string[], signal: AbortSignal) => Promise<void>;

export const runOpenScad: OpenScadRunner = (args, signal) => new Promise((resolveRun, reject) => {
  execFile('openscad', args, { signal, timeout: RENDER_TIMEOUT_MS, killSignal: 'SIGKILL', maxBuffer: 1_048_576 }, (error, _stdout, stderr) => {
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

/** Render one self-contained SCAD file to a binary STL. No `-D` overrides are passed for assembly parts: each part's
 * own constants (e.g. its `ROUNDNESS`) must apply exactly as verified, not the fruit-fly-trap-specific defaults. */
async function renderPart(run: OpenScadRunner, signal: AbortSignal, projectRoot: string, sourcePath: string, output: string): Promise<void> {
  await run(['--backend', 'Manifold', '--export-format', 'binstl', '-o', output, resolve(projectRoot, sourcePath)], signal);
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
      for (const part of model.parts) {
        const output = join(directory, `${part.id}.stl`);
        await renderPart(run, signal, store.projectRoot, part.sourcePath, output);
        signal.throwIfAborted();
        const bytes = await readFile(output);
        if (bytes.length < 84) throw new Error(`OpenSCAD produced an incomplete STL for "${part.title}".`);
        stampAttribution(bytes, model);
        const info = inspectStl(bytes);
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
      '-D', 'ROUNDNESS=48', '-D', 'OBJECT="flytrap"'];
    for (const [key, scadName] of Object.entries(model.scadMapping)) {
      const value = job.parameters[key];
      if (value === undefined || !/^[A-Z_]+$/.test(scadName)) throw new Error('Invalid generator parameter mapping.');
      args.push('-D', `${scadName}=${JSON.stringify(value)}`);
    }
    args.push(resolve(store.projectRoot, model.sourcePath));
    await run(args, signal);
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
