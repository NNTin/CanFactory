import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { Value } from 'typebox/value';
import {
  activeParts, artifactFormat, cigaretteCase, CLEARANCE_HOLES, findModel, holeDiameter, plankConnector, fruitFlyTrap, FruitFlyTrapParametersSchema, isAssembly, modelSourcePaths,
  minimumSpikeLength, mossPlanter, rauteColumns, slotCount, SNAP_CLEARANCE, SNAP_TUNING, HOLDER_SNAP_CLEARANCE, LIGHTER_SNAP_CLEARANCE, MINI_BOX_SNAP_CLEARANCE, MINI_LID_SNAP_CLEARANCE, scadLiteral, textWidth, validateParameters, type MossPlanterParameters,
} from './models.ts';
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
    expect(cigaretteCase.controls.map(control => [control.key, control.kind])).toEqual([['snap', 'enum'], ['miniLidSnap', 'enum'], ['holderSnap', 'enum'], ['lighterSnap', 'enum'], ['miniBoxSnap', 'enum'], ['undersideMark', 'enum'], ['engraveText', 'text'], ['textFont', 'enum'], ['textSize', 'number'], ['logo', 'svg'], ['logoSize', 'number'], ['textMode', 'enum'], ['clearance', 'number'],
      ['snapDetentEngage', 'number'], ['snapCrushSqueeze', 'number'], ['miniLidDetentEngage', 'number'], ['miniLidCrushSqueeze', 'number'], ['holderDetentEngage', 'number'], ['holderCrushSqueeze', 'number'], ['lighterCrushSqueeze', 'number'], ['miniBoxDetentEngage', 'number'], ['miniBoxCrushSqueeze', 'number']]);
    expect(cigaretteCase.controls[0]?.options?.map(option => option.value)).toEqual(['friction', 'detent', 'clip', 'magnet', 'crush-ribs']);
    for (const index of [1, 2, 4]) expect(cigaretteCase.controls[index]?.options?.map(option => option.value)).toEqual(['friction', 'detent', 'crush-ribs']);
    expect(cigaretteCase.controls[3]?.options?.map(option => option.value)).toEqual(['friction', 'crush-ribs']);
    expect(cigaretteCase.controls[5]?.options?.map(option => option.value)).toEqual(['text', 'logo']);
    expect(cigaretteCase.controls[7]?.options?.map(option => option.value)).toEqual(['sans', 'serif', 'mono', 'wide']);
    expect(cigaretteCase.controls[6]).toMatchObject({ default: '', maximum: 20, visibleWhen: { control: 'undersideMark', values: ['text'] } });
    expect(cigaretteCase.controls[9]).toMatchObject({ default: '', maximum: LOGO_MAX_LENGTH, visibleWhen: { control: 'undersideMark', values: ['logo'] } });
    expect(cigaretteCase.controls[10]).toMatchObject({ default: 12, minimum: 3, maximum: 15, visibleWhen: { control: 'undersideMark', values: ['logo'] } });
    expect(cigaretteCase.defaults).toEqual({ snap: 'friction', miniLidSnap: 'friction', holderSnap: 'friction', lighterSnap: 'friction', miniBoxSnap: 'friction', undersideMark: 'text', engraveText: '', textFont: 'sans', textSize: 6, logo: '', logoSize: 12, textMode: 'engrave', clearance: 0.2,
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
    expect(Value.Check(RenderRequestSchema, { modelId: 'cigarette-case', modelVersion: '7', parameters: ok })).toBe(true);
    expect(Value.Check(RenderRequestSchema, { modelId: 'cigarette-case', modelVersion: '6', parameters: ok })).toBe(false);
    expect(Value.Check(RenderRequestSchema, { modelId: 'cigarette-case', modelVersion: '7', parameters: { snap: 'clip' } })).toBe(false);
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
