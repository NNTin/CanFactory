import { Type, type Static } from 'typebox';
import type { Assembly, ParameterIssue } from './models.ts';
import type { PhysicsBody, PhysicsCheck, PhysicsController, PhysicsCounter, PhysicsDrive, PhysicsScenario, PhysicsSpec } from './physics.ts';
import { DEFAULT_ESP32_CASE, esp32CaseAssembly, esp32CaseBase, esp32CaseGround, ESP32_CASE, ESP32_CASE_BOARD } from './esp32Case.ts';
import { stepperDriverLayout } from './parts/index.ts';
import { devBoardLayout } from './parts/index.ts';
import { spurGearOutline, spurGearPieces } from './spurGear.ts';
import { dimensionOf, findPart, ISO_273_CLEARANCE_HOLES } from './parts/index.ts';
import { clipConvex, extrudedPieces, signedArea, type Point2 } from './physicsPieces.ts';
import { spurGearRadii, type SpurGear } from './spurGear.ts';

/**
 * A PET-bottle treat dispenser (docs/treat-dispenser.md, issue #138): an inverted bottle feeds a chamber whose floor is an inclined
 * disc with four notches open at its rim. Turning, the disc lifts treats (usually one per notch) out of the pile; extra treats slide back off
 * the incline; at the top a notch passes over a hole in the fixed back plate and its treat drops into the chute. There is no fixed
 * edge close to the moving disc in the pile, so nothing is sheared. A 28BYJ-48 turns the disc through a 15:30 spur pair.
 *
 * Frames. The disc frame D: origin on the disc's axis in the plane of its face, +Z out of the face (towards the treats), +Y up the
 * incline, +X across it. The assembled frame W (Z up, the wall behind at +Y): D turned by `DISC_ROTATION`, the face looking up and
 * back towards the wall at `BETA` to the horizontal. Gravity in D is (0, −sin β, −cos β). All lengths mm, angles degrees.
 */

/** The disc's incline to the horizontal: steep enough that a treat riding on another slides off; 65° lost treats from the notches. */
export const BETA = 55;
/** D → W as a pose rotation (X first, then Z, fixed axes): the face's normal becomes (0, sin β, cos β). */
export const DISC_ROTATION: [number, number, number] = [BETA, 0, 180];

export const TREAT_DISPENSER = {
  notches: 4,
  /** Disc face to back plate, mm; the notch is this much deeper than the disc is thick. */
  gap: 0.3,
  plate: 3,
  /** Disc rim to the fixed rim wall, and the wall's thickness. */
  rimGap: 0.5, rimWall: 2.4,
  minDiscRadius: 31.5,
  /** Outlet: how far it reaches inside the notch's inner edge, and how much longer than the notch it is along the turn. */
  outletIn: 2.5, outletExtra: 4.6,
  /** Disc–spindle fit, spindle diameter and its flat (distance of the flat from the axis). */
  fit: 0.2, spindle: 8, spindleFlat: 3,
  /** Gear module, teeth and face width; teeth thinned by `backlash` (mm along the pitch circle) each. */
  module: 1, pinionTeeth: 15, gearTeeth: 30, gearWidth: 6, backlash: 0.08,
  /** Plate to gear, gear to cover, cover thickness. */
  gearAir: 1, cover: 3,
  /** The chamber's lid above the disc face, and the feed tube's mouth (below the lid, over the low side of the disc). */
  lid: 42, mouthY: -14, mouthZ: 22, tubeBore: 28, tubeWall: 2.4,
  /** The feed tube's edge stays this far off the disc's face everywhere (more than a treat is long), so that no treat carried up the
   * face can be wedged under it: its mouth is cut level (which sets the pile's height) and, nearer the disc, parallel to the face. */
  mouthClear: 18,
  /** How far the chute runs back from the plate. */
  chuteDepth: 40,
  wall: 2.4,
  /** The chute's floor wall, between the treats and the gear's teeth. */
  chuteWall: 1.6,
} as const;

/** The electronics pod against the wall bracket (treatBayLayout): its size, wall, cover and corner radius, the ULN2003's standoffs. */
export const POD = { halfWidth: 40, depth: 31, height: 60, wall: 2, cover: 2, radius: 4, driverStandoff: 6, lidProud: 0.5, plugRoom: 0 } as const;
/** The feed tube's collar on the chamber's lid: its radial width and height, and its two screw tabs (across, and down the incline from
 * the tube's axis on the lid, so that the collar holds them up as the tube prints flange down). */
export const TREAT_FEED = { collar: 3, collarHeight: 3, tab: [16, -25], tabPad: 9, fit: 0.2, boss: 9 } as const;

/** Bottle necks with an ISBT drawing (drawings 3784253-21 and 1165362-2). Values read off the drawings; see docs/treat-dispenser.md. */
export const BOTTLE_NECKS = {
  'pco-1881': { title: 'PCO 1881 (28 mm CSD, ISBT 3784253-21)', T: 27.40, E: 24.20, bore: 21.72, pitch: 2.70, starts: 1, turns: 650 / 360, ring: 33.0 },
  'pco-1810': { title: 'PCO 1810 (28 mm CSD, ISBT 1165362-2)', T: 27.43, E: 24.51, bore: 21.74, pitch: 3.18, starts: 1, turns: 720 / 360, ring: 33.0 },
} as const;
export type BottleNeck = keyof typeof BOTTLE_NECKS;

const mm = (title: string, description: string, value: number, minimum: number, maximum: number, multipleOf = 0.1) =>
  Type.Number({ title, description, default: value, minimum, maximum, multipleOf });
export const TreatDispenserParametersSchema = Type.Object({
  treatLength: mm('Treat length', 'Longest side of the treats, mm. Measure the largest of a bag; the notch is sized from it.', 14, 10, 18),
  treatWidth: mm('Treat width', 'Middle side of the treats, mm.', 9, 6, 12),
  treatThickness: mm('Treat thickness', 'Thinnest side of the treats, mm. The disc is as thick as this, so a treat lies flush in its notch and a second one cannot catch on it.', 5, 3, 7),
  treatCornerRadius: mm('Treat corner radius', 'Rounding of the treats’ edges and corners, mm (used by the simulation only).', 1.5, 0.5, 2.5),
  notchClearance: mm('Notch clearance', 'Play around a treat in its notch on each side, mm. More takes bigger treats but lets two thin ones in.', 0.7, 0.4, 1.5, 0.05),
  bottleNeck: Type.Enum(Object.keys(BOTTLE_NECKS) as BottleNeck[], { title: 'Bottle neck', description: 'The thread of the bottle the adapter screws onto. Print the thread coupon first: real bottles vary.', default: 'pco-1881' }),
  threadClearance: mm('Thread clearance', 'Radial play of the adapter’s thread on the bottle’s, mm; tune it with the coupon.', 0.3, 0.1, 0.8, 0.05),
  bottleDiameter: mm('Bottle diameter', 'Largest diameter of the bottle, mm (1.5 l PET bottles are about 90 mm). Sets the strap holder and how high the adapter stands, so the bottle clears the chamber.', 90, 60, 110, 1),
}, { additionalProperties: false });
export type TreatDispenserParameters = Static<typeof TreatDispenserParametersSchema>;
export const DEFAULT_TREAT_DISPENSER = Object.fromEntries(Object.entries(TreatDispenserParametersSchema.properties).map(([key, p]) => [key, 'default' in p ? p.default : undefined])) as TreatDispenserParameters;

export type Vec3 = [number, number, number];
const DEG = Math.PI / 180;
const S = Math.sin(BETA * DEG), C = Math.cos(BETA * DEG);
/** A point in D as a point in W (before the assembly's offset). */
export const d2w = ([x, y, z]: readonly number[]): Vec3 => [-(x ?? 0), -C * (y ?? 0) + S * (z ?? 0), S * (y ?? 0) + C * (z ?? 0)];
/** A direction in W as a direction in D. */
export const w2d = ([x, y, z]: readonly number[]): Vec3 => [-(x ?? 0), -C * (y ?? 0) + S * (z ?? 0), S * (y ?? 0) + C * (z ?? 0)];
/** World up in D: the feed tube's axis. */
export const UP_D: Vec3 = [0, S, C];

const motorPart = () => findPart('kiatronics-28byj-48-5v') ?? (() => { throw new Error('Missing 28BYJ-48.'); })();

