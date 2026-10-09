import type { PhysicsSpec } from './physics.ts';
import { clipConvex, extrudedPieces, offsetConvex, wallPieces, type Point2 } from './physicsPieces.ts';

/**
 * The cigarette case's lighter in its round bay, for the physics subsystem (docs/physics-plan.md, docs/cigarette-case-assembly.md):
 * the box fixed; the mini holder on an ideal slide up the round bay, its upper limit the clip tab that stops it, held by friction;
 * the BIC Mini lighter free. Its scenarios are the orientation the push-out depends on: upright, the lighter rests on the tab;
 * turned over about X (wheel side towards the tab), its hood passes the tab and pushes the holder out until the lever lands on the
 * tab; turned over about Y (the hood's front end towards the tab), it lands on the tab and nothing moves.
 *
 * The values below are the SCAD files' (a test keeps them equal): the lighter's from parts/everyday-objects/bic-j25-mini-lighter.scad,
 * the box's from models/cigarette-case/reference/11_v11.3__-_honeycomb_-_box.scad and the holder's from its minibox file. Every body
 * has exact convex pieces from them: a decomposition of the holder's mesh reached up into the lighter resting above it.
 */
export const BIC_J25 = {
  height: 62, width: 22, thickness: 11, profileN: 2.5, bodyH: 50, baseRound: 1.5, topRound: 1, hoodWall: 0.4, hoodZ0: 50 - 1.5,
  wheelD: 7.4, wheelY: 1, leverW: 6.4, leverY: [3.4, 9] as Point2, leverTop: 50 + 5,
  /** The lighter's mass, BIC's own figure (BIC Graphic, product 3460002360: 13 g). */
  mass: 13,
} as const;

export const CIGARETTE_BOX = {
  topZ: 77.171, tabChord: -6.32, holderBayX: -16.84, lighterLead: 0.4,
  /** The lowest of the tab's traced slices, and its top (the last slice's height plus TAB_STEP). */
  tabBottom: 32.31, tabTop: 34.91 + 0.2,
  /** The holder's dome top and the round bay's traced outline (BAY_ROUND, about the box's centre). */
  bayRound: [[-13.813, -10.401], [-14.397, -10.8], [-15.128, -11.136], [-15.685, -11.294], [-16.483, -11.401],
    [-17.191, -11.401], [-17.989, -11.294], [-18.546, -11.136], [-19.277, -10.8], [-19.85, -10.41], [-20.283, -10.016],
    [-20.806, -9.393], [-21.123, -8.908], [-21.497, -8.188], [-21.84, -7.326], [-22.11, -6.428], [-22.334, -5.426],
    [-22.558, -3.928], [-22.676, -2.548], [-22.732, -1.035], [-22.727, 1.236], [-22.662, 2.748], [-22.558, 3.903],
    [-22.358, 5.274], [-22.111, 6.398], [-21.766, 7.508], [-21.398, 8.373], [-20.934, 9.183], [-20.447, 9.818],
    [-19.861, 10.376], [-19.277, 10.775], [-18.546, 11.111], [-17.989, 11.269], [-17.416, 11.359], [-16.837, 11.388],
    [-16.258, 11.359], [-15.685, 11.269], [-15.128, 11.111], [-14.595, 10.884], [-14.096, 10.589], [-13.657, 10.246],
    [-13.23, 9.821], [-12.868, 9.369], [-12.551, 8.883], [-12.276, 8.373], [-11.952, 7.625], [-11.722, 6.959],
    [-11.509, 6.188], [-11.34, 5.401], [-11.188, 4.479], [-11.057, 3.326], [-10.978, 2.169], [-10.94, 0.785],
    [-10.942, -1.035], [-10.99, -2.42], [-11.091, -3.695], [-11.24, -4.854], [-11.383, -5.647], [-11.659, -6.773],
    [-11.834, -7.326], [-12.177, -8.188], [-12.551, -8.908], [-12.868, -9.393], [-13.227, -9.843]] as Point2[],
} as const;

