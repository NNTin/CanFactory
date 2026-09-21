import { config, LocalStorage, runtimeStorage } from '@canfactory/server';
import Fastify from 'fastify';
import { createApp } from './app.ts';

const settings = config();
const store = runtimeStorage('api');
// Legacy Compose retains its startup contract; PostgreSQL initialization is a release Job.
if (store instanceof LocalStorage) {
  await store.migrate(); await store.seed(); await store.cleanup(); await store.recover();
}
const app = await createApp(store, true);
let maintaining = false;
const maintain = async () => {
  if (maintaining) return;
  maintaining = true;
  try { await store.recover(); await store.cleanup(); }
  catch { app.log.error('Queue maintenance failed'); }
  finally { maintaining = false; }
};
const maintenance = store instanceof LocalStorage ? setInterval(() => { void maintain(); }, 10_000) : undefined;
maintenance?.unref();
// Probes/metrics use a separate port, never the public /api/* route.
const internal = Fastify();
internal.get('/live', () => ({ live: true }));
internal.get('/ready', async (_request, reply) => {
  try { await store.ready(); return { ready: true }; }
  catch { return reply.code(503).send({ ready: false }); }
});
internal.get('/metrics', async (_request, reply) => reply.type('text/plain; version=0.0.4').send(await store.metrics()));
app.addHook('onClose', async () => {
  if (maintenance) clearInterval(maintenance);
  await internal.close(); await store.close();
});
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => { void app.close().catch((error: unknown) => { app.log.error(error); process.exitCode = 1; }); });
}
await app.listen({ host: settings.host, port: settings.port });
await internal.listen({ host: settings.host, port: Number(process.env['METRICS_PORT'] ?? 3002) });
