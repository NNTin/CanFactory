import { createHash } from 'node:crypto';
import type { Dimensions } from '@canfactory/contracts';

/** Validated binary STL metadata. Volume is mm³; dimensions are mm. `meshRepairs` counts float32 slivers repaired
 * (`repairFloat32Slivers`); absent when there were none. */
export interface MeshInfo { sha256: string; bytes: number; triangles: number; dimensions: Dimensions; volume: number; meshRepairs?: number }

/** One part's metadata inside an assembly's ZIP artifact. */
export interface AssemblyPart { id: string; title: string; bytes: number; triangles: number; dimensions: Dimensions; volume: number; meshRepairs?: number }

/**
 * Combined metadata for a multi-part assembly's ZIP artifact. There is deliberately no top-level `dimensions`: each
 * part is independently centred, so a bounding box across all of them is not a meaningful "printed size."
 */
export interface AssemblyInfo { sha256: string; bytes: number; triangles: number; volume: number; parts: AssemblyPart[]; meshRepairs?: number }

/** Aggregate validated per-part metadata (from `inspectStl`, plus id/title) into one ZIP's combined metadata. */
export function combineParts(zipBytes: Buffer, parts: AssemblyPart[]): AssemblyInfo {
  const meshRepairs = parts.reduce((sum, part) => sum + (part.meshRepairs ?? 0), 0);
  return {
    sha256: createHash('sha256').update(zipBytes).digest('hex'),
    bytes: zipBytes.length,
    triangles: parts.reduce((sum, part) => sum + part.triangles, 0),
    volume: parts.reduce((sum, part) => sum + part.volume, 0),
    parts,
    ...meshRepairs ? { meshRepairs } : {},
  };
}

/** Diagnostic only (not used by `inspectStl` itself): locate the first triangle with near-zero area, if any. Lets
 * callers report exactly which geometry an "empty or invalid binary STL" / "zero-area triangle" failure came from. */
export function firstDegenerateTriangle(bytes: Buffer): { index: number; a: [number, number, number]; b: [number, number, number]; c: [number, number, number] } | undefined {
  if (bytes.length < 84) return undefined;
  const triangleCount = bytes.readUInt32LE(80);
  if (bytes.length !== 84 + triangleCount * 50) return undefined;
  for (let index = 0; index < triangleCount; index++) {
    const offset = 84 + index * 50 + 12;
    const a: [number, number, number] = [bytes.readFloatLE(offset), bytes.readFloatLE(offset + 4), bytes.readFloatLE(offset + 8)];
    const b: [number, number, number] = [bytes.readFloatLE(offset + 12), bytes.readFloatLE(offset + 16), bytes.readFloatLE(offset + 20)];
    const c: [number, number, number] = [bytes.readFloatLE(offset + 24), bytes.readFloatLE(offset + 28), bytes.readFloatLE(offset + 32)];
    const nx = (b[1] - a[1]) * (c[2] - a[2]) - (b[2] - a[2]) * (c[1] - a[1]);
    const ny = (b[2] - a[2]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[2] - a[2]);
    const nz = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
    if (nx * nx + ny * ny + nz * nz < 1e-20) return { index, a, b, c };
  }
  return undefined;
}

/** The most repairs `repairFloat32Slivers` makes in one mesh: a bound on the work, not on quality. Every repair is logged, counted
 * and fails the renderer tests and the geometry sweep; this only stops a mesh that is mostly degenerate. */
export const MAX_SLIVER_REPAIRS = 1024;

/** A mesh that cannot be repaired; the render must fail with this, loudly. */
export class MeshRepairError extends Error {
  constructor(message: string) { super(message); this.name = 'MeshRepairError'; }
}