/** The mini holder's dome (models/cigarette-case/reference/11_-_Honeycomb_-_minibox.scad, DOME_OUT): [z, scale of its outline]. */
export const HOLDER_DOME: readonly Point2[] = [[29.4, 1], [29.65, 0.965], [29.9, 0.957], [30.15, 0.944], [30.4, 0.924], [30.65, 0.898], [30.9, 0.865], [31.15, 0.823],
  [31.4, 0.772], [31.65, 0.71], [31.9, 0.633], [32.15, 0.535], [32.4, 0.401], [32.65, 0.155], [32.695, 0.02]];

const L = BIC_J25;

/** The lighter's plan (superellipse), inset by d: as plan() in its SCAD file, with fewer steps. */
export function lighterPlan(d = 0, steps = 48): Point2[] {
  return Array.from({ length: steps }, (_, i) => {
    const t = 2 * Math.PI * i / steps, c = Math.cos(t), s = Math.sin(t);
    return [(L.thickness / 2 - d) * Math.sign(c) * Math.abs(c) ** (2 / L.profileN), (L.width / 2 - d) * Math.sign(s) * Math.abs(s) ** (2 / L.profileN)];
  });
}

/** Half the plan's extent across X at y, inset by d: where the hood's cheeks are (plan_x). */
const planX = (y: number, d = 0) => (L.thickness / 2 - d) * Math.max(0, 1 - (Math.abs(y) / (L.width / 2 - d)) ** L.profileN) ** (1 / L.profileN);

/**
 * The lighter as convex pieces, in its own frame (underside on z = 0, width along Y, the wheel side +Y): its body (the hull of
 * its inset plans, as the SCAD file builds it), its hood with the wheel inside it (the body's plan carried up, cut to the hood's
 * side profile: a hull of the front end's edge, the shoulder at the wheel and a circle round the wheel), and its lever. Left out:
 * the hood's open rear between the cheeks (the wheel fills it) and the flame slot.
 */
export function lighterPieces(): number[][] {
  const arc = [0, 15, 30, 45, 60, 75, 90].map(a => a * Math.PI / 180);
  const body = arc.flatMap(a => [
    ...lighterPlan(L.baseRound * (1 - Math.cos(a))).flatMap(([x, y]) => [x, y, L.baseRound * (1 - Math.sin(a))]),
    ...lighterPlan(L.topRound * (1 - Math.cos(a))).flatMap(([x, y]) => [x, y, L.bodyH - L.topRound * (1 - Math.sin(a))]),
  ]);
  // the hood's side profile (y, z): its corners, and the circle round the wheel, clipped to the hood's top and to the shoulder
  const wheelZ = L.height - L.wheelD / 2, r = (L.wheelD + 2 * L.hoodWall + 0.6) / 2;
  const circle: Point2[] = Array.from({ length: 24 }, (_, i) => [L.wheelY + r * Math.cos(2 * Math.PI * i / 24), wheelZ + r * Math.sin(2 * Math.PI * i / 24)]);
  let profile: Point2[] = convexHull2([[-L.width / 2, L.hoodZ0], [-L.width / 2, L.height], [L.wheelY, L.hoodZ0], ...circle]);
  profile = clipConvex(clipConvex(clipConvex(profile, [0, 1, L.height]), [0, -1, -L.hoodZ0]), [1, 0, L.width / 2]);
  // the hood: at each of its profile's points, across X to the plan's edge at that y
  const hood = profile.flatMap(([y, z]) => [-1, 1].flatMap(side => [side * planX(y), y, z]));
  // and along its top and bottom edges, so that the plan's curve is followed between the profile's corners
  const ys = Array.from({ length: 25 }, (_, i) => -L.width / 2 + (Math.min(L.width / 2, L.wheelY + r) + L.width / 2) * i / 24);
  for (const y of ys) {
    const [low, high] = verticalSpan(profile, y);
    if (low === undefined || high === undefined) continue;
    for (const z of [low, high]) for (const side of [-1, 1]) hood.push(side * planX(y), y, z);
  }
  const lever: Point2[] = [[L.leverY[0], L.bodyH - 0.5], [L.leverY[1], L.bodyH - 0.5], [L.leverY[1], L.bodyH + 2.5], [L.leverY[0] + 1.6, L.leverTop], [L.leverY[0], L.leverTop]];
  return [body, hood, ...extrudedPieces(lever, [1, 2], -L.leverW / 2, L.leverW / 2)];
}

