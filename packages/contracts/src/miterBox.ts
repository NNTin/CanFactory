import { Type, type Static } from 'typebox';
import type { Assembly, LinkedReference, ParameterIssue } from './models.ts';
import { dimensionOf, findPart, ISO_273_CLEARANCE_HOLES, parts, type Part } from './parts/index.ts';
import { PRESSURE_PAD, pressurePadMinDiameter, pressurePadMinHeight } from './pressurePad.ts';

/**
 * Adjustable miter box (models/miter-box/generator.scad, docs/miter-box.md): an original design. A base with a back fence and a
 * turntable whose arm carries the saw guide: two slotted posts, one behind the fence and one in front of the stock, on a line
 * through the pivot. The turntable turns in a round socket and is locked at any angle by a knob on the arm (friction: a screw
 * down through an arc slot into a nut that slides in a channel under the base); an index pin dropped through the turntable into
 * holes in the base stops it at 0, ±22.5 and ±45°. Two hold-downs behind the fence reach over the stock: each presses a
 * free-turning thrust pad (the pressure pad's) down onto the stock with a screw through a T-nut that slides along the
 * hold-down's slot, so the pad can be set anywhere across the stock's width, and the screw's travel takes any height.
 *
 * Frame: X along the fence, Y from the fence's face (y = 0) towards the user, Z up; the base's bottom at z = 0, the bed (the
 * surface the stock lies on) at z = `bed`. The pivot is at x = y = 0, on the fence's face. Angles turn counterclockwise about +Z;
 * the guide's line points along +Y at 0° (a square cut). All sizes in mm. This file is the single source of every dimension: the
 * generator gets them as one list (`miterBoxScadLayout`).
 */

/** Fixed design sizes. */
export const MITER_BOX = {
  /** The guide turns this far either way. */
  maxAngle: 45,
  /** Index-pin stops (both ways): the square cut and the octagon and picture-frame miters. */
  stops: [0, 22.5, 45],
  /** Scale: a tick every `tick`°, labelled at `labels`. */
  tick: 5, labels: [0, 15, 22.5, 30, 45],
  /** The turntable's and arm's thickness; the turntable's top is the bed. */
  arm: 7,
  /** The saw's kerf groove in the turntable, below the bed. */
  kerfDepth: 3,
  /** The base's top outside the bed and fence strip is this far below the bed, so a saw cutting through clears it by a millimetre. */
  apron: 4,
  /** The fence's thickness at the cut, and outside the turntable (where its screws are). */
  fence: 10, fenceOuter: 16,
  /** Gap between the turntable and the fence over it: the base raises the fence by this on pads outside the turntable. */
  fenceGap: 0.4,
  /** Each wall of a guide post, beside the slot. */
  postWall: 6,
  /** Lead-in chamfer at the top of each slot. */
  lead: 1,
  /** The bed's depth beyond the widest stock. */
  channelMargin: 2,
  /** Under the arm: solid between the arm's recess and the lock nut's channel, and room in the channel beyond the nut. */
  lockFloor: 3, lockChannel: 2.5,
  /** Clearance between the turning guide and everything it passes. */
  margin: 1,
  /** The knobs: pressure-pad feet with grip flutes, on the screws' heads (PART = pad, PAD_TYPE = foot). */
  knob: { diameter: 24, height: 12, grip: 12, surface: 'grooved', relief: 1 },
  /** The thrust pads (PART = pad, PAD_TYPE = thrust), flat-soled so they do not mark the stock. */
  pad: { diameter: 20, height: 17, surface: 'flat', relief: 1 },
  /** The index pin: an ISO 8734 dowel pin, its play in both holes, its depth in the base, and how far it stands above the turntable. */
  pin: 'iso-8734-5x20', pinPlay: 0.1, pinDepth: 5, pinLift: 5.2,
  /** The least stock height a hold-down presses, and how low (of the tallest stock) its screw must at least reach. */
  minHeight: 3, reach: 1 / 3,
  /** Each hold-down: its width (X), its column's depth (Y), the slot's lip over the T-nut's channel. */
  holdDown: { width: 16, column: 26, lip: 4 },
  /** The least ledge under a screw's head in a counterbore, and the gap over the screw's tip at the base's bottom. */
  ledge: 5, tip: 0.5,
  /** The base's margin round what it carries, and the wood screws that may fix it to a bench (four, countersunk). */
  baseMargin: 6, benchScrew: 'din-7997-4x30', sinkPlay: 0.4,
  /** Engraved marks: depth and line width; label size. */
  engrave: 0.6, line: 0.6, labelSize: 3.2,
} as const;

export const MITER_BOX_THREADS = ['M5', 'M6'] as const;
export type MiterBoxThread = typeof MITER_BOX_THREADS[number];
/** Regular nuts: the T-nuts, the lock nut and the base's nuts. */
export const MITER_BOX_NUTS = ['iso-4032-m5', 'iso-4032-m6'] as const;
/** Nylon-insert nuts on the clamp screws' tips, in the thrust pads (they stay put as the pad turns). */
export const MITER_BOX_PAD_NUTS = ['iso-10511-m5', 'iso-10511-m6'] as const;
/** The clamp screws: ISO 4017 hexagon head screws, whose heads lock in the knobs. */
export const MITER_BOX_CLAMP_SCREWS = [
  'iso-4017-m5x30', 'iso-4017-m5x40', 'iso-4017-m5x50', 'iso-4017-m6x30', 'iso-4017-m6x40', 'iso-4017-m6x50', 'iso-4017-m6x60',
] as const;

