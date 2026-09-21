import { config, Store } from '@canfactory/server';
import { createApp } from './app.ts';

const settings = config();
const store = new Store(settings.dataDir, settings.projectRoot);
store.migrate(); store.seed(); store.cleanup(); store.recover();
const app = await createApp(store, true);
const maintenance = setInterval(() => {
  try { store.recover(); store.cleanup(); }
  catch (error) { app.log.error({ err: error }, 'Queue maintenance failed'); }
}, 10_000);
maintenance.unref();
app.addHook('onClose', () => { clearInterval(maintenance); store.close(); });
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => { void app.close().catch((error: unknown) => { app.log.error(error); process.exitCode = 1; }); });
}
await app.listen({ host: settings.host, port: settings.port });
