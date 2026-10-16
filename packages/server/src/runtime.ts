import { resolve } from 'node:path';
import { config } from './config.ts';
import { ObjectStorage } from './objects.ts';
import { PostgresStorage } from './postgres.ts';

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Required configuration ${name} is missing.`);
  return value;
}

export function runtimeStorage(role: 'api' | 'worker' | 'maintenance'): PostgresStorage {
  const objects = new ObjectStorage({
    endpoint: required('S3_ENDPOINT'), region: process.env['S3_REGION'] ?? 'garage',
    accessKeyId: required('S3_ACCESS_KEY_ID'), secretAccessKey: required('S3_SECRET_ACCESS_KEY'),
    catalogueBucket: required('S3_CATALOGUE_BUCKET'), generatedBucket: required('S3_GENERATED_BUCKET'),
  });
  return new PostgresStorage(required('DATABASE_URL'), config().projectRoot,
    resolve(process.env['SCRATCH_DIR'] ?? '/tmp/canfactory'), objects, role === 'api' ? 5 : 2);
}
