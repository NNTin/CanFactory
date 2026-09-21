import { createHash, randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync } from 'node:fs';
import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Pool, type PoolClient } from 'pg';
import { models, type ApiError, type ModelDefinition, type ModelDetail, type ParameterValues } from '@canfactory/contracts';
import { CACHE_TTL_MS, LEASE_MS, QUEUE_LIMIT, RENDERER_FINGERPRINT } from './config.ts';
import { AppError } from './errors.ts';
import type { MeshInfo } from './mesh.ts';
import { ObjectStorage, ORPHAN_GRACE_MS } from './objects.ts';
import type { RenderJob } from './schema.ts';
import type { CatalogueEntry, Storage } from './storage.ts';
import { sourceFingerprint } from './store.ts';

const CLOCK = 'floor(extract(epoch FROM clock_timestamp()) * 1000)::bigint';
const JOB_COLUMNS = `id::text, cache_key AS "cacheKey", model_id AS "modelId", model_version AS "modelVersion",
  source_hash AS "sourceHash", renderer_fingerprint AS "rendererFingerprint", parameters, status,
  created_at::float8 AS "createdAt", expires_at::float8 AS "expiresAt", attempts,
  lease_token::text AS "leaseToken", lease_until::float8 AS "leaseUntil", slot_count AS "slotCount",
  artifact, error, object_key AS "objectKey"`;
const LIVE_CLAIM = `id = $1 AND lease_token = $2 AND status = 'running' AND lease_until > ${CLOCK} AND expires_at > ${CLOCK}`;
const ADMISSION_LOCK = 716301;
const MIGRATION_LOCK = 716302;
const MAINTENANCE_LOCK = 716303;
const SCHEMA_VERSION = '0001_initial.sql';
interface JobRow extends RenderJob { objectKey: string | null }

