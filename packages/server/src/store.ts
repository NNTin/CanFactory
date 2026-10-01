import { createHash, randomUUID } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { and, asc, count, eq, gt, lte } from 'drizzle-orm';
import {
  artifactFormat, findModel, linkedPartData, models, modelSourcePaths,
  type ApiError, type ModelDefinition, type ModelDetail, type ParameterValues, type Render,
} from '@canfactory/contracts';
import { CACHE_TTL_MS, LEASE_MS, QUEUE_LIMIT, RENDERER_FINGERPRINT } from './config.ts';
import { AppError } from './errors.ts';
import type { AssemblyInfo, MeshInfo } from './mesh.ts';
import { catalog, jobs, workers, type RenderJob } from './schema.ts';

export type ArtifactFormat = 'stl' | 'zip';

/** File operations are isolated so a future object store can replace the local volume. */
export class ArtifactStore {
  readonly outputDir: string;
  readonly temporaryDir: string;
  readonly catalogDir: string;
  constructor(readonly dataDir: string) {
    this.outputDir = join(dataDir, 'artifacts'); this.temporaryDir = join(dataDir, 'tmp'); this.catalogDir = join(dataDir, 'catalog');
    for (const dir of [this.outputDir, this.temporaryDir, this.catalogDir]) mkdirSync(dir, { recursive: true });
  }
  /** IDs are generated UUIDs; callers must not pass client-controlled filesystem paths. */
  path(id: string, format: ArtifactFormat = 'stl'): string { return join(this.outputDir, `${id}.${format}`); }
  /** Removes whichever artifact extension this job produced; a missing file of either format is a silent no-op. */
  remove(id: string): void { rmSync(this.path(id, 'stl'), { force: true }); rmSync(this.path(id, 'zip'), { force: true }); }
}

/** Persistent queue contract. Claims carry fencing tokens; stale workers cannot publish results. */
export interface RenderQueue {
  claim(): RenderJob | undefined;
  renew(id: string, token: string): boolean;
  complete(id: string, token: string, metadata: MeshInfo | AssemblyInfo, temporaryFile: string, format?: ArtifactFormat): boolean;
  fail(id: string, token: string, error: ApiError): void;
}

/** Hash all inputs that determine model behavior, not only the user-visible version (all SCAD sources, for an assembly). */
export function sourceFingerprint(root: string, model: ModelDefinition): string {
  const hash = createHash('sha256');
  for (const relative of [...modelSourcePaths(model), ...model.assetPaths ?? []]) hash.update(readFileSync(resolve(root, relative)));
  return hash.update(JSON.stringify({ schema: model.parameterSchema, mapping: model.scadMapping, parts: model.parts?.map(part => ({ id: part.id, mapping: part.scadMapping, constants: part.scadConstants, separateBodies: part.separateBodies === true, partDefines: part.partDefines })), partDefines: model.partDefines, linkedParts: linkedPartData(model), version: model.version })).digest('hex');
}

