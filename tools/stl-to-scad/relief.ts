import { simplifyLoop, sliceZ, type Point2 } from './sections.ts';
import type { Mesh } from './stl.ts';

/**
 * Wrapped relief: walls carrying a repeating surface pattern (honeycomb, knurling, text) that cannot be built from a few
 * primitives. The wall is unrolled: the base outline (a prismatic section of the part) is parametrised by arc length s,
 * and the surface is stored as a height map d(s, z), the distance of the outermost surface from the base outline along
 * its outward normal. The map is cut into a few plateau levels; every level is one set of polygons in the (s, z) plane.
 * The SCAD wrapper bends those polygons back around the outline strip by strip.
 */

export interface BaseOutline { points: Point2[]; cumulative: number[]; perimeter: number }

export interface ReliefMap {
  base: BaseOutline;
  /** Column width and row height in mm. */
  px: number;
  z0: number;
  width: number;
  height: number;
  /** Extra columns on each side (wrap-around margin), so the map covers s in [-margin, perimeter + margin]. */
  marginColumns: number;
  /** Row-major (row = z), NaN where no surface was hit. */
  d: Float32Array;
}

export interface ReliefOptions { baseZ: number; z0: number; z1: number; px?: number; margin?: number; maxHit?: number; baseTolerance?: number; openRadius?: number }

/** Counter-clockwise outline of the largest loop at height z, simplified, with cumulative arc length. */
export function baseOutline(mesh: Mesh, z: number, tolerance = 0.02): BaseOutline {
  const loops = sliceZ(mesh, z).sort((a, b) => b.signedArea - a.signedArea);
  const first = loops[0];
  if (!first) throw new Error(`no section at z = ${z}`);
  const points = simplifyLoop(first.points, tolerance);
  const cumulative = [0];
  for (let i = 0; i < points.length; i++) {
    const a = points[i] as Point2, b = points[(i + 1) % points.length] as Point2;
    cumulative.push((cumulative[i] as number) + Math.hypot(b[0] - a[0], b[1] - a[1]));
  }
  return { points, cumulative, perimeter: cumulative[points.length] as number };
}

/** Position and outward unit normal on the outline at arc length s (wraps around). */
export function outlineAt(base: BaseOutline, s: number): { x: number; y: number; nx: number; ny: number; segment: number } {
  const n = base.points.length;
  const t = ((s % base.perimeter) + base.perimeter) % base.perimeter;
  let lo = 0, hi = n - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if ((base.cumulative[mid] as number) <= t) lo = mid; else hi = mid - 1;
  }
  const a = base.points[lo] as Point2, b = base.points[(lo + 1) % n] as Point2;
  const length = (base.cumulative[lo + 1] as number) - (base.cumulative[lo] as number);
  const f = (t - (base.cumulative[lo] as number)) / length;
  return { x: a[0] + (b[0] - a[0]) * f, y: a[1] + (b[1] - a[1]) * f, nx: (b[1] - a[1]) / length, ny: -(b[0] - a[0]) / length, segment: lo };
}

/**
 * Smooth base for parts whose outline carries protrusions (ribs, teeth): the morphological opening of `points` with a disc of
 * the given radius removes every protrusion narrower than twice the radius and keeps the smooth outline (convex corners
 * with a radius above `radius`). Works on a raster of `cell` mm, then traces and simplifies the boundary.
 */
