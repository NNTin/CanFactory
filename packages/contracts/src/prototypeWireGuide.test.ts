import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { activeParts, findPart, hookupWireChannelWidth, prototypeWireGuide, scadDefines, validateParameters, validateWireGuideDesign, linkedPartData, WIRE_GUIDE_LIMITS, type WireGuideDesign } from './index.ts';
import { DEFAULT_WIRE_GUIDE_DESIGN, WIRE_GUIDE_GEOMETRY, wireGuideGeometry, wireGuideScad } from './prototypeWireGuide.ts';

const SAMPLES = new URL('../../../models/prototype-wire-guide/samples/', import.meta.url);
const sample = (name: string) => JSON.parse(readFileSync(new URL(name, SAMPLES), 'utf8')) as WireGuideDesign;
const clone = <T>(value: T): T => structuredClone(value);
/** The value, which the test needs to be there. */
const must = <T>(value: T | undefined): T => { if (value === undefined) throw new Error('Expected a value.'); return value; };
/** Every leaf of a JSON value. */
const leaves = (value: unknown): unknown[] => Array.isArray(value) ? value.flatMap(leaves) : value !== null && typeof value === 'object' ? Object.values(value).flatMap(leaves) : [value];

describe('prototype-wire-guide samples', () => {
  const names = readdirSync(SAMPLES).filter(name => name.endsWith('.json'));
  it('are checked in for one level, two levels with crossings, three prints, each board pattern, KiPrint’s designs and the edge cases', () => {
    expect(names.sort()).toEqual([
      'kiprint-crossing-two-levels.json', 'kiprint-perma-proto-timer.json', 'kiprint-stripboard-regulator.json',
      'perfboard-one-level.json', 'perfboard-two-levels.json', 'perma-proto-bus.json', 'pockets-on-channel-sides.json',
      'stripboard-boss-neighbours.json', 'stripboard-three-prints.json',
    ]);
    expect(names.filter(name => name.startsWith('kiprint-')).every(name => sample(name).source?.tool === 'kiprint')).toBe(true);
    const patterns = new Set(names.map(name => findPart(sample(name).boardPartId)?.attributes['pattern']));
    expect([...patterns].sort()).toEqual(['breadboard strips and rails', 'isolated pads', 'strips']);
  });
  it.each(names)('%s is a valid design and valid parameters', name => {
    expect(validateWireGuideDesign(sample(name))).toEqual([]);
    expect(validateParameters(prototypeWireGuide, { design: sample(name) })).toEqual([]);
  });
  it('the default design is the one-level perfboard sample', () => {
    expect(DEFAULT_WIRE_GUIDE_DESIGN).toEqual(sample('perfboard-one-level.json'));
    expect(validateParameters(prototypeWireGuide, prototypeWireGuide.defaults)).toEqual([]);
  });
});

describe('wireGuideScad', () => {
  it('writes numbers only: no id, net name, footprint or part id reaches SCAD', () => {
    const design = sample('perma-proto-bus.json');
    const literal = wireGuideScad(design);
    expect(leaves(JSON.parse(literal)).every(leaf => typeof leaf === 'number' && Number.isFinite(leaf))).toBe(true);
    expect(literal).toMatch(/^[\d.,[\]-]+$/);
    for (const text of ['W1', '+5V', 'DATA', 'G1', 'kiprint', design.boardPartId, design.wirePartId]) expect(literal).not.toContain(text);
  });
  it('gives each print part its PRINT and the design as GUIDE, and only renders the design’s prints', () => {
    const parameters = { design: sample('stripboard-three-prints.json') };
    const parts = activeParts(prototypeWireGuide, parameters);
    expect(parts.map(part => part.id)).toEqual(['print-1', 'print-2', 'print-3']);
    expect(scadDefines(prototypeWireGuide, must(parts[2]), parameters)).toEqual([['GUIDE', wireGuideScad(parameters.design)], ['PRINT', '2']]);
    expect(activeParts(prototypeWireGuide, prototypeWireGuide.defaults).map(part => part.id)).toEqual(['print-1']);
  });
  it('refuses an invalid design', () => {
    const design = clone(DEFAULT_WIRE_GUIDE_DESIGN); must(design.wires[0]).to = [2, 2];
    expect(() => wireGuideScad(design)).toThrow(/Invalid wire-guide design/);
  });
  it('makes the board and wire data part of the cache fingerprint', () => {
    const ids = linkedPartData(prototypeWireGuide).map(part => part.id);
    expect(ids).toContain('alpha-wire-3051-1');
    expect(ids).toContain('busboard-st1');
  });
});