export const DEFAULT_MITER_BOX = {
  stockWidth: 30, stockHeight: 30, guideDepth: 25, guideLength: 16, bladeKerf: 1.2, slotClearance: 0.15,
  thread: 'M6', nut: 'iso-4032-m6', padNut: 'iso-10511-m6', clampScrew: 'iso-4017-m6x60', fit: 0.3,
} as const;

const mm = (title: string, description: string, value: number, minimum: number, maximum: number, step: number) =>
  Type.Number({ title, description, default: value, minimum, maximum, multipleOf: step });

export const MiterBoxParametersSchema = Type.Object({
  stockWidth: mm('Widest stock', 'The widest stock the box takes, across the bed from the fence, in mm. Sets the bed’s depth and how far out the guide’s front post stands.', DEFAULT_MITER_BOX.stockWidth, 15, 50, 1),
  stockHeight: mm('Tallest stock', 'The tallest stock the box takes, in mm: the fence is this high, the hold-downs clear it and the guide posts stand above it.', DEFAULT_MITER_BOX.stockHeight, 15, 50, 1),
  guideDepth: mm('Guide above the stock', 'How far the saw slots reach above the tallest stock, in mm: the saw is guided over this height when it starts a cut. Keep the posts lower than your saw’s blade is deep under its back.', DEFAULT_MITER_BOX.guideDepth, 15, 50, 1),
  guideLength: mm('Post length', 'Each guide post’s length along the saw, in mm; the two posts are about 100 mm apart.', DEFAULT_MITER_BOX.guideLength, 10, 30, 1),
  bladeKerf: mm('Saw kerf', 'The width of your saw’s cut (across its set teeth), in mm. Measure a test cut: a Japanese pull saw cuts about 0.5 mm, a tenon saw about 1 mm, a mitre saw 1.2 to 1.5 mm.', DEFAULT_MITER_BOX.bladeKerf, 0.4, 3, 0.05),
  slotClearance: mm('Slot clearance', 'Play each side of the saw in its slots, in mm. The slots are the kerf plus twice this wide.', DEFAULT_MITER_BOX.slotClearance, 0.05, 0.4, 0.01),
  thread: Type.Enum(MITER_BOX_THREADS, { title: 'Thread', description: 'The thread of every screw and nut; the nuts and the clamp screw below are those of this thread.', default: DEFAULT_MITER_BOX.thread }),
  nut: Type.Enum(MITER_BOX_NUTS, { title: 'Nut', description: 'The regular hexagon nut: the hold-downs’ T-nuts, the angle lock’s nut and the base’s nuts.', default: DEFAULT_MITER_BOX.nut }),
  padNut: Type.Enum(MITER_BOX_PAD_NUTS, { title: 'Pad nut', description: 'The nylon-insert nut run onto each clamp screw’s tip, which turns freely in its thrust pad.', default: DEFAULT_MITER_BOX.padNut }),
  clampScrew: Type.Enum(MITER_BOX_CLAMP_SCREWS, { title: 'Clamp screw', description: 'The hexagon head screw of each hold-down (its head locks in the knob). The longer, the lower the stock it reaches.', default: DEFAULT_MITER_BOX.clampScrew }),
  fit: mm('Fit', 'Play round the turntable, the arm, nuts and screws, on each side, in mm.', DEFAULT_MITER_BOX.fit, 0.1, 0.6, 0.05),
}, { additionalProperties: false, description: 'Adjustable miter box parameters. All fields are required; dimensions are in millimetres; the nuts and the screw are parts-library ids.' });
export type MiterBoxParameters = Static<typeof MiterBoxParametersSchema>;

type Point2 = [number, number];
type Vec3 = [number, number, number];
const rad = (degrees: number) => degrees * Math.PI / 180;
const turn = ([x, y]: Point2, degrees: number): Point2 => {
  const c = Math.cos(rad(degrees)), s = Math.sin(rad(degrees));
  return [x * c - y * s, x * s + y * c];
};
const round = (value: number, places = 3) => Math.round(value * 10 ** places) / 10 ** places;

const part = (id: string): Part => {
  const found = findPart(id);
  if (!found) throw new Error(`${id} is not a part of the library.`);
  return found;
};
const nutHeight = (nut: Part) => dimensionOf(nut, nut.dimensions['h'] ? 'h' : 'm', 'max');

/** The shortest screw of a standard and thread at least `least` long, if the library has one. */
function shortestScrew(standard: string, thread: string, least: number): Part | undefined {
  return parts.filter(p => p.family === 'screw' && p.attributes['standard'] === standard && p.attributes['thread'] === thread)
    .sort((a, b) => dimensionOf(a, 'l') - dimensionOf(b, 'l')).find(p => dimensionOf(p, 'l') >= least - 1e-9);
}

