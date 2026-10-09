import { describe, expect, it } from 'vitest';
import { convexParts, extrudedPieces, isConvex, revolvedPieces, signedArea, type Point2 } from './physicsPieces.ts';

const area = (polygons: Point2[][]): number => polygons.reduce((sum, polygon) => sum + signedArea(polygon) / 2, 0);

describe('convexParts', () => {
  it('keeps a convex polygon whole', () => {
    expect(convexParts([[0, 0], [2, 0], [2, 1], [0, 1]])).toHaveLength(1);
  });

  it('splits an L into convex parts covering it exactly', () => {
    const l: Point2[] = [[0, 0], [3, 0], [3, 1], [1, 1], [1, 3], [0, 3]];
    const parts = convexParts(l);
    expect(parts.length).toBeLessThanOrEqual(3);
    for (const part of parts) expect(isConvex(part)).toBe(true);
    expect(area(parts)).toBeCloseTo(5, 9);
  });

  it('takes clockwise polygons and comb shapes', () => {
    const comb: Point2[] = [[0, 0], [5, 0], [5, 3], [4, 3], [4, 1], [3, 1], [3, 3], [2, 3], [2, 1], [1, 1], [1, 3], [0, 3]];
    const parts = convexParts([...comb].reverse());
    for (const part of parts) expect(isConvex(part)).toBe(true);
    expect(area(parts)).toBeCloseTo(5 + 3 * 2, 9);
  });
});

describe('pieces', () => {
  it('revolves a ring into segments', () => {
    const pieces = revolvedPieces([[1, 0], [2, 0], [2, 1], [1, 1]], 8);
    expect(pieces).toHaveLength(8);
    expect(pieces[0]).toHaveLength(2 * 4 * 3);
  });

  it('extrudes along the remaining axis', () => {
    const [piece] = extrudedPieces([[0, 0], [1, 0], [1, 1]], [1, 2], -2, 3);
    // y, z from the profile; x from -2 to 3
    expect(piece?.slice(0, 3)).toEqual([-2, 0, 0]);
    expect(piece?.slice(9, 12)).toEqual([3, 0, 0]);
  });
});
