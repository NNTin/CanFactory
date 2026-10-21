import { createHash } from 'node:crypto';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, expect, it, vi } from 'vitest';
import { models, validateParameters, type ModelDefinition, type ParameterValues } from '@canfactory/contracts';
import { RENDERER_FINGERPRINT, repositoryRoot } from './config.ts';
import type { PostgresStorage, RenderJob } from './postgres.ts';
import { sourceFingerprint } from './postgres.ts';
import { renderJob } from './render.ts';

interface Invocation { file: string; args: string[]; timeout: number; killSignal: string; fontPath: string | undefined }
const invocations: Invocation[] = [];

/** The production runner's execFile, recorded: a unit tetrahedron is written to the requested -o path instead of rendering. */
vi.mock('node:child_process', async original => ({
  ...await original<typeof import('node:child_process')>(),
  execFile: (file: string, args: string[], options: { timeout: number; killSignal: string; env: Record<string, string | undefined> }, callback: (error: null, stdout: string, stderr: string) => void) => {
    invocations.push({ file, args, timeout: options.timeout, killSignal: options.killSignal, fontPath: options.env['OPENSCAD_FONT_PATH'] });
    const [a, b, c, d] = [[0, 0, 0], [10, 0, 0], [0, 10, 0], [0, 0, 10]];
    const triangles = [[a, c, b], [a, b, d], [a, d, c], [b, c, d]];
    const bytes = Buffer.alloc(84 + triangles.length * 50);
    bytes.writeUInt32LE(triangles.length, 80);
    triangles.forEach((triangle, index) => triangle.flat().forEach((value, coordinate) => bytes.writeFloatLE(value, 84 + index * 50 + 12 + coordinate * 4)));
    writeFileSync(args[args.indexOf('-o') + 1] ?? '', bytes);
    callback(null, '', '');
  },
}));

interface Property { type?: string; minimum?: number; maximum?: number; anyOf?: { const?: unknown }[]; enum?: unknown[] }
/** Each valid setting of one parameter at its minimum, its maximum or each of its options, the others at their defaults. */
function variants(model: ModelDefinition): [string, ParameterValues][] {
  const properties = (model.parameterSchema as { properties?: Record<string, Property> }).properties ?? {};
  return Object.entries(properties).flatMap(([key, property]) => {
    const options = property.enum ?? property.anyOf?.map(option => option.const).filter(value => value !== undefined);
    const values = options?.length ? options : property.type === 'boolean' ? [false, true] : property.minimum !== undefined && property.maximum !== undefined ? [property.minimum, property.maximum] : [];
    return values.filter(value => value !== model.defaults[key]).map((value): [string, ParameterValues] => [`${key}=${JSON.stringify(value)}`, { ...model.defaults, [key]: value as ParameterValues[string] }]);
  }).filter(([, parameters]) => !validateParameters(model, parameters).length);
}

const directory = mkdtempSync(join(tmpdir(), 'canfactory-invocations-'));
afterAll(() => rmSync(directory, { recursive: true, force: true }));
const store = { projectRoot: repositoryRoot, temporaryDir: directory, complete: () => Promise.resolve(true) } as unknown as PostgresStorage;

/** Every OpenSCAD call the worker makes for these settings, with the scratch directory and repository root made portable. */
async function invocationsFor(model: ModelDefinition, parameters: ParameterValues): Promise<Invocation[]> {
  invocations.length = 0;
  const job = { id: 'job', modelId: model.id, modelVersion: model.version, sourceHash: sourceFingerprint(repositoryRoot, model), rendererFingerprint: RENDERER_FINGERPRINT, parameters, leaseToken: 'lease' } as RenderJob;
  expect(await renderJob(store, job, new AbortController().signal)).toBe(true);
  return JSON.parse(JSON.stringify(invocations).split(directory).join('<scratch>').split(repositoryRoot).join('<root>').replace(/<scratch>\/job-[^/]+\//g, '<scratch>/job/')) as Invocation[];
}

/**
 * The production command lines, pinned: the command, argv, timeout, kill signal and font path of every OpenSCAD call the worker
 * makes for each model's defaults (in full) and each one-parameter boundary variant (as a sha256). RENDERER_FINGERPRINT and the
 * render cache assume these never change by accident; a model change that alters them on purpose updates the snapshot
 * (`npx vitest run packages/server/src/render-invocations.test.ts --update=all`).
 */
it('renders every model with the pinned OpenSCAD command lines', async () => {
  const snapshot: Record<string, unknown> = { rendererFingerprint: RENDERER_FINGERPRINT };
  for (const model of models) {
    const variantHashes: Record<string, string> = {};
    for (const [name, parameters] of variants(model))
      variantHashes[name] = createHash('sha256').update(JSON.stringify(await invocationsFor(model, parameters))).digest('hex');
    snapshot[model.id] = { defaults: await invocationsFor(model, model.defaults), variants: variantHashes };
  }
  await expect(`${JSON.stringify(snapshot, null, 1)}\n`).toMatchFileSnapshot('__snapshots__/openscad-invocations.json');
}, 300_000);