describe('wireGuideGeometry', () => {
  it('sizes each channel from its own wire and steps the floors up by the widest channel and a bridge', () => {
    const design = sample('perfboard-two-levels.json');
    const [print] = wireGuideGeometry(design);
    if (!print) throw new Error('Expected a print.');
    const w22 = hookupWireChannelWidth(must(findPart('alpha-wire-3051-1')), 0.2), w24 = hookupWireChannelWidth(must(findPart('alpha-wire-3050-1')), 0.2);
    expect(print.wires.map(wire => wire.width)).toEqual([w22, w24, w24, w24].map(width => Math.round(width * 10000) / 10000));
    expect(print.wires.map(wire => wire.layer)).toEqual([0, 1, 1, 0]);
    const [lower, upper] = print.layers;
    expect(lower?.floor).toBeCloseTo(print.plateTop, 6);
    expect(lower?.bridgeBottom).toBeNull();
    expect((upper?.floor ?? 0) - (lower?.floor ?? 0)).toBeCloseTo(w22 + WIRE_GUIDE_GEOMETRY.bridge, 3);
    // the bridge leaves the lower wire's whole channel under it
    expect((upper?.bridgeBottom ?? 0) - (lower?.floor ?? 0)).toBeGreaterThanOrEqual(w22 - 1e-6);
    expect(print.block.zTop).toBeCloseTo((upper?.floor ?? 0) + w22, 3);
    expect(print.funnels).toHaveLength(2 * design.wires.length);
    // edge clips: the plate spans the board's width, a clip in the middle of its length
    expect(print.clips).toHaveLength(1);
    expect(print.block.y0).toBeLessThan(0); expect(print.block.y1).toBeGreaterThan(print.board.W);
    expect(print.bosses).toEqual([]);
  });
  it('stands on bosses in the two nearest mounting holes and pockets the component bodies, a tall one right through', () => {
    const design = clone(DEFAULT_WIRE_GUIDE_DESIGN);
    must(must(design.components)[0]).body.height = 1.5;
    const [print] = wireGuideGeometry(design);
    if (!print) throw new Error('Expected a print.');
    expect(print.bosses).toHaveLength(2);
    expect(print.bosses.every(boss => boss.columnBottom === 1.6 && boss.pin < 2)).toBe(true);
    expect(print.pockets).toHaveLength(2);
    const [dip, capacitor] = print.pockets;
    expect(dip?.top).toBeLessThan(print.block.zTop);
    expect(dip?.top).toBeCloseTo(1.6 + 1.5 + WIRE_GUIDE_GEOMETRY.pocketClearance, 6);
    expect(wireGuideGeometry(DEFAULT_WIRE_GUIDE_DESIGN)[0]?.pockets[0]?.top).toBeGreaterThan(print.block.zTop);
    expect(capacitor?.top).toBeGreaterThan(print.block.zTop);
  });
  it('moves a pocket’s sides, and a round pocket’s extremes, 0.02 mm out off the channels’ sides', () => {
    const design = sample('pockets-on-channel-sides.json');
    const [print] = wireGuideGeometry(design);
    if (!print) throw new Error('Expected a print.');
    const c = WIRE_GUIDE_GEOMETRY.pocketClearance;
    // each body is half a channel + the clearance above its wire: the pocket's near side would lie on the channel's
    const sides = print.wires.map(wire => (print.grid.y0 + must(wire.points[0])[1] * print.grid.pitch) + wire.width / 2);
    print.pockets.forEach((pocket, index) => {
      const keepout = must(design.keepouts?.[index]);
      const near = pocket.kind === 'box' ? pocket.y : pocket.y - pocket.d / 2;
      expect(near).toBeCloseTo(must(sides[index]) - 0.02, 4);
      if (pocket.kind === 'box' && keepout.kind === 'box') {
        expect(pocket.y + pocket.h).toBeCloseTo(keepout.y + keepout.h + c, 4); // the far side is clear of every side: unchanged
        expect([pocket.x, pocket.w]).toEqual([keepout.x - c, keepout.w + 2 * c].map(value => Math.round(value * 10000) / 10000));
      }
    });
    // KiPrint's designs keep their pockets as the bodies + the clearance
    const [timer] = wireGuideGeometry(sample('kiprint-perma-proto-timer.json'));
    expect(timer?.pockets.map(pocket => pocket.kind === 'box' ? pocket.w : pocket.d)).toEqual([9.87, 6.9, 5.6, 6.4]);
  });
  it('compresses a print’s levels to the ones it uses', () => {
    const design = sample('stripboard-three-prints.json');
    const prints = wireGuideGeometry(design);
    expect(prints.map(print => print.layers.map(layer => layer.level))).toEqual([[0], [0, 1], [0]]);
    // the prints' blocks are side by side, never overlapping
    for (let p = 1; p < prints.length; p++) expect(must(prints[p]).block.x0).toBeGreaterThanOrEqual(must(prints[p - 1]).block.x1 - 1e-6);
  });
  it('takes only the mounting holes in a print’s region', () => {
    const design = sample('stripboard-three-prints.json');
    design.guide.registration = 'mounting-holes';
    expect(validateWireGuideDesign(design)).toEqual([]);
    expect(wireGuideGeometry(design).map(print => print.bosses.length)).toEqual([2, 0, 2]);
  });
});

