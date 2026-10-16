import { runtimeStorage } from '@canfactory/server';

const commands = ['buckets', 'migrate', 'seed', 'cleanup', 'release'];
const requested = process.argv.slice(2);
if (requested.length === 0 || requested.some(command => !commands.includes(command))) {
  throw new Error('Usage: maintenance.ts buckets|migrate|seed|cleanup|release ...');
}
const store = runtimeStorage('maintenance');
try {
  for (const command of requested) {
    // Production's buckets are provisioned with Garage; Compose creates its own with the default key.
    if (command === 'buckets') await store.objects.createBuckets();
    if (command === 'migrate' || command === 'release') await store.migrate();
    if (command === 'seed' || command === 'release') await store.seed();
    if (command === 'cleanup') { await store.recover(); await store.cleanup(); }
    process.stdout.write(`Completed ${command}.\n`);
  }
} finally { await store.close(); }
