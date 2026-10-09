/**
 * How well a part's convex pieces fit its mesh, in the mesh's units (mm): how far the pieces reach out of the part into free space
 * (`intrusion`, where another part would be stopped short: a hull bridging a bore stops the ball that should go in), and how far
 * the part's surface lies outside every piece (`gap`, where another part could sink in). Measured on samples of the pieces' and
 * the part's surfaces, `spacing` apart. Spike 2 compares the decomposers with it (docs/physics-plan.md); CI can bound it.
 */
import type { ConvexPiece } from './decompose.ts';

export interface PieceFit {
  /** The deepest a piece reaches outside the part. */
  intrusion: number;
  /** The 99th percentile of the intrusions of piece-surface samples outside the part. */
  intrusion99: number;
  /** The furthest a sample of the part's surface lies outside every piece. */
  gap: number;
  gap99: number;
  samples: number;
}

type V = [number, number, number];

const sub = (a: V, b: V): V => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a: V, b: V): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: V, b: V): V => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

interface Triangle { a: V; b: V; c: V; min: V; max: V }

function triangles(soup: ArrayLike<number>): Triangle[] {
  const result: Triangle[] = [];
  for (let i = 0; i < soup.length; i += 9) {
    const p = (k: number): V => [soup[i + 3 * k] ?? 0, soup[i + 3 * k + 1] ?? 0, soup[i + 3 * k + 2] ?? 0];
    const a = p(0), b = p(1), c = p(2);
    result.push({ a, b, c, min: [0, 1, 2].map(k => Math.min(a[k] ?? 0, b[k] ?? 0, c[k] ?? 0)) as V, max: [0, 1, 2].map(k => Math.max(a[k] ?? 0, b[k] ?? 0, c[k] ?? 0)) as V });
  }
  return result;
}

/** The squared distance from p to the triangle (Ericson, Real-Time Collision Detection, 5.1.5). */
function distanceSquared(p: V, { a, b, c }: Triangle): number {
  const ab = sub(b, a), ac = sub(c, a), ap = sub(p, a);
  const d1 = dot(ab, ap), d2 = dot(ac, ap);
  const closest = (q: V): number => { const d = sub(p, q); return dot(d, d); };
  if (d1 <= 0 && d2 <= 0) return closest(a);
  const bp = sub(p, b), d3 = dot(ab, bp), d4 = dot(ac, bp);
  if (d3 >= 0 && d4 <= d3) return closest(b);
  const vc = d1 * d4 - d3 * d2;
  if (vc <= 0 && d1 >= 0 && d3 <= 0) { const v = d1 / (d1 - d3); return closest([a[0] + v * ab[0], a[1] + v * ab[1], a[2] + v * ab[2]]); }
  const cp = sub(p, c), d5 = dot(ab, cp), d6 = dot(ac, cp);
  if (d6 >= 0 && d5 <= d6) return closest(c);
  const vb = d5 * d2 - d1 * d6;
  if (vb <= 0 && d2 >= 0 && d6 <= 0) { const w = d2 / (d2 - d6); return closest([a[0] + w * ac[0], a[1] + w * ac[1], a[2] + w * ac[2]]); }
  const va = d3 * d6 - d5 * d4;
  if (va <= 0 && d4 - d3 >= 0 && d5 - d6 >= 0) {
    const w = (d4 - d3) / (d4 - d3 + (d5 - d6));
    return closest([b[0] + w * (c[0] - b[0]), b[1] + w * (c[1] - b[1]), b[2] + w * (c[2] - b[2])]);
  }
  const denom = 1 / (va + vb + vc), v = vb * denom, w = vc * denom;
  return closest([a[0] + ab[0] * v + ac[0] * w, a[1] + ab[1] * v + ac[1] * w, a[2] + ab[2] * v + ac[2] * w]);
}

/** A mesh's triangles bucketed on a uniform grid, for nearest-surface and inside queries. */
class MeshIndex {
  private readonly cells = new Map<string, Triangle[]>();
  private readonly columns = new Map<string, Triangle[]>();
  readonly min: V;
  readonly max: V;

