import { describe, expect, it } from 'vitest';
import { bodyTriangles, poseIds, splitBodies, type PrintBody } from './printBodies.ts';

/** A closed box as 12 triangles (9 numbers each), outward-wound. */
function box([x0, y0, z0]: [number, number, number], [x1, y1, z1]: [number, number, number]): number[] {
  const p = (i: number) => [i & 1 ? x1 : x0, i & 2 ? y1 : y0, i & 4 ? z1 : z0];
  const quads = [[0, 2, 3, 1], [4, 5, 7, 6], [0, 1, 5, 4], [2, 6, 7, 3], [0, 4, 6, 2], [1, 3, 7, 5]];
  return quads.flatMap(([a = 0, b = 0, c = 0, d = 0]) => [...p(a), ...p(b), ...p(c), ...p(a), ...p(c), ...p(d)]);
}

// A plate and a pin above it that do not touch, as a print-in-place pair is printed.
const tris = [...box([0, 0, 0], [30, 20, 2]), ...box([10, 5, 4], [20, 15, 8])];
const bodies: PrintBody[] = [{ id: 'plate', title: 'Plate', point: [15, 10, 1] }, { id: 'pin', title: 'Pin', point: [15, 10, 6] }];

describe('print-in-place bodies', () => {
  it('splits a print into its bodies and names each by the point inside it', () => {
    const split = splitBodies(tris, bodies);
    expect(split['plate']).toHaveLength(12);
    expect(split['pin']?.map(t => t - 12)).toEqual(Array.from({ length: 12 }, (_, i) => i));
    const soups = bodyTriangles(tris, bodies);
    expect(Array.from(soups['pin'] ?? []).slice(0, 9)).toEqual(tris.slice(12 * 9, 13 * 9));
  });

  it('refuses a print that is not exactly its bodies', () => {
    expect(() => splitBodies(box([0, 0, 0], [30, 20, 2]), bodies)).toThrow('Expected 2 bodies');
    expect(() => splitBodies(tris, [bodies[0] as PrintBody, { id: 'pin', title: 'Pin', point: [40, 40, 40] }])).toThrow('contains none');
    expect(() => splitBodies(tris, [bodies[0] as PrintBody, { id: 'pin', title: 'Pin', point: [15, 10, 1.5] }])).toThrow('plate and pin');
  });

  it('poses a print-in-place part by its bodies and any other part by itself', () => {
    expect(poseIds([{ id: 'print', bodies }, { id: 'lid' }])).toEqual(['plate', 'pin', 'lid']);
  });
});
