import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Value } from 'typebox/value';
import { cigaretteCase, ErrorSchema, LOGO_MAX_LENGTH, LOGO_MAX_POINTS, fruitFlyTrap, ModelDetailSchema, mossPlanter, PartDetailSchema, PartFamilyDetailSchema, PartFamilySummarySchema, partFamilies, parts, plankConnector, RenderSchema } from '@canfactory/contracts';
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
    expect(catalogue.json<{ id: string }[]>().map(item => item.id).sort()).toEqual(['cigarette-case', 'fruit-fly-trap', 'moss-planter', 'plank-connector']);
    const detail = await app.inject('/api/v1/models/fruit-fly-trap');
    const model = Value.Parse(ModelDetailSchema, detail.json<unknown>());
    expect(model.parameterSchema).toMatchObject({ type: 'object', additionalProperties: false, properties: { trapDiameter: { type: 'number', minimum: 20, maximum: 200 } } });
    expect(model.artifactFormat).toBe('stl');
    expect(model.customizable).toBe(true);
    expect((await app.inject('/api/v1/models/fruit-fly-trap/reference.stl')).rawPayload.length).toBeGreaterThan(100000);
    expect((await app.inject('/api/openapi.json')).body).toContain('createRender');
    expect((await app.inject('/api/v1/models/missing')).statusCode).toBe(404);
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
    expect(screws.usage['iso-4762-m3x10']).toEqual([{ modelId: 'plank-connector', modelTitle: plankConnector.title, via: 'Screw holes' }]);
    const lighter = Value.Parse(PartDetailSchema, (await app.inject('/api/v1/parts/bic-j25-mini-lighter')).json<unknown>());
    expect(lighter.family.id).toBe('everyday-object');
    expect(lighter.usage).toEqual([{ modelId: 'cigarette-case', modelTitle: cigaretteCase.title, via: 'Assembly preview' }]);
    expect(lighter.sources.map(source => source.kind)).toContain('manufacturer');
    for (const url of ['/api/v1/part-families/missing', '/api/v1/parts/missing']) {
      const missing = await app.inject(url);
      expect(missing.statusCode, url).toBe(404);
      expect(Value.Check(ErrorSchema, missing.json<unknown>())).toBe(true);
    }
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