export function openOutline(points: Point2[], radius: number, cell = 0.05, tolerance = 0.04): BaseOutline {
  const xs = points.map(p => p[0]), ys = points.map(p => p[1]);
  const pad = radius + 2 * cell;
  const x0 = Math.min(...xs) - pad, y0 = Math.min(...ys) - pad;
  const w = Math.ceil((Math.max(...xs) + pad - x0) / cell), h = Math.ceil((Math.max(...ys) + pad - y0) / cell);
  // rasterise (even-odd, cell centres)
  const inside = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    const py = y0 + (y + 0.5) * cell;
    const crossings: number[] = [];
    for (let i = 0; i < points.length; i++) {
      const a = points[i] as Point2, b = points[(i + 1) % points.length] as Point2;
      if ((a[1] > py) !== (b[1] > py)) crossings.push(a[0] + ((py - a[1]) / (b[1] - a[1])) * (b[0] - a[0]));
    }
    crossings.sort((p, q) => p - q);
    for (let k = 0; k + 1 < crossings.length; k += 2) {
      const from = Math.max(0, Math.ceil(((crossings[k] as number) - x0) / cell - 0.5)), to = Math.min(w - 1, Math.floor(((crossings[k + 1] as number) - x0) / cell - 0.5));
      for (let x = from; x <= to; x++) inside[y * w + x] = 1;
    }
  }
  const edt = (feature: Uint8Array): Float64Array => {   // squared distance in cells to the nearest cell where feature = 1
    const INF = 1e20;
    const f = new Float64Array(w * h);
    for (let i = 0; i < f.length; i++) f[i] = feature[i] ? 0 : INF;
    const pass = (n: number, get: (i: number) => number, set: (i: number, v: number) => void): void => {
      const v = new Int32Array(n), z = new Float64Array(n + 1);
      let k = 0;
      v[0] = 0; z[0] = -INF; z[1] = INF;
      for (let q = 1; q < n; q++) {
        let s = ((get(q) + q * q) - (get(v[k] as number) + (v[k] as number) ** 2)) / (2 * q - 2 * (v[k] as number));
        while (s <= (z[k] as number)) { k--; s = ((get(q) + q * q) - (get(v[k] as number) + (v[k] as number) ** 2)) / (2 * q - 2 * (v[k] as number)); }
        k++; v[k] = q; z[k] = s; z[k + 1] = INF;
      }
      k = 0;
      for (let q = 0; q < n; q++) {
        while ((z[k + 1] as number) < q) k++;
        set(q, (q - (v[k] as number)) ** 2 + get(v[k] as number));
      }
    };
    const column = new Float64Array(h), row = new Float64Array(w);
    for (let x = 0; x < w; x++) {
      for (let y = 0; y < h; y++) column[y] = f[y * w + x] as number;
      const source = Float64Array.from(column);
      pass(h, i => source[i] as number, (i, val) => { f[i * w + x] = val; });
    }
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) row[x] = f[y * w + x] as number;
      const source = Float64Array.from(row);
      pass(w, i => source[i] as number, (i, val) => { f[y * w + i] = val; });
    }
    return f;
  };
  const r = radius / cell;
  const outside = new Uint8Array(w * h);
  for (let i = 0; i < outside.length; i++) outside[i] = inside[i] ? 0 : 1;
  const toOutside = edt(outside);
  const eroded = new Uint8Array(w * h);
  for (let i = 0; i < eroded.length; i++) eroded[i] = (toOutside[i] as number) >= r * r ? 1 : 0;
  const toEroded = edt(eroded);
  const opened = new Uint8Array(w * h);
  for (let i = 0; i < opened.length; i++) opened[i] = (toEroded[i] as number) <= r * r ? 1 : 0;
  const loops = maskLoops(opened, w, h).sort((a, b) => Math.abs(area(b)) - Math.abs(area(a)));
  const first = loops[0];
  if (!first) throw new Error('opening removed the whole outline');
  // the traced boundary is a staircase: a moving average over about +-0.3 mm removes it without moving curves noticeably
  let ring = first.map(([x, y]): Point2 => [x0 + x * cell, y0 + y * cell]);
  const half = Math.max(1, Math.round(0.3 / cell));
  for (let pass = 0; pass < 2; pass++) {
    const next: Point2[] = [];
    for (let i = 0; i < ring.length; i++) {
      let sx = 0, sy = 0;
      for (let k = -half; k <= half; k++) { const q = ring[(i + k + ring.length) % ring.length] as Point2; sx += q[0]; sy += q[1]; }
      next.push([sx / (2 * half + 1), sy / (2 * half + 1)]);
    }
    ring = next;
  }
  const simplified = simplifyLoop(ring, tolerance);
  const cumulative = [0];
  for (let i = 0; i < simplified.length; i++) {
    const a = simplified[i] as Point2, b = simplified[(i + 1) % simplified.length] as Point2;
    cumulative.push((cumulative[i] as number) + Math.hypot(b[0] - a[0], b[1] - a[1]));
  }
  return { points: simplified, cumulative, perimeter: cumulative[simplified.length] as number };
}