export class Store implements RenderQueue {
  readonly sqlite: Database.Database;
  readonly db: ReturnType<typeof drizzle>;
  readonly artifacts: ArtifactStore;
  constructor(readonly dataDir: string, readonly projectRoot: string, readonly now: () => number = Date.now) {
    mkdirSync(dataDir, { recursive: true });
    this.sqlite = new Database(join(dataDir, 'catalog.sqlite'));
    this.sqlite.pragma('journal_mode = WAL'); this.sqlite.pragma('foreign_keys = ON'); this.sqlite.pragma('busy_timeout = 5000');
    this.db = drizzle(this.sqlite);
    this.artifacts = new ArtifactStore(dataDir);
  }
  /** API startup owns migrations; the worker starts after API readiness. */
  migrate(): void {
    this.sqlite.exec('CREATE TABLE IF NOT EXISTS migrations (name TEXT PRIMARY KEY NOT NULL)');
    const folder = fileURLToPath(new URL('../migrations/', import.meta.url));
    const files = readdirSync(folder).filter(name => name.endsWith('.sql')).sort();
    this.sqlite.transaction(() => {
      for (const name of files) {
        const applied: unknown = this.sqlite.prepare('SELECT name FROM migrations WHERE name = ?').get(name);
        if (applied !== undefined) continue;
        this.sqlite.exec(readFileSync(join(folder, name), 'utf8'));
        this.sqlite.prepare('INSERT INTO migrations(name) VALUES (?)').run(name);
      }
    }).immediate();
  }
  /** Idempotently synchronize trusted model definitions and immutable reference bytes. */
  seed(): void {
    for (const model of models) {
      const sourceHash = sourceFingerprint(this.projectRoot, model);
      let referenceName = '';
      if (model.referencePath) {
        referenceName = `${model.id}-${model.version}.stl`;
        const target = join(this.artifacts.catalogDir, referenceName);
        const temporary = `${target}.${randomUUID()}.tmp`;
        copyFileSync(resolve(this.projectRoot, model.referencePath), temporary);
        renameSync(temporary, target);
      }
      const detail: ModelDetail = {
        id: model.id, version: model.version, title: model.title, description: model.description,
        attribution: model.attribution, license: model.license, licenseUrl: model.licenseUrl,
        printNotes: model.printNotes,
        controls: model.controls, defaults: model.defaults, parameterSchema: { ...model.parameterSchema },
        artifactFormat: artifactFormat(model), customizable: model.controls.length > 0,
        ...(referenceName ? { referenceUrl: `/api/v1/models/${model.id}/reference.stl` } : {}),
        ...(model.parts ? { parts: model.parts.map(part => ({ id: part.id, title: part.title })) } : {}),
        ...(model.assembly ? { assembly: model.assembly } : {}),
      };
      this.db.insert(catalog).values({ id: model.id, version: model.version, detail, sourceHash, referenceName })
        .onConflictDoUpdate({ target: catalog.id, set: { version: model.version, detail, sourceHash, referenceName } }).run();
    }
  }
  listModels(): ModelDetail[] { return this.db.select().from(catalog).all().map(row => row.detail); }
  getModel(id: string) { return this.db.select().from(catalog).where(eq(catalog.id, id)).get(); }
  getJob(id: string): RenderJob | undefined { return this.db.select().from(jobs).where(eq(jobs.id, id)).get(); }