  constructor(readonly tris: Triangle[], readonly cell: number) {
    this.min = [0, 1, 2].map(k => tris.reduce((least, t) => Math.min(least, t.min[k] ?? 0), Infinity)) as V;
    this.max = [0, 1, 2].map(k => tris.reduce((most, t) => Math.max(most, t.max[k] ?? 0), -Infinity)) as V;
    for (const t of tris) {
      const [i0, j0, k0] = this.key(t.min), [i1, j1, k1] = this.key(t.max);
      for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) {
        const column = `${i},${j}`;
        let list = this.columns.get(column);
        if (!list) this.columns.set(column, list = []);
        list.push(t);
        for (let k = k0; k <= k1; k++) {
          const key = `${i},${j},${k}`;
          let cellList = this.cells.get(key);
          if (!cellList) this.cells.set(key, cellList = []);
          cellList.push(t);
        }
      }
    }
  }

  private key(p: V): V { return [0, 1, 2].map(k => Math.floor(((p[k] ?? 0) - (this.min[k] ?? 0)) / this.cell)) as V; }

  /** Whether p is inside the closed mesh: the parity of an upward ray's crossings (a ray nudged off the grid's lines). */
  inside(p: V): boolean {
    const [i, j] = this.key(p);
    const x = p[0] + 1.37e-7, y = p[1] + 2.91e-7;
    let crossings = 0;
    for (const { a, b, c } of this.columns.get(`${i},${j}`) ?? []) {
      // barycentric test in XY, then the crossing's height
      const d = (b[1] - c[1]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[1] - c[1]);
      if (d === 0) continue;
      const u = ((b[1] - c[1]) * (x - c[0]) + (c[0] - b[0]) * (y - c[1])) / d;
      const v = ((c[1] - a[1]) * (x - c[0]) + (a[0] - c[0]) * (y - c[1])) / d;
      if (u < 0 || v < 0 || u + v > 1) continue;
      if (u * a[2] + v * b[2] + (1 - u - v) * c[2] > p[2]) crossings++;
    }
    return crossings % 2 === 1;
  }

  /** The distance from p to the mesh's surface. */
  distance(p: V): number {
    const [i, j, k] = this.key(p);
    let best = Infinity;
    for (let ring = 0; ; ring++) {
      // every cell of this ring is at least (ring − 1) cells away
      if (Math.sqrt(best) <= (ring - 1) * this.cell) return Math.sqrt(best);
      if (ring > 1e4) return Math.sqrt(best);
      let any = false;
      for (let di = -ring; di <= ring; di++) for (let dj = -ring; dj <= ring; dj++) for (let dk = -ring; dk <= ring; dk++) {
        if (Math.max(Math.abs(di), Math.abs(dj), Math.abs(dk)) !== ring) continue;
        const list = this.cells.get(`${i + di},${j + dj},${k + dk}`);
        if (!list) continue;
        any = true;
        for (const t of list) best = Math.min(best, distanceSquared(p, t));
      }
      if (!any && best === Infinity && ring * this.cell > Math.hypot(...sub(this.max, this.min)) + this.cell * 2) return Infinity;
    }
  }
}

/** Points spread over a triangle about `spacing` apart, its corners included. */
function samples(a: V, b: V, c: V, spacing: number): V[] {
  const longest = Math.max(Math.hypot(...sub(b, a)), Math.hypot(...sub(c, a)), Math.hypot(...sub(c, b)));
  // a triangle smaller than the spacing (a fine thread's) is sampled once, at its centre
  if (longest < spacing) return [[(a[0] + b[0] + c[0]) / 3, (a[1] + b[1] + c[1]) / 3, (a[2] + b[2] + c[2]) / 3]];
  const n = Math.ceil(longest / spacing);
  const points: V[] = [];
  for (let i = 0; i <= n; i++) for (let j = 0; j <= n - i; j++) {
    const u = i / n, v = j / n, w = 1 - u - v;
    points.push([u * a[0] + v * b[0] + w * c[0], u * a[1] + v * b[1] + w * c[1], u * a[2] + v * b[2] + w * c[2]]);
  }
  return points;
}