/**
 * Repair the zero-area triangles that binary STL's float32 coordinates make of thin but valid slivers.
 *
 * OpenSCAD computes in double precision, where two cuts can leave features a micrometre apart; rounded to float32 they degenerate
 * in one of two ways, both repaired without moving any vertex:
 * - An edge shorter than float32 resolves collapses: its two ends become one point, and the two triangles on it have coincident
 *   vertices. They are removed (the edge collapse the rounding already made); their other edges pair up as before.
 * - A sliver becomes three collinear points (u, v, m), with m between u and v, on the edge u–v of exactly one neighbour (v, u, d).
 *   Both are replaced by (v, m, d) and (m, u, d): the neighbour split at m.
 * The surface and the volume are unchanged. Anything else (an open or over-shared long edge, a mesh left open by the collapses,
 * more than MAX_SLIVER_REPAIRS repairs) throws a MeshRepairError instead: that is broken geometry, not rounding. `repaired`
 * counts removed and split triangles. Returns the input unchanged (the same Buffer) when there is nothing to repair.
 */
export function repairFloat32Slivers(bytes: Buffer): { bytes: Buffer; repaired: number } {
  if (!firstDegenerateTriangle(bytes)) return { bytes, repaired: 0 };
  const count = bytes.readUInt32LE(80);
  const points: [number, number, number][] = [];
  const ids = new Map<string, number>();
  const vertex = (offset: number) => {
    const point: [number, number, number] = [bytes.readFloatLE(offset), bytes.readFloatLE(offset + 4), bytes.readFloatLE(offset + 8)];
    const key = point.join(',');
    let id = ids.get(key);
    if (id === undefined) { id = points.length; ids.set(key, id); points.push(point); }
    return id;
  };
  const triangles: ([number, number, number] | undefined)[] = [];
  const normals: Buffer[] = [];
  for (let index = 0; index < count; index++) {
    const offset = 84 + index * 50;
    normals.push(bytes.subarray(offset, offset + 12));
    triangles.push([vertex(offset + 12), vertex(offset + 24), vertex(offset + 36)]);
  }
  // directed edge "from>to" -> the triangles that have it
  const edges = new Map<string, Set<number>>();
  const link = (index: number, add: boolean) => {
    const triangle = triangles[index];
    if (!triangle) return;
    for (const [from, to] of [[triangle[0], triangle[1]], [triangle[1], triangle[2]], [triangle[2], triangle[0]]] as const) {
      const key = `${from}>${to}`;
      const owners = edges.get(key) ?? new Set<number>();
      if (add) owners.add(index); else owners.delete(index);
      if (owners.size) edges.set(key, owners); else edges.delete(key);
    }
  };
  triangles.forEach((_, index) => { link(index, true); });
  const degenerate = (triangle: [number, number, number]) => {
    const [a, b, c] = triangle.map(id => points[id] ?? [0, 0, 0]) as [[number, number, number], [number, number, number], [number, number, number]];
    const nx = (b[1] - a[1]) * (c[2] - a[2]) - (b[2] - a[2]) * (c[1] - a[1]);
    const ny = (b[2] - a[2]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[2] - a[2]);
    const nz = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
    return nx * nx + ny * ny + nz * nz < 1e-20;
  };
  const distance = (p: number, q: number) => {
    const a = points[p] ?? [0, 0, 0], b = points[q] ?? [0, 0, 0];
    return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  };
  const describe = (triangle: [number, number, number]) => triangle.map(id => JSON.stringify(points[id])).join(' ');
  let repaired = 0;
  const repair = () => {
    if (++repaired > MAX_SLIVER_REPAIRS) throw new MeshRepairError(`More than ${MAX_SLIVER_REPAIRS} zero-area triangles to repair: the geometry is broken, not rounded.`);
  };
  // Collapsed edges first: the triangles on them go, and the mesh must still be closed without them.
  let collapsed = 0;
  triangles.forEach((triangle, index) => {
    if (!triangle || (triangle[0] !== triangle[1] && triangle[1] !== triangle[2] && triangle[2] !== triangle[0])) return;
    repair(); collapsed++;
    link(index, false); triangles[index] = undefined;
  });
  if (collapsed) for (const [key, owners] of edges) {
    const [from, to] = key.split('>');
    if (owners.size !== 1 || edges.get(`${to}>${from}`)?.size !== 1)
      throw new MeshRepairError(`Removing ${collapsed} triangles with coincident vertices leaves the edge ${JSON.stringify(points[Number(from)])}-${JSON.stringify(points[Number(to)])} with ${owners.size} faces one way and ${edges.get(`${to}>${from}`)?.size ?? 0} the other: the geometry is broken, not rounded.`);
  }
  for (let index = 0; index < triangles.length; index++) {
    const triangle = triangles[index];
    if (!triangle || !degenerate(triangle)) continue;
    repair();
    // the long edge u->v in this triangle's winding, and the vertex m between them
    const [a, b, c] = triangle;
    const rotations: [number, number, number][] = [[a, b, c], [b, c, a], [c, a, b]];
    const [u, v, m] = rotations.reduce((best, next) => distance(next[0], next[1]) > distance(best[0], best[1]) ? next : best);
    const owners = [...(edges.get(`${v}>${u}`) ?? [])];
    const neighbourIndex = owners[0];
    const neighbour = neighbourIndex === undefined ? undefined : triangles[neighbourIndex];
    if (owners.length !== 1 || neighbourIndex === undefined || !neighbour)
      throw new MeshRepairError(`The long edge of a zero-area triangle has ${owners.length} opposite faces, not 1: ${describe(triangle)}.`);
    const d = neighbour[(neighbour.indexOf(v) + 2) % 3];
    if (d === undefined || d === m) throw new MeshRepairError(`A zero-area triangle folds onto its neighbour: ${describe(triangle)}.`);
    link(index, false); link(neighbourIndex, false);
    triangles[index] = undefined;
    triangles[neighbourIndex] = [v, m, d];
    triangles.push([m, u, d]);
    normals.push(normals[neighbourIndex] ?? Buffer.alloc(12));
    link(neighbourIndex, true); link(triangles.length - 1, true);
    // a split can leave its own slivers (d on the line too): the loop reaches the appended triangle, and rechecks the split one
    if (degenerate([v, m, d])) index = Math.min(index, neighbourIndex) - 1;
  }
  const kept = triangles.flatMap((triangle, index) => triangle ? [{ triangle, normal: normals[index] ?? Buffer.alloc(12) }] : []);
  const output = Buffer.alloc(84 + kept.length * 50);
  bytes.copy(output, 0, 0, 80);
  output.writeUInt32LE(kept.length, 80);
  kept.forEach(({ triangle, normal }, index) => {
    const offset = 84 + index * 50;
    normal.copy(output, offset);
    triangle.forEach((id, corner) => (points[id] ?? [0, 0, 0]).forEach((value, axis) => output.writeFloatLE(value, offset + 12 + corner * 12 + axis * 4)));
  });
  return { bytes: output, repaired };
}

