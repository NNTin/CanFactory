import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { Value } from 'typebox/value';
import {
  activeParts, artifactFormat, cigaretteCase, findModel, fruitFlyTrap, FruitFlyTrapParametersSchema, isAssembly, modelSourcePaths,
  minimumSpikeLength, mossPlanter, rauteColumns, slotCount, textWidth, validateParameters, type MossPlanterParameters,
} from './models.ts';
import { RenderRequestSchema } from './index.ts';

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
  it('is a ZIP assembly with snap, text, font, size and style controls that reach only the parts that use them', () => {
    expect(findModel('cigarette-case')).toBe(cigaretteCase);
    expect(isAssembly(cigaretteCase)).toBe(true);
    expect(artifactFormat(cigaretteCase)).toBe('zip');
    expect(cigaretteCase.parts.map(part => part.id)).toEqual(['case-box', 'case-lid', 'mini-holder', 'mini-box', 'mini-lid', 'case-text']);
    expect(new Set(modelSourcePaths(cigaretteCase)).size).toBe(6);
    expect(cigaretteCase.controls.map(control => [control.key, control.kind])).toEqual([['snap', 'enum'], ['engraveText', 'text'], ['textFont', 'enum'], ['textSize', 'number'], ['textMode', 'enum']]);
    expect(cigaretteCase.controls[0]?.options?.map(option => option.value)).toEqual(['friction', 'detent', 'clip', 'magnet', 'crush-ribs']);
    expect(cigaretteCase.controls[2]?.options?.map(option => option.value)).toEqual(['sans', 'serif', 'mono', 'wide']);
    expect(cigaretteCase.controls[1]).toMatchObject({ default: '', maximum: 20 });
    expect(cigaretteCase.defaults).toEqual({ snap: 'friction', engraveText: '', textFont: 'sans', textSize: 6, textMode: 'engrave' });
    const mapped = Object.fromEntries(cigaretteCase.parts.map(part => [part.id, part.scadMapping]));
    const text = { engraveText: 'TEXT', textFont: 'TEXT_FONT', textSize: 'TEXT_SIZE' };
    expect(mapped).toEqual({ 'case-box': { snap: 'SNAP', ...text }, 'case-lid': { snap: 'SNAP' }, 'mini-holder': {}, 'mini-box': {}, 'mini-lid': { snap: 'SNAP' }, 'case-text': text });
  });

  it('renders the text part only for visible text in second-filament mode', () => {
    const ids = (values: Record<string, string | number>) => activeParts(cigaretteCase, { ...ok, ...values }).map(part => part.id);
    expect(ids({})).toEqual(['case-box', 'case-lid', 'mini-holder', 'mini-box', 'mini-lid']);
    expect(ids({ engraveText: 'Tom' })).toEqual(['case-box', 'case-lid', 'mini-holder', 'mini-box', 'mini-lid']);
    expect(ids({ textMode: 'second-filament' })).not.toContain('case-text');
    expect(ids({ textMode: 'second-filament', engraveText: '   ' })).not.toContain('case-text');
    expect(ids({ textMode: 'second-filament', engraveText: 'Tom' }).at(-1)).toBe('case-text');
    expect(cigaretteCase.parts.find(part => part.id === 'case-text')?.separateBodies).toBe(true);
  });

  it('accepts only known snap modes, fonts and styles, printable ASCII text within the limits, and its own version', () => {
    for (const snap of ['friction', 'detent', 'clip', 'magnet', 'crush-ribs']) expect(validateParameters(cigaretteCase, { ...ok, snap }), snap).toEqual([]);
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
    expect(Value.Check(RenderRequestSchema, { modelId: 'cigarette-case', modelVersion: '3', parameters: ok })).toBe(true);
    expect(Value.Check(RenderRequestSchema, { modelId: 'cigarette-case', modelVersion: '2', parameters: ok })).toBe(false);
    expect(Value.Check(RenderRequestSchema, { modelId: 'cigarette-case', modelVersion: '3', parameters: { snap: 'clip' } })).toBe(false);
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

  it('keeps the underside-text block identical in the box SCAD and the text-part SCAD', () => {
    const block = (path: string) => /\/\/ --- underside text[\s\S]*?\/\/ --- end underside text ---/.exec(readFileSync(new URL(`../../../${path}`, import.meta.url), 'utf8'))?.[0];
    const box = block('models/cigarette-case/reference/11_v11.3__-_honeycomb_-_box.scad');
    expect(box).toContain('TEXT_DEPTH');
    expect(block('models/cigarette-case/underside-text.scad')).toBe(box);
  });
});