  /** Reuse active/successful jobs; failed requests can be explicitly retried. */
  enqueue(model: ModelDefinition, parameters: ParameterValues): RenderJob {
    const entry = this.getModel(model.id);
    if (!entry) throw new AppError(404, 'MODEL_NOT_FOUND', 'This model is not available.');
    const normalized = JSON.stringify(Object.fromEntries(Object.entries(parameters).sort(([a], [b]) => a.localeCompare(b))));
    const cacheKey = createHash('sha256').update(`${model.id}:${entry.sourceHash}:${RENDERER_FINGERPRINT}:${normalized}`).digest('hex');
    return this.db.transaction(tx => {
      const previous = tx.select().from(jobs).where(eq(jobs.cacheKey, cacheKey)).get();
      if (previous && previous.expiresAt > this.now() && previous.status !== 'failed' &&
          (previous.status !== 'succeeded' || existsSync(this.artifacts.path(previous.id, artifactFormat(model))))) return previous;
      if (previous) {
        tx.delete(jobs).where(eq(jobs.id, previous.id)).run();
        this.artifacts.remove(previous.id);
      }
      const pending = tx.select({ count: count() }).from(jobs).where(and(eq(jobs.status, 'queued'), gt(jobs.expiresAt, this.now()))).get()?.count ?? 0;
      if (pending >= QUEUE_LIMIT) throw new AppError(429, 'QUEUE_FULL', 'The render queue is full. Wait a moment and try again.');
      const now = this.now();
      return tx.insert(jobs).values({
        id: randomUUID(), cacheKey, modelId: model.id, modelVersion: model.version, sourceHash: entry.sourceHash,
        rendererFingerprint: RENDERER_FINGERPRINT, parameters, status: 'queued', createdAt: now, expiresAt: now + CACHE_TTL_MS,
        slotCount: model.derived(parameters).slotCount,
      }).returning().get();
    }, { behavior: 'immediate' });
  }
  /** Atomically claims the oldest unexpired job. */
  claim(): RenderJob | undefined {
    return this.db.transaction(tx => {
      const job = tx.select().from(jobs).where(and(eq(jobs.status, 'queued'), gt(jobs.expiresAt, this.now()))).orderBy(asc(jobs.createdAt)).limit(1).get();
      if (!job) return undefined;
      return tx.update(jobs).set({ status: 'running', leaseToken: randomUUID(), leaseUntil: this.now() + LEASE_MS, attempts: job.attempts + 1 })
        .where(eq(jobs.id, job.id)).returning().get();
    }, { behavior: 'immediate' });
  }
  renew(id: string, token: string): boolean {
    return this.db.update(jobs).set({ leaseUntil: this.now() + LEASE_MS })
      .where(and(eq(jobs.id, id), eq(jobs.status, 'running'), eq(jobs.leaseToken, token), gt(jobs.leaseUntil, this.now()), gt(jobs.expiresAt, this.now()))).run().changes === 1;
  }
  complete(id: string, token: string, metadata: MeshInfo | AssemblyInfo, temporaryFile: string, format: ArtifactFormat = 'stl'): boolean {
    return this.db.transaction(tx => {
      const job = tx.select().from(jobs).where(and(eq(jobs.id, id), eq(jobs.status, 'running'), eq(jobs.leaseToken, token), gt(jobs.leaseUntil, this.now()), gt(jobs.expiresAt, this.now()))).get();
      if (!job) return false;
      renameSync(temporaryFile, this.artifacts.path(id, format));
      tx.update(jobs).set({ status: 'succeeded', artifact: metadata, error: null, leaseToken: null, leaseUntil: null }).where(eq(jobs.id, id)).run();
      return true;
    }, { behavior: 'immediate' });
  }
  fail(id: string, token: string, error: ApiError): void {
    this.db.update(jobs).set({ status: 'failed', error, leaseToken: null, leaseUntil: null })
      .where(and(eq(jobs.id, id), eq(jobs.status, 'running'), eq(jobs.leaseToken, token))).run();
  }
  recover(): void {
    this.db.transaction(tx => {
      const abandoned = tx.select().from(jobs).where(and(eq(jobs.status, 'running'), lte(jobs.leaseUntil, this.now()))).all();
      for (const job of abandoned) {
        const retry = job.attempts < 2;
        tx.update(jobs).set({ status: retry ? 'queued' : 'failed', leaseToken: null, leaseUntil: null,
          error: retry ? null : { code: 'WORKER_INTERRUPTED', message: 'Rendering was interrupted twice. Please try again.', issues: [] },
        }).where(eq(jobs.id, job.id)).run();
      }
    }, { behavior: 'immediate' });
  }
  /** Expiration is enforced when reading; cleanup also removes orphaned output after crashes. */
  cleanup(): void {
    this.db.transaction(tx => {
      const expired = tx.delete(jobs).where(lte(jobs.expiresAt, this.now())).returning({ id: jobs.id }).all();
      for (const row of expired) this.artifacts.remove(row.id);
      tx.delete(workers).where(lte(workers.heartbeatAt, this.now() - 60_000)).run();
    }, { behavior: 'immediate' });
    const live = new Set(this.db.select({ id: jobs.id }).from(jobs).all().map(row => row.id));
    for (const filename of readdirSync(this.artifacts.outputDir)) {
      const extension = /\.(stl|zip)$/.exec(filename)?.[0];
      if (extension && !live.has(filename.slice(0, -extension.length))) rmSync(join(this.artifacts.outputDir, filename), { force: true });
    }
    for (const filename of readdirSync(this.artifacts.temporaryDir)) {
      const path = join(this.artifacts.temporaryDir, filename);
      if (statSync(path).mtimeMs < this.now() - 180_000) rmSync(path, { recursive: true, force: true });
    }
  }
  heartbeat(id: string): void {
    this.db.insert(workers).values({ id, heartbeatAt: this.now() }).onConflictDoUpdate({ target: workers.id, set: { heartbeatAt: this.now() } }).run();
  }
  workerReady(): boolean { return this.db.select().from(workers).where(gt(workers.heartbeatAt, this.now() - LEASE_MS)).limit(1).get() !== undefined; }
  close(): void { this.sqlite.close(); }
}

/** Sanitized public view of a job; internal paths, parameters, and leases stay private. */
export function publicRender(job: RenderJob): Render {
  const model = findModel(job.modelId);
  const suffix = model && artifactFormat(model) === 'zip' ? 'zip' : 'stl';
  return {
    id: job.id, modelId: job.modelId, modelVersion: job.modelVersion, status: job.status,
    createdAt: job.createdAt, expiresAt: job.expiresAt, slotCount: job.slotCount,
    artifact: job.status === 'succeeded' && job.artifact ? { ...job.artifact, url: `/api/v1/renders/${job.id}/${suffix}` } : null,
    error: job.error,
  };
}

export const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