/** Points along a closed outline, every `step` mm. */
function outlinePoints(points: Point2[], step = 0.5): Point2[] {
  return points.flatMap((a, i) => {
    const b = points[(i + 1) % points.length] ?? a;
    const n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / step));
    return Array.from({ length: n }, (_, k): Point2 => [a[0] + (b[0] - a[0]) * k / n, a[1] + (b[1] - a[1]) * k / n]);
  });
}
const rectangle = (x0: number, x1: number, y0: number, y1: number): Point2[] => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
const circle = (cx: number, cy: number, r: number): Point2[] => Array.from({ length: 48 }, (_, i): Point2 => [cx + r * Math.cos(i * Math.PI / 24), cy + r * Math.sin(i * Math.PI / 24)]);

/** The largest |x| any of these outlines (in the guide's own frame) reaches inside the band y0..y1, over the guide's whole swing. */
function sweptReach(outlines: Point2[][], y0: number, y1: number): number {
  const points = outlines.flatMap(outline => outlinePoints(outline));
  let reach = 0;
  for (let angle = -MITER_BOX.maxAngle; angle <= MITER_BOX.maxAngle + 1e-9; angle += 0.25)
    for (const point of points) {
      const [x, y] = turn(point, angle);
      if (y >= y0 && y <= y1) reach = Math.max(reach, Math.abs(x));
    }
  return reach;
}

