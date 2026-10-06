import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { Value } from 'typebox/value';
import {
  activeParts, artifactFormat, cigaretteCase, CLEARANCE_HOLES, findModel, holeDiameter, plankConnector, fruitFlyTrap, FruitFlyTrapParametersSchema, isAssembly, modelSourcePaths,
  minimumSpikeLength, mossPlanter, rauteColumns, slotCount, SNAP_CLEARANCE, SNAP_TUNING, HOLDER_SNAP_CLEARANCE, LIGHTER_SNAP_CLEARANCE, MINI_BOX_SNAP_CLEARANCE, MINI_LID_SNAP_CLEARANCE, scadLiteral, textWidth, validateParameters, type MossPlanterParameters,
  AssemblySchema, CASE_MAGNETS, CLEARANCE_RANGE, DEFAULT_CASE_MAGNET, linkedPartData, MAGNET_SEAT, magnetFits, partUsage, scadDefines,
  litterShovel, MAX_SIEVE_GAPS, SCOOP_BLADE, SCOOP_LENGTH_RANGE, WALL_BANDS, WALL_THICKNESS_RANGE, scoopSideTop, sieveGaps, sieveHeight, sieveRowsLimit, slotLength, slotLengthLimit, type LitterShovelParameters,
  controlRange, controlShown, type Control,
  DEFAULT_HANDLE_FASTENERS, HANDLE_FASTENER_SEAT, HANDLE_INSERTS, HANDLE_NUTS, HANDLE_SCREWS, HANDLE_THREADS, handleInsertFits, handleNutFits, handleScrewFits,
  offeredOptions, partDefineLiteral,
  DEFAULT_LATCH_SCREWS, LATCH_MACHINE_SCREWS, LATCH_MACHINE_THREADS, LATCH_WOOD_DIAMETERS, LATCH_WOOD_SCREWS, latchScrewFits, latchScrewHoles, models, TOGGLE_LATCH_SEAT, toggleLatch,
} from './models.ts';
import { resolveAssembly } from './assembly.ts';
import { dimensionOf, findPart, ISO_273_CLEARANCE_HOLES, METRIC_THREADS, parts } from './parts/index.ts';
import { LOGO_MAX_LENGTH, RenderRequestSchema } from './index.ts';

/** A logo string: one square filling the whole grid. */
const SQUARE = 'M0 0L2000 0L2000 2000L0 2000Z';

const defaults = Value.Parse(FruitFlyTrapParametersSchema, fruitFlyTrap.defaults);

describe('fruit fly trap contract', () => {
  it('accepts defaults and counts automatically distributed slots', () => {
    expect(validateParameters(fruitFlyTrap, defaults)).toEqual([]);
    expect(slotCount(defaults)).toBe(792);
    expect(slotCount({ ...defaults, slotsEnabled: false })).toBe(0);
    expect(slotCount({ ...defaults, trapDiameter: 100 })).toBeGreaterThan(slotCount(defaults));
    expect(slotCount({ ...defaults, trapHeight: 100 })).toBeGreaterThan(slotCount(defaults));
  });

  it('rejects unknown fields, numeric strings, and incompatible dimensions', () => {
    expect(validateParameters(fruitFlyTrap, { ...defaults, trapDiameter: '60' })).not.toEqual([]);
    expect(validateParameters(fruitFlyTrap, { ...defaults, arbitraryCode: 'echo(1)' })).not.toEqual([]);
    expect(validateParameters(fruitFlyTrap, { ...defaults, trapDiameter: 20, nozzleDiameter: 20 })).toContainEqual(expect.objectContaining({ field: 'nozzleDiameter' }));
    expect(validateParameters(fruitFlyTrap, { ...defaults, nozzleDiameter: 1 })).not.toEqual([]);
    expect(validateParameters(fruitFlyTrap, { ...defaults, nozzleDiameter: 1, slotsEnabled: false })).toEqual([]);
  });

  it('accepts decimal steps and bounds but rejects excessive cutter counts', () => {
    expect(validateParameters(fruitFlyTrap, { ...defaults, trapDiameter: 63.1, gapWidth: 0.3 })).toEqual([]);
    expect(validateParameters(fruitFlyTrap, { ...defaults, trapDiameter: 200, trapHeight: 200, brimWidth: 30 })).toEqual([]);
    expect(validateParameters(fruitFlyTrap, { ...defaults, trapDiameter: 200, trapHeight: 200, gapHeight: 1, gapWidth: 0.3, gapDistanceHorizontal: 1.2, gapDistanceVertical: 1 })).not.toEqual([]);
    expect(Value.Check(RenderRequestSchema, { modelId: 'unknown', modelVersion: '1', parameters: defaults })).toBe(false);
  });
});

describe('moss planter contract', () => {
  const defaults = mossPlanter.defaults;

  it('is a registered five-part assembly whose parts share the model parameters', () => {
    expect(findModel('moss-planter')).toBe(mossPlanter);
    expect(isAssembly(mossPlanter)).toBe(true);
    expect(isAssembly(fruitFlyTrap)).toBe(false);
    expect(artifactFormat(mossPlanter)).toBe('zip');
    expect(artifactFormat(fruitFlyTrap)).toBe('stl');
    expect(mossPlanter.parts.map(part => part.id)).toEqual(['ground-spike', 'planting-helper', 'cover-cap', 'lattice-short', 'lattice-tall']);
    // Five parts, but only four generators: both lattice segments come from raute.scad.
    expect(new Set(modelSourcePaths(mossPlanter)).size).toBe(4);
    expect(mossPlanter.controls.map(control => control.key)).toEqual(Object.keys(mossPlanter.defaults));
    expect(defaults).toEqual({ towerDiameter: 52, spikeLength: 124, shortRauteRows: 4, tallRauteRows: 10, rauteColumns: 0 });
    // Every part takes the tower diameter (so all parts mate), and each mapped key is a real parameter.
    for (const part of mossPlanter.parts) {
      expect(part.scadMapping?.['towerDiameter'], part.id).toBe('TOWER_DIAMETER');
      for (const [key, name] of Object.entries(part.scadMapping ?? {})) {
        expect(mossPlanter.controls.some(control => control.key === key), key).toBe(true);
        expect(name).toMatch(/^[A-Z_]+$/);
      }
    }
    expect(Object.values(mossPlanter.scadMapping)).toEqual([]);
  });

  it('accepts the defaults, the original 52 and 100 mm towers, and every diameter in between', () => {
    expect(validateParameters(mossPlanter, defaults)).toEqual([]);
    for (let towerDiameter = 40; towerDiameter <= 120; towerDiameter++)
      expect(validateParameters(mossPlanter, { ...defaults, towerDiameter, spikeLength: 300 }), String(towerDiameter)).toEqual([]);
    expect(validateParameters(mossPlanter, { ...defaults, towerDiameter: 100, spikeLength: 238 })).toEqual([]);
    expect(mossPlanter.derived()).toEqual({ slotCount: null });
  });

  it('rejects out-of-range, non-integer, missing and unknown parameters', () => {
    for (const bad of [{ towerDiameter: 39 }, { towerDiameter: 121 }, { towerDiameter: 52.5 }, { shortRauteRows: 1 }, { shortRauteRows: 21 },
      { tallRauteRows: 25 }, { tallRauteRows: 4.5 }, { rauteColumns: 17 }, { spikeLength: 301 }, { spikeLength: 49 }])
      expect(validateParameters(mossPlanter, { ...defaults, ...bad }), JSON.stringify(bad)).not.toEqual([]);
    expect(validateParameters(mossPlanter, {})).not.toEqual([]);
    expect(validateParameters(mossPlanter, { ...defaults, anything: 1 })).not.toEqual([]);
  });

  it('applies the dependent rules: spike length grows with the tower, columns 1-3 are invalid, and lattices stay renderable', () => {
    expect(minimumSpikeLength(52)).toBe(60);
    expect(validateParameters(mossPlanter, { ...defaults, spikeLength: 59 }).map(issue => issue.field)).toEqual(['spikeLength']);
    // The 124 mm default is too short for a 120 mm tower: the message names the minimum.
    const short = validateParameters(mossPlanter, { ...defaults, towerDiameter: 120 });
    expect(short.map(issue => issue.field)).toEqual(['spikeLength']);
    expect(short[0]?.message).toContain(String(minimumSpikeLength(120)));
    expect(validateParameters(mossPlanter, { ...defaults, rauteColumns: 3 }).map(issue => issue.field)).toEqual(['rauteColumns']);
    expect(rauteColumns({ ...(defaults as MossPlanterParameters), towerDiameter: 52 })).toBe(6);
    expect(rauteColumns({ ...(defaults as MossPlanterParameters), towerDiameter: 100 })).toBe(12);
    expect(rauteColumns({ ...(defaults as MossPlanterParameters), towerDiameter: 100, rauteColumns: 7 })).toBe(7);
    expect(validateParameters(mossPlanter, { ...defaults, towerDiameter: 100, spikeLength: 238, tallRauteRows: 24 })).toEqual([]);
    expect(validateParameters(mossPlanter, { ...defaults, rauteColumns: 16, tallRauteRows: 24 }).map(issue => issue.field)).toEqual(['tallRauteRows']);
  });

  it('is a request branch of RenderRequestSchema at version 2', () => {
    expect(mossPlanter.version).toBe('2');
    expect(Value.Check(RenderRequestSchema, { modelId: 'moss-planter', modelVersion: '2', parameters: defaults })).toBe(true);
    expect(Value.Check(RenderRequestSchema, { modelId: 'moss-planter', modelVersion: '1', parameters: defaults })).toBe(false);
    expect(Value.Check(RenderRequestSchema, { modelId: 'moss-planter', modelVersion: '2', parameters: { ...defaults, extra: 1 } })).toBe(false);
  });
});

