import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { aiRubberDuck, cigaretteCase, findPart, fruitFlyTrap, litterShovel, models, mossPlanter, plankConnector } from '@canfactory/contracts';
import { expireJobs, expireLeases, testStorage } from '../../../tools/unit-storage.ts';
import { repositoryRoot } from './config.ts';
import { inspectStl } from './mesh.ts';
import { sourceFingerprint, type PostgresStorage, type RenderJob } from './postgres.ts';

type Point = [number, number, number];
const a: Point = [0, 0, 0]; const b: Point = [10, 0, 0]; const c: Point = [0, 10, 0]; const d: Point = [0, 0, 10];
const tetrahedron = Buffer.alloc(84 + 4 * 50);
tetrahedron.writeUInt32LE(4, 80);
[[a, c, b], [a, b, d], [a, d, c], [b, c, d]].forEach((triangle, index) => triangle.flat().forEach((value, coordinate) => tetrahedron.writeFloatLE(value, 84 + index * 50 + 12 + coordinate * 4)));

let directory: string;
let store: PostgresStorage;
beforeEach(async () => { directory = mkdtempSync(join(tmpdir(), 'canfactory-store-test-')); store = await testStorage(); });
afterEach(async () => { await store.close(); rmSync(directory, { recursive: true, force: true }); });

/** How many registered models the catalogue has a seeded revision for. */
const seeded = async () => (await Promise.all(models.map(model => store.getModel(model.id)))).filter(Boolean).length;

/** Claims the oldest job and publishes a tetrahedron as its artifact; returns the job as published and its object key. */
async function publish(format: 'stl' | 'zip' = 'stl'): Promise<{ job: RenderJob; key: string }> {
  const job = await store.claim();
  if (!job?.leaseToken) throw new Error('Expected claim');
  const file = join(directory, `artifact.${format}`);
  writeFileSync(file, tetrahedron);
  expect(await store.complete(job.id, job.leaseToken, inspectStl(tetrahedron), file, undefined, format)).toBe(true);
  return { job, key: `renders/${job.id}/${job.leaseToken}.${format}` };
}