/** Every dimension of the dispenser for these parameters (D frame unless noted). */
export function treatDispenserLayout(p: TreatDispenserParameters) {
  const T = TREAT_DISPENSER;
  const notchLength = p.treatLength + 2 * p.notchClearance, notchWidth = p.treatWidth + 2 * p.notchClearance;
  const discThickness = p.treatThickness;
  const outletLength = notchLength + T.outletExtra;
  // the outlet must stay clear of the notches either side of it at rest (45° away): 2 mm of plate under each
  const pitchRadius = (outletLength / 2 + notchLength / 2 + 2) / (Math.PI / T.notches);
  const discRadius = Math.max(T.minDiscRadius, pitchRadius + notchWidth / 2);
  const notchInner = discRadius - notchWidth;
  const plateTop = -discThickness - T.gap, plateBottom = plateTop - T.plate;
  const pinion: SpurGear = { module: T.module, teeth: T.pinionTeeth, width: T.gearWidth, backlash: T.backlash };
  const gear: SpurGear = { module: T.module, teeth: T.gearTeeth, width: T.gearWidth, backlash: T.backlash };
  const centreDistance = spurGearRadii(pinion).pitch + spurGearRadii(gear).pitch;
  const gearTop = plateBottom - T.gearAir, gearBottom = gearTop - T.gearWidth;
  const coverFront = gearBottom - T.gearAir, coverBack = coverFront - T.cover;
  // the chute's floor runs straight back from the outlet's inner edge; the gear must turn inside it with a wall between
  const chuteFloor = notchInner - T.outletIn;
  const gearClear = chuteFloor - T.chuteWall - spurGearRadii(gear).tip;
  const rimInner = discRadius + T.rimGap, rimOuter = rimInner + T.rimWall;
  const plateRadius = rimOuter + 2;
  // the motor stands behind the cover, its shaft (8 mm off its can's axis) on the pinion's axis, below the spindle in D
  const motor = motorPart();
  const shaftOffset = dimensionOf(motor, 'e'), motorLength = dimensionOf(motor, 'L'), earSpan = dimensionOf(motor, 'a');
  const pinionAt: Point2 = [0, -centreDistance];
  const canAt: Point2 = [0, -centreDistance - shaftOffset];
  // the feed tube: vertical in W, its mouth over the low side of the disc
  const mouth: Vec3 = [0, T.mouthY, T.mouthZ];
  const lidTop = T.lid + T.wall;
  return {
    notchLength, notchWidth, discThickness, discRadius, notchInner, outletLength, plateTop, plateBottom, plateRadius,
    pinion, gear, centreDistance, gearTop, gearBottom, coverFront, coverBack, chuteFloor, gearClear, rimInner, rimOuter,
    motorFace: coverBack, motorLength, shaftOffset, earSpan, pinionAt, canAt, mouth, lidTop,
    /** Rest angles of the notches (D, degrees from +X): either side of the outlet at the top. */
    notchAngles: Array.from({ length: T.notches }, (_, k) => 45 + k * 90),
    outletAngle: 90,
    neck: BOTTLE_NECKS[p.bottleNeck],
  };
}
export type TreatDispenserLayout = ReturnType<typeof treatDispenserLayout>;

export function treatDispenserIssues(p: TreatDispenserParameters): ParameterIssue[] {
  const issues: ParameterIssue[] = [];
  const l = treatDispenserLayout(p);
  if (p.treatWidth > p.treatLength) issues.push({ field: 'treatWidth', message: 'The width must not exceed the length: give the sides longest first.' });
  if (p.treatThickness > p.treatWidth) issues.push({ field: 'treatThickness', message: 'The thickness must not exceed the width.' });
  if (2 * p.treatCornerRadius > p.treatThickness - 0.2) issues.push({ field: 'treatCornerRadius', message: 'The corner radius must be less than half the thickness.' });
  if (l.gearClear < 0.6) issues.push({ field: 'treatWidth', message: 'Treats this wide leave no room for the gear inside the chute: the disc would have to grow.' });
  if (2 * p.treatThickness < p.treatWidth + 2 * p.notchClearance - 0.2 && p.treatThickness * 2 < l.notchWidth) {
    // two treats edge on side by side fit a notch wider than twice their thickness
  }
  return issues;
}

/* -------------------------------------------------------------------------------------------------------------------------------
 * 2D outlines and convex pieces (shared by the physics and, as numbers, the SCAD file)
 * ----------------------------------------------------------------------------------------------------------------------------- */

const ccw = (polygon: Point2[]): Point2[] => signedArea(polygon) < 0 ? [...polygon].reverse() : polygon;
/** A rounded rectangle, `w` along X and `h` along Y, centred, corners of radius `r` in `n` steps each. */
export function roundedRect(w: number, h: number, r: number, n = 6): Point2[] {
  return [[1, 1, 0], [-1, 1, 90], [-1, -1, 180], [1, -1, 270]].flatMap(([sx = 1, sy = 1, a0 = 0]) => Array.from({ length: n + 1 }, (_, i): Point2 => {
    const a = (a0 + 90 * i / n) * DEG;
    return [sx * (w / 2 - r) + r * Math.cos(a), sy * (h / 2 - r) + r * Math.sin(a)];
  }));
}
export const circle = (cx: number, cy: number, r: number, n = 48): Point2[] =>
  Array.from({ length: n }, (_, i): Point2 => [cx + r * Math.cos(2 * Math.PI * i / n), cy + r * Math.sin(2 * Math.PI * i / n)]);
/** `shape` (local X along the turn, local Y outwards) placed at radius `radius` and angle `angle` (degrees) about the origin. */
export function placeRadial(shape: Point2[], angle: number, radius: number): Point2[] {
  const c = Math.cos(angle * DEG), s = Math.sin(angle * DEG);
  return shape.map(([x, y]): Point2 => [c * (radius + y) - s * x, s * (radius + y) + c * x]);
}

/** A notch at angle `angle`: open at the rim (it runs 3 mm past it), its inner corners rounded. */
export function notchOutline(l: TreatDispenserLayout, angle: number): Point2[] {
  const depth = l.notchWidth + 3;
  return ccw(placeRadial(roundedRect(l.notchLength, depth, 2.5), angle, l.notchInner + depth / 2));
}
/** The outlet in the back plate: longer than the notch along the turn, reaching inside its inner edge, out past the rim wall. */
export function outletOutline(l: TreatDispenserLayout): Point2[] {
  const inner = l.notchInner - TREAT_DISPENSER.outletIn, outer = l.rimOuter + 0.5;
  return ccw(placeRadial(roundedRect(l.outletLength, outer - inner, 3), l.outletAngle, (inner + outer) / 2));
}

/**
 * A convex region less a convex hole, as convex pieces without slivers: one wedge per edge of the hole, from its edge out along rays
 * from the hole's centroid, clipped to the region. Each wall of the hole lies on exactly one piece.
 */
export function minusHole(region: Point2[], hole: Point2[]): Point2[][] {
  const cx = hole.reduce((sum, q) => sum + q[0], 0) / hole.length, cy = hole.reduce((sum, q) => sum + q[1], 0) / hole.length;
  const outer = ccw(region), pieces: Point2[][] = [];
  const far = ([x, y]: Point2): Point2 => { const dx = x - cx, dy = y - cy, n = Math.hypot(dx, dy); return [cx + dx / n * 1e3, cy + dy / n * 1e3]; };
  const h = ccw(hole);
  h.forEach((a, i) => {
    const b = h[(i + 1) % h.length] ?? a;
    let piece = ccw([a, far(a), far(b), b]);
    outer.forEach((p, k) => {
      const q = outer[(k + 1) % outer.length] ?? p, nx = q[1] - p[1], ny = -(q[0] - p[0]);
      if (piece.length >= 3) piece = clipConvex(piece, [nx, ny, nx * p[0] + ny * p[1]]);
    });
    if (piece.length >= 3 && Math.abs(signedArea(piece)) > 0.1) pieces.push(piece);
  });
  return pieces;
}

/** The wall round a polygon (any orientation): one slab per edge, `t` thick outwards, from z0 to z1. */
export function ringPieces(outline: Point2[], t: number, z0: number, z1: number): number[][] {
  const points = ccw(outline);
  return points.map((p, i) => {
    const q = points[(i + 1) % points.length] ?? p, length = Math.hypot(q[0] - p[0], q[1] - p[1]);
    const n: Point2 = [(q[1] - p[1]) / length * t, -(q[0] - p[0]) / length * t];
    const quad: Point2[] = [p, q, [q[0] + n[0], q[1] + n[1]], [p[0] + n[0], p[1] + n[1]]];
    return [z0, z1].flatMap(z => quad.flatMap(([x, y]) => [x, y, z]));
  });
}

/** A tube of bore radius `r` along `axis` (unit) from `origin` for `length`, as one slab per segment. */
export function tubePieces(origin: readonly number[], axis: Vec3, r: number, t: number, length: number, segments = 20): number[][] {
  const e1: Vec3 = [1, 0, 0];
  const e2: Vec3 = [axis[1] * e1[2] - axis[2] * e1[1], axis[2] * e1[0] - axis[0] * e1[2], axis[0] * e1[1] - axis[1] * e1[0]];
  return ringPieces(circle(0, 0, r, segments), t, 0, length).map((piece): number[] => {
    const out: number[] = [];
    for (let i = 0; i < piece.length; i += 3) {
      const a = piece[i] ?? 0, b = piece[i + 1] ?? 0, c = piece[i + 2] ?? 0;
      for (let k = 0; k < 3; k++) out.push((origin[k] ?? 0) + a * (e1[k] ?? 0) + b * (e2[k] ?? 0) + c * (axis[k] ?? 0));
    }
    return out;
  });
}

/**
 * The disc's pieces in D: one 90° sector per notch, less the notch. Each sector starts at a chord just outside the spindle's bore (the
 * spindle fills the bore to 0.5 mm below the face, where no treat reaches), so that no piece lies where the printed disc is open.
 */
export function discPieces(l: TreatDispenserLayout): number[][] {
  const inner = (TREAT_DISPENSER.spindle / 2 + TREAT_DISPENSER.fit + 0.2) / Math.cos(45 * DEG);
  return l.notchAngles.flatMap(angle => {
    const sector: Point2[] = [[inner * Math.cos((angle + 45) * DEG), inner * Math.sin((angle + 45) * DEG)], [inner * Math.cos((angle - 45) * DEG), inner * Math.sin((angle - 45) * DEG)], ...Array.from({ length: 13 }, (_, i): Point2 => {
      const a = (angle - 45 + 90 * i / 12) * DEG; return [l.discRadius * Math.cos(a), l.discRadius * Math.sin(a)];
    })];
    return minusHole(sector, notchOutline(l, angle)).flatMap(piece => extrudedPieces(piece, [0, 1], -l.discThickness, 0));
  });
}

