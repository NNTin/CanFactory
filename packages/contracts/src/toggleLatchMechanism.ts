/**
 * The toggle latch's mechanism (models/toggle-latch/), shared by the catalogue card's side view (apps/web) and the 3D preview's
 * assembly slider (`toggleLatchAssembly`). Every value is read from the SCAD files: the side profiles verbatim (a test compares
 * them), the joints from their centres and diameters, and the two circles that seat the link on the catch fitted to the
 * profiles' points (to 0.005 mm). See docs/toggle-latch.md, “Mechanism”.
 *
 * All four parts are side profiles extruded along one axis, and their joints are parallel to it, so the latch moves in one plane:
 * `u` along the pull, `v` up from the mounting surface (the plates' backs), in mm. The base is fixed, its plate on u = 0..12; the
 * catch's plate lies beyond it, on u < 0, turned so that its hook faces the base's knuckle across the gap.
 *
 * - The lever turns on the base's pivot pins (`pivot`). Its link pins (`pin`) are a crank of 10.17 mm.
 * - The link hangs on the lever's pins. The round nose of its bar (r 1.408) seats in the dip under the catch's hook (r 1.99), on
 *   the side away from the base.
 * - The catch slides along u, driven by the link: it is screwed to the part that the latch draws in (a lid).
 *
 * With the link taut, the catch is pulled away from the base as far as the link lets it, and the link turns freely on the lever's
 * pins: a slider-crank, solved on the real profiles (`hookedLink`, tabulated in `TOGGLE_LATCH_HOOKED`). As the lever closes, the
 * link draws the catch in, closest at `DEAD_CENTRE`. The lever turns on past it until the link comes to lie on the base's plate
 * (`CLOSED`): the pull in the link now holds it down, and the catch has eased back by 0.32 mm. That is the over-centre lock.
 * Opening turns the lever back over the dead centre. The link goes slack at `RELEASED` and the catch stops. The lever opens on to
 * rest on the catch's hook (`OPEN`), carrying the link's nose out of the dip, and the link swings up off the hook (`SWING`).
 */

import { QUASI_STATIC, type PhysicsSpec } from './physics.ts';
import { convexParts, extrudedPieces } from './physicsPieces.ts';

export type Vec2 = [number, number];
/** A profile point (x, y) goes to (m[0] x + m[1] y + t[0], m[2] x + m[3] y + t[1]) in the plane (u, v). */
export interface Placement2D { m: [number, number, number, number]; t: Vec2 }

/** The SCAD profiles, verbatim: catch.scad CATCH_HOOK (y, z), base.scad BASE_KNUCKLE (y, z), the lever's LEVER_SIDE and LEVER_BRIDGE
 * (x, z) and the link's LINK_SIDE and LINK_BAR (x, z). */