/** Reject incomplete, degenerate, open, inconsistently wound, or disconnected generated solids. `allowDisconnected` is for a part
 * that is several separate closed bodies by design (the letters of engraved text); every body must still be closed. `allowVoids` is
 * for one solid that encloses sealed voids by design (the QR tag's cavities for magnets dropped in at a print pause): exactly one
 * outer shell, and every other shell facing inwards (negative volume) and inside it. */
export function inspectStl(bytes: Buffer, options: { allowDisconnected?: boolean; allowVoids?: boolean } = {}): MeshInfo {
  if (bytes.length < 84) throw new Error('The renderer produced an incomplete STL.');
  const triangleCount = bytes.readUInt32LE(80);
  if (triangleCount === 0 || triangleCount > 1_000_000 || bytes.length !== 84 + triangleCount * 50)
    throw new Error('The renderer produced an empty or invalid binary STL.');
  const vertices = new Map<string, number>();
  const parents: number[] = [];
  const edges = new Map<string, { count: number; winding: number }>();
  const bounds = { minX: Infinity, minY: Infinity, minZ: Infinity, maxX: -Infinity, maxY: -Infinity, maxZ: -Infinity };
  let volume = 0;
  const corners: number[] = [];
  const points: number[] = [];
  function root(id: number): number {
    let current = id;
    while (parents[current] !== current) {
      const next = parents[current];
      if (next === undefined) throw new Error('Invalid mesh connectivity.');
      current = next;
    }
    return current;
  }
  function vertex(x: number, y: number, z: number): number {
    if (![x, y, z].every(Number.isFinite)) throw new Error('The mesh contains non-finite coordinates.');
    bounds.minX = Math.min(bounds.minX, x); bounds.maxX = Math.max(bounds.maxX, x);
    bounds.minY = Math.min(bounds.minY, y); bounds.maxY = Math.max(bounds.maxY, y);
    bounds.minZ = Math.min(bounds.minZ, z); bounds.maxZ = Math.max(bounds.maxZ, z);
    const key = `${x},${y},${z}`;
    const found = vertices.get(key);
    if (found !== undefined) return found;
    const id = vertices.size;
    vertices.set(key, id); parents.push(id); points.push(x, y, z);
    return id;
  }
  function edge(a: number, b: number) {
    const key = a < b ? `${a}:${b}` : `${b}:${a}`;
    const value = edges.get(key) ?? { count: 0, winding: 0 };
    value.count++; value.winding += a < b ? 1 : -1;
    edges.set(key, value);
    const ar = root(a); const br = root(b);
    if (ar !== br) parents[Math.max(ar, br)] = Math.min(ar, br);
  }
  for (let index = 0; index < triangleCount; index++) {
    const offset = 84 + index * 50 + 12;
    const ax = bytes.readFloatLE(offset); const ay = bytes.readFloatLE(offset + 4); const az = bytes.readFloatLE(offset + 8);
    const bx = bytes.readFloatLE(offset + 12); const by = bytes.readFloatLE(offset + 16); const bz = bytes.readFloatLE(offset + 20);
    const cx = bytes.readFloatLE(offset + 24); const cy = bytes.readFloatLE(offset + 28); const cz = bytes.readFloatLE(offset + 32);
    const nx = (by - ay) * (cz - az) - (bz - az) * (cy - ay);
    const ny = (bz - az) * (cx - ax) - (bx - ax) * (cz - az);
    const nz = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
    if (nx * nx + ny * ny + nz * nz < 1e-20) throw new Error('The mesh contains a zero-area triangle.');
    const a = vertex(ax, ay, az); const b = vertex(bx, by, bz); const c = vertex(cx, cy, cz);
    edge(a, b); edge(b, c); edge(c, a);
    corners.push(a, b, c);
    volume += (ax * (by * cz - bz * cy) + ay * (bz * cx - bx * cz) + az * (bx * cy - by * cx)) / 6;
  }
  for (const edgeInfo of edges.values()) {
    if (edgeInfo.count !== 2 || edgeInfo.winding !== 0) throw new Error('The mesh is not a closed, consistently wound solid.');
  }
  if (!options.allowDisconnected && parents.some((_, index) => root(index) !== root(0))) {
    if (!options.allowVoids) throw new Error('The mesh contains disconnected pieces.');
    checkVoids(corners, points, root);
  }
  if (!Number.isFinite(volume) || volume <= 0) throw new Error('The mesh has no positive enclosed volume.');
  return {
    sha256: createHash('sha256').update(bytes).digest('hex'), bytes: bytes.length, triangles: triangleCount, volume,
    dimensions: { x: bounds.maxX - bounds.minX, y: bounds.maxY - bounds.minY, z: bounds.maxZ - bounds.minZ },
  };
}

