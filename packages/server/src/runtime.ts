import { resolve } from 'node:path';
import { config } from './config.ts';
import { ObjectStorage } from './objects.ts';
import { PostgresStorage } from './postgres.ts';
import { LocalStorage, type Storage } from './storage.ts';
import { Store } from './store.ts';

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Required configuration ${name} is missing.`);
  return value;
}

/** PostgreSQL deployments never silently fall back to local SQLite. */
export function runtimeStorage(role: 'api' | 'worker' | 'maintenance'): Storage {
  const settings = config();
  const backend = process.env['STORAGE_BACKEND'] ?? 'sqlite';
  if (backend === 'sqlite') return new LocalStorage(new Store(settings.dataDir, settings.projectRoot));
  if (backend !== 'postgres') throw new Error('STORAGE_BACKEND must be sqlite or postgres.');
  const objects = new ObjectStorage({
    endpoint: required('S3_ENDPOINT'), region: process.env['S3_REGION'] ?? 'garage',
    accessKeyId: required('S3_ACCESS_KEY_ID'), secretAccessKey: required('S3_SECRET_ACCESS_KEY'),
    catalogueBucket: required('S3_CATALOGUE_BUCKET'), generatedBucket: required('S3_GENERATED_BUCKET'),
  });
  return new PostgresStorage(required('DATABASE_URL'), settings.projectRoot,
    resolve(process.env['SCRATCH_DIR'] ?? '/tmp/canfactory'), objects, role === 'api' ? 5 : 2);
}
