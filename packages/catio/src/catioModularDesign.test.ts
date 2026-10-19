import { describe, expect, it } from 'vitest';
import { MODULAR_DEFAULT as defaults, modularPitch, PRINTED_LATCH_JOINT, sidePortLength, validateEnclosure, validateModular } from './index.ts';

describe('the window and its cat ports', () => {
  it('makes a module one pitch: the shortest section that takes a side port, and a latched coupling’s gap', () => {
    expect(modularPitch(defaults)).toBe(sidePortLength(defaults.tunnelSize) + PRINTED_LATCH_JOINT.gap);
  });
  it('keeps the standard port square: a tunnel clear size the same both ways', () => {
    // one clear size, both ways
    expect('tunnelWidth' in defaults || 'tunnelHeight' in defaults).toBe(false);
    expect(validateModular({ ...defaults, tunnelSize: 350 })).toEqual([]);
    expect(validateModular({ ...defaults, tunnelSize: 460 }).join(' ')).toMatch(/Tunnel clear size must be 20–45 cm/);
  });
  it('checks an enclosure under its own name, and the window without one', () => {
    expect(validateEnclosure({ width: 1200, depth: 1000, height: 1200 }, defaults, 'Garden room')).toEqual([]);
    expect(validateEnclosure({ width: 700, depth: 1000, height: 500 }, defaults, 'Garden room')).toEqual([
      'Garden room width must be 80–240 cm.', 'Garden room height must be 90–220 cm.', 'Garden room is too low for its cat ports and their frames.',
    ]);
    expect(validateModular(defaults)).toEqual([]);
  });
});
