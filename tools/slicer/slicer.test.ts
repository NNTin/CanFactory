// The slicer check's own parts, without OrcaSlicer: the G-code reader, the module check and the coupon. The check itself runs in CI
// (tools/test-slicer.ts); these make sure that what it reads and how it judges stay right.
import { describe, expect, it } from 'vitest';
import { qrTagCode } from '@canfactory/contracts';
import { checkPrint, moduleMap, type Grid } from './check.ts';
import { neighbourhoodCoupon, neighbourhoods } from './coupon.ts';
import { readExtrusions, type Extrusion } from './gcode.ts';

/** A dark grid printed as a slicer would fill it: lines `width` apart along each row of every dark module, above `z`. */
function printed(grid: Grid, width: number, z = 2, inset = 0): Extrusion[] {
  const n = grid.dark.length, m = grid.module, half = n * m / 2, lines: Extrusion[] = [];
  grid.dark.forEach((row, r) => row.forEach((dark, c) => {
    if (!dark) return;
    for (let y = half - r * m - width / 2 - inset; y > half - (r + 1) * m + inset; y -= width)
      lines.push({ x0: -half + c * m + width / 2 + inset, y0: y, x1: -half + (c + 1) * m - width / 2 - inset, y1: y, z, width, type: 'Top surface' });
  }));
  return lines;
}

describe('G-code', () => {
  it('reads the extruding moves with their widths, in absolute and relative extrusion, and leaves travel and wipes out', () => {
    const lines = readExtrusions([
      'M82', ';TYPE:Outer wall', ';WIDTH:0.45', 'G1 Z0.2', 'G1 X0 Y0', 'G1 X10 Y0 E1.5', 'G1 X10 Y10 E1.2 ; no extrusion: E went down',
      'G92 E0', 'M83', ';WIDTH:0.5', ';TYPE:Top surface', 'G1 Z1.8', 'G1 X0 Y10 E.4', 'G1 X0 Y0 E-.8 ; a retraction while moving (a wipe)', 'G0 X5 Y5',
    ].join('\n'));
    expect(lines).toEqual([
      { x0: 0, y0: 0, x1: 10, y1: 0, z: 0.2, width: 0.45, type: 'Outer wall' },
      { x0: 10, y0: 10, x1: 0, y1: 10, z: 1.8, width: 0.5, type: 'Top surface' },
    ]);
    expect(() => readExtrusions(';WIDTH:0.4\nG2 X1 Y1 I1 J0 E1')).toThrow(/arc move .*turn arc fitting off/);
    expect(() => readExtrusions('G1 X1 Y1 E1')).toThrow(/no ;WIDTH:/);
  });
});

describe('the module check', () => {
  const code = qrTagCode({ qrText: 'https://example.com', errorCorrection: 'H', logo: '', logoSize: 20 });
  const grid: Grid = { dark: code.dark, module: 1.4, quietZone: 2 };

  it('reads a print that fills every dark module, and decodes it', () => {
    const check = checkPrint(printed(grid, 0.45), 1.6, grid, 0.1);
    expect(check.errors).toEqual([]);
    expect(check.decoded).toBe('https://example.com');
    expect(check.layers).toEqual([2]);
    expect(Buffer.from(check.png.subarray(1, 4)).toString()).toBe('PNG');
  });

  it('ignores everything printed below the filament change', () => {
    const check = checkPrint(printed({ ...grid, dark: grid.dark.map(row => row.map(() => true)) }, 0.45, 1.4), 1.6, grid, 0.1);
    expect(check.extrusions).toBe(0);
    // with nothing above the change every dark module reads light
    expect(check.errors).toHaveLength(grid.dark.flat().filter(Boolean).length);
    expect(check.errors.every(error => error.shouldBe === 'dark')).toBe(true);
  });

  it('finds a dark module the slicer left out, a ring with an empty middle, and light gaps that the bleed closes', () => {
    // one dark module missing
    const missing = grid.dark.map(row => [...row]);
    const at = missing.flatMap((row, r) => row.map((dark, c) => [r, c, dark] as const)).find(([r, c, dark]) => dark && r > 8 && c > 8);
    if (!at) throw new Error('no dark module');
    (missing[at[0]] ?? [])[at[1]] = false;
    const check = checkPrint(printed({ ...grid, dark: missing }, 0.45), 1.6, grid, 0.1);
    expect(check.errors.map(({ row, column, shouldBe }) => ({ row, column, shouldBe }))).toEqual([{ row: at[0], column: at[1], shouldBe: 'dark' }]);
    expect(check.errors[0]?.middle).toBeLessThan(0.1);
    expect(moduleMap(grid, check.errors).split('\n')[at[0]]?.[at[1]]).toBe('X');
    // only an outline round each dark module: its middle stays light
    const n = grid.dark.length, m = grid.module, half = n * m / 2, w = 0.4;
    const rings = grid.dark.flatMap((row, r) => row.flatMap((dark, c): Extrusion[] => {
      if (!dark) return [];
      const [x0, x1, y0, y1] = [-half + c * m + w / 2, -half + (c + 1) * m - w / 2, half - (r + 1) * m + w / 2, half - r * m - w / 2];
      return [[x0, y0, x1, y0], [x1, y0, x1, y1], [x1, y1, x0, y1], [x0, y1, x0, y0]].map(([a, b, cc, d]) => ({ x0: a ?? 0, y0: b ?? 0, x1: cc ?? 0, y1: d ?? 0, z: 2, width: w, type: 'Outer wall' }));
    }));
    const ringCheck = checkPrint(rings, 1.6, grid, 0);
    expect(ringCheck.errors.length).toBeGreaterThan(0);
    expect(ringCheck.errors.every(error => error.shouldBe === 'dark' && error.whole > 0.4)).toBe(true);
    // a third of a module of bleed on each side closes every light gap
    const bled = checkPrint(printed(grid, 0.45), 1.6, grid, 0.45);
    expect(bled.errors.length).toBeGreaterThan(0);
    expect(bled.errors.every(error => error.shouldBe === 'light')).toBe(true);
  });
});

describe('the neighbourhood coupon', () => {
  it('holds all 512 patterns of 3 × 3 modules, the same every time', () => {
    const coupon = neighbourhoodCoupon(32);
    expect(neighbourhoods(coupon).size).toBe(512);
    expect(neighbourhoodCoupon(32)).toEqual(coupon);
  });
});
