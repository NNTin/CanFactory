/**
 * Convex collision pieces that the geometry side computes for a part (`PhysicsCollision` kind `pieces`), from the same values its SCAD
 * file is built from: exact where a generic decomposition of the rendered mesh is not (docs/physics-plan.md, "Collision geometry").
 * A part made by revolving or extruding a 2D profile gets the profile split into convex polygons, each revolved in thin segments or
 * extruded. A piece is the list of its vertices (x, y, z, ...) in millimetres, in the part's own frame; the physics side collides
 * its convex hull.
 */

export type Point2 = [number, number];

const cross = (o: Point2, a: Point2, b: Point2): number => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
const at = <T>(list: readonly T[], index: number): T => {
  const value = list[((index % list.length) + list.length) % list.length];
  if (value === undefined) throw new Error('An empty polygon.');
  return value;
};

/** Twice the polygon's signed area: positive when its points run counter-clockwise. */
export function signedArea(polygon: readonly Point2[]): number {
  let sum = 0;
  for (let i = 0; i < polygon.length; i++) sum += cross([0, 0], at(polygon, i), at(polygon, i + 1));
  return sum;
}

/** Whether the polygon is convex (counter-clockwise, collinear points allowed). */
export function isConvex(polygon: readonly Point2[]): boolean {
  for (let i = 0; i < polygon.length; i++) if (cross(at(polygon, i - 1), at(polygon, i), at(polygon, i + 1)) < -1e-12) return false;
  return true;
}

function inTriangle(p: Point2, a: Point2, b: Point2, c: Point2): boolean {
  return cross(a, b, p) >= -1e-12 && cross(b, c, p) >= -1e-12 && cross(c, a, p) >= -1e-12;
}

/** The polygon's triangles by ear clipping (a simple polygon, counter-clockwise; its collinear points kept). */
function triangulate(polygon: readonly Point2[]): [number, number, number][] {
  const indices = polygon.map((_, i) => i);
  const triangles: [number, number, number][] = [];
  let guard = 0;
  while (indices.length > 3 && guard++ < 10_000) {
    let clipped = false;
    for (let k = 0; k < indices.length; k++) {
      const i = at(indices, k - 1), j = at(indices, k), l = at(indices, k + 1);
      const a = at(polygon, i), b = at(polygon, j), c = at(polygon, l);
      if (cross(a, b, c) <= 1e-12) continue;
      if (indices.some(m => m !== i && m !== j && m !== l && inTriangle(at(polygon, m), a, b, c) && !(cross(a, b, at(polygon, m)) === 0 && cross(b, c, at(polygon, m)) === 0))) continue;
      triangles.push([i, j, l]);
      indices.splice(k, 1);
      clipped = true;
      break;
    }
    if (!clipped) {
      // only degenerate (collinear) corners are left: drop one
      const k = indices.findIndex((_, n) => Math.abs(cross(at(polygon, at(indices, n - 1)), at(polygon, at(indices, n)), at(polygon, at(indices, n + 1)))) <= 1e-12);
      if (k < 0) throw new Error('The polygon is not simple.');
      indices.splice(k, 1);
    }
  }
  if (indices.length === 3) {
    const [i = 0, j = 0, l = 0] = indices;
    if (cross(at(polygon, i), at(polygon, j), at(polygon, l)) > 1e-12) triangles.push([i, j, l]);
  }
  return triangles;
}

/**
 * The polygon split into convex polygons: triangulated, then neighbouring pieces merged across their shared edge while the result
 * stays convex (Hertel and Mehlhorn), so that there are at most four times as many as the polygon's reflex corners.
 */
export function convexParts(polygon: readonly Point2[]): Point2[][] {
  const points = signedArea(polygon) < 0 ? [...polygon].reverse() : [...polygon];
  if (isConvex(points)) return [points];
  let parts: number[][] = triangulate(points);
  let merged = true;
  while (merged) {
    merged = false;
    outer: for (let p = 0; p < parts.length; p++) for (let q = p + 1; q < parts.length; q++) {
      const a = parts[p] ?? [], b = parts[q] ?? [];
      // a shared edge: a[i] → a[i + 1] runs b[j + 1] → b[j]
      for (let i = 0; i < a.length; i++) for (let j = 0; j < b.length; j++) {
        if (at(a, i) !== at(b, j + 1) || at(a, i + 1) !== at(b, j)) continue;
        // a from a[i + 1] round to a[i], then b from b[j + 2] round to b[j - 1]
        const ring = [...rotate(a, i + 1), ...rotate(b, j + 2).slice(0, b.length - 2)];
        if (!isConvex(ring.map(index => at(points, index)))) continue;
        parts = [...parts.slice(0, p), ring, ...parts.slice(p + 1, q), ...parts.slice(q + 1)];
        merged = true;
        break outer;
      }
    }
  }
  return parts.map(part => part.map(index => at(points, index)));
}