/**
 * For a solid with sealed voids (`inspectStl`'s `allowVoids`): the shells, by their signed volume, must be one outer shell (positive)
 * and voids (negative), each void inside the outer shell (a ray from one of its points crosses the outer shell an odd number of
 * times). Throws otherwise, e.g. for a second body beside the first.
 */
function checkVoids(corners: number[], points: number[], root: (id: number) => number): void {
  const shells = new Map<number, number[]>();
  for (let index = 0; index < corners.length; index += 3) {
    const shell = root(corners[index] ?? 0);
    const list = shells.get(shell) ?? [];
    list.push(index);
    shells.set(shell, list);
  }
  const at = (id: number, axis: number) => points[id * 3 + axis] ?? 0;
  const signed = (triangles: number[]) => triangles.reduce((sum, index) => {
    const [a, b, c] = [corners[index] ?? 0, corners[index + 1] ?? 0, corners[index + 2] ?? 0];
    return sum + (at(a, 0) * (at(b, 1) * at(c, 2) - at(b, 2) * at(c, 1)) + at(a, 1) * (at(b, 2) * at(c, 0) - at(b, 0) * at(c, 2)) + at(a, 2) * (at(b, 0) * at(c, 1) - at(b, 1) * at(c, 0))) / 6;
  }, 0);
  const outer = [...shells.values()].filter(triangles => signed(triangles) > 0);
  const [shell] = outer;
  if (outer.length !== 1 || !shell) throw new Error('The mesh contains disconnected pieces.');
  // Möller–Trumbore along a direction that is not parallel to any modelled face
  const direction = [0.577, 0.578, 0.579];
  const crossings = (origin: number[]) => shell.filter(index => {
    const [a, b, c] = [corners[index] ?? 0, corners[index + 1] ?? 0, corners[index + 2] ?? 0];
    const e1 = [0, 1, 2].map(k => at(b, k) - at(a, k)), e2 = [0, 1, 2].map(k => at(c, k) - at(a, k));
    const [dx, dy, dz] = direction as [number, number, number];
    const p = [dy * (e2[2] ?? 0) - dz * (e2[1] ?? 0), dz * (e2[0] ?? 0) - dx * (e2[2] ?? 0), dx * (e2[1] ?? 0) - dy * (e2[0] ?? 0)];
    const det = (e1[0] ?? 0) * (p[0] ?? 0) + (e1[1] ?? 0) * (p[1] ?? 0) + (e1[2] ?? 0) * (p[2] ?? 0);
    if (Math.abs(det) < 1e-12) return false;
    const t0 = [0, 1, 2].map(k => (origin[k] ?? 0) - at(a, k));
    const u = ((t0[0] ?? 0) * (p[0] ?? 0) + (t0[1] ?? 0) * (p[1] ?? 0) + (t0[2] ?? 0) * (p[2] ?? 0)) / det;
    if (u < 0 || u > 1) return false;
    const q = [(t0[1] ?? 0) * (e1[2] ?? 0) - (t0[2] ?? 0) * (e1[1] ?? 0), (t0[2] ?? 0) * (e1[0] ?? 0) - (t0[0] ?? 0) * (e1[2] ?? 0), (t0[0] ?? 0) * (e1[1] ?? 0) - (t0[1] ?? 0) * (e1[0] ?? 0)];
    const v = (dx * (q[0] ?? 0) + dy * (q[1] ?? 0) + dz * (q[2] ?? 0)) / det;
    if (v < 0 || u + v > 1) return false;
    return ((e2[0] ?? 0) * (q[0] ?? 0) + (e2[1] ?? 0) * (q[1] ?? 0) + (e2[2] ?? 0) * (q[2] ?? 0)) / det > 0;
  }).length;
  for (const triangles of shells.values()) {
    if (triangles === shell) continue;
    const first = corners[triangles[0] ?? 0] ?? 0;
    if (signed(triangles) >= 0 || crossings([at(first, 0), at(first, 1), at(first, 2)]) % 2 !== 1)
      throw new Error('The mesh contains disconnected pieces.');
  }
}
