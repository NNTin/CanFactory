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