export function heightmap(mesh: Mesh, options: ReliefOptions, baseOverride?: BaseOutline): ReliefMap {
  const px = options.px ?? 0.1;
  const base = baseOverride ?? (() => {
    const raw = baseOutline(mesh, options.baseZ, options.baseTolerance ?? 0.02);
    return options.openRadius ? openOutline(raw.points, options.openRadius) : raw;
  })();
  const marginColumns = Math.ceil((options.margin ?? 2) / px);
  const width = Math.ceil(base.perimeter / px) + 2 * marginColumns;
  const height = Math.ceil((options.z1 - options.z0) / px);
  const maxHit = options.maxHit ?? 8;
  const ox = new Float64Array(width), oy = new Float64Array(width), nx = new Float64Array(width), ny = new Float64Array(width);
  for (let c = 0; c < width; c++) {
    const p = outlineAt(base, (c - marginColumns + 0.5) * px);
    ox[c] = p.x; oy[c] = p.y; nx[c] = p.nx; ny[c] = p.ny;
  }
  const d = new Float32Array(width * height).fill(Number.NaN);
  for (let r = 0; r < height; r++) {
    const loops = sliceZ(mesh, options.z0 + (r + 0.5) * px).filter(l => l.signedArea > 0);
    const outer = loops.sort((a, b) => b.signedArea - a.signedArea)[0];
    if (!outer) continue;
    const pts = outer.points, n = pts.length;
    const ax = new Float64Array(n), ay = new Float64Array(n), bx = new Float64Array(n), by = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      const a = pts[i] as Point2, b = pts[(i + 1) % n] as Point2;
      ax[i] = a[0]; ay[i] = a[1]; bx[i] = b[0]; by[i] = b[1];
    }
    for (let c = 0; c < width; c++) {
      const x0 = ox[c] as number, y0 = oy[c] as number, cx = nx[c] as number, cy = ny[c] as number;
      let best = -Infinity;
      for (let i = 0; i < n; i++) {
        const la = -((ax[i] as number) - x0) * cy + ((ay[i] as number) - y0) * cx;
        const lb = -((bx[i] as number) - x0) * cy + ((by[i] as number) - y0) * cx;
        if ((la > 0) === (lb > 0)) continue;
        const ta = ((ax[i] as number) - x0) * cx + ((ay[i] as number) - y0) * cy;
        const tb = ((bx[i] as number) - x0) * cx + ((by[i] as number) - y0) * cy;
        const t = ta + (tb - ta) * (la / (la - lb));
        if (t > best && t < maxHit) best = t;
      }
      if (best > -Infinity) d[r * width + c] = best;
    }
  }
  return { base, px, z0: options.z0, width, height, marginColumns, d };
}

/**
 * The base outline from an opening is a few hundredths of a millimetre off the true plain wall. Shift it by the median height
 * of the plain-wall cells (|d| < 0.6) found at every arc length, and resample it every `spacing` mm. Measure the map again
 * against the result to have the plain wall at d = 0.
 */
export function refineBase(map: ReliefMap, spacing = 0.25, zFrom = -Infinity, zTo = Infinity, tolerance = 0.03): BaseOutline {
  const columns = map.width - 2 * map.marginColumns;
  const shift = new Float64Array(columns);
  for (let c = 0; c < columns; c++) {
    const values: number[] = [];
    for (let r = 0; r < map.height; r++) {
      const z = map.z0 + (r + 0.5) * map.px;
      if (z < zFrom || z > zTo) continue;
      const v = map.d[r * map.width + c + map.marginColumns] as number;
      if (v > -0.6 && v < 0.6) values.push(v);
    }
    values.sort((a, b) => a - b);
    shift[c] = values.length > 20 ? (values[values.length >> 1] as number) : 0;
  }
  const half = Math.max(1, Math.round(0.5 / map.px));
  const smooth = new Float64Array(columns);
  for (let c = 0; c < columns; c++) {
    const window: number[] = [];
    for (let k = -half; k <= half; k++) window.push(shift[(c + k + columns) % columns] as number);
    window.sort((a, b) => a - b);
    smooth[c] = window[window.length >> 1] as number;
  }
  const count = Math.max(8, Math.round(map.base.perimeter / spacing));
  const points: Point2[] = [];
  for (let k = 0; k < count; k++) {
    const s = (k / count) * map.base.perimeter;
    const p = outlineAt(map.base, s);
    const d = smooth[Math.min(columns - 1, Math.floor(s / map.px))] as number;
    points.push([p.x + p.nx * d, p.y + p.ny * d]);
  }
  // simplify so straight walls become single long pieces (a run of collinear vertices would give the SCAD wrapper many
  // exactly coplanar faces) and measure the map again against this outline
  const simplified = simplifyLoop(points, tolerance);
  const cumulative = [0];
  for (let i = 0; i < simplified.length; i++) {
    const a = simplified[i] as Point2, b = simplified[(i + 1) % simplified.length] as Point2;
    cumulative.push((cumulative[i] as number) + Math.hypot(b[0] - a[0], b[1] - a[1]));
  }
  return { points: simplified, cumulative, perimeter: cumulative[simplified.length] as number };
}