export const TOGGLE_LATCH_PROFILES = {
  baseKnuckle: [
    [0.0, 4.86], [0.082, 4.092], [0.278, 3.348], [0.588, 2.642], [1.004, 1.994], [1.51, 1.414], [2.106, 0.922],
    [2.764, 0.526], [3.48, 0.236], [4.23, 0.058], [4.998, 0.002], [15.372, 0.002], [15.372, 11.994],
    [12.296, 11.998], [11.918, 11.956], [11.564, 11.83], [11.426, 11.716], [11.376, 11.59], [11.326, 9.63],
    [2.466, 9.63], [1.318, 8.384], [0.842, 7.778], [0.464, 7.104], [0.196, 6.384], [0.038, 5.63]],
  catchHook: [
    [10.816, 11.92], [10.508, 11.776], [10.4, 11.588], [10.35, 9.628], [10.35, 5.472], [10.17, 5.72],
    [9.978, 5.84], [9.756, 5.9], [9.256, 5.95], [9.026, 5.936], [8.79, 5.864], [8.534, 5.716], [8.168, 5.384],
    [7.35, 4.28], [7.099, 3.994], [6.7, 3.709], [6.274, 3.538], [5.749, 3.464], [5.224, 3.533], [4.8, 3.704],
    [4.401, 3.987], [4.058, 4.398], [3.862, 4.811], [3.647, 5.393], [3.399, 5.723], [3.066, 5.979], [2.683, 6.139],
    [2.276, 6.199], [1.858, 6.145], [1.473, 5.992], [1.118, 5.72], [0.871, 5.39], [0.726, 5.037], [0.032, 1.812],
    [0.0, 1.495], [0.049, 1.107], [0.2, 0.745], [0.442, 0.438], [0.75, 0.201], [1.084, 0.059], [1.498, 0.0],
    [14.4, 0.002], [14.4, 11.992], [11.402, 11.998]],
  leverSide: [
    [3.078, 13.506], [2.636, 13.3], [2.22, 13.05], [1.832, 12.76], [1.47, 12.436], [1.144, 12.074],
    [0.854, 11.688], [0.602, 11.272], [0.394, 10.834], [0.224, 10.377], [0.106, 9.91], [0.03, 9.428],
    [0.001, 8.944], [0.02, 8.46], [0.084, 7.978], [0.196, 7.506], [0.352, 7.048], [0.552, 6.604], [0.798, 6.184],
    [1.078, 5.788], [1.396, 5.422], [1.752, 5.092], [2.136, 4.793], [2.544, 4.534], [2.978, 4.318], [3.432, 4.144],
    [13.272, 0.9], [17.566, 0.001], [30.156, 0.003], [30.369, 0.02], [30.624, 0.087], [30.862, 0.194],
    [31.081, 0.343], [31.265, 0.526], [31.419, 0.74], [31.531, 0.979], [31.601, 1.231], [31.624, 1.494],
    [31.603, 1.756], [31.539, 2.009], [31.402, 2.285], [31.276, 2.464], [31.092, 2.648], [19.654, 9.318],
    [5.788, 13.898], [4.482, 13.866], [4.004, 13.792], [3.534, 13.67]],
  leverBridge: [
    [23.14, 6.07], [22.966, 5.88], [22.822, 5.655], [22.719, 5.406], [22.665, 5.142], [22.656, 1.502],
    [22.699, 1.14], [22.791, 0.876], [22.924, 0.643], [23.1, 0.436], [23.303, 0.265], [23.537, 0.132],
    [23.791, 0.047], [24.058, 0.004], [30.294, 0.008], [30.554, 0.062], [30.804, 0.164], [31.034, 0.308],
    [31.232, 0.488], [31.396, 0.702], [31.516, 0.942], [31.596, 1.198], [31.624, 1.466], [31.606, 1.735],
    [31.542, 1.996], [31.432, 2.238], [31.276, 2.463], [31.09, 2.65], [30.878, 2.796], [24.91, 6.267],
    [24.655, 6.384], [24.38, 6.453], [24.126, 6.47], [23.86, 6.438], [23.602, 6.363], [23.36, 6.241]],
  linkSide: [
    [1.523, 7.132], [1.254, 6.908], [0.952, 6.592], [0.487, 5.913], [0.283, 5.477], [0.057, 4.686], [0.006, 4.253],
    [0.002, 3.817], [0.053, 3.337], [0.135, 2.958], [0.274, 2.544], [0.475, 2.102], [0.7, 1.731], [1.234, 1.105],
    [1.566, 0.824], [1.927, 0.578], [2.311, 0.373], [2.714, 0.207], [3.133, 0.089], [3.563, 0.022], [3.998, 0.0],
    [29.148, 0.0], [29.636, 0.024], [30.118, 0.09], [30.592, 0.208], [31.052, 0.372], [31.494, 0.58],
    [31.912, 0.828], [32.306, 1.12], [32.67, 1.448], [33.0, 1.804], [33.292, 2.196], [33.546, 2.612],
    [33.756, 3.052], [33.924, 3.51], [34.046, 3.982], [34.122, 4.464], [34.146, 4.948], [34.13, 5.438],
    [34.06, 5.922], [33.948, 6.396], [33.792, 6.86], [33.588, 7.3], [33.342, 7.722], [33.056, 8.118],
    [32.73, 8.484], [32.378, 8.816], [31.986, 9.112], [31.572, 9.368], [31.138, 9.586], [30.682, 9.758],
    [30.208, 9.886], [29.18, 10.026]],
  linkBar: [
    [3.998, 0.0], [4.44, 0.023], [4.876, 0.094], [5.302, 0.214], [5.763, 0.41], [6.148, 0.626], [6.598, 0.956],
    [9.014, 3.03], [9.178, 3.24], [9.298, 3.478], [9.374, 3.732], [9.398, 3.994], [9.374, 4.264], [9.298, 4.516],
    [9.178, 4.754], [9.014, 4.964], [6.507, 7.111], [6.148, 7.37], [5.752, 7.592], [1.514, 7.132], [1.144, 6.8],
    [0.881, 6.504], [0.624, 6.142], [0.405, 5.751], [0.23, 5.339], [0.091, 4.861], [0.023, 4.419], [0.0, 3.97],
    [0.029, 3.528], [0.101, 3.088], [0.229, 2.658], [0.403, 2.246], [0.622, 1.855], [0.879, 1.491], [1.177, 1.158],
    [1.511, 0.864], [1.876, 0.607], [2.272, 0.393], [2.683, 0.218], [3.111, 0.095], [3.552, 0.024]],
} satisfies Record<string, Vec2[]>;

/**
 * The joints and plates, from the SCAD files (each part in its own frame; `middle` is the part's middle across its width, where
 * the latch's middle plane lies). The catch's dip and the link's nose are circles fitted to CATCH_HOOK's and LINK_BAR's points.
 */
export const TOGGLE_LATCH_GEOMETRY = {
  // base.scad: PLATE_FRONT, PLATE_BACK, PLATE_HEIGHT, PLATE_LENGTH, EDGE_RADIUS, HOLE_X, HOLE_Z, PIN_CENTRE (y, z), KNUCKLE_X's and PIN_X
  base: {
    front: 11.376, back: 15.372, height: 11.998, length: 38, edgeRadius: 1, holeX: [5.769, 32.184] as Vec2, holeZ: 5.932,
    pivot: [5.115, 4.891] as Vec2, pinDiameter: 4.41, knuckle: [14.7, 23.298] as Vec2, pins: [12.5, 25.498] as Vec2, middle: 18.999,
  },
  // catch.scad: PLATE_FRONT, PLATE_BACK, PLATE_HEIGHT, PLATE_LENGTH, EDGE_RADIUS, HOLE_X, HOLE_Z, HOOK_X; the dip under the hook (y, z)
  catch: {
    front: 10.4, back: 14.4, height: 11.998, length: 37.996, edgeRadius: 1, holeX: [5.766, 32.18] as Vec2, holeZ: 5.93,
    hook: [12.492, 25.492] as Vec2, middle: 18.992, dip: { centre: [5.745, 5.455] as Vec2, radius: 1.99 },
  },
  // Latch 12mm 3.scad: PIVOT_CENTRE, PIVOT_D, PIN_CENTRE (x, z) and PIN_D of the standard lever, PIN_LENGTH, SIDE, WIDTH and
  // WIDTH / 2. The high-tolerance lever's body is the same; its larger pivot hole and thinner pins keep the faces that bear the pull
  // where the standard lever's are.
  lever: { pivot: [4.999, 8.89] as Vec2, pivotDiameter: 4.99, pin: [14.655, 5.705] as Vec2, pinDiameter: 4.642, pinLength: 2.7, side: 2, width: 18.4, middle: 9.2 },
  // Latch 12mm 4.scad: HOLE_CENTRE (x, z), HOLE_D, SIDE, WIDTH, WIDTH / 2; the nose at the end of the bar (x, z)
  link: { hole: [29.15, 4.996] as Vec2, holeDiameter: 5, side: 2, width: 17.402, middle: 8.701, nose: { centre: [7.99, 3.997] as Vec2, radius: 1.408 } },
} as const;