/** Every dimension of the box, from the settings and the library parts. */
export function miterBoxLayout(p: MiterBoxParameters) {
  const B = MITER_BOX, c45 = Math.cos(rad(B.maxAngle));
  const nut = part(p.nut), padNut = part(p.padNut), clampScrew = part(p.clampScrew), pin = part(B.pin);
  const thread = p.thread;
  const d = dimensionOf(nut, 'd'), nutS = dimensionOf(nut, 's', 'max'), nutM = nutHeight(nut), nutE = nutS * 2 / Math.sqrt(3);
  const hole = ISO_273_CLEARANCE_HOLES[thread].medium;
  const headS = dimensionOf(clampScrew, 's', 'max'), headK = dimensionOf(clampScrew, 'k', 'max');
  const pinD = dimensionOf(pin, 'd', 'max'), pinL = dimensionOf(pin, 'l');

  // the saw slot and the posts round it
  const slot = round(p.bladeKerf + 2 * p.slotClearance);
  const postWidth = slot + 2 * B.postWall, pl = p.guideLength;
  const W = p.stockWidth + B.channelMargin;

  // the angle lock's stack: the knob on the arm, the arm, the floor under it, the nut in its channel (pulled up against the floor)
  const lockNeeds = B.arm + B.lockFloor + nutM + 0.5;
  const lockScrew = shortestScrew('ISO 4017', thread, lockNeeds + PRESSURE_PAD.lip);
  if (!lockScrew) throw new Error(`The parts library has no ISO 4017 ${thread} screw for the angle lock.`);
  const lockShank = dimensionOf(lockScrew, 'l') - PRESSURE_PAD.lip;
  const bed = round(Math.max(B.arm + B.lockFloor + nutM + B.lockChannel, lockShank + B.tip, B.arm + B.pinDepth + 1.5));
  const lockCeiling = bed - B.arm - B.lockFloor;

  // the rear post stays behind the fence however the guide is turned; the index pin beside it
  const rearPost = round(postWidth / 2 + pl / 2 + (B.fence + B.margin) / c45);
  const pinR = pinD / 2 + B.pinPlay;
  const pinX = round(postWidth / 2 + 2.5 + pinR);
  const pinY = round(-Math.max(rearPost, (B.fence + 0.5 + pinR) / c45 + pinX));
  const turntable = round(Math.max(W + 2, rearPost + pl / 2 + 3, Math.hypot(pinX, pinY) + pinR + 3));
  // the front post stands in front of the widest stock however the guide is turned
  const frontPost = round((W + B.margin) / c45 + pl / 2 + postWidth / 2);
  // the lock knob: beside the saw's line (so the saw passes it), in front of the stock at any angle, clear of the front post
  const knobR = B.knob.diameter / 2;
  const knobX = round(-(knobR + slot / 2 + 2));
  const postFront = frontPost + pl / 2, postSide = -postWidth / 2;
  const besidePost = knobX + knobR + B.margin > postSide ? postFront + Math.sqrt(Math.max(0, (knobR + B.margin) ** 2 - (knobX - postSide) ** 2)) : 0;
  const knobY = round(Math.max((W + B.margin + knobR) / c45 + Math.abs(knobX), besidePost, postFront + B.margin));
  const armHalf = round(postWidth / 2 + 1);
  const armTip = round(knobY + knobR + 3);
  const wingR = knobR + 2;
  // the arm's outline in its own frame (the disc, the bar to the tip, the knob's wing), for the base's recess and the scale
  const armOutlines: Point2[][] = [circle(0, 0, turntable), rectangle(-armHalf, armHalf, 0, armTip), circle(knobX, knobY, wingR), rectangle(knobX, armHalf, knobY - wingR, knobY + wingR)];
  const armReach = Math.max(...armOutlines.flatMap(outline => outline.map(([x, y]) => Math.hypot(x, y))));
  const lockRadius = round(Math.hypot(knobX, knobY));
  const lockAngle = round(Math.atan2(knobY, knobX) * 180 / Math.PI);
  const postHeight = p.stockHeight + p.guideDepth;

  // the fence and its screws (socket head, down through counterbores into nuts under the base)
  const fenceHeight = p.stockHeight;
  const fenceScrew = shortestScrew('ISO 4762', thread, bed + B.fenceGap + B.ledge - B.tip);
  if (!fenceScrew) throw new Error(`The parts library has no ISO 4762 ${thread} screw for the fence.`);
  const fenceLedge = round(dimensionOf(fenceScrew, 'l') - bed - B.fenceGap + B.tip);
  const capD = dimensionOf(fenceScrew, 'dk', 'max') + 1, capK = dimensionOf(fenceScrew, 'k', 'max');
  const fenceStart = round(turntable + p.fit + 0.5);
  const notch = round(slot / 2 + 0.6);

  // the hold-downs: a column behind the fence, a beam over the stock with the T-nut's slot
  const H = B.holdDown, padR = B.pad.diameter / 2;
  const columnBack = -B.fenceOuter - 0.5 - H.column, columnFront = -B.fenceOuter - 0.5;
  const slotFrom = round(padR + 0.5);
  const slotTo = round(Math.max(slotFrom + 4, W - 1 - padR));
  const beamTip = round(slotTo + nutE / 2 + 1.5);
  const beamBottom = round(bed + p.stockHeight + 2 + B.pad.height + 0.5);
  const beamTop = round(beamBottom + nutM + p.fit + H.lip);
  const holdScrew = shortestScrew('ISO 4762', thread, bed - B.apron + B.ledge - B.tip);
  if (!holdScrew) throw new Error(`The parts library has no ISO 4762 ${thread} screw for the hold-downs.`);
  const holdLedge = round(dimensionOf(holdScrew, 'l') - (bed - B.apron) + B.tip);
  const holdScrews = [round(columnBack + 6.5), round(columnFront - 6.5)];
  // the hold-downs stand clear of the turning posts, the knob and the pin, and of the saw's line, with the pad's width
  const band: [number, number] = [columnBack - B.margin, Math.max(beamTip, slotTo + padR) + B.margin];
  const moving = [rectangle(-postWidth / 2, postWidth / 2, -rearPost - pl / 2, -rearPost + pl / 2), rectangle(-postWidth / 2, postWidth / 2, frontPost - pl / 2, frontPost + pl / 2), circle(knobX, knobY, knobR), circle(pinX, pinY, pinR)];
  const halfWidth = Math.max(H.width / 2, padR);
  const inner = Math.max(turntable + p.fit + 3, sweptReach(moving, band[0], band[1]) + B.margin, Math.max(-band[0], band[1]) * Math.tan(rad(B.maxAngle)) + slot / 2 + 2);
  const holdX = round(Math.ceil((inner + halfWidth) * 2) / 2);

  // the scale on the base, beyond the arm's reach
  const scaleFrom = round(armReach + 2.5), tickLong = 6, labelAt = round(scaleFrom + tickLong + 3.5);
  // the base round everything
  const fenceScrewX = [round(fenceStart + capD / 2 + 2.5)];
  const lockReach = sweptReach([circle(knobX, knobY, nutS / 2 + p.fit + 3)], -1e3, 1e3);
  const scaleReach = (labelAt + 6) * Math.sin(rad(B.maxAngle)) + 4;
  const halfLength = round(Math.ceil(Math.max(holdX + halfWidth + 12, (fenceScrewX[0] ?? 0) + 30, lockReach + B.baseMargin, scaleReach + B.baseMargin)));
  fenceScrewX.push(round(halfLength - capD / 2 - 3));
  const back = round(-Math.ceil(Math.max(turntable + p.fit + 3, -columnBack + 3, -pinY + pinR + 3)));
  const front = round(Math.ceil(labelAt + 6));

  // the clamps: a T-nut pulled up under the slot's lip; the pad's sole from just over the tallest stock (retracted) down
  const padNutH = nutHeight(padNut);
  const padSeat = PRESSURE_PAD.lip + padNutH + p.fit; // from the pad's back to the screw's tip
  const clampL = dimensionOf(clampScrew, 'l');
  const knobLow = beamTop + 0.5; // the knob's back, at the lowest
  const lowestSole = bed + B.minHeight;
  // with the knob on the slot's lip the screw's tip is clampL - lip below its back; the pad's sole lies padHeight - padSeat lower
  const reachSole = knobLow + PRESSURE_PAD.lip - clampL - (B.pad.height - padSeat);
  const clampLow = round(Math.max(lowestSole, reachSole) - bed);
  const retracted = beamBottom - 0.5; // the pad's back, retracted

  return {
    nut, padNut, clampScrew, lockScrew, fenceScrew, holdScrew, pin, thread,
    d, hole, nutS, nutM, nutE, headS, headK, padNutH, padSeat, pinD, pinL, pinR, capD, capK,
    slot, postWidth, guideLength: pl, W, bed, lockCeiling, lockShank,
    rearPost, frontPost, pinX, pinY, turntable, knobX, knobY, armHalf, armTip, wingR, armReach, lockRadius, lockAngle, postHeight,
    fenceHeight, fenceLedge, fenceStart, notch, fenceScrewX,
    columnBack, columnFront, slotFrom, slotTo, beamTip, beamBottom, beamTop, holdLedge, holdScrews, holdX,
    scaleFrom, tickLong, labelAt, halfLength, back, front,
    clampL, clampLow, retracted, knobLow, fit: p.fit,
  };
}
export type MiterBoxLayout = ReturnType<typeof miterBoxLayout>;

