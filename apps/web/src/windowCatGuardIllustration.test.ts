import { describe, expect, it } from 'vitest';
import { guardFrame } from './WindowCatGuardIllustration.tsx';

describe('window cat guard card', () => {
  it('rests on the guard in the tilted window', () => {
    expect(guardFrame(null)).toEqual({ tilt: 1, left: [1, 1, 1], right: [1, 1, 1], strip: [1, 1, 1, 1, 1], stage: 'Guarded' });
  });

  it('tilts the window, brings in each panel segment by segment, then the strip from its right end, and clears', () => {
    expect(guardFrame(0)).toMatchObject({ tilt: 0, left: [0, 0, 0], stage: 'Tilt the window' });
    expect(guardFrame(0.22)).toMatchObject({ tilt: 1, right: [0, 0, 0], stage: 'Left panel' });
    // the left panel's top segment is in before the next one starts
    const left = guardFrame(0.22).left;
    expect(left[0]).toBe(1); expect(left[2]).toBe(0);
    expect(guardFrame(0.5)).toMatchObject({ left: [1, 1, 1], stage: 'Right panel' });
    const strip = guardFrame(0.66).strip;
    expect(strip.at(-1)).toBe(1); expect(strip[0]).toBe(0);
    expect(guardFrame(0.85)).toEqual({ ...guardFrame(null), stage: 'Guarded' });
    expect(guardFrame(0.999)).toMatchObject({ tilt: 0, left: [0, 0, 0], strip: [0, 0, 0, 0, 0], stage: 'Close the window' });
  });
});
