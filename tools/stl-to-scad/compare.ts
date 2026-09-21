import { bounds, center, g, size, surfaceArea, transform, triangleCount, volume, type Mesh } from './stl.ts';

/** Solid intervals along Z for a regular grid of vertical rays. cells[column] = [z0,z1,z2,z3,...] entry/exit pairs. */
interface Columns { cells: number[][]; nx: number; ny: number; cell: number; skipped: number }

const JITTER_X = 1.2345678e-7, JITTER_Y = 2.3456789e-7;

/** Cast one vertical ray per grid cell centre (jittered to avoid hitting mesh edges exactly) and collect the solid Z intervals. */
function castColumns(mesh: Mesh, originX: number, originY: number, nx: number, ny: number, cell: number): Columns {
  const hits: number[][] = Array.from({ length: nx * ny }, () => []);
  const t = mesh.tris;
  for (let index = 0; index < triangleCount(mesh); index++) {
    const b = index * 9;
    const ax = g(t, b), ay = g(t, b + 1), az = g(t, b + 2), bx = g(t, b + 3), by = g(t, b + 4), bz = g(t, b + 5), cx = g(t, b + 6), cy = g(t, b + 7), cz = g(t, b + 8);
    const det = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy);
    if (Math.abs(det) < 1e-14) continue;
    const i0 = Math.max(0, Math.floor((Math.min(ax, bx, cx) - originX) / cell - 0.5));
    const i1 = Math.min(nx - 1, Math.ceil((Math.max(ax, bx, cx) - originX) / cell - 0.5));
    const j0 = Math.max(0, Math.floor((Math.min(ay, by, cy) - originY) / cell - 0.5));
    const j1 = Math.min(ny - 1, Math.ceil((Math.max(ay, by, cy) - originY) / cell - 0.5));
    for (let j = j0; j <= j1; j++) {
      const py = originY + (j + 0.5) * cell + JITTER_Y;
      for (let i = i0; i <= i1; i++) {
        const px = originX + (i + 0.5) * cell + JITTER_X;
        const l1 = ((by - cy) * (px - cx) + (cx - bx) * (py - cy)) / det;
        const l2 = ((cy - ay) * (px - cx) + (ax - cx) * (py - cy)) / det;
        const l3 = 1 - l1 - l2;
        if (l1 < 0 || l2 < 0 || l3 < 0) continue;
        hits[j * nx + i]?.push(l1 * az + l2 * bz + l3 * cz);
      }
    }
  }
  let skipped = 0;
  const cells = hits.map(zs => {
    if (zs.length % 2 !== 0) { skipped++; return []; }
    return zs.sort((p, q) => p - q);
  });
  return { cells, nx, ny, cell, skipped };
}

const total = (intervals: number[]): number => {
  let sum = 0;
  for (let i = 0; i + 1 < intervals.length; i += 2) sum += g(intervals, i + 1) - g(intervals, i);
  return sum;
};

function overlap(a: number[], b: number[]): number {
  let sum = 0, i = 0, j = 0;
  while (i + 1 < a.length && j + 1 < b.length) {
    const lo = Math.max(g(a, i), g(b, j)), hi = Math.min(g(a, i + 1), g(b, j + 1));
    if (hi > lo) sum += hi - lo;
    if (g(a, i + 1) < g(b, j + 1)) i += 2; else j += 2;
  }
  return sum;
}

export interface Comparison {
  /** Per-axis bounding-box size difference candidate − reference (mm). */
  sizeDelta: [number, number, number];
  maxSizeDelta: number;
  referenceVolume: number;
  candidateVolume: number;
  /** (candidate − reference) / reference. */
  volumeRelativeError: number;
  /** Intersection over union of the solids, sampled on a grid of vertical rays (exact along Z). */
  iou: number;
  /** Symmetric-difference volume divided by mean surface area: an average surface-to-surface offset estimate (mm). */
  meanDeviation: number;
  cellSize: number;
  /** Ray columns dropped because a ray hit an odd number of faces (should be ~0 for closed meshes). */
  skippedColumns: number;
  /** Ray columns that hit either solid (denominator for skippedColumns). */
  occupiedColumns: number;
}