/** Why these (schema-valid) settings make no box, if they do not. */
export function miterBoxIssues(p: MiterBoxParameters): ParameterIssue[] {
  const issues: ParameterIssue[] = [];
  const nut = findPart(p.nut), padNut = findPart(p.padNut), screw = findPart(p.clampScrew);
  for (const [field, found] of [['nut', nut], ['padNut', padNut], ['clampScrew', screw]] as const)
    if (found && found.attributes['thread'] !== p.thread) issues.push({ field, message: `${found.designation} is not an ${p.thread} part: choose one of the thread.` });
  if (issues.length > 0) return issues;
  const l = miterBoxLayout(p);
  if (l.fenceHeight < l.fenceLedge + l.capK + 0.5 - 1e-9)
    issues.push({ field: 'stockHeight', message: `The fence must be at least ${Math.ceil(l.fenceLedge + l.capK + 0.5)} mm high to sink its ${l.fenceScrew.designation} screws.` });
  const reach = Math.max(MITER_BOX.minHeight, p.stockHeight * MITER_BOX.reach);
  if (l.clampLow > reach + 1e-9)
    issues.push({ field: 'clampScrew', message: `An ${l.clampScrew.designation} only reaches down to stock ${l.clampLow.toFixed(1)} mm high; the clamps must reach ${reach.toFixed(1)} mm (a third of the tallest stock): choose a longer screw, or lower the tallest stock.` });
  return issues;
}

/** The generator's list of [name, value] pairs: every dimension it draws from. */
export function miterBoxScadValues(p: MiterBoxParameters): [string, number | number[]][] {
  const l = miterBoxLayout(p), B = MITER_BOX;
  return [
    ['BED', l.bed], ['APRON', B.apron], ['ARM', B.arm], ['KERF_DEPTH', B.kerfDepth], ['SLOT', l.slot], ['POST_W', l.postWidth], ['POST_L', l.guideLength],
    ['POST_H', l.postHeight], ['LEAD', B.lead], ['REAR_POST', l.rearPost], ['FRONT_POST', l.frontPost], ['TURNTABLE', l.turntable],
    ['ARM_HALF', l.armHalf], ['ARM_TIP', l.armTip], ['KNOB_X', l.knobX], ['KNOB_Y', l.knobY], ['WING_R', l.wingR], ['MAX_ANGLE', B.maxAngle],
    ['CHANNEL', l.W], ['FENCE', B.fence], ['FENCE_OUTER', B.fenceOuter], ['FENCE_GAP', B.fenceGap], ['FENCE_H', l.fenceHeight], ['FENCE_START', l.fenceStart],
    ['NOTCH', l.notch], ['FENCE_LEDGE', l.fenceLedge], ['FENCE_SCREWS', l.fenceScrewX], ['CAP_D', l.capD],
    ['HOLE', l.hole], ['NUT_S', l.nutS], ['NUT_M', l.nutM], ['SCREW_D', l.d],
    ['LOCK_RADIUS', l.lockRadius], ['LOCK_ANGLE', l.lockAngle], ['LOCK_CEILING', l.lockCeiling],
    ['PIN_X', l.pinX], ['PIN_Y', l.pinY], ['PIN_R', l.pinR], ['PIN_DEPTH', B.pinDepth], ['STOPS', [...B.stops]],
    ['HOLD_W', B.holdDown.width], ['COLUMN_BACK', l.columnBack], ['COLUMN_FRONT', l.columnFront], ['SLOT_FROM', l.slotFrom], ['SLOT_TO', l.slotTo],
    ['BEAM_TIP', l.beamTip], ['BEAM_BOTTOM', l.beamBottom], ['BEAM_TOP', l.beamTop], ['HOLD_LEDGE', l.holdLedge], ['HOLD_SCREWS', l.holdScrews], ['HOLD_X', l.holdX],
    ['SCALE_FROM', l.scaleFrom], ['TICK', B.tick], ['TICK_LONG', l.tickLong], ['LABEL_AT', l.labelAt], ['LABELS', [...B.labels]],
    ['ENGRAVE', B.engrave], ['LINE', B.line], ['LABEL_SIZE', B.labelSize],
    ['HALF_LENGTH', l.halfLength], ['BACK', l.back], ['FRONT', l.front], ['FIT', p.fit], ['MARGIN', B.margin],
    ['BENCH_HOLE', dimensionOf(part(B.benchScrew), 'd') + 0.5], ['BENCH_SINK', dimensionOf(part(B.benchScrew), 'dk', 'max') + B.sinkPlay],
  ];
}

