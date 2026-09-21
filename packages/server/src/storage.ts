import { createReadStream, existsSync } from 'node:fs';
import { join } from 'node:path';
import type { Readable } from 'node:stream';
import type { ApiError, ModelDefinition, ModelDetail, ParameterValues } from '@canfactory/contracts';
import { AppError } from './errors.ts';
import type { MeshInfo } from './mesh.ts';
import type { RenderJob } from './schema.ts';
import { Store } from './store.ts';

export interface CatalogueEntry {
  id: string;
  version: string;
  sourceHash: string;
  referenceName: string;
  detail: ModelDetail;
}

/** All remote operations are awaited; only render scratch has a local path. */
export interface Storage {
  readonly projectRoot: string;
  readonly temporaryDir: string;
  now(): Promise<number>;
  migrate(): Promise<void>;
  seed(): Promise<void>;
  ready(): Promise<void>;
  listModels(): Promise<ModelDetail[]>;
  getModel(id: string): Promise<CatalogueEntry | undefined>;
  getJob(id: string): Promise<RenderJob | undefined>;
  enqueue(model: ModelDefinition, parameters: ParameterValues): Promise<RenderJob>;
  claim(): Promise<RenderJob | undefined>;
  renew(id: string, token: string): Promise<boolean>;
  complete(id: string, token: string, metadata: MeshInfo, temporaryFile: string, signal?: AbortSignal): Promise<boolean>;
  fail(id: string, token: string, error: ApiError): Promise<void>;
  recover(): Promise<void>;
  cleanup(): Promise<void>;
  heartbeat(id: string): Promise<void>;
  workerReady(): Promise<boolean>;
  readReference(model: CatalogueEntry): Promise<Readable>;
  readArtifact(job: RenderJob): Promise<Readable>;
  metrics(): Promise<string>;
  close(): Promise<void>;
}

/** Keep the original Compose/test adapter available during the migration. */
export class LocalStorage implements Storage {
  readonly projectRoot: string;
  readonly temporaryDir: string;
  constructor(readonly local: Store) {
    this.projectRoot = local.projectRoot;
    this.temporaryDir = local.artifacts.temporaryDir;
  }
  now() { return Promise.resolve(this.local.now()); }
  migrate() { this.local.migrate(); return Promise.resolve(); }
  seed() { this.local.seed(); return Promise.resolve(); }
  ready() { this.local.listModels(); return Promise.resolve(); }
  listModels() { return Promise.resolve(this.local.listModels()); }
  getModel(id: string) { return Promise.resolve(this.local.getModel(id)); }
  getJob(id: string) { return Promise.resolve(this.local.getJob(id)); }
  enqueue(model: ModelDefinition, parameters: ParameterValues) { return Promise.resolve(this.local.enqueue(model, parameters)); }
  claim() { return Promise.resolve(this.local.claim()); }
  renew(id: string, token: string) { return Promise.resolve(this.local.renew(id, token)); }
  complete(id: string, token: string, metadata: MeshInfo, file: string, signal?: AbortSignal) {
    signal?.throwIfAborted();
    return Promise.resolve(this.local.complete(id, token, metadata, file));
  }
  fail(id: string, token: string, error: ApiError) { this.local.fail(id, token, error); return Promise.resolve(); }
  recover() { this.local.recover(); return Promise.resolve(); }
  cleanup() { this.local.cleanup(); return Promise.resolve(); }
  heartbeat(id: string) { this.local.heartbeat(id); return Promise.resolve(); }
  workerReady() { return Promise.resolve(this.local.workerReady()); }
  readReference(model: CatalogueEntry) { return Promise.resolve(createReadStream(join(this.local.artifacts.catalogDir, model.referenceName))); }
  readArtifact(job: RenderJob) {
    const path = this.local.artifacts.path(job.id);
    if (!existsSync(path)) throw new AppError(410, 'RENDER_EXPIRED', 'The generated file is no longer available. Generate it again.');
    return Promise.resolve(createReadStream(path));
  }
  metrics() { return Promise.resolve(''); }
  close() { this.local.close(); return Promise.resolve(); }
}

export function asyncStorage(store: Store | Storage): Storage {
  return store instanceof Store ? new LocalStorage(store) : store;
}
