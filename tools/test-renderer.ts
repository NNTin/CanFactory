import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { unzipSync } from 'fflate';
import { fruitFlyTrap, mossPlanter, validateParameters, type ParameterValues } from '@canfactory/contracts';
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
    if (!('dimensions' in result.artifact)) throw new Error('Expected a single-STL artifact for fruit-fly-trap.');
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

  // Moss planter: the original 52 and 100 mm towers plus intermediate and extreme custom ones. Whatever the settings, every part
  // must be one closed solid whose diameter follows the tower diameter, so that the threads of all five parts mate.
  const mossCases: { name: string; overrides: ParameterValues; heights: { 'lattice-short'?: number; 'lattice-tall'?: number } }[] = [
    { name: 'original 52 mm tower', overrides: {}, heights: { 'lattice-short': 125, 'lattice-tall': 230 } },
    { name: '77 mm tower, custom spike and rows', overrides: { towerDiameter: 77, spikeLength: 190, shortRauteRows: 3, tallRauteRows: 12, rauteColumns: 9 }, heights: {} },
    { name: 'original 100 mm tower', overrides: { towerDiameter: 100, spikeLength: 238 }, heights: {} },
    { name: 'smallest tower', overrides: { towerDiameter: 40, spikeLength: 50, shortRauteRows: 2, tallRauteRows: 2 }, heights: {} },
    { name: 'largest tower', overrides: { towerDiameter: 120, spikeLength: 300 }, heights: {} },
  ];
  for (const testCase of mossCases) {
    const started = Date.now();
    const parameters = { ...mossPlanter.defaults, ...testCase.overrides };
    assert.deepEqual(validateParameters(mossPlanter, parameters), [], testCase.name);
    const queued = store.enqueue(mossPlanter, parameters);
    const job = store.claim(); assert.ok(job?.leaseToken);
    const token = job.leaseToken;
    const heartbeat = setInterval(() => store.renew(job.id, token), 5000);
    try { assert.equal(await renderJob(store, job, new AbortController().signal, runner), true, testCase.name); }
    finally { clearInterval(heartbeat); }
    const result = store.getJob(queued.id); assert.equal(result?.status, 'succeeded', testCase.name); assert.ok(result.artifact);
    if (!('parts' in result.artifact)) throw new Error('Expected an assembly ZIP artifact for moss planter.');
    assert.equal(result.artifact.parts.length, mossPlanter.parts.length);
    for (const part of result.artifact.parts) assert.ok(part.volume > 0, `${testCase.name} ${part.id}: expected positive volume`);
    const scale = Number(parameters['towerDiameter']) / 52;
    const dimensions = Object.fromEntries(result.artifact.parts.map(part => [part.id, part.dimensions]));
    const near = (actual: number | undefined, expected: number, tolerance: number, label: string) =>
      assert.ok(actual !== undefined && Math.abs(actual - expected) <= tolerance, `${testCase.name} ${label}: ${actual} != ${expected}`);
    // Parts are scaled copies of the 52 mm design, so their widths are fixed multiples of the tower diameter.
    near(dimensions['cover-cap']?.x, Number(parameters['towerDiameter']), 0.01, 'cover cap diameter');
    near(dimensions['lattice-short']?.x, Number(parameters['towerDiameter']), 0.01, 'short lattice diameter');
    near(dimensions['lattice-tall']?.x, Number(parameters['towerDiameter']), 0.01, 'tall lattice diameter');
    near(dimensions['ground-spike']?.x, 41.146 * scale, 0.02, 'spike flange');
    near(dimensions['planting-helper']?.x, 85 * scale, 0.02, 'helper base');
    near(dimensions['ground-spike']?.z, Math.max(Number(parameters['spikeLength']), 50.02 * scale), 0.02, 'spike length');
    for (const [id, height] of Object.entries(testCase.heights)) near(dimensions[id]?.z, height, 0.1, `${id} height`);
    const bytes = await readFile(store.artifacts.path(job.id, 'zip'));
    const entries = unzipSync(new Uint8Array(bytes));
    assert.deepEqual(Object.keys(entries).sort(), mossPlanter.parts.map(part => `${part.id}.stl`).sort());
    for (const [name, entryBytes] of Object.entries(entries)) {
      const asBuffer = Buffer.from(entryBytes.buffer, entryBytes.byteOffset, entryBytes.byteLength);
      assert.ok(inspectStl(asBuffer).sha256, `${testCase.name} ${name}: expected a valid individual STL`);
    }
    const preview = await app.inject(`/api/v1/renders/${job.id}/zip`);
    const download = await app.inject(`/api/v1/renders/${job.id}/zip?download=true`);
    assert.equal(preview.statusCode, 200); assert.equal(download.statusCode, 200);
    assert.equal(preview.headers['content-type'], 'application/zip'); assert.deepEqual(preview.rawPayload, bytes); assert.deepEqual(download.rawPayload, bytes);
    assert.match(String(download.headers['content-disposition']), /attachment/);
    assert.equal(store.enqueue(mossPlanter, parameters).id, job.id);
    console.log(`PASS moss planter ${testCase.name}: ${result.artifact.parts.length} parts, ${result.artifact.triangles} triangles, ${((Date.now() - started) / 1000).toFixed(1)} s`);
  }
} finally {
  await app.close(); store.close(); await rm(directory, { recursive: true, force: true });
}
