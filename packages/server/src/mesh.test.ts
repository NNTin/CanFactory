import { describe, expect, it } from 'vitest';
import { inspectStl } from './mesh.ts';

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