describe('cigarette case contract', () => {
  const ok = { ...cigaretteCase.defaults };
  it('is a ZIP assembly with five snap, text, font, size, style and clearance controls that reach only the parts that use them', () => {
    expect(findModel('cigarette-case')).toBe(cigaretteCase);
    expect(isAssembly(cigaretteCase)).toBe(true);
    expect(artifactFormat(cigaretteCase)).toBe('zip');
    expect(cigaretteCase.parts.map(part => part.id)).toEqual(['case-box', 'case-lid', 'mini-holder', 'mini-box', 'mini-lid', 'case-text']);
    expect(new Set(modelSourcePaths(cigaretteCase)).size).toBe(6);
    expect(cigaretteCase.controls.map(control => [control.key, control.kind])).toEqual([['snap', 'enum'], ['magnet', 'enum'], ['miniLidSnap', 'enum'], ['holderSnap', 'enum'], ['lighterSnap', 'enum'], ['miniBoxSnap', 'enum'], ['undersideMark', 'enum'], ['engraveText', 'text'], ['textFont', 'enum'], ['textSize', 'number'], ['logo', 'svg'], ['logoSize', 'number'], ['textMode', 'enum'], ['clearance', 'number'],
      ['snapDetentEngage', 'number'], ['snapCrushSqueeze', 'number'], ['miniLidDetentEngage', 'number'], ['miniLidCrushSqueeze', 'number'], ['holderDetentEngage', 'number'], ['holderCrushSqueeze', 'number'], ['lighterCrushSqueeze', 'number'], ['miniBoxDetentEngage', 'number'], ['miniBoxCrushSqueeze', 'number']]);
    const byKey = (key: string) => cigaretteCase.controls.find(control => control.key === key);
    const values = (key: string) => byKey(key)?.options?.map(option => option.value);
    expect(values('snap')).toEqual(['friction', 'detent', 'clip', 'magnet', 'crush-ribs']);
    for (const key of ['miniLidSnap', 'holderSnap', 'miniBoxSnap']) expect(values(key)).toEqual(['friction', 'detent', 'crush-ribs']);
    expect(values('lighterSnap')).toEqual(['friction', 'crush-ribs']);
    expect(values('undersideMark')).toEqual(['text', 'logo']);
    expect(values('textFont')).toEqual(['sans', 'serif', 'mono', 'wide']);
    expect(byKey('engraveText')).toMatchObject({ default: '', maximum: 20, visibleWhen: { control: 'undersideMark', values: ['text'] } });
    expect(byKey('logo')).toMatchObject({ default: '', maximum: LOGO_MAX_LENGTH, visibleWhen: { control: 'undersideMark', values: ['logo'] } });
    expect(byKey('logoSize')).toMatchObject({ default: 12, minimum: 3, maximum: 15, visibleWhen: { control: 'undersideMark', values: ['logo'] } });
    // the magnets, only in magnet mode, linked to the parts library
    expect(byKey('magnet')).toMatchObject({ default: 'supermagnete-s-06-02-n', visibleWhen: { control: 'snap', values: ['magnet'] }, part: { family: 'magnet', attribute: null } });
    expect(cigaretteCase.defaults).toEqual({ snap: 'friction', magnet: 'supermagnete-s-06-02-n', miniLidSnap: 'friction', holderSnap: 'friction', lighterSnap: 'friction', miniBoxSnap: 'friction', undersideMark: 'text', engraveText: '', textFont: 'sans', textSize: 6, logo: '', logoSize: 12, textMode: 'engrave', clearance: 0.2,
      snapDetentEngage: 0.19, snapCrushSqueeze: 0.16, miniLidDetentEngage: 0.12, miniLidCrushSqueeze: 0.1, holderDetentEngage: 0.15, holderCrushSqueeze: 0.1, lighterCrushSqueeze: 0.1, miniBoxDetentEngage: 0.15, miniBoxCrushSqueeze: 0.1 });
    const mapped = Object.fromEntries(cigaretteCase.parts.map(part => [part.id, part.scadMapping]));
    const text = { undersideMark: 'MARK', engraveText: 'TEXT', textFont: 'TEXT_FONT', textSize: 'TEXT_SIZE', logo: 'LOGO', logoSize: 'LOGO_SIZE' };
    const fit = { clearance: 'CLEARANCE' };
    // each snap setting reaches exactly the printed parts of its joint: the lighter's only the case box, as the lighter is not printed
    expect(mapped).toEqual({
      'case-box': { snap: 'SNAP', snapDetentEngage: 'DETENT_ENGAGE', snapCrushSqueeze: 'CRUSH_SQUEEZE', holderSnap: 'HOLDER_SNAP', holderDetentEngage: 'HOLDER_DETENT_ENGAGE', lighterSnap: 'LIGHTER_SNAP', lighterCrushSqueeze: 'LIGHTER_CRUSH_SQUEEZE', ...fit, ...text },
      'case-lid': { snap: 'SNAP', snapDetentEngage: 'DETENT_ENGAGE', miniBoxSnap: 'MINI_BOX_SNAP', miniBoxDetentEngage: 'MB_DETENT_ENGAGE', miniBoxCrushSqueeze: 'MB_CRUSH_SQUEEZE', ...fit },
      'mini-holder': { holderSnap: 'HOLDER_SNAP', holderDetentEngage: 'HOLDER_DETENT_ENGAGE', holderCrushSqueeze: 'HOLDER_CRUSH_SQUEEZE', ...fit },
      'mini-box': { miniLidSnap: 'MINI_LID_SNAP', miniLidDetentEngage: 'ML_DETENT_ENGAGE', miniBoxSnap: 'MINI_BOX_SNAP', miniBoxDetentEngage: 'MB_DETENT_ENGAGE', ...fit },
      'mini-lid': { miniLidSnap: 'MINI_LID_SNAP', miniLidDetentEngage: 'ML_DETENT_ENGAGE', miniLidCrushSqueeze: 'CRUSH_SQUEEZE', ...fit }, 'case-text': text,
    });
  });

  it('renders the text part only for visible text in second-filament mode', () => {
    const ids = (values: Record<string, string | number>) => activeParts(cigaretteCase, { ...ok, ...values }).map(part => part.id);
    expect(ids({})).toEqual(['case-box', 'case-lid', 'mini-holder', 'mini-box', 'mini-lid']);
    expect(ids({ engraveText: 'Tom' })).toEqual(['case-box', 'case-lid', 'mini-holder', 'mini-box', 'mini-lid']);
    expect(ids({ textMode: 'second-filament' })).not.toContain('case-text');
    expect(ids({ textMode: 'second-filament', engraveText: '   ' })).not.toContain('case-text');
    expect(ids({ textMode: 'second-filament', engraveText: 'Tom' }).at(-1)).toBe('case-text');
    // a logo takes the text's place: the part exists for a loaded logo, and only while the mark is the logo
    expect(ids({ textMode: 'second-filament', undersideMark: 'logo', engraveText: 'Tom' })).not.toContain('case-text');
    expect(ids({ textMode: 'second-filament', undersideMark: 'logo', logo: SQUARE }).at(-1)).toBe('case-text');
    expect(ids({ textMode: 'second-filament', undersideMark: 'text', logo: SQUARE })).not.toContain('case-text');
    expect(ids({ undersideMark: 'logo', logo: SQUARE })).not.toContain('case-text');
    expect(cigaretteCase.parts.find(part => part.id === 'case-text')?.separateBodies).toBe(true);
  });

  it('accepts only known snap modes, fonts and styles, printable ASCII text within the limits, and its own version', () => {
    for (const snap of ['friction', 'detent', 'clip', 'magnet', 'crush-ribs']) expect(validateParameters(cigaretteCase, { ...ok, snap }), snap).toEqual([]);
    for (const key of ['miniLidSnap', 'holderSnap', 'miniBoxSnap']) {
      for (const value of ['friction', 'detent', 'crush-ribs']) expect(validateParameters(cigaretteCase, { ...ok, [key]: value }), `${key} ${value}`).toEqual([]);
      for (const value of ['clip', 'magnet', 'glue']) expect(validateParameters(cigaretteCase, { ...ok, [key]: value }), `${key} ${value}`).not.toEqual([]);
    }
    // the lighter cannot be changed, so only the box's own fit or ribs: no detent
    for (const value of ['friction', 'crush-ribs']) expect(validateParameters(cigaretteCase, { ...ok, lighterSnap: value }), value).toEqual([]);
    for (const value of ['detent', 'clip', 'magnet']) expect(validateParameters(cigaretteCase, { ...ok, lighterSnap: value }), value).not.toEqual([]);
    for (const textFont of ['sans', 'serif', 'mono', 'wide']) expect(validateParameters(cigaretteCase, { ...ok, engraveText: 'Tom', textFont }), textFont).toEqual([]);
    expect(validateParameters(cigaretteCase, { ...ok, engraveText: 'Tom', textMode: 'second-filament' })).toEqual([]);
    expect(validateParameters(cigaretteCase, { snap: 'clip' })).not.toEqual([]);
    expect(validateParameters(cigaretteCase, { ...ok, snap: 'glue' })).not.toEqual([]);
    expect(validateParameters(cigaretteCase, { ...ok, textFont: 'comic' })).not.toEqual([]);
    expect(validateParameters(cigaretteCase, { ...ok, textMode: 'paint' })).not.toEqual([]);
    expect(validateParameters(cigaretteCase, { ...ok, textSize: 2 })).not.toEqual([]);
    expect(validateParameters(cigaretteCase, { ...ok, textSize: 10.5 })).not.toEqual([]);
    expect(validateParameters(cigaretteCase, { ...ok, engraveText: 'x'.repeat(21) })).not.toEqual([]);
    expect(validateParameters(cigaretteCase, { ...ok, engraveText: 'Café' })).not.toEqual([]);
    expect(validateParameters(cigaretteCase, { ...ok, engraveText: 'tab\there' })).not.toEqual([]);
    expect(validateParameters(cigaretteCase, { ...ok, engraveText: 'say "hi" \\ $x', textSize: 3 })).toEqual([]);
    expect(validateParameters(cigaretteCase, { ...ok, anything: 1 })).not.toEqual([]);
    expect(Value.Check(RenderRequestSchema, { modelId: 'cigarette-case', modelVersion: '8', parameters: ok })).toBe(true);
    expect(Value.Check(RenderRequestSchema, { modelId: 'cigarette-case', modelVersion: '7', parameters: ok })).toBe(false);
    expect(Value.Check(RenderRequestSchema, { modelId: 'cigarette-case', modelVersion: '8', parameters: { snap: 'clip' } })).toBe(false);
  });

  it('accepts a logo only as a well-formed logo string within its limits, and checks the text width only for text', () => {
    expect(validateParameters(cigaretteCase, { ...ok, undersideMark: 'logo', logo: SQUARE })).toEqual([]);
    expect(validateParameters(cigaretteCase, { ...ok, undersideMark: 'logo', logo: '' })).toEqual([]);
    for (const logo of ['<svg/>', 'M0 0L10 0Z', 'M0 0L10 0L10 10', 'M0 0L2001 0L10 10Z', 'M0 0L10 0L10 10Z;M1 1L2 1L2 2Z', 'M-1 0L10 0L10 10Z', 'M0  0L10 0L10 10Z', 'M00 0L10 0L10 10Z', 'M0 0L1e3 0L10 10Z'])
      expect(validateParameters(cigaretteCase, { ...ok, undersideMark: 'logo', logo }), logo).not.toEqual([]);
    // checked whichever mark is chosen, since every part that maps it receives it
    expect(validateParameters(cigaretteCase, { ...ok, logo: 'M0 0L10 0L10 10' })[0]?.field).toBe('logo');
    expect(validateParameters(cigaretteCase, { ...ok, logo: 'M0 0L10 0L10 10'.repeat(3000) })).not.toEqual([]);
    // too-wide text does not matter while the logo is chosen
    expect(validateParameters(cigaretteCase, { ...ok, engraveText: 'W'.repeat(20), textSize: 10 })).not.toEqual([]);
    expect(validateParameters(cigaretteCase, { ...ok, undersideMark: 'logo', engraveText: 'W'.repeat(20), textSize: 10 })).toEqual([]);
    expect(validateParameters(cigaretteCase, { ...ok, logoSize: 2.5 })).not.toEqual([]);
    expect(validateParameters(cigaretteCase, { ...ok, logoSize: 15.5 })).not.toEqual([]);
  });

  it('writes the logo for OpenSCAD as numbers only, and every other value as JSON', () => {
    expect(scadLiteral(cigaretteCase, 'logo', SQUARE)).toBe('[[[0,0],[2000,0],[2000,2000],[0,2000]]]');
    expect(scadLiteral(cigaretteCase, 'logo', '')).toBe('[]');
    expect(() => scadLiteral(cigaretteCase, 'logo', 'M0 0L1 0L1 1Z"; import("x")')).toThrow();
    expect(scadLiteral(cigaretteCase, 'engraveText', 'say "hi"')).toBe('"say \\"hi\\""');
    expect(scadLiteral(cigaretteCase, 'logoSize', 12)).toBe('12');
  });

  it('offers a 0.10 to 0.60 mm clearance in advanced settings, with named fits and a recommended range for every mode of every joint', () => {
    const clearance = cigaretteCase.controls.find(control => control.key === 'clearance');
    expect(clearance).toMatchObject({ kind: 'number', group: 'advanced', unit: 'mm', default: 0.2, minimum: 0.1, maximum: 0.6, step: 0.01 });
    for (const value of [0.1, 0.2, 0.37, 0.6]) expect(validateParameters(cigaretteCase, { ...ok, clearance: value }), String(value)).toEqual([]);
    for (const value of [0.09, 0.61, 0.205]) expect(validateParameters(cigaretteCase, { ...ok, clearance: value }), String(value)).not.toEqual([]);
    // the bands tile the whole range, in order, and name the default a snug fit
    const bands = clearance?.bands ?? [];
    expect(bands.map(band => band.label)).toEqual(['Very tight (press fit)', 'Snug fit', 'Sliding fit', 'Easy sliding (removable)']);
    expect(bands[0]?.minimum).toBe(0.1);
    expect(bands.at(-1)?.maximum).toBe(0.6);
    bands.slice(1).forEach((band, index) => expect(band.minimum).toBe(bands[index]?.maximum));
    expect(bands.find(band => 0.2 >= band.minimum && 0.2 < band.maximum)?.label).toBe('Snug fit');
    // every mode of every joint has a range inside the slider; clips need 0.2 to 0.4 mm, friction and magnets on the case lid work across it
    expect(clearance?.recommended?.map(entry => entry.control)).toEqual(['snap', 'miniLidSnap', 'holderSnap', 'lighterSnap', 'miniBoxSnap']);
    for (const entry of clearance?.recommended ?? []) {
      const joint = cigaretteCase.controls.find(control => control.key === entry.control);
      expect(entry.ranges.map(range => range.value), entry.control).toEqual(joint?.options?.map(option => option.value));
      for (const range of entry.ranges) expect(range.minimum >= 0.1 && range.maximum <= 0.6 && range.minimum < range.maximum, `${entry.control} ${range.value}`).toBe(true);
    }
    // the defaults (friction everywhere, 0.2 mm) are recommended: a friction fit alone holds the holder and the mini box only up to 0.2 mm
    for (const ranges of [SNAP_CLEARANCE, MINI_LID_SNAP_CLEARANCE, HOLDER_SNAP_CLEARANCE, LIGHTER_SNAP_CLEARANCE, MINI_BOX_SNAP_CLEARANCE]) expect(ranges.friction.minimum <= 0.2 && ranges.friction.maximum >= 0.2).toBe(true);
    expect(HOLDER_SNAP_CLEARANCE.friction).toEqual({ minimum: 0.1, maximum: 0.2 });
    expect(MINI_BOX_SNAP_CLEARANCE.friction).toEqual({ minimum: 0.1, maximum: 0.2 });
    // the new detents reach no further than the smallest clearance they are recommended for (see docs/cigarette-case-snap.md)
    expect(MINI_BOX_SNAP_CLEARANCE.detent.minimum).toBeGreaterThanOrEqual(0.15);
    expect(SNAP_CLEARANCE.clip).toEqual({ minimum: 0.2, maximum: 0.4 });
    expect(SNAP_CLEARANCE.friction).toEqual({ minimum: 0.1, maximum: 0.6 });
    expect(SNAP_CLEARANCE.magnet).toEqual(SNAP_CLEARANCE.friction);
    // the other models' controls carry neither
    for (const model of [fruitFlyTrap, mossPlanter, plankConnector]) for (const control of model.controls) expect([control.bands, control.recommended]).toEqual([null, null]);
  });

  it('offers each joint\'s detent engagement and crush-rib squeeze in advanced settings, only while that joint uses the mechanism', () => {
    for (const [key, tuning] of Object.entries(SNAP_TUNING)) {
      const tuned = cigaretteCase.controls.find(control => control.key === key);
      expect(tuned, key).toMatchObject({ kind: 'number', group: 'advanced', unit: 'mm', default: tuning.default, minimum: 0.02, maximum: 0.4, step: 0.01, visibleWhen: { control: tuning.joint, values: [tuning.mode] } });
      // the default sits inside its recommended range, which is highlighted only in that mode
      expect(tuning.recommended.minimum <= tuning.default && tuning.default <= tuning.recommended.maximum, key).toBe(true);
      expect(tuned?.recommended).toEqual([{ control: tuning.joint, ranges: [{ value: tuning.mode, ...tuning.recommended }] }]);
      // it reaches the parts that carry the feature, under the SCAD name
      expect(cigaretteCase.parts.some(part => part.scadMapping?.[key] === tuning.variable), key).toBe(true);
    }
    // the SCAD files carry the same defaults
    for (const part of cigaretteCase.parts) for (const [key, variable] of Object.entries(part.scadMapping ?? {})) {
      const tuning = (SNAP_TUNING as Record<string, { default: number }>)[key];
      if (tuning) expect(new RegExp(`^${variable} = ${tuning.default};`, 'm').test(readFileSync(new URL(`../../../${part.sourcePath}`, import.meta.url), 'utf8')), `${part.id} ${variable}`).toBe(true);
    }
    for (const value of [0.02, 0.33, 0.4]) expect(validateParameters(cigaretteCase, { ...ok, holderSnap: 'detent', holderDetentEngage: value }), String(value)).toEqual([]);
    for (const value of [0.01, 0.41, 0.125]) expect(validateParameters(cigaretteCase, { ...ok, holderDetentEngage: value }), String(value)).not.toEqual([]);
    for (const value of [0.02, 0.15, 0.4]) expect(validateParameters(cigaretteCase, { ...ok, lighterSnap: 'crush-ribs', lighterCrushSqueeze: value }), String(value)).toEqual([]);
    for (const value of [0, 0.41, 0.125]) expect(validateParameters(cigaretteCase, { ...ok, lighterCrushSqueeze: value }), String(value)).not.toEqual([]);
  });

  it('keeps a detent groove from cutting too deep into a 1 mm wall, but only while that detent is in use', () => {
    // engagement + clearance may reach 0.8 mm: the defaults pass at the widest clearance
    for (const snap of ['detent', 'friction']) expect(validateParameters(cigaretteCase, { ...ok, snap, miniLidSnap: 'detent', miniBoxSnap: 'detent', clearance: 0.6 })).toEqual([]);
    const deep = validateParameters(cigaretteCase, { ...ok, miniBoxSnap: 'detent', miniBoxDetentEngage: 0.3, clearance: 0.6 });
    expect(deep).toHaveLength(1);
    expect(deep[0]?.field).toBe('miniBoxDetentEngage');
    expect(deep[0]?.message).toContain('0.90 mm deep groove');
    expect(validateParameters(cigaretteCase, { ...ok, miniBoxSnap: 'crush-ribs', miniBoxDetentEngage: 0.3, clearance: 0.6 })).toEqual([]);
    expect(validateParameters(cigaretteCase, { ...ok, snap: 'detent', snapDetentEngage: 0.3, clearance: 0.5 })).toEqual([]);
    expect(validateParameters(cigaretteCase, { ...ok, snap: 'detent', snapDetentEngage: 0.31, clearance: 0.5 })[0]?.field).toBe('snapDetentEngage');
    // the holder's groove is in the 2.1 mm bay wall
    expect(validateParameters(cigaretteCase, { ...ok, holderSnap: 'detent', holderDetentEngage: 0.4, clearance: 0.6 })).toEqual([]);
  });

  it('rejects text that will not fit the free underside, using the measured font widths', () => {
    expect(validateParameters(cigaretteCase, { ...ok, engraveText: 'Hello', textSize: 6 })).toEqual([]);
    const tooWide = validateParameters(cigaretteCase, { ...ok, engraveText: 'Hello, Tom & 42', textSize: 6 });
    expect(tooWide).toHaveLength(1);
    expect(tooWide[0]?.field).toBe('engraveText');
    expect(validateParameters(cigaretteCase, { ...ok, engraveText: 'Hello, Tom & 42', textSize: 3 })).toEqual([]);
    expect(textWidth('mono', 'AAAA', 5)).toBeGreaterThan(textWidth('sans', 'iiii', 5));
    expect(textWidth('sans', 'Hello', 6)).toBeCloseTo(2 * textWidth('sans', 'Hello', 3));
    expect(textWidth('nope', 'a', 5)).toBe(Number.POSITIVE_INFINITY);
    // the widest possible one-line text at the largest size must still be rejected, never clipped silently
    expect(validateParameters(cigaretteCase, { ...ok, engraveText: 'W'.repeat(20), textSize: 10 })).not.toEqual([]);
  });

  it('keeps each joint\'s shared SCAD block identical in the two files of that joint', () => {
    const read = (path: string) => readFileSync(new URL(`../../../models/cigarette-case/reference/${path}`, import.meta.url), 'utf8');
    const block = (name: string, path: string) => new RegExp(`// --- ${name} [\\s\\S]*?// --- end ${name} ---`).exec(read(path))?.[0];
    for (const [name, a, b, marker] of [
      ['holder retention', '11_v11.3__-_honeycomb_-_box.scad', '11_-_Honeycomb_-_minibox.scad', 'HOLDER_DETENT_ENGAGE'],
      ['mini box retention', '11_v11.3__-_honeycomb_-_top.scad', '11_-_Honeycomb_-_topminibox_-_box.scad', 'MB_DETENT_ENGAGE'],
      ['mini lid retention', '11_-_Honeycomb_-_topminibox_-_box.scad', '11_-_Honeycomb_-_topminibox_-_top.scad', 'ML_DETENT_ENGAGE'],
    ] as const) {
      expect(block(name, a), name).toContain(marker);
      expect(block(name, b), name).toBe(block(name, a));
    }
  });

  it('fits the round bay to the lighter\'s plan as the parts library models it', () => {
    // the box copies the lighter's plan (the library's lighter is never changed for the fit); its three values must stay the same
    const read = (path: string) => readFileSync(new URL(`../../../${path}`, import.meta.url), 'utf8');
    const value = (source: string, name: string) => new RegExp(`^${name} = ([\\d.]+);`, 'm').exec(source)?.[1];
    const box = read('models/cigarette-case/reference/11_v11.3__-_honeycomb_-_box.scad');
    const lighter = read('parts/everyday-objects/bic-j25-mini-lighter.scad');
    for (const name of ['THICKNESS', 'WIDTH', 'PROFILE_N']) {
      expect(value(lighter, name), name).toBeDefined();
      expect(value(box, `LIGHTER_${name}`), name).toBe(value(lighter, name));
    }
    // the box's plan function is the lighter's plan() under the box's names
    const plan = /function plan\(d = 0, steps = 96\) = [^\n]*\n[^\n]*/.exec(lighter)?.[0].replace(/(THICKNESS|WIDTH|PROFILE_N)/g, 'LIGHTER_$1').replace('function plan(', 'function lighter_plan(');
    expect(plan).toBeDefined();
    expect(box).toContain(plan);
  });

  it('keeps the underside-text block identical in the box SCAD and the text-part SCAD', () => {
    const block = (path: string) => /\/\/ --- underside text[\s\S]*?\/\/ --- end underside text ---/.exec(readFileSync(new URL(`../../../${path}`, import.meta.url), 'utf8'))?.[0];
    const box = block('models/cigarette-case/reference/11_v11.3__-_honeycomb_-_box.scad');
    expect(box).toContain('TEXT_DEPTH');
    expect(block('models/cigarette-case/underside-text.scad')).toBe(box);
  });
});