/** `miterBoxScadValues` as the OpenSCAD literal of LAYOUT. */
export function miterBoxScadLayout(p: MiterBoxParameters): string {
  return `[${miterBoxScadValues(p).map(([name, value]) => `["${name}",${JSON.stringify(value)}]`).join(',')}]`;
}

/** The pressure-pad generator's fixed settings for the knobs and the thrust pads (their sizes suit every offered thread). */
export const MITER_BOX_KNOB_CONSTANTS = { PART: 'pad', PAD_TYPE: 'foot', DIAMETER: MITER_BOX.knob.diameter, HEIGHT: MITER_BOX.knob.height, SURFACE: MITER_BOX.knob.surface, RELIEF: MITER_BOX.knob.relief, GRIP: MITER_BOX.knob.grip } as const;
export const MITER_BOX_PAD_CONSTANTS = { PART: 'pad', PAD_TYPE: 'thrust', DIAMETER: MITER_BOX.pad.diameter, HEIGHT: MITER_BOX.pad.height, SURFACE: MITER_BOX.pad.surface, RELIEF: MITER_BOX.pad.relief } as const;

/** Whether the fixed knob and pad sizes hold these parts at this fit (the pressure pad's own least sizes). */
export function miterBoxPadsFit(screw: Part, padNut: Part, fit: number): boolean {
  const knob = { padType: 'foot', surface: MITER_BOX.knob.surface, relief: MITER_BOX.knob.relief, fit } as const;
  const pad = { padType: 'thrust', surface: MITER_BOX.pad.surface, relief: MITER_BOX.pad.relief, fit } as const;
  return pressurePadMinHeight(knob, screw) <= MITER_BOX.knob.height + 1e-9 && pressurePadMinDiameter(knob, screw) + 3 <= MITER_BOX.knob.diameter + 1e-9
    && pressurePadMinHeight(pad, padNut) <= MITER_BOX.pad.height + 1e-9 && pressurePadMinDiameter(pad, padNut) <= MITER_BOX.pad.diameter + 1e-9;
}

/* -------------------------------------------------------------------------------------------------------------------------------
 * The assembly
 * ----------------------------------------------------------------------------------------------------------------------------- */

export const MITER_BOX_PARTS = ['base', 'turntable', 'fence-left', 'fence-right', 'holddown-left', 'holddown-right', 'pad-left', 'pad-right', 'knob-left', 'knob-right', 'lock-knob'] as const;
type Pose = { position: Vec3; rotation: Vec3 };
const SIDES = [['left', -1], ['right', 1]] as const;

/** The guide's pieces at `angle` (degrees), the index pin lifted by `lift` (0: in its hole). */
export function miterBoxGuidePoses(l: MiterBoxLayout, angle: number, lift = 0): Record<string, Pose> {
  const at = (x: number, y: number) => turn([x, y], angle);
  const [kx, ky] = at(l.knobX, l.knobY), [px, py] = at(l.pinX, l.pinY);
  const radial = Math.atan2(ky, kx) * 180 / Math.PI;
  const pinBottom = l.bed - MITER_BOX.arm - MITER_BOX.pinDepth;
  return {
    turntable: { position: [0, 0, l.bed - MITER_BOX.arm], rotation: [0, 0, angle] },
    'lock-knob': { position: [kx, ky, l.bed], rotation: [0, 0, angle] },
    // the head's corners on Y, the knob's pocket's on X: turned 30° to sit in it; the nut's flats across the channel
    'lock-screw': { position: [kx, ky, l.bed + PRESSURE_PAD.lip - dimensionOf(l.lockScrew, 'l')], rotation: [0, 0, angle + 30] },
    'lock-nut': { position: [kx, ky, l.lockCeiling - l.nutM], rotation: [0, 0, radial] },
    pin: { position: [px, py, pinBottom + lift], rotation: [0, 0, 0] },
  };
}

/** One clamp's pieces: the T-nut at `y` along the slot, the pad's back at `back` (z). */
export function miterBoxClampPoses(l: MiterBoxLayout, side: 'left' | 'right', y: number, back: number): Record<string, Pose> {
  const x = (side === 'left' ? -1 : 1) * l.holdX;
  const tip = back - l.padSeat;
  return {
    // the T-nut pulled up against the slot's lip, its flats against the channel's walls
    [`tnut-${side}`]: { position: [x, y, l.beamBottom + l.fit], rotation: [0, 0, 0] },
    [`clamp-screw-${side}`]: { position: [x, y, tip], rotation: [0, 0, 30] },
    [`knob-${side}`]: { position: [x, y, tip + l.clampL - PRESSURE_PAD.lip], rotation: [0, 0, 0] },
    // the thrust pad back up, its sole down; the nut on the screw's tip, flush with it, bearing on the chamber's floor
    [`pad-${side}`]: { position: [x, y, back], rotation: [180, 0, 0] },
    // turned 30°: its flats across the pad’s slot, as it slides in
    [`pad-nut-${side}`]: { position: [x, y, tip], rotation: [0, 0, 30] },
  };
}