/* -------------------------------------------------------------------------------------------------------------------------------
 * Poses: rotations as matrices, so that the parts' print frames, the disc frame and the ESP32 case's own assembly compose exactly
 * ----------------------------------------------------------------------------------------------------------------------------- */

type Mat3 = [Vec3, Vec3, Vec3];
/** An element of a matrix (rows). */
const g = (m: Mat3, i: number, j: number): number => m[i]?.[j] ?? 0;
/** A pose rotation (degrees about X, then Y, then Z, fixed axes: Rz Ry Rx) as a matrix (rows). */
export function rotationMatrix([x = 0, y = 0, z = 0]: readonly number[]): Mat3 {
  const [cx, sx, cy, sy, cz, sz] = [Math.cos(x * DEG), Math.sin(x * DEG), Math.cos(y * DEG), Math.sin(y * DEG), Math.cos(z * DEG), Math.sin(z * DEG)];
  return [
    [cz * cy, cz * sy * sx - sz * cx, cz * sy * cx + sz * sx],
    [sz * cy, sz * sy * sx + cz * cx, sz * sy * cx - cz * sx],
    [-sy, cy * sx, cy * cx],
  ];
}
const mul = (a: Mat3, b: Mat3): Mat3 => [0, 1, 2].map(i => [0, 1, 2].map(j => g(a, i, 0) * g(b, 0, j) + g(a, i, 1) * g(b, 1, j) + g(a, i, 2) * g(b, 2, j)) as Vec3) as Mat3;
const apply = (m: Mat3, v: readonly number[]): Vec3 => [0, 1, 2].map(i => g(m, i, 0) * (v[0] ?? 0) + g(m, i, 1) * (v[1] ?? 0) + g(m, i, 2) * (v[2] ?? 0)) as Vec3;
const transpose = (m: Mat3): Mat3 => [0, 1, 2].map(i => [g(m, 0, i), g(m, 1, i), g(m, 2, i)] as Vec3) as Mat3;
/** The pose rotation (degrees, X then Y then Z) of a matrix, rounded to 1e-9°. */
export function rotationAngles(m: Mat3): Vec3 {
  const round = (a: number) => Math.round(a / DEG * 1e9) / 1e9 + 0;
  const sy = -g(m, 2, 0);
  if (Math.abs(sy) > 1 - 1e-12) return [round(Math.atan2(-g(m, 1, 2), g(m, 1, 1))), round(Math.asin(Math.max(-1, Math.min(1, sy)))), 0];
  return [round(Math.atan2(g(m, 2, 1), g(m, 2, 2))), round(Math.asin(sy)), round(Math.atan2(g(m, 1, 0), g(m, 0, 0)))];
}
export interface Pose { position: Vec3; rotation: Vec3 }
/** `outer` ∘ `inner`: a part posed by `inner` inside a frame posed by `outer`. */
export function composePose(outer: Pose, inner: { position: readonly number[]; rotation?: readonly number[] | undefined }): Pose {
  const ro = rotationMatrix(outer.rotation);
  const p = apply(ro, inner.position);
  return { position: [p[0] + outer.position[0], p[1] + outer.position[1], p[2] + outer.position[2]], rotation: rotationAngles(mul(ro, rotationMatrix(inner.rotation ?? [0, 0, 0]))) };
}
/** A point given in a posed part's own frame, in the frame the pose is in. */
export const posePoint = (pose: { position: readonly number[]; rotation?: readonly number[] | undefined }, point: readonly number[]): Vec3 => {
  const p = apply(rotationMatrix(pose.rotation ?? [0, 0, 0]), point);
  return [p[0] + (pose.position[0] ?? 0), p[1] + (pose.position[1] ?? 0), p[2] + (pose.position[2] ?? 0)];
};
/** A point of the frame a pose is in, in the posed part's own frame. */
export const poseLocal = (pose: { position: readonly number[]; rotation?: readonly number[] | undefined }, point: readonly number[]): Vec3 =>
  apply(transpose(rotationMatrix(pose.rotation ?? [0, 0, 0])), [0, 1, 2].map(k => (point[k] ?? 0) - (pose.position[k] ?? 0)));

/* -------------------------------------------------------------------------------------------------------------------------------
 * Parts: their print frames, and where they stand
 * ----------------------------------------------------------------------------------------------------------------------------- */

/**
 * A part drawn in D and printed in its own frame: `flip` turns it over (180° about X), then it moves by `offset`. Its SCAD file draws
 * it in D and applies the same transform, so its STL lies on the bed as printed.
 */
/** The motor hood: wall, clearance round the motor, and its rim's gap behind the motor's ears (their thickness). */
export const HOOD = { wall: 1.6, clearance: 0.8, earGap: 0.9, tab: 1.6 } as const;

export interface PrintFrame { flip: boolean; offset: Vec3 }
export function printFrames(l: TreatDispenserLayout): Record<'disc' | 'gear' | 'pinion' | 'body' | 'cover' | 'hopper' | 'hood', PrintFrame> {
  return {
    disc: { flip: false, offset: [0, 0, l.discThickness] },
    gear: { flip: false, offset: [0, 0, -l.gearBottom] },
    pinion: { flip: false, offset: [-l.pinionAt[0], -l.pinionAt[1], -l.gearBottom] },
    // plate face down on the bed: the gearbox and the chute rise from it
    body: { flip: true, offset: [0, 0, l.plateTop] },
    cover: { flip: false, offset: [0, 0, -l.coverBack] },
    // lid down on the bed: the rim wall rises from it, with no roof to support
    hopper: { flip: true, offset: [0, 0, l.lidTop] },
    // rim down (just behind the motor's ears), its cone closing at the top
    hood: { flip: true, offset: [-l.canAt[0], l.canAt[1], l.motorFace - HOOD.earGap] },
  };
}
/** A point of D in a part's print frame. */
export const toPrint = (frame: PrintFrame, [x = 0, y = 0, z = 0]: readonly number[]): Vec3 =>
  frame.flip ? [x + frame.offset[0], -y + frame.offset[1], -z + frame.offset[2]] : [x + frame.offset[0], y + frame.offset[1], z + frame.offset[2]];
/** Convex pieces drawn in D, in a part's print frame. */
const piecesIn = (frame: PrintFrame, pieces: number[][]): number[][] => pieces.map(piece => {
  const out: number[] = [];
  for (let i = 0; i < piece.length; i += 3) out.push(...toPrint(frame, [piece[i] ?? 0, piece[i + 1] ?? 0, piece[i + 2] ?? 0]));
  return out;
});

/** The adapter's (and the feed tube's) flange diameter, mm. */
export const TREAT_ADAPTER_FLANGE = 50;

/** World placement: where the wall is, the feed tube's top, the bottle's axis and the assembly's offset (lowest part on the floor). */
export function treatDispenserPlacement(p: TreatDispenserParameters) {
  const l = treatDispenserLayout(p);
  const T = TREAT_DISPENSER;
  const mouthW = d2w(l.mouth);
  // the bottle (inverted, its support ring on the adapter) must clear the chamber within its radius: sample the chamber's top
  const reach = p.bottleDiameter / 2 + 5;
  const top: Vec3[] = [];
  for (let i = 0; i < 72; i++) for (const r of [0, l.rimOuter / 2, l.rimOuter]) {
    const a = i * 5 * DEG;
    top.push(d2w([r * Math.cos(a), r * Math.sin(a), l.lidTop]));
  }
  const highest = (radius: number) => Math.max(...top.filter(q => Math.hypot(q[0] - mouthW[0], q[1] - mouthW[1]) <= radius).map(q => q[2]));
  // an inverted bottle runs about 10 mm straight above its support ring before its shoulder flares; keep 5 mm more. The adapter's
  // own flange (Ø50) must clear the chamber too.
  const adapterHeight = 18;
  const seatZ = Math.max(highest(reach) + 15 - adapterHeight, highest(TREAT_ADAPTER_FLANGE / 2 + 3) + 2);
  // the tube is vertical in W, so its length is the rise from the mouth to the seat
  const tubeLength = seatZ - mouthW[2];
  const seatD: Vec3 = [l.mouth[0], l.mouth[1] + UP_D[1] * tubeLength, l.mouth[2] + UP_D[2] * tubeLength];
  // the motor's lowest point: its can and wire housing, below the cover
  const motor = motorPart();
  const housing = dimensionOf(motor, 'bh');
  const low = Math.min(...[-1, 1].flatMap(sx => [l.canAt[1] - 14, l.canAt[1] - housing].flatMap(y => [l.motorFace, l.motorFace - l.motorLength].map(z => d2w([sx * 14, y, z])[2]))));
  const wallY = mouthW[1] + p.bottleDiameter / 2 + 4;
  // the electronics pod (treatBayLayout) stands against the wall under the chamber: its top 4 mm below anything of the chamber, the
  // plate or their lugs that lies within 3 mm of its front
  const podFront = wallY - POD.depth;
  const around: Vec3[] = [];
  for (let i = 0; i < 72; i++) for (const r of [l.rimOuter, l.plateRadius, l.plateRadius + 6 + 5.5]) for (const z of [l.plateBottom, l.plateTop, 4, l.lidTop]) {
    const a = i * 5 * DEG;
    around.push(d2w([r * Math.cos(a), r * Math.sin(a), z]));
  }
  const podTopRelative = Math.min(...around.filter(q => q[1] >= podFront - 3).map(q => q[2])) - 4;
  // the lowest part sets the floor: the motor's can and wire housing, or the pod
  const offset: Vec3 = [0, 0, Math.ceil(Math.max(-low + 6, -(podTopRelative - POD.height) + 4))];
  return {
    l, mouthW, seatD, seatW: posePoint({ position: offset, rotation: [0, 0, 0] }, d2w(seatD)), tubeLength, offset, wallY, adapterHeight,
    podTop: podTopRelative + offset[2], discPose: { position: offset, rotation: DISC_ROTATION }, T,
  };
}