describe('plank connector contract', () => {
  const defaults = plankConnector.defaults;

  it('is a registered single-STL model with a 50.22 x 4.80 mm pocket, a separate insertion depth and no holes by default', () => {
    expect(findModel('plank-connector')).toBe(plankConnector);
    expect(isAssembly(plankConnector)).toBe(false);
    expect(artifactFormat(plankConnector)).toBe('stl');
    expect(defaults).toEqual({ pocketWidth: 50.22, pocketThickness: 4.8, insertionDepth: 20, screwHoles: 'none', holeFit: 'medium', holesPerEnd: 2, wallThickness: 2, stopThickness: 2, entryChamfer: 0.5 });
    expect(validateParameters(plankConnector, defaults)).toEqual([]);
    expect(Object.keys(plankConnector.scadMapping).sort()).toEqual(Object.keys(defaults).sort());
    for (const name of Object.values(plankConnector.scadMapping)) expect(name).toMatch(/^[A-Z_]+$/);
    expect(Value.Check(RenderRequestSchema, { modelId: plankConnector.id, modelVersion: plankConnector.version, parameters: defaults })).toBe(true);
  });

  it('lets the pocket and depth be set freely, in 0.01 mm steps for the pocket', () => {
    for (const values of [{ pocketWidth: 50.2, pocketThickness: 4.81 }, { pocketWidth: 5, pocketThickness: 1, insertionDepth: 5, wallThickness: 0.8, entryChamfer: 0.4 }, { pocketWidth: 200, pocketThickness: 50, insertionDepth: 150, stopThickness: 0, entryChamfer: 0 }])
      expect(validateParameters(plankConnector, { ...defaults, ...values }), JSON.stringify(values)).toEqual([]);
    for (const values of [{ pocketWidth: 50.225 }, { pocketWidth: 201 }, { pocketThickness: 0.5 }, { insertionDepth: 4 }, { insertionDepth: 20.2 }, { holesPerEnd: 1.5 }, { holesPerEnd: 5 }])
      expect(validateParameters(plankConnector, { ...defaults, ...values }), JSON.stringify(values)).not.toEqual([]);
  });

  it('offers no holes or one option per metric screw, each with its DIN EN 20273 clearance hole', () => {
    const screwHoles = plankConnector.controls.find(control => control.key === 'screwHoles');
    expect(screwHoles).toMatchObject({ kind: 'enum', group: 'basic', default: 'none' });
    expect(screwHoles?.options?.map(option => option.value)).toEqual(['none', 'M2', 'M2.5', 'M3', 'M4', 'M5', 'M6', 'M8']);
    expect(screwHoles?.options?.find(option => option.value === 'M4')?.label).toBe('M4 (4.5 mm hole)');
    expect(plankConnector.controls.find(control => control.key === 'holeFit')?.options?.map(option => option.value)).toEqual(['fine', 'medium', 'coarse']);
    // spot checks against the published table
    expect(CLEARANCE_HOLES.M3).toEqual({ fine: 3.2, medium: 3.4, coarse: 3.6 });
    expect(CLEARANCE_HOLES.M6).toEqual({ fine: 6.4, medium: 6.6, coarse: 7 });
    expect(CLEARANCE_HOLES.M8).toEqual({ fine: 8.4, medium: 9, coarse: 10 });
    expect(holeDiameter({ screwHoles: 'none', holeFit: 'coarse' })).toBe(0);
    expect(holeDiameter({ screwHoles: 'M5', holeFit: 'fine' })).toBe(5.3);
    for (const series of Object.values(CLEARANCE_HOLES)) expect(series.fine < series.medium && series.medium < series.coarse).toBe(true);
    expect(validateParameters(plankConnector, { ...defaults, screwHoles: 'M7' })).not.toEqual([]);
    expect(validateParameters(plankConnector, { ...defaults, holeFit: 'loose' })).not.toEqual([]);
  });

  it('keeps the SCAD hole table identical to the contract', () => {
    const scad = readFileSync(new URL('../../../models/plank-connector/generator.scad', import.meta.url), 'utf8');
    const rows = [...scad.matchAll(/\["(M[\d.]+)",\s*([\d.]+),\s*([\d.]+),\s*([\d.]+)\]/g)]
      .map(([, screw, fine, medium, coarse]) => [screw, { fine: Number(fine), medium: Number(medium), coarse: Number(coarse) }]);
    expect(Object.fromEntries(rows)).toEqual(CLEARANCE_HOLES);
    expect(scad).toContain('SCREW_SIZE       = "none"; //[none,M2,M2.5,M3,M4,M5,M6,M8]');
  });

  it('rejects holes that do not fit the plank and chamfers that cut through the wall', () => {
    expect(validateParameters(plankConnector, { ...defaults, screwHoles: 'M8', holeFit: 'coarse', holesPerEnd: 4 })).toEqual([]);
    expect(validateParameters(plankConnector, { ...defaults, screwHoles: 'M8', holeFit: 'coarse', insertionDepth: 11.5 })).toContainEqual(expect.objectContaining({ field: 'insertionDepth' }));
    expect(validateParameters(plankConnector, { ...defaults, screwHoles: 'M8', holeFit: 'coarse', insertionDepth: 12 })).toEqual([]);
    expect(validateParameters(plankConnector, { ...defaults, pocketWidth: 20, screwHoles: 'M6', holesPerEnd: 3 })).toContainEqual(expect.objectContaining({ field: 'holesPerEnd' }));
    // without holes, neither rule applies
    expect(validateParameters(plankConnector, { ...defaults, pocketWidth: 5, insertionDepth: 5, holesPerEnd: 4 })).toEqual([]);
    expect(validateParameters(plankConnector, { ...defaults, entryChamfer: 1.7 })).toContainEqual(expect.objectContaining({ field: 'entryChamfer' }));
    expect(validateParameters(plankConnector, { ...defaults, entryChamfer: 1.6 })).toEqual([]);
  });
});

