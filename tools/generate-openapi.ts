import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import openapiTS, { astToString } from 'openapi-typescript';
import { wireGuideDesignJsonSchema } from '@canfactory/contracts';
import { createApp } from '../apps/api/src/app.ts';

const app = await createApp();
await app.ready();
const document = JSON.stringify(app.swagger(), null, 2) + '\n';
const schema = '// Generated from docs/openapi.json. Run npm run contracts:generate.\n' + astToString(await openapiTS(document));
await app.close();
// The wire-guide design (docs/wire-guide.md) as a standalone JSON Schema, for KiPrint, which cannot import @canfactory/contracts.
const wireGuide = JSON.stringify(wireGuideDesignJsonSchema(), null, 2) + '\n';
for (const [path, content] of [['../docs/openapi.json', document], ['../packages/client/src/schema.d.ts', schema], ['../docs/schemas/wire-guide-design.schema.json', wireGuide]] as const) {
  const target = fileURLToPath(new URL(path, import.meta.url));
  if (process.argv.includes('--check')) {
    const existing = await readFile(target, 'utf8').catch(() => '');
    if (content !== existing) throw new Error(`Generated contract is stale: ${path}. Run npm run contracts:generate.`);
  } else {
    await mkdir(fileURLToPath(new URL('.', new URL(path, import.meta.url))), { recursive: true });
    await writeFile(target, content);
  }
}
