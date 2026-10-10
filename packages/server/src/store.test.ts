import { mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { aiRubberDuck, cigaretteCase, findPart, fruitFlyTrap, litterShovel, mossPlanter, plankConnector } from '@canfactory/contracts';
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
    store.seed(); expect(store.listModels()).toHaveLength(15);
    const first = store.enqueue(fruitFlyTrap, fruitFlyTrap.defaults);
    const reordered = Object.fromEntries(Object.entries(fruitFlyTrap.defaults).reverse());
    expect(store.enqueue(fruitFlyTrap, reordered).id).toBe(first.id);
  });

  it('separates duck variants, sizes, fits and trusted part constants in the render cache', () => {
    const original = store.enqueue(aiRubberDuck, aiRubberDuck.defaults);
    for (const change of [{ variant: 'codex-v1-round' }, { bodyLength: 70 }, { clearance: 0.1 }])
      expect(store.enqueue(aiRubberDuck, { ...aiRubberDuck.defaults, ...change }).id).not.toBe(original.id);
    expect(sourceFingerprint(repositoryRoot, { ...aiRubberDuck, parts: aiRubberDuck.parts.map(part => ({ ...part, scadConstants: { PART: 'other' } })) }))
      .not.toBe(sourceFingerprint(repositoryRoot, aiRubberDuck));
  });

  it('seeds an assembly model with no reference file and a ZIP artifact format', () => {
    const detail = store.getModel(mossPlanter.id)?.detail;
    expect(detail?.artifactFormat).toBe('zip');
    expect(detail?.customizable).toBe(true);
    expect(detail?.referenceUrl).toBeUndefined();
    expect(detail?.parts).toHaveLength(5);
    expect(existsSync(join(store.artifacts.catalogDir, `${mossPlanter.id}-${mossPlanter.version}.stl`))).toBe(false);
  });

  it('seeds the cigarette case as a customizable ZIP assembly with snap and text parameters', () => {
    const detail = store.getModel(cigaretteCase.id)?.detail;
    expect(detail?.artifactFormat).toBe('zip');
    expect(detail?.customizable).toBe(true);
    expect(detail?.controls.map(control => control.key)).toEqual(['snap', 'magnet', 'miniLidSnap', 'holderSnap', 'lighterSnap', 'miniBoxSnap', 'undersideMark', 'engraveText', 'textFont', 'textSize', 'logo', 'logoSize', 'textMode', 'clearance', 'snapDetentEngage', 'snapCrushSqueeze', 'miniLidDetentEngage', 'miniLidCrushSqueeze', 'holderDetentEngage', 'holderCrushSqueeze', 'lighterCrushSqueeze', 'miniBoxDetentEngage', 'miniBoxCrushSqueeze']);
    expect(detail?.defaults).toEqual(cigaretteCase.defaults);
    expect(detail?.parts?.map(part => part.id)).toEqual(['case-box', 'case-lid', 'mini-holder', 'mini-box', 'mini-lid', 'case-text']);
    expect(detail?.referenceUrl).toBeUndefined();
    const job = store.enqueue(cigaretteCase, cigaretteCase.defaults);
    expect(store.enqueue(cigaretteCase, cigaretteCase.defaults).id).toBe(job.id);
    expect(store.enqueue(cigaretteCase, { ...cigaretteCase.defaults, engraveText: 'Tom' }).id).not.toBe(job.id);
  });

  it('seeds the plank connector as a customizable single-STL model without a reference file', () => {
    const detail = store.getModel(plankConnector.id)?.detail;
    expect(detail?.artifactFormat).toBe('stl');
    expect(detail?.customizable).toBe(true);
    expect(detail?.referenceUrl).toBeUndefined();
    expect(detail?.parts).toBeUndefined();
    expect(detail?.controls.map(control => control.key)).toEqual(['pocketWidth', 'pocketThickness', 'insertionDepth', 'screwHoles', 'holeFit', 'holesPerEnd', 'wallThickness', 'stopThickness', 'entryChamfer']);
    expect(detail?.defaults).toEqual(plankConnector.defaults);
    const job = store.enqueue(plankConnector, plankConnector.defaults);
    expect(store.enqueue(plankConnector, { ...plankConnector.defaults }).id).toBe(job.id);
    expect(store.enqueue(plankConnector, { ...plankConnector.defaults, screwHoles: 'M4' }).id).not.toBe(job.id);
    expect(store.enqueue(plankConnector, { ...plankConnector.defaults, insertionDepth: 25 }).id).not.toBe(job.id);
  });

  it('seeds the litter shovel as a three-part assembly whose sieve and snap settings reach the cache key', () => {
    const detail = store.getModel(litterShovel.id)?.detail;
    expect(detail?.artifactFormat).toBe('zip');
    expect(detail?.customizable).toBe(true);
    expect(detail?.referenceUrl).toBeUndefined();
    expect(detail?.parts?.map(part => part.id)).toEqual(['container', 'scoop', 'handle']);
    expect(detail?.assembly?.steps.map(step => step.parts)).toEqual([['scoop'], ['handle']]);
    const job = store.enqueue(litterShovel, litterShovel.defaults);
    expect(store.enqueue(litterShovel, { ...litterShovel.defaults }).id).toBe(job.id);
    expect(store.enqueue(litterShovel, { ...litterShovel.defaults, sievePattern: 'hex' }).id).not.toBe(job.id);
    expect(store.enqueue(litterShovel, { ...litterShovel.defaults, gapWidth: 5 }).id).not.toBe(job.id);
    expect(store.enqueue(litterShovel, { ...litterShovel.defaults, handleSnap: 'friction' }).id).not.toBe(job.id);
    expect(store.enqueue(litterShovel, { ...litterShovel.defaults, clearance: 0.3 }).id).not.toBe(job.id);
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
    expect(store.listModels()).toHaveLength(15);
    expect(existsSync(join(store.artifacts.catalogDir, 'fruit-fly-trap-1.stl'))).toBe(true);
  });

  it('bounds pending work without rejecting cache hits', () => {
    for (let index = 0; index < 16; index++) store.enqueue(fruitFlyTrap, { ...fruitFlyTrap.defaults, trapHeight: 60 + index });
    expect(() => store.enqueue(fruitFlyTrap, { ...fruitFlyTrap.defaults, trapHeight: 100 })).toThrow('queue is full');
    expect(store.enqueue(fruitFlyTrap, fruitFlyTrap.defaults).status).toBe('queued');
  });
});