interface Hull { planes: { n: V; d: number }[]; min: V; max: V }

/** The outward face planes of a convex piece. */
function hullOf(piece: ConvexPiece): Hull {
  const v = (i: number): V => [piece.vertices[3 * i] ?? 0, piece.vertices[3 * i + 1] ?? 0, piece.vertices[3 * i + 2] ?? 0];
  const count = piece.vertices.length / 3;
  const centre: V = [0, 0, 0];
  for (let i = 0; i < count; i++) for (let k = 0; k < 3; k++) centre[k] = (centre[k] ?? 0) + (v(i)[k] ?? 0) / count;
  const planes: Hull['planes'] = [];
  for (let t = 0; t < piece.triangles.length; t += 3) {
    const a = v(piece.triangles[t] ?? 0), b = v(piece.triangles[t + 1] ?? 0), c = v(piece.triangles[t + 2] ?? 0);
    let n = cross(sub(b, a), sub(c, a));
    const length = Math.hypot(...n);
    if (length < 1e-12) continue;
    n = [n[0] / length, n[1] / length, n[2] / length];
    let d = dot(n, a);
    if (dot(n, centre) - d > 0) { n = [-n[0], -n[1], -n[2]]; d = -d; }
    planes.push({ n, d });
  }
  const all = Array.from({ length: count }, (_, i) => v(i));
  return { planes, min: [0, 1, 2].map(k => Math.min(...all.map(p => p[k] ?? 0))) as V, max: [0, 1, 2].map(k => Math.max(...all.map(p => p[k] ?? 0))) as V };
}

/** How far p is outside the hull: the largest of its face planes' signed distances (exact near a face, a lower bound beyond). */
const outside = (hull: Hull, p: V): number => Math.max(...hull.planes.map(({ n, d }) => dot(n, p) - d));

const largest = (values: number[]): number => values.reduce((most, value) => Math.max(most, value), 0);

const percentile = (values: number[], q: number): number => {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))] ?? 0;
};

/** The fit of these pieces to this closed mesh (a triangle soup). */
export function pieceFit(soup: ArrayLike<number>, pieces: readonly ConvexPiece[], spacing = 0.25): PieceFit {
  const tris = triangles(soup);
  // grid cells of a few triangles' size: about 4 mean edge lengths, from 0.25 to 2 mm
  const edge = tris.reduce((sum, t) => sum + Math.hypot(...sub(t.b, t.a)), 0) / Math.max(1, tris.length);
  const mesh = new MeshIndex(tris, Math.min(2, Math.max(0.25, 4 * edge)));
  const intrusions: number[] = [];
  let count = 0;
  for (const piece of pieces) {
    const v = (i: number): V => [piece.vertices[3 * i] ?? 0, piece.vertices[3 * i + 1] ?? 0, piece.vertices[3 * i + 2] ?? 0];
    for (let t = 0; t < piece.triangles.length; t += 3) {
      for (const p of samples(v(piece.triangles[t] ?? 0), v(piece.triangles[t + 1] ?? 0), v(piece.triangles[t + 2] ?? 0), spacing)) {
        count++;
        if (!mesh.inside(p)) intrusions.push(mesh.distance(p));
      }
    }
  }
  const hulls = pieces.map(hullOf);
  const gaps: number[] = [];
  for (const t of mesh.tris) {
    for (const p of samples(t.a, t.b, t.c, spacing)) {
      count++;
      let best = Infinity;
      for (const hull of hulls) {
        // the box's distance bounds the hull's from below
        const box = Math.hypot(...[0, 1, 2].map(k => Math.max(0, (hull.min[k] ?? 0) - (p[k] ?? 0), (p[k] ?? 0) - (hull.max[k] ?? 0))));
        if (box >= best) continue;
        best = Math.min(best, outside(hull, p));
        if (best <= 0) break;
      }
      if (best > 0) gaps.push(best);
    }
  }
  return { intrusion: largest(intrusions), intrusion99: percentile(intrusions, 0.99), gap: largest(gaps), gap99: percentile(gaps, 0.99), samples: count };
}
