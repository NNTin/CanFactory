import { randomUUID } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';
import { pino } from 'pino';
import { runtimeStorage, type RenderJob } from '@canfactory/server';
import { renderJob } from './render.ts';

const store = runtimeStorage('worker');
const log = pino();
const id = randomUUID();
const shutdown = new AbortController();
let current: { job: RenderJob; controller: AbortController } | undefined;
for (const signal of ['SIGINT', 'SIGTERM'] as const) process.once(signal, () => { shutdown.abort(); current?.controller.abort(); });
let beating = false;
const isStopping = () => shutdown.signal.aborted;
const heartbeatRunning = () => beating;
const beat = async () => {
  if (beating) return;
  beating = true;
  try {
    await store.heartbeat(id);
    if (current?.job.leaseToken && !await store.renew(current.job.id, current.job.leaseToken)) current.controller.abort();
  } catch {
    log.error('Worker storage heartbeat failed');
    current?.controller.abort();
  } finally {
    // Liveness tracks the event loop, not temporary storage availability.
    await writeFile('/tmp/canfactory-worker-health', String(Date.now())).catch(() => undefined);
    beating = false;
  }
};
await beat();
const heartbeat = setInterval(() => { void beat(); }, 5000);
try {
  while (!isStopping()) {
    let job: RenderJob | undefined;
    try { await store.recover(); job = await store.claim(); }
    catch {
      log.error('Queue unavailable; retrying');
      await delay(2000, undefined, { signal: shutdown.signal }).catch(() => undefined);
      continue;
    }
    if (!job) {
      await delay(250, undefined, { signal: shutdown.signal }).catch(() => undefined);
      continue;
    }
    const controller = new AbortController();
    current = { job, controller };
    if (isStopping()) controller.abort();
    const started = Date.now();
    log.info({ jobId: job.id, modelId: job.modelId, attempt: job.attempts }, 'Render started');
    try {
      const published = await renderJob(store, job, controller.signal);
      log.info({ jobId: job.id, durationMs: Date.now() - started, published }, 'Render finished');
    } catch {
      if (!controller.signal.aborted && job.leaseToken) {
        await store.fail(job.id, job.leaseToken, { code: 'RENDER_FAILED', message: 'Rendering failed. Please try again.', issues: [] })
          .catch(() => { log.error('Could not record render failure; lease recovery will retry'); });
        log.error({ jobId: job.id, durationMs: Date.now() - started }, 'Render failed');
      }
    } finally { current = undefined; }
  }
} finally {
  clearInterval(heartbeat);
  while (heartbeatRunning()) await delay(10);
  await store.close();
}