/** PostgreSQL is the sole authority for admission, leases, expiry and publication. */
export class PostgresStorage implements Storage {
  readonly pool: Pool;
  readonly fingerprints: string[];
  constructor(
    databaseUrl: string,
    readonly projectRoot: string,
    readonly temporaryDir: string,
    readonly objects: ObjectStorage,
    connections = 5,
  ) {
    this.pool = new Pool({ connectionString: databaseUrl, max: connections,
      connectionTimeoutMillis: 5000, idleTimeoutMillis: 30_000,
      statement_timeout: 10_000, lock_timeout: 5000, idle_in_transaction_session_timeout: 15_000 });
    // An idle connection failure is retried on the next operation; do not crash the process.
    this.pool.on('error', () => { process.stderr.write('PostgreSQL idle connection lost.\n'); });
    this.fingerprints = models.map(model => sourceFingerprint(projectRoot, model));
    mkdirSync(temporaryDir, { recursive: true });
  }
  private async transaction<T>(action: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await action(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw error;
    } finally { client.release(); }
  }
  async now(): Promise<number> {
    const result = await this.pool.query<{ now: number }>(`SELECT (${CLOCK})::float8 AS now`);
    const row = result.rows[0];
    if (!row) throw new Error('Database clock unavailable.');
    return row.now;
  }
  async migrate(): Promise<void> {
    const directory = fileURLToPath(new URL('../postgres-migrations/', import.meta.url));
    const files = (await readdir(directory)).filter(name => name.endsWith('.sql')).sort();
    await this.transaction(async client => {
      await client.query('SELECT pg_advisory_xact_lock($1)', [MIGRATION_LOCK]);
      await client.query('CREATE TABLE IF NOT EXISTS migrations (name text PRIMARY KEY, sha256 text NOT NULL)');
      for (const name of files) {
        const sql = await readFile(resolve(directory, name), 'utf8');
        const sha = createHash('sha256').update(sql).digest('hex');
        const applied = await client.query<{ sha256: string }>('SELECT sha256 FROM migrations WHERE name=$1', [name]);
        if (applied.rows[0]) {
          if (applied.rows[0].sha256 !== sha) throw new Error('An applied database migration has changed.');
          continue;
        }
        await client.query(sql);
        await client.query('INSERT INTO migrations(name,sha256) VALUES($1,$2)', [name, sha]);
      }
    });
  }
  async seed(): Promise<void> {
    // Upload first, then activate all definitions atomically. Concurrent identical seeds are safe.
    const entries: { model: ModelDefinition; sha: string; key: string; detail: ModelDetail; source: string }[] = [];
    for (const model of models) {
      const path = resolve(this.projectRoot, model.referencePath);
      const sha = createHash('sha256').update(readFileSync(path)).digest('hex');
      const key = `references/${sha}.stl`;
      await this.objects.put(this.objects.config.catalogueBucket, key, path, sha);
      const detail: ModelDetail = {
        id: model.id, version: model.version, title: model.title, description: model.description,
        attribution: model.attribution, license: model.license, licenseUrl: model.licenseUrl,
        printNotes: model.printNotes, controls: model.controls, defaults: model.defaults,
        parameterSchema: { ...model.parameterSchema }, referenceUrl: `/api/v1/models/${model.id}/reference.stl`,
      };
      entries.push({ model, sha, key, detail, source: sourceFingerprint(this.projectRoot, model) });
    }
    await this.transaction(async client => {
      await client.query('SELECT pg_advisory_xact_lock($1)', [MIGRATION_LOCK]);
      for (const entry of entries) {
        await client.query(`INSERT INTO model_revisions(id,version,source_hash,detail,reference_key,reference_sha256)
          VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(id,source_hash) DO NOTHING`,
        [entry.model.id, entry.model.version, entry.source, entry.detail, entry.key, entry.sha]);
        await client.query(`INSERT INTO catalogue(id,source_hash) VALUES($1,$2)
          ON CONFLICT(id) DO UPDATE SET source_hash=excluded.source_hash`, [entry.model.id, entry.source]);
      }
      await client.query('DELETE FROM catalogue WHERE NOT (id = ANY($1::text[]))', [models.map(model => model.id)]);
    });
  }
  async ready(): Promise<void> {
    const result = await this.pool.query<{ name: string }>('SELECT name FROM migrations ORDER BY name DESC LIMIT 1');
    if (result.rows[0]?.name !== SCHEMA_VERSION) throw new Error('Database schema is not compatible with this release.');
    const catalogue = await this.listModels();
    if (catalogue.length === 0) throw new Error('Catalogue has not been seeded.');
    await this.objects.ready();
  }
  async listModels(): Promise<ModelDetail[]> {
    const result = await this.pool.query<{ detail: ModelDetail }>(`SELECT r.detail FROM catalogue c
      JOIN model_revisions r ON (r.id=c.id AND r.source_hash=c.source_hash) ORDER BY c.id`);
    return result.rows.map(row => row.detail);
  }
  async getModel(id: string): Promise<CatalogueEntry | undefined> {
    const result = await this.pool.query<CatalogueEntry>(`SELECT r.id,r.version,r.source_hash AS "sourceHash",
      r.reference_key AS "referenceName",r.detail FROM catalogue c
      JOIN model_revisions r ON (r.id=c.id AND r.source_hash=c.source_hash) WHERE c.id=$1`, [id]);
    return result.rows[0];
  }
  async getJob(id: string): Promise<JobRow | undefined> {
    // Invalid public IDs must preserve 410 behavior rather than trigger a UUID SQL error.
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return undefined;
    const result = await this.pool.query<JobRow>(`SELECT ${JOB_COLUMNS} FROM render_jobs WHERE id=$1 AND expires_at > ${CLOCK}`, [id]);
    return result.rows[0];
  }
  async enqueue(model: ModelDefinition, parameters: ParameterValues): Promise<RenderJob> {
    const entry = await this.getModel(model.id);
    if (!entry) throw new AppError(404, 'MODEL_NOT_FOUND', 'This model is not available.');
    if (entry.sourceHash !== sourceFingerprint(this.projectRoot, model)) {
      throw new AppError(409, 'MODEL_VERSION_CONFLICT', 'The model release changed. Please reload and retry.');
    }
    const normalized = JSON.stringify(Object.fromEntries(Object.entries(parameters).sort(([a], [b]) => a.localeCompare(b))));
    const cacheKey = createHash('sha256').update(`${model.id}:${entry.sourceHash}:${RENDERER_FINGERPRINT}:${normalized}`).digest('hex');
    return this.transaction(async client => {
      await client.query('SELECT pg_advisory_xact_lock($1)', [ADMISSION_LOCK]);
      const previous = (await client.query<JobRow>(`SELECT ${JOB_COLUMNS} FROM render_jobs WHERE cache_key=$1 FOR UPDATE`, [cacheKey])).rows[0];
      const now = (await client.query<{ now: number }>(`SELECT (${CLOCK})::float8 AS now`)).rows[0]?.now;
      if (now === undefined) throw new Error('Database clock unavailable.');
      if (previous && previous.expiresAt > now && previous.status !== 'failed' &&
        (previous.status !== 'succeeded' || (previous.objectKey && await this.objects.exists(this.objects.config.generatedBucket, previous.objectKey)))) return previous;
      if (previous) {
        if (previous.objectKey) await this.scheduleDeletion(client, previous.objectKey);
        await client.query('DELETE FROM render_jobs WHERE id=$1', [previous.id]);
      }
      const count = (await client.query<{ count: number }>(`SELECT count(*)::int AS count FROM render_jobs WHERE status='queued' AND expires_at > ${CLOCK}`)).rows[0]?.count ?? 0;
      if (count >= QUEUE_LIMIT) throw new AppError(429, 'QUEUE_FULL', 'The render queue is full. Wait a moment and try again.');
      const result = await client.query<JobRow>(`INSERT INTO render_jobs
        (id,cache_key,model_id,model_version,source_hash,renderer_fingerprint,parameters,status,created_at,expires_at,slot_count)
        VALUES($1,$2,$3,$4,$5,$6,$7,'queued',$8,$9,$10) RETURNING ${JOB_COLUMNS}`,
      [randomUUID(), cacheKey, model.id, model.version, entry.sourceHash, RENDERER_FINGERPRINT, parameters, now, now + CACHE_TTL_MS, model.derived(parameters).slotCount]);
      const job = result.rows[0];
      if (!job) throw new Error('Queue insertion failed.');
      return job;
    });
  }
  async claim(): Promise<RenderJob | undefined> {
    return this.transaction(async client => {
      const next = (await client.query<{ id: string }>(`SELECT id FROM render_jobs
        WHERE status='queued' AND expires_at > ${CLOCK} AND renderer_fingerprint=$1
        AND source_hash=ANY($2::text[]) ORDER BY created_at,id FOR UPDATE SKIP LOCKED LIMIT 1`,
      [RENDERER_FINGERPRINT, this.fingerprints])).rows[0];
      if (!next) return undefined;
      const result = await client.query<JobRow>(`UPDATE render_jobs SET status='running',attempts=attempts+1,
        lease_token=$2,lease_until=${CLOCK}+$3 WHERE id=$1 RETURNING ${JOB_COLUMNS}`, [next.id, randomUUID(), LEASE_MS]);
      return result.rows[0];
    });
  }
  async renew(id: string, token: string): Promise<boolean> {
    const result = await this.pool.query(`UPDATE render_jobs SET lease_until=${CLOCK}+$3 WHERE ${LIVE_CLAIM}`, [id, token, LEASE_MS]);
    return result.rowCount === 1;
  }
  private async scheduleDeletion(client: PoolClient, key: string): Promise<void> {
    await client.query('INSERT INTO object_deletions(object_key) VALUES($1) ON CONFLICT DO NOTHING', [key]);
  }
  async complete(id: string, token: string, metadata: MeshInfo, file: string, signal?: AbortSignal): Promise<boolean> {
    if (!await this.renew(id, token)) return false;
    const key = `renders/${id}/${token}.stl`;
    await this.objects.put(this.objects.config.generatedBucket, key, file, metadata.sha256, signal);
    signal?.throwIfAborted();
    // If this query errors, the grace-period orphan scan handles the uploaded object.
    const result = await this.pool.query(`UPDATE render_jobs SET status='succeeded',artifact=$3,object_key=$4,
      error=NULL,lease_token=NULL,lease_until=NULL WHERE ${LIVE_CLAIM}`, [id, token, metadata, key]);
    if (result.rowCount === 1) return true;
    await this.pool.query('INSERT INTO object_deletions(object_key) VALUES($1) ON CONFLICT DO NOTHING', [key]);
    return false;
  }
  async fail(id: string, token: string, error: ApiError): Promise<void> {
    await this.pool.query(`UPDATE render_jobs SET status='failed',error=$3,lease_token=NULL,lease_until=NULL WHERE ${LIVE_CLAIM}`, [id, token, error]);
  }
  async recover(): Promise<void> {
    await this.pool.query(`UPDATE render_jobs SET status=CASE WHEN attempts < 2 THEN 'queued' ELSE 'failed' END,
      error=CASE WHEN attempts < 2 THEN NULL ELSE $1::jsonb END,lease_token=NULL,lease_until=NULL
      WHERE status='running' AND lease_until <= ${CLOCK} AND expires_at > ${CLOCK}`,
    [{ code: 'WORKER_INTERRUPTED', message: 'Rendering was interrupted twice. Please try again.', issues: [] }]);
  }
  async cleanup(): Promise<void> {
    const client = await this.pool.connect();
    let locked = false;
    try {
      locked = (await client.query<{ locked: boolean }>('SELECT pg_try_advisory_lock($1) AS locked', [MAINTENANCE_LOCK])).rows[0]?.locked ?? false;
      if (!locked) return;
      await client.query(`WITH expired AS (DELETE FROM render_jobs WHERE expires_at <= ${CLOCK} RETURNING object_key)
        INSERT INTO object_deletions(object_key) SELECT object_key FROM expired WHERE object_key IS NOT NULL ON CONFLICT DO NOTHING`);
      await client.query(`DELETE FROM workers WHERE heartbeat_at <= ${CLOCK}-60000`);
      const now = await this.now();
      for await (const object of this.objects.generatedObjects()) {
        if (object.modified >= now - ORPHAN_GRACE_MS) continue;
        // A bounded attempt cannot newly publish a five-minute-old unreferenced upload.
        const reference = await client.query(`SELECT 1 FROM render_jobs WHERE object_key=$1 OR
          (status='running' AND lease_until > ${CLOCK} AND expires_at > ${CLOCK} AND
           'renders/' || id::text || '/' || lease_token::text || '.stl' = $1) LIMIT 1`, [object.key]);
        if (reference.rowCount === 0) await this.scheduleDeletion(client, object.key);
      }
      const deletions = await client.query<{ object_key: string }>(`SELECT object_key FROM object_deletions WHERE retry_after <= ${CLOCK} LIMIT 1000`);
      for (const row of deletions.rows) {
        try {
          await this.objects.remove(row.object_key);
          await client.query('DELETE FROM object_deletions WHERE object_key=$1', [row.object_key]);
        } catch {
          await client.query(`UPDATE object_deletions SET attempts=attempts+1,retry_after=${CLOCK}+60000 WHERE object_key=$1`, [row.object_key]);
        }
      }
    } finally {
      if (locked) await client.query('SELECT pg_advisory_unlock($1)', [MAINTENANCE_LOCK]).catch(() => undefined);
      client.release();
    }
  }
  async heartbeat(id: string): Promise<void> {
    await this.pool.query(`INSERT INTO workers(id,heartbeat_at) VALUES($1,${CLOCK}) ON CONFLICT(id) DO UPDATE SET heartbeat_at=excluded.heartbeat_at`, [id]);
  }
  async workerReady(): Promise<boolean> {
    return (await this.pool.query(`SELECT 1 FROM workers WHERE heartbeat_at > ${CLOCK}-$1 LIMIT 1`, [LEASE_MS])).rowCount === 1;
  }
  readReference(model: CatalogueEntry) { return this.objects.read(this.objects.config.catalogueBucket, model.referenceName); }
  async readArtifact(job: RenderJob) {
    const current = await this.getJob(job.id);
    if (!current?.objectKey || current.status !== 'succeeded') throw new AppError(410, 'RENDER_EXPIRED', 'This render is no longer available. Generate it again.');
    return this.objects.read(this.objects.config.generatedBucket, current.objectKey);
  }
  async metrics(): Promise<string> {
    const result = await this.pool.query<{ status: string; count: number }>(`SELECT status,count(*)::int AS count FROM render_jobs WHERE expires_at > ${CLOCK} GROUP BY status`);
    const age = (await this.pool.query<{ seconds: number }>(`SELECT COALESCE((${CLOCK}-min(created_at))/1000.0,0)::float8 AS seconds FROM render_jobs WHERE status='queued' AND expires_at > ${CLOCK}`)).rows[0]?.seconds ?? 0;
    const backlog = (await this.pool.query<{ count: number }>('SELECT count(*)::int AS count FROM object_deletions')).rows[0]?.count ?? 0;
    return ['# TYPE canfactory_jobs gauge', ...['queued', 'running', 'succeeded', 'failed'].map(status =>
      `canfactory_jobs{status="${status}"} ${result.rows.find(row => row.status === status)?.count ?? 0}`),
    '# TYPE canfactory_oldest_queued_seconds gauge', `canfactory_oldest_queued_seconds ${age}`,
    '# TYPE canfactory_object_deletions gauge', `canfactory_object_deletions ${backlog}`, ''].join('\n');
  }
  async close(): Promise<void> { await this.pool.end(); this.objects.close(); }
}
