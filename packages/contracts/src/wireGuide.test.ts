import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { validateWireGuideDesign, WIRE_GUIDE_LIMITS, wireGuideBoard, wireGuideDesignJsonSchema, type WireGuideDesign } from './index.ts';

/**
 * A valid design on the half Perma-Proto (30 columns; drilled rows 0, 1, 3–7, 10–14, 16, 17): three wires and a crossing on two
 * levels in G1 with a DIP-8 beside them, and a wire with corners in G2, inside its region.
 */
const valid = (): WireGuideDesign => ({
  schemaVersion: 1,
  boardPartId: 'adafruit-perma-proto-half',
  wirePartId: 'alpha-wire-3051-1',
  source: { tool: 'kiprint', version: '0.1.0', projectId: '6f1c1f9e-6f0e-4d7e-9a77-2f3b8d6c1e01' },
  components: [{
    ref: 'U1', footprint: 'DIP-8',
    pins: [[20, 7], [21, 7], [22, 7], [23, 7], [20, 10], [21, 10], [22, 10], [23, 10]],
    // between the pin rows (y 21.59 and 29.21), over columns 20–23 (x 54.61 to 62.23)
    body: { kind: 'box', x: 53.8, y: 22.5, w: 9.2, h: 5.8, height: 4 },
  }],
  wires: [
    { id: 'W1', net: 'VCC', from: [0, 3], to: [5, 3], path: [], level: 0 },
    { id: 'W2', from: [2, 5], to: [2, 11], path: [], level: 0 },
    { id: 'W3', from: [4, 1], to: [4, 6], path: [], level: 1 },
    { id: 'W4', wirePartId: 'jonard-kynar-30awg', from: [10, 3], to: [14, 10], path: [[10, 12], [14, 12]], level: 0 },
    { id: 'W5', from: [20, 6], to: [25, 6], path: [], level: 0 },
  ],
  prints: [
    { id: 'G1', wireIds: ['W1', 'W2', 'W3', 'W5'] },
    { id: 'G2', wireIds: ['W4'], region: { from: [9, 0], to: [16, 17] } },
  ],
  guide: { registration: 'mounting-holes', coverThickness: 1.2, channelClearance: 0.2, funnelTopDiameter: 2.2, funnelBottomDiameter: 1, funnelStandoff: 0.5 },
  keepouts: [{ kind: 'cylinder', cx: 70, cy: 40, d: 4, height: 8 }],
});

/** The issues of the valid design after a change. */
function issuesAfter(change: (design: WireGuideDesign) => void) {
  const design = valid(); change(design);
  return validateWireGuideDesign(design);
}
const wire = (design: WireGuideDesign, id: string) => {
  const found = design.wires.find(w => w.id === id); if (!found) throw new Error(id); return found;
};
const print = (design: WireGuideDesign, id: string) => {
  const found = design.prints.find(p => p.id === id); if (!found) throw new Error(id); return found;
};

