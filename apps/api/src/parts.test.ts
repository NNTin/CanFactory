import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Value } from 'typebox/value';
import { ErrorSchema, findPart, PartLayoutSchema, PartResponseSchema, prototypeBoardLayout, type Part, type PartLayout, type PartResponse } from '@canfactory/contracts';
import { createApp, partsVersion } from './app.ts';

// The parts routes read only the bundled contracts: no storage.
let app: Awaited<ReturnType<typeof createApp>>;
beforeAll(async () => { app = await createApp(); });
afterAll(async () => { await app.close(); });

describe('parts API', () => {
  it('serves a part with its family and resolved sources, and links a board to its layout', async () => {
    const response = await app.inject('/api/v1/parts/alpha-wire-3051-1');
    expect(response.statusCode).toBe(200);
    const body = response.json<PartResponse>();
    expect(Value.Check(PartResponseSchema, body)).toBe(true);
    expect(body.part).toEqual(findPart('alpha-wire-3051-1'));
    expect(body.family.id).toBe('hookup-wire');
    expect(body.sources.map(source => source.id).sort()).toEqual(['alpha-wire-3051-1', 'astm-b258-table']);
    expect(body.layout).toBeNull();
    expect(response.json<PartResponse>().part.dimensions['D']).toMatchObject({ value: 1.4478, max: 1.4986, basis: 'manufacturer' });
    for (const id of ['adafruit-perma-proto-half', 'seeed-xiao-esp32s3-sense'])
      expect((await app.inject(`/api/v1/parts/${id}`)).json<PartResponse>().layout, id).toBe(`/api/v1/parts/${id}/layout`);
  });

  it('serves a prototype board’s layout in the prototypeBoardLayout frame: outline, grid, labels, pads, holes, traces, nets, mounting holes', async () => {
    const response = await app.inject('/api/v1/parts/adafruit-perma-proto-half/layout');
    expect(response.statusCode).toBe(200);
    const layout = response.json<PartLayout>();
    expect(Value.Check(PartLayoutSchema, layout)).toBe(true);
    if (layout.kind !== 'prototype-board') throw new Error(layout.kind);
    const source = prototypeBoardLayout(findPart('adafruit-perma-proto-half') as Part);
    expect(layout.outline).toEqual({ L: 81.28, W: 50.8, t: 1.6, r: 2.54 });
    expect(layout.grid).toEqual({ x0: 3.81, y0: 3.81, pitch: 2.54, columns: 30, rows: 18 });
    expect(layout.drill).toBe(1.2);
    expect(layout.pads.top).toEqual({ shape: 'round', size: 1.9304 });
    expect(layout.columnLabels[0]).toBe('1');
    expect(layout.rowLabels[3]).toBe('A');
    expect(layout.holes).toHaveLength(source?.holes.length ?? 0);
    expect(layout.holes.find(hole => hole.label === 'A1')).toMatchObject({ column: 0, row: 3, x: 3.81, y: 11.43, net: 'strip 1A-E' });
    expect(layout.traces).toHaveLength(source?.traces.length ?? 0);
    expect(layout.traces[0]).toMatchObject({ side: 'bottom' });
    expect(layout.nets.find(net => net.id === 'rail top +')?.holes).toHaveLength(30);
    expect(layout.mountingHoles).toEqual(source?.mountingHoles);
    expect(layout.frame).toContain('columns along +X');
    // every board of the family, and a stripboard's strips as nets
    const st1 = (await app.inject('/api/v1/parts/busboard-st1/layout')).json<PartLayout>();
    expect(st1.kind === 'prototype-board' && st1.nets.some(net => net.id === 'strip 1')).toBe(true);
  });

  it('serves a development board’s layout', async () => {
    const layout = (await app.inject('/api/v1/parts/seeed-xiao-esp32s3-sense/layout')).json<PartLayout>();
    expect(Value.Check(PartLayoutSchema, layout)).toBe(true);
    if (layout.kind !== 'dev-board') throw new Error(layout.kind);
    expect(layout.outline).toMatchObject({ W: 17.8, L: 21 });
    expect(layout.pins.length).toBeGreaterThan(10);
    expect(layout.externalAntenna?.kind).toBe('connector');
  });

  it('answers 404 for an unknown part or a part without a layout', async () => {
    const missing = await app.inject('/api/v1/parts/no-such-part');
    expect(missing.statusCode).toBe(404);
    expect(Value.Check(ErrorSchema, missing.json())).toBe(true);
    expect(missing.json<{ code: string }>().code).toBe('PART_NOT_FOUND');
    expect((await app.inject('/api/v1/parts/no-such-part/layout')).json<{ code: string }>().code).toBe('PART_NOT_FOUND');
    const screw = await app.inject('/api/v1/parts/alpha-wire-3051-1/layout');
    expect(screw.statusCode).toBe(404);
    expect(screw.json<{ code: string }>().code).toBe('LAYOUT_NOT_AVAILABLE');
    expect((await app.inject('/api/v1/parts/bad%20id')).statusCode).toBeGreaterThanOrEqual(400);
  });

  it('is cacheable: the ETag is the parts library’s version, and a matching If-None-Match answers 304', async () => {
    const first = await app.inject('/api/v1/parts/adafruit-perma-proto-quarter/layout');
    const etag = first.headers.etag;
    expect(etag).toBe(`"parts-${partsVersion()}"`);
    expect(first.headers['cache-control']).toBe('public, max-age=300');
    expect((await app.inject('/api/v1/parts/alpha-wire-3050-1')).headers.etag).toBe(etag);
    for (const header of [String(etag), `W/${String(etag)}`, `"other", ${String(etag)}`]) {
      const again = await app.inject({ url: '/api/v1/parts/adafruit-perma-proto-quarter/layout', headers: { 'if-none-match': header } });
      expect(again.statusCode, header).toBe(304);
      expect(again.body, header).toBe('');
    }
    const stale = await app.inject({ url: '/api/v1/parts/adafruit-perma-proto-quarter/layout', headers: { 'if-none-match': '"parts-0"' } });
    expect(stale.statusCode).toBe(200);
  });
});
