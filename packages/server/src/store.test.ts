import { mkdtempSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { fruitFlyTrap } from '@canfactory/contracts';
import { CACHE_TTL_MS, LEASE_MS } from './config.ts';
import { Store, repositoryRoot } from './store.ts';

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
    store.seed(); expect(store.listModels()).toHaveLength(1);
    const first = store.enqueue(fruitFlyTrap, fruitFlyTrap.defaults);
    const reordered = Object.fromEntries(Object.entries(fruitFlyTrap.defaults).reverse());
    expect(store.enqueue(fruitFlyTrap, reordered).id).toBe(first.id);
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
    expect(store.listModels()).toHaveLength(1);
    expect(existsSync(join(store.artifacts.catalogDir, 'fruit-fly-trap-1.stl'))).toBe(true);
  });

  it('bounds pending work without rejecting cache hits', () => {
    for (let index = 0; index < 16; index++) store.enqueue(fruitFlyTrap, { ...fruitFlyTrap.defaults, trapHeight: 60 + index });
    expect(() => store.enqueue(fruitFlyTrap, { ...fruitFlyTrap.defaults, trapHeight: 100 })).toThrow('queue is full');
    expect(store.enqueue(fruitFlyTrap, fruitFlyTrap.defaults).status).toBe('queued');
  });
});
