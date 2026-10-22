import { Type, type Static } from 'typebox';
import type { Assembly, ParameterIssue } from './models.ts';
import type { PhysicsBody, PhysicsCheck, PhysicsController, PhysicsCounter, PhysicsDrive, PhysicsScenario, PhysicsSpec } from './physics.ts';
import { DEFAULT_ESP32_CASE, esp32CaseAssembly, esp32CaseGround, ESP32_CASE, ESP32_CASE_BOARD } from './esp32Case.ts';
import { devBoardLayout, dimensionOf, findPart, ISO_273_CLEARANCE_HOLES, stepperDriverLayout } from './parts/index.ts';
import type { Point2 } from './physicsPieces.ts';

/**
 * A gumball-style treat dispenser (docs/treat-dispenser.md, issue #138), after bovineblitz's "Cat treat gumball-style dispenser"
 * (MakerWorld 190887, CC BY-NC 4.0), itself after cylus80's "Mason Jar Candy Dispenser" (Thingiverse 2103924, CC BY 4.0). An
 * inverted 0.5 l PET bottle screws into the top of the body; its treats fall through a funnel onto a horizontal rotor with two
 * pockets, which a 28BYJ-48 turns directly (in place of the original's handle); each half turn a pocket carries what it holds from
 * under the funnel to the drop below it, onto a chute that runs out of the front. The ULN2003 board and the ESP32-C3 SuperMini case
 * live inside the body, the case's lid flush in its back wall so that B and R can be pressed.
 *
 * One frame for everything, the assembled frame W: Z up, the floor at z = 0, the rotor's axis along X at y = 0, the chute running out
 * towards −Y (the front). All lengths mm, angles degrees. Each part is drawn in W and printed in its own orientation (its pose).
 */

export const TREAT_DISPENSER = {
  /** The rotor: radius, the solid hub beyond each end of its pockets, its gap in the bore. Two pockets, opposite each other. */
  rotorRadius: 13, rotorHub: 4, boreGap: 0.4, pockets: 2,
  wall: 2.4,
  /** The slot over the rotor is as long as a pocket (X) and this much wider than one each side (Y). */
  slotMargin: 1,
  /** Funnel height, from the top of the rotor's block to the bottle's lip. */
  funnel: 8,
  /** The chute: its slope; the rotor's clearance above it (more than a treat is long, so that none can be caught between them); the
   * height of its end above the base and where it ends (y); its wall and floor. The body's front face (y). */
  chuteSlope: 30, dropClear: 15, exitZ: 6, chuteEnd: -44, chuteWall: 1.6, chuteFloor: 2, chuteSide: 14, front: -38,
  /** The body: half its width (X) and its back face (y). */
  halfWidth: 40, back: 49,
  /** The base plate: its thickness, and how far it reaches past the body at least (but not under the chute's end). */
  base: 3, baseMargin: 8,
  /** The bottle's thread: how high above the lip the boss reaches, and its wall outside the thread. */
  threadHeight: 18, bossWall: 3,
  /** The bearing cap at the rotor's −X end: flange thickness and radius; the rotor's stub into it (diameter, length). */
  capFlange: 3, capRadius: 19, stub: 8, stubLength: 4.5,
  /** Behind the flap, round the rotor's descending side, a cavity this much deeper than the rotor: more than a treat is long, so that a
   * treat carried past the flap can neither be pinched nor wedge across it. */
  cavityClear: 15,
  /** The flap (TPU) that closes the slot's back edge on the rotor: thickness, its root's bead, how far it is sprung past touching
   * (degrees), its stiffness (N·mm per degree: a 1.2 × 16 × 10 mm strip of 95A TPU, E ≈ 26 MPa) and mass (g). */
  flap: { thickness: 1.2, bead: 2.6, preload: 5, stiffness: 0.3, mass: 0.25 },
} as const;

/** Bottle necks with an ISBT drawing (drawings 3784253-21 and 1165362-2). Values read off the drawings; see docs/treat-dispenser.md. */
export const BOTTLE_NECKS = {
  'pco-1881': { title: 'PCO 1881 (28 mm CSD, ISBT 3784253-21)', T: 27.40, E: 24.20, bore: 21.72, pitch: 2.70, starts: 1, turns: 650 / 360, ring: 33.0 },
  'pco-1810': { title: 'PCO 1810 (28 mm CSD, ISBT 1165362-2)', T: 27.43, E: 24.51, bore: 21.74, pitch: 3.18, starts: 1, turns: 720 / 360, ring: 33.0 },
} as const;
export type BottleNeck = keyof typeof BOTTLE_NECKS;

const mm = (title: string, description: string, value: number, minimum: number, maximum: number, multipleOf = 0.1) =>
  Type.Number({ title, description, default: value, minimum, maximum, multipleOf });
export const TreatDispenserParametersSchema = Type.Object({
  treatLength: mm('Treat length', 'Longest side of the treats, mm. Measure the largest of a bag; the rotor’s pockets are sized from it.', 14, 10, 18),
  treatWidth: mm('Treat width', 'Middle side of the treats, mm.', 9, 6, 12),
  treatThickness: mm('Treat thickness', 'Thinnest side of the treats, mm. A pocket is as deep as this plus the clearance.', 5, 3, 7),
  treatCornerRadius: mm('Treat corner radius', 'Rounding of the treats’ edges and corners, mm (used by the simulation only).', 1.5, 0.5, 2.5),
  pocketClearance: mm('Pocket clearance', 'Play round a treat in a rotor pocket, mm. More takes bigger treats, and lets two thin ones in.', 1, 0.4, 2, 0.05),
  bottleNeck: Type.Enum(Object.keys(BOTTLE_NECKS) as BottleNeck[], { title: 'Bottle neck', description: 'The thread of the bottle that screws into the top. Print the thread coupon first: real bottles vary.', default: 'pco-1881' }),
  threadClearance: mm('Thread clearance', 'Radial play of the body’s thread on the bottle’s, mm; tune it with the coupon.', 0.3, 0.1, 0.8, 0.05),
  bottleDiameter: mm('Bottle diameter', 'Largest diameter of the bottle, mm (0.5 l PET bottles are about 65 mm). Sets the base plate’s size so that a full bottle cannot easily tip the dispenser over.', 65, 55, 95, 1),
}, { additionalProperties: false });
export type TreatDispenserParameters = Static<typeof TreatDispenserParametersSchema>;
export const DEFAULT_TREAT_DISPENSER = Object.fromEntries(Object.entries(TreatDispenserParametersSchema.properties).map(([key, p]) => [key, 'default' in p ? p.default : undefined])) as TreatDispenserParameters;

