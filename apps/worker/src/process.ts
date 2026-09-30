import { asyncStorage, type RenderJob, type Storage, type Store } from '@canfactory/server';
import { classifyRenderError, renderJob, runOpenScad, type OpenScadRunner } from './render.ts';

/** The part of a pino logger the worker uses; tests pass a recorder. */
export interface JobLogger {
  info(fields: object, message: string): void;
  warn(fields: object, message: string): void;
  error(fields: object, message: string): void;
}

/** What became of one claimed job: rendered and published, rendered but its lease lost, failed and recorded, or aborted. */
export type JobOutcome = 'published' | 'superseded' | 'failed' | 'aborted';

/**
 * Render one claimed job, and never throw: whatever goes wrong is classified, logged loudly with everything needed to reproduce it
 * (model, version, parameters, the failure's detail and stack), and recorded on the job for the person waiting on it. Only a
 * shutdown or lost lease (`signal`) leaves the job alone, for lease recovery to requeue.
 */
export async function processJob(storage: Store | Storage, job: RenderJob, signal: AbortSignal, log: JobLogger, run: OpenScadRunner = runOpenScad): Promise<JobOutcome> {
  const store = asyncStorage(storage);
  const started = Date.now();
  const context = { jobId: job.id, modelId: job.modelId, modelVersion: job.modelVersion };
  log.info({ ...context, attempt: job.attempts }, 'Render started');
  try {
    const published = await renderJob(store, job, signal, run, repair =>
      log.warn({ ...context, part: repair.part, repaired: repair.repaired, parameters: job.parameters }, 'Render needed float32 sliver repairs; the model has fragile geometry'));
    log.info({ ...context, durationMs: Date.now() - started, published }, 'Render finished');
    return published ? 'published' : 'superseded';
  } catch (error) {
    if (signal.aborted) {
      log.warn({ ...context, durationMs: Date.now() - started }, 'Render aborted; lease recovery will retry');
      return 'aborted';
    }
    const failure = classifyRenderError(error);
    log.error({ ...context, durationMs: Date.now() - started, code: failure.code, retryable: failure.retryable, detail: failure.detail, parameters: job.parameters, err: failure.cause ?? failure },
      `Render failed: ${failure.code}`);
    if (!job.leaseToken) return 'failed';
    try { await store.fail(job.id, job.leaseToken, failure.envelope(job.id)); }
    catch (recordError) { log.error({ ...context, err: recordError }, 'Could not record render failure; lease recovery will retry'); }
    return 'failed';
  }
}