const G = TOGGLE_LATCH_GEOMETRY;
const DEG = Math.PI / 180;
const sub = (a: Vec2, b: Vec2): Vec2 => [a[0] - b[0], a[1] - b[1]];
const angleOf = (d: Vec2): number => Math.atan2(d[1], d[0]) / DEG;
const rotation = (degrees: number): [number, number, number, number] => {
  const c = Math.cos(degrees * DEG), s = Math.sin(degrees * DEG);
  return [c, -s, s, c];
};
const times = (a: Placement2D['m'], b: Placement2D['m']): Placement2D['m'] =>
  [a[0] * b[0] + a[1] * b[2], a[0] * b[1] + a[1] * b[3], a[2] * b[0] + a[3] * b[2], a[2] * b[1] + a[3] * b[3]];
export const placePoint = (placement: Placement2D, [x, y]: Vec2): Vec2 =>
  [placement.m[0] * x + placement.m[1] * y + placement.t[0], placement.m[2] * x + placement.m[3] * y + placement.t[1]];

/** The base, fixed: its plate's back on v = 0, its plate's bottom edge (z = 0) at u = 0. */
export const BASE_PLACEMENT: Placement2D = { m: [0, 1, -1, 0], t: [0, G.base.back] };
/** The catch, its plate's top edge (z = 0) at u = `offset` (≤ 0, so the gap between the plates is -offset), turned end for end. */
export const catchPlacement = (offset: number): Placement2D => ({ m: [0, -1, -1, 0], t: [offset, G.catch.back] });

/**
 * Which way up the lever and the link lie: each is symmetric across its width, so turning it over mirrors its side profile. The
 * lever lies with its flat edge (LEVER_SIDE's z = 0) outwards, the thumb pad that its bridge forms: the high-tolerance lever's holes
 * were grown and its pins thinned on the faces away from the pull, and in this way up those are the faces the closed latch's pull
 * bears on. The link lies with its flat edge (LINK_SIDE's z = 0) towards the mounting surface.
 */
const LEVER_MIRROR: Placement2D['m'] = [1, 0, 0, -1];
const LINK_MIRROR: Placement2D['m'] = [1, 0, 0, -1];

/** The pivot (the base's pin centre) in the plane. */
export const PIVOT = placePoint(BASE_PLACEMENT, G.base.pivot);
/** The lever's crank, pivot to link pin; the link, hole to nose; the play of the nose in the dip. */
export const CRANK = Math.hypot(...sub(G.lever.pin, G.lever.pivot));
export const LINK_LENGTH = Math.hypot(...sub(G.link.nose.centre, G.link.hole));
export const NOSE_PLAY = G.catch.dip.radius - G.link.nose.radius;
/** The dip's centre slides along this line (v), at this distance from the catch plate's top edge (u). */
const DIP_V = G.catch.back - G.catch.dip.centre[0];
const COUPLER = LINK_LENGTH + NOSE_PLAY;

const LEVER_ANGLE0 = angleOf(sub(placePoint({ m: LEVER_MIRROR, t: [0, 0] }, G.lever.pin), placePoint({ m: LEVER_MIRROR, t: [0, 0] }, G.lever.pivot)));
const LINK_ANGLE0 = angleOf(sub(placePoint({ m: LINK_MIRROR, t: [0, 0] }, G.link.nose.centre), placePoint({ m: LINK_MIRROR, t: [0, 0] }, G.link.hole)));

/** The lever with its link pins at `angle` (degrees, from +u towards +v) about the pivot. */
export function leverPlacement(angle: number): Placement2D {
  const m = times(rotation(angle - LEVER_ANGLE0), LEVER_MIRROR);
  const at = placePoint({ m, t: [0, 0] }, G.lever.pivot);
  return { m, t: [PIVOT[0] - at[0], PIVOT[1] - at[1]] };
}
/** Where the lever's link pins are with the lever at `angle`. */
export const pinAt = (angle: number): Vec2 => [PIVOT[0] + CRANK * Math.cos(angle * DEG), PIVOT[1] + CRANK * Math.sin(angle * DEG)];
/** The link hung on the pins at `pin`, its nose in the direction `angle` (degrees) from them. */
export function linkPlacement(pin: Vec2, angle: number): Placement2D {
  const m = times(rotation(angle - LINK_ANGLE0), LINK_MIRROR);
  const at = placePoint({ m, t: [0, 0] }, G.link.hole);
  return { m, t: [pin[0] - at[0], pin[1] - at[1]] };
}

// ---- the link on the catch's hook -------------------------------------------------------------------------------------------

const cross = (o: Vec2, a: Vec2, b: Vec2) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
function segmentsCross(a: Vec2, b: Vec2, c: Vec2, d: Vec2): boolean {
  return cross(a, b, c) * cross(a, b, d) < 0 && cross(c, d, a) * cross(c, d, b) < 0;
}
function inside(point: Vec2, polygon: Vec2[]): boolean {
  let hit = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [a, b] = [polygon[i] as Vec2, polygon[j] as Vec2];
    if ((a[1] > point[1]) !== (b[1] > point[1]) && point[0] < (b[0] - a[0]) * (point[1] - a[1]) / (b[1] - a[1]) + a[0]) hit = !hit;
  }
  return hit;
}
/** Whether two simple polygons overlap. */
export function polygonsOverlap(a: Vec2[], b: Vec2[]): boolean {
  for (let i = 0; i < a.length; i++) for (let j = 0; j < b.length; j++)
    if (segmentsCross(a[i] as Vec2, a[(i + 1) % a.length] as Vec2, b[j] as Vec2, b[(j + 1) % b.length] as Vec2)) return true;
  return inside(a[0] as Vec2, b) || inside(b[0] as Vec2, a);
}
/** How far `moving` can slide along the unit vector `dir` before it touches `fixed` (Infinity if never; they must not overlap). */
function slideDistance(moving: Vec2[], fixed: Vec2[], dir: Vec2): number {
  let best = Infinity;
  const ray = (origin: Vec2, d: Vec2, polygon: Vec2[]) => {
    for (let i = 0; i < polygon.length; i++) {
      const a = polygon[i] as Vec2, b = polygon[(i + 1) % polygon.length] as Vec2;
      const e: Vec2 = [b[0] - a[0], b[1] - a[1]];
      const den = d[0] * e[1] - d[1] * e[0];
      if (Math.abs(den) < 1e-12) continue;
      const w: Vec2 = [a[0] - origin[0], a[1] - origin[1]];
      const s = (w[0] * e[1] - w[1] * e[0]) / den, k = (w[0] * d[1] - w[1] * d[0]) / den;
      if (s >= 0 && k >= 0 && k <= 1) best = Math.min(best, s);
    }
  };
  for (const point of moving) ray(point, dir, fixed);
  for (const point of fixed) ray(point, [-dir[0], -dir[1]], moving);
  return best;
}
export const placeProfile = (placement: Placement2D, profile: Vec2[]): Vec2[] => profile.map(point => placePoint(placement, point));
const placed = placeProfile;