/** The pose (print frame → W) of a part drawn in D. */
export function discPartPose(placement: ReturnType<typeof treatDispenserPlacement>, frame: PrintFrame): Pose {
  // print → D: undo the offset, then the flip
  const back: Vec3 = frame.flip ? [-frame.offset[0], frame.offset[1], frame.offset[2]] : [-frame.offset[0], -frame.offset[1], -frame.offset[2]];
  return composePose(placement.discPose, { position: back, rotation: frame.flip ? [180, 0, 0] : [0, 0, 0] });
}

/* -------------------------------------------------------------------------------------------------------------------------------
 * Treats
 * ----------------------------------------------------------------------------------------------------------------------------- */

/** A treat as a rounded cuboid: its hull's vertices, the sphere of `r` at each corner sampled every 45° (mm, about its centre). */
export function treatVertices(p: Pick<TreatDispenserParameters, 'treatLength' | 'treatWidth' | 'treatThickness' | 'treatCornerRadius'>): number[] {
  const r = p.treatCornerRadius, half = [p.treatLength / 2 - r, p.treatWidth / 2 - r, p.treatThickness / 2 - r];
  const vertices: number[] = [];
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) {
    for (const [a, b] of [[0, 0], [45, 0], [90, 0], [0, 45], [45, 45], [90, 45], [0, 90]] as const) {
      const ca = Math.cos(a * DEG), sa = Math.sin(a * DEG), cb = Math.cos(b * DEG), sb = Math.sin(b * DEG);
      vertices.push(sx * ((half[0] ?? 0) + r * ca * cb), sy * ((half[1] ?? 0) + r * sa * cb), sz * ((half[2] ?? 0) + r * sb));
    }
  }
  return vertices;
}

/** How treats start: packed at random (`random`), or all in one orientation, to test how each is taken (all relative to the world). */
export const FILL_MODES = ['random', 'flat', 'edge', 'end', 'diagonal'] as const;
export type FillMode = typeof FILL_MODES[number];

type Quat = [number, number, number, number];
const qmul = (a: Quat, b: Quat): Quat => [a[0] * b[0] - a[1] * b[1] - a[2] * b[2] - a[3] * b[3], a[0] * b[1] + a[1] * b[0] + a[2] * b[3] - a[3] * b[2], a[0] * b[2] - a[1] * b[3] + a[2] * b[0] + a[3] * b[1], a[0] * b[3] + a[1] * b[2] - a[2] * b[1] + a[3] * b[0]];
const qaxis = (axis: readonly number[], angle: number): Quat => { const n = Math.hypot(...axis), s = Math.sin(angle / 2) / n; return [Math.cos(angle / 2), (axis[0] ?? 0) * s, (axis[1] ?? 0) * s, (axis[2] ?? 0) * s]; };
const qmat = ([w, x, y, z]: Quat): Mat3 => [[1 - 2 * (y * y + z * z), 2 * (x * y - w * z), 2 * (x * z + w * y)], [2 * (x * y + w * z), 1 - 2 * (x * x + z * z), 2 * (y * z - w * x)], [2 * (x * z - w * y), 2 * (y * z + w * x), 1 - 2 * (x * x + y * y)]];

/** A small seeded generator (an LCG), so a fill is the same in CI and in the browser. */
function lcg(seed: number): () => number {
  let state = (Math.floor(seed) * 2654435761) % 4294967296;
  return () => { state = (state * 1664525 + 1013904223) % 4294967296; return state / 4294967296; };
}

/** Whether two boxes (centre, rotation, half sizes) overlap, by separating axes. */
function boxesOverlap(a: { c: Vec3; m: Mat3 }, b: { c: Vec3; m: Mat3 }, half: Vec3): boolean {
  const col = (m: Mat3, k: number): Vec3 => [g(m, 0, k), g(m, 1, k), g(m, 2, k)];
  const axes: Vec3[] = [];
  for (let i = 0; i < 3; i++) {
    axes.push(col(a.m, i), col(b.m, i));
    for (let j = 0; j < 3; j++) { const u = col(a.m, i), v = col(b.m, j); axes.push([u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]]); }
  }
  const d: Vec3 = [b.c[0] - a.c[0], b.c[1] - a.c[1], b.c[2] - a.c[2]];
  const dot = (u: Vec3, v: Vec3) => u[0] * v[0] + u[1] * v[1] + u[2] * v[2];
  return axes.every(axis => {
    const n = Math.hypot(...axis); if (n < 1e-9) return true;
    const u: Vec3 = [axis[0] / n, axis[1] / n, axis[2] / n];
    const ra = [0, 1, 2].reduce((sum, k) => sum + (half[k] ?? 0) * Math.abs(dot(col(a.m, k), u)), 0);
    const rb = [0, 1, 2].reduce((sum, k) => sum + (half[k] ?? 0) * Math.abs(dot(col(b.m, k), u)), 0);
    return Math.abs(dot(d, u)) <= ra + rb;
  });
}

/**
 * Where `count` treats start (D frame: centre and rotation): packed without overlap in the chamber over the low side of the disc,
 * the rest up the feed tube, each placed as low as it fits so that none falls far (soft contacts let a fast treat sink into a wall).
 */
export function treatFill(p: TreatDispenserParameters, count: number, seed: number, mode: FillMode): { centre: Vec3; rotation: Mat3 }[] {
  const l = treatDispenserLayout(p);
  const random = lcg(seed);
  const half: Vec3 = [p.treatLength / 2 + 0.2, p.treatWidth / 2 + 0.2, p.treatThickness / 2 + 0.2];
  // "flat" is relative to the world: the treat's thin axis vertical; its D rotation turns local Z onto world up
  const upright = qaxis([1, 0, 0], -BETA * DEG);
  const orient = (): Quat => {
    const spin = qaxis(UP_D, random() * 2 * Math.PI);
    switch (mode) {
      case 'flat': return qmul(spin, upright);
      case 'edge': return qmul(qmul(spin, upright), qaxis([1, 0, 0], Math.PI / 2));
      case 'end': return qmul(qmul(spin, upright), qaxis([0, 1, 0], Math.PI / 2));
      case 'diagonal': return qmul(qmul(spin, upright), qaxis([1, 1, 0], Math.PI / 4));
      default: return qmul(spin, qaxis([random() - 0.5, random() - 0.5, random() - 0.5], random() * Math.PI));
    }
  };
  const extent = (m: Mat3, axis: Vec3) => [0, 1, 2].reduce((sum, k) => sum + (half[k] ?? 0) * Math.abs(g(m, 0, k) * axis[0] + g(m, 1, k) * axis[1] + g(m, 2, k) * axis[2]), 0);
  const placed: { c: Vec3; m: Mat3 }[] = [];
  const free = (c: Vec3, m: Mat3) => !placed.some(other => boxesOverlap(other, { c, m }, half));
  const tubeR = TREAT_DISPENSER.tubeBore / 2 - 0.4;
  for (let i = 0; i < count; i++) {
    let done = false;
    for (let attempt = 0; attempt < 400 && !done; attempt++) {
      const m = qmat(orient());
      // in the chamber: over the low side, inside the rim wall, below the lid
      const cx = (random() - 0.5) * 2 * (l.rimInner - 12), cy = -l.rimInner / 3 + (random() - 0.5) * l.rimInner / 2;
      if (attempt < 300 && Math.hypot(cx, cy) + Math.hypot(extent(m, [1, 0, 0]), extent(m, [0, 1, 0])) < l.rimInner - 0.6) {
        for (let z = extent(m, [0, 0, 1]) + 0.3; z + extent(m, [0, 0, 1]) < TREAT_DISPENSER.lid - 1; z += 0.5) {
          if (free([cx, cy, z], m)) { placed.push({ c: [cx, cy, z], m }); done = true; break; }
        }
        continue;
      }
      if (attempt < 300) continue;
      // up the tube, along world up from the mouth
      const e1: Vec3 = [1, 0, 0], e2: Vec3 = [0, UP_D[2], -UP_D[1]];
      const o1 = (random() - 0.5) * 4, o2 = (random() - 0.5) * 4;
      if (Math.hypot(o1, o2) + Math.max(extent(m, e1), extent(m, e2)) > tubeR) continue;
      for (let s = 0; s < 400; s += 0.5) {
        const c: Vec3 = [0, 1, 2].map(k => (l.mouth[k] ?? 0) + o1 * (e1[k] ?? 0) + o2 * (e2[k] ?? 0) + s * (UP_D[k] ?? 0)) as Vec3;
        if (free(c, m)) { placed.push({ c, m }); done = true; break; }
      }
    }
    if (!done) throw new Error(`Treat ${i + 1} of ${count} does not fit.`);
  }
  return placed.map(({ c, m }) => ({ centre: c, rotation: m }));
}

/* -------------------------------------------------------------------------------------------------------------------------------
 * The mechanism (docs/physics-plan.md, "Motors and loose items")
 * ----------------------------------------------------------------------------------------------------------------------------- */

