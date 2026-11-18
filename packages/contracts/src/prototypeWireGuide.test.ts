import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { activeParts, findPart, hookupWireChannelWidth, prototypeWireGuide, scadDefines, validateParameters, validateWireGuideDesign, linkedPartData, WIRE_GUIDE_LIMITS, type WireGuideDesign } from './index.ts';
import { DEFAULT_WIRE_GUIDE_DESIGN, WIRE_GUIDE_GEOMETRY, WIRE_GUIDE_LEVEL_COLORS, wireGuideAssembly, wireGuideGeometry, wireGuideLayerBodies, wireGuidePieces, wireGuideScad, wireGuideStack, wireGuideSummary, type WireGuidePrintGeometry } from './prototypeWireGuide.ts';

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
      'perfboard-one-level.json', 'perfboard-two-levels.json', 'perma-proto-bus.json', 'perma-proto-half-three-levels.json', 'pockets-on-channel-sides.json',
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
  it('keeps KiPrint’s two designs with bends under a higher wire as invalid fixtures, rerouted by KiPrint in the samples', () => {
    const invalid = (name: string) => JSON.parse(readFileSync(new URL(`invalid/${name}`, SAMPLES), 'utf8')) as WireGuideDesign;
    expect(readdirSync(new URL('invalid/', SAMPLES)).sort()).toEqual(['kiprint-crossing-two-levels.json', 'kiprint-perma-proto-timer.json']);
    const why = 'a wire runs straight under a wire on a higher level, so that it can be threaded under its bridge.';
    expect(validateWireGuideDesign(invalid('kiprint-perma-proto-timer.json'))).toEqual([
      { path: '/wires/6/path/0', message: `Wire W7 turns at [8, 10] under wire W2 on level 1: ${why}` },
      { path: '/wires/6/path/1', message: `Wire W7 turns at [8, 11] under wire W2 on level 1: ${why}` },
      { path: '/wires/7/path/0', message: `Wire W8 turns at [13, 14] under wire W5 on level 1: ${why}` },
    ]);
    expect(validateWireGuideDesign(invalid('kiprint-crossing-two-levels.json'))).toEqual([
      { path: '/wires/2/path/0', message: `Wire C turns at [5, 6] under wire B on level 2: ${why}` },
      { path: '/wires/2/path/1', message: `Wire C turns at [16, 6] under wire B on level 2: ${why}` },
    ]);
    // KiPrint's router (main 417ae4c) reroutes the samples; they differ from the fixtures only in those wires
    for (const [name, ids] of [['kiprint-perma-proto-timer.json', ['W2', 'W5', 'W8']], ['kiprint-crossing-two-levels.json', ['B']]] as const) {
      const [fixture, rerouted] = [invalid(name), sample(name)];
      for (const wire of rerouted.wires) if (!(ids as readonly string[]).includes(wire.id)) expect(wire).toEqual(fixture.wires.find(w => w.id === wire.id));
      expect({ ...rerouted, wires: [] }).toEqual({ ...fixture, wires: [] });
    }
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
    // the planned project's revision is display-only too
    const revision = `sha256:${'ab'.repeat(32)}`;
    const revised = { ...design, source: { tool: 'kiprint' as const, version: '0.1.0', projectId: 'p', revision } };
    expect(validateWireGuideDesign(revised)).toEqual([]);
    expect(wireGuideScad(revised)).toBe(literal);
    expect(validateWireGuideDesign({ ...revised, source: { ...revised.source, revision: '2026-11-18T10:00:00Z' } })[0]?.path).toBe('/source/revision');
  });
  it('gives each piece its PRINT, LAYER and PEG and the design as GUIDE, and only renders the design’s pieces', () => {
    const parameters = { design: sample('stripboard-three-prints.json') };
    const parts = activeParts(prototypeWireGuide, parameters);
    expect(parts.map(part => part.id)).toEqual(['print-1-layer-1', 'print-2-layer-1', 'print-2-layer-2', 'print-2-peg-1', 'print-2-peg-2', 'print-3-layer-1']);
    expect(parts.map(part => part.id)).toEqual(wireGuidePieces(parameters.design).map(piece => piece.id));
    const guide = ['GUIDE', wireGuideScad(parameters.design)];
    expect(scadDefines(prototypeWireGuide, must(parts[2]), parameters)).toEqual([guide, ['PRINT', '1'], ['LAYER', '1'], ['PEG', '-1']]);
    expect(scadDefines(prototypeWireGuide, must(parts[4]), parameters)).toEqual([guide, ['PRINT', '1'], ['LAYER', '-1'], ['PEG', '1']]);
    expect(activeParts(prototypeWireGuide, prototypeWireGuide.defaults).map(part => part.id)).toEqual(['print-1-layer-1', 'print-1-peg-1', 'print-1-peg-2']);
    // one piece per print, as before, when the design asks for it
    const single = { design: { ...parameters.design, guide: { ...parameters.design.guide, parts: 'single' as const } } };
    const pieces = activeParts(prototypeWireGuide, single);
    expect(pieces.map(part => part.id)).toEqual(['print-1', 'print-2', 'print-3']);
    expect(scadDefines(prototypeWireGuide, must(pieces[2]), single)).toEqual([['GUIDE', wireGuideScad(single.design)], ['PRINT', '2'], ['LAYER', '-1'], ['PEG', '-1']]);
    // an invalid design (which validation rejects before any render) stands for one piece, as before
    const invalid = clone(single.design); must(invalid.wires[0]).to = must(invalid.wires[0]).from;
    expect(activeParts(prototypeWireGuide, { design: invalid }).map(part => part.id)).toEqual(['print-1']);
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

/** The pictured kind of guide: a half Perma-Proto with 16 wires on 3 levels, red level-0 wires crossed by a blue level-1 wire that
 * a green level-2 wire crosses at the same holes. Representative: built for this test, not the owner's exact project. */
const THREE = 'perma-proto-half-three-levels.json';
const printOf = (design: WireGuideDesign, index = 0): WireGuidePrintGeometry => must(wireGuideGeometry(design)[index]);

describe('separate layers and pegs (guide.parts)', () => {
  it('makes the three-level crossing three stacked layers, the blue crossing wire in the middle one', () => {
    const design = sample(THREE);
    expect(design.guide.parts).toBeUndefined(); // layers are the default
    const { stack, layers, block } = printOf(design);
    expect(stack.pieces).toBe('layers');
    expect(stack.problems).toEqual([]);
    // the crossing: at [6..8, 4] a red wire on level 0, the blue W4 on level 1 and the green W5 on level 2
    const on = (id: string) => must(design.wires.find(wire => wire.id === id)).level;
    expect([on('W1'), on('W2'), on('W3'), on('W4'), on('W5')]).toEqual([0, 0, 0, 1, 2]);
    expect(stack.layers.map(layer => layer.level)).toEqual([0, 1, 2]);
    expect(stack.layers[1]?.wireIds).toEqual(['W4', 'W14']);
    expect(stack.layers.map(layer => layer.wireIds.length)).toEqual([12, 2, 2]);
    // worked out by hand: the board 1.6 mm, standoff 1, plate 1.2, the 22 AWG wire 1.4986 + 0.2 clearance, bridges 0.6
    const channel = 1.4986 + 0.2, plate = 1.6 + 1 + 1.2;
    const expected = [[2.6, plate + channel], [plate + channel, plate + 2 * (channel + 0.6) - 0.6], [plate + 2 * (channel + 0.6) - 0.6, plate + 2 * (channel + 0.6) + channel]];
    stack.layers.forEach((layer, k) => { expect(layer.zBottom).toBeCloseTo(must(expected[k])[0] ?? 0, 4); expect(layer.zTop).toBeCloseTo(must(expected[k])[1] ?? 0, 4); });
    expect(must(stack.layers.at(-1)).zTop).toBeCloseTo(block.zTop, 6);
    // each layer above the bottom starts where the one-piece print's bridge over the lower channels starts
    expect(stack.layers.slice(1).map(layer => layer.zBottom)).toEqual(layers.slice(1).map(layer => layer.bridgeBottom));
    expect(wireGuidePieces(design).map(piece => piece.id)).toEqual(['print-1-layer-1', 'print-1-layer-2', 'print-1-layer-3', 'print-1-peg-1', 'print-1-peg-2']);
  });

  it('puts a separate board peg in each mounting hole, with its fit worked out from the hole', () => {
    const { stack, block } = printOf(sample(THREE));
    expect(stack.pegs.map(peg => [peg.kind, peg.through, peg.x, peg.y]).sort()).toEqual([['board', true, 3.81, 25.4], ['board', true, 77.47, 25.4]]);
    for (const peg of stack.pegs) {
      // a Ø3.2 hole: a Ø2.9 tip 1.2 mm down it, a Ø5.2 shoulder (the hole + 2 × the 1 mm standoff), a Ø3.8 shaft in Ø4.1 holes
      expect([peg.holeDiameter, peg.shaft, peg.hole, peg.shoulder, peg.zBottom]).toEqual([3.2, 3.8, 4.1, 5.2, 0.4]);
      expect(peg.profile[1]).toEqual([1.45, 0]);
      // its seat meets the hole's rim at the board's top
      const seat = peg.profile.findIndex(([r, z]) => r > 1.6 && z > 1.2);
      const [[r0, z0], [r1, z1]] = [must(peg.profile[seat - 1]), must(peg.profile[seat])];
      expect(r0 + (r1 - r0) * (1.2 - z0) / (z1 - z0)).toBeCloseTo(1.6, 6);
      // the shoulder's top is the guide's underside, its shaft stops 0.2 under the stack's top
      expect(peg.profile).toContainEqual([2.6, block.zBase - peg.zBottom]);
      expect(Math.max(...peg.profile.map(([, z]) => z)) + peg.zBottom).toBeCloseTo(block.zTop - 0.2, 6);
      expect(peg.holeBottom).toBeLessThan(block.zBase);
      expect(peg.holeTop).toBeGreaterThan(block.zTop);
    }
  });

  it('prints every peg upright without supports: no part of its outline overhangs by more than 45°', () => {
    for (const name of [THREE, 'kiprint-perma-proto-timer.json', 'perfboard-two-levels.json', 'perfboard-one-level.json'])
      for (const print of wireGuideGeometry(sample(name))) for (const peg of print.stack.pegs) {
        const outline = peg.profile.slice(1, -1);
        outline.slice(1).forEach(([r, z], i) => {
          const [r0, z0] = must(outline[i]);
          expect(z, `${name}: the outline goes up`).toBeGreaterThanOrEqual(z0 - 1e-9);
          if (r > r0 + 1e-9) expect(r - r0, `${name}: a widening is at most 45°`).toBeLessThanOrEqual(z - z0 + 1e-6);
        });
        expect(must(peg.profile[0])[1]).toBe(0);
      }
  });

  it('keeps every peg’s hole clear of every channel, funnel, pocket and other hole by 0.6 mm, in every sample', () => {
    const clear = WIRE_GUIDE_GEOMETRY.peg.keepClear;
    for (const name of readdirSync(SAMPLES).filter(file => file.endsWith('.json'))) for (const print of wireGuideGeometry(sample(name))) {
      const { grid } = print;
      const at = ([c, r]: [number, number]) => [grid.x0 + c * grid.pitch, grid.y0 + r * grid.pitch] as const;
      for (const peg of print.stack.pegs) {
        const r = peg.hole / 2;
        if (peg.through) for (const wire of print.wires) wire.points.slice(1).forEach((b, i) => {
          const [[ax, ay], [bx, by]] = [at(must(wire.points[i])), at(b)];
          const dx = Math.max(Math.min(ax, bx) - wire.width / 2 - peg.x, 0, peg.x - Math.max(ax, bx) - wire.width / 2);
          const dy = Math.max(Math.min(ay, by) - wire.width / 2 - peg.y, 0, peg.y - Math.max(ay, by) - wire.width / 2);
          expect(Math.hypot(dx, dy), `${name}: a peg's hole next to a channel`).toBeGreaterThanOrEqual(r + clear - 1e-6);
        });
        for (const funnel of print.funnels) expect(Math.hypot(funnel.x - peg.x, funnel.y - peg.y), `${name}: a funnel`).toBeGreaterThanOrEqual(r + clear + funnel.top / 2 - 1e-6);
        for (const other of print.stack.pegs) if (other !== peg) expect(Math.hypot(other.x - peg.x, other.y - peg.y)).toBeGreaterThanOrEqual(r + other.hole / 2 + clear - 1e-6);
        expect(peg.hole - peg.shaft).toBeCloseTo(WIRE_GUIDE_GEOMETRY.peg.holePlay, 6);
      }
    }
  });

  it('lines up every stack of two or more layers on two pegs through all of them, adding dowels where the board has no usable hole', () => {
    for (const name of readdirSync(SAMPLES).filter(file => file.endsWith('.json'))) for (const print of wireGuideGeometry(sample(name)))
      if (print.stack.pieces === 'layers' && print.stack.layers.length >= 2) expect(print.stack.pegs.filter(peg => peg.through).length, name).toBe(2);
    // the quarter Perma-Proto's mounting holes lie under channels: their pegs reach only into sockets in the plate, and two dowels line up the layers
    const timer = printOf(sample('kiprint-perma-proto-timer.json')).stack;
    expect(timer.pegs.map(peg => [peg.kind, peg.through])).toEqual([['board', false], ['board', false], ['dowel', true], ['dowel', true]]);
    const plateTop = printOf(sample('kiprint-perma-proto-timer.json')).plateTop;
    for (const peg of timer.pegs.filter(peg => !peg.through)) expect(peg.holeTop).toBeCloseTo(plateTop - WIRE_GUIDE_GEOMETRY.minimumSkin, 6);
    expect(timer.notes.filter(note => note.includes('socket'))).toHaveLength(2);
    // edge clips: the clips stay on the bottom layer, two dowels line up the two layers
    const clips = printOf(sample('perfboard-two-levels.json'));
    expect(clips.stack.pegs.map(peg => peg.kind)).toEqual(['dowel', 'dowel']);
    expect(must(clips.stack.layers[0]).zBottom).toBe(-WIRE_GUIDE_GEOMETRY.clip.below);
  });

  it('never falls back to one piece: separate layers that can’t be made are validation issues naming the way out, and nothing renders', () => {
    // a wire end beside the stripboard's mounting hole: no room for a peg's hole there. The sample asks for one piece; asked for
    // layers (or by default) the design is rejected, with the explicit choice offered
    const neighbours = sample('stripboard-boss-neighbours.json');
    expect(neighbours.guide.parts).toBe('single');
    const layered = structuredClone(neighbours);
    delete layered.guide.parts;
    expect(validateWireGuideDesign(layered)).toEqual([]); // the shared contract: still a valid design
    expect(printOf(layered).stack).toMatchObject({ pieces: 'layers', problems: ['The mounting hole at (4.44, 4.68) mm can\'t take a peg: its hole would cut a funnel'] });
    expect(validateParameters(prototypeWireGuide, { design: layered })).toEqual([{ field: 'design/guide/parts',
      message: 'Print G1 can’t be made as separate layers: The mounting hole at (4.44, 4.68) mm can\'t take a peg: its hole would cut a funnel. Change the design (move the wire or component), or choose one piece per print (guide.parts "single").' }]);
    expect(validateParameters(prototypeWireGuide, { design: neighbours })).toEqual([]);
    // no room for a dowel anywhere: a pocket over the whole print
    const clips = printOf(sample('perfboard-two-levels.json'));
    const { block } = clips;
    const crowded = { ...clips, pockets: [{ kind: 'box' as const, x: block.x0, y: block.y0, w: block.x1 - block.x0, h: block.y1 - block.y0, top: block.zBase + 0.5 }] };
    const design = sample('perfboard-two-levels.json');
    const stack = wireGuideStack(crowded, design.wires, design.guide, [], { columns: 24, rows: 18 });
    expect(stack.pieces).toBe('layers');
    expect(stack.problems).toContain('there is no room for two alignment pegs through its layers, clear of its channels, funnels and pockets');
    // through pockets round a square: layer 2 would be a loose square inside them
    const three = printOf(sample(THREE));
    const [cx, cy] = [40, 40], top = three.block.zTop + 1;
    const ring = [[cx - 6, cy - 6, 12, 1], [cx - 6, cy + 5, 12, 1], [cx - 6, cy - 6, 1, 12], [cx + 5, cy - 6, 1, 12]].map(([x, y, w, h]) => ({ kind: 'box' as const, x: x ?? 0, y: y ?? 0, w: w ?? 0, h: h ?? 0, top }));
    const ringed = { ...three, pockets: [...three.pockets, ...ring] };
    expect(wireGuideLayerBodies(three, 1, [])).toBe(1);
    expect(wireGuideLayerBodies(ringed, 1, [])).toBe(2);
    const fallen = wireGuideStack(ringed, sample(THREE).wires, sample(THREE).guide, [], { columns: 30, rows: 18 });
    expect(fallen.pieces).toBe('layers');
    expect(fallen.problems).toContain('its layer 2 would be 2 loose pieces between its pockets and holes');
    // every sample asking for layers can be made so
    for (const name of readdirSync(SAMPLES).filter(file => file.endsWith('.json'))) for (const print of wireGuideGeometry(sample(name))) expect(print.stack.problems, name).toEqual([]);
  });

  it('keeps the one-piece print, bosses fused, for guide.parts single', () => {
    const design = sample(THREE);
    const single = { ...design, guide: { ...design.guide, parts: 'single' as const } };
    const [layered, fused] = [printOf(design), printOf(single)];
    expect(fused.stack).toEqual({ pieces: 'single', problems: [], layers: [], pegs: [], notes: [] });
    expect({ ...fused, stack: null }).toEqual({ ...layered, stack: null });
    expect(wireGuidePieces(single).map(piece => piece.id)).toEqual(['print-1']);
    const [a, b] = [JSON.parse(wireGuideScad(design)) as unknown[][], JSON.parse(wireGuideScad(single)) as unknown[][]];
    expect(must(a[0]).slice(0, 10)).toEqual(must(b[0]).slice(0, 10));
    expect(must(b[0]).slice(10)).toEqual([0, [], [], []]);
    expect(must(a[0]).slice(10, 13)).toEqual([1, layered.stack.layers.map(layer => [layer.zBottom, layer.zTop]), layered.stack.pegs.map(peg => [peg.x, peg.y, peg.hole, peg.holeBottom, peg.holeTop])]);
    // each peg's rings, bottom to top, none on the axis (guide.scad closes the ends: axis points would make empty triangles)
    expect(must(a[0])[13]).toEqual(layered.stack.pegs.map(peg => peg.profile.filter(([r]) => r > 0)));
    expect((must(a[0])[13] as [number, number][][]).every(rings => rings.length >= 3 && rings.every(([r]) => r > 0))).toBe(true);
  });

  it('assembles the pieces where they go: pegs into the board, then each layer down over them, coloured by level', () => {
    const design = sample(THREE);
    const assembly = wireGuideAssembly(design);
    const { stack } = printOf(design);
    expect(Object.keys(assembly.poses).sort()).toEqual(wireGuidePieces(design).map(piece => piece.id).sort());
    stack.layers.forEach((layer, k) => expect(assembly.poses[`print-1-layer-${k + 1}`]?.position).toEqual([0, 0, layer.zBottom]));
    stack.pegs.forEach((peg, j) => expect(assembly.poses[`print-1-peg-${j + 1}`]?.position).toEqual([peg.x, peg.y, peg.zBottom]));
    expect(assembly.steps.map(step => step.parts)).toEqual([['print-1-peg-1', 'print-1-peg-2'], ['print-1-layer-1'], ['print-1-layer-2'], ['print-1-layer-3']]);
    expect(assembly.steps[2]?.title).toBe('Print G1: slide layer 2 down over the pegs, then lay level 1’s wires in it (W4, W14)');
    expect(assembly.partColors['print-1-layer-2']).toBe(WIRE_GUIDE_LEVEL_COLORS[1]);
    expect(prototypeWireGuide.assemblyForParameters({ design })).toEqual(assembly);
  });

  it('writes the ZIP’s assembly guide and the design, naming every STL it holds', () => {
    const design = sample(THREE);
    const files = prototypeWireGuide.zipFiles({ design });
    expect(Object.keys(files).sort()).toEqual(['wire-guide-assembly.txt', 'wire-guide-design.json']);
    expect(JSON.parse(must(files['wire-guide-design.json']))).toEqual(design);
    const text = must(files['wire-guide-assembly.txt']);
    for (const piece of wireGuidePieces(design)) expect(text.match(new RegExp(`^  ${piece.id}\\.stl `, 'gm'))?.length, piece.id).toBe(1);
    expect(text).toContain('Print one of each STL file.');
    expect(text).toContain('a 2.9 mm tip in the 3.2 mm hole, a 45° seat on its rim, a 5.2 mm shoulder the bottom layer rests on, and a 3.8 mm shaft');
    expect(text).toContain('0.3 mm wider than its shaft (a sliding fit, e.g. 3.8 mm in 4.1 mm)');
    expect(text).toContain('it has not been checked with a printed guide');
    expect(text).toContain('layer 2 from the bottom: the channels of level 1 (W4, W14)');
    expect(wireGuideSummary(design).prints).toEqual([{ id: 'G1', wires: 16, layers: 3, pegs: 2, pieces: 5, problems: [] }]);
    expect(prototypeWireGuide.derived({ design }).notes).toContain('5 printed pieces: G1 3 layers + 2 pegs.');
    expect(prototypeWireGuide.zipFiles({ design: { nope: true } })).toEqual({});
  });
});