const rotate = <T>(list: readonly T[], start: number): T[] => {
  const k = ((start % list.length) + list.length) % list.length;
  return [...list.slice(k), ...list.slice(0, k)];
};

/**
 * A solid of revolution about Z, as convex pieces: its profile (r ≥ 0, z) split into convex parts, each turned through `segments`
 * equal angles; a piece is the part's points at the two angles that bound a segment. The hull of a segment's chords lies inside the
 * true surface by at most r (1 − cos(π / segments)): 0.005 mm at r = 2.5 mm and 48 segments, inwards on outer faces and outwards
 * (into the hole) on inner ones.
 */
export function revolvedPieces(profile: readonly Point2[], segments: number): number[][] {
  const pieces: number[][] = [];
  for (const part of convexParts(profile)) {
    for (let s = 0; s < segments; s++) {
      const angles = [s, s + 1].map(k => 2 * Math.PI * k / segments);
      pieces.push(angles.flatMap(angle => part.flatMap(([r, z]) => [r * Math.cos(angle), r * Math.sin(angle), z])));
    }
  }
  return pieces;
}

/**
 * A prism as convex pieces: its profile, in the plane of two of the part's axes (`plane`: the axes of its first and second
 * coordinate), split into convex parts and each extruded along the third axis from `from` to `to`.
 */
export function extrudedPieces(profile: readonly Point2[], plane: [0 | 1 | 2, 0 | 1 | 2], from: number, to: number): number[][] {
  const along = 3 - plane[0] - plane[1];
  return convexParts(profile).map(part => [from, to].flatMap(depth => part.flatMap(([u, v]) => {
    const point = [0, 0, 0];
    point[plane[0]] = u; point[plane[1]] = v; point[along] = depth;
    return point;
  })));
}

/** The convex polygon pushed out by `delta` (in by a negative one), its corners mitred: as OpenSCAD's `offset(delta)`. */
export function offsetConvex(polygon: readonly Point2[], delta: number): Point2[] {
  const points = signedArea(polygon) < 0 ? [...polygon].reverse() : [...polygon];
  const lines = points.map((p, i) => {
    const q = at(points, i + 1);
    const length = Math.hypot(q[0] - p[0], q[1] - p[1]);
    // outward normal of a counter-clockwise edge
    const n: Point2 = [(q[1] - p[1]) / length, -(q[0] - p[0]) / length];
    return { p: [p[0] + n[0] * delta, p[1] + n[1] * delta] as Point2, d: [q[0] - p[0], q[1] - p[1]] as Point2, length };
  }).filter(line => line.length > 1e-12);
  return lines.map((line, i) => {
    const previous = at(lines, i - 1);
    // where the previous edge's line meets this one's
    const denominator = previous.d[0] * line.d[1] - previous.d[1] * line.d[0];
    if (Math.abs(denominator) < 1e-12) return line.p;
    const t = ((line.p[0] - previous.p[0]) * line.d[1] - (line.p[1] - previous.p[1]) * line.d[0]) / denominator;
    return [previous.p[0] + previous.d[0] * t, previous.p[1] + previous.d[1] * t];
  });
}

/** The convex polygon cut by the half-plane a x + b y ≤ c (Sutherland–Hodgman). */
export function clipConvex(polygon: readonly Point2[], [a, b, c]: [number, number, number]): Point2[] {
  const result: Point2[] = [];
  polygon.forEach((p, i) => {
    const q = at(polygon, i + 1);
    const fp = c - a * p[0] - b * p[1], fq = c - a * q[0] - b * q[1];
    if (fp >= 0) result.push(p);
    if ((fp >= 0) !== (fq >= 0)) { const t = fp / (fp - fq); result.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]); }
  });
  return result;
}

/**
 * The wall round a convex hole, as convex pieces: one slab per edge of its outline (in XY), `thickness` thick outwards, from z
 * `from` to `to`. The hole's surface is exact; the slabs leave thin wedges open at the outline's corners, outside it.
 */
export function wallPieces(outline: readonly Point2[], thickness: number, from: number, to: number): number[][] {
  const points = signedArea(outline) < 0 ? [...outline].reverse() : [...outline];
  return points.map((p, i) => {
    const q = at(points, i + 1);
    const length = Math.hypot(q[0] - p[0], q[1] - p[1]);
    const n: Point2 = [(q[1] - p[1]) / length * thickness, -(q[0] - p[0]) / length * thickness];
    const quad: Point2[] = [p, q, [q[0] + n[0], q[1] + n[1]], [p[0] + n[0], p[1] + n[1]]];
    return [from, to].flatMap(z => quad.flatMap(([x, y]) => [x, y, z]));
  });
}