/** Plateau heights: peaks of the histogram of d (share of all cells >= minShare), close peaks merged. */
export function findLevels(map: ReliefMap, minShare = 0.004, bin = 0.05, merge = 0.15): number[] {
  const counts = new Map<number, number>();
  let total = 0;
  for (const v of map.d) {
    if (Number.isNaN(v)) continue;
    total++;
    const k = Math.round(v / bin);
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  const peaks = [...counts.entries()].filter(([k, n]) => n >= minShare * total && n >= (counts.get(k - 1) ?? 0) && n >= (counts.get(k + 1) ?? 0)).sort((a, b) => a[0] - b[0]);
  const levels: { h: number; n: number }[] = [];
  for (const [k, n] of peaks) {
    const h = k * bin, last = levels[levels.length - 1];
    if (last && h - last.h < merge) { if (n > last.n) { last.h = h; last.n = n; } } else levels.push({ h, n });
  }
  return levels.map(l => Math.round(l.h * 100) / 100);
}

/** Index of the nearest level for every cell; NaN cells take the lowest level. */
export function quantise(map: ReliefMap, levels: number[]): Uint8Array {
  const out = new Uint8Array(map.d.length);
  for (let i = 0; i < out.length; i++) {
    const v = map.d[i] as number;
    if (Number.isNaN(v)) continue;
    let best = 0, bestDistance = Infinity;
    for (let k = 0; k < levels.length; k++) {
      const dist = Math.abs(v - (levels[k] as number));
      if (dist < bestDistance) { bestDistance = dist; best = k; }
    }
    out[i] = best;
  }
  return out;
}

/** Boundary loops of a binary mask on the cell lattice (x = column, y = row), counter-clockwise around set cells. */
export function maskLoops(mask: Uint8Array, width: number, height: number): Point2[][] {
  // Remove pinch points (2x2 blocks with only diagonal cells set): a polygon that touches itself at a lattice vertex extrudes to a
  // solid with a non-manifold edge. Filling one of the empty cells joins the diagonal pair.
  for (let y = 0; y + 1 < height; y++) {
    for (let x = 0; x + 1 < width; x++) {
      const a = mask[y * width + x], b = mask[y * width + x + 1], c = mask[(y + 1) * width + x], d = mask[(y + 1) * width + x + 1];
      if (a === 1 && d === 1 && b === 0 && c === 0) mask[y * width + x + 1] = 1;
      else if (b === 1 && c === 1 && a === 0 && d === 0) mask[y * width + x] = 1;
    }
  }
  const at = (x: number, y: number): boolean => x >= 0 && y >= 0 && x < width && y < height && mask[y * width + x] === 1;
  const out = new Map<number, number[]>();
  const edges: [number, number, number, number][] = [];
  const key = (x: number, y: number): number => y * (width + 1) + x;
  const add = (x0: number, y0: number, x1: number, y1: number): void => {
    const id = edges.length;
    edges.push([x0, y0, x1, y1]);
    const k = key(x0, y0);
    const list = out.get(k);
    if (list) list.push(id); else out.set(k, [id]);
  };
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!at(x, y)) continue;
      if (!at(x, y + 1)) add(x + 1, y + 1, x, y + 1);
      if (!at(x, y - 1)) add(x, y, x + 1, y);
      if (!at(x + 1, y)) add(x + 1, y, x + 1, y + 1);
      if (!at(x - 1, y)) add(x, y + 1, x, y);
    }
  }
  const used = new Uint8Array(edges.length);
  const loops: Point2[][] = [];
  for (let start = 0; start < edges.length; start++) {
    if (used[start]) continue;
    const loop: Point2[] = [];
    let id = start;
    while (!used[id]) {
      used[id] = 1;
      const [x0, y0, x1, y1] = edges[id] as [number, number, number, number];
      loop.push([x0, y0]);
      const candidates = (out.get(key(x1, y1)) ?? []).filter(e => !used[e]);
      if (candidates.length === 0) break;
      if (candidates.length === 1) { id = candidates[0] as number; continue; }
      // saddle: turn right (keeps diagonal neighbours apart)
      const dx = x1 - x0, dy = y1 - y0;
      let pick = candidates[0] as number, bestCross = Infinity;
      for (const e of candidates) {
        const [ex0, ey0, ex1, ey1] = edges[e] as [number, number, number, number];
        const cross = dx * (ey1 - ey0) - dy * (ex1 - ex0);
        if (cross < bestCross) { bestCross = cross; pick = e; }
      }
      id = pick;
    }
    if (loop.length >= 4) loops.push(loop);
  }
  return loops;
}

