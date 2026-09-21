import { runtimeStorage } from '@canfactory/server';

const command = process.argv[2];
if (command !== 'migrate' && command !== 'seed' && command !== 'cleanup' && command !== 'release') {
  throw new Error('Usage: maintenance.ts migrate|seed|cleanup|release');
}
const store = runtimeStorage('maintenance');
try {
  if (command === 'migrate' || command === 'release') await store.migrate();
  if (command === 'seed' || command === 'release') await store.seed();
  if (command === 'cleanup') { await store.recover(); await store.cleanup(); }
  process.stdout.write(`Completed ${command}.\n`);
} finally { await store.close(); }