/** A plate's section, in its own (y, z): `front`..`back` by 0..`height`, the front's edges rounded (the plates are hulls of spheres). */
function plateSection(front: number, back: number, height: number, r: number): Vec2[] {
  const arc = (cz: number, from: number, to: number): Vec2[] => Array.from({ length: 13 }, (_, i) => {
    const a = (from + (to - from) * i / 12) * DEG;
    return [front + r - r * Math.cos(a), cz + r * Math.sin(a)];
  });
  return [[back, 0], [back, height], ...arc(height - r, 90, 0), ...arc(r, 0, -90)];
}
/** The plates' sections in their own frames (y, z). */
export const BASE_PLATE_SECTION = plateSection(G.base.front, G.base.back, G.base.height, G.base.edgeRadius);
export const CATCH_PLATE_SECTION = plateSection(G.catch.front, G.catch.back, G.catch.height, G.catch.edgeRadius);
const BASE_PLATE = placed(BASE_PLACEMENT, BASE_PLATE_SECTION);

/**
 * The taut link at lever angle `angle`, its bar hooked behind the catch's hook: the catch's offset and the link's direction, for a
 * link direction near `near`. The catch is pulled away from the base as far as the link lets it (that pull is what the latch
 * holds), and the link turns freely on the lever's pins: for each direction, the catch slides away until its hook meets the link's
 * bar or its plate meets the link's side bars, and the link takes the direction that lets it go furthest. Undefined where no
 * direction near `near` keeps the bar on the hook.
 */
export function hookedLink(angle: number, near: number): { offset: number; linkAngle: number } | undefined {
  const pin = pinAt(angle);
  const hook = placed(catchPlacement(0), TOGGLE_LATCH_PROFILES.catchHook), plate = placed(catchPlacement(0), CATCH_PLATE_SECTION);
  const offsetFor = (linkAngle: number): number => {
    const link = linkPlacement(pin, linkAngle);
    const bar = placed(link, TOGGLE_LATCH_PROFILES.linkBar), side = placed(link, TOGGLE_LATCH_PROFILES.linkSide);
    if (polygonsOverlap(hook, bar) || polygonsOverlap(plate, side)) return Infinity;
    const travel = Math.min(slideDistance(hook, bar, [-1, 0]), slideDistance(plate, side, [-1, 0]));
    return travel > 20 ? Infinity : -travel;
  };
  // golden-section search for the lowest offset within 4 degrees of `near`
  let [lo, hi] = [near - 4, near + 4];
  const g = (Math.sqrt(5) - 1) / 2;
  let [x1, x2] = [hi - g * (hi - lo), lo + g * (hi - lo)];
  let [f1, f2] = [offsetFor(x1), offsetFor(x2)];
  for (let i = 0; i < 40; i++) {
    if (f1 <= f2) { hi = x2; x2 = x1; f2 = f1; x1 = hi - g * (hi - lo); f1 = offsetFor(x1); }
    else { lo = x1; x1 = x2; f1 = f2; x2 = lo + g * (hi - lo); f2 = offsetFor(x2); }
  }
  const linkAngle = (lo + hi) / 2, offset = offsetFor(linkAngle);
  if (!Number.isFinite(offset) || linkAngle < near - 3.9 || linkAngle > near + 3.9) return undefined;
  return { offset, linkAngle };
}

/**
 * The hooked, taut link every half degree of lever from `from` (well before the closed lever) to past `RELEASED`, following the
 * link's direction from the link lying along the pull (lever at 0) both ways: the catch's offset and the link's direction. Listed
 * rather than computed when the module loads (it takes a second); a test keeps it equal to `computeHookedTable()`.
 */