/** The lowest and highest z of a convex polygon (y, z) at y. */
function verticalSpan(polygon: readonly Point2[], y: number): [number | undefined, number | undefined] {
  const zs: number[] = [];
  polygon.forEach((p, i) => {
    const q = polygon[(i + 1) % polygon.length] ?? p;
    if ((p[0] - y) * (q[0] - y) > 0 || p[0] === q[0]) return;
    zs.push(p[1] + (q[1] - p[1]) * (y - p[0]) / (q[0] - p[0]));
  });
  return zs.length > 0 ? [Math.min(...zs), Math.max(...zs)] : [undefined, undefined];
}

/** The convex hull of 2D points, counter-clockwise (Andrew's monotone chain). */
function convexHull2(points: readonly Point2[]): Point2[] {
  const sorted = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o: Point2, a: Point2, b: Point2) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const half = (list: Point2[]) => list.reduce<Point2[]>((hull, p) => {
    while (hull.length >= 2 && cross(hull[hull.length - 2] ?? p, hull[hull.length - 1] ?? p, p) <= 0) hull.pop();
    hull.push(p);
    return hull;
  }, []);
  const lower = half(sorted), upper = half([...sorted].reverse());
  return [...lower.slice(0, -1), ...upper.slice(0, -1)];
}

/**
 * The box round the lighter, as convex pieces in its own frame: the round bay's wall (BAY_ROUND) up to the tab's top, the fitted bay's
 * wall above it (the lighter's plan pushed out by the clearance; the 0.4 mm loft between them left out), and the tab as a block from
 * its lowest slice to its top, across the bay beyond its chord. The block fills the tab's underside, where the holder's dome sits; the
 * holder does not collide with the box (its slide's upper limit is the tab), only the lighter does.
 */
export function cigaretteBoxPieces(clearance: number): number[][] {
  const B = CIGARETTE_BOX;
  const bay = offsetConvex(lighterPlan(0, 96), clearance).map(([x, y]): Point2 => [x + B.holderBayX, y]);
  const tab = clipConvex([...B.bayRound].reverse(), [0, 1, B.tabChord]);
  return [
    ...wallPieces(B.bayRound, 1, 0, B.tabTop + B.lighterLead),
    ...wallPieces(bay, 1, B.tabTop + B.lighterLead, B.topZ),
    ...extrudedPieces(tab, [0, 1], B.tabBottom, B.tabTop),
  ];
}

/**
 * The mini holder's outside as convex pieces, in its own frame (the bay's centre at the origin): the round bay pulled in by the
 * clearance, straight up to the dome, then each of the dome's scaled slices (each a frustum of that outline, so convex). Left out:
 * its window and its hollow inside, which the lighter does not reach.
 */
export function holderPieces(clearance: number): number[][] {
  const outline = offsetConvex(CIGARETTE_BOX.bayRound.map(([x, y]): Point2 => [x - CIGARETTE_BOX.holderBayX, y]), -clearance);
  const slice = (z: number, scale: number) => outline.flatMap(([x, y]) => [x * scale, y * scale, z]);
  const [first] = HOLDER_DOME;
  const pieces = [[...slice(0, 1), ...slice(first?.[0] ?? 0, 1)]];
  for (let k = 0; k + 1 < HOLDER_DOME.length; k++) {
    const [a, b] = [HOLDER_DOME[k], HOLDER_DOME[k + 1]];
    if (a && b) pieces.push([...slice(a[0], a[1]), ...slice(b[0], b[1])]);
  }
  return pieces;
}

/** Turned over about X, and about Y, with the lighter's lowest point (its hood's top) at `z`, centred over the round bay. */
const overX = (z: number) => ({ position: [CIGARETTE_BOX.holderBayX, 0, z + L.height], rotation: [180, 0, 0] });
const overY = (z: number) => ({ position: [CIGARETTE_BOX.holderBayX, 0, z + L.height], rotation: [0, 180, 0] });

/**
 * Where an upside-down lighter's lowest point is when it stops (docs/cigarette-case-assembly.md, "Upside down: the push-out"):
 * wheel side towards the tab, its lever lands on the tab at 27.34 mm after its hood met the holder's dome at 32.52 mm; hood's front
 * end towards the tab, it lands on the tab at 34.92 mm.
 */