/** Where a clamp's T-nut sits along its slot in the assembled preview: across the middle of the widest stock. */
const clampRest = (l: MiterBoxLayout) => round(Math.min(l.slotTo, Math.max(l.slotFrom, l.W / 2)), 1);

/** Every library part of the box, where it goes (the guide at 0°, the clamps open). */
export function miterBoxReferences(p: MiterBoxParameters): LinkedReference[] {
  const l = miterBoxLayout(p);
  const guide = miterBoxGuidePoses(l, 0);
  const clamps = Object.fromEntries(SIDES.flatMap(([side]) => Object.entries(miterBoxClampPoses(l, side, clampRest(l), l.retracted))));
  const references: LinkedReference[] = [
    { id: 'lock-screw', part: l.lockScrew.id, label: 'angle lock', pose: guide['lock-screw'] ?? { position: [0, 0, 0] } },
    { id: 'lock-nut', part: l.nut.id, label: 'angle lock, in the channel under the base', pose: guide['lock-nut'] ?? { position: [0, 0, 0] } },
    { id: 'pin', part: l.pin.id, label: 'index pin', pose: guide['pin'] ?? { position: [0, 0, 0] } },
  ];
  const below = (id: string, x: number, y: number, screw: Part, label: string) => {
    // the base's nut pulled up into its pocket; the screw's tip just over the base's bottom
    references.push({ id: id.replace('screw', 'nut'), part: l.nut.id, label: `${label}, under the base`, pose: { position: [x, y, l.fit], rotation: [0, 0, 30] } });
    references.push({ id, part: screw.id, label, pose: { position: [x, y, MITER_BOX.tip], rotation: [0, 0, 0] } });
  };
  let n = 0;
  for (const [, s] of SIDES) for (const x of l.fenceScrewX) below(`fence-screw-${++n}`, s * x, -MITER_BOX.fenceOuter / 2, l.fenceScrew, 'fence');
  n = 0;
  for (const [, s] of SIDES) for (const y of l.holdScrews) below(`hold-screw-${++n}`, s * l.holdX, y, l.holdScrew, 'hold-down');
  for (const [side] of SIDES) {
    const label = `${side} clamp`;
    references.push({ id: `tnut-${side}`, part: l.nut.id, label: `${label} T-nut`, pose: clamps[`tnut-${side}`] ?? { position: [0, 0, 0] } });
    references.push({ id: `clamp-screw-${side}`, part: l.clampScrew.id, label, pose: clamps[`clamp-screw-${side}`] ?? { position: [0, 0, 0] } });
    references.push({ id: `pad-nut-${side}`, part: l.padNut.id, label: `${label}, in the thrust pad`, pose: clamps[`pad-nut-${side}`] ?? { position: [0, 0, 0] } });
  }
  return references;
}

const pick = (poses: Record<string, Pose>, ids: readonly string[]) => Object.fromEntries(ids.map(id => [id, poses[id] ?? { position: [0, 0, 0] as Vec3, rotation: [0, 0, 0] as Vec3 }]));
const GUIDE_IDS = ['turntable', 'lock-knob', 'lock-screw', 'lock-nut', 'pin'] as const;

/**
 * The box put together (docs/miter-box.md#assembly) and its movements: the guide swung on the turntable to each stop and to an
 * angle between them (the pin lifted to turn, dropped into a stop), the clamps' pads slid across the stock and screwed down.
 * Every pose comes from `miterBoxLayout`; the turning pieces move rigidly about the pivot, sampled every 3°.
 */