export const TOGGLE_LATCH_HOOKED = {
  from: -14, step: 0.5,
  offsets: [
    -1.49457, -1.47674, -1.45929, -1.44223, -1.42554, -1.40924, -1.39332, -1.37778, -1.36262, -1.34783, -1.33343, -1.3194,
    -1.30575, -1.29247, -1.27957, -1.26592, -1.25263, -1.23971, -1.22715, -1.21497, -1.20316, -1.19172, -1.18065, -1.16995,
    -1.15962, -1.14966, -1.14008, -1.13086, -1.12201, -1.11353, -1.10542, -1.09652, -1.0877, -1.07925, -1.07117, -1.06346,
    -1.05613, -1.04916, -1.04257, -1.03635, -1.0305, -1.02503, -1.01993, -1.01521, -1.01086, -1.00689, -1.0033, -1.00008,
    -0.99725, -0.99479, -0.99272, -0.99102, -0.98971, -0.98878, -0.98824, -0.98808, -0.98831, -0.98893, -0.98994, -0.99134,
    -0.99313, -0.99532, -0.9979, -1.00088, -1.00426, -1.00803, -1.01221, -1.01679, -1.02178, -1.02717, -1.03297, -1.03918,
    -1.0458, -1.05284, -1.06029, -1.06816, -1.07646, -1.08517, -1.09431, -1.10387, -1.11387, -1.12429, -1.13515, -1.14644,
    -1.15818, -1.17035, -1.18297, -1.19603, -1.20951, -1.22333, -1.23763, -1.25242, -1.26757, -1.28263, -1.29731, -1.31226,
    -1.32779, -1.32411, -1.31635, -1.30947, -1.30348, -1.29837, -1.29416, -1.29083, -1.2884, -1.28686, -1.28621, -1.28647,
    -1.28762, -1.28968, -1.29842, -1.31392, -1.32989, -1.34633, -1.36325, -1.38064, -1.39852, -1.41689, -1.43575, -1.45912,
    -1.48722, -1.51607, -1.54565, -1.57598, -1.60705, -1.63886, -1.67141, -1.70471, -1.73875, -1.77354, -1.80907, -1.84486,
    -1.88087, -1.91764, -1.95515, -1.99342, -2.03245, -2.07223, -2.11276, -2.15405, -2.19609, -2.23888, -2.28242, -2.32672,
    -2.37177, -2.41757, -2.46412, -2.51142, -2.55946, -2.60826, -2.65781, -2.7081, -2.75913, -2.81091, -2.86344, -2.9182,
    -2.9747],
  linkAngles: [
    -181.91791, -181.71091, -181.5035, -181.2957, -181.08752, -180.87898, -180.67008, -180.46083, -180.25126, -180.04136,
    -179.83115, -179.62065, -179.40985, -179.19879, -178.98746, -178.77328, -178.55881, -178.34408, -178.1291, -177.9139,
    -177.69847, -177.48284, -177.26701, -177.051, -176.83481, -176.61846, -176.40196, -176.18531, -175.96854, -175.75166,
    -175.53466, -175.31959, -175.10491, -174.89014, -174.67528, -174.46035, -174.24536, -174.03031, -173.81523, -173.60013,
    -173.385, -173.16987, -172.95475, -172.73965, -172.52458, -172.30955, -172.09458, -171.87967, -171.66484, -171.4501,
    -171.23546, -171.02094, -170.80654, -170.59228, -170.37816, -170.16421, -169.95044, -169.73685, -169.52346, -169.31028,
    -169.09733, -168.88461, -168.67214, -168.45993, -168.248, -168.03636, -167.82501, -167.61398, -167.40328, -167.19292,
    -166.98291, -166.77327, -166.564, -166.35514, -166.14667, -165.93863, -165.73103, -165.52387, -165.31718, -165.11096,
    -164.90523, -164.70001, -164.49531, -164.29115, -164.08753, -163.88448, -163.682, -163.48012, -163.27888, -163.0784,
    -162.87853, -162.67927, -162.48034, -162.28051, -162.0791, -161.87779, -161.67744, -161.50207, -161.33348, -161.16568,
    -160.9987, -160.83255, -160.66724, -160.50278, -160.3392, -160.1765, -160.01471, -159.85383, -159.69388, -159.53488,
    -159.37718, -159.2208, -159.06538, -158.91095, -158.75751, -158.60509, -158.45369, -158.30334, -158.15404, -158.00605,
    -157.8594, -157.71386, -157.56946, -157.4262, -157.28411, -157.14319, -157.00346, -156.86494, -156.72764, -156.59158,
    -156.45676, -156.32318, -156.19084, -156.0598, -155.93007, -155.80166, -155.67459, -155.54887, -155.42452, -155.30155,
    -155.17997, -155.0598, -154.94105, -154.82374, -154.70788, -154.59349, -154.48057, -154.36915, -154.25923, -154.15083,
    -154.04396, -153.93863, -153.83487, -153.73268, -153.63207, -153.53315, -153.4359],
};
export function computeHookedTable(): typeof TOGGLE_LATCH_HOOKED {
  const { from, step } = TOGGLE_LATCH_HOOKED;
  const to = 64;
  const pin = pinAt(0);
  const start = hookedLink(0, angleOf([-Math.sqrt(COUPLER ** 2 - (DIP_V - pin[1]) ** 2), DIP_V - pin[1]]));
  if (!start) throw new Error('The toggle latch\'s link does not hook on the catch.');
  const rows = new Map<number, { offset: number; linkAngle: number }>([[0, start]]);
  for (const direction of [-1, 1]) {
    let last = start.linkAngle;
    for (let angle = direction * step; angle >= from - 1e-9 && angle <= to + 1e-9; angle += direction * step) {
      const hooked = hookedLink(angle, last);
      if (!hooked) throw new Error(`The toggle latch's link leaves the hook at ${angle} degrees.`);
      rows.set(Math.round(angle / step), hooked); last = hooked.linkAngle;
    }
  }
  const keys = [...rows.keys()].sort((x, y) => x - y);
  const round = (value: number) => Math.round(value * 1e5) / 1e5;
  return { from, step, offsets: keys.map(key => round(rows.get(key)?.offset ?? NaN)), linkAngles: keys.map(key => round(rows.get(key)?.linkAngle ?? NaN)) };
}
/** The lever angles the table covers. */
export const HOOK_RANGE: [number, number] = [TOGGLE_LATCH_HOOKED.from, TOGGLE_LATCH_HOOKED.from + (TOGGLE_LATCH_HOOKED.offsets.length - 1) * TOGGLE_LATCH_HOOKED.step];

/** The taut link at lever angle `angle` (interpolated in the table): the catch's offset and the link's direction. */
export function tautLink(angle: number): { offset: number; linkAngle: number } {
  const { from, step, offsets, linkAngles } = TOGGLE_LATCH_HOOKED;
  const at = (angle - from) / step;
  if (at < -1e-9 || at > offsets.length - 1 + 1e-9) throw new Error(`The toggle latch's link is not on the hook at ${angle} degrees.`);
  const i = Math.max(0, Math.min(offsets.length - 2, Math.floor(at))), f = at - i;
  const lerp = (values: number[]) => (values[i] ?? NaN) + ((values[i + 1] ?? NaN) - (values[i] ?? NaN)) * f;
  return { offset: lerp(offsets), linkAngle: lerp(linkAngles) };
}