export const LIGHTER_STOPS = { leverOnTab: 27.34, hoodOnDome: 32.52, frontOnTab: 34.92 } as const;

/**
 * How firmly the holder's friction fit holds it, in N: an assumption, not a measurement (how firmly a printed press fit holds depends
 * on the printer and the filament). It is many times the holder's weight, so that it stays put when the case is turned over, and far
 * less than a thumb pushes with.
 */
export const HOLDER_HOLD = 2;

export function cigaretteCasePhysics(clearance: number): PhysicsSpec {
  const start = 37;
  // the finger presses 0.3 mm past where the lighter should stop, so that a lighter that settles a little lower still reaches its stop
  // (the contacts take up the rest, about 1 N)
  const push = (to: number) => [[0, 0, 0, 0], [1, 0, 0, -(start - to) - 0.3], [1.4, 0, 0, -(start - to) - 0.3]];
  // The push-out, within 0.5 mm: the hood here is solid between the thumb rings, so it meets the dome's top 0.18 mm early, and the
  // lighter settles up to 0.25 mm sideways in its bay, its lever landing a little lower on the tab
  const pushOut = LIGHTER_STOPS.hoodOnDome - LIGHTER_STOPS.leverOnTab;
  const base = (z: number): number[] => [CIGARETTE_BOX.holderBayX, 0, z + L.height];
  return {
    bodies: [
      { id: 'case-box', material: 'petg', fixed: true, collision: { kind: 'pieces', pieces: cigaretteBoxPieces(clearance) } },
      { id: 'mini-holder', material: 'petg', collision: { kind: 'pieces', pieces: holderPieces(clearance) }, joint: { type: 'slide', parent: 'case-box', anchor: [CIGARETTE_BOX.holderBayX, 0, 0], axis: [0, 0, 1], range: [-40, 0], friction: HOLDER_HOLD } },
      { id: 'mini-bic-lighter', material: 'pom', mass: L.mass, collision: { kind: 'pieces', pieces: lighterPieces() } },
    ],
    scenarios: [
      {
        id: 'upright', title: 'Upright, the lighter rests on the tab, short of the holder', duration: 0.5,
        checks: [
          { kind: 'position', at: 0.5, body: 'mini-bic-lighter', axis: 2, min: -0.05, max: 0.05 },
          { kind: 'contact', at: 0.5, bodies: ['mini-bic-lighter', 'case-box'], touching: true },
          { kind: 'contact', at: 0.5, bodies: ['mini-bic-lighter', 'mini-holder'], touching: false },
          { kind: 'joint', at: 0.5, body: 'mini-holder', min: -0.01, max: 0.01 },
        ],
      },
      {
        id: 'wheel-side-to-tab', title: 'Turned over, wheel side towards the tab, it pushes the holder out until its lever lands on the tab',
        poses: { 'mini-bic-lighter': overX(start) }, duration: 1.4,
        drives: [{ kind: 'push', body: 'mini-bic-lighter', point: base(start), timeline: push(LIGHTER_STOPS.leverOnTab) }],
        checks: [
          { kind: 'joint', at: 1.4, body: 'mini-holder', min: -pushOut - 0.5, max: -pushOut + 0.5 },
          { kind: 'contact', at: 1.4, bodies: ['mini-bic-lighter', 'case-box'], touching: true },
        ],
      },
      {
        id: 'front-to-tab', title: 'Turned over the other way, the hood’s front end lands on the tab and the holder stays',
        poses: { 'mini-bic-lighter': overY(start) }, duration: 1.4,
        drives: [{ kind: 'push', body: 'mini-bic-lighter', point: base(start), timeline: push(LIGHTER_STOPS.frontOnTab) }],
        checks: [
          { kind: 'joint', at: 1.4, body: 'mini-holder', min: -0.05, max: 0.01 },
          { kind: 'contact', at: 1.4, bodies: ['mini-bic-lighter', 'case-box'], touching: true },
        ],
      },
      {
        id: 'case-upside-down', title: 'With the case upside down, the holder’s fit keeps it in', gravity: [0, 0, 1], duration: 0.5,
        checks: [{ kind: 'joint', at: 0.5, body: 'mini-holder', min: -0.01, max: 0.01 }],
      },
    ],
  };
}
