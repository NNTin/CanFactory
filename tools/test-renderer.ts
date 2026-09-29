import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { unzipSync } from 'fflate';
import { activeParts, CASE_MAGNETS, cigaretteCase, SNAP_TUNING, fruitFlyTrap, holeDiameter, litterShovel, mossPlanter, plankConnector, SCOOP_BLADE, sieveGaps, svgToLogo, textWidth, validateParameters, type LitterShovelParameters, type ParameterValues } from '@canfactory/contracts';
import { inspectStl, RENDERER_IMAGE, repositoryRoot, Store } from '@canfactory/server';
import { createApp } from '../apps/api/src/app.ts';
import { renderJob, runOpenScad, type OpenScadRunner } from '../apps/worker/src/render.ts';
import { renderScad } from './stl-to-scad/openscad.ts';

const exec = promisify(execFile);
// Two logos for the cigarette case's underside, read from SVG as the editor does.
const RING_AND_STAR = svgToLogo('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><path fill-rule="evenodd" d="M50 2a48 48 0 1 0 0.01 0zM50 10a40 40 0 1 1 -0.01 0z"/><path d="M50 18 L69 76 L20 40 L80 40 L31 76 Z"/></svg>');
const WIDE_BAR = svgToLogo('<svg xmlns="http://www.w3.org/2000/svg"><rect width="80" height="20" rx="5"/></svg>');
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
/** TEST_ONLY=cigarette-case (or fruit-fly-trap, moss-planter, plank-connector, litter-shovel) runs a single model's cases. */
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

  // Cigarette case: rendered once per mode of each joint's snap setting, then with engraved text in every font and in second-filament mode. Each part must be one
  // closed solid (the text part: closed letters) with the expected dimensions, packaged as one ZIP. The large box and lid have the source
  // STL's (which the reconstructions are verified against in models/cigarette-case/reference/VERIFICATION.md); the three mini parts are
  // fitted to their mating surfaces with the clearance C (0.2 mm by default), so they shrink by 2C (the mini lid's width by 4C: it is
  // fitted inside the fitted mini box). The snap features only stand proud by a fraction of a millimetre, except the mini lid's crush
  // ribs and detent bumps (C + 0.1 and C + 0.12 mm proud of each side) and the holder's detent bumps (0.15 mm past the bay at each end),
  // and are also rendered at the ends of the clearance range.
  // the lighter's joint has no detent (the lighter cannot carry a bump or a groove)
  const lighterMode = (mode: string) => mode === 'crush-ribs' ? mode : 'friction';
  const caseRuns: { name: string; parameters: ParameterValues }[] = [
    ...['friction', 'detent', 'clip', 'magnet', 'crush-ribs'].map(snap => ({ name: `snap ${snap}`, parameters: { ...cigaretteCase.defaults, snap } })),
    // every magnet the case lid offers, at both ends of the clearance range (its pockets and bosses are cut to the magnet)
    ...CASE_MAGNETS.flatMap(magnet => [0.1, 0.6].map(clearance => ({ name: `magnet ${magnet} at clearance ${clearance}`, parameters: { ...cigaretteCase.defaults, snap: 'magnet', magnet, clearance } }))),
    ...['sans', 'serif', 'mono', 'wide'].map(textFont => ({ name: `engraved ${textFont}`, parameters: { ...cigaretteCase.defaults, engraveText: 'Tom & Jo', textFont, textSize: 4 } })),
    { name: 'second filament', parameters: { ...cigaretteCase.defaults, engraveText: 'Hello', textMode: 'second-filament', textSize: 6 } },
    // an SVG logo instead of the text: a ring with a star in it (a self-crossing outline, filled nonzero), engraved and as a second-filament part,
    // at its largest; and a logo four times as wide as high, which is made smaller to fit the free width
    ...(['engrave', 'second-filament'] as const).map(textMode => ({ name: `logo ${textMode}`, parameters: { ...cigaretteCase.defaults, undersideMark: 'logo', logo: RING_AND_STAR.logo, logoSize: 15, textMode } })),
    { name: 'wide logo, second filament', parameters: { ...cigaretteCase.defaults, undersideMark: 'logo', logo: WIDE_BAR.logo, logoSize: 15, textMode: 'second-filament' } },
    ...[0.1, 0.6].map(clearance => ({ name: `clearance ${clearance}`, parameters: { ...cigaretteCase.defaults, clearance } })),
    { name: 'crush ribs at clearance 0.4', parameters: { ...cigaretteCase.defaults, snap: 'crush-ribs', clearance: 0.4 } },
    ...['miniLidSnap', 'holderSnap', 'miniBoxSnap'].flatMap(key => ['detent', 'crush-ribs'].map(mode => ({ name: `${key} ${mode}`, parameters: { ...cigaretteCase.defaults, [key]: mode } }))),
    // the lighter's bay (only the box's own ribs: the lighter is not printed), across the clearance range
    ...[0.1, 0.2, 0.46, 0.6].map(clearance => ({ name: `lighterSnap crush-ribs at clearance ${clearance}`, parameters: { ...cigaretteCase.defaults, lighterSnap: 'crush-ribs', clearance } })),
    ...['detent', 'crush-ribs'].flatMap(mode => [0.1, 0.4, 0.6].map(clearance => ({
      name: `every joint ${mode} at clearance ${clearance}`, parameters: { ...cigaretteCase.defaults, snap: mode, miniLidSnap: mode, holderSnap: mode, lighterSnap: lighterMode(mode), miniBoxSnap: mode, clearance },
    }))),
    // every engagement and squeeze at the ends of its slider (the deepest groove the contract allows: engagement + clearance = 0.8 mm)
    ...[[0.02, 0.1], [0.3, 0.5], [0.4, 0.4]].flatMap(([value, clearance]) => ['detent', 'crush-ribs'].map(mode => ({
      name: `every joint ${mode}, engagement and squeeze ${value} at clearance ${clearance}`,
      parameters: { ...cigaretteCase.defaults, snap: mode, miniLidSnap: mode, holderSnap: mode, lighterSnap: lighterMode(mode), miniBoxSnap: mode, clearance: clearance ?? 0.2,
        ...Object.fromEntries(Object.keys(SNAP_TUNING).map(key => [key, value ?? 0.1])) },
    }))),
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
    const c = Number(parameters['clearance']);
    // the mini lid's ribs and bumps stand C + squeeze or C + engagement proud of its sides, the holder's bumps the engagement past the bay
    const miniLidWidth = { 'crush-ribs': 25.579 - 2 * c + 2 * Number(parameters['miniLidCrushSqueeze']), detent: 25.579 - 2 * c + 2 * Number(parameters['miniLidDetentEngage']) }[String(parameters['miniLidSnap'])] ?? 25.579 - 4 * c;
    const expected: Record<string, [number, number, number]> = {
      'case-box': [55.888, 34.398, 77.171], 'case-lid': [55.888, 34.398, 41.868],
      'mini-holder': [11.792 - 2 * c, parameters['holderSnap'] === 'detent' ? 22.789 + 2 * Number(parameters['holderDetentEngage']) : 22.789 - 2 * c, 32.695],
      'mini-box': [34.494 - 2 * c, 27.579 - 2 * c, 14.391], 'mini-lid': [34.542 - 2 * c, miniLidWidth, 13.391],
    };
    for (const part of result.artifact.parts) {
      assert.ok(part.volume > 0, `cigarette case ${name} ${part.id}: expected positive volume`);
      if (part.id === 'case-text' && parameters['undersideMark'] === 'logo') {
        // The logo is logoSize high, or less if it would be wider than the free width (34.5 mm), 0.8 mm thick.
        const aspect = parameters['logo'] === WIDE_BAR.logo ? WIDE_BAR.aspect : RING_AND_STAR.aspect;
        const height = Math.min(Number(parameters['logoSize']), 34.5 / aspect);
        assert.ok(Math.abs(part.dimensions.y - height) < 0.02 && Math.abs(part.dimensions.x - height * aspect) < 0.02 && Math.abs(part.dimensions.z - 0.8) < 0.01, `case-text logo size ${JSON.stringify(part.dimensions)}, expected ${height * aspect} x ${height}`);
        continue;
      }
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
    // reference objects (the lighter) are shown in the preview only, never printed
    for (const reference of cigaretteCase.assembly.references ?? []) assert.ok(!(`${reference.id}.stl` in entries), `cigarette case ${name}: ${reference.id} must not be in the ZIP`);
    for (const [entryName, entryBytes] of Object.entries(entries)) {
      assert.ok(inspectStl(Buffer.from(entryBytes.buffer, entryBytes.byteOffset, entryBytes.byteLength), { allowDisconnected: entryName === 'case-text.stl' }).sha256, `cigarette case ${name} ${entryName}: expected a valid individual STL`);
    }
    assert.equal(store.enqueue(cigaretteCase, parameters).id, job.id);
    console.log(`PASS cigarette case ${name}: ${result.artifact.parts.length} parts, ${result.artifact.triangles} triangles, ${((Date.now() - started) / 1000).toFixed(1)} s`);
  }

  // Plank connector: every screw size and hole series, and the extremes of the pocket. Each must be one closed solid of exactly
  // (pocket + 2 walls) x (2 depths + stop); without a chamfer or holes the volume is the box minus the two pockets, and every hole
  // removes material, the more the larger the screw.
  const plankRuns: { name: string; overrides: ParameterValues }[] = [
    { name: 'default', overrides: {} },
    ...['M2', 'M2.5', 'M3', 'M4', 'M5', 'M6', 'M8'].map(screwHoles => ({ name: `${screwHoles} medium`, overrides: { screwHoles } })),
    { name: 'M3 fine, 4 per end', overrides: { screwHoles: 'M3', holeFit: 'fine', holesPerEnd: 4 } },
    { name: 'M8 coarse, 1 per end', overrides: { screwHoles: 'M8', holeFit: 'coarse', holesPerEnd: 1 } },
    { name: 'open sleeve, no chamfer', overrides: { stopThickness: 0, entryChamfer: 0 } },
    { name: 'smallest', overrides: { pocketWidth: 5, pocketThickness: 1, insertionDepth: 5, wallThickness: 0.8, entryChamfer: 0.4, screwHoles: 'M2', holeFit: 'fine', holesPerEnd: 1 } },
    { name: 'largest', overrides: { pocketWidth: 200, pocketThickness: 50, insertionDepth: 150, wallThickness: 10, stopThickness: 20, entryChamfer: 5, screwHoles: 'M8', holesPerEnd: 4 } },
  ];
  let plainVolume = 0; let previousHoleVolume = Number.POSITIVE_INFINITY;
  for (const { name, overrides } of only && only !== 'plank-connector' ? [] : plankRuns) {
    const started = Date.now();
    const parameters = { ...plankConnector.defaults, ...overrides };
    assert.deepEqual(validateParameters(plankConnector, parameters), [], name);
    const queued = store.enqueue(plankConnector, parameters);
    const job = store.claim(); assert.ok(job?.leaseToken);
    const token = job.leaseToken;
    const heartbeat = setInterval(() => store.renew(job.id, token), 5000);
    try { assert.equal(await renderJob(store, job, new AbortController().signal, runner), true, `plank connector ${name}`); }
    finally { clearInterval(heartbeat); }
    const result = store.getJob(queued.id); assert.equal(result?.status, 'succeeded', `plank connector ${name}`); assert.ok(result.artifact);
    if (!('dimensions' in result.artifact)) throw new Error('Expected a single-STL artifact for the plank connector.');
    const [w, t, d, wall, stop] = [parameters['pocketWidth'], parameters['pocketThickness'], parameters['insertionDepth'], parameters['wallThickness'], parameters['stopThickness']].map(Number) as [number, number, number, number, number];
    const want = { x: w + 2 * wall, y: t + 2 * wall, z: 2 * d + stop };
    for (const axis of ['x', 'y', 'z'] as const)
      assert.ok(Math.abs(result.artifact.dimensions[axis] - want[axis]) < 0.001, `plank connector ${name} ${axis}: ${result.artifact.dimensions[axis]} != ${want[axis]}`);
    const volume = result.artifact.volume;
    if (name === 'open sleeve, no chamfer') assert.ok(Math.abs(volume - (want.x * want.y * want.z - w * t * 2 * d)) < 0.5, `open sleeve volume ${volume}`);
    if (name === 'default') plainVolume = volume;
    if (name.endsWith(' medium')) {
      // one hole's worth of material goes through both walls: at least the cylinder through them, the holes growing with the screw
      const hole = holeDiameter({ screwHoles: String(parameters['screwHoles']) as 'M2', holeFit: 'medium' });
      const removed = plainVolume - volume;
      assert.ok(Math.abs(removed - 4 * Math.PI * (hole / 2) ** 2 * 2 * wall) < 0.02 * removed, `plank connector ${name}: removed ${removed}`);
      assert.ok(volume < previousHoleVolume, `plank connector ${name}: holes must grow with the screw`);
      previousHoleVolume = volume;
    }
    const bytes = await readFile(store.artifacts.path(job.id));
    assert.equal(inspectStl(bytes).sha256, result.artifact.sha256);
    assert.equal(store.enqueue(plankConnector, parameters).id, job.id);
    console.log(`PASS plank connector ${name}: ${result.artifact.triangles} triangles, ${volume.toFixed(0)} mm³, ${((Date.now() - started) / 1000).toFixed(1)} s`);
  }
  // Litter shovel: every sieve texture, the sieve extremes (most gaps, fewest gaps), the scraping tip's extremes, both grip ends,
  // the shortest and longest scoop, the fewest and most, thinnest and thickest grip supports, and both snap modes of both
  // joints at the clearance extremes. Each part must be one closed solid of the expected size (the scoop's length sets its
  // height, the grip's end the handle's; the container's grip sheet keeps half the clearance off the seam), and the scoop's
  // sieve must remove exactly its gaps (sieveGaps) through the 3.2 mm wall: at the default fit, tip and length, its volume plus
  // the gaps' volume is the same solid scoop for every sieve. The handle's reinforcement adds bosses
  // and holes within those sizes, with every thread, insert and nut kind.
  const shovelRuns: { name: string; overrides: Partial<LitterShovelParameters> }[] = [
    { name: 'default (slots, detents)', overrides: {} },
    { name: 'staggered slots', overrides: { sievePattern: 'staggered' } },
    { name: 'round holes', overrides: { sievePattern: 'round' } },
    { name: 'hexagons', overrides: { sievePattern: 'hex' } },
    { name: 'finest round holes', overrides: { sievePattern: 'round', gapWidth: 3, gapSpacing: 3, sieveMargin: 3 } },
    { name: 'finest round holes, shortest bevel', overrides: { sievePattern: 'round', gapWidth: 3, gapSpacing: 3, sieveMargin: 3, tipBevel: 5 } },
    { name: 'finest hexagons', overrides: { sievePattern: 'hex', gapWidth: 3, gapSpacing: 3, sieveMargin: 3 } },
    { name: 'long thin staggered slots', overrides: { sievePattern: 'staggered', gapWidth: 3, gapLength: 40, gapSpacing: 3, sieveMargin: 3 } },
    { name: 'thinnest, longest tip', overrides: { tipThickness: 0.4, tipBevel: 20 } },
    { name: 'thickest, shortest tip', overrides: { tipThickness: 2, tipBevel: 5 } },
    { name: 'grip down to the floor', overrides: { gripEnd: 'floor' } },
    { name: 'one thinnest support', overrides: { supportCount: 1, supportThickness: 1.2 } },
    { name: 'five thickest supports, grip to the floor', overrides: { supportCount: 5, supportThickness: 4, gripEnd: 'floor' } },
    { name: 'largest slots', overrides: { gapWidth: 15, gapLength: 40, gapSpacing: 15, sieveMargin: 10 } },
    { name: 'shortest scoop', overrides: { scoopLength: 90 } },
    { name: 'shortest scoop, largest round holes, longest bevel', overrides: { scoopLength: 90, sievePattern: 'round', gapWidth: 15, gapSpacing: 3, sieveMargin: 3, tipBevel: 20 } },
    { name: 'longest scoop', overrides: { scoopLength: 180 } },
    { name: 'longest scoop, fine hexagons', overrides: { scoopLength: 180, sievePattern: 'hex', gapWidth: 4.5, gapLength: 12, gapSpacing: 3, sieveMargin: 3 } },
    { name: 'friction fits at 0.1 mm', overrides: { handleSnap: 'friction', scoopSnap: 'friction', clearance: 0.1 } },
    { name: 'detents at 0.1 mm, least engagement', overrides: { clearance: 0.1, handleDetentEngage: 0.02, scoopDetentEngage: 0.02 } },
    { name: 'detents at 0.6 mm, most engagement', overrides: { clearance: 0.6, handleDetentEngage: 0.4, scoopDetentEngage: 0.4 } },
    // the handle's reinforcement: the smallest and largest threads, inserts and nuts (hexagonal, square, nylon-insert), and the
    // shortest and longest screws, whose bosses are the shallowest and deepest
    { name: 'M3 inserts, default screws', overrides: { handleReinforcement: 'threaded-insert' } },
    { name: 'M2 short inserts, shortest screws, 0.1 mm', overrides: { handleReinforcement: 'threaded-insert', handleThread: 'M2', handleInsert: 'cnc-kitchen-m2x3', handleScrew: 'iso-7046-m2x8', clearance: 0.1 } },
    { name: 'M4 long inserts, longest screws', overrides: { handleReinforcement: 'threaded-insert', handleThread: 'M4', handleInsert: 'ruthex-rx-m4x8-1', handleScrew: 'iso-10642-m4x16', handleSnap: 'friction' } },
    { name: 'M3 hexagon nuts', overrides: { handleReinforcement: 'nut-bolt' } },
    { name: 'M2.5 square nuts', overrides: { handleReinforcement: 'nut-bolt', handleThread: 'M2.5', handleNut: 'din-562-m2-5', handleScrew: 'iso-7046-m2-5x10' } },
    { name: 'M4 nylon-insert nuts at 0.6 mm', overrides: { handleReinforcement: 'nut-bolt', handleThread: 'M4', handleNut: 'iso-10511-m4', handleScrew: 'iso-7046-m4x12', clearance: 0.6, handleDetentEngage: 0.4, scoopDetentEngage: 0.4 } },
  ];
  const shovelSizes = (p: LitterShovelParameters): Record<string, [number, number, number]> => ({
    container: [41.25 + 65 - p.clearance / 2, 114.8, 141.5], scoop: [88.9, 121.2, p.scoopLength], handle: [44.45 + 68, 121.2, 159.5 - (p.gripEnd === 'floor' ? 0 : 30)],
  });
  const gapArea = (p: LitterShovelParameters) => p.sievePattern === 'round' ? Math.PI * (p.gapWidth / 2) ** 2
    : p.sievePattern === 'hex' ? Math.sqrt(3) / 2 * p.gapWidth ** 2 : p.gapWidth * (p.gapLength - p.gapWidth) + Math.PI * (p.gapWidth / 2) ** 2;
  const defaultFit = (p: LitterShovelParameters) => (['scoopSnap', 'handleSnap', 'clearance', 'scoopDetentEngage', 'handleDetentEngage', 'tipThickness', 'tipBevel', 'handleReinforcement', 'scoopLength'] as const).every(key => p[key] === litterShovel.defaults[key]);
  let solidScoop: number | undefined;
  for (const { name, overrides } of only && only !== 'litter-shovel' ? [] : shovelRuns) {
    const started = Date.now();
    const parameters = { ...litterShovel.defaults, ...overrides } as LitterShovelParameters;
    assert.deepEqual(validateParameters(litterShovel, parameters), [], name);
    const queued = store.enqueue(litterShovel, parameters);
    const job = store.claim(); assert.ok(job?.leaseToken);
    const token = job.leaseToken;
    const heartbeat = setInterval(() => store.renew(job.id, token), 5000);
    try { assert.equal(await renderJob(store, job, new AbortController().signal, runner), true, `litter shovel ${name}`); }
    finally { clearInterval(heartbeat); }
    const result = store.getJob(queued.id); assert.equal(result?.status, 'succeeded', `litter shovel ${name}`); assert.ok(result.artifact);
    if (!('parts' in result.artifact)) throw new Error('Expected an assembly ZIP artifact for the litter shovel.');
    assert.deepEqual(result.artifact.parts.map(part => part.id), ['container', 'scoop', 'handle'], `litter shovel ${name}: parts`);
    for (const part of result.artifact.parts) {
      const size = shovelSizes(parameters)[part.id];
      assert.ok(size && part.volume > 0, `litter shovel ${name} ${part.id}`);
      for (const [axis, want] of [['x', size[0]], ['y', size[1]], ['z', size[2]]] as const)
        assert.ok(Math.abs(part.dimensions[axis] - want) <= 0.05, `litter shovel ${name} ${part.id} ${axis}: ${part.dimensions[axis]} != ${want}`);
    }
    const scoop = result.artifact.parts.find(part => part.id === 'scoop');
    assert.ok(scoop);
    const sieve = sieveGaps(parameters), gaps = sieve.length;
    // A gap through a flat wall takes its area times the wall; one through a curved corner is cut radially, so it widens with
    // the radius and takes (R + r) / 2r times as much. Round holes and hexagons are polygons (OpenSCAD's $fs/$fa), a little
    // smaller than true circles, and gaps reaching over a corner's edge cut the wall a little obliquely: allow 1 %.
    const { flatY, cornerRadius, wall } = SCOOP_BLADE, innerRadius = cornerRadius - wall;
    const inCorner = (s: number) => Math.abs(s) > flatY && Math.abs(s) <= flatY + Math.PI / 2 * innerRadius;
    const solid = scoop.volume + sieve.reduce((sum, [s]) => sum + gapArea(parameters) * wall * (inCorner(s) ? (cornerRadius + innerRadius) / (2 * innerRadius) : 1), 0);
    if (defaultFit(parameters)) {
      solidScoop ??= solid;
      assert.ok(Math.abs(solid - solidScoop) < 0.01 * solidScoop, `litter shovel ${name}: ${gaps} gaps, scoop ${scoop.volume.toFixed(0)} mm³ + gaps = ${solid.toFixed(0)}, expected ${solidScoop.toFixed(0)}`);
    }
  const entries = unzipSync(new Uint8Array(await readFile(store.artifacts.path(job.id, 'zip'))));
    assert.deepEqual(Object.keys(entries).sort(), ['container.stl', 'handle.stl', 'scoop.stl']);
    for (const [entryName, entryBytes] of Object.entries(entries))
      assert.ok(inspectStl(Buffer.from(entryBytes.buffer, entryBytes.byteOffset, entryBytes.byteLength)).sha256, `litter shovel ${name} ${entryName}: expected a valid individual STL`);
    assert.equal(store.enqueue(litterShovel, parameters).id, job.id);
    console.log(`PASS litter shovel ${name}: ${gaps} gaps, scoop ${scoop.volume.toFixed(0)} mm³, ${result.artifact.triangles} triangles, ${((Date.now() - started) / 1000).toFixed(1)} s`);
  }
} finally {
  await app.close(); store.close(); await rm(directory, { recursive: true, force: true });
}
