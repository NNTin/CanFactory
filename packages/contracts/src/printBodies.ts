/**
 * Print-in-place parts (`ModelPart.bodies`): one print made of several closed bodies that move against each other once printed,
 * such as a trigger printed on its pins inside a frame. The print is one STL (the ZIP's only file for it); the preview, the
 * assembly check and the tests find its bodies in it with `splitBodies`.
 */

/** One body of a print-in-place part: its id (the key of its pose in the assembly), its title, and a point inside it (mm, the
 * part's frame) by which it is told from the others. */
export interface PrintBody { id: string; title: string; point: readonly [number, number, number] }

/** The ids the assembly poses for these parts: a print-in-place part's bodies instead of the part itself. */
export function poseIds(parts: readonly { id: string; bodies?: readonly PrintBody[] }[]): string[] {
  return parts.flatMap(part => part.bodies ? part.bodies.map(body => body.id) : [part.id]);
}

/** A ray direction that no axis-aligned or 45-degree feature runs along, for the inside test. */
const RAY = (() => { const d = [1, 0.3713, 0.2291]; const n = Math.hypot(...d); return d.map(v => v / n) as [number, number, number]; })();

/** Whether `point` is inside the closed body made of these triangles (indices into `tris`, 9 numbers each): an odd number of
 * crossings along a ray. */
function contains(tris: ArrayLike<number>, triangles: readonly number[], point: readonly number[]): boolean {
  const [px, py, pz] = [point[0] ?? 0, point[1] ?? 0, point[2] ?? 0], [dx, dy, dz] = RAY;
  let crossings = 0;
  for (const t of triangles) {
    const o = t * 9, v = (k: number) => tris[o + k] ?? 0;
    const e1x = v(3) - v(0), e1y = v(4) - v(1), e1z = v(5) - v(2), e2x = v(6) - v(0), e2y = v(7) - v(1), e2z = v(8) - v(2);
    const hx = dy * e2z - dz * e2y, hy = dz * e2x - dx * e2z, hz = dx * e2y - dy * e2x;
    const det = e1x * hx + e1y * hy + e1z * hz;
    if (Math.abs(det) < 1e-12) continue;
    const sx = px - v(0), sy = py - v(1), sz = pz - v(2);
    const u = (sx * hx + sy * hy + sz * hz) / det;
    if (u < 0 || u > 1) continue;
    const qx = sy * e1z - sz * e1y, qy = sz * e1x - sx * e1z, qz = sx * e1y - sy * e1x;
    const w = (dx * qx + dy * qy + dz * qz) / det;
    if (w < 0 || u + w > 1) continue;
    if ((e2x * qx + e2y * qy + e2z * qz) / det > 0) crossings++;
  }
  return crossings % 2 === 1;
}

/**
 * Splits a print-in-place part's triangles (x, y, z of each corner, 9 numbers per triangle, as an STL holds them) into its
 * bodies: the connected sets of triangles (sharing corners exactly), each named by the one body of `bodies` whose point is
 * inside it. Returns each body's triangle indices. Throws unless every body is found exactly once and nothing is left over.
 */
export function splitBodies(tris: ArrayLike<number>, bodies: readonly PrintBody[]): Record<string, number[]> {
  const count = Math.floor(tris.length / 9);
  const vertex = new Map<string, number>(), parent: number[] = [];
  const find = (a: number): number => { while (parent[a] !== a) { const up = parent[parent[a] ?? a] ?? a; parent[a] = up; a = up; } return a; };
  const corners: number[] = [];
  for (let t = 0; t < count; t++) for (let k = 0; k < 3; k++) {
    const o = t * 9 + k * 3, key = `${tris[o]},${tris[o + 1]},${tris[o + 2]}`;
    let id = vertex.get(key);
    if (id === undefined) { id = parent.length; vertex.set(key, id); parent.push(id); }
    corners.push(id);
  }
  for (let t = 0; t < count; t++) {
    const a = find(corners[t * 3] ?? 0);
    for (let k = 1; k < 3; k++) { const b = find(corners[t * 3 + k] ?? 0); if (a !== b) parent[b] = a; }
  }
  const components = new Map<number, number[]>();
  for (let t = 0; t < count; t++) {
    const root = find(corners[t * 3] ?? 0);
    const list = components.get(root);
    if (list) list.push(t); else components.set(root, [t]);
  }
  if (components.size !== bodies.length) throw new Error(`Expected ${bodies.length} bodies (${bodies.map(body => body.id).join(', ')}), found ${components.size}.`);
  const result: Record<string, number[]> = {};
  for (const triangles of components.values()) {
    const named = bodies.filter(body => contains(tris, triangles, body.point));
    if (named.length !== 1) throw new Error(`A body of ${triangles.length} triangles contains ${named.length === 0 ? 'none' : named.map(body => body.id).join(' and ')} of the bodies' points.`);
    const id = named[0]?.id ?? '';
    if (result[id]) throw new Error(`Two bodies contain ${id}'s point.`);
    result[id] = triangles;
  }
  return result;
}

/** The triangles of each body of a print-in-place part, as separate triangle soups (the same layout as the input). */
export function bodyTriangles(tris: ArrayLike<number>, bodies: readonly PrintBody[]): Record<string, Float64Array> {
  const split = splitBodies(tris, bodies);
  return Object.fromEntries(Object.entries(split).map(([id, triangles]) => {
    const out = new Float64Array(triangles.length * 9);
    triangles.forEach((t, i) => { for (let k = 0; k < 9; k++) out[i * 9 + k] = tris[t * 9 + k] ?? 0; });
    return [id, out];
  }));
}