/**
 * Compare a candidate solid with a reference. The candidate is translated so the bounding-box centres coincide (source
 * STLs sit at arbitrary build-plate positions), after the reference is optionally scaled by `referenceScale`.
 */
export function compareMeshes(reference: Mesh, candidate: Mesh, options: { cellSize?: number; referenceScale?: number } = {}): Comparison {
  const cell = options.cellSize ?? 0.2;
  const ref = options.referenceScale && options.referenceScale !== 1 ? transform(reference, options.referenceScale) : reference;
  const refBounds = bounds(ref), candBounds = bounds(candidate);
  const rc = center(refBounds), cc = center(candBounds);
  const moved = transform(candidate, 1, [rc[0] - cc[0], rc[1] - cc[1], rc[2] - cc[2]]);
  const rs = size(refBounds), cs = size(candBounds);
  const sizeDelta: [number, number, number] = [cs[0] - rs[0], cs[1] - rs[1], cs[2] - rs[2]];
  const movedBounds = bounds(moved);
  const originX = Math.min(refBounds.min[0], movedBounds.min[0]) - cell, originY = Math.min(refBounds.min[1], movedBounds.min[1]) - cell;
  const nx = Math.ceil((Math.max(refBounds.max[0], movedBounds.max[0]) + cell - originX) / cell);
  const ny = Math.ceil((Math.max(refBounds.max[1], movedBounds.max[1]) + cell - originY) / cell);
  const a = castColumns(ref, originX, originY, nx, ny, cell);
  const b = castColumns(moved, originX, originY, nx, ny, cell);
  let inter = 0, union = 0, occupied = 0;
  for (let k = 0; k < a.cells.length; k++) {
    const ca = a.cells[k] ?? [], cb = b.cells[k] ?? [];
    if (ca.length === 0 && cb.length === 0) continue;
    occupied++;
    const o = overlap(ca, cb);
    inter += o;
    union += total(ca) + total(cb) - o;
  }
  const cellArea = cell * cell;
  const refVolume = volume(ref), candVolume = volume(candidate);
  const symmetricDifference = (union - inter) * cellArea;
  const meanArea = (surfaceArea(ref) + surfaceArea(candidate)) / 2;
  return {
    sizeDelta, maxSizeDelta: Math.max(...sizeDelta.map(Math.abs)), referenceVolume: refVolume, candidateVolume: candVolume,
    volumeRelativeError: (candVolume - refVolume) / refVolume, iou: union > 0 ? inter / union : 0,
    meanDeviation: meanArea > 0 ? symmetricDifference / meanArea : 0, cellSize: cell, skippedColumns: a.skipped + b.skipped, occupiedColumns: occupied,
  };
}

export interface VariantMatch {
  /** Uniform scale that maps `a` onto `b` (b = a × scale). */
  scale: number;
  /** Largest vertex deviation (mm, after scaling and aligning bounding-box minima), triangle order assumed identical. */
  maxDeviation: number;
}

/**
 * Detect that `b` is a translated, uniformly scaled copy of `a` with the same triangle order (typical for repeated
 * plate exports). Returns undefined when triangle counts or proportions differ or vertices do not line up.
 */
export function detectScaleVariant(a: Mesh, b: Mesh, tolerance = 1e-3): VariantMatch | undefined {
  if (a.tris.length !== b.tris.length) return undefined;
  const ba = bounds(a), bb = bounds(b);
  const sa = size(ba), sb = size(bb);
  const scale = sb[0] / sa[0];
  if (!Number.isFinite(scale) || scale <= 0) return undefined;
  if (![1, 2].every(axis => Math.abs(g(sb, axis) / g(sa, axis) / scale - 1) < 1e-3)) return undefined;
  let max = 0;
  for (let i = 0; i < a.tris.length; i++) {
    const axis = i % 3;
    const dev = Math.abs((g(a.tris, i) - g(ba.min, axis)) * scale - (g(b.tris, i) - g(bb.min, axis)));
    if (dev > max) max = dev;
  }
  return max <= tolerance * Math.max(1, scale) ? { scale, maxDeviation: max } : undefined;
}
