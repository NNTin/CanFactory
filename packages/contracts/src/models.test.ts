import { describe, expect, it } from 'vitest';
import { Value } from 'typebox/value';
import {
  artifactFormat, cigaretteCase, findModel, fruitFlyTrap, FruitFlyTrapParametersSchema, isAssembly, modelSourcePaths,
  minimumSpikeLength, mossPlanter, rauteColumns, slotCount, validateParameters, type MossPlanterParameters,
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
  it('is a parameterless five-part ZIP assembly whose sources are the verified static SCADs', () => {
    expect(findModel('cigarette-case')).toBe(cigaretteCase);
    expect(isAssembly(cigaretteCase)).toBe(true);
    expect(artifactFormat(cigaretteCase)).toBe('zip');
    expect(cigaretteCase.parts.map(part => part.id)).toEqual(['case-box', 'case-lid', 'mini-holder', 'mini-box', 'mini-lid']);
    expect(new Set(modelSourcePaths(cigaretteCase)).size).toBe(5);
    expect(cigaretteCase.controls).toEqual([]);
    expect(cigaretteCase.defaults).toEqual({});
    for (const part of cigaretteCase.parts) expect(part.scadMapping, part.id).toEqual({});
  });

  it('accepts only the empty parameter object and its own version', () => {
    expect(validateParameters(cigaretteCase, {})).toEqual([]);
    expect(validateParameters(cigaretteCase, { anything: 1 })).not.toEqual([]);
    expect(Value.Check(RenderRequestSchema, { modelId: 'cigarette-case', modelVersion: '1', parameters: {} })).toBe(true);
    expect(Value.Check(RenderRequestSchema, { modelId: 'cigarette-case', modelVersion: '2', parameters: {} })).toBe(false);
    expect(Value.Check(RenderRequestSchema, { modelId: 'cigarette-case', modelVersion: '1', parameters: { extra: 1 } })).toBe(false);
  });
});
