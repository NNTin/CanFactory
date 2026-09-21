import { g, triangleCount, type Mesh } from './stl.ts';

export type Point2 = [number, number];

/** A closed outline in the cutting plane. Outer boundaries are counter-clockwise (positive area); holes are negative. */
export interface Loop { points: Point2[]; signedArea: number; centroid: Point2 }

/** An outer outline with the holes it directly contains. */
export interface Piece { outer: Loop; holes: Loop[]; area: number; centroid: Point2 }

const EPSILON = 1e-6;
const keyOf = (x: number, y: number): string => `${Math.round(x * 1e5)},${Math.round(y * 1e5)}`;

/**
 * Cut the mesh with the plane Z = z. A vertex exactly on the plane counts as lying below it (the plane sits at z + a hair),
 * which keeps every cut a set of closed loops even for flat faces at that height: a cut on a solid's bottom face returns its
 * outline, a cut on its top face returns nothing. Segments are oriented so the
 * material lies on their left, hence solid outlines are counter-clockwise.
 */
export function sliceZ(mesh: Mesh, z: number): Loop[] {
  const segments = new Map<string, { from: Point2; to: Point2 }>();
  const t = mesh.tris;
  for (let index = 0; index < triangleCount(mesh); index++) {
    const base = index * 9;
    const above = [0, 1, 2].map(v => g(t, base + v * 3 + 2) > z);
    if (above[0] === above[1] && above[1] === above[2]) continue;
    const crossings: Point2[] = [];
    for (const [a, b] of [[0, 1], [1, 2], [2, 0]] as const) {
      if (above[a] === above[b]) continue;
      const az = g(t, base + a * 3 + 2), bz = g(t, base + b * 3 + 2);
      const f = (z - az) / (bz - az);
      crossings.push([g(t, base + a * 3) + f * (g(t, base + b * 3) - g(t, base + a * 3)), g(t, base + a * 3 + 1) + f * (g(t, base + b * 3 + 1) - g(t, base + a * 3 + 1))]);
    }
    const [p, q] = crossings;
    if (!p || !q) continue;
    // Outward normal x/y components of the triangle; travel direction is Z x n.
    const ux = g(t, base + 3) - g(t, base), uy = g(t, base + 4) - g(t, base + 1), uz = g(t, base + 5) - g(t, base + 2);
    const vx = g(t, base + 6) - g(t, base), vy = g(t, base + 7) - g(t, base + 1), vz = g(t, base + 8) - g(t, base + 2);
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz;
    const dx = -ny, dy = nx;
    const forward = (q[0] - p[0]) * dx + (q[1] - p[1]) * dy >= 0;
    const from = forward ? p : q, to = forward ? q : p;
    if (keyOf(...from) === keyOf(...to)) continue;
    segments.set(keyOf(...from), { from, to });
  }
  const loops: Loop[] = [];
  const visited = new Set<string>();
  for (const [startKey, first] of segments) {
    if (visited.has(startKey)) continue;
    const points: Point2[] = [];
    let key = startKey;
    let segment: { from: Point2; to: Point2 } | undefined = first;
    while (segment && !visited.has(key)) {
      visited.add(key);
      points.push(segment.from);
      key = keyOf(...segment.to);
      segment = segments.get(key);
    }
    if (points.length >= 3 && key === startKey) loops.push(describeLoop(points));
  }
  return loops;
}

function describeLoop(points: Point2[]): Loop {
  let area = 0, cx = 0, cy = 0;
  for (let i = 0; i < points.length; i++) {
    const [x0, y0] = points[i] ?? [0, 0];
    const [x1, y1] = points[(i + 1) % points.length] ?? [0, 0];
    const cross = x0 * y1 - x1 * y0;
    area += cross / 2;
    cx += (x0 + x1) * cross;
    cy += (y0 + y1) * cross;
  }
  const centroid: Point2 = Math.abs(area) > EPSILON ? [cx / (6 * area), cy / (6 * area)] : (points[0] ?? [0, 0]);
  return { points, signedArea: area, centroid };
}

function contains(loop: Loop, [x, y]: Point2): boolean {
  let inside = false;
  const p = loop.points;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
    const [xi, yi] = p[i] ?? [0, 0];
    const [xj, yj] = p[j] ?? [0, 0];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** Group loops into pieces (outer boundary + directly contained holes). */
export function toPieces(loops: Loop[]): Piece[] {
  const outers = loops.filter(l => l.signedArea > 0);
  const pieces = outers.map((outer): Piece => ({ outer, holes: [], area: outer.signedArea, centroid: outer.centroid }));
  for (const hole of loops.filter(l => l.signedArea <= 0)) {
    const probe = hole.points[0];
    if (!probe) continue;
    const owner = pieces.filter(p => contains(p.outer, probe)).sort((a, b) => a.outer.signedArea - b.outer.signedArea)[0];
    if (owner) { owner.holes.push(hole); owner.area += hole.signedArea; }
  }
  return pieces;
}

/** Minimal SVG of one or more sections side by side (holes drawn with even-odd fill). */
export function sectionsToSvg(sections: { z: number; loops: Loop[] }[], padding = 2): string {
  const all = sections.flatMap(s => s.loops.flatMap(l => l.points));
  if (all.length === 0) return '<svg xmlns="http://www.w3.org/2000/svg"/>';
  const xs = all.map(p => p[0]), ys = all.map(p => p[1]);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  const w = maxX - minX + 2 * padding, h = maxY - minY + 2 * padding;
  const cells = sections.map((s, i) => {
    const d = s.loops.map(l => 'M' + l.points.map(([x, y]) => `${(x - minX + padding).toFixed(3)},${(maxY - y + padding).toFixed(3)}`).join('L') + 'Z').join(' ');
    return `<g transform="translate(${(i * w).toFixed(3)},0)"><path d="${d}" fill="#888" fill-rule="evenodd" stroke="#000" stroke-width="0.15"/><text x="1" y="3" font-size="3">z=${s.z}</text></g>`;
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${(w * sections.length).toFixed(3)} ${h.toFixed(3)}" width="${Math.round(w * sections.length * 6)}" height="${Math.round(h * 6)}">${cells.join('')}</svg>\n`;
}
