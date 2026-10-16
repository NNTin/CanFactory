import { execFile } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { promisify } from 'node:util';
import { Pool } from 'pg';
import { ObjectStorage, type ObjectConfig } from '@canfactory/server';

/** The images Compose runs (compose.yaml); keep both in step. */
export const POSTGRES_IMAGE = 'postgres:18.6-trixie@sha256:86c951e05bf56c93d95d397747fb8820ac76cc3bedb78f43abd83eedbe3666ae';
export const GARAGE_IMAGE = 'dxflrs/garage:v2.4.1@sha256:9c96caa2612d3411acc5b0e6701fb238dbfba33e533a6d7d3d811a4b12d0d020';

/** A PostgreSQL database and two Garage buckets for tests and tools, with their containers when this process started them. */
export interface StorageServices {
  databaseUrl: string;
  objects: ObjectConfig;
  /** Present only for containers started here (not with TEST_DATABASE_URL), so a test can pause them. */
  containers?: { postgres: string; garage: string; docker: (...args: string[]) => Promise<string> };
  stop: () => Promise<void>;
}

const exec = promisify(execFile);

async function waitFor(action: () => Promise<unknown>): Promise<void> {
  for (let attempt = 0; attempt < 150; attempt++) {
    try { await action(); return; } catch { await delay(200); }
  }
  throw new Error('Isolated storage services did not become ready within 30 seconds.');
}

/** Waits until both services answer, and creates the buckets. */
async function prepare(databaseUrl: string, objects: ObjectConfig): Promise<void> {
  const pool = new Pool({ connectionString: databaseUrl, connectionTimeoutMillis: 1000 });
  pool.on('error', () => undefined);
  const storage = new ObjectStorage(objects);
  try {
    await waitFor(() => pool.query('SELECT 1'));
    await waitFor(() => storage.createBuckets());
  } finally { await pool.end(); storage.close(); }
}

/**
 * Throwaway PostgreSQL and Garage containers (Docker), torn down by `stop()`. Without Docker, set TEST_DATABASE_URL (a server
 * where the user may create databases), TEST_S3_ENDPOINT, TEST_S3_ACCESS_KEY_ID and TEST_S3_SECRET_ACCESS_KEY (a key that may
 * create buckets) to services you run yourself: each call then gets a new database, and buckets named after `prefix`.
 */
export async function startStorageServices(prefix: string): Promise<StorageServices> {
  const server = process.env['TEST_DATABASE_URL'];
  if (server) {
    const variable = (name: string) => { const value = process.env[name]; if (!value) throw new Error(`TEST_DATABASE_URL also needs ${name}.`); return value; };
    // A database of its own on that server, dropped again by stop(); buckets named after the caller.
    const database = `${prefix}-${randomBytes(6).toString('hex')}`.replaceAll('-', '_');
    const admin = new Pool({ connectionString: server, connectionTimeoutMillis: 5000 });
    await admin.query(`CREATE DATABASE ${database}`);
    const url = new URL(server); url.pathname = `/${database}`;
    const objects: ObjectConfig = { endpoint: variable('TEST_S3_ENDPOINT'), region: process.env['TEST_S3_REGION'] ?? 'garage',
      accessKeyId: variable('TEST_S3_ACCESS_KEY_ID'), secretAccessKey: variable('TEST_S3_SECRET_ACCESS_KEY'),
      catalogueBucket: `${prefix}-catalogue`, generatedBucket: `${prefix}-generated` };
    const stop = async () => { try { await admin.query(`DROP DATABASE IF EXISTS ${database} WITH (FORCE)`); } finally { await admin.end(); } };
    try { await prepare(url.href, objects); } catch (error) { await stop(); throw error; }
    return { databaseUrl: url.href, objects, stop };
  }

  const name = `${prefix}-${randomBytes(6).toString('hex')}`;
  const directory = await mkdtemp(join(tmpdir(), `${name}-`));
  const password = randomBytes(24).toString('hex');
  const keyId = `GK${randomBytes(12).toString('hex')}`;
  const keySecret = randomBytes(32).toString('hex');
  const environment = { ...process.env, POSTGRES_PASSWORD: password, GARAGE_RPC_SECRET: randomBytes(32).toString('hex'),
    GARAGE_DEFAULT_ACCESS_KEY: keyId, GARAGE_DEFAULT_SECRET_KEY: keySecret };
  const docker = async (...args: string[]) => {
    try { return (await exec('docker', args, { env: environment, maxBuffer: 1_048_576 })).stdout.trim(); }
    catch { throw new Error(`Isolated Docker ${args[0] ?? 'operation'} failed; credentials suppressed.`); }
  };
  const postgres = `${name}-postgres`;
  const garage = `${name}-garage`;
  const stop = async () => {
    for (const container of [garage, postgres]) await docker('rm', '-f', '-v', container).catch(() => undefined);
    await docker('network', 'rm', name).catch(() => undefined);
    await rm(directory, { recursive: true, force: true });
  };
  try {
    await docker('network', 'create', name);
    await docker('run', '-d', '--name', postgres, '--network', name, '--memory', '768m', '--cpus', '1',
      '-e', 'POSTGRES_PASSWORD', '-e', 'POSTGRES_USER=canfactory', '-e', 'POSTGRES_DB=canfactory',
      '-p', '127.0.0.1::5432', '--tmpfs', '/var/lib/postgresql', POSTGRES_IMAGE);
    const configPath = join(directory, 'garage.toml');
    await writeFile(configPath, 'metadata_dir = "/data/meta"\ndata_dir = "/data/objects"\ndb_engine = "lmdb"\nreplication_factor = 1\nrpc_bind_addr = "0.0.0.0:3901"\nrpc_public_addr = "127.0.0.1:3901"\n[s3_api]\ns3_region = "garage"\napi_bind_addr = "0.0.0.0:3900"\n', { mode: 0o644 });
    await docker('run', '-d', '--name', garage, '--network', name, '--memory', '512m', '--cpus', '1',
      '-e', 'GARAGE_RPC_SECRET', '-e', 'GARAGE_DEFAULT_ACCESS_KEY', '-e', 'GARAGE_DEFAULT_SECRET_KEY',
      '-p', '127.0.0.1::3900', '--tmpfs', '/data', '-v', `${configPath}:/etc/garage.toml:ro`,
      GARAGE_IMAGE, '/garage', 'server', '--single-node', '--default-access-key');
    const pgPort = (await docker('port', postgres, '5432')).split(':').at(-1);
    const s3Port = (await docker('port', garage, '3900')).split(':').at(-1);
    if (!pgPort || !s3Port) throw new Error('Isolated storage services published no ports.');
    const databaseUrl = `postgresql://canfactory:${password}@127.0.0.1:${pgPort}/canfactory`;
    const objects: ObjectConfig = { endpoint: `http://127.0.0.1:${s3Port}`, region: 'garage', accessKeyId: keyId,
      secretAccessKey: keySecret, catalogueBucket: 'catalogue', generatedBucket: 'generated' };
    await prepare(databaseUrl, objects);
    return { databaseUrl, objects, containers: { postgres, garage, docker }, stop };
  } catch (error) { await stop(); throw error; }
}
