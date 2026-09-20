import { describe, expect, it } from 'vitest';
import { Value } from 'typebox/value';
import { fruitFlyTrap, FruitFlyTrapParametersSchema, slotCount, validateParameters } from './models.ts';
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