const area = (loop: Point2[]): number => {
  let a = 0;
  for (let i = 0; i < loop.length; i++) {
    const p = loop[i] as Point2, q = loop[(i + 1) % loop.length] as Point2;
    a += p[0] * q[1] - q[0] * p[1];
  }
  return a / 2;
};

export interface LevelRegion {
  /** Plateau height of the level this region belongs to (mm from the base outline). */
  height: number;
  /** "add": material from the base outline out to height; "cut": material removed from height up to the base outline. */
  kind: 'add' | 'cut';
  /** Loops in (s, z) mm; nested loops are holes (even-odd). */
  loops: Point2[][];
  /** Extra margin (mm) added around the region in SCAD so nested levels never share boundary faces. */
  grow: number;
}

/** Regions per non-zero level. Level 0 is the base outline itself. */
export function levelRegions(map: ReliefMap, levels: number[], options: { simplify?: number; minArea?: number } = {}): LevelRegion[] {
  const zero = levels.reduce((best, h, k) => (Math.abs(h) < Math.abs(levels[best] as number) ? k : best), 0);
  const idx = quantise(map, levels);
  const regions: LevelRegion[] = [];
  const tolerance = (options.simplify ?? 0.07) / map.px;
  const minArea = (options.minArea ?? 0.15) / (map.px * map.px);
  for (let k = 0; k < levels.length; k++) {
    if (k === zero) continue;
    const kind = k > zero ? 'add' : 'cut';
    const mask = new Uint8Array(idx.length);
    for (let i = 0; i < idx.length; i++) mask[i] = (kind === 'add' ? (idx[i] as number) >= k : (idx[i] as number) <= k) ? 1 : 0;
    const loops = maskLoops(mask, map.width, map.height)
      .filter(l => Math.abs(area(l)) >= minArea)
      .map(l => simplifyLoop(l, tolerance).map(([x, y]): Point2 => [(x - map.marginColumns) * map.px, map.z0 + y * map.px]));
    // nested regions: the further a level is from the base, the tighter its outline, so boundaries of different levels never coincide
    const rank = kind === 'add' ? levels.length - 1 - k : k;
    regions.push({ height: levels[k] as number, kind, loops, grow: 0.03 * rank });
  }
  return regions;
}

const num = (v: number, digits: number): string => String(Number(v.toFixed(digits)));
const pointList = (points: Point2[], digits: number): string => `[${points.map(p => `[${num(p[0], digits)}, ${num(p[1], digits)}]`).join(', ')}]`;

/** Wrap long lines of a SCAD literal at commas. */
export function wrapLines(text: string, width = 118, indent = '  '): string {
  const out: string[] = [];
  let line = '';
  for (const piece of text.split(/(?<=\], )/)) {
    if (line.length + piece.length > width && line) { out.push(line.trimEnd()); line = indent; }
    line += piece;
  }
  out.push(line.trimEnd());
  return out.join('\n');
}