describe('wire-guide design', () => {
  it('accepts a valid design, with and without its optional parts', () => {
    expect(validateWireGuideDesign(valid())).toEqual([]);
    const minimal = valid();
    delete minimal.source; delete minimal.components; delete minimal.keepouts;
    expect(validateWireGuideDesign(minimal)).toEqual([]);
    expect(wireGuideBoard(valid())?.grid.columns).toBe(30);
  });

  it('reports schema problems by field, and checks nothing further', () => {
    expect(validateWireGuideDesign(null)[0]?.path).toBe('');
    const paths = (change: (design: Record<string, unknown> & WireGuideDesign) => void) => {
      const design = valid() as Record<string, unknown> & WireGuideDesign; change(design);
      return validateWireGuideDesign(design).map(issue => issue.path);
    };
    expect(paths(d => { (d as Record<string, unknown>)['schemaVersion'] = 2; })).toContain('/schemaVersion');
    expect(paths(d => { d['extra'] = true; }).length).toBeGreaterThan(0);
    expect(paths(d => { wire(d, 'W1').level = WIRE_GUIDE_LIMITS.levels; })).toContain('/wires/0/level');
    expect(paths(d => { wire(d, 'W1').level = 0.5; })).toContain('/wires/0/level');
    expect(paths(d => { wire(d, 'W1').from = [0.5, 3]; })).toContain('/wires/0/from/0');
    expect(paths(d => { wire(d, 'W1').from = [-1, 3]; })).toContain('/wires/0/from/0');
    expect(paths(d => { (wire(d, 'W1') as { from: unknown }).from = [0, 3, 1]; }).some(path => path.startsWith('/wires/0/from'))).toBe(true);
    expect(paths(d => { d.guide.coverThickness = 10; })).toContain('/guide/coverThickness');
    expect(paths(d => { d.guide.channelClearance = -0.1; })).toContain('/guide/channelClearance');
    expect(paths(d => { (d.guide as { registration: string }).registration = 'glue'; })).toContain('/guide/registration');
    expect(paths(d => { wire(d, 'W1').id = 'W 1'; })).toContain('/wires/0/id');
    expect(paths(d => { (d.keepouts ?? [])[0] = { kind: 'box', x: 0, y: 0, w: 0, h: 1, height: 1 }; }).some(path => path.startsWith('/keepouts/0'))).toBe(true);
    expect(paths(d => { d.prints = []; })).toContain('/prints');
    expect(paths(d => { d.wires = []; })).toContain('/wires');
    // a semantic problem is not reported while the schema fails
    expect(paths(d => { d.boardPartId = 'alpha-wire-3051-1'; d.guide.coverThickness = 10; })).not.toContain('/boardPartId');
  });

  it('bounds the size of a design: wires, waypoints, prints, components and keep-outs', () => {
    const paths = (change: (design: WireGuideDesign) => void) => issuesAfter(change).map(issue => issue.path);
    expect(paths(d => { d.wires = Array.from({ length: WIRE_GUIDE_LIMITS.wires + 1 }, (_, i) => ({ id: `W${i}`, from: [0, 3], to: [1, 3], path: [], level: 0 })); })).toContain('/wires');
    expect(paths(d => { wire(d, 'W1').path = Array.from({ length: WIRE_GUIDE_LIMITS.waypoints + 1 }, () => [1, 3] as [number, number]); })).toContain('/wires/0/path');
    expect(paths(d => { d.prints = Array.from({ length: WIRE_GUIDE_LIMITS.prints + 1 }, (_, i) => ({ id: `G${i}`, wireIds: ['W1'] })); })).toContain('/prints');
    expect(paths(d => { d.keepouts = Array.from({ length: WIRE_GUIDE_LIMITS.keepouts + 1 }, () => ({ kind: 'cylinder' as const, cx: 1, cy: 1, d: 1, height: 1 })); })).toContain('/keepouts');
    expect(paths(d => { d.components = Array.from({ length: WIRE_GUIDE_LIMITS.components + 1 }, (_, i) => ({ ref: `R${i}`, footprint: 'axial', pins: [[0, 0]], body: { kind: 'cylinder' as const, cx: 1, cy: 1, d: 1, height: 1 } })); })).toContain('/components');
    // a design full of problems reports a bounded number of them
    const crowded = issuesAfter(d => {
      d.wires = Array.from({ length: WIRE_GUIDE_LIMITS.wires }, (_, i) => ({ id: `W${i}`, from: [0, 2], to: [1, 2], path: [], level: 0 }));
    });
    expect(crowded.length).toBe(WIRE_GUIDE_LIMITS.issues);
  });

  it('stops checking at the issue limit, however many problems a schema-valid design has', () => {
    // the worst case: the whole board under keep-outs, and 200 wires zig-zagging across it over all 64 waypoints, which would
    // be millions of "runs through" and "doubles back" issues if they were all collected
    const zigzag = Array.from({ length: WIRE_GUIDE_LIMITS.waypoints }, (_, i) => [i % 2 ? 0 : 45, 0] as [number, number]);
    const worst: WireGuideDesign = {
      ...valid(), boardPartId: 'roth-re200-hp', components: [], prints: [{ id: 'G1', wireIds: ['W0'] }],
      guide: { ...valid().guide, registration: 'edge-clips' },
      keepouts: Array.from({ length: WIRE_GUIDE_LIMITS.keepouts }, () => ({ kind: 'box' as const, x: 0, y: 0, w: 170, h: 110, height: 10 })),
      wires: Array.from({ length: WIRE_GUIDE_LIMITS.wires }, (_, i) => ({ id: `W${i}`, from: [0, 0] as [number, number], to: [45, 0] as [number, number], path: zigzag, level: 0 })),
    };
    const started = performance.now();
    expect(validateWireGuideDesign(worst)).toHaveLength(WIRE_GUIDE_LIMITS.issues);
    // bounded by the limit, not the design: well under the seconds the full list would take
    expect(performance.now() - started).toBeLessThan(2000);
  });

  it('needs a prototype board of the library, and hookup wire for every wire', () => {
    expect(issuesAfter(d => { d.boardPartId = 'alpha-wire-3051-1'; })).toContainEqual({ path: '/boardPartId', message: 'alpha-wire-3051-1 is a hookup-wire, not a prototype board.' });
    expect(issuesAfter(d => { d.boardPartId = 'no-such-board'; })[0]?.path).toBe('/boardPartId');
    expect(issuesAfter(d => { d.wirePartId = 'adafruit-perma-proto-full'; })).toContainEqual({ path: '/wirePartId', message: 'adafruit-perma-proto-full is not a hookup wire.' });
    expect(issuesAfter(d => { d.wirePartId = 'no-such-wire'; })[0]?.path).toBe('/wirePartId');
    expect(issuesAfter(d => { wire(d, 'W2').wirePartId = 'iso-4762-m3x10'; })).toContainEqual({ path: '/wires/1/wirePartId', message: 'iso-4762-m3x10 is not a hookup wire.' });
    // every hookup wire of the library is accepted
    for (const id of ['alpha-wire-3051-1', 'alpha-wire-3050-1', 'generic-hookup-wire-26awg-solid-pvc', 'jonard-kynar-30awg'])
      expect(issuesAfter(d => { d.wirePartId = id; }), id).toEqual([]);
  });

  it('checks the wire parts against the board’s holes and the funnels', () => {
    const narrow = issuesAfter(d => { d.guide.funnelBottomDiameter = 0.5; });
    expect(narrow).toContainEqual({ path: '/wirePartId', message: 'The conductor of alpha-wire-3051-1 (0.635 mm) does not pass the funnel’s 0.5 mm outlet.' });
    expect(narrow.filter(issue => issue.path === '/wirePartId')).toHaveLength(1);
    expect(issuesAfter(d => { d.guide.funnelBottomDiameter = 2.5; d.guide.funnelTopDiameter = 2.2; }).map(issue => issue.path)).toContain('/guide/funnelBottomDiameter');
    expect(issuesAfter(d => { d.guide.funnelTopDiameter = 3; }).map(issue => issue.path)).toContain('/guide/funnelTopDiameter');
  });

  it('needs mounting holes for mounting-hole registration', () => {
    const roth = (registration: 'mounting-holes' | 'edge-clips') => validateWireGuideDesign({
      ...valid(), boardPartId: 'roth-re200-hp', components: [], keepouts: [], prints: [{ id: 'G1', wireIds: valid().wires.map(w => w.id) }],
      guide: { ...valid().guide, registration },
    });
    expect(roth('mounting-holes')).toContainEqual({ path: '/guide/registration', message: 'roth-re200-hp has no mounting holes: use edge clips.' });
    expect(roth('edge-clips')).toEqual([]);
  });

  it('keeps ids unique', () => {
    expect(issuesAfter(d => { wire(d, 'W2').id = 'W1'; }).map(issue => issue.path)).toContain('/wires/1/id');
    expect(issuesAfter(d => { print(d, 'G2').id = 'G1'; }).map(issue => issue.path)).toContain('/prints/1/id');
    expect(issuesAfter(d => { d.components = [...d.components ?? [], { ref: 'U1', footprint: 'axial', pins: [[25, 3]], body: { kind: 'cylinder', cx: 70, cy: 10, d: 1, height: 1 } }]; }).map(issue => issue.path)).toContain('/components/1/ref');
  });

  it('ends every wire in a drilled hole of its own, never in a pin hole or under a keep-out', () => {
    // row 2 is the Perma-Proto's gap between the rails and A
    expect(issuesAfter(d => { wire(d, 'W1').from = [0, 2]; })).toContainEqual({ path: '/wires/0/from', message: 'Wire W1 ends at [0, 2], which is not a drilled hole of adafruit-perma-proto-half.' });
    expect(issuesAfter(d => { wire(d, 'W2').from = [5, 3]; wire(d, 'W2').to = [5, 11]; }))
      .toContainEqual({ path: '/wires/1/from', message: 'Wire W2 ends at [5, 3], where wire W1 already ends: one wire end per hole.' });
    expect(issuesAfter(d => { wire(d, 'W5').from = [20, 7]; wire(d, 'W5').to = [20, 3]; }))
      .toContainEqual({ path: '/wires/4/from', message: 'Wire W5 ends at [20, 7], a pin hole of U1.' });
    expect(issuesAfter(d => { d.keepouts = [{ kind: 'box', x: 2, y: 9, w: 3, h: 3, height: 5 }]; }))
      .toContainEqual({ path: '/wires/0/from', message: 'Wire W1 ends at [0, 3], under keep-out 0.' });
    expect(issuesAfter(d => { d.keepouts = [{ kind: 'cylinder', cx: 3.81, cy: 11.43, d: 1, height: 5 }]; }).map(issue => issue.path)).toContain('/wires/0/from');
    expect(issuesAfter(d => { wire(d, 'W1').to = [0, 3]; }).map(issue => issue.path)).toContain('/wires/0/to');
  });

  it('runs every path along the grid in axis-aligned segments', () => {
    expect(issuesAfter(d => { wire(d, 'W1').path = [[3, 4]]; }))
      .toContainEqual({ path: '/wires/0/path/0', message: 'Wire W1 runs diagonally from [0, 3] to [3, 4]: segments must be along a column or a row.' });
    expect(issuesAfter(d => { wire(d, 'W1').path = [[2, 3], [2, 3]]; }))
      .toContainEqual({ path: '/wires/0/path/1', message: 'Wire W1 repeats [2, 3]: a segment has no length.' });
    expect(issuesAfter(d => { wire(d, 'W1').path = [[0, 3]]; }).map(issue => issue.path)).toContain('/wires/0/path/0');
    expect(issuesAfter(d => { wire(d, 'W1').path = [[30, 3], [30, 4]]; }))
      .toContainEqual({ path: '/wires/0/path/0', message: '[30, 3] is off adafruit-perma-proto-half’s 30 × 18 grid.' });
    // a waypoint may lie over an empty grid position (the channel between the halves)
    expect(issuesAfter(d => { wire(d, 'W2').path = [[2, 8], [6, 8], [6, 9], [2, 9]]; })).toEqual([]);
  });

  it('keeps paths clear of component bodies, keep-outs, pin holes and other wires’ ends', () => {
    const through = issuesAfter(d => { d.wires.push({ id: 'W6', from: [19, 11], to: [24, 11], path: [[19, 9], [24, 9]], level: 1 }); print(d, 'G1').wireIds.push('W6'); });
    expect(through).toContainEqual({ path: '/wires/5/path/1', message: 'Wire W6 runs from [19, 9] to [24, 9] through U1’s body.' });
    const overPins = issuesAfter(d => { d.wires.push({ id: 'W6', from: [18, 7], to: [25, 7], path: [], level: 0 }); print(d, 'G1').wireIds.push('W6'); });
    expect(overPins).toContainEqual({ path: '/wires/5/path', message: 'Wire W6 passes over [20, 7], a pin hole of U1.' });
    expect(issuesAfter(d => { d.keepouts = [{ kind: 'cylinder', cx: 50, cy: 19.05, d: 2, height: 3 }]; wire(d, 'W5').to = [26, 6]; wire(d, 'W5').from = [17, 6]; }).map(issue => issue.path)).toContain('/wires/4/to');
    // W3 ends at [4, 6]; a wire on any level running over that hole would block the end dropping into it
    const overEnd = issuesAfter(d => { d.wires.push({ id: 'W6', from: [3, 6], to: [6, 6], path: [], level: 3 }); print(d, 'G1').wireIds.push('W6'); });
    expect(overEnd).toContainEqual({ path: '/wires/5/path', message: 'Wire W6 passes over [4, 6], where wire W3 drops into its hole.' });
  });

  it('never lets two wires on the same level cross or overlap, or a wire cross itself', () => {
    expect(issuesAfter(d => { wire(d, 'W3').level = 0; }))
      .toContainEqual({ path: '/wires/2/level', message: 'Wire W3 crosses or overlaps wire W1 at [4, 3] on level 0: put one of them on another level.' });
    const overlap = issuesAfter(d => { d.wires.push({ id: 'W6', from: [7, 4], to: [3, 4], path: [[7, 3], [3, 3]], level: 0 }); print(d, 'G1').wireIds.push('W6'); });
    expect(overlap.some(issue => issue.path === '/wires/5/level' && issue.message.includes('wire W1'))).toBe(true);
    expect(issuesAfter(d => { d.wires.push({ id: 'W6', from: [7, 4], to: [3, 4], path: [[7, 3], [3, 3]], level: 2 }); print(d, 'G1').wireIds.push('W6'); })
      .some(issue => issue.path === '/wires/5/level')).toBe(false);
    const loop = issuesAfter(d => { d.wires.push({ id: 'W6', from: [24, 12], to: [24, 13], path: [[27, 12], [27, 13]], level: 2 }); print(d, 'G1').wireIds.push('W6'); });
    expect(loop).toEqual([]);
    const self = issuesAfter(d => { d.wires.push({ id: 'W6', from: [24, 12], to: [25, 11], path: [[27, 12], [27, 13], [25, 13]], level: 2 }); print(d, 'G1').wireIds.push('W6'); });
    expect(self).toContainEqual({ path: '/wires/5/path', message: 'Wire W6 crosses or doubles back over itself at [25, 12].' });
  });

  it('puts every wire in exactly one print, and keeps each print’s wires in its region on the board', () => {
    expect(issuesAfter(d => { print(d, 'G1').wireIds = ['W1', 'W2', 'W3']; })).toContainEqual({ path: '/wires/4', message: 'Wire W5 is in no print: every wire belongs to exactly one print.' });
    expect(issuesAfter(d => { print(d, 'G2').wireIds.push('W1'); })).toContainEqual({ path: '/prints/1/wireIds/1', message: 'Wire W1 is already in print G1: every wire belongs to exactly one print.' });
    expect(issuesAfter(d => { print(d, 'G2').wireIds.push('W9'); })).toContainEqual({ path: '/prints/1/wireIds/1', message: 'Wire W9 is not in the design.' });
    expect(issuesAfter(d => { const g2 = print(d, 'G2'); if (g2.region) g2.region.to = [13, 17]; })).toContainEqual({ path: '/wires/3', message: 'Wire W4 leaves the region of print G2.' });
    expect(issuesAfter(d => { const g2 = print(d, 'G2'); if (g2.region) g2.region.to = [30, 17]; })).toContainEqual({ path: '/prints/1/region', message: 'Print G2’s region runs off adafruit-perma-proto-half’s 30 × 18 grid.' });
    // corners in either order
    expect(issuesAfter(d => { print(d, 'G2').region = { from: [16, 17], to: [9, 0] }; })).toEqual([]);
    const overlapping = issuesAfter(d => { print(d, 'G1').region = { from: [0, 0], to: [9, 17] }; print(d, 'G1').wireIds = ['W1', 'W2', 'W3']; d.wires = d.wires.filter(w => w.id !== 'W5'); });
    expect(overlapping).toContainEqual({ path: '/prints/1/region', message: 'Print G2’s region overlaps print G1’s.' });
  });

  it('exports a standalone JSON Schema, checked in at docs/schemas/wire-guide-design.schema.json', () => {
    const schema = wireGuideDesignJsonSchema();
    expect(schema['$schema']).toBe('http://json-schema.org/draft-07/schema#');
    expect(schema['title']).toBe('WireGuideDesign');
    expect(JSON.stringify(schema)).not.toContain('~');
    const file = readFileSync(new URL('../../../docs/schemas/wire-guide-design.schema.json', import.meta.url), 'utf8');
    expect(JSON.parse(file)).toEqual(schema);
  });
});
