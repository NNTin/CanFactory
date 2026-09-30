import { randomUUID } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';
import { pino } from 'pino';
import { runtimeStorage, type RenderJob } from '@canfactory/server';
import { processJob } from './process.ts';

const store = runtimeStorage('worker');
const log = pino();
const id = randomUUID();
const shutdown = new AbortController();
let current: { job: RenderJob; controller: AbortController } | undefined;
for (const signal of ['SIGINT', 'SIGTERM'] as const) process.once(signal, () => { shutdown.abort(); current?.controller.abort(); });
// A bug outside a job's own error handling must not leave a zombie worker holding a lease: log it with the job in hand, abort
// that job (lease recovery requeues it once, then fails it) and exit non-zero, so that the orchestrator restarts the worker.
const fatal = (kind: string) => (error: unknown) => {
  log.fatal({ err: error, jobId: current?.job.id, modelId: current?.job.modelId }, `Worker ${kind}; restarting`);
  current?.controller.abort(); shutdown.abort();
  process.exitCode = 1;
  setTimeout(() => process.exit(1), 1000).unref();
};
process.on('uncaughtException', fatal('crashed'));
process.on('unhandledRejection', fatal('hit an unhandled rejection'));
let beating = false;
const isStopping = () => shutdown.signal.aborted;
const heartbeatRunning = () => beating;
const beat = async () => {
  if (beating) return;
  beating = true;
  try {
    await store.heartbeat(id);
    if (current?.job.leaseToken && !await store.renew(current.job.id, current.job.leaseToken)) current.controller.abort();
  } catch (error) {
    log.error({ err: error }, 'Worker storage heartbeat failed');
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
    catch (error) {
      log.error({ err: error }, 'Queue unavailable; retrying');
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
    try { await processJob(store, job, controller.signal, log); }
    finally { current = undefined; }
  }
} finally {
  clearInterval(heartbeat);
  while (heartbeatRunning()) await delay(10);
  await store.close();
}
