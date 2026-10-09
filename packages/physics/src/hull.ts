/**
 * The convex hull of a point set, as outward-wound triangles (indices into the points), by incremental construction. For the
 * piece-fit measurement of convex pieces given as vertex lists; small sets (tens to hundreds of points).
 */
type V = [number, number, number];

const sub = (a: V, b: V): V => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a: V, b: V): V => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a: V, b: V): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

/** Triangles (i, j, k, ...) of the hull of `vertices` (x, y, z, ...); empty when the points span no volume. */
export function hullTriangles(vertices: readonly number[]): number[] {
  const points: V[] = [];
  for (let i = 0; i + 2 < vertices.length; i += 3) points.push([vertices[i] ?? 0, vertices[i + 1] ?? 0, vertices[i + 2] ?? 0]);
  const p = (i: number): V => points[i] ?? [0, 0, 0];
  const size = Math.max(1e-9, ...[0, 1, 2].map(k => Math.max(...points.map(q => q[k] ?? 0)) - Math.min(...points.map(q => q[k] ?? 0))));
  const eps = 1e-9 * size;
  // a first tetrahedron: two far points, the point furthest from their line, the point furthest from their plane
  let a = 0, b = 0;
  for (let i = 1; i < points.length; i++) if (p(i)[0] < p(a)[0]) a = i;
  for (let i = 0; i < points.length; i++) if (Math.hypot(...sub(p(i), p(a))) > Math.hypot(...sub(p(b), p(a)))) b = i;
  let c = -1, best = eps;
  for (let i = 0; i < points.length; i++) { const area = Math.hypot(...cross(sub(p(b), p(a)), sub(p(i), p(a)))); if (area > best) { best = area; c = i; } }
  if (c < 0) return [];
  const normal = cross(sub(p(b), p(a)), sub(p(c), p(a)));
  let d = -1; best = eps * Math.hypot(...normal);
  for (let i = 0; i < points.length; i++) { const h = Math.abs(dot(normal, sub(p(i), p(a)))); if (h > best) { best = h; d = i; } }
  if (d < 0) return [];
  let faces: [number, number, number][] = dot(normal, sub(p(d), p(a))) > 0 ? [[a, c, b], [a, b, d], [b, c, d], [c, a, d]] : [[a, b, c], [a, d, b], [b, d, c], [c, d, a]];
  const above = (face: [number, number, number], q: V): boolean => {
    const [i, j, k] = face;
    const n = cross(sub(p(j), p(i)), sub(p(k), p(i)));
    return dot(n, sub(q, p(i))) > eps * Math.hypot(...n);
  };
  for (let i = 0; i < points.length; i++) {
    if (i === a || i === b || i === c || i === d) continue;
    const visible = faces.filter(face => above(face, p(i)));
    if (visible.length === 0) continue;
    // the horizon: edges of visible faces not shared with another visible face
    const edges = new Map<string, [number, number]>();
    for (const [x, y, z] of visible) for (const [u, v] of [[x, y], [y, z], [z, x]] as [number, number][]) {
      const back = `${v},${u}`;
      if (edges.has(back)) edges.delete(back); else edges.set(`${u},${v}`, [u, v]);
    }
    faces = faces.filter(face => !visible.includes(face));
    for (const [u, v] of edges.values()) faces.push([u, v, i]);
  }
  return faces.flat();
}