export type Vec3 = [number, number, number];
const DEG = Math.PI / 180;
const motorPart = () => findPart('kiatronics-28byj-48-5v') ?? (() => { throw new Error('Missing 28BYJ-48.'); })();

/** Every dimension of the dispenser for these parameters (W). */
export function treatDispenserLayout(p: TreatDispenserParameters) {
  const T = TREAT_DISPENSER;
  const c = p.pocketClearance;
  const pocket = { length: p.treatLength + 2 * c, width: p.treatWidth + 2 * c, depth: p.treatThickness + c };
  const R = T.rotorRadius, rotorEnd = pocket.length / 2 + T.rotorHub;
  const bore = { radius: R + T.boreGap, half: rotorEnd + T.boreGap };
  const block = { halfX: bore.half + T.wall, halfY: bore.radius + T.wall };
  const slot = { halfX: pocket.length / 2, halfY: pocket.width / 2 + T.slotMargin };
  // the chute: inside as wide as the slot is long plus play; the body's legs hold it between them
  const chuteIn = slot.halfX + 0.5, chuteOut = chuteIn + T.chuteWall, legIn = chuteOut + 0.2, legOut = legIn + T.wall;
  const tan = Math.tan(T.chuteSlope * DEG);
  const chuteAt = (y: number) => T.base + T.exitZ + (y - T.chuteEnd) * tan;
  // the rotor's underside is `dropClear` above the chute wherever a pocket drops (|y| ≤ the slot's half width)
  const axisZ = chuteAt(slot.halfY) + T.dropClear + R;
  // the flap hangs from the slot's back wall, its root higher over the rotor than a treat can stand out of a pocket, its tip on the
  // rotor just behind the slot; behind it the cavity, under a roof at the flap's root
  const cavityR = R + T.cavityClear;
  const root = { y: slot.halfY, z: axisZ + R + (p.treatLength - pocket.depth) + 2 };
  const tipY = slot.halfY + 1, tip = { y: tipY, z: axisZ + Math.sqrt(R * R - tipY * tipY) };
  const flap = { root, tip, length: Math.hypot(tip.y - root.y, root.z - tip.z), angle: Math.atan2(tip.y - root.y, root.z - tip.z) / DEG };
  const blockBottom = axisZ - block.halfY, blockTop = root.z + T.wall, blockBack = cavityR + T.wall;
  const lipZ = blockTop + T.funnel;
  const neck = BOTTLE_NECKS[p.bottleNeck];
  const threadR = neck.T / 2 + p.threadClearance, bossR = threadR + T.bossWall, lipR = neck.bore / 2 + 0.5;
  const bossTop = lipZ + T.threadHeight;
  // the motor: its shaft on the rotor's axis, its can below it (Kiatronics: the shaft is 8 mm off the can's axis), its mounting face
  // on the block's +X face, its wire housing down
  const motor = motorPart();
  const shaftOffset = dimensionOf(motor, 'e'), motorLength = dimensionOf(motor, 'L'), earSpan = dimensionOf(motor, 'a'), canR = dimensionOf(motor, 'D') / 2;
  return {
    pocket, R, rotorEnd, bore, block, slot, chuteIn, chuteOut, legIn, legOut, tan, chuteAt, axisZ, blockBottom, blockTop, blockBack, cavityR, flap, lipZ, lipR, neck, threadR, bossR, bossTop,
    motorFace: block.halfX, canZ: axisZ - shaftOffset, canR, motorLength, earSpan, shaftOffset,
    halfWidth: T.halfWidth, front: T.front, back: T.back,
    /** The chute's top end, under the back of the cavity. */
    chuteBack: blockBack,
  };
}
export type TreatDispenserLayout = ReturnType<typeof treatDispenserLayout>;

export function treatDispenserIssues(p: TreatDispenserParameters): ParameterIssue[] {
  const issues: ParameterIssue[] = [];
  const l = treatDispenserLayout(p);
  if (p.treatWidth > p.treatLength) issues.push({ field: 'treatWidth', message: 'The width must not exceed the length: give the sides longest first.' });
  if (p.treatThickness > p.treatWidth) issues.push({ field: 'treatThickness', message: 'The thickness must not exceed the width.' });
  if (2 * p.treatCornerRadius > p.treatThickness - 0.2) issues.push({ field: 'treatCornerRadius', message: 'The corner radius must be less than half the thickness.' });
  // the pockets' floors must leave a core round the axis for the motor's shaft (Ø5)
  if (l.R - l.pocket.depth < 5) issues.push({ field: 'treatThickness', message: 'Treats this thick leave too little of the rotor under its pockets.' });
  if (l.pocket.width / 2 > l.R - 3) issues.push({ field: 'treatWidth', message: 'Treats this wide do not fit the rotor’s pockets.' });
  return issues;
}

/* -------------------------------------------------------------------------------------------------------------------------------
 * Poses: rotations as matrices, so that print orientations and the ESP32 case's own assembly compose exactly
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
 * Parts and where they stand. Each is drawn in W; its pose maps its print frame (as its SCAD exports it, on the bed) to W.
 * ----------------------------------------------------------------------------------------------------------------------------- */

export function treatPartPoses(l: TreatDispenserLayout): Record<'body' | 'base' | 'chute' | 'rotor' | 'cap' | 'flap', Pose> {
  const T = TREAT_DISPENSER;
  return {
    // upright on its open bottom, as it stands
    body: { position: [0, 0, T.base], rotation: [0, 0, 0] },
    base: { position: [0, 0, 0], rotation: [0, 0, 0] },
    // on its +X side wall
    chute: { position: [l.chuteOut, 0, 0], rotation: [0, -90, 0] },
    // its axis up, the motor's end (+X) on the bed
    rotor: { position: [l.rotorEnd, 0, l.axisZ], rotation: [0, -90, 0] },
    // its flange down
    cap: { position: [-(l.block.halfX + T.capFlange), 0, l.axisZ], rotation: [0, 90, 0] },
    // flat, its root's bead along X at the origin: drawn hanging from the root along −Z, turned back by its angle, then laid down
    flap: { position: [0, l.flap.root.y, l.flap.root.z], rotation: [l.flap.angle - 90, 0, 0] },
  };
}

