import { config, runtimeStorage } from '@canfactory/server';
import Fastify from 'fastify';
import { createApp } from './app.ts';

const settings = config();
const store = runtimeStorage('api');
// Migrations and seeding are the release job's; queue cleanup is the maintenance job's (Compose and the chart run both).
const app = await createApp(store, true);
// Request errors are answered by the error handler; anything escaping it is a bug. Log it where operators look and exit non-zero,
// so that the orchestrator replaces this process instead of leaving it in an unknown state.
for (const [event, kind] of [['uncaughtException', 'crashed'], ['unhandledRejection', 'hit an unhandled rejection']] as const) {
  process.on(event, (error: unknown) => {
    app.log.fatal({ err: error }, `API ${kind}; restarting`);
    process.exitCode = 1;
    void app.close().finally(() => process.exit(1));
    setTimeout(() => process.exit(1), 5000).unref();
  });
}
// Probes/metrics use a separate port, never the public /api/* route.
const internal = Fastify();
internal.get('/live', () => ({ live: true }));
internal.get('/ready', async (_request, reply) => {
  try { await store.ready(); return { ready: true }; }
  catch { return reply.code(503).send({ ready: false }); }
});
internal.get('/metrics', async (_request, reply) => reply.type('text/plain; version=0.0.4').send(await store.metrics()));
app.addHook('onClose', async () => { await internal.close(); await store.close(); });
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => { void app.close().catch((error: unknown) => { app.log.error(error); process.exitCode = 1; }); });
}
await app.listen({ host: settings.host, port: settings.port });
await internal.listen({ host: settings.host, port: Number(process.env['METRICS_PORT'] ?? 3002) });