/** Plateau heights replaced by the median of the cells nearest to each; the level nearest to 0 is kept at exactly 0. */
export function refineLevels(map: ReliefMap, levels: number[]): number[] {
  const index = quantise(map, levels);
  const samples: number[][] = levels.map(() => []);
  for (let i = 0; i < index.length; i += 5) {
    const v = map.d[i] as number;
    if (!Number.isNaN(v)) (samples[index[i] as number] as number[]).push(v);
  }
  const zero = levels.reduce((best, h, k) => (Math.abs(h) < Math.abs(levels[best] as number) ? k : best), 0);
  return levels.map((h, k) => {
    const values = (samples[k] as number[]).sort((a, b) => a - b);
    return k === zero || values.length === 0 ? (k === zero ? 0 : h) : Math.round((values[values.length >> 1] as number) * 100) / 100;
  });
}

export interface BuildReliefOptions extends ReliefOptions {
  /** Measure against the plain wall found between the ribs: shift and simplify the outline, then measure again (recommended). */
  refine?: boolean;
  /** Plateau heights; found from the height histogram when omitted. */
  levels?: number[];
  /** Douglas-Peucker tolerance and smallest region kept, in mm and mm^2. */
  simplify?: number;
  minArea?: number;
}

export interface Relief { map: ReliefMap; levels: number[]; regions: LevelRegion[] }

/** Base outline, height map, plateau levels and level regions of a wall with a surface pattern. */
export function buildRelief(mesh: Mesh, options: BuildReliefOptions): Relief {
  let map = heightmap(mesh, options);
  if (options.refine ?? true) map = heightmap(mesh, options, refineBase(map, 0.25, options.z0 + 2, options.z1 - 2));
  const levels = options.levels ?? refineLevels(map, findLevels(map));
  const regions = levelRegions(map, levels, { simplify: options.simplify ?? 0.12, minArea: options.minArea ?? 0.3 });
  return { map, levels, regions };
}

export interface ReliefScadOptions {
  digits?: number;
  /** Part origin in the STL's coordinates: x, y of the axis and z of the underside. The SCAD data is written relative to it. */
  origin: [number, number, number];
}

/**
 * SCAD source for the wrapped relief: the data (base outline, level regions) and the modules that bend it around the
 * outline. `relief_add()` / `relief_cut()` produce the material to union with / subtract from the base prism of the outline.
 */