/**
 * The motor, as the simulation takes it. Torque: the 28BYJ-48's pull-in torque, 300 gf·cm (29.4 N·mm) at 5 V, as Components101's
 * table gives it; Kiatronics' data sheet (the library's source) could not be read here. Its torque falls with speed and with a sagging
 * supply: unverified, so the jam scenarios check only that it stalls rather than forcing anything. Its stiffness is that torque over
 * one full step at the output shaft (11.25° / 64 ≈ 0.18°); its inertia (its rotor through the 1:64 gearbox) is assumed, 0.2 g·m²:
 * lighter, the gear teeth rattled the simulation apart.
 */
export const TREAT_MOTOR = { torque: 29.4, stiffness: 165.8, damping: 0.7, inertia: 2e5, slip: 0.35 } as const;

/**
 * The firmware's cycle (models/treat-dispenser/esphome/treat-dispenser.yaml): the motor turns −90° (the disc +45°, its notch over the
 * outlet), pauses, and turns −90° more (the next notch to rest). 700 half-steps/s with a 4076-step turn is 61.8°/s at the motor.
 */
export const TREAT_FIRMWARE = {
  stepsPerTurn: 4076, halfSteps: 700, acceleration: 2000, debounce: 0.03, queue: 1, boot: 0.6, pause: 0.3, settle: 0.5, prime: 2, jogSteps: 23,
  stall: 10,
} as const;
export const firmwareDegrees = (steps: number): number => steps * 360 / TREAT_FIRMWARE.stepsPerTurn;
/** Motor steps per dispense cycle: one notch pitch of the disc, through the gears. */
export const treatCycleSteps = (): number => TREAT_FIRMWARE.stepsPerTurn * (TREAT_DISPENSER.gearTeeth / TREAT_DISPENSER.pinionTeeth) / TREAT_DISPENSER.notches;

/**
 * The electronics pod (W, the assembly's offset included): a box against the wall bracket, under the chamber's low side and behind
 * the motor, closed in front by a removable cover. Inside, the ULN2003 board stands on standoffs off its back (components to the
 * front, the motor's plug reachable with the cover off); the ESP32 case's own assembly (esp32CaseAssembly, its parts and boards as
 * that model places them) stands at its +X end with its lid flush in a slot of the pod's side wall, so that B and R are pressed from
 * the side, USB-C points down through the pod's floor to the one cable, and the lid slides up in the slot to come off.
 * `bootPoint` and `resetPoint` are the buttons' actuators in the lid's own frame (its outer face), from the board library's button
 * positions.
 */
export interface PodBox { x0: number; x1: number; y0: number; y1: number; z0: number; z1: number }
export interface BayLayout { caseFrame: Pose; driverPose: Pose; bootPoint: Vec3; resetPoint: Vec3; floor: number; pod: PodBox }

export function treatBayLayout(p: TreatDispenserParameters): BayLayout {
  const placement = treatDispenserPlacement(p);
  const floor = placement.wallY;
  const pod: PodBox = { x0: -POD.halfWidth, x1: POD.halfWidth, y0: floor - POD.depth, y1: floor, z0: placement.podTop - POD.height, z1: placement.podTop };
  const caseAssembly = esp32CaseAssembly(DEFAULT_ESP32_CASE);
  const board = findPart(ESP32_CASE_BOARD), layout = board ? devBoardLayout(board) : undefined;
  const boardPose = caseAssembly.poses['board'], lidPose = caseAssembly.poses['top'];
  if (!layout || !boardPose || !lidPose) throw new Error('The ESP32 case has no board or lid.');
  // case +Z (lid out) → +X (the pod's side), case +X → +Z (USB, at case −X, down), case +Y → −Y
  const roof = esp32CaseGround(DEFAULT_ESP32_CASE) + ESP32_CASE.lidRoof;
  const length = 25.8;
  const caseFrame: Pose = {
    position: [pod.x1 + POD.lidProud - roof, (pod.y0 + pod.y1) / 2, pod.z0 + POD.wall + POD.plugRoom + length / 2],
    rotation: rotationAngles([[0, 0, 1], [0, -1, 0], [1, 0, 0]]),
  };
  const button = (prefix: string): Vec3 => {
    const component = layout.components.find(candidate => candidate.name.startsWith(prefix));
    if (!component) throw new Error(`The SuperMini has no ${prefix} button.`);
    const local = poseLocal(lidPose, posePoint(boardPose, [component.x, component.y, 0]));
    // on the lid's outer face (z = 0 of the roof-down lid)
    return [local[0], local[1], 0];
  };
  // the ULN2003 board (35.3 × 31.4 mm) upright against the pod's back, at its −X end, centred in height
  const driver = findPart('uln2003-stepper-driver-board');
  const size = driver ? [dimensionOf(driver, 'L'), dimensionOf(driver, 'W')] : [35.3, 31.4];
  return {
    caseFrame, bootPoint: button('BOOT'), resetPoint: button('RST'), floor, pod,
    driverPose: { position: [pod.x0 + POD.wall + 1.5, floor - POD.driverStandoff, (pod.z0 + pod.z1) / 2 - (size[1] ?? 0) / 2], rotation: [90, 0, 0] },
  };
}

export interface TreatDispenserPhysicsOptions { treats?: number; seed?: number; mode?: FillMode; /** false: leave the CI scenarios out (the editor does not run them). */ scenarios?: boolean }

/** The treats' bodies for a fill (W poses). */
export function treatItems(p: TreatDispenserParameters, placement: ReturnType<typeof treatDispenserPlacement>, count: number, seed: number, mode: FillMode) {
  const vertices = treatVertices(p);
  const D2W = rotationMatrix(DISC_ROTATION);
  return treatFill(p, count, seed, mode).map((treat, index) => ({
    id: `treat-${index + 1}`, title: `Treat ${index + 1}`, group: 'treats', vertices,
    // a dry treat of 14 × 9 × 5 mm: about 0.5 g (unmeasured; see docs/treat-dispenser.md)
    mass: 0.5 * (p.treatLength * p.treatWidth * p.treatThickness) / (14 * 9 * 5),
    friction: 0.4,
    pose: { position: posePoint(placement.discPose, treat.centre), rotation: rotationAngles(mul(D2W, treat.rotation)) },
  }));
}

export function treatDispenserPhysics(p: TreatDispenserParameters, options: TreatDispenserPhysicsOptions = {}): PhysicsSpec {
  const placement = treatDispenserPlacement(p);
  const { l } = placement;
  const T = TREAT_DISPENSER;
  const frames = printFrames(l);
  const axis = d2w([0, 0, 1]);
  const anchor = (point: readonly number[]) => posePoint(placement.discPose, point);
  const teeth = (gear: SpurGear) => spurGearPieces(gear, 6).slice(0, gear.teeth);
  // the gear has a gap facing the pinion (at −90°); the pinion turns a tooth towards it (at +90° about its own axis)
  const phase = 90 % (360 / l.pinion.teeth);
  const turn = (pieces: number[][], angle: number, dx: number, dy: number, dz: number) => pieces.map(piece => {
    const c = Math.cos(angle * DEG), s = Math.sin(angle * DEG), out: number[] = [];
    for (let i = 0; i < piece.length; i += 3) { const x = piece[i] ?? 0, y = piece[i + 1] ?? 0; out.push(c * x - s * y + dx, s * x + c * y + dy, (piece[i + 2] ?? 0) + dz); }
    return out;
  });
  const gearPieces = turn(teeth(l.gear), 0, 0, 0, l.gearBottom);
  const pinionPieces = turn(teeth(l.pinion), phase, l.pinionAt[0], l.pinionAt[1], l.gearBottom);
  const bodyPieces = treatBodyPieces(l);
  const hopperPieces = treatHopperPieces(l);
  const feed = feedPose(placement);
  const feedPieces = treatFeedPieces(l, placement.tubeLength).map(piece => { const out: number[] = []; for (let i = 0; i < piece.length; i += 3) out.push(...poseLocal(feed, posePoint(placement.discPose, [piece[i] ?? 0, piece[i + 1] ?? 0, piece[i + 2] ?? 0]))); return out; });
  const count = options.treats ?? 10;
  const items = treatItems(p, placement, count, options.seed ?? 1, options.mode ?? 'random');
  // the pinion starts against the gear's tooth on the side it drives (half the pair's play), as it is left after every cycle
  const play = 2 * T.backlash / spurGearRadii(l.pinion).pitch / DEG;
  const firmware = TREAT_FIRMWARE;
  // a quarter turn of the disc is half a turn of the motor (15:30): two moves of a quarter turn each
  const half = firmwareDegrees(treatCycleSteps() / 2);
  const bay = treatBayLayout(p);
  const controller: PhysicsController = {
    motor: 'motor', moves: [-half, -half], pause: firmware.pause, settle: firmware.settle, debounce: firmware.debounce, queue: firmware.queue,
    boot: firmware.boot, prime: firmware.prime, jog: -firmwareDegrees(firmware.jogSteps), stall: firmware.stall, counter: 'out',
    controls: [
      { id: 'boot', title: 'BOOT button (GPIO9): command one dispense cycle', label: 'B', action: 'dispense', body: 'case-top', point: bay.bootPoint },
      { id: 'reset', title: 'RESET button (EN): reboot, never dispenses', label: 'R', action: 'reset', body: 'case-top', point: bay.resetPoint },
      { id: 'prime', title: 'Prime (Home Assistant action): load the notches over the bowl', label: 'P', action: 'prime' },
      { id: 'jog', title: 'Jog (Home Assistant action): turn the disc a little forwards', label: 'J', action: 'jog' },
      { id: 'aligned', title: 'Aligned (Home Assistant action): the index marks line up', label: 'A', action: 'aligned' },
    ],
  };
  const fixed = (id: string, pieces: number[][], extra: Partial<PhysicsBody> = {}): PhysicsBody => ({ id, material: 'petg', fixed: true, collision: { kind: 'pieces', pieces }, ...extra });
  return {
    // gear teeth need 0.1 ms steps (spike 4); the treats and teeth in one island need the precise solve
    maxStep: 0.0001, precise: true,
    bodies: [
      {
        id: 'disc', material: 'petg', collision: { kind: 'pieces', pieces: piecesIn(frames.disc, discPieces(l)) },
        // 2 kg·mm² of added (quasi-static) inertia and 2 N·mm of bearing friction keep the light disc from rattling in the gears' play
        inertia: 2e6, joint: { type: 'hinge', anchor: anchor([0, 0, 0]), axis, friction: 2 },
      },
      { id: 'gear', material: 'petg', frictionless: true, fixed: true, collision: { kind: 'pieces', pieces: piecesIn(frames.gear, gearPieces) }, joint: { type: 'hinge', parent: 'disc', anchor: anchor([0, 0, 0]), axis } },
      {
        id: 'pinion', material: 'petg', frictionless: true, collision: { kind: 'pieces', pieces: piecesIn(frames.pinion, pinionPieces) },
        joint: { type: 'hinge', anchor: anchor([l.pinionAt[0], l.pinionAt[1], 0]), axis, initial: -play / 2 },
      },
      fixed('body', piecesIn(frames.body, bodyPieces)),
      fixed('hopper', piecesIn(frames.hopper, hopperPieces)),
      fixed('feed', feedPieces),
    ],
    exclude: [['disc', 'body'], ['disc', 'hopper'], ['disc', 'feed'], ['gear', 'body'], ['pinion', 'body'], ['gear', 'hopper'], ['pinion', 'hopper'], ['gear', 'feed'], ['pinion', 'feed']],
    motors: [{ id: 'motor', title: '28BYJ-48 (output shaft)', body: 'pinion', ...TREAT_MOTOR, speed: firmwareDegrees(firmware.halfSteps), acceleration: firmwareDegrees(firmware.acceleration) }],
    items,
    counters: [
      treatOutletCounter(placement),
      {
        id: 'dry', title: 'Treats in the gearbox', group: 'treats', kind: 'inside', frame: placement.discPose,
        min: [-l.rimOuter, -l.rimOuter - 20, l.coverBack], max: [l.rimOuter, l.chuteFloor - T.chuteWall, l.plateBottom],
      },
    ],
    controller,
    scenarios: options.scenarios === false ? [] : treatDispenserScenarios(placement, count, options.seed ?? 1, options.mode ?? 'random'),
  };
}

