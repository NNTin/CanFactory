import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { unzipSync } from 'fflate';
import { activeParts, cigaretteCase, fruitFlyTrap, mossPlanter, textWidth, validateParameters, type ParameterValues } from '@canfactory/contracts';
import { inspectStl, RENDERER_IMAGE, repositoryRoot, Store } from '@canfactory/server';
import { createApp } from '../apps/api/src/app.ts';
import { renderJob, runOpenScad, type OpenScadRunner } from '../apps/worker/src/render.ts';
import { renderScad } from './stl-to-scad/openscad.ts';

const exec = promisify(execFile);
const directory = await mkdtemp(join(tmpdir(), 'canfactory-render-test-'));
const store = new Store(directory, repositoryRoot);
store.migrate(); store.seed();
const app = await createApp(store);
const dockerRunner: OpenScadRunner = async (args, signal, fontPath) => {
  const mapped = args.map(arg => arg.startsWith(directory) ? arg.replace(directory, '/data') : arg.startsWith(repositoryRoot) ? arg.replace(repositoryRoot, '/app') : arg);
  await exec('docker', ['run', '--rm', '--init', '--network', 'none', '--cpus', '2', '--memory', '2g',
    '--user', `${process.getuid?.() ?? 1000}:${process.getgid?.() ?? 1000}`,
    '--env', `OPENSCAD_FONT_PATH=${fontPath.replace(repositoryRoot, '/app')}`, '--mount', `type=bind,src=${repositoryRoot},dst=/app,readonly`, '--mount', `type=bind,src=${directory},dst=/data`,
    RENDERER_IMAGE, 'timeout', '120', 'openscad', ...mapped], { signal, maxBuffer: 1_048_576 });
};
/** OPENSCAD_TEST_MODE=wasm renders with the optional openscad-wasm-prebuilt package (`npm i --no-save openscad-wasm-prebuilt`) and the bundled fonts. */
const wasmRunner: OpenScadRunner = async (args) => {
  const defines: Record<string, string> = {};
  args.forEach((arg, index) => { if (args[index - 1] === '-D') { const [name, ...value] = arg.split('='); if (name) defines[name] = value.join('='); } });
  const scad = args.at(-1); const output = args[args.indexOf('-o') + 1];
  if (!scad || !output) throw new Error('Expected a SCAD file and -o');
  await writeFile(output, (await renderScad(scad, defines)).stl);
};
const mode = process.env['OPENSCAD_TEST_MODE'];
/** TEST_ONLY=cigarette-case (or fruit-fly-trap, moss-planter) runs a single model's cases. */
const only = process.env['TEST_ONLY'];
const runner = mode === 'native' ? runOpenScad : mode === 'wasm' ? wasmRunner : dockerRunner;
const cases: { name: string; overrides: ParameterValues; dimensions: [number, number, number] }[] = [
  { name: 'default slots', overrides: {}, dimensions: [80, 104, 60] },
  { name: 'smooth narrow opening', overrides: { slotsEnabled: false, nozzleDiameter: 1 }, dimensions: [80, 104, 60] },
  { name: 'small without handles', overrides: { trapDiameter: 20, trapHeight: 10, brimWidth: 1, handles: false }, dimensions: [22, 22, 10] },
  { name: 'dense slots', overrides: { trapDiameter: 100, trapHeight: 100, gapHeight: 1, gapWidth: 0.3, gapDistanceHorizontal: 1.2, gapDistanceVertical: 1 }, dimensions: [120, 144, 100] },
  { name: 'maximum size', overrides: { trapDiameter: 200, trapHeight: 200, brimWidth: 30 }, dimensions: [260, 332, 200] },
];
let defaultTriangles = 0;
try {
  for (const testCase of only && only !== 'fruit-fly-trap' ? [] : cases) {
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
  for (const testCase of only && only !== 'moss-planter' ? [] : mossCases) {
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

  // Cigarette case: rendered once per snap mode, then with engraved text in every font and in second-filament mode. Each part must be one
  // closed solid (the text part: closed letters) with the expected dimensions, packaged as one ZIP. The large box and lid have the source
  // STL's (which the reconstructions are verified against in models/cigarette-case/reference/VERIFICATION.md); the three mini parts are
  // fitted to their mating surfaces with the 0.2 mm default clearance, so they are smaller. The snap features only stand proud by a
  // fraction of a millimetre, except the mini lid's crush ribs (0.3 mm proud of its 24.779 mm width).
  const caseRuns: { name: string; parameters: ParameterValues }[] = [
    ...['friction', 'detent', 'clip', 'magnet', 'crush-ribs'].map(snap => ({ name: `snap ${snap}`, parameters: { ...cigaretteCase.defaults, snap } })),
    ...['sans', 'serif', 'mono', 'wide'].map(textFont => ({ name: `engraved ${textFont}`, parameters: { ...cigaretteCase.defaults, engraveText: 'Tom & Jo', textFont, textSize: 4 } })),
    { name: 'second filament', parameters: { ...cigaretteCase.defaults, engraveText: 'Hello', textMode: 'second-filament', textSize: 6 } },
  ];
  for (const { name, parameters } of only && only !== 'cigarette-case' ? [] : caseRuns) {
    const started = Date.now();
    assert.deepEqual(validateParameters(cigaretteCase, parameters), []);
    const queued = store.enqueue(cigaretteCase, parameters);
    const job = store.claim(); assert.ok(job?.leaseToken);
    const token = job.leaseToken;
    const heartbeat = setInterval(() => store.renew(job.id, token), 5000);
    try { assert.equal(await renderJob(store, job, new AbortController().signal, runner), true, `cigarette case ${name}`); }
    finally { clearInterval(heartbeat); }
    const result = store.getJob(queued.id); assert.equal(result?.status, 'succeeded', `cigarette case ${name}`); assert.ok(result.artifact);
    if (!('parts' in result.artifact)) throw new Error('Expected an assembly ZIP artifact for the cigarette case.');
    const wanted = activeParts(cigaretteCase, parameters);
    assert.deepEqual(result.artifact.parts.map(part => part.id), wanted.map(part => part.id), `cigarette case ${name}: parts`);
    const expected: Record<string, [number, number, number]> = {
      'case-box': [55.888, 34.398, 77.171], 'case-lid': [55.888, 34.398, 41.868], 'mini-holder': [11.392, 22.389, 32.695],
      'mini-box': [34.094, 27.179, 14.391], 'mini-lid': [34.142, parameters['snap'] === 'crush-ribs' ? 25.38 : 24.779, 13.391],
    };
    for (const part of result.artifact.parts) {
      assert.ok(part.volume > 0, `cigarette case ${name} ${part.id}: expected positive volume`);
      if (part.id === 'case-text') {
        // The letters must lie inside the free area, be 0.8 mm thick, and be no wider than the contract's estimate, which is an upper bound (else the estimate would let clipped text through).
        const estimate = textWidth(String(parameters['textFont']), String(parameters['engraveText']), Number(parameters['textSize']));
        assert.ok(part.dimensions.x <= 35.01 && part.dimensions.y <= 16.01 && Math.abs(part.dimensions.z - 0.8) < 0.01, `case-text size ${JSON.stringify(part.dimensions)}`);
        assert.ok(part.dimensions.x <= estimate + 0.05, `case-text width ${part.dimensions.x} vs estimate ${estimate}`);
        continue;
      }
      const size = expected[part.id];
      assert.ok(size, `unexpected part ${part.id}`);
      for (const [axis, want] of [['x', size[0]], ['y', size[1]], ['z', size[2]]] as const)
        assert.ok(Math.abs(part.dimensions[axis] - want) <= 0.1, `cigarette case ${name} ${part.id} ${axis}: ${part.dimensions[axis]} != ${want}`);
    }
    const bytes = await readFile(store.artifacts.path(job.id, 'zip'));
    const entries = unzipSync(new Uint8Array(bytes));
    assert.deepEqual(Object.keys(entries).sort(), wanted.map(part => `${part.id}.stl`).sort());
    for (const [entryName, entryBytes] of Object.entries(entries)) {
      assert.ok(inspectStl(Buffer.from(entryBytes.buffer, entryBytes.byteOffset, entryBytes.byteLength), { allowDisconnected: entryName === 'case-text.stl' }).sha256, `cigarette case ${name} ${entryName}: expected a valid individual STL`);
    }
    assert.equal(store.enqueue(cigaretteCase, parameters).id, job.id);
    console.log(`PASS cigarette case ${name}: ${result.artifact.parts.length} parts, ${result.artifact.triangles} triangles, ${((Date.now() - started) / 1000).toFixed(1)} s`);
  }
} finally {
  await app.close(); store.close(); await rm(directory, { recursive: true, force: true });
}
