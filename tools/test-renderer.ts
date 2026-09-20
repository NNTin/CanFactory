import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { fruitFlyTrap, validateParameters, type ParameterValues } from '@canfactory/contracts';
import { inspectStl, RENDERER_IMAGE, repositoryRoot, Store } from '@canfactory/server';
import { createApp } from '../apps/api/src/app.ts';
import { renderJob, runOpenScad, type OpenScadRunner } from '../apps/worker/src/render.ts';

const exec = promisify(execFile);
const directory = await mkdtemp(join(tmpdir(), 'canfactory-render-test-'));
const store = new Store(directory, repositoryRoot);
store.migrate(); store.seed();
const app = await createApp(store);
const dockerRunner: OpenScadRunner = async (args, signal) => {
  const mapped = args.map(arg => arg.startsWith(directory) ? arg.replace(directory, '/data') : arg.startsWith(repositoryRoot) ? arg.replace(repositoryRoot, '/app') : arg);
  await exec('docker', ['run', '--rm', '--init', '--network', 'none', '--cpus', '2', '--memory', '2g',
    '--user', `${process.getuid?.() ?? 1000}:${process.getgid?.() ?? 1000}`,
    '--mount', `type=bind,src=${repositoryRoot},dst=/app,readonly`, '--mount', `type=bind,src=${directory},dst=/data`,
    RENDERER_IMAGE, 'timeout', '120', 'openscad', ...mapped], { signal, maxBuffer: 1_048_576 });
};
const runner = process.env['OPENSCAD_TEST_MODE'] === 'native' ? runOpenScad : dockerRunner;
const cases: { name: string; overrides: ParameterValues; dimensions: [number, number, number] }[] = [
  { name: 'default slots', overrides: {}, dimensions: [80, 104, 60] },
  { name: 'smooth narrow opening', overrides: { slotsEnabled: false, nozzleDiameter: 1 }, dimensions: [80, 104, 60] },
  { name: 'small without handles', overrides: { trapDiameter: 20, trapHeight: 10, brimWidth: 1, handles: false }, dimensions: [22, 22, 10] },
  { name: 'dense slots', overrides: { trapDiameter: 100, trapHeight: 100, gapHeight: 1, gapWidth: 0.3, gapDistanceHorizontal: 1.2, gapDistanceVertical: 1 }, dimensions: [120, 144, 100] },
  { name: 'maximum size', overrides: { trapDiameter: 200, trapHeight: 200, brimWidth: 30 }, dimensions: [260, 332, 200] },
];
let defaultTriangles = 0;
try {
  for (const testCase of cases) {
    const parameters = { ...fruitFlyTrap.defaults, ...testCase.overrides };
    assert.deepEqual(validateParameters(fruitFlyTrap, parameters), []);
    const queued = store.enqueue(fruitFlyTrap, parameters);
    const job = store.claim(); assert.ok(job?.leaseToken);
    const token = job.leaseToken;
    const heartbeat = setInterval(() => store.renew(job.id, token), 5000);
    const started = Date.now();
    try { assert.equal(await renderJob(store, job, new AbortController().signal, runner), true); }
    finally { clearInterval(heartbeat); }
    const result = store.getJob(queued.id); assert.equal(result?.status, 'succeeded'); assert.ok(result.artifact);
    const actual = result.artifact.dimensions;
    for (const [index, value] of [actual.x, actual.y, actual.z].entries()) {
      const expected = testCase.dimensions[index]; assert.ok(expected !== undefined);
      assert.ok(Math.abs(value - expected) < 0.001, `${testCase.name}: ${value} != ${expected}`);
    }
    const bytes = await readFile(store.artifacts.path(job.id));
    assert.equal(inspectStl(bytes).sha256, result.artifact.sha256);
    if (testCase.name === 'default slots') defaultTriangles = result.artifact.triangles;
    if (testCase.name === 'smooth narrow opening') assert.ok(result.artifact.triangles < defaultTriangles / 4);
    const preview = await app.inject(`/api/v1/renders/${job.id}/stl`);
    const download = await app.inject(`/api/v1/renders/${job.id}/stl?download=true`);
    assert.equal(preview.statusCode, 200); assert.equal(download.statusCode, 200);
    assert.deepEqual(preview.rawPayload, bytes); assert.deepEqual(download.rawPayload, bytes);
    assert.match(String(download.headers['content-disposition']), /attachment/);
    assert.equal(store.enqueue(fruitFlyTrap, parameters).id, job.id);
    console.log(`PASS ${testCase.name}: ${result.artifact.triangles} triangles, ${((Date.now() - started) / 1000).toFixed(1)} s`);
  }
} finally {
  await app.close(); store.close(); await rm(directory, { recursive: true, force: true });
}
