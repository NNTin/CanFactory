import { g, type Mesh } from './stl.ts';

type V = [number, number, number];

function build(triangles: [V, V, V][]): Mesh {
  return { tris: Float64Array.from(triangles.flat(2)) };
}

/** Axis-aligned box with outward (counter-clockwise) winding, minimum corner at `origin`. */
export function box(width: number, depth: number, height: number, origin: V = [0, 0, 0]): Mesh {
  const [x, y, z] = origin;
  const p = (i: number, j: number, k: number): V => [x + i * width, y + j * depth, z + k * height];
  const quad = (a: V, b: V, c: V, d: V): [V, V, V][] => [[a, b, c], [a, c, d]];
  return build([
    ...quad(p(0, 0, 0), p(0, 1, 0), p(1, 1, 0), p(1, 0, 0)), // bottom (-z)
    ...quad(p(0, 0, 1), p(1, 0, 1), p(1, 1, 1), p(0, 1, 1)), // top (+z)
    ...quad(p(0, 0, 0), p(1, 0, 0), p(1, 0, 1), p(0, 0, 1)), // -y
    ...quad(p(1, 0, 0), p(1, 1, 0), p(1, 1, 1), p(1, 0, 1)), // +x
    ...quad(p(1, 1, 0), p(0, 1, 0), p(0, 1, 1), p(1, 1, 1)), // +y
    ...quad(p(0, 1, 0), p(0, 0, 0), p(0, 0, 1), p(0, 1, 1)), // -x
  ]);
}

/** Closed tube (ring) between `inner` and `outer` radius, `segments`-gon, centred on `origin` XY with base at origin Z. */
export function ring(inner: number, outer: number, height: number, segments = 48, origin: V = [0, 0, 0]): Mesh {
  const [ox, oy, oz] = origin;
  const at = (r: number, i: number, z: number): V => [ox + r * Math.cos((2 * Math.PI * (i % segments)) / segments), oy + r * Math.sin((2 * Math.PI * (i % segments)) / segments), oz + z];
  const tris: [V, V, V][] = [];
  for (let i = 0; i < segments; i++) {
    const j = i + 1;
    tris.push([at(outer, i, 0), at(outer, j, 0), at(outer, j, height)], [at(outer, i, 0), at(outer, j, height), at(outer, i, height)]); // outer wall
    tris.push([at(inner, i, 0), at(inner, j, height), at(inner, j, 0)], [at(inner, i, 0), at(inner, i, height), at(inner, j, height)]); // inner wall
    tris.push([at(inner, i, height), at(outer, i, height), at(outer, j, height)], [at(inner, i, height), at(outer, j, height), at(inner, j, height)]); // top
    tris.push([at(inner, i, 0), at(outer, j, 0), at(outer, i, 0)], [at(inner, i, 0), at(inner, j, 0), at(outer, j, 0)]); // bottom
  }
  return build(tris);
}

/** Solid cylinder (ring with zero inner radius is degenerate, so build caps explicitly). */
export function cylinder(radius: number, height: number, segments = 48, origin: V = [0, 0, 0]): Mesh {
  const [ox, oy, oz] = origin;
  const at = (i: number, z: number): V => [ox + radius * Math.cos((2 * Math.PI * (i % segments)) / segments), oy + radius * Math.sin((2 * Math.PI * (i % segments)) / segments), oz + z];
  const tris: [V, V, V][] = [];
  for (let i = 0; i < segments; i++) {
    const j = i + 1;
    tris.push([at(i, 0), at(j, 0), at(j, height)], [at(i, 0), at(j, height), at(i, height)]);
    tris.push([[ox, oy, oz + height], at(i, height), at(j, height)]);
    tris.push([[ox, oy, oz], at(j, 0), at(i, 0)]);
  }
  return build(tris);
}

/** Remove the first `count` triangles to make an open mesh. */
export function withHole(mesh: Mesh, count = 1): Mesh {
  return { tris: mesh.tris.slice(count * 9) };
}

/** Merge two meshes into one triangle soup (e.g. two disjoint bodies). */
export function merge(a: Mesh, b: Mesh): Mesh {
  const tris = new Float64Array(a.tris.length + b.tris.length);
  tris.set(a.tris);
  tris.set(b.tris, a.tris.length);
  return { tris };
}

export const vertexAt = (mesh: Mesh, index: number): V => [g(mesh.tris, index * 3), g(mesh.tris, index * 3 + 1), g(mesh.tris, index * 3 + 2)];
