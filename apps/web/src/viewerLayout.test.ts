import { describe, expect, it } from 'vitest';
import { viewerGrid } from './viewerLayout.ts';

describe('print-bed layout', () => {
  it('centres a single mesh and handles an empty scene', () => {
    expect(viewerGrid([])).toEqual({ width: 0, length: 0, centres: [] });
    expect(viewerGrid([{ x: 48, y: 103 }]).centres).toEqual([[0, 0]]);
  });
  it('packs hardware-heavy assemblies without overlapping parts or making the assembled model unreadably small', () => {
    const sizes = [{ x: 48, y: 103 }, { x: 48, y: 103 }, { x: 17.8, y: 21 }, { x: 40, y: 40 }, ...Array.from({ length: 20 }, () => ({ x: 6, y: 6 }))];
    const bed = viewerGrid(sizes);
    expect(bed.width).toBeLessThan(250);
    expect(bed.length).toBeLessThan(250);
    expect(bed.centres).toHaveLength(sizes.length);
    for (let i = 0; i < sizes.length; i++) for (let j = i + 1; j < sizes.length; j++) {
      const a = sizes[i], b = sizes[j], ca = bed.centres[i], cb = bed.centres[j];
      if (!a || !b || !ca || !cb) throw new Error('Missing grid item.');
      expect(Math.abs(ca[0] - cb[0]) >= (a.x + b.x) / 2 || Math.abs(ca[1] - cb[1]) >= (a.y + b.y) / 2).toBe(true);
    }
  });
});
