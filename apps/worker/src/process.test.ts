import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { fruitFlyTrap, mossPlanter } from '@canfactory/contracts';
import { repositoryRoot, Store } from '@canfactory/server';
import { processJob, type JobLogger } from './process.ts';
import { classifyRenderError, RenderFailure, type OpenScadRunner } from './render.ts';

type Point = [number, number, number];
type Triangle = [Point, Point, Point];
const a: Point = [0, 0, 0]; const b: Point = [10, 0, 0]; const c: Point = [0, 10, 0]; const d: Point = [0, 0, 10]; const m: Point = [5, 0, 0];
const tetrahedron: Triangle[] = [[a, c, b], [a, b, d], [a, d, c], [b, c, d]];
// the tetrahedron with a float32 sliver along a-b (see mesh.test.ts): valid after repair
const withSliver: Triangle[] = [[a, c, b], [a, m, d], [m, b, d], [a, d, c], [b, c, d], [a, b, m]];
// two coincident vertices: not a rounding artefact, and not repairable
const collapsed: Triangle[] = [[a, c, b], [a, b, d], [a, a, b], [b, c, d]];

function stl(triangles: Triangle[]): Buffer {
  const bytes = Buffer.alloc(84 + triangles.length * 50); bytes.writeUInt32LE(triangles.length, 80);
  triangles.forEach((triangle, index) => triangle.flat().forEach((value, coordinate) => bytes.writeFloatLE(value, 84 + index * 50 + 12 + coordinate * 4)));
  return bytes;
}
/** Writes `mesh(file)` to whatever -o the render asked for; the SCAD file names which part is being rendered. */
const writing = (mesh: (scad: string) => Triangle[]): OpenScadRunner => args => {
  const output = args[args.indexOf('-o') + 1];
  if (!output) throw new Error('Expected an -o argument');
  writeFileSync(output, stl(mesh(args.at(-1) ?? '')));
  return Promise.resolve();
};

interface Entry { level: 'info' | 'warn' | 'error'; fields: Record<string, unknown>; message: string }
function recorder(): JobLogger & { entries: Entry[] } {
  const entries: Entry[] = [];
  const at = (level: Entry['level']) => (fields: object, message: string) => { entries.push({ level, fields: fields as Record<string, unknown>, message }); };
  return { entries, info: at('info'), warn: at('warn'), error: at('error') };
}

let directory: string;
let store: Store;
beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), 'canfactory-process-test-'));
  store = new Store(directory, repositoryRoot); store.migrate(); store.seed();
});
afterEach(() => { store.close(); rmSync(directory, { recursive: true, force: true }); });

function claimNext() {
  const job = store.claim();
  if (!job?.leaseToken) throw new Error('Expected to claim a job');
  return job;
}

describe('processJob', () => {
  it('records a geometry defect with its part, reference and no retry, logs it with the parameters, and keeps going', async () => {
    const log = recorder();
    const parameters = { ...mossPlanter.defaults, towerDiameter: 60 };
    const broken = store.enqueue(mossPlanter, parameters);
    const outcome = await processJob(store, claimNext(), new AbortController().signal, log, writing(scad => scad.endsWith('spike.scad') ? collapsed : tetrahedron));
    expect(outcome).toBe('failed');
    const failed = store.getJob(broken.id);
    expect(failed?.status).toBe('failed');
    expect(failed?.error).toMatchObject({ code: 'GEOMETRY_INVALID', reference: broken.id, retryable: false });
    expect(failed?.error?.message).toMatch(/defect in the model/);
    expect(failed?.error?.detail).toMatch(/\(ground-spike\): Removing 1 triangles with coincident vertices leaves the edge/);
    const logged = log.entries.find(entry => entry.level === 'error');
    expect(logged?.message).toBe('Render failed: GEOMETRY_INVALID');
    expect(logged?.fields).toMatchObject({ jobId: broken.id, modelId: mossPlanter.id, code: 'GEOMETRY_INVALID', parameters });

    // the worker is unaffected: the next job renders
    const next = store.enqueue(fruitFlyTrap, fruitFlyTrap.defaults);
    expect(await processJob(store, claimNext(), new AbortController().signal, log, writing(() => tetrahedron))).toBe('published');
    expect(store.getJob(next.id)?.status).toBe('succeeded');
  });

  it('publishes a render whose slivers it repaired, and says so in the metadata and a warning', async () => {
    const log = recorder();
    const job = store.enqueue(mossPlanter, mossPlanter.defaults);
    expect(await processJob(store, claimNext(), new AbortController().signal, log, writing(scad => scad.endsWith('cap.scad') ? withSliver : tetrahedron))).toBe('published');
    const result = store.getJob(job.id);
    if (!result?.artifact || !('parts' in result.artifact)) throw new Error('Expected an assembly artifact');
    expect(result.artifact.meshRepairs).toBe(1);
    expect(result.artifact.parts.find(part => part.id === 'cover-cap')?.meshRepairs).toBe(1);
    expect(result.artifact.parts.filter(part => part.meshRepairs)).toHaveLength(1);
    expect(log.entries.filter(entry => entry.level === 'warn')).toEqual([
      expect.objectContaining({ fields: expect.objectContaining({ jobId: job.id, part: 'cover-cap', repaired: 1 }) as unknown }),
    ]);
  });

  it('classifies generator failures and unexpected errors, keeping only the latter retryable', async () => {
    const log = recorder();
    const scad = store.enqueue(fruitFlyTrap, fruitFlyTrap.defaults);
    await processJob(store, claimNext(), new AbortController().signal, log,
      () => Promise.reject(new RenderFailure('OPENSCAD_FAILED', 'defect', 'ERROR: Assertion failed', false)));
    expect(store.getJob(scad.id)?.error).toMatchObject({ code: 'OPENSCAD_FAILED', detail: 'ERROR: Assertion failed', retryable: false });

    const internal = store.enqueue(fruitFlyTrap, { ...fruitFlyTrap.defaults, trapHeight: 70 });
    await processJob(store, claimNext(), new AbortController().signal, log, () => Promise.reject(new TypeError('boom')));
    expect(store.getJob(internal.id)?.error).toMatchObject({ code: 'RENDERER_INTERNAL', detail: 'TypeError: boom', retryable: true, reference: internal.id });
  });

  it('leaves an aborted job to lease recovery instead of failing it', async () => {
    const log = recorder();
    const job = store.enqueue(fruitFlyTrap, fruitFlyTrap.defaults);
    const controller = new AbortController();
    const outcome = await processJob(store, claimNext(), controller.signal, log, () => { controller.abort(); return Promise.reject(new Error('killed')); });
    expect(outcome).toBe('aborted');
    expect(store.getJob(job.id)?.status).toBe('running');
    expect(log.entries.some(entry => entry.level === 'error')).toBe(false);
  });
});

describe('classifyRenderError', () => {
  it('keeps a RenderFailure and wraps anything else as a retryable internal error', () => {
    const failure = new RenderFailure('RENDER_TIMEOUT', 'too slow', 'stopped', true);
    expect(classifyRenderError(failure)).toBe(failure);
    expect(classifyRenderError('text')).toMatchObject({ code: 'RENDERER_INTERNAL', detail: 'text', retryable: true });
    expect(failure.envelope('job-1')).toEqual({ code: 'RENDER_TIMEOUT', message: 'too slow', issues: [], detail: 'stopped', reference: 'job-1', retryable: true });
  });
});
