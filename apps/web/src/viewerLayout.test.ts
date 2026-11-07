import { describe, expect, it } from 'vitest';
import { spreadApart, viewerGrid } from './viewerLayout.ts';

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
  it('gives small fasteners shallow rows of their own instead of a cell as deep as the housing beside them', () => {
    const sizes = [{ x: 100, y: 100 }, { x: 80, y: 90 }, ...Array.from({ length: 6 }, () => ({ x: 6, y: 6 }))];
    const bed = viewerGrid(sizes);
    const [housing, , ...screws] = bed.centres;
    if (!housing) throw new Error('Missing grid item.');
    // the screws lie together in one row, in front of the housing, not spread over housing-sized cells
    expect(new Set(screws.map(at => at[1].toFixed(6))).size).toBe(1);
    expect(Math.max(...screws.map(at => at[0])) - Math.min(...screws.map(at => at[0]))).toBeLessThan(6 * 1.4 * 6);
    expect(bed.length).toBeLessThan(100 * 1.4 + 6 * 1.4 + 1e-9 + 90 * 1.4);
    expect(bed.length).toBeLessThan(2 * 100 * 1.4);
  });
  it('pushes overlays apart until none covers another', () => {
    const points: [number, number][] = [[100, 100], [100, 100], [110, 104], [300, 300]];
    spreadApart(points, [46, 20]);
    for (let i = 0; i < points.length; i++) for (let j = i + 1; j < points.length; j++) {
      const a = points[i], b = points[j];
      if (!a || !b) throw new Error('Missing point.');
      expect(Math.hypot((a[0] - b[0]) / 46, (a[1] - b[1]) / 20)).toBeGreaterThan(0.9);
    }
    expect(points[3]).toEqual([300, 300]);
  });
});
