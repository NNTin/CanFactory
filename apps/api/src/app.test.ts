import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Value } from 'typebox/value';
import { aiRubberDuck, AI_DUCK_VARIANTS, cigaretteCase, ErrorSchema, LOGO_MAX_LENGTH, LOGO_MAX_POINTS, fruitFlyTrap, litterShovel, ModelDetailSchema, mossPlanter, PartDetailSchema, PartFamilyDetailSchema, PartFamilySummarySchema, partFamilies, parts, plankConnector, RenderSchema } from '@canfactory/contracts';
import { CACHE_TTL_MS, repositoryRoot, Store } from '@canfactory/server';
import { createApp } from './app.ts';

let store: Store;
let directory: string;
let time: number;
let app: Awaited<ReturnType<typeof createApp>>;
beforeEach(async () => {
  time = Date.now(); directory = mkdtempSync(join(tmpdir(), 'canfactory-api-test-'));
  store = new Store(directory, repositoryRoot, () => time); store.migrate(); store.seed();
  app = await createApp(store);
});
afterEach(async () => { await app.close(); store.close(); rmSync(directory, { recursive: true, force: true }); });
const payload = { modelId: fruitFlyTrap.id, modelVersion: fruitFlyTrap.version, parameters: fruitFlyTrap.defaults };

