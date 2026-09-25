import { mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cigaretteCase, fruitFlyTrap, mossPlanter } from '@canfactory/contracts';
import { CACHE_TTL_MS, LEASE_MS } from './config.ts';
import { Store, repositoryRoot, sourceFingerprint } from './store.ts';

let directory: string;
let store: Store;
let time: number;
beforeEach(() => {
  time = Date.now(); directory = mkdtempSync(join(tmpdir(), 'canfactory-store-test-'));
  store = new Store(directory, repositoryRoot, () => time); store.migrate(); store.seed();
});
afterEach(() => { store.close(); rmSync(directory, { recursive: true, force: true }); });

describe('temporary render queue', () => {
  it('seeds idempotently and reuses equivalent normalized parameters', () => {
    store.seed(); expect(store.listModels()).toHaveLength(3);
    const first = store.enqueue(fruitFlyTrap, fruitFlyTrap.defaults);
    const reordered = Object.fromEntries(Object.entries(fruitFlyTrap.defaults).reverse());
    expect(store.enqueue(fruitFlyTrap, reordered).id).toBe(first.id);
  });

  it('seeds an assembly model with no reference file and a ZIP artifact format', () => {
    const detail = store.getModel(mossPlanter.id)?.detail;
    expect(detail?.artifactFormat).toBe('zip');
    expect(detail?.customizable).toBe(true);
    expect(detail?.referenceUrl).toBeUndefined();
    expect(detail?.parts).toHaveLength(5);
    expect(existsSync(join(store.artifacts.catalogDir, `${mossPlanter.id}-${mossPlanter.version}.stl`))).toBe(false);
  });

  it('seeds the cigarette case as a customizable ZIP assembly with a snap-mode enum', () => {
    const detail = store.getModel(cigaretteCase.id)?.detail;
    expect(detail?.artifactFormat).toBe('zip');
    expect(detail?.customizable).toBe(true);
    expect(detail?.controls.map(control => [control.key, control.kind])).toEqual([['snap', 'enum']]);
    expect(detail?.defaults).toEqual({ snap: 'friction' });
    expect(detail?.parts?.map(part => part.id)).toEqual(['case-box', 'case-lid', 'mini-holder', 'mini-box', 'mini-lid']);
    expect(detail?.referenceUrl).toBeUndefined();
    const job = store.enqueue(cigaretteCase, { snap: 'friction' });
    expect(store.enqueue(cigaretteCase, { snap: 'friction' }).id).toBe(job.id);
    expect(store.enqueue(cigaretteCase, { snap: 'clip' }).id).not.toBe(job.id);
  });

  it('enqueues an assembly model with its parameters and reuses/clears both artifact extensions', () => {
    const job = store.enqueue(mossPlanter, mossPlanter.defaults);
    writeFileSync(store.artifacts.path(job.id, 'zip'), 'temporary output');
    expect(existsSync(store.artifacts.path(job.id, 'stl'))).toBe(false);
    expect(existsSync(store.artifacts.path(job.id, 'zip'))).toBe(true);
    expect(store.enqueue(mossPlanter, mossPlanter.defaults).id).toBe(job.id);
    store.artifacts.remove(job.id);
    expect(existsSync(store.artifacts.path(job.id, 'zip'))).toBe(false);
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

  it('allows only one claim and fences old workers after lease recovery', () => {
    const initial = store.enqueue(fruitFlyTrap, fruitFlyTrap.defaults);
    const first = store.claim();
    if (!first?.leaseToken) throw new Error('Expected claim');
    const secondStore = new Store(directory, repositoryRoot, () => time);
    try { expect(secondStore.claim()).toBeUndefined(); } finally { secondStore.close(); }
    time += LEASE_MS + 1;
    expect(store.renew(initial.id, first.leaseToken)).toBe(false);
    store.recover();
    const retry = store.claim();
    if (!retry?.leaseToken) throw new Error('Expected retry');
    expect(retry.attempts).toBe(2);
    expect(store.renew(initial.id, first.leaseToken)).toBe(false);
    time += LEASE_MS + 1; store.recover();
    expect(store.getJob(initial.id)?.status).toBe('failed');
    expect(store.getJob(initial.id)?.error?.code).toBe('WORKER_INTERRUPTED');
    expect(store.claim()).toBeUndefined();
    expect(store.enqueue(fruitFlyTrap, fruitFlyTrap.defaults).id).not.toBe(initial.id);
  });

  it('expires parameters and files but preserves catalogue assets', () => {
    const job = store.enqueue(fruitFlyTrap, fruitFlyTrap.defaults);
    writeFileSync(store.artifacts.path(job.id), 'temporary output');
    time += CACHE_TTL_MS + 1; store.cleanup();
    expect(store.getJob(job.id)).toBeUndefined();
    expect(existsSync(store.artifacts.path(job.id))).toBe(false);
    expect(store.listModels()).toHaveLength(3);
    expect(existsSync(join(store.artifacts.catalogDir, 'fruit-fly-trap-1.stl'))).toBe(true);
  });

  it('bounds pending work without rejecting cache hits', () => {
    for (let index = 0; index < 16; index++) store.enqueue(fruitFlyTrap, { ...fruitFlyTrap.defaults, trapHeight: 60 + index });
    expect(() => store.enqueue(fruitFlyTrap, { ...fruitFlyTrap.defaults, trapHeight: 100 })).toThrow('queue is full');
    expect(store.enqueue(fruitFlyTrap, fruitFlyTrap.defaults).status).toBe('queued');
  });
});