describe('temporary render queue', () => {
  it('seeds idempotently and reuses equivalent normalized parameters', async () => {
    await store.seed(); expect(await seeded()).toBe(models.length);
    const first = await store.enqueue(fruitFlyTrap, fruitFlyTrap.defaults);
    const reordered = Object.fromEntries(Object.entries(fruitFlyTrap.defaults).reverse());
    expect((await store.enqueue(fruitFlyTrap, reordered)).id).toBe(first.id);
  });

  it('separates duck variants, sizes, fits and trusted part constants in the render cache', async () => {
    const original = await store.enqueue(aiRubberDuck, aiRubberDuck.defaults);
    for (const change of [{ variant: 'codex-v1-round' }, { bodyLength: 70 }, { clearance: 0.1 }])
      expect((await store.enqueue(aiRubberDuck, { ...aiRubberDuck.defaults, ...change })).id).not.toBe(original.id);
    expect(sourceFingerprint(repositoryRoot, { ...aiRubberDuck, parts: aiRubberDuck.parts.map(part => ({ ...part, scadConstants: { PART: 'other' } })) }))
      .not.toBe(sourceFingerprint(repositoryRoot, aiRubberDuck));
  });

  it('seeds a model with no reference file with an empty reference key', async () => {
    expect((await store.getModel(mossPlanter.id))?.referenceName).toBe('');
    expect((await store.getModel(fruitFlyTrap.id))?.referenceName).toMatch(/^references\/[0-9a-f]{64}\.stl$/);
  });

  it('caches the cigarette case by its snap and text parameters', async () => {
    const job = await store.enqueue(cigaretteCase, cigaretteCase.defaults);
    expect((await store.enqueue(cigaretteCase, cigaretteCase.defaults)).id).toBe(job.id);
    expect((await store.enqueue(cigaretteCase, { ...cigaretteCase.defaults, engraveText: 'Tom' })).id).not.toBe(job.id);
  });

  it('caches the plank connector by its screw holes and depth', async () => {
    const job = await store.enqueue(plankConnector, plankConnector.defaults);
    expect((await store.enqueue(plankConnector, { ...plankConnector.defaults })).id).toBe(job.id);
    expect((await store.enqueue(plankConnector, { ...plankConnector.defaults, screwHoles: 'M4' })).id).not.toBe(job.id);
    expect((await store.enqueue(plankConnector, { ...plankConnector.defaults, insertionDepth: 25 })).id).not.toBe(job.id);
  });

  it('puts the litter shovel’s sieve and snap settings in the cache key', async () => {
    const job = await store.enqueue(litterShovel, litterShovel.defaults);
    expect((await store.enqueue(litterShovel, { ...litterShovel.defaults })).id).toBe(job.id);
    expect((await store.enqueue(litterShovel, { ...litterShovel.defaults, sievePattern: 'hex' })).id).not.toBe(job.id);
    expect((await store.enqueue(litterShovel, { ...litterShovel.defaults, gapWidth: 5 })).id).not.toBe(job.id);
    expect((await store.enqueue(litterShovel, { ...litterShovel.defaults, handleSnap: 'friction' })).id).not.toBe(job.id);
    expect((await store.enqueue(litterShovel, { ...litterShovel.defaults, clearance: 0.3 })).id).not.toBe(job.id);
  });

  it('enqueues an assembly model with its parameters and reuses its published ZIP', async () => {
    const queued = await store.enqueue(mossPlanter, mossPlanter.defaults);
    const { job, key } = await publish('zip');
    expect(job.id).toBe(queued.id);
    expect(key).toMatch(/\.zip$/);
    expect(await store.objects.exists(store.objects.config.generatedBucket, key)).toBe(true);
    expect((await store.enqueue(mossPlanter, mossPlanter.defaults)).id).toBe(job.id);
  });

  it('fingerprints every part of an assembly, so editing one part invalidates the cache', () => {
    const before = sourceFingerprint(repositoryRoot, mossPlanter);
    const firstPart = mossPlanter.parts[0];
    if (!firstPart) throw new Error('Expected at least one part');
    const path = resolve(repositoryRoot, firstPart.sourcePath);
    const contents = readFileSync(path, 'utf8');
    writeFileSync(path, `${contents}\n// touched-by-test\n`);
    try {
      expect(sourceFingerprint(repositoryRoot, mossPlanter)).not.toBe(before);
    } finally {
      writeFileSync(path, contents); // restore: this must not permanently modify a verified SCAD file
    }
  });

  it('fingerprints each part\'s parameter mapping, so remapping a parameter invalidates the cache', () => {
    const before = sourceFingerprint(repositoryRoot, mossPlanter);
    const remapped = { ...mossPlanter, parts: mossPlanter.parts.map(part => ({ ...part, scadMapping: { ...part.scadMapping, towerDiameter: 'OTHER_NAME' } })) };
    expect(sourceFingerprint(repositoryRoot, remapped)).not.toBe(before);
  });

  it('fingerprints the library parts a model can choose, so correcting a part\'s value invalidates the cache', () => {
    const before = sourceFingerprint(repositoryRoot, cigaretteCase);
    const thickness = findPart('supermagnete-s-04-02-n')?.dimensions['thickness'];
    if (!thickness) throw new Error('Expected the magnet\'s thickness');
    const original = thickness.max;
    thickness.max = 2.05;
    try {
      expect(sourceFingerprint(repositoryRoot, cigaretteCase)).not.toBe(before);
    } finally {
      thickness.max = original; // restore the shared library entry
    }
    expect(sourceFingerprint(repositoryRoot, cigaretteCase)).toBe(before);
  });

  it('allows only one claim and fences old workers after lease recovery', async () => {
    const initial = await store.enqueue(fruitFlyTrap, fruitFlyTrap.defaults);
    const first = await store.claim();
    if (!first?.leaseToken) throw new Error('Expected claim');
    expect(await store.claim()).toBeUndefined();
    await expireLeases(store);
    expect(await store.renew(initial.id, first.leaseToken)).toBe(false);
    await store.recover();
    const retry = await store.claim();
    if (!retry?.leaseToken) throw new Error('Expected retry');
    expect(retry.attempts).toBe(2);
    expect(await store.renew(initial.id, first.leaseToken)).toBe(false);
    await expireLeases(store); await store.recover();
    expect((await store.getJob(initial.id))?.status).toBe('failed');
    expect((await store.getJob(initial.id))?.error?.code).toBe('WORKER_INTERRUPTED');
    expect(await store.claim()).toBeUndefined();
    expect((await store.enqueue(fruitFlyTrap, fruitFlyTrap.defaults)).id).not.toBe(initial.id);
  });

  it('expires parameters and files but preserves catalogue assets', async () => {
    await store.enqueue(fruitFlyTrap, fruitFlyTrap.defaults);
    const { job, key } = await publish();
    await expireJobs(store); await store.cleanup();
    expect(await store.getJob(job.id)).toBeUndefined();
    expect(await store.objects.exists(store.objects.config.generatedBucket, key)).toBe(false);
    expect(await seeded()).toBe(models.length);
    const reference = (await store.getModel(fruitFlyTrap.id))?.referenceName;
    if (!reference) throw new Error('Expected a reference file');
    expect(await store.objects.exists(store.objects.config.catalogueBucket, reference)).toBe(true);
  });

  it('bounds pending work without rejecting cache hits', async () => {
    for (let index = 0; index < 16; index++) await store.enqueue(fruitFlyTrap, { ...fruitFlyTrap.defaults, trapHeight: 60 + index });
    await expect(store.enqueue(fruitFlyTrap, { ...fruitFlyTrap.defaults, trapHeight: 100 })).rejects.toThrow('queue is full');
    expect((await store.enqueue(fruitFlyTrap, { ...fruitFlyTrap.defaults, trapHeight: 60 })).status).toBe('queued');
  });
});

describe('readiness across a rolling upgrade', () => {
  it('stays ready on a newer schema and not on an older one', async () => {
    const newest = (await store.pool.query<{ name: string; sha256: string }>('SELECT name, sha256 FROM migrations ORDER BY name DESC LIMIT 1')).rows[0];
    if (!newest) throw new Error('Expected a migrated database');
    // the next release's release Job has migrated: this (previous) release keeps serving
    await store.pool.query(`INSERT INTO migrations(name, sha256) VALUES('9999_next_release.sql', '')`);
    try { await store.ready(); } finally { await store.pool.query(`DELETE FROM migrations WHERE name='9999_next_release.sql'`); }
    // this release's own migration has not run (its release Job failed): not ready
    await store.pool.query('DELETE FROM migrations WHERE name=$1', [newest.name]);
    try { await expect(store.ready()).rejects.toThrow('not compatible'); }
    finally { await store.pool.query('INSERT INTO migrations(name, sha256) VALUES($1, $2)', [newest.name, newest.sha256]); }
    await store.ready();
  });
});
