import { describe, expect, it } from 'vitest';
import { MODULAR_DEFAULT as defaults, modularLayout, modularPitch, PRINTED_LATCH_JOINT, sidePortLength, sidePortOffset, STANDARD_PORT, validateModular } from './index.ts';

/** The design as it was before the cat ports' closure could be chosen: every port has a sliding gate. */
describe('modular catio layout and validation', () => {
  it('derives straight and mirrored offset endpoints from the standard elements: modules a pitch long, corners at side ports', () => {
    // a pitch: the shortest section that takes a side port and a latched coupling's 3 mm gap; a corner is a module with a side port
    const pitch = modularPitch(defaults); const s = defaults.tunnelSize;
    expect(pitch).toBe(sidePortLength(s) + PRINTED_LATCH_JOINT.gap);
    expect(modularLayout(defaults).end).toEqual([0, 2 * pitch]);
    // the run before a turn ends the gap from the side port's face, the flanges' outline out from the corner's axis; the corner
    // runs on past it by its stub
    const reach = s / 2 + STANDARD_PORT.ring.width + PRINTED_LATCH_JOINT.gap; const offset = sidePortOffset(s);
    for (const sign of [-1, 1]) {
      const layout = modularLayout({ ...defaults, route: sign < 0 ? 'left' : 'right', approach: 1, lateral: 2, final: 3 });
      expect(layout.end[0]).toBeCloseTo(sign * (3 * pitch - offset + reach)); expect(layout.end[1]).toBeCloseTo(pitch + reach - offset + 4 * pitch);
      expect(layout.sections.filter(q => q.kind === 'corner').every(q => q.length === pitch)).toBe(true);
      expect(layout.sections.filter(q => q.kind === 'corner').map(q => q.openings)).toEqual([[sign > 0 ? 'right' : 'left', 'front'], [sign > 0 ? 'left' : 'right', 'front']]);
      expect(layout.sections.filter(s => s.kind === 'corner')).toHaveLength(2);
      expect(layout.sections).toHaveLength(8);
    }
  });
  it('aligns independent enclosures at their rear landings with a measured link', () => {
    const c = { ...defaults, route: 'left' as const, secondEnabled: true, second: { width: 1800, depth: 1600, height: 1900 }, link: 3 };
    const { enclosures } = modularLayout(c); const [a, b] = enclosures;
    if (!a || !b) throw new Error('Missing enclosures');
    expect(b.rearY).toBe(a.rearY); expect(b.centerX - b.size.width / 2 - (a.centerX + a.size.width / 2)).toBe(3 * modularPitch(c));
    expect(validateModular(c)).toEqual([]);
  });
  it('keeps the standard port square: a tunnel clear size the same both ways', () => {
    // one clear size, both ways
    expect('tunnelWidth' in defaults || 'tunnelHeight' in defaults).toBe(false);
    expect(validateModular({ ...defaults, tunnelSize: 350 })).toEqual([]);
    expect(validateModular({ ...defaults, tunnelSize: 460 }).join(' ')).toMatch(/Tunnel clear size must be 20–45 cm/);
  });
});
