import { randomUUID } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { setTimeout as delay } from 'node:timers/promises';
import { pino } from 'pino';
import { config, Store, type RenderJob } from '@canfactory/server';
import { renderJob } from './render.ts';

const settings = config();
const store = new Store(settings.dataDir, settings.projectRoot);
const log = pino();
const id = randomUUID();
const shutdown = new AbortController();
let current: { job: RenderJob; controller: AbortController } | undefined;
for (const signal of ['SIGINT', 'SIGTERM'] as const) process.once(signal, () => { shutdown.abort(); current?.controller.abort(); });

const beat = () => {
  try {
    store.heartbeat(id);
    writeFileSync('/tmp/canfactory-worker-health', String(Date.now()));
    if (current?.job.leaseToken && !store.renew(current.job.id, current.job.leaseToken)) current.controller.abort();
  } catch (error) {
    log.error({ err: error }, 'Worker heartbeat failed');
    current?.controller.abort();
  }
};
beat();
const heartbeat = setInterval(beat, 5000);
try {
  while (!shutdown.signal.aborted) {
    store.recover();
    const job = store.claim();
    if (!job) {
      await delay(250, undefined, { signal: shutdown.signal }).catch(() => undefined);
      continue;
    }
    const controller = new AbortController();
    current = { job, controller };
    const started = Date.now();
    log.info({ jobId: job.id, modelId: job.modelId, attempt: job.attempts }, 'Render started');
    try {
      const published = await renderJob(store, job, controller.signal);
      log.info({ jobId: job.id, durationMs: Date.now() - started, published }, 'Render finished');
    } catch (error) {
      if (!controller.signal.aborted && job.leaseToken) {
        store.fail(job.id, job.leaseToken, { code: 'RENDER_FAILED', message: error instanceof Error ? error.message : 'Rendering failed. Please try again.', issues: [] });
        log.error({ err: error, jobId: job.id, durationMs: Date.now() - started }, 'Render failed');
      }
    } finally { current = undefined; }
  }
} finally { clearInterval(heartbeat); store.close(); }
