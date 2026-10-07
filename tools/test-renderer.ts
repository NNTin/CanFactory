import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { unzipSync } from 'fflate';
import { activeParts, catCollarTag, catCollarTagSettings, collarTagLayout, COLLAR_TAG_SHAPES, springBallDetent, springBallDetentLayout, type SpringBallDetentSize, printedCornerBracket, printedScreenHook, printedScreenHookShape, maxLogoSize, QR_TAG, QR_TAG_JOINTS, QR_TAG_SHAPES, qrMagnetTag, qrTagCode, qrTagLayout, qrTagSettings, type QrMagnetTagParameters, aiRubberDuck, AI_DUCK_VARIANTS, CASE_MAGNETS, cigaretteCase, findPart, SNAP_TUNING, fruitFlyTrap, holeDiameter, LATCH_MACHINE_SCREWS, LATCH_WOOD_SCREWS, litterShovel, mossPlanter, plankConnector, pressurePad, SCOOP_BLADE, windowCatGuard, windowCatGuardLayout, WINDOW_CAT_GUARD, WINDOW_CAT_GUARD_SPLICE, type WindowCatGuardParameters, toggleLatch, sieveGaps, svgToLogo, textWidth, validateParameters, type LitterShovelParameters, type ParameterValues } from '@canfactory/contracts';
import { inspectStl, repositoryRoot, Store } from '@canfactory/server';
import { createApp } from '../apps/api/src/app.ts';
import { renderJob, type MeshRepair } from '../apps/worker/src/render.ts';
import { selectRunner } from './renderers.ts';
import jsQR from 'jsqr';
import { parseStl, type Mesh } from './stl-to-scad/stl.ts';

// Two logos for the cigarette case's underside, read from SVG as the editor does.
const RING_AND_STAR = svgToLogo('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><path fill-rule="evenodd" d="M50 2a48 48 0 1 0 0.01 0zM50 10a40 40 0 1 1 -0.01 0z"/><path d="M50 18 L69 76 L20 40 L80 40 L31 76 Z"/></svg>');
// A leaf with a vein cut out (an even-odd hole), the QR tag's logo.
const QR_LEAF = svgToLogo('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><path fill-rule="evenodd" d="M50 4 C82 18 96 58 50 96 C4 58 18 18 50 4Z M47 30 L53 30 L53 82 L47 82Z"/></svg>');
/**
 * A part seen from straight above, as a scanner sees the printed QR tag's centre: each pixel (0.125 mm) is dark where the mesh's
 * top surface stands above `threshold`, light elsewhere, and the border's blue beyond `half` mm; decoded with jsQR.
 */