/** The lever angle at which the taut link draws the catch in closest: the dead centre, past which the pull turns the lever on. */
export const DEAD_CENTRE = (() => {
  const { from, step, offsets } = TOGGLE_LATCH_HOOKED;
  const best = offsets.indexOf(Math.max(...offsets));
  return from + best * step;
})();

/** The lever's and the taut link's profiles at lever angle `angle`. */
function movingProfiles(angle: number): Vec2[][] {
  const lever = leverPlacement(angle);
  const link = linkPlacement(pinAt(angle), tautLink(angle).linkAngle);
  const P = TOGGLE_LATCH_PROFILES;
  return [placed(lever, P.leverSide), placed(lever, P.leverBridge), placed(link, P.linkSide), placed(link, P.linkBar)];
}

/** The closed lever's angle: turned on past the dead centre until the lever or the link comes to lie on the base's plate (the link does). */
export const CLOSED = (() => {
  const touches = (angle: number) => movingProfiles(angle).some(profile => polygonsOverlap(profile, BASE_PLATE));
  if (touches(DEAD_CENTRE)) throw new Error('The toggle latch touches its base at the dead centre.');
  let [free, stopped] = [DEAD_CENTRE, HOOK_RANGE[0]];
  if (!touches(stopped)) throw new Error('The toggle latch never comes to rest on its base.');
  for (let i = 0; i < 40; i++) { const mid = (free + stopped) / 2; if (touches(mid)) stopped = mid; else free = mid; }
  return free;
})();

/** The lever angle at which the opening link goes slack and the catch stops (it stays there until the link draws it in again). */
export const RELEASED = 60;
/** The open lever: turned back until it comes to rest on the released catch's hook. */
export const OPEN = (() => {
  const { offset } = tautLink(RELEASED);
  const hook = placed(catchPlacement(offset), TOGGLE_LATCH_PROFILES.catchHook);
  const touches = (angle: number) => [TOGGLE_LATCH_PROFILES.leverSide, TOGGLE_LATCH_PROFILES.leverBridge]
    .some(profile => polygonsOverlap(placed(leverPlacement(angle), profile), hook));
  let [free, stopped] = [RELEASED, 180];
  if (touches(free) || !touches(stopped)) throw new Error('The toggle latch\'s open lever does not come to rest on the catch.');
  for (let i = 0; i < 40; i++) { const mid = (free + stopped) / 2; if (touches(mid)) stopped = mid; else free = mid; }
  return free;
})();
/** How far the link swings up about the lever's pins, from its hooked direction, to come off the hook. */
export const SWING = 62;

const RELEASED_LINK = tautLink(RELEASED);

/** One state of the latch: the lever at `angle`, the link swung up by `swing` degrees (0 = on the hook). */
export interface LatchState {
  lever: Placement2D; link: Placement2D; catch: Placement2D;
  /** The catch's offset: the gap between the plates is -offset. */
  offset: number;
  pin: Vec2;
  /** Whether the link is pulling the catch in. */
  taut: boolean;
}

/**
 * The latch with the lever at `angle` (degrees, from +u towards +v about the pivot; `CLOSED` .. `OPEN`) and the link swung up by
 * `swing` (0 on the hook). Up to `RELEASED` the taut link drives the catch; beyond it the catch rests where the link left it, and
 * the slack link rides on the lever's pins, keeping its direction, until it is swung.
 */
export function latchState(angle: number, swing = 0): LatchState {
  const pin = pinAt(angle);
  const taut = angle <= RELEASED;
  const { offset, linkAngle } = taut ? tautLink(angle) : RELEASED_LINK;
  return {
    lever: leverPlacement(angle), link: linkPlacement(pin, linkAngle - swing), catch: catchPlacement(offset), offset, pin,
    taut: taut && swing === 0,
  };
}

/**
 * The movements the latch makes, in order, from released (the lever open, the link swung up off the hook). Each is a lever
 * movement (`angle` from .. to) or a swing of the link (`swing` from .. to). The 3D preview plays them after the assembly's steps;
 * the card's side view loops `TOGGLE_LATCH_CYCLE`.
 */
export interface LatchMovement { title: string; angle: [number, number]; swing: [number, number] }
export const TOGGLE_LATCH_MOVEMENTS: LatchMovement[] = [
  { title: 'Hook the link over the catch', angle: [OPEN, OPEN], swing: [SWING, 0] },
  { title: 'Close the lever: the link draws the catch in', angle: [OPEN, DEAD_CENTRE], swing: [0, 0] },
  { title: 'Over centre: the lever locks on the base', angle: [DEAD_CENTRE, CLOSED], swing: [0, 0] },
  { title: 'Open: back over centre, the catch is released', angle: [CLOSED, OPEN], swing: [0, 0] },
  { title: 'Close again: over centre and locked', angle: [OPEN, CLOSED], swing: [0, 0] },
];
/**
 * The card's loop, from locked: open (back over centre, releasing the catch), unhook, hook, close (over centre), then a pause
 * locked, each with its share of time. It starts moving at once, so that the card answers a hover straight away.
 */
export const TOGGLE_LATCH_CYCLE: (LatchMovement & { time: number })[] = [
  { title: 'Open', angle: [CLOSED, OPEN], swing: [0, 0], time: 0.22 },
  { title: 'Unhook', angle: [OPEN, OPEN], swing: [0, SWING], time: 0.12 },
  { title: 'Released', angle: [OPEN, OPEN], swing: [SWING, SWING], time: 0.06 },
  { title: 'Hook', angle: [OPEN, OPEN], swing: [SWING, 0], time: 0.12 },
  { title: 'Close', angle: [OPEN, CLOSED], swing: [0, 0], time: 0.36 },
  { title: 'Locked', angle: [CLOSED, CLOSED], swing: [0, 0], time: 0.12 },
];