/**
 * How far past the chute's mouth a treat's centre must be before it counts as out: half its longest diagonal (14 × 9 × 5 mm: 8.7),
 * so that no part of it is still inside the chute. A treat stuck in the chute, or resting on its lip, never counts.
 */
export const TREAT_EXIT_MARGIN = 9;

/**
 * The outlet counter (D frame, posed with the disc): a plane `TREAT_EXIT_MARGIN` beyond the chute's mouth, crossed outwards along
 * the chute (−Z in D). Its box runs from inside the chute (so a treat is first seen on the near side) to well past the mouth, wide
 * enough below it for a treat falling forwards out of the mouth.
 */
export function treatOutletCounter(placement: ReturnType<typeof treatDispenserPlacement>): PhysicsCounter {
  const { l, T } = placement;
  const mouth = l.plateBottom - T.chuteDepth;
  return {
    id: 'out', title: 'Treats out of the chute (past its mouth)', group: 'treats', kind: 'crossing', frame: placement.discPose,
    point: [0, 0, mouth - TREAT_EXIT_MARGIN], along: [0, 0, -1],
    min: [-l.outletLength / 2 - 10, l.chuteFloor - 60, mouth - 60], max: [l.outletLength / 2 + 10, l.rimOuter + 10, l.plateBottom - 5],
  };
}

/** The back plate (with the outlet), the chute's walls and the bushing, in D: what treats can touch of the body. */
export function treatBodyPieces(l: TreatDispenserLayout): number[][] {
  const T = TREAT_DISPENSER;
  const plate = minusHole(circle(0, 0, l.plateRadius, 48), outletOutline(l)).flatMap(piece => extrudedPieces(piece, [0, 1], l.plateBottom, l.plateTop));
  // the chute is the outlet's outline carried straight back from the plate, its walls round it (its floor wall towards the gear)
  const chute = ringPieces(outletOutline(l), T.chuteWall, l.plateBottom - T.chuteDepth, l.plateBottom);
  return [...plate, ...chute];
}

/** The chamber in D: the rim wall round the disc and the lid, with the hole the feed tube passes through (its outside, plus the fit). */
export function treatHopperPieces(l: TreatDispenserLayout): number[][] {
  const T = TREAT_DISPENSER;
  const rim = ringPieces(circle(0, 0, l.rimInner, 48), T.rimWall, l.plateTop, T.lid);
  // where the tube crosses the lid: an ellipse, its outside r across and r / cos β along the incline
  const t = (T.lid - l.mouth[2]) / UP_D[2];
  const cy = l.mouth[1] + UP_D[1] * t, r = T.tubeBore / 2 + T.tubeWall + TREAT_FEED.fit;
  const hole: Point2[] = Array.from({ length: 32 }, (_, i): Point2 => [r * Math.cos(2 * Math.PI * i / 32), cy + r / C * Math.sin(2 * Math.PI * i / 32)]);
  const lid = minusHole(circle(0, 0, l.rimOuter, 48), hole).flatMap(piece => extrudedPieces(piece, [0, 1], T.lid, l.lidTop));
  return [...rim, ...lid];
}

/**
 * The feed tube in D: from its mouth inside the chamber up to the adapter's seat (a separate part since it prints flange down), as one
 * slab per segment. Each generator of the tube starts where it leaves the level cut through the mouth or the plane `mouthClear` off the
 * disc's face, whichever is higher.
 */
export function treatFeedPieces(l: TreatDispenserLayout, tubeLength: number, segments = 48): number[][] {
  const T = TREAT_DISPENSER;
  const e1: Vec3 = [1, 0, 0], e2: Vec3 = [0, UP_D[2], -UP_D[1]];
  const point = (angle: number, r: number, along: number): number[] => [0, 1, 2].map(k => (l.mouth[k] ?? 0) + r * (Math.cos(angle) * (e1[k] ?? 0) + Math.sin(angle) * (e2[k] ?? 0)) + along * (UP_D[k] ?? 0));
  // along the axis from the level mouth to where this generator reaches z = mouthClear in D
  const start = (angle: number, r: number) => Math.max(0, (T.mouthClear - l.mouth[2] - r * Math.sin(angle) * e2[2]) / UP_D[2]);
  return Array.from({ length: segments }, (_, i) => {
    const a0 = 2 * Math.PI * i / segments, a1 = 2 * Math.PI * (i + 1) / segments;
    const out: number[] = [];
    for (const a of [a0, a1]) for (const r of [T.tubeBore / 2, T.tubeBore / 2 + T.tubeWall]) out.push(...point(a, r, start(a, r)), ...point(a, r, tubeLength));
    return out;
  });
}

/** The feed tube's pose: drawn in W about the adapter's seat (its flange's top at the origin), printed upside down, flange on the bed. */
export const feedPose = (placement: ReturnType<typeof treatDispenserPlacement>): Pose => ({ position: placement.seatW, rotation: [180, 0, 0] });

/* -------------------------------------------------------------------------------------------------------------------------------
 * The SCAD file's numbers: every dimension the generator draws, from this file, so that CAD, physics and assembly cannot drift
 * ----------------------------------------------------------------------------------------------------------------------------- */

/** The motor screw, its nut and the case/board fasteners from the parts library. */
export const TREAT_FASTENERS = { screw: 'iso-4762-m3x10', nut: 'iso-4032-m3', insert: 'cnc-kitchen-m3x5-7', boardScrew: 'iso-4762-m2-5x8' } as const;

/** The pinion's outline and pieces are turned by this (degrees) so that a tooth faces the gear's gap at the start. */
export const pinionPhase = (l: TreatDispenserLayout): number => 90 % (360 / l.pinion.teeth);