export function miterBoxAssembly(p: MiterBoxParameters): Assembly {
  const l = miterBoxLayout(p);
  const guide = miterBoxGuidePoses(l, 0);
  const rest = clampRest(l);
  const clamps = Object.fromEntries(SIDES.flatMap(([side]) => Object.entries(miterBoxClampPoses(l, side, rest, l.retracted))));
  const holdDown = (s: number): Pose => ({ position: [s * l.holdX + MITER_BOX.holdDown.width / 2, 0, 0], rotation: [0, -90, 0] });
  const poses: Record<string, Pose> = {
    base: { position: [0, 0, 0], rotation: [0, 0, 0] },
    'fence-left': { position: [0, 0, l.bed + MITER_BOX.fenceGap], rotation: [0, 0, 0] },
    'fence-right': { position: [0, 0, l.bed + MITER_BOX.fenceGap], rotation: [0, 0, 0] },
    'holddown-left': holdDown(-1), 'holddown-right': holdDown(1),
    ...pick(guide, ['turntable', 'lock-knob']),
    ...pick(clamps, ['pad-left', 'pad-right', 'knob-left', 'knob-right']),
  };
  const ids = (prefix: string, count: number) => Array.from({ length: count }, (_, i) => `${prefix}-${i + 1}`);
  const fenceCount = 2 * l.fenceScrewX.length, holdCount = 2 * l.holdScrews.length;
  const steps: Assembly['steps'] = [
    { title: 'Press a nut into each pocket under the base', parts: [...ids('fence-nut', fenceCount), ...ids('hold-nut', holdCount)], from: [0, 0, -25] },
    { title: 'Slide the angle lock’s nut into its curved channel under the base', parts: ['lock-nut'], from: [0, 0, -25] },
    { title: 'Drop the turntable into its socket', parts: ['turntable'], from: [0, 0, 30] },
    { title: 'Snap the lock screw’s head into its knob, then turn it down through the arm into the nut', parts: ['lock-knob', 'lock-screw'], from: [0, 0, 30] },
    { title: 'Drop the index pin into the 0° stop', parts: ['pin'], from: [0, 0, 25] },
    { title: 'Screw the fence halves down', parts: ['fence-left', 'fence-right', ...ids('fence-screw', fenceCount)], from: [0, 0, 30] },
    { title: 'Screw the hold-downs on behind the fence', parts: ['holddown-left', 'holddown-right', ...ids('hold-screw', holdCount)], from: [0, 0, 40] },
    { title: 'Push a nut up into each hold-down’s slot (a T-nut: it slides, it cannot turn)', parts: ['tnut-left', 'tnut-right'], from: [0, 0, -20] },
    { title: 'Snap each clamp screw’s head into its knob, then turn it down through the T-nut', parts: ['clamp-screw-left', 'knob-left', 'clamp-screw-right', 'knob-right'], from: [0, 0, 40] },
    { title: 'Run a nylon-insert nut onto each screw’s tip, flush with it', parts: ['pad-nut-left', 'pad-nut-right'], from: [0, 0, -35] },
    // the pad's slot opens along its +X: it comes from -X onto the screw
    { title: 'Slide each thrust pad over its nut from the side', parts: ['pad-left', 'pad-right'], from: [-30, 0, 0] },
  ];

  // the guide's movements: lift the pin, swing (every 3°), drop the pin into a stop (or leave it up and lock with the knob)
  const lift = MITER_BOX.pinLift;
  const swing = (from: number, to: number, pinOut: boolean, pinIn: boolean) => {
    const frames: Record<string, Pose>[] = [];
    if (pinOut) for (const k of [1, 2, 3]) frames.push(pick(miterBoxGuidePoses(l, from, lift * k / 3), GUIDE_IDS));
    const count = Math.max(1, Math.ceil(Math.abs(to - from) / 3));
    for (let k = 1; k <= count; k++) frames.push(pick(miterBoxGuidePoses(l, from + (to - from) * k / count, lift), GUIDE_IDS));
    if (pinIn) for (const k of [2, 1, 0]) frames.push(pick(miterBoxGuidePoses(l, to, lift * k / 3), GUIDE_IDS));
    return frames;
  };
  // the clamps: both T-nuts slid along their slots, then both pads screwed down and back (every 2 mm)
  const clampFrames = (path: [number, number][]) => path.map(([y, back]) => Object.fromEntries(SIDES.flatMap(([side]) => Object.entries(miterBoxClampPoses(l, side, y, back)))));
  const along = (a: number, b: number): number[] => {
    const count = Math.max(1, Math.ceil(Math.abs(b - a) / 2));
    return Array.from({ length: count }, (_, k) => a + (b - a) * (k + 1) / count);
  };
  const lowest = l.bed + l.clampLow + MITER_BOX.pad.height;
  const motion: NonNullable<Assembly['motion']> = [
    { title: 'Lift the index pin and swing the guide to the 45° stop', frames: swing(0, MITER_BOX.maxAngle, true, true) },
    { title: 'Swing it the other way, to the 22.5° stop', frames: swing(MITER_BOX.maxAngle, -22.5, true, true) },
    { title: 'Any angle between the stops: swing to 10° and lock it with the knob', frames: swing(-22.5, 10, true, false) },
    { title: 'Back to the square (90°) cut, the pin in its stop', frames: swing(10, 0, false, true) },
    { title: 'Slide the pads across the stock to suit its width', frames: clampFrames([...along(rest, l.slotFrom), ...along(l.slotFrom, l.slotTo), ...along(l.slotTo, rest)].map((y): [number, number] => [y, l.retracted])) },
    { title: `Screw the pads down onto the stock: any height from ${l.clampLow.toFixed(0)} to ${p.stockHeight} mm`, frames: clampFrames([...along(l.retracted, lowest), ...along(lowest, l.retracted)].map((back): [number, number] => [rest, back])) },
  ];
  return {
    partColors: {
      base: '#d9cfbc', turntable: '#d98460', 'fence-left': '#8aa6a3', 'fence-right': '#8aa6a3', 'holddown-left': '#5f7350', 'holddown-right': '#5f7350',
      'pad-left': '#3f5560', 'pad-right': '#3f5560', 'knob-left': '#e0b048', 'knob-right': '#e0b048', 'lock-knob': '#e0b048',
    },
    poses, steps, lift: 30, motion,
  };
}