function decodeTop(mesh: Mesh, threshold: number, half: number): string | undefined {
  const scale = 8, side = Math.ceil(2 * half * scale);
  const top = new Float32Array(side * side).fill(-Infinity);
  const t = mesh.tris;
  for (let i = 0; i < t.length; i += 9) {
    const [ax, ay, az, bx, by, bz, cx, cy, cz] = Array.from({ length: 9 }, (_, k) => t[i + k] ?? 0) as [number, number, number, number, number, number, number, number, number];
    const area = (bx - ax) * (cy - ay) - (cx - ax) * (by - ay);
    if (Math.abs(area) < 1e-9) continue;
    const px = (x: number) => (x + half) * scale - 0.5, py = (y: number) => (half - y) * scale - 0.5;
    const x0 = Math.max(0, Math.ceil(Math.min(px(ax), px(bx), px(cx)))), x1 = Math.min(side - 1, Math.floor(Math.max(px(ax), px(bx), px(cx))));
    const y0 = Math.max(0, Math.ceil(Math.min(py(ay), py(by), py(cy)))), y1 = Math.min(side - 1, Math.floor(Math.max(py(ay), py(by), py(cy))));
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const wx = (x + 0.5) / scale - half, wy = half - (y + 0.5) / scale;
      const u = ((bx - wx) * (cy - wy) - (cx - wx) * (by - wy)) / area, v = ((cx - wx) * (ay - wy) - (ax - wx) * (cy - wy)) / area, w = 1 - u - v;
      if (u < -1e-9 || v < -1e-9 || w < -1e-9) continue;
      const z = u * az + v * bz + w * cz;
      if (z > (top[y * side + x] ?? -Infinity)) top[y * side + x] = z;
    }
  }
  const data = new Uint8ClampedArray(side * side * 4);
  top.forEach((z, index) => data.set(z === -Infinity ? [47, 111, 214, 255] : z > threshold ? [20, 20, 24, 255] : [238, 239, 241, 255], index * 4));
  return jsQR(data, side, side, { inversionAttempts: 'dontInvert' })?.data;
}
/** How many separate closed shells a mesh has (vertices joined by their triangles). */
function shells(mesh: Mesh): number {
  const ids = new Map<string, number>(), parent: number[] = [];
  const find = (i: number): number => { let r = i; while (parent[r] !== r) r = parent[r] ?? r; return r; };
  const id = (k: number) => {
    const key = Array.from(mesh.tris.subarray(k, k + 3)).join(',');
    let found = ids.get(key);
    if (found === undefined) { found = ids.size; ids.set(key, found); parent.push(found); }
    return found;
  };
  for (let i = 0; i < mesh.tris.length; i += 9) {
    const [a, b, c] = [id(i), id(i + 3), id(i + 6)].map(find) as [number, number, number];
    parent[b] = a; parent[c] = a; parent[find(b)] = a;
  }
  return new Set(parent.map((_, i) => find(i))).size;
}
const WIDE_BAR = svgToLogo('<svg xmlns="http://www.w3.org/2000/svg"><rect width="80" height="20" rx="5"/></svg>');
const directory = await mkdtemp(join(tmpdir(), 'canfactory-render-test-'));
const store = new Store(directory, repositoryRoot);
store.migrate(); store.seed();
const app = await createApp(store);
/** TEST_ONLY=cigarette-case (or fruit-fly-trap, moss-planter, plank-connector, litter-shovel, ai-rubber-duck, toggle-latch, pressure-pad, window-cat-guard, qr-magnet-tag, printed-corner-bracket, printed-screen-hook, spring-ball-detent, cat-collar-tag) runs a single model's cases. */
const only = process.env['TEST_ONLY'];
const runner = selectRunner(directory);
// The worker repairs float32 slivers so that users get their model; here every repair is a failure: the geometry is fragile and
// must be fixed in the SCAD source.
const repairs: string[] = [];
const noteRepair = (job: { modelId: string; parameters: ParameterValues }) => (repair: MeshRepair) => {
  repairs.push(`${job.modelId} ${repair.part}: ${repair.repaired} repaired, parameters ${JSON.stringify(job.parameters)}`);
};
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
    try { assert.equal(await renderJob(store, job, new AbortController().signal, runner, noteRepair(job)), true); }
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
    try { assert.equal(await renderJob(store, job, new AbortController().signal, runner, noteRepair(job)), true, testCase.name); }
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
    try { assert.equal(await renderJob(store, job, new AbortController().signal, runner, noteRepair(job)), true, `cigarette case ${name}`); }
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
    try { assert.equal(await renderJob(store, job, new AbortController().signal, runner, noteRepair(job)), true, `plank connector ${name}`); }
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

  // Pressure pad: both kinds, every sole, the lowest pad each nut or head allows, the narrowest and the largest, and the
  // extenders, shortest and longest. Each part must be one closed solid: the pad exactly as wide as its diameter and as high as
  // its height, each extender as wide and as long as set.
  const padRuns: { name: string; overrides: ParameterValues }[] = [
    { name: 'default foot and extender', overrides: {} },
    { name: 'thrust pad alone', overrides: { padType: 'thrust', extenders: 0 } },
    { name: 'thrust, flat, lowest', overrides: { padType: 'thrust', surface: 'flat', height: 16.5, extenders: 0 } },
    { name: 'thrust, domed 3 mm, lowest', overrides: { padType: 'thrust', surface: 'domed', relief: 3, height: 19.5, extenders: 0 } },
    { name: 'foot, grooved 0.4 mm, lowest', overrides: { relief: 0.4, height: 12.5, extenders: 0 } },
    { name: 'foot, domed, M6 × 60, two extenders', overrides: { surface: 'domed', thread: 'M6', nut: 'iso-10511-m6', screw: 'iso-4017-m6x60', diameter: 25, height: 14, extenders: 2 } },
    { name: 'thrust, ISO 4032 M5, narrowest, shortest extender', overrides: { padType: 'thrust', thread: 'M5', nut: 'iso-4032-m5', screw: 'iso-4017-m5x20', diameter: 17.5, height: 16, fit: 0.1, extenderLength: 20 } },
    { name: 'thrust, M4 lock nut, smallest', overrides: { padType: 'thrust', thread: 'M4', nut: 'iso-10511-m4', screw: 'iso-4017-m4x20', surface: 'flat', diameter: 16, height: 13.5, fit: 0.1, extenders: 0 } },
    { name: 'largest, grooved 3 mm, loose fit, three longest extenders', overrides: { diameter: 80, height: 80, relief: 3, fit: 0.8, extenders: 3, extenderLength: 150 } },
  ];
  for (const { name, overrides } of only && only !== 'pressure-pad' ? [] : padRuns) {
    const started = Date.now();
    const parameters = { ...pressurePad.defaults, ...overrides };
    assert.deepEqual(validateParameters(pressurePad, parameters), [], name);
    const queued = store.enqueue(pressurePad, parameters);
    const job = store.claim(); assert.ok(job?.leaseToken);
    const token = job.leaseToken;
    const heartbeat = setInterval(() => store.renew(job.id, token), 5000);
    try { assert.equal(await renderJob(store, job, new AbortController().signal, runner, noteRepair(job)), true, `pressure pad ${name}`); }
    finally { clearInterval(heartbeat); }
    const result = store.getJob(queued.id); assert.equal(result?.status, 'succeeded', `pressure pad ${name}`); assert.ok(result.artifact && 'parts' in result.artifact);
    const [diameter, height, extenders, length] = [parameters['diameter'], parameters['height'], parameters['extenders'], parameters['extenderLength']].map(Number) as [number, number, number, number];
    assert.deepEqual(result.artifact.parts.map(part => part.id), ['pad', ...Array.from({ length: extenders }, (_, i) => `extender-${i + 1}`)], `pressure pad ${name}`);
    for (const part of result.artifact.parts) {
      const want = [diameter, diameter, part.id === 'pad' ? height : length];
      for (const [index, value] of [part.dimensions.x, part.dimensions.y, part.dimensions.z].entries())
        assert.ok(Math.abs(value - (want[index] ?? NaN)) < 0.01, `pressure pad ${name} ${part.id}: ${value} != ${want[index]}`);
    }
    console.log(`PASS pressure pad ${name}: ${result.artifact.triangles} triangles, ${((Date.now() - started) / 1000).toFixed(1)} s`);
  }
  // Window cat guard: the defaults; side panels alone with solid plates; the smallest window; the most segments (eight per panel);
  // the finest and thinnest honeycomb at the least play; the coarsest and thickest at the most play and the widest gap; the
  // tallest and widest window in the longest parts; the splice bars into nuts (the default), into inserts, with M4 and square nuts,
  // and glued joints without them. Each segment must be one closed solid, as many as the layout has, as high as its plate and spine
  // (a side panel's top segment: its bosses; the strip's ends: their pins), and the strip as deep as the gap; each splice bar one
  // closed solid of the bar's size.
  const guardRuns: { name: string; overrides: ParameterValues }[] = [
    { name: 'default', overrides: {} },
    { name: 'side panels alone, solid plates, glued', overrides: { topStrip: false, cell: 0, segmentJoints: 'glue' } },
    { name: 'smallest window', overrides: { height: 150, width: 300, gap: 60, tipWidth: 20 } },
    { name: 'eight segments per panel', overrides: { height: 1500, width: 1500, maxPartLength: 188, tipWidth: 25 } },
    { name: 'finest, thinnest, least play', overrides: { cell: 8, web: 4, thickness: 2.4, ribHeight: 2, border: 3, fit: 0.05, jointScrew: 'iso-10642-m3x8' } },
    { name: 'threaded inserts, finest web', overrides: { segmentJoints: 'threaded-insert', web: 2 } },
    { name: 'M4 nylon-insert nuts', overrides: { jointThread: 'M4', jointNut: 'iso-10511-m4', jointScrew: 'iso-10642-m4x12' } },
    { name: 'square nuts, M2', overrides: { jointThread: 'M2', jointNut: 'din-562-m2', jointScrew: 'iso-7046-m2x10' } },
    { name: 'coarsest, thickest, most play, widest gap', overrides: { cell: 40, web: 2, thickness: 6, ribHeight: 12, border: 15, fit: 0.4, gap: 200, tipWidth: 60 } },
    { name: 'tallest and widest in the longest parts', overrides: { height: 1500, width: 1600, maxPartLength: 300, tipWidth: 20 } },
  ];
  for (const { name, overrides } of only && only !== 'window-cat-guard' ? [] : guardRuns) {
    const started = Date.now();
    const parameters = { ...windowCatGuard.defaults, ...overrides };
    assert.deepEqual(validateParameters(windowCatGuard, parameters), [], name);
    const queued = store.enqueue(windowCatGuard, parameters);
    const job = store.claim(); assert.ok(job?.leaseToken);
    const token = job.leaseToken;
    const heartbeat = setInterval(() => store.renew(job.id, token), 5000);
    try { assert.equal(await renderJob(store, job, new AbortController().signal, runner, noteRepair(job)), true, `window cat guard ${name}`); }
    finally { clearInterval(heartbeat); }
    const result = store.getJob(queued.id); assert.equal(result?.status, 'succeeded', `window cat guard ${name}`); assert.ok(result.artifact && 'parts' in result.artifact);
    const p = parameters as unknown as WindowCatGuardParameters;
    const layout = windowCatGuardLayout(p);
    const segments = (kind: string, count: number) => Array.from({ length: count }, (_, i) => `${kind}-${i + 1}`);
    const spliced = p.segmentJoints !== 'glue';
    const bars = !spliced ? [] : [...segments('left-bar', layout.sideSegments - 1), ...segments('right-bar', layout.sideSegments - 1),
      ...segments('strip-bar', Math.max(0, layout.stripSegments - 1)).flatMap(id => [`${id}-1`, `${id}-2`])];
    assert.deepEqual(result.artifact.parts.map(part => part.id), [...segments('left', layout.sideSegments), ...segments('right', layout.sideSegments), ...segments('strip', layout.stripSegments), ...bars], `window cat guard ${name}`);
    const pinTop = layout.pinZ + WINDOW_CAT_GUARD.pinDiameter / 2;
    const s = WINDOW_CAT_GUARD_SPLICE;
    for (const part of result.artifact.parts.filter(part => part.id.includes('-bar-'))) {
      const want = [s.far - s.near + 2 * s.end, s.width, s.thickness];
      for (const [index, value] of [part.dimensions.x, part.dimensions.y, part.dimensions.z].entries())
        assert.ok(Math.abs(value - (want[index] ?? NaN)) < 0.01, `window cat guard ${name} ${part.id}: ${value} != ${want[index]}`);
    }
    for (const part of result.artifact.parts.filter(part => !part.id.includes('-bar-'))) {
      const end = part.id === 'strip-1' || part.id === `strip-${layout.stripSegments}`;
      const height = part.id.endsWith('-1') && part.id !== 'strip-1' && p.topStrip ? p.thickness + Math.max(p.ribHeight, WINDOW_CAT_GUARD.bossHeight)
        : Math.max(p.thickness + p.ribHeight, end ? pinTop : 0);
      assert.ok(Math.abs(part.dimensions.z - height) < 0.01, `window cat guard ${name} ${part.id}: ${part.dimensions.z} high, not ${height}`);
      if (part.id.startsWith('strip')) assert.ok(Math.abs(part.dimensions.y - p.gap) < 0.01, `window cat guard ${name} ${part.id}: ${part.dimensions.y} deep, not ${p.gap}`);
    }
    console.log(`PASS window cat guard ${name}: ${result.artifact.parts.length} parts, ${result.artifact.triangles} triangles, ${((Date.now() - started) / 1000).toFixed(1)} s`);
  }
  // Magnetic QR code tag: every joint on both shapes; the smallest and the largest tile; the longest text at the lowest error
  // correction; a logo at H and the largest logo at Q; the extremes of the fit for every joint; the thinnest and thickest centre.
  // Each part must be one closed solid of the expected size, and the centre's top, seen from above as a scanner sees the printed
  // tag (the relief dark, the base light), must decode to the text.
  const tagRuns: { name: string; overrides: ParameterValues }[] = [
    ...QR_TAG_SHAPES.flatMap(shape => QR_TAG_JOINTS.map(joint => ({ name: `${shape} ${joint}`, overrides: { shape, joint } }))),
    { name: 'smallest tile', overrides: { size: 30, borderWidth: 3, quietZone: 1, qrText: 'hi', errorCorrection: 'L', cornerRadius: 0 } },
    { name: 'smallest round tile, 2 small magnets', overrides: { shape: 'round', size: 40, borderWidth: 3, quietZone: 1, qrText: 'hi', errorCorrection: 'L', magnet: 'supermagnete-s-04-02-n', magnetCount: 2 } },
    { name: 'largest tile, largest magnets', overrides: { size: 120, borderWidth: 20, cornerRadius: 20, magnet: 'supermagnete-s-12-02-n', quietZone: 4 } },
    { name: 'longest text at L', overrides: { size: 120, qrText: 'The quick brown fox jumps over the lazy dog! 0123456789 '.repeat(4).slice(0, 200), errorCorrection: 'L' } },
    { name: 'logo at H', overrides: { logo: QR_LEAF.logo } },
    { name: 'largest logo at Q, round twist lock', overrides: { shape: 'round', size: 80, joint: 'twist-lock', qrText: 'https://github.com/NNTin/CanFactory', errorCorrection: 'Q', logo: QR_LEAF.logo, logoSize: 0 } },
    ...QR_TAG_JOINTS.flatMap(joint => [
      { name: `${joint} tightest`, overrides: { joint, fit: 0.05 } },
      { name: `${joint} loosest`, overrides: { joint, fit: joint === 'detent' ? 0.4 : 0.6 } },
    ]),
    { name: 'thinnest centre, fine layers', overrides: { baseThickness: 0.8, reliefHeight: 0.4, layerHeight: 0.08 } },
    { name: 'thinnest base that holds joint magnets, 3 mm magnets', overrides: { baseThickness: 1.2, joint: 'magnets', magnet: 'supermagnete-s-06-03-n' } },
    { name: 'thickest centre', overrides: { baseThickness: 3, reliefHeight: 2, joint: 'detent', fit: 0.6 } },
    // embedded magnets: sealed cavities in the border, at the pause height for the layer height
    ...QR_TAG_JOINTS.map(joint => ({ name: `embedded magnets, ${joint}`, overrides: { magnetMount: 'embedded', joint } })),
    // the thinnest magnets: the shallowest pockets, and the joint magnet standing least out of the centre
    { name: '1 mm magnets, magnet joint', overrides: { joint: 'magnets', magnet: 'supermagnete-s-08-01-n' } },
    { name: 'embedded 1 mm magnets, magnet joint', overrides: { magnetMount: 'embedded', joint: 'magnets', magnet: 'supermagnete-s-10-01-n' } },
    { name: 'embedded magnets, round magnet joint, 2 pairs of 10 × 3 mm', overrides: { magnetMount: 'embedded', shape: 'round', size: 80, joint: 'magnets', magnetCount: 2, magnet: 'supermagnete-s-10-03-n' } },
    { name: 'embedded magnets at the finest layers', overrides: { magnetMount: 'embedded', layerHeight: 0.08 } },
    { name: 'embedded magnets at the coarsest layers', overrides: { magnetMount: 'embedded', layerHeight: 0.32, reliefHeight: 0.7 } },
    { name: 'embedded magnets, smallest tile', overrides: { magnetMount: 'embedded', size: 30, borderWidth: 3, quietZone: 1, qrText: 'hi', errorCorrection: 'L', cornerRadius: 0 } },
  ];
  for (const { name, overrides } of only && only !== 'qr-magnet-tag' ? [] : tagRuns) {
    const started = Date.now();
    const parameters = { ...qrMagnetTag.defaults, ...overrides };
    // logoSize 0 stands for the largest the code allows
    if (parameters['logoSize'] === 0) parameters['logoSize'] = Math.min(40, maxLogoSize(qrTagCode({ ...parameters, logo: '' } as never).symbol.size, parameters['errorCorrection'] as 'Q'));
    assert.deepEqual(validateParameters(qrMagnetTag, parameters), [], `QR tag ${name}`);
    const queued = store.enqueue(qrMagnetTag, parameters);
    const job = store.claim(); assert.ok(job?.leaseToken);
    const token = job.leaseToken;
    const heartbeat = setInterval(() => store.renew(job.id, token), 5000);
    try { assert.equal(await renderJob(store, job, new AbortController().signal, runner, noteRepair(job)), true, `QR tag ${name}`); }
    finally { clearInterval(heartbeat); }
    const result = store.getJob(queued.id); assert.equal(result?.status, 'succeeded', `QR tag ${name}`); assert.ok(result.artifact && 'parts' in result.artifact);
    assert.deepEqual(result.artifact.parts.map(part => part.id), ['border', 'centre']);
    const p = parameters as unknown as QrMagnetTagParameters;
    const layout = qrTagLayout(qrTagSettings(parameters));
    const near = (actual: number | undefined, expected: number, what: string) => assert.ok(Math.abs((actual ?? NaN) - expected) < 0.02, `QR tag ${name} ${what}: ${actual} != ${expected}`);
    const [border, centre] = result.artifact.parts;
    near(border?.dimensions.x, p.size, 'border width'); near(border?.dimensions.y, p.size, 'border depth'); near(border?.dimensions.z, layout.height, 'border height');
    near(centre?.dimensions.z, p.baseThickness + p.reliefHeight, 'centre height');
    const across = p.joint === 'detent' ? layout.seatWidth + 2 * QR_TAG.detentEngage : layout.centreWidth;
    // a twist lock's lugs stand at 90°, 210° and 330°, each 12° wide: the ones at the sides reach out to 24° off the X axis
    const r = layout.centreWidth / 2, lugX = (r + QR_TAG.lugDepth) * Math.cos((90 - 60 - QR_TAG.lugAngle / 2) * Math.PI / 180);
    near(centre?.dimensions.x, p.joint === 'twist-lock' ? 2 * Math.max(r, lugX) : across, 'centre width');
    near(centre?.dimensions.y, p.joint === 'twist-lock' ? layout.centreWidth + QR_TAG.lugDepth : across, 'centre depth');
    // the centre seen from above: whatever stands above the middle of the relief is dark
    const entries = unzipSync(new Uint8Array(await readFile(store.artifacts.path(job.id, 'zip'))));
    // embedded magnets: the border is one outer shell with a sealed cavity per magnet inside it (the worker checked they face inwards)
    const borderStl = entries['border.stl']; assert.ok(borderStl, 'border.stl');
    const cavities = layout.embedded ? layout.backPockets.length + layout.jointPockets.length : 0;
    assert.equal(shells(parseStl(Buffer.from(borderStl.buffer, borderStl.byteOffset, borderStl.byteLength))), 1 + cavities, `QR tag ${name}: the border's shells`);
    const stl = entries['centre.stl']; assert.ok(stl, 'centre.stl');
    const decoded = decodeTop(parseStl(Buffer.from(stl.buffer, stl.byteOffset, stl.byteLength)), p.baseThickness + p.reliefHeight / 2, layout.centreWidth / 2 + 3);
    assert.equal(decoded, p.qrText, `QR tag ${name}: the rendered centre decodes to ${JSON.stringify(decoded)}`);
    console.log(`PASS QR tag ${name}: ${result.artifact.triangles} triangles, decodes, ${((Date.now() - started) / 1000).toFixed(1)} s`);
  }
  // Cat collar tag: every shape hanging and slid on; the NFC tag and the magnets in pockets and embedded (one at a time), beside
  // each other, at the finest layers; an embossed logo on the front and a logo on the back; two lines in each font; the thinnest
  // tag without marks; sharp edges; the smallest split ring and the widest collar. Each tag must be one closed solid of the
  // layout's size (a heart's tip is rounded off, so it is a little shorter), with a sealed cavity per embedded item.
  const slideOn = { attachment: 'slide-on', backMark: 'none', frontTextSize: 4 };
  const collarRuns: { name: string; overrides: ParameterValues }[] = [
    ...COLLAR_TAG_SHAPES.map(shape => ({ name: `${shape}, hanging`, overrides: { shape, width: shape === 'round' ? 30 : 40, height: shape === 'bone' ? 22 : shape === 'heart' ? 36 : 28, backTextSize: 2.5 } })),
    { name: 'round, slide-on', overrides: { ...slideOn, width: 44 } },
    { name: 'rounded rectangle, slide-on', overrides: { ...slideOn, shape: 'rounded-rectangle', width: 45, height: 20 } },
    { name: 'bone, slide-on', overrides: { ...slideOn, shape: 'bone', width: 50, height: 28 } },
    { name: 'heart, slide-on', overrides: { ...slideOn, shape: 'heart', width: 60, height: 45 } },
    { name: 'fish, slide-on', overrides: { ...slideOn, shape: 'fish', width: 60, height: 30 } },
    { name: 'widest collar, slide-on', overrides: { ...slideOn, shape: 'rounded-rectangle', width: 45, height: 22, collar: 'lupinepet-original-designs-safety-cat-collar', slotFit: 0 } },
    { name: 'embedded 1 mm magnets, two', overrides: { magnetMount: 'embedded', magnetCount: 2, magnet: 'supermagnete-s-05-01-n', width: 36, thickness: 3.4 } },
    { name: 'embedded 2 mm magnet, blank back', overrides: { magnetMount: 'embedded', magnet: 'supermagnete-s-08-02-n', backMark: 'none', thickness: 3.8 } },
    { name: 'magnet pockets', overrides: { magnetMount: 'pocket', magnetCount: 2, backMark: 'none', width: 36, thickness: 2.4 } },
    { name: 'embedded NFC tag, thinnest', overrides: { nfc: 'embedded', backMark: 'none', frontMark: 'none', thickness: 1.4, edgeRadius: 0.4 } },
    { name: 'embedded NFC tag under both texts', overrides: { nfc: 'embedded', thickness: 2.6 } },
    { name: 'NFC pocket', overrides: { nfc: 'pocket', backMark: 'none', thickness: 1.6 } },
    { name: 'embedded NFC tag beside magnet pockets', overrides: { nfc: 'embedded', nfcTag: 'gototags-gml7cqg3v7', magnetMount: 'pocket', magnetCount: 2, magnet: 'supermagnete-s-04-02-n', backMark: 'none', shape: 'rounded-rectangle', width: 60, height: 36, thickness: 3.4 } },
    { name: 'embedded magnets beside an NFC pocket', overrides: { nfc: 'pocket', nfcTag: 'core-electronics-ce08496', magnetMount: 'embedded', magnet: 'supermagnete-s-05-01-n', backMark: 'none', shape: 'rounded-rectangle', width: 60, height: 34, thickness: 3 } },
    { name: 'embedded at the finest layers', overrides: { magnetMount: 'embedded', thickness: 3.5, layerHeight: 0.08 } },
    { name: 'embossed logo front, logo back', overrides: { frontMark: 'logo', frontLogo: QR_LEAF.logo, frontStyle: 'emboss', backMark: 'logo', backLogo: WIDE_BAR.logo, backLogoSize: 6 } },
    ...(['serif', 'mono', 'wide'] as const).map(font => ({ name: `two lines in ${font}`, overrides: { shape: 'rounded-rectangle', width: 40, height: 26, frontFont: font, backFont: font, frontLine1: 'Mochi', frontLine2: 'Indoor cat', frontTextSize: 4, backTextSize: 3 } })),
    { name: 'thinnest, blank, sharp edges', overrides: { thickness: 1, edgeRadius: 0, frontMark: 'none', backMark: 'none' } },
    // rounded edges are steps that must fuse: the roundest edges a thickness allows, on a straight and a curved outline
    { name: 'edges rounded by half the thickness', overrides: { thickness: 1.6, edgeRadius: 0.8, frontMark: 'none', backMark: 'none' } },
    { name: 'heart, roundest thick edges', overrides: { shape: 'heart', width: 40, height: 36, thickness: 4, edgeRadius: 1.3, frontTextSize: 4.5, backTextSize: 2.5 } },
    { name: 'smallest split ring', overrides: { splitRing: 'avco-kr-90920', bailWall: 1.2, thickness: 1.6, backMark: 'none' } },
  ];
  for (const { name, overrides } of only && only !== 'cat-collar-tag' ? [] : collarRuns) {
    const started = Date.now();
    const parameters = { ...catCollarTag.defaults, ...overrides };
    assert.deepEqual(validateParameters(catCollarTag, parameters), [], `cat collar tag ${name}`);
    const queued = store.enqueue(catCollarTag, parameters);
    const job = store.claim(); assert.ok(job?.leaseToken);
    const token = job.leaseToken;
    const heartbeat = setInterval(() => store.renew(job.id, token), 5000);
    try { assert.equal(await renderJob(store, job, new AbortController().signal, runner, noteRepair(job)), true, `cat collar tag ${name}`); }
    finally { clearInterval(heartbeat); }
    const result = store.getJob(queued.id); assert.equal(result?.status, 'succeeded', `cat collar tag ${name}`); assert.ok(result.artifact && 'parts' in result.artifact);
    assert.deepEqual(result.artifact.parts.map(part => part.id), ['tag']);
    const layout = collarTagLayout(catCollarTagSettings(parameters));
    const [tag] = result.artifact.parts;
    const near = (actual: number | undefined, expected: number, what: string, tolerance = 0.05) => assert.ok(Math.abs((actual ?? NaN) - expected) < tolerance, `cat collar tag ${name} ${what}: ${actual} != ${expected}`);
    near(tag?.dimensions.x, layout.bounds.x, 'width');
    if (parameters['shape'] === 'heart') assert.ok((tag?.dimensions.y ?? NaN) <= layout.bounds.y + 0.05 && (tag?.dimensions.y ?? NaN) > layout.bounds.y - 1.5, `cat collar tag ${name} height: ${tag?.dimensions.y}`);
    else near(tag?.dimensions.y, layout.bounds.y, 'height');
    near(tag?.dimensions.z, layout.bounds.z, 'thickness');
    const entries = unzipSync(new Uint8Array(await readFile(store.artifacts.path(job.id, 'zip'))));
    const stl = entries['tag.stl']; assert.ok(stl, 'tag.stl');
    const cavities = layout.embedded === 'nfc' ? 1 : layout.embedded === 'magnet' ? layout.magnets.length : 0;
    assert.equal(shells(parseStl(Buffer.from(stl.buffer, stl.byteOffset, stl.byteLength))), 1 + cavities, `cat collar tag ${name}: the tag's shells`);
    console.log(`PASS cat collar tag ${name}: ${result.artifact.triangles} triangles, ${((Date.now() - started) / 1000).toFixed(1)} s`);
  }
  // Litter shovel: every sieve texture, the sieve extremes (most gaps, fewest gaps), the scraping tip's extremes, both grip ends,
  // the shortest and longest scoop, no dam and the widest, the fewest and most, thinnest and thickest grip supports, and both snap modes of both
  // joints at the clearance extremes. Each part must be one closed solid of the expected size (the scoop's length sets its
  // height, the grip's end the handle's; the container's grip sheet keeps half the clearance off the seam), and the scoop's
  // sieve must remove exactly its gaps (sieveGaps) through the wall: at the default fit, tip and length, its volume plus
  // the gaps' volume is the same solid scoop for every sieve, at each wall thickness. The thinnest and thickest walls (with the
  // pads under the screws, and the tip at its thinnest allowed) must render as well. The handle's reinforcement adds bosses
  // and holes within those sizes, with every thread, insert and nut kind.
  const shovelRuns: { name: string; overrides: Partial<LitterShovelParameters> }[] = [
    { name: 'default (slots, detents)', overrides: {} },
    { name: 'staggered slots', overrides: { sievePattern: 'staggered' } },
    { name: 'round holes', overrides: { sievePattern: 'round' } },
    { name: 'hexagons', overrides: { sievePattern: 'hex' } },
    { name: 'finest round holes', overrides: { sievePattern: 'round', gapWidth: 3, gapSpacing: 3, sieveMargin: 3 } },
    { name: 'finest round holes, shortest bevel', overrides: { sievePattern: 'round', gapWidth: 3, gapSpacing: 3, sieveMargin: 3, tipBevel: 5 } },
    { name: 'finest hexagons', overrides: { sievePattern: 'hex', gapWidth: 3, gapSpacing: 3, sieveMargin: 3 } },
    { name: 'long thin staggered slots', overrides: { sievePattern: 'staggered', sieveSizing: 'length', gapWidth: 3, gapLength: 40, gapSpacing: 3, sieveMargin: 3 } },
    { name: 'slots sized by length (25 mm)', overrides: { sieveSizing: 'length' } },
    { name: 'longest slots the defaults leave room for', overrides: { sieveSizing: 'length', gapLength: 82.5 } },
    { name: 'two rows of slots', overrides: { sieveRows: 2 } },
    { name: 'five rows of staggered slots', overrides: { sievePattern: 'staggered', sieveRows: 5 } },
    { name: '1 mm slots and bars, five rows', overrides: { gapWidth: 1, gapSpacing: 1, sieveRows: 5 } },
    { name: '1 mm slots and bars, one row', overrides: { gapWidth: 1, gapSpacing: 1 } },
    { name: 'shortest scoop, most rows', overrides: { scoopLength: 90, sieveRows: 4 } },
    { name: 'thinnest, longest tip', overrides: { tipThickness: 0.4, tipBevel: 20 } },
    { name: 'thickest, shortest tip', overrides: { tipThickness: 2, tipBevel: 5, wallThickness: 2.4 } },
    { name: 'grip down to the floor', overrides: { gripEnd: 'floor' } },
    { name: 'one thinnest support', overrides: { supportCount: 1, supportThickness: 1.2 } },
    { name: 'five thickest supports, grip to the floor', overrides: { supportCount: 5, supportThickness: 4, gripEnd: 'floor' } },
    { name: 'largest slots', overrides: { sieveSizing: 'length', gapWidth: 15, gapLength: 40, gapSpacing: 15, sieveMargin: 10 } },
    { name: 'no dam', overrides: { damWidth: 0 } },
    { name: 'widest dam', overrides: { damWidth: 15 } },
    { name: 'narrowest dam, grip to the floor', overrides: { damWidth: 0.5, gripEnd: 'floor' } },
    { name: 'shortest scoop', overrides: { scoopLength: 90 } },
    { name: 'shortest scoop, largest round holes, longest bevel', overrides: { scoopLength: 90, sievePattern: 'round', gapWidth: 15, gapSpacing: 3, sieveMargin: 3, tipBevel: 20 } },
    { name: 'longest scoop', overrides: { scoopLength: 180 } },
    { name: 'longest scoop, five rows', overrides: { scoopLength: 180, sieveRows: 5 } },
    { name: 'longest scoop, fine hexagons', overrides: { scoopLength: 180, sievePattern: 'hex', gapWidth: 4.5, gapLength: 12, gapSpacing: 3, sieveMargin: 3 } },
    { name: 'friction fits at 0.1 mm', overrides: { handleSnap: 'friction', scoopSnap: 'friction', clearance: 0.1 } },
    { name: 'detents at 0.1 mm, least engagement', overrides: { clearance: 0.1, handleDetentEngage: 0.02, scoopDetentEngage: 0.02 } },
    { name: 'detents at 0.6 mm, most engagement', overrides: { clearance: 0.6, handleDetentEngage: 0.4, scoopDetentEngage: 0.4 } },
    // the handle's reinforcement: the smallest and largest threads, inserts and nuts (hexagonal, square, nylon-insert), and the
    // shortest and longest screws, whose bosses are the shallowest and deepest
    // the wall thickness: the thinnest (the tip is at most 0.4 mm less), with pads under the screws, and the thickest (no pads)
    { name: 'thinnest wall', overrides: { wallThickness: 1.2 } },
    { name: 'thinnest wall, finest round holes, tip at its thickest', overrides: { wallThickness: 1.2, tipThickness: 0.8, sievePattern: 'round', gapWidth: 3, gapSpacing: 3, sieveMargin: 3 } },
    { name: 'thinnest wall, five thickest supports, widest dam', overrides: { wallThickness: 1.2, supportCount: 5, supportThickness: 4, damWidth: 15 } },
    { name: 'thickest wall', overrides: { wallThickness: 3.2 } },
    { name: 'thickest wall, thickest tip, hexagons', overrides: { wallThickness: 3.2, tipThickness: 2, sievePattern: 'hex' } },
    // Regressions found by the geometry sweep (tools/sweep-geometry.ts): each left a float32 sliver in the scoop. Staggered rows
    // whose slot ends met the next row's side in a corner; the round top's seam at the front's middle (at these walls).
    { name: 'staggered 2.1 mm slots, 1 mm bars, three rows', overrides: { sievePattern: 'staggered', gapWidth: 2.1, gapSpacing: 1, sieveRows: 3 } },
    { name: 'staggered 2.1 mm slots, 1 mm bars, four rows', overrides: { sievePattern: 'staggered', gapWidth: 2.1, gapSpacing: 1, sieveRows: 4 } },
    { name: 'staggered 3 mm slots, 2 mm bars, two rows', overrides: { sievePattern: 'staggered', gapWidth: 3, gapSpacing: 2, sieveRows: 2 } },
    ...[1.3, 1.9, 2.4, 2.7, 3].map(wallThickness => ({ name: `${wallThickness} mm wall`, overrides: { wallThickness } })),
    { name: 'thinnest wall, M4 nuts, longest screws', overrides: { wallThickness: 1.2, handleReinforcement: 'nut-bolt', handleThread: 'M4', handleNut: 'iso-4032-m4', handleScrew: 'iso-10642-m4x16' } },
    { name: 'thinnest wall, M3 inserts', overrides: { wallThickness: 1.2, handleReinforcement: 'threaded-insert' } },
    { name: 'thickest wall, M3 inserts', overrides: { wallThickness: 3.2, handleReinforcement: 'threaded-insert' } },
    { name: 'M3 inserts, default screws', overrides: { handleReinforcement: 'threaded-insert' } },
    { name: 'M2 short inserts, shortest screws, 0.1 mm', overrides: { handleReinforcement: 'threaded-insert', handleThread: 'M2', handleInsert: 'cnc-kitchen-m2x3', handleScrew: 'iso-7046-m2x8', clearance: 0.1 } },
    { name: 'M4 long inserts, longest screws', overrides: { handleReinforcement: 'threaded-insert', handleThread: 'M4', handleInsert: 'ruthex-rx-m4x8-1', handleScrew: 'iso-10642-m4x16', handleSnap: 'friction' } },
    { name: 'M3 hexagon nuts', overrides: { handleReinforcement: 'nut-bolt' } },
    { name: 'M2.5 square nuts', overrides: { handleReinforcement: 'nut-bolt', handleThread: 'M2.5', handleNut: 'din-562-m2-5', handleScrew: 'iso-7046-m2-5x10' } },
    { name: 'M4 nylon-insert nuts at 0.6 mm', overrides: { handleReinforcement: 'nut-bolt', handleThread: 'M4', handleNut: 'iso-10511-m4', handleScrew: 'iso-7046-m4x12', clearance: 0.6, handleDetentEngage: 0.4, scoopDetentEngage: 0.4 } },
    // the grip's shapes: the curved bulge at its least and most, and the round and rectangular bars at their smallest and largest, with the grip open and down to the floor
    { name: 'curved grip, no bulge', overrides: { handleShape: 'curved', gripBulge: 0 } },
    { name: 'curved grip, default bulge', overrides: { handleShape: 'curved' } },
    { name: 'curved grip, most bulge, to the floor', overrides: { handleShape: 'curved', gripBulge: 6, gripEnd: 'floor' } },
    { name: 'curved grip, most bulge, 0.6 mm clearance, M3 nuts', overrides: { handleShape: 'curved', gripBulge: 6, clearance: 0.6, handleReinforcement: 'nut-bolt' } },
    { name: 'round grip, smallest', overrides: { handleShape: 'round', gripSize: 10 } },
    { name: 'round grip, default', overrides: { handleShape: 'round' } },
    { name: 'round grip, largest, to the floor', overrides: { handleShape: 'round', gripSize: 24, gripEnd: 'floor' } },
    { name: 'round grip, largest, M4 nuts beside it', overrides: { handleShape: 'round', gripSize: 24, handleReinforcement: 'nut-bolt', handleThread: 'M4', handleNut: 'iso-4032-m4', handleScrew: 'iso-10642-m4x16' } },
    { name: 'rectangular grip, smallest', overrides: { handleShape: 'rectangular', gripSize: 10 } },
    { name: 'rectangular grip, default', overrides: { handleShape: 'rectangular' } },
    { name: 'rectangular grip, largest, to the floor, thinnest wall', overrides: { handleShape: 'rectangular', gripSize: 24, gripEnd: 'floor', wallThickness: 1.2 } },
    { name: 'rectangular grip, 0.6 mm clearance, M3 inserts', overrides: { handleShape: 'rectangular', clearance: 0.6, handleReinforcement: 'threaded-insert' } },
  ];
  // The grip's extent (docs/litter-shovel.md, Grip): the seam moves out with the thick bars' half-depth, and the round and rectangular
  // bars' open tip leaves the run the sheet's does below their bend.
  const shovelGrip = (p: LitterShovelParameters) => {
    const thick = p.handleShape === 'round' || p.handleShape === 'rectangular';
    const half = thick ? p.gripSize / 2 : 3, seamX = 65 + half - 3, bulge = p.handleShape === 'curved' ? p.gripBulge : 0;
    const bendZ = 132 - (seamX - 37.25) - Math.max(15, half + 5) * Math.tan(Math.PI / 8);
    const tipZ = p.gripEnd === 'floor' ? 0 : thick ? Math.max(0, bendZ - 68) : 30;
    return { half, seamX, bulge, tipZ };
  };
  const shovelSizes = (p: LitterShovelParameters): Record<string, [number, number, number]> => ({
    container: [41.25 + shovelGrip(p).seamX + shovelGrip(p).bulge - p.clearance / 2, 114.8, 141.5], scoop: [88.9, 121.2, p.scoopLength],
    handle: [44.45 + shovelGrip(p).seamX + shovelGrip(p).bulge + shovelGrip(p).half, 121.2, 159.5 - shovelGrip(p).tipZ],
  });
  // a slot's area from its own length (sized by rows, the sides' slots are shorter)
  const gapArea = (p: LitterShovelParameters, length: number) => p.sievePattern === 'round' ? Math.PI * (p.gapWidth / 2) ** 2
    : p.sievePattern === 'hex' ? Math.sqrt(3) / 2 * p.gapWidth ** 2 : p.gapWidth * (length - p.gapWidth) + Math.PI * (p.gapWidth / 2) ** 2;
  const defaultFit = (p: LitterShovelParameters) => (['scoopSnap', 'handleSnap', 'clearance', 'scoopDetentEngage', 'handleDetentEngage', 'tipThickness', 'tipBevel', 'handleReinforcement', 'scoopLength'] as const).every(key => p[key] === litterShovel.defaults[key]);
  const solidScoop = new Map<number, number>();
  for (const { name, overrides } of only && only !== 'litter-shovel' ? [] : shovelRuns) {
    const started = Date.now();
    const parameters = { ...litterShovel.defaults, ...overrides } as LitterShovelParameters;
    assert.deepEqual(validateParameters(litterShovel, parameters), [], name);
    const queued = store.enqueue(litterShovel, parameters);
    const job = store.claim(); assert.ok(job?.leaseToken);
    const token = job.leaseToken;
    const heartbeat = setInterval(() => store.renew(job.id, token), 5000);
    try { assert.equal(await renderJob(store, job, new AbortController().signal, runner, noteRepair(job)), true, `litter shovel ${name}`); }
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
    const { flatY, cornerRadius } = SCOOP_BLADE, wall = parameters.wallThickness, innerRadius = cornerRadius - wall;
    const inCorner = (s: number) => Math.abs(s) > flatY && Math.abs(s) <= flatY + Math.PI / 2 * innerRadius;
    const solid = scoop.volume + sieve.reduce((sum, [s, , length]) => sum + gapArea(parameters, length) * wall * (inCorner(s) ? (cornerRadius + innerRadius) / (2 * innerRadius) : 1), 0);
    if (defaultFit(parameters)) {
      const expected = solidScoop.get(wall) ?? solid; solidScoop.set(wall, expected);
      assert.ok(Math.abs(solid - expected) < 0.01 * expected, `litter shovel ${name}: ${gaps} gaps, scoop ${scoop.volume.toFixed(0)} mm³ + gaps = ${solid.toFixed(0)}, expected ${expected.toFixed(0)}`);
    }
  const entries = unzipSync(new Uint8Array(await readFile(store.artifacts.path(job.id, 'zip'))));
    assert.deepEqual(Object.keys(entries).sort(), ['container.stl', 'handle.stl', 'scoop.stl']);
    for (const [entryName, entryBytes] of Object.entries(entries))
      assert.ok(inspectStl(Buffer.from(entryBytes.buffer, entryBytes.byteOffset, entryBytes.byteLength)).sha256, `litter shovel ${name} ${entryName}: expected a valid individual STL`);
    assert.equal(store.enqueue(litterShovel, parameters).id, job.id);
    console.log(`PASS litter shovel ${name}: ${gaps} gaps, scoop ${scoop.volume.toFixed(0)} mm³, ${result.artifact.triangles} triangles, ${((Date.now() - started) / 1000).toFixed(1)} s`);
  }
  // Eight concepts at default and the size/clearance corners: independent closed pieces, one ZIP.
  for (const variant of only && only !== 'ai-rubber-duck' ? [] : AI_DUCK_VARIANTS) {
    for (const [bodyLength, clearance] of [[90, 0.2], [70, 0.1], [70, 0.25], [120, 0.1], [120, 0.25]] as const) {
      const parameters = { ...aiRubberDuck.defaults, variant, bodyLength, clearance };
      assert.deepEqual(validateParameters(aiRubberDuck, parameters), []);
      const queued = store.enqueue(aiRubberDuck, parameters), job = store.claim();
      assert.ok(job?.leaseToken);
      const token = job.leaseToken, heartbeat = setInterval(() => store.renew(job.id, token), 5000);
      try { assert.equal(await renderJob(store, job, new AbortController().signal, runner, noteRepair(job)), true); }
      finally { clearInterval(heartbeat); }
      const result = store.getJob(queued.id);
      assert.equal(result?.status, 'succeeded');
      assert.ok(result.artifact && 'parts' in result.artifact);
      const expected = activeParts(aiRubberDuck, parameters).map(part => part.id);
      assert.deepEqual(result.artifact.parts.map(part => part.id), expected);
      const bytes = await readFile(store.artifacts.path(job.id, 'zip'));
      const entries = unzipSync(new Uint8Array(bytes));
      assert.deepEqual(Object.keys(entries), expected.map(id => `${id}.stl`));
      for (const [name, entry] of Object.entries(entries)) {
        const mesh = inspectStl(Buffer.from(entry));
        assert.ok(mesh.volume > 0, name);
        assert.ok(mesh.triangles < 100_000, `${name}: excessive complexity`);
        if (name === 'body.stl') assert.ok(Math.abs(mesh.dimensions.x - bodyLength) < 0.1, `${variant}: wrong body length`);
      }
      const preview = await app.inject(`/api/v1/renders/${job.id}/zip`);
      const download = await app.inject(`/api/v1/renders/${job.id}/zip?download=true`);
      assert.equal(preview.statusCode, 200); assert.equal(download.statusCode, 200);
      assert.deepEqual(preview.rawPayload, bytes); assert.deepEqual(download.rawPayload, bytes);
      assert.equal(store.enqueue(aiRubberDuck, parameters).id, queued.id);
      console.log(`PASS AI duck ${variant}: ${bodyLength} mm, clearance ${clearance}, ${expected.length} pieces`);
    }
  }
  // Toggle latch: the plates' holes for one screw of every wood-screw diameter and of every machine thread and head (the head's
  // size, not the screw's length, shapes the hole), at every fit, and the loose-pivot lever. Every part stays one closed solid of the
  // original's size: the holes never reach the plates' outline.
  const firstOfEach = (ids: readonly string[], key: (part: NonNullable<ReturnType<typeof findPart>>) => string) =>
    [...new Map(ids.map(id => findPart(id)).filter(part => part !== undefined).reverse().map(part => [key(part), part.id])).values()];
  const latchRuns: { name: string; overrides: ParameterValues }[] = [
    ...firstOfEach(LATCH_WOOD_SCREWS, part => String(part.attributes['diameter'])).map(id => ({ name: `wood ${id}`, overrides: { screwKind: 'wood', woodScrewDiameter: String(findPart(id)?.attributes['diameter']), woodScrew: id } })),
    ...firstOfEach(LATCH_MACHINE_SCREWS, part => `${part.attributes['thread']} ${part.attributes['head']}`).map(id => ({ name: `machine ${id}`, overrides: { screwKind: 'machine', screwThread: String(findPart(id)?.attributes['thread']), machineScrew: id } })),
    ...['fine', 'coarse'].flatMap(holeFit => [{ name: `wood ${holeFit}`, overrides: { holeFit } }, { name: `machine ${holeFit}`, overrides: { screwKind: 'machine', holeFit } }]),
    { name: 'loose pivots', overrides: { highTolerance: true } },
  ];
  const latchSizes: Record<string, [number, number, number]> = { base: [38, 15.372, 11.998], lever: [31.624, 18.4, 13.898], link: [34.146, 17.402, 10.026], catch: [37.996, 14.4, 11.998] };
  for (const { name, overrides } of only && only !== 'toggle-latch' ? [] : latchRuns) {
    const started = Date.now();
    const parameters = { ...toggleLatch.defaults, ...overrides };
    assert.deepEqual(validateParameters(toggleLatch, parameters), [], `toggle latch ${name}`);
    const queued = store.enqueue(toggleLatch, parameters);
    const job = store.claim(); assert.ok(job?.leaseToken);
    const token = job.leaseToken;
    const heartbeat = setInterval(() => store.renew(job.id, token), 5000);
    try { assert.equal(await renderJob(store, job, new AbortController().signal, runner, noteRepair(job)), true, `toggle latch ${name}`); }
    finally { clearInterval(heartbeat); }
    const result = store.getJob(queued.id); assert.equal(result?.status, 'succeeded', `toggle latch ${name}`); assert.ok(result.artifact && 'parts' in result.artifact);
    assert.deepEqual(result.artifact.parts.map(part => part.id), ['base', 'lever', 'link', 'catch']);
    for (const part of result.artifact.parts) {
      const expected = latchSizes[part.id]; assert.ok(expected);
      for (const [index, value] of [part.dimensions.x, part.dimensions.y, part.dimensions.z].entries())
        assert.ok(Math.abs(value - (expected[index] ?? NaN)) < 0.01, `toggle latch ${name} ${part.id}: ${value} != ${expected[index]}`);
    }
    console.log(`PASS toggle latch ${name}: ${result.artifact.triangles} triangles, ${((Date.now() - started) / 1000).toFixed(1)} s`);
  }
  // Printed corner bracket: the defaults (the window insert's), uneven legs with one hole, the widest and thickest plate for 6 mm
  // screws, the smallest for 3 mm ones, five holes a leg, and both other fits. One closed solid, as long as each leg and as thick as
  // the plate, with every hole through it (genus = holes).
  const bracketRuns: { name: string; overrides: ParameterValues }[] = [
    { name: 'default', overrides: {} },
    { name: 'uneven legs, one hole each', overrides: { legA: 150, legB: 80, holesPerLeg: 1 } },
    { name: 'widest, thickest, 6 mm screws', overrides: { legA: 140, legB: 140, width: 40, thickness: 10, holesPerLeg: 2, holeSpacing: 30, firstHole: 60, woodScrewDiameter: '6 mm', woodScrew: 'din-7997-6x60' } },
    { name: 'smallest, 3 mm screws, fine', overrides: { legA: 40, legB: 40, width: 10, thickness: 3, holesPerLeg: 1, firstHole: 20, woodScrewDiameter: '3 mm', woodScrew: 'din-7997-3x12', holeFit: 'fine' } },
    { name: 'five holes a leg, coarse', overrides: { legA: 250, legB: 250, holesPerLeg: 5, holeSpacing: 25, holeFit: 'coarse' } },
  ];
  for (const { name, overrides } of only && only !== 'printed-corner-bracket' ? [] : bracketRuns) {
    const started = Date.now();
    const parameters = { ...printedCornerBracket.defaults, ...overrides };
    assert.deepEqual(validateParameters(printedCornerBracket, parameters), [], `printed corner bracket ${name}`);
    const queued = store.enqueue(printedCornerBracket, parameters);
    const job = store.claim(); assert.ok(job?.leaseToken);
    const token = job.leaseToken;
    const heartbeat = setInterval(() => store.renew(job.id, token), 5000);
    try { assert.equal(await renderJob(store, job, new AbortController().signal, runner, noteRepair(job)), true, `printed corner bracket ${name}`); }
    finally { clearInterval(heartbeat); }
    const result = store.getJob(queued.id); assert.equal(result?.status, 'succeeded', `printed corner bracket ${name}`); assert.ok(result.artifact && 'parts' in result.artifact);
    const [bracket] = result.artifact.parts; assert.ok(bracket && result.artifact.parts.length === 1);
    const [a, b, w, t] = ['legA', 'legB', 'width', 'thickness'].map(key => Number(parameters[key])) as [number, number, number, number];
    for (const [index, value] of [bracket.dimensions.x, bracket.dimensions.y, bracket.dimensions.z].entries())
      assert.ok(Math.abs(value - ([a, b, t][index] ?? NaN)) < 0.01, `printed corner bracket ${name}: ${value} != ${[a, b, t][index]}`);
    // the plate's L less its holes
    assert.ok(bracket.volume < (a * w + (b - w) * w) * t && bracket.volume > 0.8 * (a * w + (b - w) * w) * t, `printed corner bracket ${name}: volume ${bracket.volume}`);
    console.log(`PASS printed corner bracket ${name}: ${result.artifact.triangles} triangles, ${((Date.now() - started) / 1000).toFixed(1)} s`);
  }
  // Printed screen hook: the defaults (a VEKA Softline 82 MD), the thinnest lip with the least seal gap the 2 mm barb takes, a thin
  // barb in a narrow gap, the thickest lip with the widest gap and the largest strip for 6 mm screws, and a coarse fit, all with the
  // default one screw; then two screws, by default and on the shortest leg. Both hooks are one closed solid each: as deep as the
  // barb's back, as long as the leg and the barb's rise, as wide as the strip; two screws' holes take more out than one.
  const hookRuns: { name: string; overrides: ParameterValues }[] = [
    { name: 'default', overrides: {} },
    { name: 'thinnest lip, least gap', overrides: { frameLip: 5, sealGap: 3 } },
    { name: 'thin barb in a narrow gap', overrides: { frameLip: 12, sealGap: 2.5, barbThickness: 1.5, legThickness: 3, turnThickness: 3, engage: 3, legLength: 25 } },
    { name: 'thickest lip, widest gap, largest strip, 6 mm screws', overrides: { frameLip: 35, sealGap: 10, barbThickness: 4, engage: 15, clearance: 3, width: 20, legLength: 80, legThickness: 8, turnThickness: 8, woodScrewDiameter: '6 mm', woodScrew: 'din-7997-6x40' } },
    { name: '4 mm screws, coarse', overrides: { width: 12, woodScrewDiameter: '4 mm', woodScrew: 'din-7997-4x25', holeFit: 'coarse' } },
    { name: 'two screws', overrides: { screwCount: 2 } },
    { name: 'two screws, shortest leg', overrides: { screwCount: 2, legLength: 25 } },
  ];
  const hookVolumes = new Map<string, number>();
  for (const { name, overrides } of only && only !== 'printed-screen-hook' ? [] : hookRuns) {
    const started = Date.now();
    const parameters = { ...printedScreenHook.defaults, ...overrides };
    assert.deepEqual(validateParameters(printedScreenHook, parameters), [], `printed screen hook ${name}`);
    const queued = store.enqueue(printedScreenHook, parameters);
    const job = store.claim(); assert.ok(job?.leaseToken);
    const token = job.leaseToken;
    const heartbeat = setInterval(() => store.renew(job.id, token), 5000);
    try { assert.equal(await renderJob(store, job, new AbortController().signal, runner, noteRepair(job)), true, `printed screen hook ${name}`); }
    finally { clearInterval(heartbeat); }
    const result = store.getJob(queued.id); assert.equal(result?.status, 'succeeded', `printed screen hook ${name}`); assert.ok(result.artifact && 'parts' in result.artifact);
    assert.deepEqual(result.artifact.parts.map(part => part.id), ['long', 'short']);
    const screw = findPart(String(parameters['woodScrew'])); assert.ok(screw);
    const shape = printedScreenHookShape(parameters as unknown as Parameters<typeof printedScreenHookShape>[0], screw);
    for (const part of result.artifact.parts) {
      const rise = part.id === 'long' ? shape.rise.long : shape.rise.short;
      const want = [shape.back, Number(parameters['legLength']) + rise, Number(parameters['width'])];
      for (const [index, value] of [part.dimensions.x, part.dimensions.y, part.dimensions.z].entries())
        assert.ok(Math.abs(value - (want[index] ?? NaN)) < 0.01, `printed screen hook ${name} ${part.id}: ${value} != ${want[index]}`);
      hookVolumes.set(`${name} ${part.id}`, part.volume);
    }
    if (name === 'two screws') for (const id of ['long', 'short']) {
      const one = hookVolumes.get(`default ${id}`); const two = hookVolumes.get(`two screws ${id}`);
      if (one !== undefined && two !== undefined) assert.ok(two < one - 10, `printed screen hook two screws ${id}: ${two} mm³ is not a hole less than ${one} mm³`);
    }
    console.log(`PASS printed screen hook ${name}: ${result.artifact.triangles} triangles, ${((Date.now() - started) / 1000).toFixed(1)} s`);
  }
  // Spring ball detent: the defaults (M10, press cap, slot), the set screw in the same body, the smallest (M6, 2.5 mm ball), an M8 with a
  // hex socket, an M12 with a set screw behind a hex socket, side openings in plain and threaded bodies, a plain body with a press cap,
  // and the largest ball in an M12 with the most interference and no thread play.
  // The body is one closed solid with one hole through it (genus 1), as long as set and as wide as its printed thread; the cap, when
  // there is one, is as long as the layout says.
  const detentRuns: { name: string; overrides: ParameterValues }[] = [
    { name: 'default', overrides: {} },
    { name: 'set screw', overrides: { retention: 'set-screw' } },
    { name: 'M6, 2.5 mm ball', overrides: { thread: 'M6', ball: 'steel-ball-2-5-g100', spring: 'gutekunst-d-024', protrusion: 0.25, travel: 0.5, bodyLength: 14 } },
    { name: 'M8, hex socket', overrides: { thread: 'M8', ball: 'steel-ball-2-5-g100', spring: 'gutekunst-d-027', protrusion: 0.25, travel: 0.6, bodyLength: 20, toolFeature: 'hex' } },
    { name: 'M8, 3 mm ball, coarse play', overrides: { thread: 'M8', ball: 'steel-ball-3-g100', spring: 'gutekunst-d-039', protrusion: 0.3, travel: 0.6, bodyLength: 14, clearance: 0.4, threadPlay: 0.4 } },
    { name: 'M12, set screw behind a hex socket', overrides: { thread: 'M12', retention: 'set-screw', toolFeature: 'hex', bodyLength: 28 } },
    { name: 'plain body, side opening', overrides: { body: 'plain', retention: 'side-opening', toolFeature: 'none', spring: 'gutekunst-d-078', bodyLength: 18 } },
    { name: 'M10, side opening behind a hex socket', overrides: { retention: 'side-opening', toolFeature: 'hex', spring: 'gutekunst-d-078' } },
    { name: 'plain 14 mm body, 6 mm ball, side opening behind a slot', overrides: { body: 'plain', bodyDiameter: 14, ball: 'steel-ball-6-g100', spring: 'gutekunst-d-108', protrusion: 1.2, travel: 1.4, retention: 'side-opening', bodyLength: 26 } },
    { name: 'plain body, press cap', overrides: { body: 'plain', bodyDiameter: 8, toolFeature: 'none', ball: 'steel-ball-4-g100', spring: 'gutekunst-d-082', protrusion: 0.6, travel: 0.8, bodyLength: 16 } },
    { name: 'M12, 6 mm ball, no thread play', overrides: { thread: 'M12', ball: 'steel-ball-6-g100', spring: 'gutekunst-d-134', protrusion: 1.4, travel: 2, bodyLength: 40, threadPlay: 0, clearance: 0.4, capInterference: 0.5 } },
  ];
  for (const { name, overrides } of only && only !== 'spring-ball-detent' ? [] : detentRuns) {
    const started = Date.now();
    const parameters = { ...springBallDetent.defaults, ...overrides };
    assert.deepEqual(validateParameters(springBallDetent, parameters), [], `spring ball detent ${name}`);
    const queued = store.enqueue(springBallDetent, parameters);
    const job = store.claim(); assert.ok(job?.leaseToken);
    const token = job.leaseToken;
    const heartbeat = setInterval(() => store.renew(job.id, token), 5000);
    try { assert.equal(await renderJob(store, job, new AbortController().signal, runner, noteRepair(job)), true, `spring ball detent ${name}`); }
    finally { clearInterval(heartbeat); }
    const result = store.getJob(queued.id); assert.equal(result?.status, 'succeeded', `spring ball detent ${name}`); assert.ok(result.artifact && 'parts' in result.artifact);
    const press = parameters['retention'] === 'press-cap';
    assert.deepEqual(result.artifact.parts.map(part => part.id), press ? ['body', 'cap'] : ['body']);
    const chosen = (key: string) => { const found = findPart(String(parameters[key])); assert.ok(found); return found; };
    const layout = springBallDetentLayout(parameters as unknown as SpringBallDetentSize, { ball: chosen('ball'), spring: chosen('spring'), setScrew: chosen('setScrew') });
    const [body, cap] = result.artifact.parts; assert.ok(body);
    assert.ok(Math.abs(body.dimensions.z - Number(parameters['bodyLength'])) < 0.01, `spring ball detent ${name}: length ${body.dimensions.z}`);
    for (const across of [body.dimensions.x, body.dimensions.y]) assert.ok(across <= layout.thread.major + 0.01 && across > layout.thread.major - 0.1, `spring ball detent ${name}: ${across} across, thread ${layout.thread.major}`);
    if (press) { assert.ok(cap && Math.abs(cap.dimensions.z - layout.cap.length) < 0.01, `spring ball detent ${name}: cap ${cap?.dimensions.z} != ${layout.cap.length}`); }
    console.log(`PASS spring ball detent ${name}: ${result.artifact.triangles} triangles, ${((Date.now() - started) / 1000).toFixed(1)} s`);
  }
  assert.deepEqual(repairs, [], `Renders needed float32 sliver repairs (fragile geometry):\n${repairs.join('\n')}`);
} finally {
  await app.close(); store.close(); await rm(directory, { recursive: true, force: true });
}
