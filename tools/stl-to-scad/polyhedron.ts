import { weld } from './topology.ts';
import { bounds, center, g, type Mesh } from './stl.ts';

export interface PolyhedronOptions {
  /** Module name emitted in the SCAD file. */
  name?: string;
  /** Coordinate decimals (default 3 = 1 µm). */
  decimals?: number;
  /** Snap vertices to a grid of this size (mm) before welding: crude decimation, drops collapsed triangles. */
  cluster?: number;
  /** Recentre XY on the origin and put the base on z = 0. */
  recentre?: boolean;
  header?: string[];
}

export interface PolyhedronResult { scad: string; points: number; faces: number; bytes: number }

/**
 * FALLBACK converter: emits the mesh as a single indexed polyhedron(). Faithful but neither editable nor small
 * (roughly 55 bytes per welded vertex + 20 per face). Prefer a parametric reconstruction; see the skill.
 */
export function meshToPolyhedron(mesh: Mesh, options: PolyhedronOptions = {}): PolyhedronResult {
  const decimals = options.decimals ?? 3;
  const b = bounds(mesh);
  const [cx, cy] = center(b);
  const shift = options.recentre === false ? [0, 0, 0] : [-cx, -cy, -b.min[2]];
  const tris = new Float64Array(mesh.tris.length);
  for (let i = 0; i < tris.length; i++) {
    let v = g(mesh.tris, i) + g(shift, i % 3);
    if (options.cluster && options.cluster > 0) v = Math.round(v / options.cluster) * options.cluster;
    tris[i] = v;
  }
  const { points, faces } = weld({ tris }, decimals);
  const kept: number[] = [];
  for (let i = 0; i < faces.length; i += 3) {
    const a = g(faces, i), c = g(faces, i + 1), d = g(faces, i + 2);
    if (a !== c && c !== d && a !== d) kept.push(a, c, d);
  }
  const pointRows: string[] = [];
  for (let i = 0; i < points.length; i += 3) pointRows.push(`[${g(points, i)},${g(points, i + 1)},${g(points, i + 2)}]`);
  const faceRows: string[] = [];
  // OpenSCAD wants clockwise faces when viewed from outside; STL is counter-clockwise, so reverse each triangle.
  for (let i = 0; i < kept.length; i += 3) faceRows.push(`[${g(kept, i)},${g(kept, i + 2)},${g(kept, i + 1)}]`);
  const name = options.name ?? 'stl_polyhedron';
  const header = (options.header ?? []).map(line => `// ${line}`);
  const scad = [
    ...header,
    `// polyhedron fallback: ${pointRows.length} points, ${faceRows.length} faces (not parametric)`,
    `module ${name}() {`,
    '  polyhedron(',
    `    points = [${pointRows.join(',')}],`,
    `    faces = [${faceRows.join(',')}], convexity = 10);`,
    '}',
    `${name}();`,
    '',
  ].join('\n');
  return { scad, points: pointRows.length, faces: faceRows.length, bytes: Buffer.byteLength(scad) };
}
