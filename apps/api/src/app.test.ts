import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Value } from 'typebox/value';
import { aiRubberDuck, AI_DUCK_VARIANTS, cigaretteCase, ErrorSchema, LOGO_MAX_LENGTH, LOGO_MAX_POINTS, fruitFlyTrap, litterShovel, MarketInfoSchema, mossPlanter, offers, OffersSchema, plankConnector, RenderSchema, type Offer } from '@canfactory/contracts';
import type { PostgresStorage } from '@canfactory/server';
import { expireJobs, testStorage } from '../../../tools/unit-storage.ts';
import { createApp } from './app.ts';

let store: PostgresStorage;
let app: Awaited<ReturnType<typeof createApp>>;
beforeEach(async () => { store = await testStorage(); app = await createApp(store); });
afterEach(async () => { await app.close(); await store.close(); });
const payload = { modelId: fruitFlyTrap.id, modelVersion: fruitFlyTrap.version, parameters: fruitFlyTrap.defaults };

describe('model and render API', () => {
  it('serves the reference STL and OpenAPI, but not the catalogue: the web app bundles it from contracts', async () => {
    expect((await app.inject('/api/v1/models/fruit-fly-trap/reference.stl')).rawPayload.length).toBeGreaterThan(100000);
    expect((await app.inject('/api/v1/models/missing/reference.stl')).json<{ code: string }>().code).toBe('MODEL_NOT_FOUND');
    expect((await app.inject('/api/openapi.json')).body).toContain('createRender');
    for (const url of ['/api/v1/models', '/api/v1/models/fruit-fly-trap', '/api/v1/part-families', '/api/v1/part-families/screw', '/api/v1/parts/iso-4762-m3x10']) {
      const removed = await app.inject(url);
      expect(removed.json<{ code: string }>().code, url).toBe('NOT_FOUND');
    }
  });

  it('accepts the eight duck choices and only the public controls', async () => {
    const post = (change: Record<string, unknown>) => app.inject({ method: 'POST', url: '/api/v1/renders', payload: {
      modelId: aiRubberDuck.id, modelVersion: '1', parameters: { ...aiRubberDuck.defaults, ...change },
    } });
    for (const variant of AI_DUCK_VARIANTS) expect((await post({ variant })).statusCode).toBeLessThan(300);
    for (const change of [{ variant: 'other' }, { bodyLength: 69 }, { clearance: 0.26 }, { PART: 'bar' }, { RIBS: false }])
      expect((await post(change)).statusCode).toBeGreaterThanOrEqual(400);
  });

  it('has no reference STL for the moss planter', async () => {
    expect((await app.inject('/api/v1/models/moss-planter/reference.stl')).json<{ code: string }>().code).toBe('REFERENCE_NOT_AVAILABLE');
  });

  it('validates the cigarette case’s snap modes and engraving', async () => {
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

  it('accepts each of the plank connector’s screw sizes', async () => {
    const render = (parameters: Record<string, unknown>) => app.inject({ method: 'POST', url: '/api/v1/renders', payload: { modelId: plankConnector.id, modelVersion: plankConnector.version, parameters: { ...plankConnector.defaults, ...parameters } } });
    for (const screwHoles of ['none', 'M3', 'M8']) expect((await render({ screwHoles })).statusCode, screwHoles).toBeLessThan(300);
    expect((await render({ screwHoles: 'M7' })).statusCode).toBeGreaterThanOrEqual(400);
    const shallow = await render({ screwHoles: 'M8', holeFit: 'coarse', insertionDepth: 10 });
    expect(shallow.statusCode).toBeGreaterThanOrEqual(400);
    expect(shallow.json<{ issues: { field: string }[] }>().issues[0]?.field).toBe('insertionDepth');
  });

  it('validates the litter shovel’s sieve and snaps', async () => {
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
    await expireJobs(store);
    expect((await app.inject(`/api/v1/renders/${job.id}`)).statusCode).toBe(410);
    expect((await app.inject(`/api/v1/renders/${job.id}/stl`)).statusCode).toBe(410);
  });

  it('reports a failed render with its classification, detail, reference and retry advice, and requeues it when asked again', async () => {
    const created = Value.Parse(RenderSchema, (await app.inject({ method: 'POST', url: '/api/v1/renders', payload })).json<unknown>());
    const claimed = await store.claim();
    if (!claimed?.leaseToken) throw new Error('Expected to claim the job');
    const envelope = { code: 'GEOMETRY_INVALID', message: 'This combination of settings hits a defect in the model.', issues: [], detail: '"Scoop" (scoop): The mesh contains a zero-area triangle.', reference: created.id, retryable: false };
    await store.fail(claimed.id, claimed.leaseToken, envelope);
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
    await expireJobs(store);
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

describe('offers API', () => {
  const accounts = { amazon: { DE: 'canfactory-21', US: 'canfactory-20' }, awin: { publisherId: 12345 } };
  const shopOffer: Offer = {
    id: 'awin-de-test', market: 'DE', network: 'awin', advertiserId: 777, shop: 'Test Shop', merchantProductId: 'SKU-1', productUrl: 'https://shop.example/m3',
    title: 'Test shop M3 inserts, pack of 25', covers: [{ partId: 'ruthex-rx-m3x5-7', quantity: 25 }], rank: 0, checkedOn: '2026-10-06', note: null, sameAsProduct: false,
  };

  it('picks the market from Cloudflare’s country and says which networks link (CanFactory’s accounts by default)', async () => {
    const market = async (country?: string) => Value.Parse(MarketInfoSchema, (await app.inject({ url: '/api/v1/market', headers: country ? { 'cf-ipcountry': country } : {} })).json<unknown>());
    expect(await market('AT')).toEqual({ market: 'DE', country: 'AT', source: 'geo', networks: { DE: { amazon: true, awin: true }, US: { amazon: true, awin: true } } });
    expect(await market('fr')).toMatchObject({ market: 'US', country: 'FR', source: 'geo' });
    expect(await market('XX')).toMatchObject({ market: 'US', country: null, source: 'default' });
    expect(await market()).toMatchObject({ market: 'US', country: null, source: 'default' });
    expect((await app.inject('/api/v1/market')).headers['cache-control']).toBe('private, no-store');
  });

  it('links nothing without accounts, and rejects unknown parts and malformed queries', async () => {
    const unlinked = await createApp(store, false, { accounts: { amazon: { DE: null, US: null }, awin: { publisherId: null } } });
    try {
      const response = await unlinked.inject('/api/v1/offers?market=DE&parts=ruthex-rx-m3x5-7:4');
      expect(response.statusCode).toBe(200);
      expect(Value.Parse(OffersSchema, response.json<unknown>())).toEqual({ market: 'DE', networks: { amazon: false, awin: false }, matches: [{ partId: 'ruthex-rx-m3x5-7', quantity: 4, offers: [] }], shops: [] });
    } finally { await unlinked.close(); }
    expect((await app.inject('/api/v1/offers?market=DE&parts=no-such-part')).statusCode).toBe(404);
    for (const query of ['market=FR&parts=ruthex-rx-m3x5-7', 'market=DE&parts=Bad', 'market=DE&parts=ruthex-rx-m3x5-7:0', 'market=DE']) {
      expect((await app.inject(`/api/v1/offers?${query}`)).statusCode, query).toBeGreaterThanOrEqual(400);
    }
  });

  it('serves curated Amazon links, the Awin price of a fresh feed, and searches for the rest', async () => {
    const time = Date.now();
    const lastImported = time - 3_600_000;
    await store.saveAwinFeed({ feedId: 42, advertiserId: 777, lastImported }, [{ advertiserId: 777, merchantProductId: 'SKU-1', market: 'DE',
      deepLink: 'https://www.awin1.com/pclick.php?p=1', name: 'M3', price: 4.99, currency: 'EUR', deliveryCost: 3.95, inStock: true, lastImported }]);
    const linked = await createApp(store, false, { accounts, now: () => time, catalogue: [shopOffer, ...offers] });
    try {
      const response = await linked.inject('/api/v1/offers?market=DE&parts=ruthex-rx-m3x5-7:30,iso-4762-m3x10:4');
      const result = Value.Parse(OffersSchema, response.json<unknown>());
      expect(result.networks).toEqual({ amazon: true, awin: true });
      expect(result.matches[0]?.offers.map(offer => offer.shopKey)).toEqual(['amazon-DE', 'awin-777', 'amazon-DE']);
      expect(result.matches[0]?.offers[1]).toMatchObject({ url: 'https://www.awin1.com/pclick.php?p=1', packs: 2, price: { amount: 4.99, currency: 'EUR', deliveryCost: 3.95, asOf: new Date(lastImported).toISOString() } });
      expect(result.matches[1]?.offers[0]).toMatchObject({ kind: 'search', url: 'https://www.amazon.de/s?k=ISO%204762%20M3%20%C3%97%2010&tag=canfactory-21' });
      expect(result.shops.map(shop => shop.shopKey)).toEqual(['amazon-DE']);
      expect(response.headers['cache-control']).toBe('public, max-age=300');
    } finally { await linked.close(); }
  });
});