/** Every value the generator needs, as `[name, value]` pairs (an OpenSCAD list it looks names up in). */
export function treatScadValues(p: TreatDispenserParameters): [string, number | number[] | number[][] | boolean][] {
  const placement = treatDispenserPlacement(p);
  const { l } = placement;
  const T = TREAT_DISPENSER;
  const frames = printFrames(l);
  const bay = treatBayLayout(p);
  const nut = findPart(TREAT_FASTENERS.nut), boardScrew = findPart(TREAT_FASTENERS.boardScrew), insert = findPart(TREAT_FASTENERS.insert), motor = motorPart();
  if (!nut || !boardScrew || !insert) throw new Error('Missing treat dispenser fasteners.');
  const round = (value: number) => Math.round(value * 1e6) / 1e6;
  const points = (polygon: Point2[]) => polygon.map(([x, y]) => [round(x), round(y)]);
  const phase = pinionPhase(l);
  const turnPoint = ([x, y]: Point2, a: number): Point2 => [x * Math.cos(a * DEG) - y * Math.sin(a * DEG), x * Math.sin(a * DEG) + y * Math.cos(a * DEG)];
  const frame = (f: PrintFrame) => [f.flip ? 1 : 0, ...f.offset];
  // the bracket's two arms meet lugs on the plate's rim at ±X (D), in W
  const lugs = [-1, 1].map(side => posePoint(placement.discPose, [side * (l.plateRadius + 6), 0, l.plateBottom]));
  return [
    ['BETA', BETA], ['ROT', DISC_ROTATION], ['OFFSET', placement.offset],
    ['TD', l.discThickness], ['DISC_R', round(l.discRadius)], ['NOTCH', points(placeRadial(roundedRect(l.notchLength, l.notchWidth + 3, 2.5), 0, l.notchInner + (l.notchWidth + 3) / 2))],
    ['NOTCH_ANGLES', l.notchAngles], ['OUTLET', points(outletOutline(l))],
    ['PLATE_TOP', l.plateTop], ['PLATE_BOTTOM', l.plateBottom], ['PLATE_R', round(l.plateRadius)],
    ['SPINDLE', T.spindle], ['SPINDLE_FLAT', T.spindleFlat], ['FIT', T.fit],
    ['GEAR', points(spurGearOutline(l.gear, 6))], ['GEAR_TIP', spurGearRadii(l.gear).tip],
    ['PINION', points(spurGearOutline(l.pinion, 6).map(q => turnPoint(q, phase)))], ['PINION_TIP', spurGearRadii(l.pinion).tip],
    ['GEAR_TOP', l.gearTop], ['GEAR_BOTTOM', l.gearBottom], ['PINION_AT', [...l.pinionAt]], ['CAN_AT', [...l.canAt]],
    ['COVER_FRONT', l.coverFront], ['COVER_BACK', l.coverBack], ['EAR_SPAN', l.earSpan],
    ['BOSS_D', dimensionOf(motor, 'db', 'max')], ['SHAFT_D', dimensionOf(motor, 'd', 'max')], ['SHAFT_FLATS', dimensionOf(motor, 's', 'max')],
    ['CHUTE_FLOOR', round(l.chuteFloor)], ['CHUTE_DEPTH', T.chuteDepth], ['CHUTE_WALL', T.chuteWall], ['WALL', T.wall],
    ['RIM_IN', round(l.rimInner)], ['RIM_OUT', round(l.rimOuter)], ['LID', T.lid], ['LID_TOP', l.lidTop],
    ['MOUTH', [...l.mouth]], ['MOUTH_CLEAR', T.mouthClear], ['UP', UP_D.map(round)], ['TUBE_BORE', T.tubeBore], ['TUBE_WALL', T.tubeWall], ['TUBE_LENGTH', round(placement.tubeLength)],
    ['NECK_T', l.neck.T], ['NECK_E', l.neck.E], ['NECK_BORE', l.neck.bore], ['NECK_PITCH', l.neck.pitch], ['NECK_TURNS', round(l.neck.turns)], ['NECK_RING', l.neck.ring],
    ['THREAD_CLEARANCE', p.threadClearance], ['ADAPTER_H', placement.adapterHeight],
    ['M3_HOLE', ISO_273_CLEARANCE_HOLES.M3.medium], ['M3_NUT_S', dimensionOf(nut, 's', 'max')], ['M3_NUT_M', dimensionOf(nut, 'm', 'max')],
    ['M25_PILOT', 2.2], ['M25_LENGTH', dimensionOf(boardScrew, 'l')], ['INSERT_HOLE', dimensionOf(insert, 'hole')], ['INSERT_DEPTH', dimensionOf(insert, 'holeDepth')],
    ['F_DISC', frame(frames.disc)], ['F_GEAR', frame(frames.gear)], ['F_PINION', frame(frames.pinion)], ['F_BODY', frame(frames.body)], ['F_COVER', frame(frames.cover)], ['F_HOPPER', frame(frames.hopper)],
    ['WALL_Y', round(placement.wallY)], ['LUGS', lugs.map(q => q.map(round))], ['SEAT_W', placement.seatW.map(round)], ['BOTTLE_D', p.bottleDiameter],
    ['POD', [bay.pod.x0, bay.pod.x1, round(bay.pod.y0), round(bay.pod.y1), round(bay.pod.z0), round(bay.pod.z1)]],
    ['POD_WALL', POD.wall], ['POD_COVER', POD.cover], ['POD_R', POD.radius], ['POD_PLUG', POD.plugRoom], ['LID_PROUD', POD.lidProud],
    ['FEED_COLLAR', TREAT_FEED.collar], ['FEED_COLLAR_H', TREAT_FEED.collarHeight], ['FEED_TAB', [...TREAT_FEED.tab]], ['FEED_TAB_PAD', TREAT_FEED.tabPad], ['FEED_FIT', TREAT_FEED.fit], ['FEED_BOSS', TREAT_FEED.boss],
    ['F_FEED', [...feedPose(placement).position.map(round), ...feedPose(placement).rotation]],
    ['MOTOR_D', dimensionOf(motor, 'D')], ['MOTOR_L', dimensionOf(motor, 'L')], ['HOUSING_W', dimensionOf(motor, 'bw', 'max')], ['HOUSING_R', dimensionOf(motor, 'bh')],
    ['EAR_R', dimensionOf(motor, 'r')], ['HOOD_WALL', HOOD.wall], ['HOOD_CLEAR', HOOD.clearance], ['HOOD_EAR_GAP', HOOD.earGap], ['HOOD_TAB', HOOD.tab], ['F_HOOD', frame(frames.hood)],
    ['MOTOR_FACE', l.motorFace], ['F_POD_COVER', [...podCoverPose(bay).position.map(round), ...podCoverPose(bay).rotation]],
    ['DRIVER_POS', bay.driverPose.position.map(round)], ['DRIVER_HOLES', driverHoles()],
    ['CASE_POS', bay.caseFrame.position.map(round)], ['CASE_ROT', bay.caseFrame.rotation],
    // the case base in its own assembly's frame: its centre at x = y = 0, from its floor up to the lid's roof
    ['CASE_BASE', [25.8, 21.8, round(esp32CaseGround(DEFAULT_ESP32_CASE) + esp32CaseBase(DEFAULT_ESP32_CASE).floorBottom), round(esp32CaseGround(DEFAULT_ESP32_CASE) + ESP32_CASE.lidRoof)]],
  ];
}

/** The ULN2003 board's mounting holes, in its own frame (its corner at the origin). */
function driverHoles(): number[][] {
  const part = findPart('uln2003-stepper-driver-board'), layout = part ? stepperDriverLayout(part) : undefined;
  if (!layout) throw new Error('Missing the ULN2003 board.');
  return layout.holes.map(hole => [hole.x, hole.y]);
}

/** `treatScadValues` as an OpenSCAD literal. */
export function treatScadLayout(p: TreatDispenserParameters): string {
  const literal = (value: number | number[] | number[][] | boolean): string => typeof value === 'boolean' ? String(value) : JSON.stringify(value);
  return `[${treatScadValues(p).map(([name, value]) => `["${name}",${literal(value)}]`).join(',')}]`;
}

/* -------------------------------------------------------------------------------------------------------------------------------
 * The assembly
 * ----------------------------------------------------------------------------------------------------------------------------- */

export const TREAT_PRINTED_PARTS = ['disc', 'gear', 'pinion', 'body', 'cover', 'hood', 'hopper', 'feed', 'adapter', 'coupon', 'bracket', 'pod-cover', 'case-bottom', 'case-top'] as const;

/** The electronics pod's cover pose: drawn in W, printed outer face down (W +Y up, the pod's top edge at the origin). */
export const podCoverPose = (bay: BayLayout): Pose => ({ position: [0, bay.pod.y0 - POD.cover, bay.pod.z1], rotation: [-90, 0, 0] });

const HOUSING = '#5d6b70';

