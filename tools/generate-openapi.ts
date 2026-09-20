import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import openapiTS, { astToString } from 'openapi-typescript';
import { createApp } from '../apps/api/src/app.ts';

const app = await createApp();
await app.ready();
const document = JSON.stringify(app.swagger(), null, 2) + '\n';
const schema = '// Generated from docs/openapi.json. Run npm run contracts:generate.\n' + astToString(await openapiTS(document));
await app.close();
for (const [path, content] of [['../docs/openapi.json', document], ['../packages/client/src/schema.d.ts', schema]] as const) {
  const target = fileURLToPath(new URL(path, import.meta.url));
  if (process.argv.includes('--check')) {
    const existing = await readFile(target, 'utf8').catch(() => '');
    if (content !== existing) throw new Error(`Generated contract is stale: ${path}. Run npm run contracts:generate.`);
  } else {
    await mkdir(fileURLToPath(new URL('.', new URL(path, import.meta.url))), { recursive: true });
    await writeFile(target, content);
  }
}
