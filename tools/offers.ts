import { ingestAwin, LocalStorage, runtimeStorage } from '@canfactory/server';

/**
 * The offers service's job (the `offers` CronJob; `npm run offers:ingest` locally): store the Awin feed rows of the curated
 * offers (packages/contracts/src/parts/offers.ts). Needs AWIN_DATAFEED_KEY, Awin's product feed key (not its API token).
 * See docs/affiliate-offers.md.
 */
const command = process.argv[2];
if (command !== 'ingest-awin') throw new Error('Usage: offers.ts ingest-awin [--now]');
const datafeedKey = process.env['AWIN_DATAFEED_KEY'];
if (!datafeedKey) throw new Error('Required configuration AWIN_DATAFEED_KEY is missing.');
const store = runtimeStorage('maintenance');
try {
  // The local SQLite store has no release Job: migrate it here (idempotent). PostgreSQL is migrated by the release.
  if (store instanceof LocalStorage) await store.migrate();
  const result = await ingestAwin({ store, datafeedKey, jitter: !process.argv.includes('--now'), log: message => process.stdout.write(`${message}\n`) });
  process.stdout.write(`Checked ${result.checked} feeds: ${result.downloaded} downloaded (${result.rows} curated products), ${result.unchanged} unchanged, ${result.missing.length} curated products missing.\n`);
} finally { await store.close(); }
