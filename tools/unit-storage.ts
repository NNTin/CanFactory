import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { inject } from 'vitest';
import type { TestProject } from 'vitest/node';
import { ObjectStorage, PostgresStorage, repositoryRoot, type ObjectConfig } from '@canfactory/server';
import { startStorageServices } from './storage-services.ts';

declare module 'vitest' {
  export interface ProvidedContext { storage: { databaseUrl: string; objects: ObjectConfig } }
}

const scratch = join(tmpdir(), 'canfactory-unit-scratch');

/** Vitest global setup: one PostgreSQL and Garage for the whole run, migrated and seeded once (tools/storage-services.ts). */
export default async function setup(project: TestProject): Promise<() => Promise<void>> {
  const services = await startStorageServices('canfactory-unit');
  const store = new PostgresStorage(services.databaseUrl, repositoryRoot, scratch, new ObjectStorage(services.objects));
  try { await store.migrate(); await store.seed(); }
  catch (error) { await store.close(); await services.stop(); throw error; }
  await store.close();
  project.provide('storage', { databaseUrl: services.databaseUrl, objects: services.objects });
  return services.stop;
}

/** The seeded storage, with an empty queue and no Awin rows. Test files run one at a time (vitest.config.ts), so they share it. */
export async function testStorage(): Promise<PostgresStorage> {
  const { databaseUrl, objects } = inject('storage');
  const store = new PostgresStorage(databaseUrl, repositoryRoot, scratch, new ObjectStorage(objects));
  await store.pool.query('TRUNCATE render_jobs, workers, object_deletions, awin_offers, awin_feeds');
  return store;
}

/** Ends every job's hour (the database clock judges expiry, so tests move the rows instead of the clock). */
export async function expireJobs(store: PostgresStorage): Promise<void> {
  await store.pool.query('UPDATE render_jobs SET expires_at=0');
}

/** Ends every running job's lease, as if its worker had stopped renewing it. */
export async function expireLeases(store: PostgresStorage): Promise<void> {
  await store.pool.query("UPDATE render_jobs SET lease_until=0 WHERE status='running'");
}