export function reliefScad(map: ReliefMap, regions: LevelRegion[], options: ReliefScadOptions): string {
  const digits = options.digits ?? 2;
  const [ox, oy, oz] = options.origin;
  const basePoints = map.base.points.map((p): Point2 => [p[0] - ox, p[1] - oy]);
  const zRange: [number, number] = [map.z0 - oz, map.z0 + map.height * map.px - oz];
  const levels = regions.map(r0 => ({ ...r0, loops: r0.loops.map(l => l.map((p): Point2 => [p[0], p[1] - oz])) })).map(r => `  [${num(r.height, 2)}, ${r.kind === 'add' ? 1 : -1}, ${num(r.grow, 2)}, [\n${r.loops.map(l => wrapLines(`    ${pointList(l, digits)}`, 118, '     ')).join(',\n')}\n  ]]`).join(',\n');
  return `// Base outline the relief is measured from (counter-clockwise), and the pattern as plateau regions in the unrolled (s, z) plane:
// s = arc length along the outline from its first point, z = height. Each level is [height, +1 add / -1 cut, grow, loops]; height is
// the distance of the plateau from the outline along its outward normal; loops are outer boundaries and holes (even-odd).
RELIEF_BASE = ${wrapLines(pointList(basePoints, 3), 118, '  ')};
RELIEF_LEVELS = [
${levels}
];
RELIEF_Z0 = ${num(zRange[0], 2)};     // pattern covers z from RELIEF_Z0 to RELIEF_Z1
RELIEF_Z1 = ${num(zRange[1], 2)};
RELIEF_ROOT = 1;      // additive plateaus start this far inside the outline so they fuse with the base prism
RELIEF_OVER = 0.3;    // cuts run this far outside the outline
RELIEF_LAP = 0.8;     // pieces are drawn this much beyond their ends along the outline, then trimmed at the mitre lines
RELIEF_ZLAP = 0.03;   // the pattern band is moved down by this much (more for each further level), so band ends never share a plane
RELIEF_SHIFT = 0.0137;   // pattern shifted along the outline by this much: its lattice lines then never pass through an outline vertex
RELIEF_JITTER = 0.0037;
RELIEF_MERGE = 0.1;  // neighbouring cells overlap by this much so the union has no coincident faces
RELIEF_REACH = 3.5;   // cells reach this far outside the outline (more than the tallest plateau)

RELIEF_N = len(RELIEF_BASE);
function relief_seg(i) = RELIEF_BASE[(i + 1) % RELIEF_N] - RELIEF_BASE[i];
function relief_sum(v, n) = n <= 0 ? 0 : [for (j = [0 : n - 1]) 1] * [for (j = [0 : n - 1]) v[j]];   // sum of the first n entries, without recursion
function relief_cum(i) = relief_sum([for (j = [0 : RELIEF_N - 1]) norm(relief_seg(j))], i);
function relief_points(loops) = [for (l = loops) each l];
function relief_paths(loops) =
  let(lens = [for (l = loops) len(l)], offs = [for (i = [0 : len(lens) - 1]) relief_sum(lens, i)])
  [for (i = [0 : len(lens) - 1]) [for (j = [0 : lens[i] - 1]) offs[i] + j]];
// polygon data per level, built once
RELIEF_POLY = [for (level = RELIEF_LEVELS) [relief_points(level[3]), relief_paths(level[3])]];

// One plateau set over one straight piece of the outline, in that piece's own frame (u along, v outward, w up).
module relief_piece(k, s0, length) {
  level = RELIEF_LEVELS[k];
  h = level[0];
  v0 = level[1] > 0 ? -RELIEF_ROOT - 0.05 * k : h;
  v1 = level[1] > 0 ? h : RELIEF_OVER;
  translate([0, v0, 0]) mirror([0, 1, 0]) rotate([90, 0, 0]) linear_extrude(height = v1 - v0)
    intersection() {
      offset(delta = level[2]) translate([-s0 + RELIEF_SHIFT, 0]) polygon(RELIEF_POLY[k][0], RELIEF_POLY[k][1]);
      translate([-RELIEF_LAP, RELIEF_Z0 - RELIEF_ZLAP * (1 + k)]) square([length + 2 * RELIEF_LAP, RELIEF_Z1 - RELIEF_Z0]);
    }
}

// Outward normal of piece i, and the mitre direction (bisector of the normals) at its start.
function relief_normal(i) = let(d = relief_seg((i + RELIEF_N) % RELIEF_N)) [d.y, -d.x] / norm(d);
function relief_mitre(i) = let(v = relief_normal(i - 1) + relief_normal(i)) v / norm(v);

// kind = 1: the additive plateaus, kind = -1: the cuts. Each piece is trimmed to the cell between the mitre lines at its ends,
// so neighbouring pieces meet without slits or overshoot at bends.
module relief_wrap(kind) {
  for (i = [0 : RELIEF_N - 1]) {
    a = RELIEF_BASE[i]; b = RELIEF_BASE[(i + 1) % RELIEF_N];
    d = relief_seg(i); length = norm(d); t = d / length; n = [t.y, -t.x];
    ma = relief_mitre(i); mb = relief_mitre((i + 1) % RELIEF_N);
    e = t * RELIEF_MERGE;
    // mitre points at perpendicular distance REACH outside and ROOT inside the piece
    ka = 1 / (ma * n); kb = 1 / (mb * n);
    cell = [a - e - ma * ka * RELIEF_ROOT, a - e + ma * ka * RELIEF_REACH, b + e + mb * kb * RELIEF_REACH, b + e - mb * kb * RELIEF_ROOT];
    intersection() {
      // neighbouring pieces overlap and carry the same pattern: a tiny per-piece height shift keeps their horizontal faces apart
      translate([0, 0, RELIEF_JITTER * (i % 8)]) multmatrix([[t.x, n.x, 0, a.x], [t.y, n.y, 0, a.y], [0, 0, 1, 0], [0, 0, 0, 1]])
        for (k = [0 : len(RELIEF_LEVELS) - 1]) if (RELIEF_LEVELS[k][1] == kind) relief_piece(k, relief_cum(i), length);
      translate([0, 0, RELIEF_Z0 - 1]) linear_extrude(height = RELIEF_Z1 - RELIEF_Z0 + 2) polygon(cell);
    }
  }
}
`;
}
