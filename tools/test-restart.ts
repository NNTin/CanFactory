import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { setTimeout as delay } from 'node:timers/promises';
import { createHash } from 'node:crypto';
import { Value } from 'typebox/value';
import { fruitFlyTrap, ModelDetailSchema, RenderSchema, type Render } from '@canfactory/contracts';

const base = process.env['BASE_URL'] ?? 'http://127.0.0.1:5173';
const exec = promisify(execFile);
async function json(path: string, init?: RequestInit): Promise<unknown> {
  const response = await fetch(`${base}${path}`, init);
  assert.ok(response.ok, `${path} returned ${response.status}`);
  return response.json();
}
async function waitFor(id: string, terminal: boolean): Promise<Render> {
  const deadline = Date.now() + 180000;
  while (Date.now() < deadline) {
    const result = Value.Parse(RenderSchema, await json(`/api/v1/renders/${id}`));
    assert.notEqual(result.status, 'failed', result.error?.message);
    if (terminal ? result.status === 'succeeded' : result.status === 'running') return result;
    await delay(250);
  }
  throw new Error('Timed out waiting for renderer recovery.');
}

const original = Value.Parse(ModelDetailSchema, await json('/api/v1/models/fruit-fly-trap'));
const reference = await fetch(`${base}${original.referenceUrl}`).then(response => response.arrayBuffer());
const referenceHash = createHash('sha256').update(Buffer.from(reference)).digest('hex');
const nonce = (Date.now() % 700) / 10;
const render = Value.Parse(RenderSchema, await json('/api/v1/renders', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ modelId: fruitFlyTrap.id, modelVersion: fruitFlyTrap.version,
    parameters: { ...fruitFlyTrap.defaults, trapHeight: 120 + nonce, trapDiameter: 100 } }),
}));
await waitFor(render.id, false);
await exec('docker', ['compose', 'restart', 'worker']);
const recovered = await waitFor(render.id, true);
assert.ok(recovered.artifact);
console.log('PASS interrupted render recovered after worker restart');

await exec('docker', ['compose', 'restart', 'api', 'worker']);
await exec('docker', ['compose', 'up', '-d', '--wait']);
const restored = Value.Parse(ModelDetailSchema, await json('/api/v1/models/fruit-fly-trap'));
assert.deepEqual(restored, original);
const restoredReference = await fetch(`${base}${restored.referenceUrl}`).then(response => response.arrayBuffer());
assert.equal(createHash('sha256').update(Buffer.from(restoredReference)).digest('hex'), referenceHash);
const cached = Value.Parse(RenderSchema, await json(`/api/v1/renders/${render.id}`));
assert.equal(cached.status, 'succeeded');
const artifact = await fetch(`${base}${recovered.artifact.url}`).then(response => response.arrayBuffer());
assert.equal(createHash('sha256').update(Buffer.from(artifact)).digest('hex'), recovered.artifact.sha256);
console.log('PASS catalogue, original reference, and unexpired artifacts survived API/worker restart');
