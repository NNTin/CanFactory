import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { combineParts, firstDegenerateTriangle, inspectStl, MAX_SLIVER_REPAIRS, MeshRepairError, repairFloat32Slivers } from './mesh.ts';

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

describe('float32 sliver repair', () => {
  it('removes the triangles on an edge that float32 collapsed to a point, leaving the closed solid around it', () => {
    // the tetrahedron with b split into b and b' joined by an edge shorter than float32 resolves: written out, b' is b
    const b2: Point = [...b];
    const split: Triangle[] = [[a, c, b], [a, b2, d], [a, d, c], [b2, c, d], [b, b2, a], [b2, b, c]];
    expect(() => inspectStl(stl(split))).toThrow('zero-area');
    const { bytes, repaired } = repairFloat32Slivers(stl(split));
    expect(repaired).toBe(2);
    const info = inspectStl(bytes);
    expect(info.triangles).toBe(4);
    expect(info.volume).toBeCloseTo(1000 / 6);
  });

  // The tetrahedron with a vertex m on the edge a-b: the face a-b-d is split at m, and the face a-c-b meets it through a
  // sliver (a, b, m), three collinear points, as binary STL's float32 coordinates leave a thin sliver between two cuts.
  const m: Point = [5, 0, 0];
  const withSliver: Triangle[] = [[a, c, b], [a, m, d], [m, b, d], [a, d, c], [b, c, d], [a, b, m]];

  it('splits the sliver\'s neighbour at the middle vertex, leaving a closed solid of the same volume', () => {
    expect(() => inspectStl(stl(withSliver))).toThrow('zero-area');
    const { bytes, repaired } = repairFloat32Slivers(stl(withSliver));
    expect(repaired).toBe(1);
    const info = inspectStl(bytes);
    expect(info.triangles).toBe(withSliver.length);
    expect(info.volume).toBeCloseTo(1000 / 6);
    expect(info.dimensions).toEqual({ x: 10, y: 10, z: 10 });
    expect(bytes.subarray(0, 80)).toEqual(stl(withSliver).subarray(0, 80));
  });

  it('returns a valid mesh untouched', () => {
    const valid = stl(tetrahedron);
    expect(repairFloat32Slivers(valid)).toEqual({ bytes: valid, repaired: 0 });
  });

  it('refuses a collapse that opens the mesh, an open long edge, and more slivers than rounding explains', () => {
    const last = tetrahedron[3]; if (!last) throw new Error('Expected a fourth triangle');
    expect(() => repairFloat32Slivers(stl([...tetrahedron.slice(0, 2), [a, a, b], last]))).toThrow('leaves the edge');
    expect(() => repairFloat32Slivers(stl(withSliver.slice(1)))).toThrow(MeshRepairError);
    expect(() => repairFloat32Slivers(stl(withSliver.slice(1)))).toThrow('0 opposite faces');
    // a closed chain of slivers along a-b: the face a-b-d split at many points, closed against a-c-b by a fan of slivers from a
    const points = Array.from({ length: MAX_SLIVER_REPAIRS + 1 }, (_, i): Point => [10 * (i + 1) / (MAX_SLIVER_REPAIRS + 2), 0, 0]);
    const chain = [a, ...points, b];
    const split: Triangle[] = chain.slice(1).map((point, i): Triangle => [chain[i] ?? a, point, d]);
    const slivers: Triangle[] = chain.slice(2).map((point, i): Triangle => [a, point, chain[i + 1] ?? a]);
    const many: Triangle[] = [[a, c, b], [a, d, c], [b, c, d], ...split, ...slivers];
    expect(slivers).toHaveLength(MAX_SLIVER_REPAIRS + 1);
    expect(() => repairFloat32Slivers(stl(many))).toThrow(`More than ${MAX_SLIVER_REPAIRS}`);
    // the same chain within the limit is repaired
    const few = [a, points[0] ?? a, points[1] ?? a, b];
    const fewMesh: Triangle[] = [[a, c, b], [a, d, c], [b, c, d], ...few.slice(1).map((point, i): Triangle => [few[i] ?? a, point, d]), ...few.slice(2).map((point, i): Triangle => [a, point, few[i + 1] ?? a])];
    const fixed = repairFloat32Slivers(stl(fewMesh));
    expect(fixed.repaired).toBe(4); // the first sliver's neighbour is the other sliver: its split leaves two more
    expect(inspectStl(fixed.bytes).volume).toBeCloseTo(1000 / 6);
  });
});
