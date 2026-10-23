import { describe, expect, it } from 'vitest';
import { DEFAULT_TREAT_DISPENSER, treatScadLayout } from '@canfactory/contracts';
import { meshCacheFile, meshCacheKey } from './treat-trial-cache.ts';

describe('treat dispenser trial mesh cache', () => {
  it('changes its key whenever the generator, the layout or the version changes', () => {
    const layout = treatScadLayout(DEFAULT_TREAT_DISPENSER);
    const key = meshCacheKey('module disc() {}', layout, 1);
    expect(meshCacheKey('module disc() {}', layout, 1)).toBe(key);
    expect(meshCacheKey('module disc() { }', layout, 1)).not.toBe(key);
    expect(meshCacheKey('module disc() {}', treatScadLayout({ ...DEFAULT_TREAT_DISPENSER, treatWidth: 8 }), 1)).not.toBe(key);
    expect(meshCacheKey('module disc() {}', layout, 2)).not.toBe(key);
  });

  it('names a different file for different parameters', async () => {
    const a = await meshCacheFile(DEFAULT_TREAT_DISPENSER), b = await meshCacheFile({ ...DEFAULT_TREAT_DISPENSER, pocketClearance: 1.4 });
    expect(a).toMatch(/meshes-[0-9a-f]{24}\.json$/);
    expect(a).not.toBe(b);
  });
});