/** Convex pieces drawn in W, in a part's own (print) frame. */
const piecesIn = (pose: Pose, pieces: number[][]): number[][] => pieces.map(piece => {
  const out: number[] = [];
  for (let i = 0; i < piece.length; i += 3) out.push(...poseLocal(pose, [piece[i] ?? 0, piece[i + 1] ?? 0, piece[i + 2] ?? 0]));
  return out;
});

/** A box as one convex piece. */
const box = (x0: number, x1: number, y0: number, y1: number, z0: number, z1: number): number[] =>
  [z0, z1].flatMap(z => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]].flatMap(([x = 0, y = 0]) => [x, y, z]));

/* -------------------------------------------------------------------------------------------------------------------------------
 * Collision pieces: the surfaces a treat can touch, from the same layout as the SCAD file
 * ----------------------------------------------------------------------------------------------------------------------------- */

/** A convex polygon (in the (y, z) section) clipped by half-planes a·y + b·z ≤ c. */
function clipSection(polygon: Point2[], cuts: [number, number, number][]): Point2[] {
  let poly = polygon;
  for (const [a, b, c] of cuts) {
    const out: Point2[] = [];
    poly.forEach((q, i) => {
      const r = poly[(i + 1) % poly.length] ?? q, fq = c - a * q[0] - b * q[1], fr = c - a * r[0] - b * r[1];
      if (fq >= 0) out.push(q);
      if (fq * fr < 0) { const t = fq / (fq - fr); out.push([q[0] + t * (r[0] - q[0]), q[1] + t * (r[1] - q[1])]); }
    });
    poly = out;
  }
  return poly;
}

/**
 * The rotor about its axis (along X; at rest, its pockets at the top and the bottom): its two end hubs as full cylinders and, between
 * them, its section less the two pockets as five convex prisms: the band between the pockets' floors and four side lobes.
 */
export function treatRotorPieces(l: TreatDispenserLayout, segments = 32): number[][] {
  const { R, rotorEnd, pocket, axisZ } = l;
  const half = pocket.length / 2, floor = R - pocket.depth, w = pocket.width / 2;
  const circle: Point2[] = Array.from({ length: segments }, (_, i): Point2 => [R * Math.cos(2 * Math.PI * i / segments), R * Math.sin(2 * Math.PI * i / segments)]);
  const prism = (section: Point2[], x0: number, x1: number) => [x0, x1].flatMap(x => section.flatMap(([y, z]) => [x, y, axisZ + z]));
  const band = clipSection(circle, [[0, 1, floor], [0, -1, floor]]);
  const lobes = [1, -1].flatMap(sy => [1, -1].map(sz => clipSection(circle, [[-sy, 0, -w], [0, -sz, -floor]])));
  return [
    prism(circle, -rotorEnd, -half), prism(circle, half, rotorEnd),
    prism(band, -half, half), ...lobes.filter(lobe => lobe.length >= 3).map(lobe => prism(lobe, -half, half)),
  ];
}

/**
 * The body where treats go, as convex pieces: the thread's bore above the lip (the bottle's neck stands in it), the deck the lip rests
 * on, the funnel from the lip to the slot, and below the slot the housing's section (YZ) carried across between the slot's side walls:
 * the slot's front wall and the tight bore on the rotor's rising (front) side down to the drop, the slot's back wall down to the flap's
 * root, the cavity's roof and its arc round the descending (back) side down to the chute; the side walls themselves; the legs.
 */
export function treatBodyPieces(l: TreatDispenserLayout, segments = 24): number[][] {
  const T = TREAT_DISPENSER;
  const { slot, bore, axisZ, blockTop, lipZ, lipR, threadR, bossTop, legIn, legOut, cavityR, flap, blockBack, chuteAt } = l;
  const t = T.wall, x0 = -slot.halfX, x1 = slot.halfX;
  const pieces: number[][] = [];
  const annulus = (r0: number, r1: number, z0: number, z1: number, n: number) => Array.from({ length: n }, (_, i) => {
    const a0 = 2 * Math.PI * i / n, a1 = 2 * Math.PI * (i + 1) / n;
    return [z0, z1].flatMap(z => [[r0, a0], [r0, a1], [r1, a1], [r1, a0]].flatMap(([r = 0, a = 0]) => [r * Math.cos(a), r * Math.sin(a), z]));
  });
  pieces.push(...annulus(threadR, threadR + t, lipZ, bossTop, segments), ...annulus(lipR, threadR, lipZ - t, lipZ, segments));
  // the funnel: from the lip's circle down to the slot's rectangle, one slab per segment
  const rect = (a: number): Point2 => {
    const c = Math.cos(a), s = Math.sin(a);
    const k = Math.min(Math.abs(c) > 1e-9 ? slot.halfX / Math.abs(c) : Infinity, Math.abs(s) > 1e-9 ? slot.halfY / Math.abs(s) : Infinity);
    return [k * c, k * s];
  };
  for (let i = 0; i < segments; i++) {
    const a0 = 2 * Math.PI * i / segments, a1 = 2 * Math.PI * (i + 1) / segments;
    const pts: number[] = [];
    for (const a of [a0, a1]) {
      const [bx, by] = rect(a);
      for (const d of [0, t]) pts.push((lipR + d) * Math.cos(a), (lipR + d) * Math.sin(a), lipZ - t, bx + d * Math.cos(a), by + d * Math.sin(a), blockTop);
    }
    pieces.push(pts);
  }
  // a quad of the section (y, z) carried across between the side walls
  const across = (quad: [number, number][]) => [x0, x1].flatMap(x => quad.flatMap(([y, z]) => [x, y, z]));
  const arc = (r: number, from: number, to: number, n: number) => Array.from({ length: n }, (_, i) => {
    // angles from straight up, towards +Y (the back)
    const a0 = (from + (to - from) * i / n) * DEG, a1 = (from + (to - from) * (i + 1) / n) * DEG;
    const pt = (a: number, rr: number): [number, number] => [rr * Math.sin(a), axisZ + rr * Math.cos(a)];
    return across([pt(a0, r), pt(a1, r), pt(a1, r + t), pt(a0, r + t)]);
  });
  // the slot's front wall, down to where it meets the bore; the tight bore round the front, down to the drop's front edge
  const slotFront = Math.asin(slot.halfY / bore.radius) / DEG;
  pieces.push(across([[-slot.halfY - t, axisZ + bore.radius * Math.cos(slotFront * DEG)], [-slot.halfY, axisZ + bore.radius * Math.cos(slotFront * DEG)], [-slot.halfY, blockTop], [-slot.halfY - t, blockTop]]));
  pieces.push(...arc(bore.radius, -slotFront, -150, 10));
  // the drop's front wall, down to the chute
  const dropY = -bore.radius * Math.sin(30 * DEG), dropTop = axisZ - bore.radius * Math.cos(30 * DEG);
  pieces.push(across([[dropY - t, chuteAt(dropY) - 1], [dropY, chuteAt(dropY) - 1], [dropY, dropTop], [dropY - t, dropTop]]));
  // the slot's back wall down to the flap's root, the cavity's roof from there to its arc, the arc down to the chute
  pieces.push(across([[flap.root.y, flap.root.z], [flap.root.y + t, flap.root.z], [flap.root.y + t, blockTop], [flap.root.y, blockTop]]));
  const roofEnd = Math.sqrt(cavityR ** 2 - (flap.root.z - axisZ) ** 2);
  pieces.push(across([[flap.root.y, flap.root.z], [roofEnd, flap.root.z], [roofEnd, flap.root.z + t], [flap.root.y, flap.root.z + t]]));
  const roofAngle = Math.acos((flap.root.z - axisZ) / cavityR) / DEG;
  // the arc ends where it meets the chute
  let footAngle = roofAngle;
  while (footAngle < 180 && axisZ + cavityR * Math.cos(footAngle * DEG) > chuteAt(cavityR * Math.sin(footAngle * DEG))) footAngle += 1;
  pieces.push(...arc(cavityR, roofAngle, footAngle, Math.max(2, Math.ceil((footAngle - roofAngle) / 10))));
  // the side walls, over the whole section, from the chute to the top of the block
  for (const [a, b] of [[x0 - t, x0], [x1, x1 + t]] as const) pieces.push(box(a, b, dropY - t, blockBack, chuteAt(dropY) - 1, blockTop));
  // the legs either side of the chute, from the base to the side walls
  pieces.push(box(-legOut, -legIn, dropY - t, blockBack, T.base, chuteAt(dropY) - 1), box(legIn, legOut, dropY - t, blockBack, T.base, chuteAt(dropY) - 1));
  return pieces;
}