describe('cigarette case magnets (parts library)', () => {
  const read = (file: string) => readFileSync(new URL(`../../../models/cigarette-case/reference/${file}`, import.meta.url), 'utf8');
  const box = read('11_v11.3__-_honeycomb_-_box.scad');
  const lid = read('11_v11.3__-_honeycomb_-_top.scad');
  const value = (source: string, name: string) => Number(new RegExp(`^${name} = (-?[\\d.]+);`, 'm').exec(source)?.[1]);
  const magnet = (id: string) => findPart(id) ?? (() => { throw new Error(`Missing ${id}`); })();

  it('offers every library magnet that fits, and only those', () => {
    expect(CASE_MAGNETS).toEqual(parts.filter(magnetFits).map(part => part.id));
    expect(CASE_MAGNETS).toContain(DEFAULT_CASE_MAGNET);
    // too wide for the straight stretch of the wall, too high for the box's boss, or not round
    for (const id of ['supermagnete-s-10-02-n', 'supermagnete-s-06-03-n', 'supermagnete-q-05-05-02-n', 'supermagnete-r-10-04-05-n'])
      expect(magnetFits(magnet(id)), id).toBe(false);
    expect(validateParameters(cigaretteCase, { ...cigaretteCase.defaults, snap: 'magnet', magnet: 'supermagnete-s-10-02-n' })).not.toEqual([]);
  });

  it('keeps the fit constants and the default magnet equal to both SCAD files', () => {
    for (const source of [box, lid]) {
      expect([value(source, 'SNAP_X0'), value(source, 'SNAP_X1'), value(source, 'MAGNET_Z'), value(source, 'MAGNET_PLAY')]).toEqual([MAGNET_SEAT.x0, MAGNET_SEAT.x1, MAGNET_SEAT.z, MAGNET_SEAT.play]);
      // the SCAD defaults are the default magnet's greatest size, so a render without overrides cuts its pocket
      expect([value(source, 'MAGNET_D'), value(source, 'MAGNET_T')]).toEqual([dimensionOf(magnet(DEFAULT_CASE_MAGNET), 'diameter', 'max'), dimensionOf(magnet(DEFAULT_CASE_MAGNET), 'thickness', 'max')]);
    }
    expect(value(lid, 'CAVITY_Y')).toBe(MAGNET_SEAT.cavityY);
    expect(value(box, 'CAVITY_Y')).toBe(MAGNET_SEAT.cavityY);
    expect(value(box, 'BASE_TOP')).toBe(MAGNET_SEAT.baseTop);
    expect(lid).toContain(`POCKET_D / 2 + ${MAGNET_SEAT.lidBossMargin}`);
    // the box's boss still backs the deepest pocket at the largest clearance, as it did the original 6 x 2 mm pocket (0.19 mm)
    expect(MAGNET_SEAT.cavityY - CLEARANCE_RANGE.maximum - MAGNET_SEAT.maxThickness - value(box, 'BOSS_IN_Y')).toBeCloseTo(0.19, 6);
  });

  it('passes the chosen magnet’s greatest size to both halves of the lid snap', () => {
    const [caseBox, caseLid] = cigaretteCase.parts;
    if (!caseBox || !caseLid) throw new Error('Expected the case box and lid');
    const defines = (part: typeof caseBox, magnetId: string) => Object.fromEntries(scadDefines(cigaretteCase, part, { ...cigaretteCase.defaults, magnet: magnetId }));
    expect(defines(caseBox, DEFAULT_CASE_MAGNET)).toMatchObject({ MAGNET_D: '6.1', MAGNET_T: '2.1' });
    expect(defines(caseLid, 'supermagnete-s-04-02-n')).toMatchObject({ MAGNET_D: '4.1', MAGNET_T: '2.1' });
    expect(() => defines(caseBox, 'no-such-magnet')).toThrow();
    // the library data behind them is part of the cache fingerprint
    expect(linkedPartData(cigaretteCase).map(part => part.id)).toEqual([...CASE_MAGNETS]);
    expect(partUsage(magnet('supermagnete-s-08-02-n'))).toContainEqual({ modelId: 'cigarette-case', modelTitle: cigaretteCase.title, via: 'Magnets', kind: 'model' });
  });

  it('shows the four magnets in the assembly only in magnet mode, the lid’s moving with the lid', () => {
    expect(resolveAssembly(cigaretteCase, cigaretteCase.assembly, cigaretteCase.defaults)).toBe(cigaretteCase.assembly);
    const assembly = resolveAssembly(cigaretteCase, cigaretteCase.assembly, { ...cigaretteCase.defaults, snap: 'magnet', magnet: 'supermagnete-s-08-02-n', clearance: 0.3 });
    if (!assembly) throw new Error('Expected an assembly');
    expect(Value.Check(AssemblySchema, assembly)).toBe(true);
    const magnets = (assembly.references ?? []).filter(reference => reference.part === 'supermagnete-s-08-02-n');
    expect(magnets.map(reference => reference.id)).toEqual(['magnet-box-plus-y', 'magnet-box-minus-y', 'magnet-lid-plus-y', 'magnet-lid-minus-y']);
    expect(magnets[0]?.title).toBe('Disc magnet Ø 8 × 2 mm, N45 (case box, +Y side)');
    // the box's magnet fills its pocket inwards from the shell's face (CAVITY_Y less the clearance); the lid's outwards from the cavity wall
    expect(assembly.poses['magnet-box-plus-y']).toEqual({ position: [4.25, 13.79 - 0.3 - 2.1, 68.38], rotation: [-90, 0, 0] });
    expect(assembly.poses['magnet-lid-minus-y']).toEqual({ position: [4.25, -13.79, 68.38], rotation: [90, 0, 0] });
    const close = assembly.steps.find(step => step.title === 'Close the case');
    expect(close?.parts).toEqual(expect.arrayContaining(['magnet-lid-plus-y', 'magnet-lid-minus-y']));
    expect(assembly.steps.flatMap(step => step.parts)).not.toContain('magnet-box-plus-y');
  });
});