describe('model and render API', () => {
  it('serves the catalogue, reference STL, and OpenAPI', async () => {
    const catalogue = await app.inject('/api/v1/models');
    expect(catalogue.statusCode).toBe(200);
    expect(catalogue.json<{ id: string }[]>().map(item => item.id).sort()).toEqual(['ai-rubber-duck', 'cigarette-case', 'fruit-fly-trap', 'litter-shovel', 'moss-planter', 'plank-connector', 'pressure-pad', 'toggle-latch', 'window-cat-guard']);
    const detail = await app.inject('/api/v1/models/fruit-fly-trap');
    const model = Value.Parse(ModelDetailSchema, detail.json<unknown>());
    expect(model.parameterSchema).toMatchObject({ type: 'object', additionalProperties: false, properties: { trapDiameter: { type: 'number', minimum: 20, maximum: 200 } } });
    expect(model.artifactFormat).toBe('stl');
    expect(model.customizable).toBe(true);
    expect((await app.inject('/api/v1/models/fruit-fly-trap/reference.stl')).rawPayload.length).toBeGreaterThan(100000);
    expect((await app.inject('/api/openapi.json')).body).toContain('createRender');
    expect((await app.inject('/api/v1/models/missing')).statusCode).toBe(404);
  });

  it('serves the eight duck choices, their default colors and accepts only the public controls', async () => {
    const response = await app.inject('/api/v1/models/ai-rubber-duck');
    expect(response.statusCode).toBe(200);
    const model = Value.Parse(ModelDetailSchema, response.json<unknown>());
    expect(model.artifactFormat).toBe('zip');
    expect(model.controls.map(control => control.key)).toEqual(['variant', 'bodyLength', 'clearance']);
    expect(model.controls[0]?.options?.map(option => option.value)).toEqual([...AI_DUCK_VARIANTS]);
    expect(model.assembly?.partColors).toEqual({ body: '#ffda4a', face: '#d7774b' });
    const post = (change: Record<string, unknown>) => app.inject({ method: 'POST', url: '/api/v1/renders', payload: {
      modelId: aiRubberDuck.id, modelVersion: '1', parameters: { ...aiRubberDuck.defaults, ...change },
    } });
    for (const variant of AI_DUCK_VARIANTS) expect((await post({ variant })).statusCode).toBeLessThan(300);
    for (const change of [{ variant: 'other' }, { bodyLength: 69 }, { clearance: 0.26 }, { PART: 'bar' }, { RIBS: false }])
      expect((await post(change)).statusCode).toBeGreaterThanOrEqual(400);
  });

  it('serves the moss planter as a customizable, five-part, ZIP-formatted assembly model', async () => {
    const detail = await app.inject('/api/v1/models/moss-planter');
    const model = Value.Parse(ModelDetailSchema, detail.json<unknown>());
    expect(model.parameterSchema).toMatchObject({ type: 'object', additionalProperties: false });
    expect(model.artifactFormat).toBe('zip');
    expect(model.customizable).toBe(true);
    expect(model.controls.map(control => control.key)).toEqual(['towerDiameter', 'spikeLength', 'shortRauteRows', 'tallRauteRows', 'rauteColumns']);
    expect(model.defaults).toEqual(mossPlanter.defaults);
    expect(model.parts).toHaveLength(5);
    expect(model.assembly).toBeUndefined();
    expect(model.referenceUrl).toBeUndefined();
    expect((await app.inject('/api/v1/models/moss-planter/reference.stl')).statusCode).toBe(404);
  });

  it('serves the cigarette case as a five-part, ZIP-formatted assembly with a snap-mode enum', async () => {
    const detail = await app.inject('/api/v1/models/cigarette-case');
    const model = Value.Parse(ModelDetailSchema, detail.json<unknown>());
    expect(model.artifactFormat).toBe('zip');
    expect(model.customizable).toBe(true);
    expect(model.controls.map(control => control.kind)).toEqual(['enum', 'enum', 'enum', 'enum', 'enum', 'enum', 'enum', 'text', 'enum', 'number', 'svg', 'number', 'enum', 'number', ...Array<string>(9).fill('number')]);
    // the magnets are real parts, linked to the parts library, and offered only in magnet mode
    expect(model.controls.find(control => control.key === 'magnet')).toMatchObject({ part: { family: 'magnet', attribute: null }, visibleWhen: { control: 'snap', values: ['magnet'] }, default: 'supermagnete-s-06-02-n' });
    const clearanceControl = model.controls.find(control => control.key === 'clearance');
    expect(clearanceControl).toMatchObject({ key: 'clearance', group: 'advanced', default: 0.2, minimum: 0.1, maximum: 0.6 });
    expect(clearanceControl?.recommended?.map(entry => entry.control)).toEqual(['snap', 'miniLidSnap', 'holderSnap', 'lighterSnap', 'miniBoxSnap']);
    expect(model.defaults).toEqual(cigaretteCase.defaults);
    expect(model.parts).toHaveLength(6);
    expect(model.assembly).toEqual(cigaretteCase.assembly);
    expect(model.referenceUrl).toBeUndefined();
    const accepted = await app.inject({ method: 'POST', url: '/api/v1/renders', payload: { modelId: cigaretteCase.id, modelVersion: cigaretteCase.version, parameters: { ...cigaretteCase.defaults, snap: 'magnet', holderSnap: 'detent', lighterSnap: 'crush-ribs', engraveText: 'Tom', textMode: 'second-filament' } } });
    expect(accepted.statusCode).toBeLessThan(300);
    const unknownMode = await app.inject({ method: 'POST', url: '/api/v1/renders', payload: { modelId: cigaretteCase.id, modelVersion: cigaretteCase.version, parameters: { ...cigaretteCase.defaults, snap: 'glue' } } });
    expect(unknownMode.statusCode).toBeGreaterThanOrEqual(400);
    const longText = await app.inject({ method: 'POST', url: '/api/v1/renders', payload: { modelId: cigaretteCase.id, modelVersion: cigaretteCase.version, parameters: { ...cigaretteCase.defaults, engraveText: 'W'.repeat(12) } } });
    expect(longText.statusCode).toBeGreaterThanOrEqual(400);
    expect(longText.json<{ issues: { field: string }[] }>().issues[0]?.field).toBe('engraveText');
    const quoted = await app.inject({ method: 'POST', url: '/api/v1/renders', payload: { modelId: cigaretteCase.id, modelVersion: cigaretteCase.version, parameters: { ...cigaretteCase.defaults, engraveText: 'a"b\\c' } } });
    expect(quoted.statusCode).toBeLessThan(300);
    expect(unknownMode.statusCode).toBeGreaterThanOrEqual(400);
    const extra = await app.inject({ method: 'POST', url: '/api/v1/renders', payload: { modelId: cigaretteCase.id, modelVersion: cigaretteCase.version, parameters: { ...cigaretteCase.defaults, anything: 1 } } });
    expect(extra.statusCode).toBeGreaterThanOrEqual(400);
  });

  it('accepts the longest valid logo within the request size limit, and refuses anything but a logo string', async () => {
    const post = (logo: string) => app.inject({ method: 'POST', url: '/api/v1/renders', payload: { modelId: cigaretteCase.id, modelVersion: cigaretteCase.version, parameters: { ...cigaretteCase.defaults, undersideMark: 'logo', logo, textMode: 'second-filament' } } });
    // LOGO_MAX_POINTS points at their longest, in as many three-point rings as fit
    const ring = 'M2000 2000L2000 2000L2000 2000Z';
    const rings = Math.floor(LOGO_MAX_POINTS / 3);
    const longest = ring.repeat(rings - 1) + 'M2000 2000' + 'L2000 2000'.repeat(LOGO_MAX_POINTS - 3 * (rings - 1) - 1) + 'Z';
    expect(longest.length).toBeLessThanOrEqual(LOGO_MAX_LENGTH);
    expect((await post(longest)).statusCode).toBeLessThan(300);
    const tooMany = await post(longest.replace(/Z$/, 'L2000 2000Z'));
    expect(tooMany.statusCode).toBe(422);
    expect(tooMany.json<{ issues: { field: string }[] }>().issues[0]?.field).toBe('logo');
    for (const logo of ['<svg onload="alert(1)"/>', 'M0 0L10 0L10 10Z" import("/etc/passwd")', 'M0 0L10 0L10 10'])
      expect((await post(logo)).statusCode, logo).toBeGreaterThanOrEqual(400);
  });

  it('serves the plank connector as a single-STL model with a screw-hole enum and accepts each screw size', async () => {
    const detail = await app.inject('/api/v1/models/plank-connector');
    const model = Value.Parse(ModelDetailSchema, detail.json<unknown>());
    expect(model.artifactFormat).toBe('stl');
    expect(model.customizable).toBe(true);
    expect(model.defaults).toEqual(plankConnector.defaults);
    expect(model.controls.find(control => control.key === 'screwHoles')?.options?.map(option => option.value)).toEqual(['none', 'M2', 'M2.5', 'M3', 'M4', 'M5', 'M6', 'M8']);
    expect(model.parts).toBeUndefined();
    const render = (parameters: Record<string, unknown>) => app.inject({ method: 'POST', url: '/api/v1/renders', payload: { modelId: plankConnector.id, modelVersion: plankConnector.version, parameters: { ...plankConnector.defaults, ...parameters } } });
    for (const screwHoles of ['none', 'M3', 'M8']) expect((await render({ screwHoles })).statusCode, screwHoles).toBeLessThan(300);
    expect((await render({ screwHoles: 'M7' })).statusCode).toBeGreaterThanOrEqual(400);
    const shallow = await render({ screwHoles: 'M8', holeFit: 'coarse', insertionDepth: 10 });
    expect(shallow.statusCode).toBeGreaterThanOrEqual(400);
    expect(shallow.json<{ issues: { field: string }[] }>().issues[0]?.field).toBe('insertionDepth');
  });

  it('serves the parts library: families with counts, a family with its parts and sources, and one part with its users', async () => {
    const list = await app.inject('/api/v1/part-families');
    expect(list.statusCode).toBe(200);
    const families = list.json<unknown[]>().map(family => Value.Parse(PartFamilySummarySchema, family));
    expect(families.map(family => family.id)).toEqual(partFamilies.map(family => family.id));
    expect(families.reduce((sum, family) => sum + family.count, 0)).toBe(parts.length);
    const screws = Value.Parse(PartFamilyDetailSchema, (await app.inject('/api/v1/part-families/screw')).json<unknown>());
    expect(screws.parts.every(part => part.family === 'screw')).toBe(true);
    // every source a part or a dimension cites is served with the family
    const served = new Set(screws.sources.map(source => source.id));
    for (const part of screws.parts) for (const id of [...part.sources, ...Object.values(part.dimensions).map(value => value.source)]) expect(served.has(id), `${part.id}: ${id}`).toBe(true);
    // the plank connector links every M3 screw through its screw-hole sizes
    expect(screws.usage['iso-4762-m3x10']).toEqual([{ modelId: 'plank-connector', modelTitle: plankConnector.title, via: 'Screw holes', kind: 'model' },
      // the toggle latch links it by its thread and as a machine screw it offers
      { modelId: 'toggle-latch', modelTitle: 'Toggle latch', via: 'Thread', kind: 'model' }, { modelId: 'toggle-latch', modelTitle: 'Toggle latch', via: 'Machine screw', kind: 'model' }]);
    // a concept page that uses a part is listed too, as a concept
    const foot = Value.Parse(PartDetailSchema, (await app.inject('/api/v1/parts/ganter-gn-343-2-32-m8-63-kr')).json());
    expect(foot.usage).toEqual([
      { modelId: 'catio/window-insert', modelTitle: 'Window catio: window insert', via: 'Spreader feet (32 mm)', kind: 'concept' },
      { modelId: 'catio/tunnel', modelTitle: 'Window catio: tunnel', via: 'Support feet (32 mm)', kind: 'concept' },
    ]);
    const lighter = Value.Parse(PartDetailSchema, (await app.inject('/api/v1/parts/bic-j25-mini-lighter')).json<unknown>());
    expect(lighter.family.id).toBe('everyday-object');
    expect(lighter.usage).toEqual([{ modelId: 'cigarette-case', modelTitle: cigaretteCase.title, via: 'Assembly preview', kind: 'model' }]);
    expect(lighter.sources.map(source => source.kind)).toContain('manufacturer');
    for (const url of ['/api/v1/part-families/missing', '/api/v1/parts/missing']) {
      const missing = await app.inject(url);
      expect(missing.statusCode, url).toBe(404);
      expect(Value.Check(ErrorSchema, missing.json<unknown>())).toBe(true);
    }
  });

  it('serves the litter shovel as a three-part ZIP model and validates the sieve and the snaps', async () => {
    const detail = await app.inject('/api/v1/models/litter-shovel');
    const model = Value.Parse(ModelDetailSchema, detail.json<unknown>());
    expect(model.artifactFormat).toBe('zip');
    expect(model.defaults).toEqual(litterShovel.defaults);
    expect(model.parts?.map(part => part.id)).toEqual(['container', 'scoop', 'handle']);
    expect(model.controls.find(control => control.key === 'sievePattern')?.options?.map(option => option.value)).toEqual(['slots', 'staggered', 'round', 'hex']);
    const render = (parameters: Record<string, unknown>) => app.inject({ method: 'POST', url: '/api/v1/renders', payload: { modelId: litterShovel.id, modelVersion: litterShovel.version, parameters: { ...litterShovel.defaults, ...parameters } } });
    for (const sievePattern of ['slots', 'staggered', 'round', 'hex']) expect((await render({ sievePattern })).statusCode, sievePattern).toBeLessThan(300);
    for (const handleSnap of ['friction', 'detent']) expect((await render({ handleSnap, scoopSnap: handleSnap })).statusCode, handleSnap).toBeLessThan(300);
    expect((await render({ sievePattern: 'diamond' })).statusCode).toBeGreaterThanOrEqual(400);
    expect((await render({ scoopSnap: 'clip' })).statusCode).toBeGreaterThanOrEqual(400);
    const short = await render({ sieveSizing: 'length', gapWidth: 10, gapLength: 8 });
    expect(short.statusCode).toBeGreaterThanOrEqual(400);
    expect(short.json<{ issues: { field: string }[] }>().issues[0]?.field).toBe('gapLength');
    // a slot longer than the scoop's length leaves room for is rejected too, and too many rows of slots
    const long = await render({ sieveSizing: 'length', scoopLength: 90, gapLength: 50 });
    expect(long.json<{ issues: { field: string }[] }>().issues[0]?.field).toBe('gapLength');
    const rows = await render({ scoopLength: 90, sieveRows: 5 });
    expect(rows.json<{ issues: { field: string }[] }>().issues[0]?.field).toBe('sieveRows');
  });

  it('rejects unknown models, stale versions, and invalid fields', async () => {
    expect((await app.inject({ method: 'POST', url: '/api/v1/renders', payload: { ...payload, modelId: 'missing' } })).statusCode).toBe(404);
    expect((await app.inject({ method: 'POST', url: '/api/v1/renders', payload: { ...payload, modelVersion: 'old' } })).statusCode).toBe(409);
    for (const parameters of [{ ...payload.parameters, trapDiameter: '60' }, { ...payload.parameters, trapDiameter: 20, nozzleDiameter: 20 }, { ...payload.parameters, surprise: 1 }]) {
      const response = await app.inject({ method: 'POST', url: '/api/v1/renders', payload: { ...payload, parameters } });
      expect(response.statusCode).toBe(422);
      expect(Value.Check(ErrorSchema, response.json<unknown>())).toBe(true);
    }
  });

  it('deduplicates jobs, prevents early download, and rejects expired renders', async () => {
    const response = await app.inject({ method: 'POST', url: '/api/v1/renders', payload });
    expect(response.statusCode).toBe(202);
    const job = Value.Parse(RenderSchema, response.json<unknown>());
    const again = await app.inject({ method: 'POST', url: '/api/v1/renders', payload });
    expect(Value.Parse(RenderSchema, again.json<unknown>()).id).toBe(job.id);
    expect((await app.inject(`/api/v1/renders/${job.id}/stl`)).statusCode).toBe(409);
    time += CACHE_TTL_MS + 1;
    expect((await app.inject(`/api/v1/renders/${job.id}`)).statusCode).toBe(410);
    expect((await app.inject(`/api/v1/renders/${job.id}/stl`)).statusCode).toBe(410);
  });

  it('reports a failed render with its classification, detail, reference and retry advice, and requeues it when asked again', async () => {
    const created = Value.Parse(RenderSchema, (await app.inject({ method: 'POST', url: '/api/v1/renders', payload })).json<unknown>());
    const claimed = store.claim();
    if (!claimed?.leaseToken) throw new Error('Expected to claim the job');
    const envelope = { code: 'GEOMETRY_INVALID', message: 'This combination of settings hits a defect in the model.', issues: [], detail: '"Scoop" (scoop): The mesh contains a zero-area triangle.', reference: created.id, retryable: false };
    store.fail(claimed.id, claimed.leaseToken, envelope);
    const failed = Value.Parse(RenderSchema, (await app.inject(`/api/v1/renders/${created.id}`)).json<unknown>());
    expect(failed.status).toBe('failed');
    expect(failed.error).toEqual(envelope);
    expect(Value.Check(ErrorSchema, failed.error)).toBe(true);
    const again = Value.Parse(RenderSchema, (await app.inject({ method: 'POST', url: '/api/v1/renders', payload })).json<unknown>());
    expect(again.status).toBe('queued');
    expect(again.error).toBeNull();
  });

  const mossPayload = { modelId: mossPlanter.id, modelVersion: mossPlanter.version, parameters: mossPlanter.defaults };

  it('accepts a moss planter render request, deduplicates it, and points at the ZIP route', async () => {
    const response = await app.inject({ method: 'POST', url: '/api/v1/renders', payload: mossPayload });
    expect(response.statusCode).toBe(202);
    const job = Value.Parse(RenderSchema, response.json<unknown>());
    const again = await app.inject({ method: 'POST', url: '/api/v1/renders', payload: mossPayload });
    expect(Value.Parse(RenderSchema, again.json<unknown>()).id).toBe(job.id);
    expect((await app.inject(`/api/v1/renders/${job.id}/zip`)).statusCode).toBe(409);
    expect((await app.inject(`/api/v1/renders/${job.id}/stl`)).statusCode).toBe(409);
    time += CACHE_TTL_MS + 1;
    expect((await app.inject(`/api/v1/renders/${job.id}`)).statusCode).toBe(410);
    expect((await app.inject(`/api/v1/renders/${job.id}/zip`)).statusCode).toBe(410);
  });

  it('rejects moss planter requests with unknown, out-of-range or inconsistent parameters, and stale versions', async () => {
    for (const parameters of [{ ...mossPlanter.defaults, anything: 1 }, { ...mossPlanter.defaults, towerDiameter: 500 }, { ...mossPlanter.defaults, spikeLength: 10 }, {}]) {
      const response = await app.inject({ method: 'POST', url: '/api/v1/renders', payload: { ...mossPayload, parameters } });
      expect(response.statusCode, JSON.stringify(parameters)).toBe(422);
      expect(Value.Check(ErrorSchema, response.json<unknown>())).toBe(true);
    }
    expect((await app.inject({ method: 'POST', url: '/api/v1/renders', payload: { ...mossPayload, modelVersion: '1' } })).statusCode).toBeGreaterThanOrEqual(400);
  });

  it('renders distinct moss planter settings as distinct cached jobs', async () => {
    const one = await app.inject({ method: 'POST', url: '/api/v1/renders', payload: mossPayload });
    const other = await app.inject({ method: 'POST', url: '/api/v1/renders', payload: { ...mossPayload, parameters: { ...mossPlanter.defaults, towerDiameter: 77 } } });
    expect(other.statusCode).toBe(202);
    expect(Value.Parse(RenderSchema, other.json<unknown>()).id).not.toBe(Value.Parse(RenderSchema, one.json<unknown>()).id);
  });
});