/** The flap (W, at rest on the rotor): a plate from its root to its tip, across the slot. */
export function treatFlapPieces(l: TreatDispenserLayout): number[][] {
  const { root, tip } = l.flap;
  const t = TREAT_DISPENSER.flap.thickness;
  // its face towards the slot (front) is the line root–tip; the plate lies behind it
  const d = [tip.y - root.y, tip.z - root.z], n = Math.hypot(d[0] ?? 0, d[1] ?? 0);
  const back: [number, number] = [-(d[1] ?? 0) / n * t, (d[0] ?? 0) / n * t];
  const quad: [number, number][] = [[root.y, root.z], [tip.y, tip.z], [tip.y + back[0], tip.z + back[1]], [root.y + back[0], root.z + back[1]]];
  return [[-l.slot.halfX + 0.2, l.slot.halfX - 0.2].flatMap(x => quad.flatMap(([y, z]) => [x, y, z]))];
}

/** The chute (W): its floor (sloped), its side walls and its top end. */
export function treatChutePieces(l: TreatDispenserLayout): number[][] {
  const T = TREAT_DISPENSER;
  const { chuteIn, chuteOut, chuteAt, chuteBack } = l;
  const y0 = T.chuteEnd, y1 = chuteBack;
  const slab = (x0: number, x1: number, below: number, above: number) => [-below, above].flatMap(dz =>
    [[x0, y0], [x1, y0], [x1, y1], [x0, y1]].flatMap(([x = 0, y = 0]) => [x, y, chuteAt(y) + dz]));
  return [
    slab(-chuteIn, chuteIn, T.chuteFloor, 0),
    slab(-chuteOut, -chuteIn, T.chuteFloor, T.chuteSide), slab(chuteIn, chuteOut, T.chuteFloor, T.chuteSide),
    box(-chuteOut, chuteOut, y1 - T.chuteWall, y1, chuteAt(y1) - T.chuteFloor, chuteAt(y1) + T.chuteSide),
  ];
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
 * Where `count` treats start (W: centre and rotation): packed without overlap in the funnel and the thread's bore above it (where the
 * bottle's neck is), each placed as low as it fits so that none falls far (soft contacts let a fast treat sink into a wall).
 */
export function treatFill(p: TreatDispenserParameters, count: number, seed: number, mode: FillMode): { centre: Vec3; rotation: Mat3 }[] {
  const l = treatDispenserLayout(p);
  const random = lcg(seed);
  const half: Vec3 = [p.treatLength / 2 + 0.2, p.treatWidth / 2 + 0.2, p.treatThickness / 2 + 0.2];
  const orient = (): Quat => {
    const spin = qaxis([0, 0, 1], random() * 2 * Math.PI);
    switch (mode) {
      case 'flat': return spin;
      case 'edge': return qmul(spin, qaxis([1, 0, 0], Math.PI / 2));
      case 'end': return qmul(spin, qaxis([0, 1, 0], Math.PI / 2));
      case 'diagonal': return qmul(spin, qaxis([1, 1, 0], Math.PI / 4));
      default: return qmul(spin, qaxis([random() - 0.5, random() - 0.5, random() - 0.5], random() * Math.PI));
    }
  };
  // a box's corners: their farthest reach from its centre across (in X and Y) and up
  const reach = (m: Mat3) => {
    let x = 0, y = 0, up = 0;
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) {
      const q = apply(m, [sx * half[0], sy * half[1], sz * half[2]]);
      x = Math.max(x, q[0]); y = Math.max(y, q[1]); up = Math.max(up, q[2]);
    }
    return { x, y, up, r: Math.hypot(x, y) };
  };
  // the room at height z, as half extents in X and Y: the slot's rectangle at the block's top, widening up the funnel to the lip's
  // circle, then the bottle's neck (the thread's bore, here)
  const lipRoom = l.lipR - 0.3;
  const room = (z: number): [number, number] => {
    if (z >= l.lipZ) return [lipRoom / Math.SQRT2, lipRoom / Math.SQRT2];
    const f = Math.max(0, (z - l.blockTop) / (l.lipZ - l.blockTop));
    return [l.slot.halfX + (lipRoom / Math.SQRT2 - l.slot.halfX) * f - 0.3, l.slot.halfY + (lipRoom / Math.SQRT2 - l.slot.halfY) * f - 0.3];
  };
  const placed: { c: Vec3; m: Mat3 }[] = [];
  const free = (c: Vec3, m: Mat3) => !placed.some(other => boxesOverlap(other, { c, m }, half));
  for (let i = 0; i < count; i++) {
    let done = false;
    for (let attempt = 0; attempt < 400 && !done; attempt++) {
      const m = qmat(orient()), r = reach(m);
      for (let z = l.blockTop + r.up + 0.5; z < l.bossTop + 400 && !done; z += 0.5) {
        const rooms = [room(z - r.up), room(z), room(z + r.up)];
        const sx = Math.min(...rooms.map(q => q[0])) - r.x, sy = Math.min(...rooms.map(q => q[1])) - r.y;
        if (sx < 0 || sy < 0) continue;
        const c: Vec3 = [(random() * 2 - 1) * sx, (random() * 2 - 1) * sy, z];
        if (free(c, m)) { placed.push({ c, m }); done = true; }
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
 * The motor, as the simulation takes it, turning the rotor directly. Torque: the 28BYJ-48's pull-in torque, 300 gf·cm (29.4 N·mm) at
 * 5 V, as Components101's table gives it. It falls with speed and with a sagging supply: unverified, so the jam scenario checks only
 * that it stalls rather than forcing anything. Its stiffness is that torque over one full step at the output shaft (11.25° / 64 ≈
 * 0.18°); its inertia (its rotor through the 1:64 gearbox) is assumed, 0.2 g·m².
 */
export const TREAT_MOTOR = { torque: 29.4, stiffness: 165.8, damping: 0.7, inertia: 2e5, slip: 0.35 } as const;

/**
 * The firmware's cycle (models/treat-dispenser/esphome/treat_dispenser.h): forward half a turn, the full pocket over the drop, the next
 * one under the funnel. It never turns back: backwards, the slot's tight front edge would become the edge the pockets leave under, and
 * could pinch a treat (`rock` stays 0; the logic supports one). 700 half-steps/s with a 4076-step turn is 61.8°/s at the rotor.
 */
export const TREAT_FIRMWARE = {
  stepsPerTurn: 4076, halfSteps: 700, acceleration: 2000, debounce: 0.03, queue: 1, boot: 0.6, pause: 0.2, settle: 0.5, prime: 1, jogSteps: 23,
  stall: 10, rock: 0 as number,
} as const;
export const firmwareDegrees = (steps: number): number => steps * 360 / TREAT_FIRMWARE.stepsPerTurn;
/** Motor steps per dispense cycle, net: one pocket pitch of the rotor (two pockets: half a turn). */
export const treatCycleSteps = (): number => TREAT_FIRMWARE.stepsPerTurn / TREAT_DISPENSER.pockets;

/**
 * The electronics inside the body (W): the ESP32 case's own assembly (esp32CaseAssembly, its parts and boards as that model places
 * them) upright left of the rotor's block, its lid flush in a window of the back wall so that B and R are pressed from behind, USB-C at
 * its lower end (the cable comes in through a notch at the foot of the back wall); the ULN2003 board on standoffs off the right side
 * wall, under the motor. `bootPoint` and `resetPoint` are the buttons' actuators in the lid's own frame (its outer face), from the
 * board library's button positions.
 */
export interface BayLayout { caseFrame: Pose; driverPose: Pose; bootPoint: Vec3; resetPoint: Vec3; usb: Vec3 }
export const BAY = { lidProud: 0.5, caseLength: 25.8, caseWidth: 21.8, driverStandoff: 4, plugRoom: 25, gap: 0.3 } as const;

export function treatBayLayout(p: TreatDispenserParameters): BayLayout {
  const l = treatDispenserLayout(p);
  const T = TREAT_DISPENSER;
  const caseAssembly = esp32CaseAssembly(DEFAULT_ESP32_CASE);
  const board = findPart(ESP32_CASE_BOARD), layout = board ? devBoardLayout(board) : undefined;
  const boardPose = caseAssembly.poses['board'], lidPose = caseAssembly.poses['top'];
  if (!layout || !boardPose || !lidPose) throw new Error('The ESP32 case has no board or lid.');
  // case +X → +Z (its USB end, at −X, down), case +Y → +X, case +Z (lid out) → +Y (the back)
  const roof = esp32CaseGround(DEFAULT_ESP32_CASE) + ESP32_CASE.lidRoof;
  const inner = l.halfWidth - T.wall;
  const caseFrame: Pose = {
    position: [-inner + BAY.gap + BAY.caseWidth / 2, l.back + BAY.lidProud - roof, T.base + BAY.plugRoom + BAY.caseLength / 2],
    rotation: rotationAngles([[0, 1, 0], [0, 0, 1], [1, 0, 0]]),
  };
  const button = (prefix: string): Vec3 => {
    const component = layout.components.find(candidate => candidate.name.startsWith(prefix));
    if (!component) throw new Error(`The SuperMini has no ${prefix} button.`);
    const local = poseLocal(lidPose, posePoint(boardPose, [component.x, component.y, 0]));
    // on the lid's outer face (z = 0 of the roof-down lid)
    return [local[0], local[1], 0];
  };
  // the USB-C receptacle: at the case's −X end, level with the board
  const usb = posePoint(caseFrame, [-BAY.caseLength / 2, 0, esp32CaseGround(DEFAULT_ESP32_CASE) + 1.6]);
  return {
    caseFrame, bootPoint: button('BOOT'), resetPoint: button('RST'), usb,
    // the board (35.3 × 31.4) on the right side wall, its parts facing in (−X): board +X → +Y, +Y → +Z, +Z → −X
    driverPose: { position: [inner - BAY.driverStandoff, 8, T.base + T.wall + 1], rotation: rotationAngles([[0, 0, -1], [1, 0, 0], [0, 1, 0]]) },
  };
}

export interface TreatDispenserPhysicsOptions { treats?: number; seed?: number; mode?: FillMode; /** false: leave the CI scenarios out (the editor does not run them). */ scenarios?: boolean }

/** The treats' bodies for a fill (W poses). */
export function treatItems(p: TreatDispenserParameters, count: number, seed: number, mode: FillMode) {
  const vertices = treatVertices(p);
  return treatFill(p, count, seed, mode).map((treat, index) => ({
    id: `treat-${index + 1}`, title: `Treat ${index + 1}`, group: 'treats', vertices,
    // a dry treat of 14 × 9 × 5 mm: about 0.5 g (unmeasured; see docs/treat-dispenser.md)
    mass: 0.5 * (p.treatLength * p.treatWidth * p.treatThickness) / (14 * 9 * 5),
    friction: 0.4,
    pose: { position: treat.centre, rotation: rotationAngles(treat.rotation) },
  }));
}

/**
 * How far past the chute's end a treat's centre must be before it counts as out: half its longest diagonal (14 × 9 × 5 mm: 8.7), so
 * that no part of it is still on the chute. A treat stuck in the chute, or resting on its lip, never counts.
 */
export const TREAT_EXIT_MARGIN = 9;

/** The outlet counter: a plane `TREAT_EXIT_MARGIN` beyond the chute's end, crossed outwards (−Y); its box reaches back up the chute. */
export function treatOutletCounter(p: TreatDispenserParameters): PhysicsCounter {
  const l = treatDispenserLayout(p);
  const T = TREAT_DISPENSER;
  return {
    id: 'out', title: 'Treats out of the chute (past its end)', group: 'treats', kind: 'crossing',
    point: [0, T.chuteEnd - TREAT_EXIT_MARGIN, 0], along: [0, -1, 0],
    min: [-40, T.chuteEnd - 150, -200], max: [40, l.chuteBack, l.axisZ],
  };
}

export function treatDispenserPhysics(p: TreatDispenserParameters, options: TreatDispenserPhysicsOptions = {}): PhysicsSpec {
  const l = treatDispenserLayout(p);
  const T = TREAT_DISPENSER;
  const poses = treatPartPoses(l);
  const count = options.treats ?? 10;
  const items = treatItems(p, count, options.seed ?? 1, options.mode ?? 'random');
  const firmware = TREAT_FIRMWARE;
  const turn = firmwareDegrees(treatCycleSteps());
  const bay = treatBayLayout(p);
  // forward is negative about +X: the rotor's top runs to the back (a pocket leaves the slot over its back edge), its underside to
  // the front, down the chute
  const controller: PhysicsController = {
    motor: 'motor', moves: firmware.rock > 0 ? [firmware.rock, -(turn + firmware.rock)] : [-turn], pause: firmware.pause, settle: firmware.settle, debounce: firmware.debounce, queue: firmware.queue,
    boot: firmware.boot, prime: firmware.prime, jog: -firmwareDegrees(firmware.jogSteps), stall: firmware.stall, counter: 'out',
    controls: [
      { id: 'boot', title: 'BOOT button (GPIO9): command one dispense cycle', label: 'B', action: 'dispense', body: 'case-top', point: bay.bootPoint },
      { id: 'reset', title: 'RESET button (EN): reboot, never dispenses', label: 'R', action: 'reset', body: 'case-top', point: bay.resetPoint },
      { id: 'prime', title: 'Prime (Home Assistant action): one turn to fill the pocket under the funnel', label: 'P', action: 'prime' },
      { id: 'jog', title: 'Jog (Home Assistant action): turn the rotor a little forwards', label: 'J', action: 'jog' },
      { id: 'aligned', title: 'Aligned (Home Assistant action): the index marks line up', label: 'A', action: 'aligned' },
    ],
  };
  const fixed = (id: string, pieces: number[][]): PhysicsBody => ({ id, material: 'petg', fixed: true, collision: { kind: 'pieces', pieces } });
  return {
    // treats in contact with a motor-driven rotor need short steps and the precise solve
    maxStep: 0.0001, precise: true,
    bodies: [
      {
        id: 'rotor', material: 'petg', collision: { kind: 'pieces', pieces: piecesIn(poses.rotor, treatRotorPieces(l)) },
        // quasi-static added inertia and a little bearing friction keep the light rotor from rattling against the treats
        inertia: 2e6, joint: { type: 'hinge', anchor: [0, 0, l.axisZ], axis: [1, 0, 0], friction: 2 },
      },
      fixed('body', piecesIn(poses.body, treatBodyPieces(l))),
      fixed('chute', piecesIn(poses.chute, treatChutePieces(l))),
      {
        // the flap, sprung against the rotor: a treat standing out of a pocket bends it back and passes under it
        id: 'flap', material: 'petg', mass: T.flap.mass, collision: { kind: 'pieces', pieces: piecesIn(poses.flap, treatFlapPieces(l)) },
        joint: { type: 'hinge', anchor: [0, l.flap.root.y, l.flap.root.z], axis: [1, 0, 0], spring: { rest: -T.flap.preload, stiffness: T.flap.stiffness }, damping: 0.002, range: [-T.flap.preload - 5, 100] },
      },
    ],
    exclude: [['rotor', 'body'], ['rotor', 'chute'], ['flap', 'body'], ['flap', 'chute']],
    motors: [{ id: 'motor', title: '28BYJ-48 (output shaft, on the rotor)', body: 'rotor', ...TREAT_MOTOR, speed: firmwareDegrees(firmware.halfSteps), acceleration: firmwareDegrees(firmware.acceleration) }],
    items,
    counters: [
      treatOutletCounter(p),
      {
        id: 'stray', title: 'Treats inside the body, off their path (the electronics)', group: 'treats', kind: 'inside',
        min: [-l.halfWidth, l.block.halfY + 1, T.base], max: [l.halfWidth, l.back, l.blockTop],
      },
    ],
    controller,
    scenarios: options.scenarios === false ? [] : treatDispenserScenarios(p, count, options.seed ?? 1, options.mode ?? 'random'),
  };
}

/* -------------------------------------------------------------------------------------------------------------------------------
 * Standing: the base plate's size, from what tips the dispenser over with a full bottle
 * ----------------------------------------------------------------------------------------------------------------------------- */

/**
 * A full PET bottle (a cylinder of the bottle's diameter, as tall as 0.5 l of that diameter, of treats at 0.45 g/cm³ bulk, plus 25 g
 * of bottle) above the body (assumed 200 g at a third of its height): the base reaches far enough round that the dispenser leans at
 * least `TIP_ANGLE` before it tips. Returns [x0, x1, y0, y1] of the plate; at the front it stops short of the chute's end.
 */
export const TIP_ANGLE = 20;
export function treatFootprint(p: TreatDispenserParameters): [number, number, number, number] {
  const l = treatDispenserLayout(p);
  const T = TREAT_DISPENSER;
  const r = p.bottleDiameter / 20, height = 500 / (Math.PI * r * r) * 10; // mm, 0.5 l at that diameter
  const bottle = 0.45 * 500 + 25, body = 200; // g
  const zc = (bottle * (l.bossTop + height / 2 - 15) + body * l.bossTop / 3) / (bottle + body);
  const reach = Math.max(l.halfWidth + T.baseMargin, zc * Math.tan(TIP_ANGLE * DEG));
  return [-reach, reach, Math.max(T.chuteEnd + 2, -reach), Math.max(l.back + T.baseMargin, reach)];
}

/* -------------------------------------------------------------------------------------------------------------------------------
 * The SCAD file's numbers: every dimension the generator draws, from this file, so that CAD, physics and assembly cannot drift
 * ----------------------------------------------------------------------------------------------------------------------------- */

/** The motor screws, their nuts, the inserts for the base and the cap, and the ULN2003's screws, from the parts library. */
export const TREAT_FASTENERS = { screw: 'iso-4762-m3x10', nut: 'iso-4032-m3', insert: 'cnc-kitchen-m3x5-7', boardScrew: 'iso-4762-m2-5x8' } as const;

/** Every value the generator needs, as `[name, value]` pairs (an OpenSCAD list it looks names up in). */
export function treatScadValues(p: TreatDispenserParameters): [string, number | number[] | number[][] | boolean][] {
  const l = treatDispenserLayout(p);
  const T = TREAT_DISPENSER;
  const bay = treatBayLayout(p);
  const poses = treatPartPoses(l);
  const nut = findPart(TREAT_FASTENERS.nut), boardScrew = findPart(TREAT_FASTENERS.boardScrew), insert = findPart(TREAT_FASTENERS.insert), motor = motorPart();
  if (!nut || !boardScrew || !insert) throw new Error('Missing treat dispenser fasteners.');
  const round = (value: number) => Math.round(value * 1e6) / 1e6;
  const pose = (q: Pose) => [...q.position.map(round), ...q.rotation];
  return [
    ['WALL', T.wall], ['BASE', T.base], ['HALF_W', l.halfWidth], ['FRONT', l.front], ['BACK', l.back], ['BASE_RECT', treatFootprint(p).map(round)],
    ['R', l.R], ['ROTOR_END', round(l.rotorEnd)], ['POCKET', [round(l.pocket.length), round(l.pocket.width), round(l.pocket.depth)]], ['POCKETS', T.pockets],
    ['BORE_R', round(l.bore.radius)], ['BORE_HALF', round(l.bore.half)], ['BLOCK', [round(l.block.halfX), round(l.block.halfY)]], ['SLOT', [round(l.slot.halfX), round(l.slot.halfY)]],
    ['AXIS_Z', round(l.axisZ)], ['BLOCK_BOTTOM', round(l.blockBottom)], ['BLOCK_TOP', round(l.blockTop)], ['BLOCK_BACK', round(l.blockBack)], ['CAVITY_R', round(l.cavityR)],
    ['FLAP', [round(l.flap.root.y), round(l.flap.root.z), round(l.flap.length), round(l.flap.angle), T.flap.thickness, T.flap.bead]], ['LIP_Z', round(l.lipZ)], ['LIP_R', round(l.lipR)], ['BOSS_TOP', round(l.bossTop)],
    ['CHUTE', [round(l.chuteIn), round(l.chuteOut), round(l.legIn), round(l.legOut)]], ['CHUTE_END', T.chuteEnd], ['CHUTE_BACK', round(l.chuteBack)],
    ['CHUTE_SLOPE', T.chuteSlope], ['EXIT_Z', T.base + T.exitZ], ['CHUTE_FLOOR', T.chuteFloor], ['CHUTE_WALL', T.chuteWall], ['CHUTE_SIDE', T.chuteSide],
    ['NECK_T', l.neck.T], ['NECK_E', l.neck.E], ['NECK_BORE', l.neck.bore], ['NECK_PITCH', l.neck.pitch], ['NECK_TURNS', round(l.neck.turns)],
    ['THREAD_CLEARANCE', p.threadClearance], ['THREAD_R', round(l.threadR)], ['BOSS_R', round(l.bossR)],
    ['MOTOR_FACE', round(l.motorFace)], ['CAN_Z', round(l.canZ)], ['CAN_R', l.canR], ['MOTOR_L', l.motorLength], ['EAR_SPAN', l.earSpan],
    ['BOSS_D', dimensionOf(motor, 'db', 'max')], ['SHAFT_D', dimensionOf(motor, 'd', 'max')], ['SHAFT_FLATS', dimensionOf(motor, 's', 'max')],
    ['HOUSING_W', dimensionOf(motor, 'bw', 'max')], ['HOUSING_R', dimensionOf(motor, 'bh')],
    ['CAP', [T.capFlange, T.capRadius, T.stub, T.stubLength]],
    ['M3_HOLE', ISO_273_CLEARANCE_HOLES.M3.medium], ['M3_NUT_S', dimensionOf(nut, 's', 'max')], ['M3_NUT_M', dimensionOf(nut, 'm', 'max')],
    ['M25_PILOT', 2.2], ['INSERT_HOLE', dimensionOf(insert, 'hole')], ['INSERT_DEPTH', dimensionOf(insert, 'holeDepth')],
    ['CASE_POS', bay.caseFrame.position.map(round)], ['CASE_ROT', bay.caseFrame.rotation], ['USB', bay.usb.map(round)],
    ['DRIVER_POS', bay.driverPose.position.map(round)], ['DRIVER_HOLES', driverHoles()],
    ['P_BODY', pose(poses.body)], ['P_CHUTE', pose(poses.chute)], ['P_ROTOR', pose(poses.rotor)], ['P_CAP', pose(poses.cap)], ['P_FLAP', pose(poses.flap)],
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

export const TREAT_PRINTED_PARTS = ['body', 'rotor', 'flap', 'cap', 'chute', 'base', 'coupon', 'case-bottom', 'case-top'] as const;

const HOUSING = '#cdbfe3';

export function treatDispenserAssembly(p: TreatDispenserParameters): Assembly {
  const l = treatDispenserLayout(p);
  const poses = treatPartPoses(l);
  const bay = treatBayLayout(p);
  const caseAssembly = esp32CaseAssembly(DEFAULT_ESP32_CASE);
  const inCase = (id: string) => {
    const pose = caseAssembly.poses[id];
    if (!pose) throw new Error(`The ESP32 case has no ${id}.`);
    return composePose(bay.caseFrame, pose);
  };
  const motor = motorPart(), driver = findPart('uln2003-stepper-driver-board'), board = findPart(ESP32_CASE_BOARD), header = caseAssembly.references?.find(reference => reference.id === 'header-1');
  if (!driver || !board || !header) throw new Error('Missing the treat dispenser’s electronics.');
  const coupon: Pose = { position: [-110, 0, 0], rotation: [0, 0, 0] };
  // the motor's own frame: its can's back at z = 0, its mounting face at z = L, the shaft at +Y; here the shaft points −X along the
  // rotor's axis, 8 mm above the can's axis
  const motorPose: Pose = { position: [l.motorFace + l.motorLength, 0, l.canZ], rotation: rotationAngles([[0, 0, -1], [-1, 0, 0], [0, 1, 0]]) };
  return {
    partColors: { body: HOUSING, base: '#3d3f45', chute: HOUSING, rotor: '#2f3136', flap: '#d9822b', cap: '#2f3136', coupon: '#d9822b', 'case-bottom': '#497c85', 'case-top': '#e5d9bb' },
    poses: {
      body: poses.body, base: poses.base, chute: poses.chute, rotor: poses.rotor, flap: poses.flap, cap: poses.cap, coupon,
      'case-bottom': inCase('bottom'), 'case-top': inCase('top'),
      motor: motorPose, driver: bay.driverPose,
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
      { title: 'Screw the motor to the block’s side inside the body (M3 × 10, nuts behind)', parts: ['motor'], from: [0, 0, -80] },
      { title: 'Snap the flap’s bead into its groove under the cavity’s roof, through the bore', parts: ['flap'], from: [-70, 0, 0] },
      { title: 'Slide the rotor into its bore from the left, onto the motor’s flatted shaft', parts: ['rotor'], from: [-70, 0, 0] },
      { title: 'Close the bore with the bearing cap (two M3 screws into inserts)', parts: ['cap'], from: [-40, 0, 0] },
      { title: 'Screw the ULN2003 board to its standoffs on the back wall; plug in the motor', parts: ['driver'], from: [0, 0, -80] },
      { title: 'Push the ESP32-C3 case into the back wall’s window, lid out, USB-C to the side', parts: ['case-bottom', 'case-top', 'board', 'header-1', 'header-2'], from: [0, 0, -80] },
      { title: 'Slide the chute in between the legs, from the front', parts: ['chute'], from: [0, -60, 0] },
      { title: 'Screw the base plate on (four M3 screws into inserts)', parts: ['base'], from: [0, 0, -40] },
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
/** One dispense cycle from the press to the controller's "done", s (the debounce, the turn, the settle). */
export function treatCycleSeconds(): number {
  const turn = firmwareDegrees(treatCycleSteps());
  const rock = TREAT_FIRMWARE.rock;
  return TREAT_FIRMWARE.debounce + (rock > 0 ? moveSeconds(rock) + TREAT_FIRMWARE.pause : 0) + moveSeconds(turn + rock) + TREAT_FIRMWARE.settle;
}

export function treatDispenserScenarios(p: TreatDispenserParameters, count: number, seed: number, mode: FillMode): PhysicsScenario[] {
  const l = treatDispenserLayout(p);
  const cycle = treatCycleSeconds() + 0.15;
  const settle = 0.8;
  const press = (control: string, at: number, hold = 0.1): PhysicsDrive => ({ kind: 'press', control, at, hold });
  const counter = (at: number, value: number, id = 'out'): PhysicsCheck => ({ kind: 'counter', at, counter: id, min: value, max: value });
  const state = (at: number, name: string): PhysicsCheck => ({ kind: 'controller', at, field: 'state', state: name });
  const field = (at: number, name: 'cycles' | 'rejected' | 'queued' | 'idleExits', min: number, max = min): PhysicsCheck => ({ kind: 'controller', at, field: name, min, max });
  // a fingertip (a 1 mm ball, kinematic: it does not give) in the pocket under the funnel, at its back: a foreign object
  const obstruction: Vec3 = [0, l.pocket.width / 2 - 1.5, l.axisZ + l.R - l.pocket.depth / 2];
  const presses = 4;
  const primeEnd = settle + cycle + 0.3;
  // Whether each press releases exactly one is not asserted: the owner accepts 0, 1 or several (docs/treat-dispenser.md). CI asserts
  // what must hold: real treats leave down the chute while cycles run, never between them, none strays into the electronics.
  const dispense: PhysicsScenario = {
    id: 'prime-and-dispense', title: `Filled (${count} treats, fill ${mode} ${seed}): Prime, then ${presses} presses: treats actually leave down the chute, none between cycles, none into the electronics`,
    duration: primeEnd + presses * cycle + 0.3,
    drives: [press('prime', settle), ...Array.from({ length: presses }, (_, k) => press('boot', primeEnd + k * cycle))],
    checks: [
      { kind: 'counter', at: primeEnd + presses * cycle + 0.25, counter: 'out', min: 1 },
      field(primeEnd + presses * cycle + 0.25, 'cycles', presses), field(primeEnd + presses * cycle + 0.25, 'idleExits', 0),
      counter(primeEnd + presses * cycle + 0.25, 0, 'stray'),
    ],
  };
  return [
    dispense,
    {
      id: 'idle', title: 'Filled and left alone for 6 s: no treat leaves, none strays', duration: 6,
      checks: [counter(6, 0), counter(6, 0, 'stray'), field(6, 'idleExits', 0)],
    },
    {
      id: 'empty', title: 'Empty bottle: Prime and two presses command three cycles and release nothing (no fabricated success)', items: [],
      duration: settle + 3.3 * cycle, drives: [press('prime', settle), press('boot', settle + cycle + 0.3), press('boot', settle + 2.1 * cycle + 0.3)],
      checks: [counter(settle + 3.3 * cycle - 0.05, 0), field(settle + 3.3 * cycle - 0.05, 'cycles', 2)],
    },
    {
      id: 'jam', title: 'A foreign object stuck in a pocket: the motor stalls against it (torque-limited, steps lost) instead of forcing the rotor through, and the cycle is a fault', items: [],
      duration: 1 + cycle,
      drives: [{ kind: 'push', body: 'rotor', point: obstruction, timeline: [[0, 0, 0, 0], [100, 0, 0, 0]] }, press('boot', 0.5)],
      checks: [
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