describe('litter shovel contract', () => {
  const defaults = litterShovel.defaults as LitterShovelParameters;
  const source = (part: string) => readFileSync(new URL(`../../../models/litter-shovel/${part}.scad`, import.meta.url), 'utf8');
  const [container, scoop, handle] = ['container', 'scoop', 'handle'].map(source) as [string, string, string];
  const constant = (file: string, name: string) => {
    const match = new RegExp(`\\b${name} = ([\\d.]+);`).exec(file);
    if (!match?.[1]) throw new Error(`${name} not found`);
    return Number(match[1]);
  };
  const plan = (file: string, name: string) => {
    const match = new RegExp(`\\b${name} = \\[([\\d., ]+)\\];`).exec(file);
    if (!match?.[1]) throw new Error(`${name} not found`);
    const [width = NaN, length = NaN, radius = NaN] = match[1].split(',').map(Number);
    return [width, length, radius] as const;
  };
  const round = (v: number) => Math.round(v * 1e6) / 1e6;
  const grow = (p: readonly [number, number, number], d: number): [number, number, number] => [round(p[0] + 2 * d), round(p[1] + 2 * d), round(p[2] + d)];

  it('is a registered three-part assembly, stacked container, scoop, handle, whose settings reach exactly the parts of their joint', () => {
    expect(findModel('litter-shovel')).toBe(litterShovel);
    expect(artifactFormat(litterShovel)).toBe('zip');
    expect(modelSourcePaths(litterShovel)).toEqual(['container', 'scoop', 'handle'].map(id => `models/litter-shovel/${id}.scad`));
    expect(defaults).toEqual({ sievePattern: 'slots', gapWidth: 7.2, sieveSizing: 'rows', sieveRows: 1, gapLength: 25, gapSpacing: 5.6, scoopLength: 127, scoopSnap: 'detent', handleSnap: 'detent', sieveMargin: 3.2, tipThickness: 0.8, wallThickness: 1.6, tipBevel: 12, gripEnd: 'open', handleShape: 'sheet', gripBulge: 3, gripSize: 14, supportCount: 3, damWidth: 8, supportThickness: 2, clearance: 0.2, scoopDetentEngage: 0.15, handleDetentEngage: 0.15,
      handleReinforcement: 'none', handleThread: 'M3', handleInsert: 'cnc-kitchen-m3x5-7', handleNut: 'iso-4032-m3', handleScrew: 'iso-10642-m3x12' });
    expect(validateParameters(litterShovel, defaults)).toEqual([]);
    const [containerPart, scoopPart, handlePart] = litterShovel.parts;
    expect(Object.keys(containerPart?.scadMapping ?? {}).sort()).toEqual(['clearance', 'damWidth', 'gripBulge', 'gripEnd', 'gripSize', 'handleShape', 'scoopDetentEngage', 'scoopSnap', 'supportCount', 'supportThickness', 'wallThickness']);
    expect(Object.keys(scoopPart?.scadMapping ?? {}).sort()).toEqual(['clearance', 'gapLength', 'gapSpacing', 'gapWidth', 'handleDetentEngage', 'handleReinforcement', 'handleSnap', 'handleThread', 'scoopDetentEngage', 'scoopLength', 'scoopSnap', 'sieveMargin', 'sievePattern', 'sieveRows', 'sieveSizing', 'tipBevel', 'tipThickness', 'wallThickness']);
    expect(Object.keys(handlePart?.scadMapping ?? {}).sort()).toEqual(['clearance', 'gripBulge', 'gripEnd', 'gripSize', 'handleDetentEngage', 'handleReinforcement', 'handleShape', 'handleSnap', 'handleThread']);
    expect(scadDefines(litterShovel, scoopPart ?? {}, defaults)).toContainEqual(['SIEVE_PATTERN', '"slots"']);
    expect(scadDefines(litterShovel, containerPart ?? {}, { ...defaults, scoopSnap: 'friction' })).toContainEqual(['SCOOP_SNAP', '"friction"']);
    expect(Value.Check(AssemblySchema, litterShovel.assembly)).toBe(true);
    expect(litterShovel.assembly.steps.map(step => step.parts)).toEqual([['scoop'], ['handle']]);
    expect(Value.Check(RenderRequestSchema, { modelId: 'litter-shovel', modelVersion: '3', parameters: defaults })).toBe(true);
    expect(Value.Check(RenderRequestSchema, { modelId: 'litter-shovel', modelVersion: '3', parameters: { ...defaults, extra: 1 } })).toBe(false);
  });

  it('keeps every SCAD default equal to the contract default of the parameter it is mapped from', () => {
    // ... and every value a chosen library part gives it (partDefines) equal to the default part's.
    for (const [file, part] of [[container, 0], [scoop, 1], [handle, 2]] as const)
      for (const [name, literal] of scadDefines(litterShovel, litterShovel.parts[part] ?? {}, defaults))
        expect(file, name).toMatch(new RegExp(`^${name} = ${literal.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')};`, 'm'));
  });

  it('shares the stacked, flat mating faces and the fits between the three files', () => {
    // The container's band and lip, which the scoop's cap is fitted to.
    const band = plan(container, 'BAND');
    expect(plan(scoop, 'BAND')).toEqual(band);
    expect(scoop).toMatch(/^MOUTH = grow\(BAND, -WALL_THICKNESS\);$/m);
    expect(container).toMatch(/^MOUTH = grow\(BAND, -WALL\);$/m);
    expect(container).toMatch(/^WALL = WALL_THICKNESS;/m);
    expect(scoop).toMatch(/WALL = WALL_THICKNESS;$/m);
    expect(plan(scoop, 'LIP')).toEqual(grow(band, constant(container, 'LIP_W')));
    // The cap's ceiling sits on the lip's top; its top, CAP_T higher, carries the handle's ring.
    expect(constant(handle, 'CAP_TOP_Z')).toBe(constant(container, 'RIM_Z') + constant(scoop, 'CAP_T'));
    // The handle's ring is flush with the skirt and fits around the blade.
    const capOut = grow(grow(plan(scoop, 'LIP'), constant(scoop, 'BAG_GAP')), constant(scoop, 'SKIRT_T'));
    expect(plan(handle, 'CAP_OUT')).toEqual(capOut);
    expect(plan(handle, 'BLADE')).toEqual(grow(capOut, -constant(scoop, 'RING_T')));
    // Poses: the cap's ceiling on the lip's top; the handle, printed upside down, turned over so that its ring sits on the cap.
    const rim = constant(container, 'RIM_Z');
    expect(litterShovel.assembly.poses['scoop']?.position[2]).toBe(rim - constant(scoop, 'RIM_H'));
    expect(litterShovel.assembly.poses['handle']).toEqual({ position: [0, 0, rim + constant(scoop, 'CAP_T') + constant(handle, 'RING_H')], rotation: [180, 0, 0] });
    // Detents meet their grooves: the sleeve's bumps at the mouth's grooves, the blade's at the ring's.
    expect(container).toMatch(/^DETENT_Z = RIM_Z - 2\.5;/m);
    expect(constant(scoop, 'SLEEVE_DETENT_Z')).toBe(constant(scoop, 'RIM_H') - 2.5);
    expect(constant(scoop, 'BLADE_DETENT_Z')).toBe(constant(handle, 'DETENT_Z'));
    // The two halves of the grip are swept along the same seam by the same code, so the shared block is identical in both files.
    const shared = (file: string) => file.slice(file.indexOf('// ---- The grip\'s two halves'), file.indexOf('\n// ---- ', file.indexOf('// ---- The grip\'s two halves') + 1));
    expect(shared(container).length).toBeGreaterThan(1000);
    expect(shared(handle)).toBe(shared(container));
    // The seam's slope runs just under the lip's chamfer, on the band, and far enough below the scoop's skirt; the palm sheet
    // runs up past the skirt, a clearance clear of it, to the ring's outer face.
    const slope = plan(container, 'SLOPE_POINT');
    expect(slope[0]).toBeCloseTo(plan(container, 'BAND')[0] / 2, 9);
    expect(slope[1]).toBeLessThan(constant(container, 'RIM_Z') - constant(container, 'LIP_T') - constant(container, 'LIP_W'));
    expect(slope[1]).toBeGreaterThan(constant(container, 'RIM_Z') - constant(container, 'LIP_T') - constant(container, 'LIP_W') - constant(container, 'LIP_W'));
    expect(handle).toMatch(/^SEAM_X_TOP = CAP_OUT\[0\] \/ 2 \+ CLEARANCE \/ 2;$/m);
    // The grip stands clear of the lip and the skirt: its vertical is outside the scoop's cap.
    expect(constant(container, 'SEAM_X_BASE') - constant(container, 'SHEET_T')).toBeGreaterThan(capOut[0] / 2);
    // The dam, on the scraper side only, meets the mouth's wall a bag's room under the scoop's sleeve, below the detent grooves
    // and where the mouth is straight (above the band's start); it ends where the back corners do.
    expect(constant(container, 'SLEEVE_DEPTH')).toBe(constant(scoop, 'RIM_H'));
    expect(container).toMatch(/^DAM_TOP = RIM_Z - SLEEVE_DEPTH - DAM_GAP;$/m);
    const damTop = constant(container, 'RIM_Z') - constant(container, 'SLEEVE_DEPTH') - constant(container, 'DAM_GAP');
    expect(damTop).toBeLessThan(constant(container, 'RIM_Z') - 2.5 - 1);
    expect(container).toMatch(/^DAM_T = min\(WALL, ROOT_WALL\) \* sqrt\(2\);$/m);
    expect(damTop - constant(container, 'ROOT_WALL') * Math.SQRT2).toBeGreaterThan(constant(container, 'RIM_Z') - constant(container, 'LIP_T') - constant(container, 'LIP_W') - 3);
    expect(container).toMatch(/cube\(\[MOUTH\[2\] \+ 2 \+ 0\.07, /);
    // The root band under the sieve covers the handle's ring.
    expect(constant(scoop, 'ROOT_BAND')).toBeGreaterThan(constant(handle, 'RING_H'));
  });

  it('offers four handle shapes, with the bulge for the curved one and the size for the round and rectangular ones, in both grip files', () => {
    const control = (key: string) => litterShovel.controls.find(c => c.key === key);
    expect(control('handleShape')?.options?.map(o => o.value)).toEqual(['sheet', 'curved', 'round', 'rectangular']);
    expect(defaults.handleShape).toBe('sheet');
    const shown = (key: string, handleShape: string) => controlShown(control(key) as Control, { ...defaults, handleShape });
    for (const shape of ['sheet', 'curved', 'round', 'rectangular']) {
      expect([shown('gripBulge', shape), shown('gripSize', shape), shown('supportCount', shape)]).toEqual(
        { sheet: [false, false, true], curved: [true, false, true], round: [false, true, false], rectangular: [false, true, false] }[shape]);
      expect(validateParameters(litterShovel, { ...defaults, handleShape: shape })).toEqual([]);
      expect(validateParameters(litterShovel, { ...defaults, handleShape: shape, gripEnd: 'floor', gripSize: 24, gripBulge: 6 })).toEqual([]);
    }
    // Both grip files take the three settings, with the ranges of the controls.
    for (const file of [container, handle]) {
      expect(file).toMatch(/^HANDLE_SHAPE = "sheet"; \/\/\[sheet,curved,round,rectangular\]$/m);
      expect(file).toMatch(/^GRIP_BULGE = 3; \/\/\[0:0\.5:6\]$/m);
      expect(file).toMatch(/^GRIP_SIZE = 14; \/\/\[10:1:24\]$/m);
    }
    expect([control('gripBulge'), control('gripSize')].map(c => [c?.default, c?.minimum, c?.maximum])).toEqual([[3, 0, 6], [14, 10, 24]]);
    const [containerPart, , handlePart] = litterShovel.parts;
    for (const part of [containerPart, handlePart]) expect(part?.scadMapping).toMatchObject({ handleShape: 'HANDLE_SHAPE', gripBulge: 'GRIP_BULGE', gripSize: 'GRIP_SIZE' });
    // The widest round grip still clears the reinforcement's bosses (21 mm from the middle, at most the seat's boss radius round).
    expect(24 / 2).toBeLessThan(constant(handle, 'FASTENER_Y') - HANDLE_FASTENER_SEAT.bossRadius);
  });

  it('sizes the default slots by rows: one row filling the sieve’s height on the back, ending lower along the sides', () => {
    expect(sieveHeight(defaults)).toBeCloseTo(127 - 12 - 26 - 2 * 3.2, 9);
    expect(slotLength(defaults)).toBeCloseTo(82.6, 9);
    const gaps = sieveGaps(defaults);
    expect(gaps).toHaveLength(15);
    expect(litterShovel.derived(defaults)).toEqual({ slotCount: 15 });
    // every slot starts one margin above the root band; on the back and round the corners it ends one margin under the bevel,
    // on the sides one margin under the falling top (square to it), at its outer upper corner
    const bottom = SCOOP_BLADE.sieveBottom + 3.2;
    for (const [, z, l] of gaps) expect(z - l / 2).toBeCloseTo(bottom, 9);
    const half = gaps.filter(([s]) => s >= 0).sort(([a], [b]) => a - b);
    expect(half.map(([s]) => Math.round(s * 10) / 10)).toEqual([0, 12.8, 25.6, 38.4, 51.2, 64, 76.8, 89.6]);
    expect(half.map(([, , l]) => Math.round(l * 100) / 100)).toEqual([82.6, 82.6, 82.6, 82.6, 82.6, 81.46, 47.4, 12.62]);
    for (const [s, z, l] of half.filter(([, , l]) => l < 82.6 - 1e-9)) {
      const x = SCOOP_BLADE.backX + SCOOP_BLADE.cornerRadius + s + 3.6 - SCOOP_BLADE.flatY - Math.PI / 2 * (SCOOP_BLADE.cornerRadius - defaults.wallThickness);
      expect(z + l / 2).toBeLessThan(scoopSideTop(x) - 3.2);
    }
    // a slot shorter than it is wide is not cut: the next column (s = 102.4) would reach past the front corners' margin anyway
    expect(Math.min(...gaps.map(([, , l]) => l))).toBeGreaterThanOrEqual(defaults.gapWidth);
    // n rows and the n − 1 bars between them fill the sieve's height exactly on the back; the rows stay level all round, so
    // the bars between them stay the bar width, staggered or not
    for (const sievePattern of ['slots', 'staggered'] as const) for (const sieveRows of [2, 3, 4, 5]) {
      const p = { ...defaults, sievePattern, sieveRows };
      expect(sieveRows * slotLength(p) + (sieveRows - 1) * p.gapSpacing).toBeCloseTo(sieveHeight(p), 9);
      const sieve = sieveGaps(p);
      const starts = [...new Set(sieve.map(([, z, l]) => Math.round((z - l / 2) * 1e6) / 1e6))];
      expect(starts).toEqual(Array.from({ length: sieveRows }, (_, row) => Math.round((bottom + row * (slotLength(p) + p.gapSpacing)) * 1e6) / 1e6));
      for (const [, , l] of sieve) expect(l).toBeLessThanOrEqual(slotLength(p) + 1e-9);
      const back = sieve.filter(([s]) => Math.abs(s) + p.gapWidth / 2 <= SCOOP_BLADE.flatY);
      for (const [, , l] of back) expect(l).toBeCloseTo(slotLength(p), 9);
      expect(Math.max(...back.map(([, z, l]) => z + l / 2))).toBeCloseTo(127 - 12 - 3.2, 9);
    }
    // the rows the height has room for, at slots as long as they are wide
    expect(sieveRowsLimit(defaults)).toBe(6);
    expect(sieveRowsLimit({ ...defaults, scoopLength: 90 })).toBe(4);
    expect(slotLength({ ...defaults, scoopLength: 90, sieveRows: 4 })).toBeCloseTo(7.2, 9);
  });

  it('lays out the sieve sized by length as 24 slots on a 12.8 mm pitch, across the back, round the corners and along the sides', () => {
    const gaps = sieveGaps({ ...defaults, sieveSizing: 'length' });
    expect(gaps).toHaveLength(24);
    expect([...new Set(gaps.map(([s]) => Math.round(s * 10) / 10))].sort((a, b) => a - b)).toEqual([-76.8, -64, -51.2, -38.4, -25.6, -12.8, 0, 12.8, 25.6, 38.4, 51.2, 64, 76.8]);
    expect([...new Set(gaps.map(([, z]) => Math.round(z * 10) / 10))]).toEqual([41.7, 72.3]);
    // Past the back's flat part (|s| > 39.4) the gaps are in the corners and on the sides.
    expect(gaps.filter(([s]) => Math.abs(s) > SCOOP_BLADE.flatY)).toHaveLength(10);
    expect(litterShovel.derived({ ...defaults, sieveSizing: 'length' })).toEqual({ slotCount: 24 });
  });

  it('counts the gaps exactly as scoop.scad lays them out (its SIEVE_GAPS echo)', () => {
    // Recorded from `openscad -o x.echo -D ... models/litter-shovel/scoop.scad`.
    const cases: [LitterShovelParameters['sievePattern'], number, number, number, number, number, number, number?][] = [
      ['slots', 7.2, 25, 5.6, 3.2, 12, 24], ['slots', 3, 6, 3, 3, 12, 237], ['slots', 15, 40, 15, 10, 12, 5], ['slots', 4.5, 12, 3, 3, 12, 103], ['slots', 10, 10, 3, 5, 12, 68],
      ['staggered', 7.2, 25, 5.6, 3.2, 12, 25], ['staggered', 3, 6, 3, 3, 12, 241], ['staggered', 4.5, 12, 3, 3, 12, 103], ['staggered', 3, 40, 3, 3, 12, 49],
      ['round', 7.2, 25, 5.6, 3.2, 12, 86], ['round', 3, 6, 3, 3, 12, 418], ['round', 15, 40, 15, 10, 12, 12], ['round', 10, 10, 3, 5, 12, 78],
      ['hex', 7.2, 25, 5.6, 3.2, 12, 84], ['hex', 3, 6, 3, 3, 12, 418], ['hex', 4.5, 12, 3, 3, 12, 252], ['hex', 15, 40, 15, 10, 12, 9],
      // The tip's bevel caps the sieve: a short one leaves room for another row, a long one does not change the defaults.
      ['slots', 7.2, 25, 5.6, 3.2, 5, 33], ['slots', 7.2, 25, 5.6, 3.2, 20, 24], ['round', 3, 6, 3, 3, 5, 439], ['hex', 15, 40, 15, 10, 20, 9],
      // The scoop's length (the last value; 127 by default): a shorter scoop has fewer rows, a longer one more.
      ['slots', 7.2, 25, 5.6, 3.2, 12, 11, 90], ['slots', 7.2, 25, 5.6, 3.2, 12, 48, 180], ['staggered', 3, 6, 3, 3, 12, 131, 90],
      ['round', 3, 6, 3, 3, 12, 681, 180], ['hex', 7.2, 25, 5.6, 3.2, 12, 142, 180], ['round', 3, 6, 3, 3, 5, 700, 180],
      ['hex', 4.5, 12, 3, 3, 12, 431, 180], ['round', 7.2, 25, 5.6, 3.2, 20, 36, 90], ['slots', 15, 40, 15, 10, 20, 0, 90],
      // 1 mm gaps and bars, and the longest slot the defaults leave room for (and one too long)
      ['slots', 1, 6, 1, 3.2, 12, 877], ['round', 1, 6, 1, 3.2, 12, 3822], ['hex', 1, 6, 1, 3.2, 12, 3822], ['round', 2, 6, 1.5, 3.2, 12, 1224],
      ['slots', 7.2, 82.5, 5.6, 3.2, 12, 9], ['slots', 7.2, 83, 5.6, 3.2, 12, 0],
    ];
    for (const [sievePattern, gapWidth, gapLength, gapSpacing, sieveMargin, tipBevel, count, scoopLength = 127] of cases)
      expect(sieveGaps({ sievePattern, sieveSizing: 'length', sieveRows: 1, gapWidth, gapLength, gapSpacing, sieveMargin, tipBevel, scoopLength, wallThickness: 3.2 }), `${sievePattern} ${gapWidth}/${gapLength}/${gapSpacing}/${sieveMargin}/${tipBevel}/${scoopLength}`).toHaveLength(count);
    // Sized by rows: [texture, rows, gap width, bar width, margin, bevel, count, scoop length].
    const rowCases: [LitterShovelParameters['sievePattern'], number, number, number, number, number, number, number?][] = [
      ['slots', 1, 7.2, 5.6, 3.2, 12, 15], ['slots', 2, 7.2, 5.6, 3.2, 12, 26], ['slots', 3, 7.2, 5.6, 3.2, 12, 39], ['slots', 5, 7.2, 5.6, 3.2, 12, 59],
      ['staggered', 2, 7.2, 5.6, 3.2, 12, 27], ['staggered', 5, 7.2, 5.6, 3.2, 12, 57], ['slots', 2, 15, 15, 10, 12, 8], ['slots', 1, 1, 1, 3.2, 12, 97], ['slots', 5, 1, 1, 3.2, 12, 415],
      ['slots', 1, 7.2, 5.6, 3.2, 12, 13, 90], ['slots', 4, 7.2, 5.6, 3.2, 12, 48, 90], ['slots', 4, 1, 1, 10, 20, 304, 90],
      ['slots', 1, 7.2, 5.6, 3.2, 12, 15, 180], ['slots', 1, 7.2, 5.6, 10, 12, 13, 180], ['slots', 5, 7.2, 5.6, 3.2, 12, 59, 180],
      ['staggered', 3, 7.2, 5.6, 3.2, 12, 38, 180], ['staggered', 5, 1, 1, 3.2, 12, 411, 180],
    ];
    for (const [sievePattern, sieveRows, gapWidth, gapSpacing, sieveMargin, tipBevel, count, scoopLength = 127] of rowCases)
      expect(sieveGaps({ sievePattern, sieveSizing: 'rows', sieveRows, gapWidth, gapLength: 25, gapSpacing, sieveMargin, tipBevel, scoopLength, wallThickness: 3.2 }), `${sievePattern} ${sieveRows} rows ${gapWidth}/${gapSpacing}/${sieveMargin}/${tipBevel}/${scoopLength}`).toHaveLength(count);
  });

  it('counts the gaps at other wall thicknesses exactly as scoop.scad lays them out', () => {
    // The wall sets the blade's inner corner radius, so the grid runs round the corners a little differently. Recorded from
    // `openscad -o x.echo -D ... models/litter-shovel/scoop.scad` (SIEVE_GAPS): [wall, overrides, count].
    const cases: [number, Partial<LitterShovelParameters>, number][] = [
      [1.2, {}, 15], [3.2, {}, 15], [1.2, { sieveRows: 3 }, 39], [3.2, { sieveRows: 3 }, 39],
      [1.2, { sievePattern: 'round', gapWidth: 5, gapSpacing: 3 }, 240], [1.6, { sievePattern: 'round', gapWidth: 5, gapSpacing: 3 }, 238],
      [2.4, { sievePattern: 'round', gapWidth: 5, gapSpacing: 3 }, 236], [3.2, { sievePattern: 'round', gapWidth: 5, gapSpacing: 3 }, 232],
      [1.2, { sievePattern: 'hex', gapWidth: 4, gapSpacing: 2, tipBevel: 8 }, 432], [1.6, { sievePattern: 'hex', gapWidth: 4, gapSpacing: 2, tipBevel: 8 }, 426],
      [2.4, { sievePattern: 'hex', gapWidth: 4, gapSpacing: 2, tipBevel: 8 }, 418], [3.2, { sievePattern: 'hex', gapWidth: 4, gapSpacing: 2, tipBevel: 8 }, 410],
      [1.2, { sieveSizing: 'length', gapLength: 30, scoopLength: 150 }, 35], [1.6, { sieveSizing: 'length', gapLength: 30, scoopLength: 150 }, 33],
    ];
    for (const [wallThickness, overrides, count] of cases)
      expect(sieveGaps({ ...defaults, ...overrides, wallThickness }), `${wallThickness} ${JSON.stringify(overrides)}`).toHaveLength(count);
  });

  it('offers the wall thickness from 1.2 to 3.2 mm, the blade’s wall before it was a parameter, and keeps the tip thinner than it', () => {
    expect(WALL_THICKNESS_RANGE).toEqual({ minimum: 1.2, maximum: 3.2, default: 1.6 });
    expect(scoop).toMatch(/^WALL_THICKNESS = 1\.6; \/\/\[1\.2:0\.1:3\.2\]$/m);
    expect(container).toMatch(/^WALL_THICKNESS = 1\.6; \/\/\[1\.2:0\.1:3\.2\]$/m);
    const control = litterShovel.controls.find(c => c.key === 'wallThickness');
    expect(control).toMatchObject({ group: 'advanced', minimum: 1.2, maximum: 3.2, default: 1.6, bands: WALL_BANDS });
    expect(WALL_BANDS[0]?.minimum).toBe(1.2);
    expect(WALL_BANDS.at(-1)?.maximum).toBe(3.2);
    expect(WALL_BANDS.every((band, i) => i === 0 || band.minimum === WALL_BANDS[i - 1]?.maximum)).toBe(true);
    // The floor follows the wall, 0.8 mm thicker, from 2 to 3.2 mm; the handle's root pad and the dam are set by ROOT_WALL.
    expect(container).toMatch(/^WALL = WALL_THICKNESS; FLOOR_T = min\(3\.2, WALL \+ 0\.8\); RIM_Z = 141\.5;$/m);
    expect(constant(container, 'ROOT_WALL')).toBe(2.4);
    for (const wallThickness of [1.2, 1.6, 2.4, 3.2]) expect(validateParameters(litterShovel, { ...defaults, wallThickness }), `${wallThickness}`).toEqual([]);
    for (const wallThickness of [1.1, 3.3, 1.25]) expect(validateParameters(litterShovel, { ...defaults, wallThickness }), `${wallThickness}`).not.toEqual([]);
    // The scraping edge stays 0.4 mm thinner than the wall, so that the bevel is one.
    expect(litterShovel.limits({ ...defaults, wallThickness: 1.2 }).tipThickness?.maximum).toBeCloseTo(0.8, 9);
    expect(litterShovel.limits({ ...defaults, wallThickness: 3.2 }).tipThickness?.maximum).toBeCloseTo(2.8, 9);
    expect(validateParameters(litterShovel, { ...defaults, wallThickness: 1.2, tipThickness: 0.8 })).toEqual([]);
    expect(validateParameters(litterShovel, { ...defaults, wallThickness: 1.2, tipThickness: 0.9 }).map(issue => issue.field)).toEqual(['tipThickness']);
    expect(validateParameters(litterShovel, { ...defaults, wallThickness: 1.6, tipThickness: 1.2 })).toEqual([]);
    // The countersinks stay above the funnel at every wall: its top, at the blade's inner face, is 5.8 mm above its foot for equal
    // container and blade walls, and the pad face (the seat) is at least as far in, where it is lower.
    const seat = HANDLE_FASTENER_SEAT;
    const band = plan(scoop, 'BAND'), lip = plan(scoop, 'LIP');
    const out = grow(grow(grow(lip, constant(scoop, 'BAG_GAP')), constant(scoop, 'SKIRT_T')), -constant(scoop, 'RING_T'));
    const footZ = constant(scoop, 'RIM_H') + 1;
    for (const wall of [WALL_THICKNESS_RANGE.minimum, WALL_THICKNESS_RANGE.default, WALL_THICKNESS_RANGE.maximum]) {
      const sleeveIn = grow(grow(band, -wall), -constant(scoop, 'SLEEVE_IN_OFFSET'));
      const top = footZ + ((out[0] - 2 * wall) - sleeveIn[0]) / 2;
      expect(constant(scoop, 'CAP_T') + constant(scoop, 'RIM_H') + seat.z - seat.sinkRadius, `wall ${wall}`).toBeGreaterThanOrEqual(top - 1e-9);
    }
    // Neither the fastener seat nor the screws it offers depend on the wall: the pads keep the seat's wall.
    for (const wallThickness of [1.2, 3.2])
      expect(validateParameters(litterShovel, { ...defaults, wallThickness, handleReinforcement: 'threaded-insert' })).toEqual([]);
  });

  it('keeps the blade and its sieve zone identical to scoop.scad', () => {
    const lip = plan(scoop, 'LIP');
    const out = grow(grow(grow(lip, constant(scoop, 'BAG_GAP')), constant(scoop, 'SKIRT_T')), -constant(scoop, 'RING_T'));
    expect(SCOOP_BLADE.backX).toBeCloseTo(-out[0] / 2, 9);
    expect(SCOOP_BLADE.flatY).toBeCloseTo(out[1] / 2 - out[2], 9);
    expect(SCOOP_BLADE.cornerRadius).toBeCloseTo(out[2], 9);
    expect(SCOOP_BLADE.sideLength).toBeCloseTo(out[0] - 2 * out[2], 9);
    expect(SCOOP_BLADE.sieveBottom).toBeCloseTo(constant(scoop, 'RIM_H') + constant(scoop, 'CAP_T') + constant(scoop, 'ROOT_BAND'), 9);
    expect(scoop).toMatch(/^HEIGHT = SCOOP_LENGTH; FRONT_Z = 26;$/m);
    expect(SCOOP_BLADE.frontZ).toBe(26);
    expect(scoop).toMatch(new RegExp(`^SCOOP_LENGTH = ${SCOOP_LENGTH_RANGE.default}; //\\[${SCOOP_LENGTH_RANGE.minimum}:${SCOOP_LENGTH_RANGE.step}:${SCOOP_LENGTH_RANGE.maximum}\\]$`, 'm'));
    expect(scoop).toMatch(/^DESCENT_START = CORNER_X - 8; DESCENT_END = -CORNER_X;$/m);
    // The side walls' top: level with the tip over the back, level with the front over the front corners, falling in between.
    const cornerX = SCOOP_BLADE.backX + SCOOP_BLADE.cornerRadius;
    for (const length of [SCOOP_LENGTH_RANGE.minimum, SCOOP_LENGTH_RANGE.maximum]) {
      expect(scoopSideTop(SCOOP_BLADE.backX, length)).toBe(length);
      expect(scoopSideTop(0, length)).toBeLessThan(length);
      expect(scoopSideTop(-cornerX, length)).toBeCloseTo(SCOOP_BLADE.frontZ, 9);
    }
    const height = SCOOP_LENGTH_RANGE.default;
    expect(scoopSideTop(SCOOP_BLADE.backX)).toBe(height);
    expect(scoopSideTop(cornerX - 8)).toBe(height);
    expect(scoopSideTop(0)).toBeLessThan(height);
    expect(scoopSideTop(0)).toBeGreaterThan(SCOOP_BLADE.frontZ);
    expect(scoopSideTop(-cornerX)).toBeCloseTo(SCOOP_BLADE.frontZ, 9);
  });

  it('shows the slot sizing only for slot textures, the engagements only with detents, and rejects impossible sieves', () => {
    const find = (key: string) => litterShovel.controls.find(control => control.key === key);
    const slots = { control: 'sievePattern', values: ['slots', 'staggered'] };
    expect(find('sieveSizing')).toMatchObject({ kind: 'enum', default: 'rows', visibleWhen: slots });
    expect(find('sieveSizing')?.options?.map(option => option.value)).toEqual(['rows', 'length']);
    expect(find('sieveRows')).toMatchObject({ kind: 'number', unit: null, default: 1, minimum: 1, maximum: 5, step: 1, visibleWhen: [slots, { control: 'sieveSizing', values: ['rows'] }] });
    expect(find('gapLength')?.visibleWhen).toEqual([slots, { control: 'sieveSizing', values: ['length'] }]);
    const shown = (key: string, values: Partial<LitterShovelParameters>) => { const c = find(key); return c !== undefined && controlShown(c, { ...defaults, ...values }); };
    expect([shown('sieveRows', {}), shown('gapLength', {})]).toEqual([true, false]);
    expect([shown('sieveRows', { sieveSizing: 'length' }), shown('gapLength', { sieveSizing: 'length' })]).toEqual([false, true]);
    for (const sievePattern of ['round', 'hex'] as const)
      expect(['sieveSizing', 'sieveRows', 'gapLength'].map(key => shown(key, { sievePattern, sieveSizing: 'length' }))).toEqual([false, false, false]);
    expect(find('gapWidth')).toMatchObject({ minimum: 1, maximum: 15 });
    expect(find('gapSpacing')).toMatchObject({ minimum: 1, maximum: 15 });
    expect(find('scoopDetentEngage')?.visibleWhen).toEqual({ control: 'scoopSnap', values: ['detent'] });
    expect(find('handleDetentEngage')?.visibleWhen).toEqual({ control: 'handleSnap', values: ['detent'] });
    expect(find('scoopSnap')?.options?.map(option => option.value)).toEqual(['friction', 'detent']);
    expect(find('clearance')?.recommended?.map(entry => entry.control)).toEqual(['scoopSnap', 'handleSnap']);
    for (const values of [{ sievePattern: 'round', gapWidth: 3, gapSpacing: 3, sieveMargin: 3 }, { sievePattern: 'hex', gapWidth: 15, gapSpacing: 15, sieveMargin: 10 }, { gapWidth: 15, gapLength: 40, gapSpacing: 15, sieveMargin: 10, sieveSizing: 'length' }, { sievePattern: 'round', gapLength: 6 }, { gapWidth: 1, gapSpacing: 1 }, { gapWidth: 1, gapSpacing: 1, sieveRows: 5 }, { sieveRows: 5 }, { sieveRows: 4, scoopLength: 90 }, { sieveSizing: 'length', gapLength: 82.5 }, { gapLength: 143 }, { gapLength: 100, sieveSizing: 'rows' }, { sievePattern: 'round', gapLength: 143, scoopLength: 90 }, { handleSnap: 'friction', scoopSnap: 'friction', clearance: 0.6 }, { gripEnd: 'floor', supportCount: 5, supportThickness: 4 }, { supportCount: 1, supportThickness: 1.2 }, { damWidth: 0 }, { damWidth: 15 }])
      expect(validateParameters(litterShovel, { ...defaults, ...values }), JSON.stringify(values)).toEqual([]);
    expect(validateParameters(litterShovel, { ...defaults, sieveSizing: 'length', gapWidth: 10, gapLength: 8 })[0]?.field).toBe('gapLength');
    // sized by rows, the slot length is ignored, and too many rows for the height are rejected with the most that fit
    expect(validateParameters(litterShovel, { ...defaults, gapWidth: 10, gapLength: 8 })).toEqual([]);
    const tooMany = validateParameters(litterShovel, { ...defaults, sieveRows: 5, scoopLength: 90 });
    expect(tooMany.map(issue => issue.field)).toEqual(['sieveRows']);
    expect(tooMany[0]?.message).toContain('at most 4 rows fit');
    expect(validateParameters(litterShovel, { ...defaults, sieveRows: 5, scoopLength: 90, gapSpacing: 15 })[0]?.message).toContain('no room for slots');
    for (const values of [{ sievePattern: 'diamond' }, { gapWidth: 0.9 }, { gapSpacing: 0.9 }, { gapLength: 143.5 }, { sieveSizing: 'columns' }, { sieveRows: 0 }, { sieveRows: 6 }, { sieveRows: 1.5 }, { sieveMargin: 2.9 }, { sieveMargin: 10.1 }, { gapWidth: 7.25 }, { handleSnap: 'clip' }, { clearance: 0.7 }, { tipThickness: 0.3 }, { tipThickness: 2.1 }, { tipBevel: 4.5 }, { tipBevel: 20.5 }, { tipBevel: 12.25 }, { supportCount: 0 }, { supportCount: 6 }, { supportCount: 2.5 }, { supportThickness: 1.1 }, { supportThickness: 4.1 }, { gripEnd: 'closed' }, { damWidth: -0.5 }, { damWidth: 15.5 }, { damWidth: 8.25 }])
      expect(validateParameters(litterShovel, { ...defaults, ...values }), JSON.stringify(values)).not.toEqual([]);
    // At the default length every sieve stays under the complexity limit; a longer scoop can exceed it, and validation says so.
    for (const sievePattern of ['round', 'hex'] as const)
      expect(sieveGaps({ sievePattern, sieveSizing: 'length', sieveRows: 1, gapWidth: 3, gapLength: 6, gapSpacing: 3, sieveMargin: 3, tipBevel: 5, scoopLength: 127, wallThickness: 1.6 }).length).toBeLessThanOrEqual(MAX_SIEVE_GAPS);
    const finest = { sievePattern: 'round', gapWidth: 3, gapSpacing: 3, sieveMargin: 3, tipBevel: 5 } as const;
    expect(validateParameters(litterShovel, { ...defaults, ...finest, scoopLength: 180 }).map(issue => issue.field)).toEqual(['gapSpacing']);
    expect(validateParameters(litterShovel, { ...defaults, ...finest, scoopLength: 150 })).toEqual([]);
    for (const scoopLength of [90, 180]) expect(validateParameters(litterShovel, { ...defaults, scoopLength }), `${scoopLength}`).toEqual([]);
    for (const scoopLength of [89, 181, 127.5]) expect(validateParameters(litterShovel, { ...defaults, scoopLength }), `${scoopLength}`).not.toEqual([]);
    expect(litterShovel.derived({ ...defaults, sieveSizing: 'length', scoopLength: 180 })).toEqual({ slotCount: 48 });
    // 1 mm gaps and bars: the finer sieves pass the complexity limit sooner, and validation still says so
    expect(validateParameters(litterShovel, { ...defaults, sievePattern: 'round', gapWidth: 1, gapSpacing: 1 }).map(issue => issue.field)).toEqual(['gapSpacing']);
    expect(validateParameters(litterShovel, { ...defaults, sieveSizing: 'length', gapWidth: 1, gapSpacing: 1, gapLength: 6 })[0]?.message).toBe('905 gaps are too many (at most 600). Use larger gaps or wider bars.');
  });

  it('limits the slot length to what the scoop’s length, the tip bevel and the margin leave room for', () => {
    const gapLength = litterShovel.controls.find(control => control.key === 'gapLength');
    if (!gapLength) throw new Error('gapLength control missing');
    // the schema's bound is the longest slot any setting leaves room for; the editor's range narrows it to the current settings
    expect(gapLength).toMatchObject({ minimum: 6, maximum: 143, step: 0.5 });
    expect(slotLengthLimit({ scoopLength: 180, tipBevel: 5, sieveMargin: 3 })).toBe(143);
    expect(controlRange(litterShovel, gapLength, defaults)).toEqual({ minimum: 6, maximum: 82.5 });
    expect(controlRange(litterShovel, gapLength, { ...defaults, scoopLength: 90, tipBevel: 20, sieveMargin: 10 })).toEqual({ minimum: 6, maximum: 24 });
    expect(controlRange(litterShovel, gapLength, { ...defaults, scoopLength: 180, tipBevel: 5, sieveMargin: 3 })).toEqual({ minimum: 6, maximum: 143 });
    const other = litterShovel.controls.find(control => control.key === 'gapWidth');
    if (other) expect(controlRange(litterShovel, other, defaults)).toEqual({ minimum: 1, maximum: 15 });
    // exactly the longest slot that still fits one row on the back
    for (const values of [{}, { scoopLength: 90 }, { scoopLength: 180, tipBevel: 5, sieveMargin: 3 }, { scoopLength: 101, tipBevel: 7.5, sieveMargin: 4.3 }]) {
      const p = { ...defaults, ...values, sieveSizing: 'length' as const };
      const most = slotLengthLimit(p);
      expect(sieveGaps({ ...p, gapLength: most }).length, JSON.stringify(values)).toBeGreaterThan(0);
      // sized by length, every slot is gapLength long
      for (const [, , l] of sieveGaps({ ...p, gapLength: most })) expect(l).toBe(most);
      expect(sieveGaps({ ...p, gapLength: most + 0.5 }), JSON.stringify(values)).toHaveLength(0);
    }
    // a slot that fitted is rejected once the scoop is shortened; hidden (sized by rows, or holes), it no longer matters
    const long = { ...defaults, sieveSizing: 'length', gapLength: 80 } as const;
    expect(validateParameters(litterShovel, long)).toEqual([]);
    const shortened = validateParameters(litterShovel, { ...long, scoopLength: 120 });
    expect(shortened.map(issue => issue.field)).toEqual(['gapLength']);
    expect(shortened[0]?.message).toMatch(/^At most 75\.5 mm: the scoop’s length \(120 mm\)/);
    expect(validateParameters(litterShovel, { ...long, scoopLength: 120, sieveSizing: 'rows' })).toEqual([]);
    expect(validateParameters(litterShovel, { ...long, scoopLength: 120, sievePattern: 'round' })).toEqual([]);
  });
});

describe('litter shovel handle reinforcement (parts library)', () => {
  const defaults = litterShovel.defaults as LitterShovelParameters;
  const source = (part: string) => readFileSync(new URL(`../../../models/litter-shovel/${part}.scad`, import.meta.url), 'utf8');
  const [scoop, handle] = ['scoop', 'handle'].map(source) as [string, string];
  const constant = (file: string, name: string) => {
    const match = new RegExp(`\\b${name} = ([\\d.]+);`).exec(file);
    if (!match?.[1]) throw new Error(`${name} not found`);
    return Number(match[1]);
  };
  const part = (id: string) => findPart(id) ?? (() => { throw new Error(`Missing ${id}`); })();
  const find = (key: string) => litterShovel.controls.find(control => control.key === key);
  const insertMode = { ...defaults, handleReinforcement: 'threaded-insert' } as const;
  const nutMode = { ...defaults, handleReinforcement: 'nut-bolt' } as const;

  it('offers every library part that fits, and only those, in every thread it offers', () => {
    const screws = parts.filter(handleScrewFits);
    expect(HANDLE_SCREWS).toEqual(screws.map(screw => screw.id));
    const order = Object.keys(METRIC_THREADS);
    expect(HANDLE_THREADS).toEqual([...new Set(screws.map(screw => screw.attributes['thread']))].sort((a, b) => order.indexOf(a ?? '') - order.indexOf(b ?? '')));
    expect(HANDLE_THREADS).toEqual(['M2', 'M2.5', 'M3', 'M4']);
    expect(HANDLE_INSERTS).toEqual(parts.filter(insert => handleInsertFits(insert, screws)).map(insert => insert.id));
    expect(HANDLE_NUTS).toEqual(parts.filter(nut => handleNutFits(nut, screws)).map(nut => nut.id));
    for (const thread of HANDLE_THREADS)
      for (const list of [HANDLE_SCREWS, HANDLE_INSERTS, HANDLE_NUTS]) expect(list.some(id => part(id).attributes['thread'] === thread), thread).toBe(true);
    // Countersunk only, flush in the 3.2 mm wall: ISO 10642 M3/M4 and ISO 7046-1 M2 to M4, 8 to 16 mm long.
    expect(new Set(HANDLE_SCREWS.map(id => part(id).attributes['standard']))).toEqual(new Set(['ISO 10642', 'ISO 7046-1']));
    for (const id of ['iso-7046-m5x10', 'iso-10642-m3x20', 'iso-10642-m5x10', 'iso-7046-m3x6', 'iso-4762-m3x10']) expect(handleScrewFits(part(id)), id).toBe(false);
    expect(HANDLE_SCREWS).toContain(DEFAULT_HANDLE_FASTENERS.screw);
    expect(HANDLE_INSERTS).toContain(DEFAULT_HANDLE_FASTENERS.insert);
    expect(HANDLE_NUTS).toContain(DEFAULT_HANDLE_FASTENERS.nut);
  });

  it('shows the fasteners only while reinforced, and offers only the parts of the chosen thread', () => {
    expect(find('handleReinforcement')?.options?.map(option => option.value)).toEqual(['none', 'threaded-insert', 'nut-bolt']);
    expect(find('handleThread')).toMatchObject({ visibleWhen: { control: 'handleReinforcement', values: ['threaded-insert', 'nut-bolt'] }, part: null });
    const filter = { control: 'handleThread', attribute: 'thread' };
    expect(find('handleInsert')).toMatchObject({ visibleWhen: { control: 'handleReinforcement', values: ['threaded-insert'] }, part: { family: 'threaded-insert', attribute: null, filter } });
    expect(find('handleNut')).toMatchObject({ visibleWhen: { control: 'handleReinforcement', values: ['nut-bolt'] }, part: { family: 'nut', attribute: null, filter } });
    expect(find('handleScrew')).toMatchObject({ visibleWhen: { control: 'handleReinforcement', values: ['threaded-insert', 'nut-bolt'] }, part: { family: 'screw', attribute: null, filter } });
    const screwControl = find('handleScrew');
    if (!screwControl) throw new Error('Missing handleScrew');
    for (const thread of HANDLE_THREADS) {
      const offered = offeredOptions(screwControl, { ...defaults, handleThread: thread });
      expect(offered.length).toBeGreaterThan(0);
      for (const option of offered) expect(part(option.value).attributes['thread']).toBe(thread);
    }
    // A part of another thread is rejected while it is shown, and ignored while it is hidden.
    expect(validateParameters(litterShovel, { ...insertMode, handleThread: 'M4' }).map(issue => issue.field)).toEqual(['handleInsert', 'handleScrew']);
    expect(validateParameters(litterShovel, { ...nutMode, handleThread: 'M4', handleNut: 'iso-4032-m4', handleScrew: 'iso-10642-m4x12' })).toEqual([]);
    expect(validateParameters(litterShovel, { ...defaults, handleThread: 'M4' })).toEqual([]);
  });

  it('asks for a screw long enough for the insert or the nut, at the clearance', () => {
    expect(validateParameters(litterShovel, insertMode)).toEqual([]);
    expect(validateParameters(litterShovel, nutMode)).toEqual([]);
    // A 5.7 mm insert needs a 6.7 mm hole and 0.4 mm of the ring: 7.1 mm past the 3.2 mm wall and the clearance.
    const short = validateParameters(litterShovel, { ...insertMode, handleScrew: 'iso-10642-m3x10' });
    expect(short.map(issue => issue.field)).toEqual(['handleScrew']);
    expect(short[0]?.message).toContain('Use at least Countersunk head screw M3 × 12.');
    expect(validateParameters(litterShovel, { ...insertMode, handleInsert: 'cnc-kitchen-m3x3', handleScrew: 'iso-7046-m3x8' })).toEqual([]);
    expect(validateParameters(litterShovel, { ...insertMode, handleInsert: 'cnc-kitchen-m3x3', handleScrew: 'iso-7046-m3x8', clearance: 0.5 }).map(issue => issue.field)).toEqual(['handleScrew']);
    // A nylon-insert nut is sized by its overall height: 5 mm, a 0.2 mm recess and a 1.2 mm floor, 6.4 mm in all.
    const m4 = { ...nutMode, handleThread: 'M4', handleNut: 'iso-10511-m4' } as const;
    expect(validateParameters(litterShovel, { ...m4, handleScrew: 'iso-10642-m4x8' }).map(issue => issue.field)).toEqual(['handleScrew']);
    expect(validateParameters(litterShovel, { ...m4, handleScrew: 'iso-10642-m4x10' })).toEqual([]);
    // Unused while not reinforced.
    expect(validateParameters(litterShovel, { ...defaults, handleScrew: 'iso-10642-m3x8' })).toEqual([]);
  });

  it('sizes both files from the chosen parts, and keeps their fastener seat equal to the contract', () => {
    const [, scoopPart, handlePart] = litterShovel.parts;
    const m4 = { ...nutMode, handleThread: 'M4', handleNut: 'din-562-m4', handleScrew: 'iso-7046-m4x16', clearance: 0.3 };
    expect(scadDefines(litterShovel, scoopPart ?? {}, m4)).toEqual(expect.arrayContaining([['HANDLE_REINFORCEMENT', '"nut-bolt"'], ['SCREW_HOLE', '4.5'], ['SCREW_D', '4'], ['SCREW_DK', '7.5'], ['SCREW_K', '2.2']]));
    expect(scadDefines(litterShovel, handlePart ?? {}, m4)).toEqual(expect.arrayContaining([['SCREW_HOLE', '4.5'], ['SCREW_L', '16'], ['NUT_S', '7'], ['NUT_H', '2.2'], ['NUT_SHAPE', '"square-thin"']]));
    expect(ISO_273_CLEARANCE_HOLES.M4.medium).toBe(4.5);
    const seat = HANDLE_FASTENER_SEAT;
    for (const file of [scoop, handle]) expect([constant(file, 'FASTENER_Y'), constant(file, 'FASTENER_Z')]).toEqual([seat.y, seat.z]);
    // Under the screws' heads the wall is the seat's whatever the blade's, on a pad round each screw (0.8 mm at the default wall).
    expect(constant(handle, 'FASTENER_WALL')).toBe(seat.seatWall);
    expect(constant(scoop, 'FASTENER_WALL')).toBe(seat.seatWall);
    expect(seat.seatWall).toBe(WALL_THICKNESS_RANGE.maximum);
    expect(constant(scoop, 'PAD_R')).toBeCloseTo(seat.sinkRadius + 1.05, 9);
    expect(constant(handle, 'CAP_TOP_Z')).toBe(seat.capTop);
    const blade = /\bBLADE = \[([\d.]+),/.exec(handle)?.[1];
    const capOut = /\bCAP_OUT = \[([\d.]+),/.exec(handle)?.[1];
    expect(Number(blade) / 2 - seat.seatWall).toBeCloseTo(seat.innerX, 9);
    expect(Number(capOut) / 2 - seat.innerX).toBeCloseTo(seat.ringOut, 9);
    expect([constant(handle, 'NUT_PLAY'), constant(handle, 'NUT_RECESS'), constant(handle, 'NUT_WALL'), constant(scoop, 'SINK_PLAY')]).toEqual([seat.nutPlay, seat.nutRecess, seat.nutWall, seat.sinkPlay]);
    // The ring is 15 mm high: every boss fits on it, clear of the cap below; each countersink stays below the sieve.
    expect(seat.z - seat.bossRadius).toBeGreaterThan(0);
    expect(seat.y - seat.bossRadius).toBeGreaterThan(13);
    expect(seat.z + seat.sinkRadius).toBeLessThan(constant(scoop, 'ROOT_BAND'));
  });

  it('reads a fallback dimension or an attribute of a chosen part', () => {
    expect(partDefineLiteral(part('iso-10511-m4'), [['h', 'm'], 'max'])).toBe('5');
    expect(partDefineLiteral(part('iso-4032-m4'), [['h', 'm'], 'max'])).toBe('3.2');
    expect(partDefineLiteral(part('din-562-m3'), { attribute: 'shape' })).toBe('"square-thin"');
    expect(() => partDefineLiteral(part('din-562-m3'), ['e', 'max'])).toThrow();
    expect(() => partDefineLiteral(part('din-562-m3'), { attribute: 'grade' })).toThrow();
  });

  it('shows the inserts or nuts on the handle and adds a step that drives the screws in from inside the scoop', () => {
    expect(resolveAssembly(litterShovel, litterShovel.assembly, defaults)).toBe(litterShovel.assembly);
    const assembly = resolveAssembly(litterShovel, litterShovel.assembly, insertMode);
    expect(assembly?.steps.map(step => step.parts)).toEqual([['scoop'], ['handle', 'handle-insert-plus-y', 'handle-insert-minus-y'], ['handle-screw-plus-y', 'handle-screw-minus-y']]);
    expect(assembly?.steps[2]).toMatchObject({ title: 'Drive the screws in from inside the scoop', from: [-20, 0, 0] });
    expect(assembly?.references?.map(reference => reference.part)).toEqual(['cnc-kitchen-m3x5-7', 'iso-10642-m3x12', 'cnc-kitchen-m3x5-7', 'iso-10642-m3x12']);
    // The screw's head is flush with the blade's inner face and the insert flush with the boss's face, where the screw ends.
    const seat = HANDLE_FASTENER_SEAT;
    expect(assembly?.poses['handle-screw-plus-y']).toEqual({ position: [seat.innerX + 12, seat.y, seat.capTop + seat.z], rotation: [0, -90, 0] });
    expect(assembly?.poses['handle-insert-minus-y']?.position[0]).toBeCloseTo(seat.innerX + 12 - dimensionOf(part('cnc-kitchen-m3x5-7'), 'l'), 9);
    const nuts = resolveAssembly(litterShovel, litterShovel.assembly, nutMode);
    expect(nuts?.poses['handle-nut-plus-y']?.position[0]).toBeCloseTo(seat.innerX + 12 - seat.nutRecess - 2.4, 9);
    expect(partUsage(part('iso-7046-m2x8')).filter(usage => usage.modelId === 'litter-shovel')).toEqual([{ modelId: 'litter-shovel', modelTitle: litterShovel.title, via: 'Screws', kind: 'model' }]);
    expect(partUsage(part('iso-4762-m3x10')).filter(usage => usage.modelId === 'litter-shovel')).toEqual([]);
  });
});

describe('toggle latch contract', () => {
  const defaults = toggleLatch.defaults;
  const source = (path: string) => readFileSync(new URL(`../../../models/toggle-latch/${path}`, import.meta.url), 'utf8');
  const part = (id: string) => findPart(id) ?? (() => { throw new Error(`Missing ${id}`); })();
  const find = (key: string) => toggleLatch.controls.find(control => control.key === key);

  it('is a registered four-part assembly whose screw settings reach both plates', () => {
    expect(findModel('toggle-latch')).toBe(toggleLatch);
    expect(artifactFormat(toggleLatch)).toBe('zip');
    expect(modelSourcePaths(toggleLatch)).toEqual(['base.scad', 'reference/Latch 12mm 3.scad', 'reference/Latch 12mm 4.scad', 'catch.scad'].map(path => `models/toggle-latch/${path}`));
    expect(defaults).toEqual({ screwKind: 'wood', woodScrewDiameter: '4 mm', woodScrew: 'din-7997-4x25', screwThread: 'M4', machineScrew: 'iso-10642-m4x12', holeFit: 'medium', highTolerance: false });
    expect(validateParameters(toggleLatch, defaults)).toEqual([]);
    expect(Value.Check(RenderRequestSchema, { modelId: 'toggle-latch', modelVersion: '1', parameters: defaults })).toBe(true);
    expect(Value.Check(RenderRequestSchema, { modelId: 'toggle-latch', modelVersion: '1', parameters: { ...defaults, extra: 1 } })).toBe(false);
    const [base, lever, link, plate] = toggleLatch.parts;
    expect(base?.scadMapping).toEqual(plate?.scadMapping);
    expect(base?.partDefines).toEqual(plate?.partDefines);
    expect(lever?.scadMapping).toEqual({ highTolerance: 'HITOL' });
    expect(link?.scadMapping).toBeUndefined();
    expect(scadDefines(toggleLatch, base ?? {}, { ...defaults, screwKind: 'machine', screwThread: 'M3', machineScrew: 'iso-7045-m3x10' }))
      .toEqual(expect.arrayContaining([['SCREW_KIND', '"machine"'], ['MACHINE_HOLES', '[3.2,3.4,3.6]'], ['MACHINE_HEAD', '"pan"'], ['MACHINE_DK', String(dimensionOf(part('iso-7045-m3x10'), 'dk', 'max'))]]));
    // a hexagon head has no dk: its width across corners keeps it clear
    expect(scadDefines(toggleLatch, base ?? {}, { ...defaults, screwKind: 'machine', screwThread: 'M4', machineScrew: 'iso-4017-m4x12' })).toContainEqual(['MACHINE_DK', '7.66']);
  });

  it('links the original and the remix it credits, with the pages ATTRIBUTION.md names', () => {
    expect(toggleLatch.attributionLinks.map(link => link.url)).toEqual(['https://www.thingiverse.com/thing:5993215', 'https://makerworld.com/de/models/625647-toggle-latch']);
    for (const link of toggleLatch.attributionLinks) expect(source('ATTRIBUTION.md')).toContain(link.url);
    // every model's linked phrases appear in its attribution, in order, so that the footer can link them
    for (const model of models) {
      let rest = model.attribution;
      for (const link of model.attributionLinks ?? []) {
        expect(rest, `${model.id}: ${link.text}`).toContain(link.text);
        rest = rest.slice(rest.indexOf(link.text) + link.text.length);
      }
    }
  });

  it('keeps every SCAD default equal to the contract default of the parameter (or library part) it is mapped from', () => {
    const files = ['base.scad', 'reference/Latch 12mm 3.scad', 'reference/Latch 12mm 4.scad', 'catch.scad'].map(source);
    toggleLatch.parts.forEach((p, index) => {
      for (const [name, literal] of scadDefines(toggleLatch, p, defaults))
        expect(files[index], name).toMatch(new RegExp(`^${name} = ${literal.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')};`, 'm'));
    });
    // the two plates size their holes with the same block
    const block = (file: string) => file.slice(file.indexOf('// Screws (from the parts library'), file.indexOf('SINK_RIM'));
    expect(block(source('catch.scad')).length).toBeGreaterThan(500);
    expect(block(source('base.scad'))).toBe(block(source('catch.scad')));
  });

  it('offers every library screw that fits the plates, and only those', () => {
    expect(LATCH_WOOD_SCREWS).toEqual(parts.filter(p => p.family === 'wood-screw' && latchScrewFits(p)).map(p => p.id));
    expect(LATCH_MACHINE_SCREWS).toEqual(parts.filter(p => p.family === 'screw' && latchScrewFits(p)).map(p => p.id));
    expect(LATCH_WOOD_DIAMETERS).toEqual([...new Set(LATCH_WOOD_SCREWS.map(id => part(id).attributes['diameter']))]);
    expect(LATCH_MACHINE_THREADS).toEqual([...new Set(LATCH_MACHINE_SCREWS.map(id => part(id).attributes['thread']))].sort());
    expect(LATCH_WOOD_DIAMETERS).toEqual(['3 mm', '3.5 mm', '4 mm', '4.5 mm', '5 mm']);
    expect(LATCH_MACHINE_THREADS).toEqual(['M2', 'M2.5', 'M3', 'M4', 'M5']);
    // 6 mm wood screws and M6 need a wider countersink than the 12 mm plate allows; M5 pan or socket heads would touch the link
    for (const id of ['din-7997-6x40', 'iso-10642-m6x16', 'iso-7045-m5x10', 'iso-4762-m5x10', 'iso-4762-m2x6']) expect(latchScrewFits(part(id)), id).toBe(false);
    for (const id of ['din-7997-4x25', 'din-7997-5x30', 'iso-10642-m5x12', 'iso-7045-m4x8', 'iso-4017-m4x8', 'iso-4762-m4x8']) expect(latchScrewFits(part(id)), id).toBe(true);
    for (const id of LATCH_MACHINE_SCREWS) expect(dimensionOf(part(id), 'l')).toBeGreaterThanOrEqual(TOGGLE_LATCH_SEAT.plate + TOGGLE_LATCH_SEAT.minReach);
    expect(LATCH_WOOD_SCREWS).toContain(DEFAULT_LATCH_SCREWS.wood);
    expect(LATCH_MACHINE_SCREWS).toContain(DEFAULT_LATCH_SCREWS.machine);
    expect(latchScrewHoles(part('din-7997-4x25'))).toEqual([4.3, 4.5, 4.8]);
    expect(latchScrewHoles(part('din-7997-3-5x16'))).toEqual([3.8, 4, 4.3]);
    expect(latchScrewHoles(part('iso-10642-m4x12'))).toEqual(Object.values(ISO_273_CLEARANCE_HOLES.M4));
  });

  it('shows the screws of the chosen kind and size only, linked to the library', () => {
    expect(find('woodScrewDiameter')).toMatchObject({ visibleWhen: { control: 'screwKind', values: ['wood'] }, part: { family: 'wood-screw', attribute: 'diameter', filter: null } });
    expect(find('woodScrew')).toMatchObject({ visibleWhen: { control: 'screwKind', values: ['wood'] }, part: { family: 'wood-screw', attribute: null, filter: { control: 'woodScrewDiameter', attribute: 'diameter' } } });
    expect(find('machineScrew')).toMatchObject({ visibleWhen: { control: 'screwKind', values: ['machine'] }, part: { family: 'screw', attribute: null, filter: { control: 'screwThread', attribute: 'thread' } } });
    const machine = { ...defaults, screwKind: 'machine' };
    expect(offeredOptions(find('machineScrew') as Control, { ...machine, screwThread: 'M3' }).every(option => part(option.value).attributes['thread'] === 'M3')).toBe(true);
    expect(validateParameters(toggleLatch, { ...machine, screwThread: 'M3' })).toContainEqual(expect.objectContaining({ field: 'machineScrew' }));
    expect(validateParameters(toggleLatch, { ...machine, screwThread: 'M3', machineScrew: 'iso-7045-m3x10' })).toEqual([]);
    // a hidden control's choice is not checked against its filter
    expect(validateParameters(toggleLatch, { ...defaults, screwThread: 'M3' })).toEqual([]);
    expect(validateParameters(toggleLatch, { ...defaults, woodScrewDiameter: '3 mm' })).toContainEqual(expect.objectContaining({ field: 'woodScrew' }));
    expect(validateParameters(toggleLatch, { ...defaults, woodScrew: 'din-7997-6x40' })).not.toEqual([]);
    expect(partUsage(part('din-7997-4x25')).filter(usage => usage.modelId === 'toggle-latch').map(usage => usage.via)).toEqual(expect.arrayContaining(['Wood screw']));
    expect(linkedPartData(toggleLatch).map(entry => entry.id)).toEqual([...LATCH_WOOD_SCREWS, ...LATCH_MACHINE_SCREWS]);
  });
});