const smooth = (x: number) => x * x * (3 - 2 * x);
const easeOut = (x: number) => 1 - (1 - x) ** 3;
/** The latch `t` (0..1) of the way through `TOGGLE_LATCH_CYCLE`, each movement eased: in and out, but the first only out, so that it
 * moves from the first frame, as a hover transition does. */
export function latchCycleState(t: number): LatchState & { title: string } {
  const total = TOGGLE_LATCH_CYCLE.reduce((sum, movement) => sum + movement.time, 0);
  let at = (((t % 1) + 1) % 1) * total;
  for (const movement of TOGGLE_LATCH_CYCLE) {
    if (at <= movement.time || movement === TOGGLE_LATCH_CYCLE.at(-1)) {
      const f = (movement === TOGGLE_LATCH_CYCLE[0] ? easeOut : smooth)(Math.min(1, at / movement.time));
      return { ...latchState(movement.angle[0] + (movement.angle[1] - movement.angle[0]) * f, movement.swing[0] + (movement.swing[1] - movement.swing[0]) * f), title: movement.title };
    }
    at -= movement.time;
  }
  throw new Error('unreachable');
}

// ---- 3D poses ---------------------------------------------------------------------------------------------------------------

/** A part's pose in the assembly's frame: x across the latch (0 in its middle), y = u, z = v. As `Assembly.poses`. */
export interface LatchPose { position: [number, number, number]; rotation: [number, number, number] }

/**
 * The 3D pose of a part whose side profile lies in its frame's axes `profile` (indices) and whose width runs along `width`, placed
 * in the plane by `placement`. The width axis is turned over where the placement mirrors the profile, so that the pose is a rotation.
 */
function pose3D(placement: Placement2D, profile: [number, number], width: number, middle: number): LatchPose {
  const R = [[0, 0, 0], [0, 0, 0], [0, 0, 0]] as [number[], number[], number[]];
  const { m, t } = placement;
  R[1][profile[0]] = m[0]; R[1][profile[1]] = m[1];
  R[2][profile[0]] = m[2]; R[2][profile[1]] = m[3];
  R[0][width] = 1;
  const det = (M: number[][]) => (M[0]?.[0] ?? 0) * ((M[1]?.[1] ?? 0) * (M[2]?.[2] ?? 0) - (M[1]?.[2] ?? 0) * (M[2]?.[1] ?? 0))
    - (M[0]?.[1] ?? 0) * ((M[1]?.[0] ?? 0) * (M[2]?.[2] ?? 0) - (M[1]?.[2] ?? 0) * (M[2]?.[0] ?? 0))
    + (M[0]?.[2] ?? 0) * ((M[1]?.[0] ?? 0) * (M[2]?.[1] ?? 0) - (M[1]?.[1] ?? 0) * (M[2]?.[0] ?? 0));
  const sign = det(R) > 0 ? 1 : -1;
  R[0][width] = sign;
  // Rz(c) Ry(b) Rx(a), applied about X, then Y, then Z
  const r20 = Math.max(-1, Math.min(1, R[2][0] ?? 0));
  const b = Math.asin(-r20);
  let a: number, c: number;
  if (Math.abs(r20) < 1 - 1e-9) { a = Math.atan2(R[2][1] ?? 0, R[2][2] ?? 0); c = Math.atan2(R[1][0] ?? 0, R[0][0] ?? 0); }
  else { a = 0; c = Math.atan2(-(R[0][1] ?? 0), R[1][1] ?? 0); }
  const round = (value: number) => Math.round(value * 1e4) / 1e4 + 0;
  return { position: [round(-sign * middle), round(t[0]), round(t[1])], rotation: [round(a / DEG), round(b / DEG), round(c / DEG)] };
}

/** The four parts' poses for this state of the latch. */
export function latchPoses(state: LatchState): Record<'base' | 'lever' | 'link' | 'catch', LatchPose> {
  return {
    base: pose3D(BASE_PLACEMENT, [1, 2], 0, G.base.middle),
    lever: pose3D(state.lever, [0, 2], 1, G.lever.middle),
    link: pose3D(state.link, [0, 2], 1, G.link.middle),
    catch: pose3D(state.catch, [1, 2], 0, G.catch.middle),
  };
}

// ---- physics -------------------------------------------------------------------------------------------------------------------

/**
 * Each part's convex collision pieces, in its own frame, from the profiles above and the extents its SCAD file extrudes them over
 * (docs/physics-plan.md, "Collision geometry"): the plates (their sections across their length), the base's knuckle and the
 * catch's hook (across their own lengths, clipped as the SCAD files clip them), and the lever's and link's side plates and bridges
 * (across their widths). Left out: the pivot and pin holes, the pins and the screw holes, where ideal joints (whose bodies do not
 * collide) hold the parts; the 0.6 mm chamfers of the side plates' outer faces and the hook's 1 mm end chamfers (the hook is
 * extruded only between them), which only make a piece smaller than the part.
 */
export function toggleLatchPieces(): Record<'base' | 'lever' | 'link' | 'catch', number[][]> {
  const clip = (height: number, front: number) => (polygon: readonly Vec2[]) => clipToBox(polygon, [-1, -1], [front + 2, height + 1]);
  const L = G.lever, K = G.link;
  return {
    base: [
      ...extrudedPieces(BASE_PLATE_SECTION, [1, 2], 0, G.base.length),
      ...convexParts(TOGGLE_LATCH_PROFILES.baseKnuckle).map(clip(G.base.height, G.base.front)).flatMap(part => extrudedPieces(part, [1, 2], G.base.knuckle[0], G.base.knuckle[1])),
    ],
    catch: [
      ...extrudedPieces(CATCH_PLATE_SECTION, [1, 2], 0, G.catch.length),
      ...convexParts(TOGGLE_LATCH_PROFILES.catchHook).map(clip(G.catch.height, G.catch.front)).flatMap(part => extrudedPieces(part, [1, 2], G.catch.hook[0] + 1, G.catch.hook[1] - 1)),
    ],
    lever: [
      ...extrudedPieces(TOGGLE_LATCH_PROFILES.leverSide, [0, 2], L.pinLength, L.pinLength + L.side),
      ...extrudedPieces(TOGGLE_LATCH_PROFILES.leverSide, [0, 2], L.width - L.pinLength - L.side, L.width - L.pinLength),
      ...extrudedPieces(TOGGLE_LATCH_PROFILES.leverBridge, [0, 2], L.pinLength + L.side, L.width - L.pinLength - L.side),
    ],
    link: [
      ...extrudedPieces(TOGGLE_LATCH_PROFILES.linkSide, [0, 2], 0, K.side),
      ...extrudedPieces(TOGGLE_LATCH_PROFILES.linkSide, [0, 2], K.width - K.side, K.width),
      ...extrudedPieces(TOGGLE_LATCH_PROFILES.linkBar, [0, 2], K.side, K.width - K.side),
    ],
  };
}