describe('prototype-wire-guide validation', () => {
  it('rejects an invalid design with validateWireGuideDesign’s issues, as fields under `design`', () => {
    const design = clone(DEFAULT_WIRE_GUIDE_DESIGN);
    must(design.wires[1]).from = [2, 2]; // where W1 already ends
    design.guide.funnelTopDiameter = 9; // out of the schema's range
    const contract = validateWireGuideDesign(design);
    expect(contract.length).toBeGreaterThan(0);
    expect(validateParameters(prototypeWireGuide, { design })).toEqual(contract.map(issue => ({ field: `design${issue.path}`, message: issue.message })));
    design.guide.funnelTopDiameter = 2.2;
    expect(validateParameters(prototypeWireGuide, { design })[0]).toEqual({ field: 'design/wires/1/from', message: 'Wire W2 ends at [2, 2], where wire W1 already ends: one wire end per hole.' });
  });
  it('rejects unknown parameters and a missing design', () => {
    expect(validateParameters(prototypeWireGuide, { design: DEFAULT_WIRE_GUIDE_DESIGN, extra: 1 }).length).toBeGreaterThan(0);
    expect(validateParameters(prototypeWireGuide, {}).length).toBeGreaterThan(0);
    expect(validateParameters(prototypeWireGuide, { design: 'W1' })[0]?.field).toBe('design');
  });
  it('bounds the design in the shared validateWireGuideDesign: its size as JSON and its grid points', () => {
    const big = { ...clone(DEFAULT_WIRE_GUIDE_DESIGN), source: { tool: 'kiprint', version: '1', projectId: 'x'.repeat(WIRE_GUIDE_LIMITS.bytes) } };
    const [tooBig] = validateWireGuideDesign(big);
    expect(tooBig?.path).toBe('');
    expect(tooBig?.message).toMatch(/at most 200 kB/);
    // one straight wire per row of a Roth card, through every column as a waypoint: within every item limit, but 2318 grid points
    const row = (r: number) => ({ id: `W${r}`, from: [0, r] as [number, number], to: [60, r] as [number, number], path: Array.from({ length: 59 }, (_, k) => [k + 1, r] as [number, number]), level: 0 });
    const wires = Array.from({ length: 38 }, (_, r) => row(r));
    const long: WireGuideDesign = { ...clone(DEFAULT_WIRE_GUIDE_DESIGN), boardPartId: 'roth-re200-hp', components: [], keepouts: [], wires,
      prints: [{ id: 'G1', wireIds: wires.map(wire => wire.id) }], guide: { ...DEFAULT_WIRE_GUIDE_DESIGN.guide, registration: 'edge-clips' } };
    expect(validateWireGuideDesign(long)).toEqual([{ path: '/wires', message: 'The wires have 2318 grid points (ends and waypoints) in all; a design has at most 2000.' }]);
    expect(validateParameters(prototypeWireGuide, { design: long })).toEqual([{ field: 'design/wires', message: 'The wires have 2318 grid points (ends and waypoints) in all; a design has at most 2000.' }]);
    long.wires = wires.slice(0, 32); long.prints = [{ id: 'G1', wireIds: long.wires.map(wire => wire.id) }];
    expect(validateWireGuideDesign(long)).toEqual([]);
});
});
