import { describe, expect, it } from 'vitest';
import { partUsage } from '../models.ts';
import { dimensionOf, findPart, findPartFamily, findPartSource, partsOfFamily } from './index.ts';

const entrances = partsOfFamily('cat-entrance');
const part = (id: string) => {
  const found = findPart(id);
  if (!found) throw new Error(`Missing retail entrance ${id}`);
  return found;
};

describe('retail cat entrance comparison catalogue', () => {
  it('registers eight sourced retail candidates, with both retention directions and no model integration', () => {
    expect(entrances).toHaveLength(8);
    expect(new Set(entrances.map(entrance => entrance.attributes['access']))).toEqual(new Set(['Manual 2-way', 'Manual 4-way', 'Microchip entry + manual 4-way']));
    const family = findPartFamily('cat-entrance');
    expect(family?.attributes.map(attribute => attribute.key)).toEqual(['brand', 'access', 'closedLock', 'holdOpen', 'seal']);
    for (const entrance of entrances) {
      expect(entrance.product?.url, entrance.id).toMatch(/^https:\/\//);
      expect(entrance.attributes['closedLock'], entrance.id).toBeTruthy();
      expect(entrance.attributes['holdOpen'], entrance.id).toBe('Not documented; unlocked is free-swinging');
      expect(entrance.notes, entrance.id).toContain('not a cutting template or mounting model');
      expect(partUsage(entrance), entrance.id).toEqual([]);
      for (const dimension of Object.values(entrance.dimensions)) {
        expect(dimension.basis, entrance.id).toBe('manufacturer');
        expect(findPartSource(dimension.source)?.kind, entrance.id).toBe('manufacturer');
        expect(dimension.min).toBeNull(); expect(dimension.max).toBeNull();
      }
      for (const [inner, outer] of [['cutoutWidth', 'frameWidth'], ['cutoutHeight', 'frameHeight'], ['passageWidth', 'cutoutWidth'], ['passageHeight', 'cutoutHeight'], ['flapWidth', 'cutoutWidth'], ['flapHeight', 'cutoutHeight']] as const) {
        if (inner in entrance.dimensions && outer in entrance.dimensions) expect(dimensionOf(entrance, inner), entrance.id).toBeLessThan(dimensionOf(entrance, outer));
      }
    }
  });

  it('does not relabel TRIXIE flap sizes or installation thicknesses as passage or overall depth', () => {
    for (const id of ['trixie-44211', 'trixie-44231']) {
      const entrance = part(id);
      expect(['frameWidth', 'frameHeight', 'cutoutWidth', 'cutoutHeight', 'flapWidth', 'flapHeight'].map(key => dimensionOf(entrance, key))).toEqual([200, 220, 159, 168, 140, 155]);
      expect(entrance.dimensions).not.toHaveProperty('passageWidth');
      expect(entrance.dimensions).not.toHaveProperty('passageHeight');
      expect(entrance.dimensions).not.toHaveProperty('overallDepth');
    }
    expect(dimensionOf(part('trixie-44211'), 'installationMin')).toBe(5);
    expect(part('trixie-44211').dimensions).not.toHaveProperty('installationMax');
    expect(dimensionOf(part('trixie-44231'), 'installationMin')).toBe(20);
    expect(dimensionOf(part('trixie-44231'), 'installationMax')).toBe(52);
  });

  it.each([
    ['715ef', 198, 236, 32, 158, 185, 152, 175],
    ['740ef', 292, 352, 45, 237, 281, 218, 238],
    ['760ef', 383, 454, 47, 314, 370, 289, 325],
  ])('reorders PetSafe %s H × W × D into explicit width/height/depth keys', (sku, ...expected) => {
    const entrance = part(`petsafe-staywell-${sku}`);
    expect(['frameWidth', 'frameHeight', 'overallDepth', 'cutoutWidth', 'cutoutHeight', 'passageWidth', 'passageHeight'].map(key => dimensionOf(entrance, key))).toEqual(expected);
    expect(entrance.dimensions).not.toHaveProperty('installationMax');
  });

  it('keeps the other makers’ known and unknown dimensions distinct', () => {
    const catMate = part('cat-mate-221');
    expect(['frameWidth', 'frameHeight', 'cutoutWidth', 'cutoutHeight', 'passageWidth', 'passageHeight', 'installationMax'].map(key => dimensionOf(catMate, key))).toEqual([235, 252, 204, 221, 180, 180, 50]);
    expect(catMate.dimensions).not.toHaveProperty('overallDepth');
    const ferplast = part('ferplast-swing-1');
    expect(['frameWidth', 'frameHeight', 'overallDepth', 'passageWidth', 'passageHeight'].map(key => dimensionOf(ferplast, key))).toEqual([215, 240, 50, 145, 148]);
    expect(ferplast.dimensions).not.toHaveProperty('cutoutWidth');
    expect(ferplast.attributes['access']).toBe('Manual 2-way');
    const sureflap = part('sureflap-microchip-cat-flap');
    expect(['frameWidth', 'frameHeight', 'cutoutWidth', 'cutoutHeight', 'passageWidth', 'passageHeight', 'tunnelDepth', 'frontFrameDepth'].map(key => dimensionOf(sureflap, key))).toEqual([210, 210, 165, 171, 142, 120, 70, 42]);
    expect(sureflap.dimensions).not.toHaveProperty('overallDepth');
    expect(sureflap.notes).toContain('does not selectively identify exiting cats');
  });
});