export function treatDispenserAssembly(p: TreatDispenserParameters): Assembly {
  const placement = treatDispenserPlacement(p);
  const { l } = placement;
  const frames = printFrames(l);
  const bay = treatBayLayout(p);
  const caseAssembly = esp32CaseAssembly(DEFAULT_ESP32_CASE);
  const inCase = (id: string) => {
    const pose = caseAssembly.poses[id];
    if (!pose) throw new Error(`The ESP32 case has no ${id}.`);
    return composePose(bay.caseFrame, pose);
  };
  const motor = motorPart(), driver = findPart('uln2003-stepper-driver-board'), board = findPart(ESP32_CASE_BOARD), header = caseAssembly.references?.find(reference => reference.id === 'header-1');
  if (!driver || !board || !header) throw new Error('Missing the treat dispenser’s electronics.');
  const along = (d: readonly number[], length: number): Vec3 => d2w(d).map(value => value * length) as Vec3;
  const coupon: Pose = { position: [-90, placement.wallY - 30, 0], rotation: [0, 0, 0] };
  return {
    // one housing colour for everything that is shell or frame, the moving mechanism and the bottle's parts set apart
    partColors: {
      disc: '#e8d9a8', gear: '#c98f3a', pinion: '#c98f3a', body: HOUSING, cover: HOUSING, hood: HOUSING, hopper: '#d9dfe0', feed: '#d9dfe0',
      adapter: '#d9822b', coupon: '#d9822b', bracket: HOUSING, 'pod-cover': HOUSING, 'case-bottom': '#497c85', 'case-top': '#e5d9bb',
    },
    poses: {
      disc: discPartPose(placement, frames.disc), gear: discPartPose(placement, frames.gear), pinion: discPartPose(placement, frames.pinion),
      body: discPartPose(placement, frames.body), cover: discPartPose(placement, frames.cover), hood: discPartPose(placement, frames.hood),
      hopper: discPartPose(placement, frames.hopper), feed: feedPose(placement),
      adapter: { position: placement.seatW, rotation: [0, 0, 0] }, coupon, 'pod-cover': podCoverPose(bay),
      bracket: { position: [0, placement.wallY + 3, 0], rotation: [90, 0, 0] },
      'case-bottom': inCase('bottom'), 'case-top': inCase('top'),
      motor: composePose(placement.discPose, { position: [l.canAt[0], l.canAt[1], l.motorFace - l.motorLength] }),
      driver: bay.driverPose,
      board: inCase('board'), 'header-1': inCase('header-1'), 'header-2': inCase('header-2'),
    },
    references: [
      { id: 'motor', part: motor.id, title: motor.title },
      { id: 'driver', part: driver.id, title: driver.title },
      { id: 'board', part: board.id, title: board.title },
      { id: 'header-1', part: header.part, title: `${header.title.replace(/ \(row \d\)$/, '')} (row 1)` },
      { id: 'header-2', part: header.part, title: `${header.title.replace(/ \(row \d\)$/, '')} (row 2)` },
    ],
    steps: [
      { title: 'Screw the motor to the cover by its ears (M3 × 10, nuts on the gearbox side), the hood’s tabs under the screw heads', parts: ['motor', 'hood'], from: along([0, 0, -1], 30) },
      { title: 'Push the pinion onto the motor’s flatted shaft', parts: ['pinion'], from: along([0, 0, 1], 25) },
      { title: 'Slide the gear’s spindle up through the body’s bushing', parts: ['gear'], from: along([0, 0, -1], 30) },
      { title: 'Close the gearbox: screw the cover into the body’s heat-set inserts', parts: ['cover', 'motor', 'hood', 'pinion'], from: along([0, 0, -1], 40) },
      { title: 'Drop the disc onto the spindle’s D, index mark to the chamber’s mark', parts: ['disc'], from: along([0, 0, 1], 40) },
      { title: 'Screw the chamber onto the plate', parts: ['hopper'], from: along([0, 0, 1], 60) },
      { title: 'Push the feed tube through the lid until its collar sits on it; two M3 screws into the lid’s inserts', parts: ['feed'], from: [0, 0, 120] },
      { title: 'Screw the bottle adapter onto the feed tube', parts: ['adapter'], from: [0, 0, 160] },
      { title: 'Hang the dispenser on the wall bracket: two M3 screws through the arms and the plate’s lugs', parts: ['bracket'], from: [0, 90, 0] },
      { title: 'Screw the ULN2003 board to its standoffs in the pod; plug in the motor', parts: ['driver'], from: [0, -12, 0] },
      { title: 'Slide the ESP32-C3 case into the pod’s side, USB-C down, lid outwards', parts: ['case-bottom', 'case-top', 'board', 'header-1', 'header-2'], from: [40, 0, 0] },
      { title: 'Close the pod with its cover (four M2.5 screws)', parts: ['pod-cover'], from: [0, -20, -30] },
    ],
    lift: 60,
  };
}

/* -------------------------------------------------------------------------------------------------------------------------------
 * CI scenarios (npm run check:physics -- treat-dispenser). The wider study of fills and treat variations is
 * tools/physics/treat-dispenser-trials.ts; docs/treat-dispenser.md reports both.
 * ----------------------------------------------------------------------------------------------------------------------------- */

/** How long one move of `degrees` takes with the firmware's speed and acceleration (a trapezoid), s. */
function moveSeconds(degrees: number): number {
  const v = firmwareDegrees(TREAT_FIRMWARE.halfSteps), a = firmwareDegrees(TREAT_FIRMWARE.acceleration), d = Math.abs(degrees);
  return d < v * v / a ? 2 * Math.sqrt(d / a) : d / v + v / a;
}
/** One dispense cycle from the press to the controller's "done", s (two moves, the pause, the settle, the debounce). */
export function treatCycleSeconds(): number {
  const half = firmwareDegrees(treatCycleSteps() / 2);
  return TREAT_FIRMWARE.debounce + 2 * moveSeconds(half) + TREAT_FIRMWARE.pause + TREAT_FIRMWARE.settle;
}

export function treatDispenserScenarios(placement: ReturnType<typeof treatDispenserPlacement>, count: number, seed: number, mode: FillMode): PhysicsScenario[] {
  const { l } = placement;
  const cycle = treatCycleSeconds() + 0.15;
  const settle = 0.8;
  const press = (control: string, at: number, hold = 0.1): PhysicsDrive => ({ kind: 'press', control, at, hold });
  const counter = (at: number, value: number, id = 'out'): PhysicsCheck => ({ kind: 'counter', at, counter: id, min: value, max: value });

  const state = (at: number, name: string): PhysicsCheck => ({ kind: 'controller', at, field: 'state', state: name });
  const field = (at: number, name: 'cycles' | 'rejected' | 'queued' | 'idleExits', min: number, max = min): PhysicsCheck => ({ kind: 'controller', at, field: name, min, max });
  // a fingertip (a 1 mm ball, kinematic: it does not give) in the space of the notch at rest left of the outlet: a foreign object
  const notch = l.notchAngles[0] ?? 45, r = l.notchInner + l.notchWidth / 2;
  const obstruction = posePoint(placement.discPose, [r * Math.cos(notch * DEG), r * Math.sin(notch * DEG), -l.discThickness / 2]);
  const presses = 4;
  const primeEnd = settle + 2 * cycle + 0.3;
  // Whether each press releases exactly one is not asserted here: in the trials it does not always (docs/treat-dispenser.md). CI
  // asserts what does hold: real treats leave through the chute while cycles run, never between them, never into the gearbox.
  const dispense: PhysicsScenario = {
    id: 'prime-and-dispense', title: `Filled (${count} treats, fill ${mode} ${seed}): Prime (up to two out), then ${presses} presses: treats actually leave through the chute, none between cycles, none into the gearbox`,
    duration: primeEnd + presses * cycle + 0.3,
    drives: [press('prime', settle), ...Array.from({ length: presses }, (_, k) => press('boot', primeEnd + k * cycle))],
    checks: [
      { kind: 'counter', at: primeEnd - 0.05, counter: 'out', min: 0, max: 2 },
      { kind: 'counter', at: primeEnd + presses * cycle + 0.25, counter: 'out', min: 1 },
      field(primeEnd + presses * cycle + 0.25, 'cycles', presses), field(primeEnd + presses * cycle + 0.25, 'idleExits', 0),
      counter(primeEnd + presses * cycle + 0.25, 0, 'dry'),
    ],
  };
  return [
    dispense,
    {
      id: 'idle', title: 'Filled and left alone for 6 s: no treat leaves, none reaches the gearbox', duration: 6,
      checks: [counter(6, 0), counter(6, 0, 'dry'), field(6, 'idleExits', 0)],
    },
    {
      id: 'empty', title: 'Empty bottle: Prime and two presses command four cycles and release nothing (no fabricated success)', items: [],
      duration: settle + 4.3 * cycle, drives: [press('prime', settle), press('boot', settle + 2 * cycle + 0.3), press('boot', settle + 3.1 * cycle + 0.3)],
      checks: [counter(settle + 4.3 * cycle - 0.05, 0), field(settle + 4.3 * cycle - 0.05, 'cycles', 2)],
    },
    {
      id: 'jam', title: 'A foreign object stuck in a notch: the motor stalls against it (torque-limited, steps lost) instead of forcing the disc through, and the cycle is a fault', items: [],
      duration: 1 + cycle,
      drives: [{ kind: 'push', body: 'disc', point: obstruction, timeline: [[0, 0, 0, -0.0001], [100, 0, 0, -0.0002]] }, press('boot', 0.5)],
      checks: [
        { kind: 'joint', at: 0.5 + cycle, body: 'disc', min: 0, max: 30 },
        { kind: 'contact', at: 0.5 + cycle, bodies: ['disc', 'drive-0'], touching: true },
        { kind: 'controller', at: 0.5 + cycle, field: 'lost', min: TREAT_FIRMWARE.stall },
        state(0.5 + cycle, 'fault'),
      ],
    },
    {
      id: 'reset', title: 'RESET mid-cycle stops the motor and reboots without moving; presses during boot and while unaligned are rejected; after a jog and “aligned” one press runs one cycle', items: [],
      duration: 7.5 + cycle,
      drives: [press('boot', 0.3), press('reset', 1.6), press('boot', 1.8), press('boot', 3.2), press('jog', 3.6), press('aligned', 5.0), press('boot', 5.4)],
      checks: [
        state(1.75, 'booting'), state(3.0, 'unaligned'), field(3.0, 'cycles', 0), field(3.5, 'rejected', 2),
        state(5.3, 'ready'), field(5.4 + cycle + 0.2, 'cycles', 1), state(5.4 + cycle + 0.2, 'ready'),
      ],
    },
    {
      id: 'hold-and-burst', title: 'BOOT held 3 s runs one cycle, not more; then three quick presses run one, queue one and reject one', items: [],
      duration: 0.4 + 4 * cycle,
      drives: [press('boot', 0.3, 3), press('boot', 0.4 + cycle), press('boot', 0.6 + cycle), press('boot', 0.8 + cycle)],
      checks: [
        field(0.35 + cycle, 'cycles', 1), field(1.0 + cycle, 'queued', 1), field(1.0 + cycle, 'rejected', 1),
        field(0.4 + 3 * cycle, 'cycles', 3), field(0.4 + 3 * cycle, 'queued', 0),
      ],
    },
  ];
}
