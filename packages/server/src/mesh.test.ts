import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { combineParts, firstDegenerateTriangle, inspectStl } from './mesh.ts';

type Point = [number, number, number];
type Triangle = [Point, Point, Point];
const a: Point = [0, 0, 0]; const b: Point = [10, 0, 0]; const c: Point = [0, 10, 0]; const d: Point = [0, 0, 10];
const tetrahedron: Triangle[] = [[a, c, b], [a, b, d], [a, d, c], [b, c, d]];
function stl(triangles: Triangle[]): Buffer {
  const bytes = Buffer.alloc(84 + triangles.length * 50); bytes.writeUInt32LE(triangles.length, 80);
  triangles.forEach((triangle, index) => triangle.flat().forEach((value, coordinate) => bytes.writeFloatLE(value, 84 + index * 50 + 12 + coordinate * 4)));
  return bytes;
}

describe('generated STL validation', () => {
  it('measures a closed solid and rejects missing faces or corrupt coordinates', () => {
    expect(inspectStl(stl(tetrahedron))).toMatchObject({ triangles: 4, dimensions: { x: 10, y: 10, z: 10 } });
    expect(inspectStl(stl(tetrahedron)).volume).toBeCloseTo(1000 / 6);
    expect(() => inspectStl(stl(tetrahedron.slice(1)))).toThrow('closed');
    const broken = stl(tetrahedron); broken.writeFloatLE(Number.NaN, 96);
    expect(() => inspectStl(broken)).toThrow('non-finite');
    expect(() => inspectStl(broken.subarray(0, 100))).toThrow('invalid binary');
  });
  it('rejects reversed faces, inside-out volume, and disconnected solids', () => {
    expect(() => inspectStl(stl([[a, b, c], ...tetrahedron.slice(1)]))).toThrow('consistently wound');
    expect(() => inspectStl(stl(tetrahedron.map(([p, q, r]) => [p, r, q])))).toThrow('positive enclosed volume');
    const shifted: Triangle[] = tetrahedron.map(triangle => {
      const shift = ([x, y, z]: Point): Point => [x + 20, y, z];
      return [shift(triangle[0]), shift(triangle[1]), shift(triangle[2])];
    });
    expect(() => inspectStl(stl([...tetrahedron, ...shifted]))).toThrow('disconnected');
  });
});

describe('assembly artifact aggregation', () => {
  it('sums triangles and volume across parts and hashes the ZIP, not any one part', () => {
    const a1 = inspectStl(stl(tetrahedron));
    const a2 = inspectStl(stl(tetrahedron.map(([p, q, r]) => [[p[0] + 20, p[1], p[2]], [q[0] + 20, q[1], q[2]], [r[0] + 20, r[1], r[2]]])));
    const zipBytes = Buffer.from('not a real zip, just bytes to hash');
    const info = combineParts(zipBytes, [
      { id: 'a', title: 'A', bytes: a1.bytes, triangles: a1.triangles, dimensions: a1.dimensions, volume: a1.volume },
      { id: 'b', title: 'B', bytes: a2.bytes, triangles: a2.triangles, dimensions: a2.dimensions, volume: a2.volume },
    ]);
    expect(info.triangles).toBe(a1.triangles + a2.triangles);
    expect(info.volume).toBeCloseTo(a1.volume + a2.volume);
    expect(info.bytes).toBe(zipBytes.length);
    expect(info.sha256).toBe(createHash('sha256').update(zipBytes).digest('hex'));
    expect(info.parts).toEqual([
      { id: 'a', title: 'A', bytes: a1.bytes, triangles: a1.triangles, dimensions: a1.dimensions, volume: a1.volume },
      { id: 'b', title: 'B', bytes: a2.bytes, triangles: a2.triangles, dimensions: a2.dimensions, volume: a2.volume },
    ]);
  });

  it('returns zero totals for no parts without throwing', () => {
    const info = combineParts(Buffer.from(''), []);
    expect(info).toMatchObject({ triangles: 0, volume: 0, parts: [] });
  });
});

describe('degenerate triangle diagnostics', () => {
  it('locates a zero-area triangle by index and coordinates', () => {
    const collapsed: Triangle = [a, a, b]; // two shared vertices: zero area
    const last = tetrahedron[3]; if (!last) throw new Error('Expected a fourth triangle');
    const bytes = stl([...tetrahedron.slice(0, 2), collapsed, last]);
    const culprit = firstDegenerateTriangle(bytes);
    expect(culprit).toEqual({ index: 2, a, b: a, c: b });
  });

  it('finds nothing in a valid mesh or an incomplete/corrupt buffer', () => {
    expect(firstDegenerateTriangle(stl(tetrahedron))).toBeUndefined();
    expect(firstDegenerateTriangle(Buffer.alloc(10))).toBeUndefined();
    expect(firstDegenerateTriangle(stl(tetrahedron).subarray(0, 100))).toBeUndefined();
  });
});