/** The convex polygon clipped to the box from `min` to `max` (Sutherland–Hodgman); empty when nothing is left. */
function clipToBox(polygon: readonly Vec2[], min: Vec2, max: Vec2): Vec2[] {
  let points = [...polygon];
  const edges: [(p: Vec2) => number, number][] = [[p => p[0] - min[0], 0], [p => max[0] - p[0], 0], [p => p[1] - min[1], 1], [p => max[1] - p[1], 1]];
  for (const [inside] of edges) {
    const next: Vec2[] = [];
    points.forEach((p, i) => {
      const q = points[(i + 1) % points.length] ?? p;
      const [a, b] = [inside(p), inside(q)];
      if (a >= 0) next.push(p);
      if ((a >= 0) !== (b >= 0)) { const f = a / (a - b); next.push([p[0] + (q[0] - p[0]) * f, p[1] + (q[1] - p[1]) * f]); }
    });
    points = next;
  }
  return points;
}

/**
 * The latch's mechanism for the physics subsystem, starting closed and hooked (`CLOSED`): the base fixed; the lever on an ideal hinge
 * on the base's pivot; the link on an ideal hinge on the lever's pins; the catch on an ideal slide along the pull (u), as the part it is
 * screwed to would carry it. The link holds the catch only by contact: its nose in the dip under the hook, its side bars on the base's
 * plate. Joint values are degrees and mm from closed; the slide and the hinges are damped quasi-statically. The scenarios check the
 * over-centre lock under a pull, and that turning the lever draws the catch in to `DEAD_CENTRE` and lets it go by `RELEASED` as the
 * mechanism's table says.
 */
export function toggleLatchPhysics(): PhysicsSpec {
  const closed = latchState(CLOSED);
  const poses = latchPoses(closed);
  const pieces = toggleLatchPieces();
  const axis = [1, 0, 0];
  const anchor = (point: Vec2) => [0, point[0], point[1]];
  // the catch's travel (+u, mm) from closed, as the mechanism's table gives it
  const drawn = (angle: number) => latchState(angle).offset - closed.offset;
  const pull = 10;
  const hinge = { damping: 0.05 };
  return {
    poses,
    bodies: [
      { id: 'base', material: 'petg', fixed: true, collision: { kind: 'pieces', pieces: pieces.base } },
      { id: 'lever', material: 'petg', collision: { kind: 'pieces', pieces: pieces.lever }, joint: { type: 'hinge', parent: 'base', anchor: anchor(PIVOT), axis, ...hinge } },
      { id: 'link', material: 'petg', collision: { kind: 'pieces', pieces: pieces.link }, joint: { type: 'hinge', parent: 'lever', anchor: anchor(closed.pin), axis, ...hinge } },
      { id: 'catch', material: 'petg', collision: { kind: 'pieces', pieces: pieces.catch }, joint: { type: 'slide', anchor: [0, 0, 0], axis: [0, 1, 0], damping: pull * QUASI_STATIC } },
    ],
    scenarios: [
      {
        id: 'locked', title: `Closed and pulled with ${pull} N, the latch stays locked`, duration: 0.6,
        drives: [{ kind: 'force', body: 'catch', point: poses.catch.position, force: [0, -pull, 0], from: 0, to: 0.6 }],
        checks: [
          { kind: 'joint', at: 0.6, body: 'lever', min: -1, max: 1 },
          { kind: 'joint', at: 0.6, body: 'catch', min: -0.05, max: 0.05 },
          { kind: 'contact', at: 0.6, bodies: ['link', 'catch'], touching: true },
        ],
      },
      {
        id: 'draws-in', title: `Turned to dead centre against a ${pull} N pull, the lever draws the catch in ${drawn(DEAD_CENTRE).toFixed(2)} mm`, duration: 1,
        drives: [
          { kind: 'force', body: 'catch', point: poses.catch.position, force: [0, -pull, 0], from: 0, to: 1 },
          { kind: 'joint', body: 'lever', timeline: [[0, 0], [0.6, DEAD_CENTRE - CLOSED]] },
        ],
        checks: [
          { kind: 'joint', at: 1, body: 'catch', min: drawn(DEAD_CENTRE) - 0.03, max: drawn(DEAD_CENTRE) + 0.03 },
          { kind: 'contact', at: 1, bodies: ['link', 'catch'], touching: true },
        ],
      },
      {
        id: 'releases', title: `Opened to ${RELEASED}°, the catch is let go ${(-drawn(RELEASED)).toFixed(2)} mm`, duration: 1.2,
        drives: [
          { kind: 'force', body: 'catch', point: poses.catch.position, force: [0, -pull, 0], from: 0, to: 1.2 },
          { kind: 'joint', body: 'lever', timeline: [[0, 0], [0.8, RELEASED - CLOSED]] },
        ],
        checks: [{ kind: 'joint', at: 1.2, body: 'catch', min: drawn(RELEASED) - 0.05, max: drawn(RELEASED) + 0.05 }],
      },
    ],
  };
}
