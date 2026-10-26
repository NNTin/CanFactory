import { Type, type Static } from 'typebox';
import type { Assembly, ParameterIssue } from './models.ts';
import type { PhysicsBody, PhysicsCheck, PhysicsController, PhysicsCounter, PhysicsDrive, PhysicsMagnet, PhysicsScenario, PhysicsSpec } from './physics.ts';
import { DEFAULT_ESP32_CASE, esp32CaseAssembly, esp32CaseGround, ESP32_CASE, ESP32_CASE_BOARD, ESP32_CASE_HEADER } from './esp32Case.ts';
import { devBoardLayout, dimensionOf, findPart, ISO_273_CLEARANCE_HOLES, STERLING, stepperDriverLayout } from './parts/index.ts';
import type { Point2 } from './physicsPieces.ts';
import { embedCavity, toLayers } from './printPause.ts';
import { toyDipole } from './magneticCatToyPhysics.ts';

/**
 * A gumball-style treat dispenser (docs/treat-dispenser.md, issue #138), after bovineblitz's "Cat treat gumball-style dispenser"
 * (MakerWorld 190887, CC BY-NC 4.0), itself after cylus80's "Mason Jar Candy Dispenser" (Thingiverse 2103924, CC BY 4.0). An
 * inverted 0.5 l PET bottle screws into the top of the body; its treats fall through a funnel onto a horizontal rotor with one deep
 * pocket, which a 28BYJ-48 turns directly (in place of the original's handle); each full turn the pocket carries what it holds from
 * under the funnel, past a counterweighted rigid flap, to the drop below it, onto a chute that runs out of the front. Every part
 * prints in PLA or PETG. Two bodies: the inner body carries the thread, the
 * mechanism, the motor and the ULN2003 board; the outer body covers it, the ESP32-C3 SuperMini case's lid flush in its back wall so
 * that B and R can be pressed. Every fastener is an M3 screw into a hex nut in a printed bay (`treatBolts`).
 *
 * One frame for everything, the assembled frame W: Z up, the floor at z = 0, the rotor's axis along X at y = 0, the chute running out
 * towards −Y (the front). All lengths mm, angles degrees. Each part is drawn in W and printed in its own orientation (its pose).
 */

export const TREAT_DISPENSER = {
  /** The rotor: radius, the solid hub beyond each end of its pocket, its gap in the bore. One pocket, its floor through the axis (the
   * motor's shaft pokes into it there, its flats held in the floor's half of the D-bore), so deep that a treat lying across it stays
   * below the rotor's surface; its trailing face (the one that carries treats forwards) leans out from the radial by `pocketRamp`
   * (degrees), so that what sticks out of it rides up the flap rather than catching its tip. */
  rotorRadius: 13, rotorHub: 4, boreGap: 0.4, pockets: 1, pocketRamp: 30,
  /** The drop under the rotor: the bore stops this far (degrees) from the bottom towards the front (behind, it opens into the cavity),
   * wider than the pocket's mouth, so that it empties before the pocket's leading face reaches the bore again. */
  dropFront: 55,
  /** The walls of the rotor's block, the deck and the boss; the outer shell's walls are four 0.4 mm perimeters. */
  wall: 2.4, shell: 1.6,
  /** The slot over the rotor is as long as a pocket (X), and across (Y) wider than a treat is long by this each side, so that a treat
   * lying either way can drop through it (a narrower one let treats bridge over it). */
  slotMargin: 1.5,
  /** Funnel height, from the top of the rotor's block to the bottle's lip. */
  funnel: 8,
  /** The chute: its slope; the rotor's clearance above it (more than a treat is long, so that none can be caught between them); the
   * height of its end above the base and where it ends (y); its wall and floor. The body's front face (y). */
  chuteSlope: 30, dropClear: 15, exitZ: 6, chuteEnd: -44, chuteWall: 1.6, chuteFloor: 2, chuteSide: 14, front: -38,
  /** The outer body: half its width (X) at least (wider where the ULN2003's jumper wires need it) and its back face (y). */
  halfWidth: 41.5, back: 49,
  /** The base plate: its thickness (a socket head's counterbore from below and 1.7 mm over it), and how far it reaches past the
   * outer body at least (but not under the chute's end). */
  base: 5, baseMargin: 8,
  /** M3 nut bays: play across the flats (each side) and along the axis; the wall between a nut and the face its screw comes in
   * through; how far the outer body's walls stand off the inner body. */
  nutPlay: 0.15, nutDepthPlay: 0.3, bayWall: 1.5, gap: 0.2,
  /** The inner body's feet, either side of its legs at their front and back ends (square). It is not screwed down: the outer body's top
   * presses on a collar round the thread's boss (reaching `collar` past the boss, `collarDepth` thick under the top), and low rims on the
   * base plate (`rim` thick, `rimHeight` high, `gap` off the feet) round each foot's three free sides keep it from sliding. */
  foot: 8, collar: 5, collarDepth: 3, rim: 1.6, rimHeight: 2.5,
  /** The ULN2003 board's standoffs on the inner body's right leg (their diameter round a nut bay), the board's lowest edge over the
   * base, and its back edge in front of the block's back face. */
  standoff: 9, driverLift: 9, driverBack: 4,
  /** The cap's two lugs on the inner body (half their side, their thickness along X). */
  lug: 5, lugThickness: 7,
  /** The bottle's thread: how high above the lip the boss reaches, and its wall outside the thread. */
  threadHeight: 18, bossWall: 3,
  /** How much of the bottle's neck (its bore, from the lip up) the simulation stands in the thread, to hold the treats above. */
  neckLength: 160,
  /** The bearing cap: a tube through the left wall's opening to the rotor's −X end, its flange (thickness, radius) screwed to the wall's
   * outside; the rotor's stub into it (diameter, length). The rotor slides in and out through that opening. */
  capFlange: 3, capRadius: 23, stub: 8, stubLength: 4.5,
  /** Behind the flap, round the rotor's descending side, a cavity this much deeper than the rotor: more than a treat is long, so that a
   * treat carried past the flap can neither be pinched nor wedge across it, and the flap can swing back out of a treat's way (its round
   * top is bridged between its side walls: a ceiling sloped at 50° stopped the old flap at about 45° and wedged treats under it). */
  cavityClear: 15,
  /** The flap that closes the slot's back edge on the rotor: rigid, printed in PLA or PETG (no flexible filament), swinging freely on a
   * hinge and held on the rotor by its own weight. Its plate's thickness; the hub along its top (radius) with a hole (radius) that
   * snaps over two bosses on the slot's side walls (radius, how far each stands out) through a mouth narrower than a boss, opening
   * `mouthAngle` below the back (towards the front and down, between the plate and the front: it is pushed on up and back from the
   * slot and the empty bore, the rotor not yet in; neither its weight nor a treat pulls it off); how far behind the
   * hinge its plate's tip rests on the rotor (mm). Hanging nearly upright, the plate's own weight barely holds it shut (the trials
   * let most of the funnel through on a turn): a counterweight on an arm straight back from the hub at rest (the arm's thickness, the
   * weight's size (y, z) and its centre's distance behind the hinge) closes it with about the torque of the old TPU flap's preload,
   * and swings up into a recess as the flap opens, up to `swing` degrees (further, it would swing forwards through the slot's back wall:
   * long and flat, it reaches the farthest back for the least). The plastic's density (g/cm³). */
  flap: {
    thickness: 1.6, hub: 2.9, hole: 1.7, boss: 1.5, bossLength: 1.5, mouth: 2.6, mouthAngle: 135, lean: 1.5,
    arm: 2, weight: [10, 8.5] as readonly [number, number], reach: 15, swing: 55, density: 1.27,
    /** The optional magnets (`flapMagnets`): the library part; a cavity's play round it (radially), headroom over it before the pause,
     * the skin under it (whole layers at the print notes' 0.2 mm); the inner body's magnet's centre from the hinge (y, z), above and behind
     * the counterweight, clear of its swing and of the slot (a search over the places that fit: the most closing torque at rest that
     * stays closing up to the stop); the flap's lies in the counterweight under its top face. Their faces that repel face each other. */
    magnet: { part: 'supermagnete-s-08-01-n', play: 0.15, headroom: 0.2, skin: 0.6, layer: 0.2, body: [4.5, 20] as readonly [number, number] },
  },
  /** The optional rubber band (`flapBand`): an office band stretched across the flap's arm `lever` behind the hinge (the nearer the
   * hinge, the softer: a band's tension is a few newtons, and across the counterweight it held the flap 3–30 times too firmly), through
   * a slot `slot` wide in each side wall, to a notch on one of the grooved pegs on a ledge outside each wall. The pegs' grooves hold its
   * ends `line` below the arm's top, so that it presses on the arm at rest and the more the further the flap opens. `notches`: how far
   * the grooves' floors are from the middle (X), one per tension setting; the pegs (x, y), how far they stand over the grooves' openings
   * (the band pulls inwards and, the flap open, up its strands at less than the grooves' 45° flanks: it cannot climb out), the
   * grooves' depth, their opening and floor (half heights, 45° between: printable); the ledge (y, its thickness) on a gusset at 50°.
   * At the stop the band's torque may not exceed `maxStop` (N·mm), so that a treat can still swing the flap open. */
  band: {
    lever: 5, slot: 5, line: 1.5, notches: [20, 24, 28, 32, 36], peg: [2.5, 1.2] as readonly [number, number], pegAbove: 0.5, groove: 0.8, grooveOpen: 1.8, grooveFloor: 1,
    ledge: [6, 2] as readonly [number, number], maxStop: 6,
  },
} as const;

/**
 * The rubber band sizes the flap takes (`flapBand`): the library's numbered bands that are taut at rest in some notch and not too firm
 * at the stop (`treatBandTorque`, the test keeps this list to that). Shorter or wider ones (#8, #10, #27, #30) hold the flap too firmly in every
 * notch; longer ones (#18, #19, #32, #33) hang slack.
 */
export const TREAT_BAND_SIZES = ['12', '14', '16', '31'] as const;

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
  treatThickness: mm('Treat thickness', 'Thinnest side of the treats, mm (the rotor’s pocket reaches its axis whatever it is: the simulation’s treats are this thick).', 5, 3, 7),
  treatCornerRadius: mm('Treat corner radius', 'Rounding of the treats’ edges and corners, mm (used by the simulation only).', 1.5, 0.5, 2.5),
  pocketClearance: mm('Pocket clearance', 'Play round a treat in a rotor pocket, mm. More takes bigger treats, and lets two thin ones in.', 1, 0.4, 2, 0.05),
  bottleNeck: Type.Enum(Object.keys(BOTTLE_NECKS) as BottleNeck[], { title: 'Bottle neck', description: 'The thread of the bottle that screws into the top. Print the thread coupon first: real bottles vary.', default: 'pco-1881' }),
  threadClearance: mm('Thread clearance', 'Radial play of the body’s thread on the bottle’s, mm; tune it with the coupon.', 0.3, 0.1, 0.5, 0.05),
  flapMagnets: Type.Boolean({ title: 'Flap magnets', description: 'Embed two Ø8 × 1 mm N45 disc magnets (supermagnete S-08-01-N) that repel each other: one in the flap’s counterweight, one in the inner body above it. They add to the counterweight’s closing force, the more the further the flap opens. Both prints pause for you to drop a magnet in.', default: false }),
  flapBand: Type.Enum(['none', ...TREAT_BAND_SIZES], { title: 'Flap band', description: 'An office rubber band by size number, stretched across the flap’s arm to hold it shut more firmly the further it opens: hooked into a pair of notches outside the inner body’s side walls (`Band notch`). None: the counterweight alone.', default: 'none' }),
  flapBandNotch: Type.Integer({ title: 'Band notch', description: 'Which pair of notches the band is hooked into, 1 (innermost, softest) to 4 (outermost, firmest).', default: 2, minimum: 1, maximum: TREAT_DISPENSER.band.notches.length }),
  bottleDiameter: mm('Bottle diameter', 'Largest diameter of the bottle, mm (0.5 l PET bottles are about 65 mm). Sets the base plate’s size so that a full bottle cannot easily tip the dispenser over.', 65, 55, 95, 1),
}, { additionalProperties: false });
export type TreatDispenserParameters = Static<typeof TreatDispenserParametersSchema>;
export const DEFAULT_TREAT_DISPENSER = Object.fromEntries(Object.entries(TreatDispenserParametersSchema.properties).map(([key, p]) => [key, 'default' in p ? p.default : undefined])) as TreatDispenserParameters;

export type Vec3 = [number, number, number];
const DEG = Math.PI / 180;
const motorPart = () => findPart('kiatronics-28byj-48-5v') ?? (() => { throw new Error('Missing 28BYJ-48.'); })();
const driverPart = () => findPart('uln2003-stepper-driver-board') ?? (() => { throw new Error('Missing the ULN2003 board.'); })();
/** The library's rubber bands the flap takes (`flapBand`). */
const bandParts = () => TREAT_BAND_SIZES.map(size => findPart(`alliance-sterling-${size}`) ?? (() => { throw new Error(`Missing the rubber band #${size}.`); })());
const nutPart = () => findPart(TREAT_FASTENERS.nut) ?? (() => { throw new Error('Missing the M3 nut.'); })();

/**
 * Jumper wires on 2.54 mm pins (assumed, not from a data sheet: common DuPont-style female housings are about 2.54 mm square and 14
 * mm long and take about 6 mm of a pin): the room beyond a pin's tip for a housing and its wire's bend (`reach`), and how much more
 * room than the housing's half width a row of them needs beside it (`side`).
 */
export const JUMPER = { width: 2.54, housing: 14, mate: 6, bend: 6, reach: 14 - 6 + 6, side: 1.5 } as const;

/** Every dimension of the dispenser for these parameters (W). */
export function treatDispenserLayout(p: TreatDispenserParameters) {
  const T = TREAT_DISPENSER;
  const c = p.pocketClearance;
  const R = T.rotorRadius, w = (p.treatWidth + 2 * c) / 2, ramp = Math.tan(T.pocketRamp * DEG);
  // the pocket drawn with its floor on the axis and its mouth up: its leading face (+Y) radial, its trailing face (−Y) leaning out; where
  // each meets the rotor's surface (degrees from the top, towards +Y), and the turn (towards +Y) that centres its mouth on the top
  // (its floor's height over the axis: 0, the floor through the axis)
  const depth = R, floor = R - depth;
  const lead = Math.asin(w / R) / DEG;
  const k = w - floor * ramp;
  const zt = (-ramp * k + Math.sqrt(ramp * ramp * k * k - (1 + ramp * ramp) * (k * k - R * R))) / (1 + ramp * ramp);
  const trail = Math.atan2(-w - (zt - floor) * ramp, zt) / DEG;
  const pocket = { length: p.treatLength + 2 * c, width: 2 * w, depth, floor, turn: -(lead + trail) / 2, mouth: (lead - trail) / 2 };
  const rotorEnd = pocket.length / 2 + T.rotorHub;
  const bore = { radius: R + T.boreGap, half: rotorEnd + T.boreGap };
  const block = { halfX: bore.half + T.wall, halfY: bore.radius + T.wall };
  // (at rest the pocket's whole mouth lies under the slot, 0.5 inside its walls, so that the slot's back edge never stands over it)
  const slot = { halfX: pocket.length / 2, halfY: Math.max(Math.max(pocket.width, p.treatLength) / 2 + T.slotMargin, (R + T.boreGap) * Math.sin(pocket.mouth * DEG) + 0.5) };
  // the chute: inside as wide as the slot is long plus play; the body's legs hold it between them
  // (the legs are flush with the block's sides, so that the block's underside has no overhang beside them)
  const chuteIn = slot.halfX + 0.5, chuteOut = chuteIn + T.chuteWall, legIn = chuteOut + 0.2, legOut = block.halfX;
  const tan = Math.tan(T.chuteSlope * DEG);
  const chuteAt = (y: number) => T.base + T.exitZ + (y - T.chuteEnd) * tan;
  // the rotor's underside is `dropClear` above the chute wherever a pocket drops (|y| ≤ the slot's half width)
  const axisZ = chuteAt(slot.halfY) + T.dropClear + R;
  // the flap hangs from a hinge just behind the slot's back wall (its plate's front face flush with it), higher over the rotor than a
  // treat standing on end on it reaches; its plate leans back `lean` to its tip on the rotor; behind it the cavity, under a roof at
  // the hinge
  const F = T.flap;
  const hinge = { y: slot.halfY + F.thickness / 2, z: axisZ + R + p.treatLength + 2 };
  const cavityR = Math.max(R + T.cavityClear, hinge.z - axisZ + 4);
  // its plate's centreline from the hinge to its tip on the rotor, `lean` behind the hinge (on the rotor at least)
  const hy = hinge.y, hz = hinge.z - axisZ, tipY = Math.min(hy + F.lean, R - 0.3);
  const tip = { y: tipY, z: axisZ + Math.sqrt(R * R - tipY * tipY) };
  const reach = Math.hypot(tip.y - hy, hinge.z - tip.z), lean = Math.atan2(tip.y - hy, hinge.z - tip.z);
  const width = 2 * (pocket.length / 2) - 0.4;
  // its pieces' volumes (mm³) and how far behind the hinge their centres lie at rest: the plate (along its leaning centreline), the hub
  // (on the hinge), the arm and the counterweight; their moment closes the flap
  const [wy, wz] = F.weight, armLength = F.reach - wy / 2 - F.hub;
  const pieces = [
    { volume: width * reach * F.thickness, behind: reach / 2 * Math.sin(lean) },
    { volume: width * Math.PI * (F.hub ** 2 - F.hole ** 2), behind: 0 },
    { volume: (width - 2 * (F.bossLength + 0.3)) * armLength * F.arm, behind: F.hub + armLength / 2 },
    { volume: width * wy * wz, behind: F.reach },
  ];
  const mass = pieces.reduce((sum, piece) => sum + piece.volume, 0) * F.density / 1000;
  const closing = pieces.reduce((sum, piece) => sum + piece.volume * F.density / 1000 * piece.behind, 0) * 9.81e-3;
  // the counterweight and its arm hang from flush tops, level with the hub's (the flap prints upside down on them): its corners from the
  // hinge (y, z); the farthest (the recess's radius) and how high over the hinge they swing, which the recess and the block's top must
  // clear as the flap swings open
  const corners: [number, number][] = [F.reach - wy / 2, F.reach + wy / 2].flatMap(y => [F.hub, F.hub - wz].map((z): [number, number] => [y, z]));
  const sweep = Math.max(...corners.map(([y, z]) => Math.hypot(y, z))) + 0.5;
  const swing = F.swing;
  const sweepTop = Math.max(...Array.from({ length: swing + 1 }, (_, a) => Math.max(...corners.map(([y, z]) => y * Math.sin(a * DEG) + z * Math.cos(a * DEG))))) + 0.5;
  // the magnets' cavities (whether or not they are fitted, so that the option does not change the body): the flap's under the
  // counterweight's top face (its skin on the bed, the flap printed upside down), the inner body's a flat disc on a layer boundary
  // (the inner body prints upright from z = base); each magnet lies on its cavity's floor as printed
  const M = F.magnet, magnet = findPart(M.part);
  if (!magnet) throw new Error(`Missing the flap magnet ${M.part}.`);
  const magnetT = dimensionOf(magnet, 'thickness', 'max'), magnetR = dimensionOf(magnet, 'diameter', 'max') / 2 + M.play;
  const flapCavity = embedCavity(M.skin, magnetT, M.headroom, M.layer), flapTop = hinge.z + F.hub;
  const bodyFloor = toLayers(hinge.z + M.body[1] - magnetT / 2 - T.base, M.layer), bodyPause = toLayers(bodyFloor + magnetT + M.headroom, M.layer);
  const magnets = {
    radius: magnetR, thickness: magnetT,
    flap: { y: hinge.y + F.reach, z0: flapTop - flapCavity.pause, z1: flapTop - flapCavity.skin, centre: flapTop - flapCavity.skin - magnetT / 2, pause: flapCavity.pause },
    body: { y: hinge.y + M.body[0], z0: T.base + bodyFloor, z1: T.base + bodyPause, centre: T.base + bodyFloor + magnetT / 2, pause: bodyPause },
  };
  // the cavity's back reaches behind the counterweight up to its roof
  const flap = { hinge, tip, length: reach, angle: lean / DEG, width, mass, closing, sweep, sweepTop, swing, cavityBack: hinge.y + F.reach + wy / 2 + 0.5 };
  // the rubber band's way (`flapBand`): its plane `lever` behind the hinge; where it crosses the flap's top there, turned by a degrees
  // (z from the hinge, and half the flap's width there: the arm's, or the counterweight's beyond it); the slots through the side walls
  // from below the band's line to over the highest it lies on the flap, with room for the widest band; the ledges and pegs outside
  const B = T.band, bandY = hinge.y + B.lever, bandZ = hinge.z + F.hub - B.line, armHalf = width / 2 - (F.bossLength + 0.3);
  const bandOver = (a: number): { z: number; half: number } | undefined => {
    const c = Math.cos(a * DEG), s = Math.sin(a * DEG), along = (B.lever + F.hub * s) / c;
    if (along < F.hub - 0.5 || along > F.reach + wy / 2) return undefined;
    return { z: along * s + F.hub * c, half: along < F.reach - wy / 2 ? armHalf : width / 2 };
  };
  const widest = Math.max(...bandParts().map(part => dimensionOf(part, 'width')));
  const pegOut = (notch: number) => (B.notches[notch] ?? 0) + B.groove;
  const band = {
    y: bandY, z: bandZ, armHalf, over: bandOver, widest,
    // (the slots reach 0.5 below the ledges' tops, into their roots, so that no cut ends on a ledge's top face)
    slot: { y0: bandY - B.slot / 2, y1: bandY + B.slot / 2, z0: bandZ - B.grooveOpen - 1.2, z1: hinge.z + (bandOver(swing)?.z ?? F.hub) + widest + 0.5 },
    ledge: { x0: block.halfX, x1: pegOut(B.notches.length - 1) + 1, top: bandZ - B.grooveOpen - 0.7 },
    pegTop: bandZ + B.grooveOpen + B.pegAbove,
    pegOut,
  };
  // the block's top: over the counterweight's recess and the inner body's magnet, with a wall above them; its top slopes down to the back
  // at STEEP (50°) clear of the cavity's round and of the recess (`blockSlope`: the slope's distance from the axis)
  const blockBottom = axisZ - block.halfY, blockBack = cavityR + T.wall;
  const blockTop = Math.max(hinge.z + Math.max(6.6, sweepTop + T.wall), magnets.body.z1 + M.skin);
  const blockSlope = Math.max(blockBack, hinge.y * Math.sin(50 * DEG) + hz * Math.cos(50 * DEG) + sweep + T.wall);
  // the drop: the bore's front edge under the rotor (y); behind, the drop opens into the cavity
  const drop = { front: -bore.radius * Math.sin(T.dropFront * DEG) };
  const lipZ = blockTop + T.funnel;
  const neck = BOTTLE_NECKS[p.bottleNeck];
  const threadR = neck.T / 2 + p.threadClearance, bossR = threadR + T.bossWall, lipR = neck.bore / 2 + 0.5;
  const bossTop = lipZ + T.threadHeight;
  // the outer body's gable: its flat top as wide as the boss at least, and wide enough that its back slope clears the block's (by the gap)
  const gableHalf = Math.max(bossR + 0.5, (blockSlope + T.gap + T.shell - (lipZ - axisZ) * Math.cos(50 * DEG)) / Math.sin(50 * DEG));
  // the motor: its shaft on the rotor's axis, its can in front of it (Kiatronics: the shaft is 8 mm off the can's axis), so that its
  // ears lie above and below the axis on the block's and the right leg's +X face, where their nuts slide in from the front; its
  // mounting face on that face, its wire housing to the front
  const motor = motorPart();
  const shaftOffset = dimensionOf(motor, 'e'), motorLength = dimensionOf(motor, 'L'), earSpan = dimensionOf(motor, 'a'), canR = dimensionOf(motor, 'D') / 2;
  // an M3 nut's bay: across its flats and along its axis, from the library's ISO 4032 M3 at its largest
  const nut = nutPart();
  const bay = { across: dimensionOf(nut, 's', 'max') + 2 * T.nutPlay, depth: dimensionOf(nut, 'm', 'max') + T.nutDepthPlay };
  // the ULN2003 board on standoffs off the right leg, its parts facing out (+X): each standoff holds a nut behind the board, so it is
  // as long as the bay's wall and the nut's bay; the outer body is as wide as the jumper wires on its pins need
  const driver = driverPart(), driverLayout = stepperDriverLayout(driver);
  if (!driverLayout) throw new Error('The ULN2003 board has no layout.');
  const standoffLength = T.bayWall + bay.depth;
  const driverTop = block.halfX + standoffLength + dimensionOf(driver, 't');
  const halfWidth = Math.max(T.halfWidth, Math.ceil((driverTop + driverLayout.pinHeight + JUMPER.reach + T.shell) * 2) / 2);
  // the bearing cap's screws, either side of the bore, into nuts in two lugs on the inner body, just inside the outer body's left wall
  const capScrewR = (bore.radius + T.capRadius) / 2;
  return {
    pocket, R, rotorEnd, bore, block, slot, chuteIn, chuteOut, legIn, legOut, tan, chuteAt, axisZ, blockBottom, blockTop, blockBack, blockSlope, cavityR, flap, magnets, band, drop, lipZ, lipR, neck, threadR, bossR, bossTop, gableHalf,
    motorFace: block.halfX, canY: -shaftOffset, canR, motorLength, earSpan, shaftOffset, bay, standoffLength, driverTop, capScrewR,
    lugFace: -(halfWidth - T.shell) + T.gap,
    // the back wall leaves room behind the block for the ESP32 case (8.4 deep) and its header pins (bigger treats, a deeper block)
    halfWidth, front: T.front, back: Math.max(T.back, blockBack + 13.6),
    /** The chute's top end, under the back of the cavity. */
    chuteBack: blockBack,
  };
}
export type TreatDispenserLayout = ReturnType<typeof treatDispenserLayout>;

/**
 * The rubber band's Young's modulus (MPa) from its hardness: Gent's relation, E = 0.0981 (56 + 7.62336 S) / (0.137505 (254 − 2.54 S))
 * (A. N. Gent, "On the relation between indentation hardness and Young's modulus", Trans. IRI 34, 1958), at Sterling's 42 Shore A:
 * about 1.8 MPa.
 */
export const BAND_MODULUS = 0.0981 * (56 + 7.62336 * STERLING.durometer) / (0.137505 * (254 - 2.54 * STERLING.durometer));

/** The band part of a `flapBand` setting, or undefined for none. */
export function treatBandPart(p: Pick<TreatDispenserParameters, 'flapBand'>) {
  return p.flapBand === 'none' ? undefined : findPart(`alliance-sterling-${p.flapBand}`);
}

/**
 * The band's torque on the flap (N·mm; negative closes it) at each angle in `angles` (degrees, opening positive), hooked into notch
 * `notch` (1 the innermost). The band is a loop round the two pegs' groove floors (x = ±X) and over the flap's top, its two strands
 * straight from the grooves (`line` below the flap's top at rest) to the flap's edges and across it: its stretch is that loop's length
 * over its own (twice its flat length). Its tension, neo-Hookean (nominal stress E/3 (λ − λ⁻²) on its unstretched section, width ×
 * thickness), turned down at the flap's edges by the strands' slope, presses on the flap `lever` behind the hinge. Zero while slack.
 */
export function treatBandTorque(l: TreatDispenserLayout, p: Pick<TreatDispenserParameters, 'flapBand' | 'flapBandNotch'>, angles: readonly number[]): number[] {
  const part = treatBandPart(p);
  if (!part) return angles.map(() => 0);
  const B = TREAT_DISPENSER.band, X = B.notches[p.flapBandNotch - 1] ?? 0, line = l.band.z - l.flap.hinge.z;
  const own = 2 * dimensionOf(part, 'length'), section = dimensionOf(part, 'width') * dimensionOf(part, 'thickness');
  return angles.map(a => {
    const over = l.band.over(a);
    if (!over) return 0;
    const drop = Math.max(0, over.z - line), side = Math.hypot(X - over.half, drop);
    const stretch = (4 * side + 4 * over.half + 2 * B.peg[1]) / own;
    const tension = stretch > 1 ? BAND_MODULUS / 3 * (stretch - stretch ** -2) * section : 0;
    return -4 * tension * drop / side * B.lever;
  });
}

export function treatDispenserIssues(p: TreatDispenserParameters): ParameterIssue[] {
  const issues: ParameterIssue[] = [];
  const l = treatDispenserLayout(p);
  if (p.treatWidth > p.treatLength) issues.push({ field: 'treatWidth', message: 'The width must not exceed the length: give the sides longest first.' });
  if (p.treatThickness > p.treatWidth) issues.push({ field: 'treatThickness', message: 'The thickness must not exceed the width.' });
  if (2 * p.treatCornerRadius > p.treatThickness - 0.2) issues.push({ field: 'treatCornerRadius', message: 'The corner radius must be less than half the thickness.' });
  if (l.pocket.width / 2 > l.R - 3) issues.push({ field: 'treatWidth', message: 'Treats this wide do not fit the rotor’s pocket.' });
  const [rest = 0, stop = 0] = treatBandTorque(l, p, [0, l.flap.swing]).map(torque => -torque);
  if (p.flapBand !== 'none' && rest <= 0) issues.push({ field: 'flapBandNotch', message: `Band #${p.flapBand} hangs slack in notch ${p.flapBandNotch}: hook it into a notch further out, or use a shorter band.` });
  if (stop > TREAT_DISPENSER.band.maxStop) issues.push({ field: 'flapBandNotch', message: `Band #${p.flapBand} in notch ${p.flapBandNotch} holds the flap too firmly (${stop.toFixed(1)} N·mm at the stop, at most ${TREAT_DISPENSER.band.maxStop}): hook it into a notch further in, or use a longer band.` });
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
  const det = g(m, 0, 0) * (g(m, 1, 1) * g(m, 2, 2) - g(m, 1, 2) * g(m, 2, 1)) - g(m, 0, 1) * (g(m, 1, 0) * g(m, 2, 2) - g(m, 1, 2) * g(m, 2, 0)) + g(m, 0, 2) * (g(m, 1, 0) * g(m, 2, 1) - g(m, 1, 1) * g(m, 2, 0));
  // a mirror has no pose: it would come out as some other rotation
  if (Math.abs(det - 1) > 1e-6) throw new Error(`Not a rotation (determinant ${det}).`);
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

export function treatPartPoses(l: TreatDispenserLayout): Record<'inner-body' | 'outer-body' | 'base' | 'chute' | 'rotor' | 'cap' | 'flap', Pose> {
  const T = TREAT_DISPENSER;
  return {
    // upright on its feet and legs, and on its open bottom, as they stand
    'inner-body': { position: [0, 0, T.base], rotation: [0, 0, 0] },
    'outer-body': { position: [0, 0, T.base], rotation: [0, 0, 0] },
    base: { position: [0, 0, 0], rotation: [0, 0, 0] },
    // on its floor: turned by its slope, the floor's underside on the bed
    chute: { position: [0, T.chuteEnd, l.chuteAt(T.chuteEnd) - T.chuteFloor], rotation: [T.chuteSlope, 0, 0] },
    // its axis up, the motor's end (+X) on the bed
    rotor: { position: [l.rotorEnd, 0, l.axisZ], rotation: [0, -90, 0] },
    // its flange down
    cap: { position: [-(l.halfWidth + T.capFlange), 0, l.axisZ], rotation: [0, 90, 0] },
    // upside down, on the flush tops of its hub, arm and counterweight: the magnet's cavity under the counterweight's top lies flat, so
    // that the print can pause to take the magnet
    flap: { position: [0, l.flap.hinge.y, l.flap.hinge.z + TREAT_DISPENSER.flap.hub], rotation: [180, 0, 0] },
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
 * The rotor about its axis (along X; at rest, its pocket's mouth centred on the top): its two end hubs as full cylinders and, between
 * them, its section less the pocket as three convex prisms: the half under the pocket's floor, and the lobes beyond its leading and
 * its trailing (leaning) face; drawn with the mouth up, then turned by `pocket.turn` towards +Y, as the SCAD file draws it.
 */
export function treatRotorPieces(l: TreatDispenserLayout, segments = 32): number[][] {
  const { R, rotorEnd, pocket, axisZ } = l;
  const half = pocket.length / 2, w = pocket.width / 2, ramp = Math.tan(TREAT_DISPENSER.pocketRamp * DEG);
  const circle: Point2[] = Array.from({ length: segments }, (_, i): Point2 => [R * Math.cos(2 * Math.PI * i / segments), R * Math.sin(2 * Math.PI * i / segments)]);
  const turn = -pocket.turn * DEG, c = Math.cos(turn), s = Math.sin(turn);
  const prism = (section: Point2[], x0: number, x1: number) => [x0, x1].flatMap(x => section.flatMap(([y, z]) => [x, y * c - z * s, axisZ + y * s + z * c]));
  const f = pocket.floor;
  const under = clipSection(circle, [[0, 1, f]]);
  const leading = clipSection(circle, [[0, -1, -f], [-1, 0, -w]]);
  const trailing = clipSection(circle, [[0, -1, -f], [1, ramp, -w + ramp * f]]);
  return [
    prism(circle, -rotorEnd, -half), prism(circle, half, rotorEnd),
    ...[under, leading, trailing].filter(piece => piece.length >= 3).map(piece => prism(piece, -half, half)),
  ];
}

/**
 * The body where treats go, as convex pieces: the thread's bore above the lip and, standing in it, the bottle's neck (not a part: the
 * simulation's stand-in for the bottle), the deck the lip rests on, the funnel from the lip to the slot, and below the slot the
 * housing's section (YZ) carried across between the slot's side walls: the slot's front wall and the tight bore on the rotor's rising
 * (front) side down to the drop, the slot's back wall down to the flap's hinge, the cavity's roof and its arc round the descending (back)
 * side down to the chute; the side walls themselves; the legs.
 */
export function treatBodyPieces(l: TreatDispenserLayout, segments = 24): number[][] {
  const T = TREAT_DISPENSER;
  const { slot, bore, axisZ, blockBottom, blockTop, lipZ, lipR, threadR, bossTop, legIn, legOut, drop, cavityR, flap, blockBack, chuteAt } = l;
  const t = T.wall, x0 = -slot.halfX, x1 = slot.halfX;
  const pieces: number[][] = [];
  const annulus = (r0: number, r1: number, z0: number, z1: number, n: number) => Array.from({ length: n }, (_, i) => {
    const a0 = 2 * Math.PI * i / n, a1 = 2 * Math.PI * (i + 1) / n;
    return [z0, z1].flatMap(z => [[r0, a0], [r0, a1], [r1, a1], [r1, a0]].flatMap(([r = 0, a = 0]) => [r * Math.cos(a), r * Math.sin(a), z]));
  });
  pieces.push(...annulus(threadR, threadR + t, lipZ, bossTop, segments), ...annulus(lipR, threadR, lipZ - t, lipZ, segments));
  // the bottle's neck standing in the thread (not a part: the simulation's stand-in for the bottle above the lip)
  pieces.push(...annulus(l.neck.bore / 2, l.neck.bore / 2 + 1.5, lipZ, lipZ + T.neckLength, segments));
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
  // the slot's front wall, down to where it meets the bore; the tight bore round the front, down to the drop's front edge; the drop's
  // front wall down to the block's bottom (below it the chute runs out to the front)
  const slotFront = Math.asin(slot.halfY / bore.radius) / DEG, dropTop = axisZ - bore.radius * Math.cos(T.dropFront * DEG);
  pieces.push(across([[-slot.halfY - t, axisZ + bore.radius * Math.cos(slotFront * DEG)], [-slot.halfY, axisZ + bore.radius * Math.cos(slotFront * DEG)], [-slot.halfY, blockTop], [-slot.halfY - t, blockTop]]));
  pieces.push(...arc(bore.radius, -slotFront, -(180 - T.dropFront), 10));
  pieces.push(across([[drop.front - t, blockBottom], [drop.front, blockBottom], [drop.front, dropTop], [drop.front - t, dropTop]]));
  // the slot's back wall down to the flap's hinge, the cavity's roof from there back over the counterweight, its back wall down to the
  // arc, the arc down to the chute
  const { hinge, cavityBack } = flap;
  pieces.push(across([[slot.halfY, hinge.z], [slot.halfY + t, hinge.z], [slot.halfY + t, blockTop], [slot.halfY, blockTop]]));
  pieces.push(across([[slot.halfY, hinge.z], [cavityBack + t, hinge.z], [cavityBack + t, hinge.z + t], [slot.halfY, hinge.z + t]]));
  const backFoot = axisZ + Math.sqrt(cavityR ** 2 - cavityBack ** 2);
  pieces.push(across([[cavityBack, backFoot], [cavityBack + t, backFoot], [cavityBack + t, hinge.z], [cavityBack, hinge.z]]));
  const roofAngle = Math.asin(cavityBack / cavityR) / DEG;
  // the arc ends where it meets the chute
  let footAngle = roofAngle;
  while (footAngle < 180 && axisZ + cavityR * Math.cos(footAngle * DEG) > chuteAt(cavityR * Math.sin(footAngle * DEG))) footAngle += 1;
  pieces.push(...arc(cavityR, roofAngle, footAngle, Math.max(2, Math.ceil((footAngle - roofAngle) / 10))));
  // the side walls, over the whole section, from the block's bottom to its top; below, the legs either side of the chute
  for (const [a, b] of [[x0 - t, x0], [x1, x1 + t]] as const) pieces.push(box(a, b, drop.front - t, blockBack, blockBottom, blockTop));
  pieces.push(box(-legOut, -legIn, -l.block.halfY, blockBack, T.base, blockBottom), box(legIn, legOut, -l.block.halfY, blockBack, T.base, blockBottom));
  return pieces;
}

/** The flap (W, at rest on the rotor): its plate from the hinge to its tip, across the slot, and its counterweight's arm and block behind
 * the hinge (its hub stays out of the treats' way). */
export function treatFlapPieces(l: TreatDispenserLayout): number[][] {
  const { hinge, tip, width } = l.flap;
  const t = TREAT_DISPENSER.flap.thickness / 2, lean = l.flap.angle * DEG;
  // the plate either side of its centreline: towards the front (−Y) and the back
  const n: [number, number] = [-Math.cos(lean) * t, -Math.sin(lean) * t];
  const quad: [number, number][] = [[hinge.y + n[0], hinge.z + n[1]], [tip.y + n[0], tip.z + n[1]], [tip.y - n[0], tip.z - n[1]], [hinge.y - n[0], hinge.z - n[1]]];
  const F = TREAT_DISPENSER.flap, [wy, wz] = F.weight;
  const box2 = (y0: number, y1: number, z0: number, z1: number): [number, number][] => [[y0, z0], [y1, z0], [y1, z1], [y0, z1]];
  return [
    quad, box2(hinge.y + F.hub - 0.5, hinge.y + F.reach - wy / 2, hinge.z + F.hub - F.arm, hinge.z + F.hub),
    box2(hinge.y + F.reach - wy / 2, hinge.y + F.reach + wy / 2, hinge.z + F.hub - wz, hinge.z + F.hub),
  ].map(section => [-width / 2, width / 2].flatMap(x => section.flatMap(([y, z]) => [x, y, z])));
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
  const neckRoom = l.neck.bore / 2 - 0.4, top = l.lipZ + TREAT_DISPENSER.neckLength;
  const room = (z: number): [number, number] => {
    if (z > top) return [-1, -1];
    if (z >= l.lipZ) return [neckRoom / Math.SQRT2, neckRoom / Math.SQRT2];
    const f = Math.max(0, (z - l.blockTop) / (l.lipZ - l.blockTop));
    return [l.slot.halfX + (neckRoom / Math.SQRT2 - l.slot.halfX) * f - 0.3, l.slot.halfY + (neckRoom / Math.SQRT2 - l.slot.halfY) * f - 0.3];
  };
  const placed: { c: Vec3; m: Mat3 }[] = [];
  const free = (c: Vec3, m: Mat3) => !placed.some(other => boxesOverlap(other, { c, m }, half));
  for (let i = 0; i < count; i++) {
    let done = false;
    for (let attempt = 0; attempt < 2000 && !done; attempt++) {
      const m = qmat(orient()), r = reach(m);
      for (let z = l.blockTop + r.up + 0.5; z + r.up < top && !done; z += 0.5) {
        let c: Vec3;
        if (z - r.up >= l.lipZ) {
          // in the neck: a round bore
          const space = neckRoom - r.r;
          if (space < 0) continue;
          const o = Math.sqrt(random()) * space, a = random() * 2 * Math.PI;
          c = [o * Math.cos(a), o * Math.sin(a), z];
        } else {
          const rooms = [room(z - r.up), room(z), room(z + r.up)];
          const sx = Math.min(...rooms.map(q => q[0])) - r.x, sy = Math.min(...rooms.map(q => q[1])) - r.y;
          if (sx < 0 || sy < 0) continue;
          c = [(random() * 2 - 1) * sx, (random() * 2 - 1) * sy, z];
        }
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
 * The firmware's cycle (models/treat-dispenser/esphome/treat_dispenser.h): forward a full turn, the pocket over the drop and back under
 * the funnel. It never turns back: backwards, the slot's tight front edge would become the edge the pocket leaves under, and
 * could pinch a treat (`rock` stays 0; the logic supports one). 700 half-steps/s with a 4076-step turn is 61.8°/s at the rotor.
 */
export const TREAT_FIRMWARE = {
  stepsPerTurn: 4076, halfSteps: 700, acceleration: 2000, debounce: 0.03, queue: 1, boot: 0.6, pause: 0.2, settle: 0.5, prime: 1, jogSteps: 23,
  stall: 10, rock: 0 as number,
} as const;
export const firmwareDegrees = (steps: number): number => steps * 360 / TREAT_FIRMWARE.stepsPerTurn;
/** Motor steps per dispense cycle, net: one pocket pitch of the rotor (one pocket: a full turn). */
export const treatCycleSteps = (): number => TREAT_FIRMWARE.stepsPerTurn / TREAT_DISPENSER.pockets;

/**
 * The electronics inside the body (W): the ESP32 case's own assembly (esp32CaseAssembly, its parts and boards as that model places
 * them) upright left of the rotor's block, its lid flush in a window of the back wall so that B and R are pressed from behind, USB-C at
 * its lower end (the cable comes in through a notch at the foot of the back wall); the ULN2003 board on standoffs off the inner body's
 * right leg, under the motor. `bootPoint` and `resetPoint` are the buttons' actuators in the lid's own frame (its outer face), from the
 * board library's button positions.
 */
export interface BayLayout { caseFrame: Pose; driverPose: Pose; bootPoint: Vec3; resetPoint: Vec3; usb: Vec3; rows: number[]; pinTip: number }
export const BAY = { lidProud: 0.5, caseLength: 25.8, caseWidth: 21.8, plugRoom: 25 } as const;

export function treatBayLayout(p: TreatDispenserParameters): BayLayout {
  const l = treatDispenserLayout(p);
  const T = TREAT_DISPENSER;
  const caseAssembly = esp32CaseAssembly(DEFAULT_ESP32_CASE);
  const board = findPart(ESP32_CASE_BOARD), layout = board ? devBoardLayout(board) : undefined;
  const header = findPart(ESP32_CASE_HEADER);
  const boardPose = caseAssembly.poses['board'], lidPose = caseAssembly.poses['top'];
  const headerPoses = ['header-1', 'header-2'].map(id => caseAssembly.poses[id]);
  if (!layout || !header || !boardPose || !lidPose || headerPoses.some(pose => !pose)) throw new Error('The ESP32 case has no board, lid or headers.');
  // case +X → +Z (its USB end, at −X, down), case +Y → +X, case +Z (lid out) → +Y (the back)
  const roof = esp32CaseGround(DEFAULT_ESP32_CASE) + ESP32_CASE.lidRoof;
  const frame = (x: number): Pose => ({
    position: [x, l.back + BAY.lidProud - roof, T.base + BAY.plugRoom + BAY.caseLength / 2],
    rotation: rotationAngles([[0, 1, 0], [0, 0, 1], [1, 0, 0]]),
  });
  // the header rows' pins point into the body (−Y): the case sits so far left that the row nearer the rotor's block leaves a row of
  // jumper plugs room beside the inner body's left face, so that either row can be wired
  const rowsAt = (x: number) => headerPoses.map(pose => composePose(frame(x), pose ?? { position: [0, 0, 0] }).position[0]);
  const caseFrame = frame(-l.block.halfX - JUMPER.side - JUMPER.width / 2 - Math.max(...rowsAt(0)));
  const rows = rowsAt(caseFrame.position[0]);
  // the pins' mating tips (the header's own frame: tails at z = 0, tips at z = H)
  const tip = composePose(caseFrame, headerPoses[0] ?? { position: [0, 0, 0] });
  const pinTip = posePoint(tip, [0, 0, dimensionOf(header, 'H')])[1];
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
    caseFrame, bootPoint: button('BOOT'), resetPoint: button('RST'), usb, rows, pinTip,
    // the board on its standoffs off the right leg, under the motor, its parts facing out (+X): board +X → +Z, +Y → −Y, +Z → +X; its
    // back edge (board y = 0) `driverBack` in front of the block's back face, its lowest edge `driverLift` over the base
    driverPose: { position: [l.driverTop - dimensionOf(driverPart(), 't'), l.blockBack - T.driverBack, T.base + T.driverLift], rotation: rotationAngles([[0, 0, 1], [0, -1, 0], [1, 0, 0]]) },
  };
}

/**
 * Every screw of the dispenser: ISO 4762 M3 into an ISO 4032 M3 nut in a printed bay, which a nut slides into from `entry`'s side
 * (its flats along the slot, so that it cannot turn). `at` is where the screw's head bears, `axis` the screw's direction (head to
 * tip), `nutAt` how far along it the nut's face towards the head lies.
 * - motor: through the 28BYJ-48's ears into the block's and the right leg's +X face (nuts from the front);
 * - driver: through the ULN2003 board into its standoffs (nuts dropped in from above);
 * - cap: through the bearing cap's flange and the outer body's left wall into the inner body's lugs (nuts dropped in from above);
 * - corners: up through the base plate into the outer body's corner columns (nuts from the inside).
 */
export interface TreatBolt {
  id: string; label: string; screw: string; nutIn: 'inner-body' | 'outer-body';
  at: Vec3; axis: Vec3; entry: Vec3; nutAt: number; slot: number;
}
/** The centres of the inner body's feet (x, y; −X side first), outside its legs at their front and back ends. They stand in rims on
 * the base plate; nothing screws them down (the outer body's top presses the inner body onto the plate). */
export function treatFeet(l: TreatDispenserLayout): [number, number][] {
  const T = TREAT_DISPENSER;
  return [-1, 1].flatMap(sx => [-l.block.halfY + T.foot / 2, l.blockBack - T.foot / 2].map((y): [number, number] => [sx * (l.legOut + T.foot / 2), y]));
}
/** The outer body's corner columns: their radius, and how far out along the diagonal from its rounded corner's centre (R 8). */
export const CORNER_COLUMN = { radius: 5, out: 2.5 } as const;

export function treatBolts(p: TreatDispenserParameters): TreatBolt[] {
  const l = treatDispenserLayout(p);
  const T = TREAT_DISPENSER;
  const bay = treatBayLayout(p);
  const motor = motorPart(), driver = driverPart(), layout = stepperDriverLayout(driver);
  if (!layout) throw new Error('The ULN2003 board has no layout.');
  const ear = dimensionOf(motor, 't');
  // the base plate's screws stand in counterbores from below, their heads 0.3 mm in
  const seat = baseSeat();
  const up: Vec3 = [0, 0, 1];
  const bolts: TreatBolt[] = [];
  for (const [name, s] of [['top', 1], ['bottom', -1]] as const) bolts.push({
    id: `motor-${name}`, label: `motor, ${name} ear`, screw: TREAT_FASTENERS.motorScrew, nutIn: 'inner-body',
    at: [l.motorFace + ear, l.canY, l.axisZ + s * l.earSpan / 2], axis: [-1, 0, 0], entry: [0, -1, 0],
    nutAt: ear + T.bayWall, slot: l.canY + l.block.halfY + 1,
  });
  layout.holes.forEach((hole, i) => bolts.push({
    id: `driver-${i + 1}`, label: `ULN2003 board, hole ${i + 1}`, screw: TREAT_FASTENERS.screw, nutIn: 'inner-body',
    at: posePoint(bay.driverPose, [hole.x, hole.y, dimensionOf(driver, 't')]), axis: [-1, 0, 0], entry: up,
    nutAt: dimensionOf(driver, 't') + T.bayWall, slot: T.standoff / 2 + 1,
  }));
  for (const [name, s] of [['front', -1], ['back', 1]] as const) bolts.push({
    id: `cap-${name}`, label: `bearing cap, ${name}`, screw: TREAT_FASTENERS.capScrew, nutIn: 'inner-body',
    at: [-(l.halfWidth + T.capFlange), s * l.capScrewR, l.axisZ], axis: [1, 0, 0], entry: up,
    nutAt: T.capFlange + T.shell + T.gap + T.bayWall, slot: T.lug + 1,
  });
  const out = (8 - CORNER_COLUMN.out / Math.SQRT2);
  for (const [side, sx] of [['left', -1], ['right', 1]] as const) for (const [end, y] of [['front', l.front + out], ['back', l.back - out]] as const) bolts.push({
    id: `corner-${side}-${end}`, label: `outer body, ${side} ${end} corner`, screw: TREAT_FASTENERS.screw, nutIn: 'outer-body',
    at: [sx * (l.halfWidth - out), y, seat], axis: up, entry: [-sx, 0, 0], nutAt: T.base - seat + 2, slot: CORNER_COLUMN.radius + 1,
  });
  return bolts;
}

/**
 * Room the jumper wires need (W boxes, `JUMPER`): beyond the tips of both rows of the SuperMini's header pins (either row may be wired,
 * depending on the GPIOs used), over the housings' length, a wire's bend and a little to each side of the row; and beyond the ULN2003's
 * input and supply pins and its motor socket. No part may reach into them (tested, and measured on the meshes by
 * tools/treat-dispenser-views.ts).
 */
export interface WiringRoom { id: string; title: string; min: Vec3; max: Vec3 }
export function treatWiringRoom(p: TreatDispenserParameters): WiringRoom[] {
  const bay = treatBayLayout(p);
  const header = findPart(ESP32_CASE_HEADER), driver = driverPart(), layout = stepperDriverLayout(driver);
  const caseAssembly = esp32CaseAssembly(DEFAULT_ESP32_CASE);
  if (!header || !layout) throw new Error('Missing the header or the ULN2003’s layout.');
  const half = JUMPER.width / 2 + JUMPER.side, length = dimensionOf(header, 'L'), post = dimensionOf(header, 'post');
  const box = (id: string, title: string, points: Vec3[], pad: Vec3): WiringRoom => ({
    id, title,
    min: [0, 1, 2].map(k => Math.min(...points.map(q => q[k] ?? 0)) - (pad[k] ?? 0)) as Vec3,
    max: [0, 1, 2].map(k => Math.max(...points.map(q => q[k] ?? 0)) + (pad[k] ?? 0)) as Vec3,
  });
  const rows = (['header-1', 'header-2'] as const).map((id, i) => {
    const pose = composePose(bay.caseFrame, caseAssembly.poses[id] ?? { position: [0, 0, 0] });
    // the row along the header's Y; its pins' tips at its z = H, the housings over the last `post` of them
    const ends = [-1, 1].map(s => posePoint(pose, [0, s * length / 2, 0]));
    return box(`row-${i + 1}`, `Jumper plugs on the SuperMini’s header row ${i + 1}`, [...ends.map(q => [q[0], bay.pinTip - JUMPER.reach, q[2]] as Vec3), ...ends.map(q => [q[0], bay.pinTip + post, q[2]] as Vec3)], [half, 0, half]);
  });
  const t = dimensionOf(driver, 't');
  const pins = (group: string) => layout.pins.filter(pin => pin.header === group).map(pin => posePoint(bay.driverPose, [pin.x, pin.y, t]));
  const driverBox = (group: string, title: string, side: number) => {
    const at = pins(group);
    return box(`uln2003-${group}`, title, [...at.map(q => [q[0] + layout.pinHeight - JUMPER.mate, q[1], q[2]] as Vec3), ...at.map(q => [q[0] + layout.pinHeight + JUMPER.reach, q[1], q[2]] as Vec3)], [0, side, side]);
  };
  return [
    ...rows,
    // on the board, beside its own screws' heads, the housings need only their own width and a little
    driverBox('input', 'Jumper plugs on the ULN2003’s IN1–IN4 pins', JUMPER.width / 2 + 0.5),
    driverBox('power', 'Jumper plugs on the ULN2003’s supply pins', JUMPER.width / 2 + 0.5),
    // the motor's XH plug, as thick as the library's housing
    driverBox('motor', 'The motor’s plug in the ULN2003’s socket', dimensionOf(motorPart(), 'pt') / 2 + 0.5),
  ];
}

/** How high the base plate's screw heads bear: their counterbore's depth (the head at its tallest and 0.3 mm). */
function baseSeat(): number {
  const screw = findPart(TREAT_FASTENERS.screw);
  if (!screw) throw new Error('Missing the M3 screw.');
  return dimensionOf(screw, 'k', 'max') + 0.3;
}

const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const columns = (x: Vec3, y: Vec3, z: Vec3): Mat3 => [[x[0], y[0], z[0]], [x[1], y[1], z[1]], [x[2], y[2], z[2]]];

/** A bolt's screw and nut as the library draws them: a screw's tip at z = 0, its head up; a nut from z = 0 to its height along its
 * axis, its corners along its own Y (its flats across X), turned so that its flats lie along its bay's slot. */
export function treatBoltPoses(bolt: TreatBolt): { screw: Pose; nut: Pose } {
  const screw = findPart(bolt.screw);
  if (!screw) throw new Error(`Missing ${bolt.screw}.`);
  const length = dimensionOf(screw, 'l');
  const minus: Vec3 = [-bolt.axis[0], -bolt.axis[1], -bolt.axis[2]];
  const along = (d: number): Vec3 => [0, 1, 2].map(k => (bolt.at[k] ?? 0) + (bolt.axis[k] ?? 0) * d) as Vec3;
  const side = cross(bolt.axis, bolt.entry);
  return {
    screw: { position: along(length), rotation: rotationAngles(columns(bolt.entry, cross(minus, bolt.entry), minus)) },
    nut: { position: along(bolt.nutAt), rotation: rotationAngles(columns(side, [-bolt.entry[0], -bolt.entry[1], -bolt.entry[2]], bolt.axis)) },
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

/**
 * The optional flap magnets as dipoles (`flapMagnets`): the flap's in its counterweight, its moment up (W) at rest; the inner body's
 * above it, its moment down, so that they repel (Br V / μ₀ of the library's N45 disc, as the magnetic cat toy takes it).
 */
export function treatFlapMagnets(l: TreatDispenserLayout, poses: ReturnType<typeof treatPartPoses>): PhysicsMagnet[] {
  const dipole = toyDipole(TREAT_DISPENSER.flap.magnet.part);
  const local = (pose: Pose, at: Vec3, up: number) => {
    const p = poseLocal(pose, at), q = poseLocal(pose, [at[0], at[1], at[2] + up]);
    return { position: p, moment: [0, 1, 2].map(k => ((q[k] ?? 0) - (p[k] ?? 0)) * dipole.moment) as Vec3 };
  };
  return [
    { id: 'flap-magnet', title: 'Flap magnet (Ø8 × 1 N45, in the counterweight)', body: 'flap', softening: dipole.radius, ...local(poses.flap, [0, l.magnets.flap.y, l.magnets.flap.centre], 1) },
    { id: 'body-magnet', title: 'Inner body magnet (Ø8 × 1 N45, above the counterweight)', body: 'inner-body', softening: dipole.radius, ...local(poses['inner-body'], [0, l.magnets.body.y, l.magnets.body.centre], -1) },
  ];
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
  // the optional rubber band: its torque on the flap's hinge by the flap's angle, every 5° over its range
  const bandAngles = Array.from({ length: Math.round((l.flap.swing + 5) / 5) + 1 }, (_, k) => k * 5 - 5);
  const band = p.flapBand === 'none' ? undefined : { at: bandAngles, values: treatBandTorque(l, p, bandAngles) };
  return {
    // treats in contact with a motor-driven rotor need short steps and the precise solve
    maxStep: 0.0001, precise: true,
    bodies: [
      {
        id: 'rotor', material: 'petg', collision: { kind: 'pieces', pieces: piecesIn(poses.rotor, treatRotorPieces(l)) },
        // quasi-static added inertia and a little bearing friction keep the light rotor from rattling against the treats
        inertia: 2e6, joint: { type: 'hinge', anchor: [0, 0, l.axisZ], axis: [1, 0, 0], friction: 2 },
      },
      fixed('inner-body', piecesIn(poses['inner-body'], treatBodyPieces(l))),
      fixed('chute', piecesIn(poses.chute, treatChutePieces(l))),
      {
        // the flap, free on its hinge: its counterweight holds it on the rotor, and a treat standing out of the pocket swings it back (its
        // mass and inertia from its mesh)
        id: 'flap', material: 'petg', collision: { kind: 'pieces', pieces: piecesIn(poses.flap, treatFlapPieces(l)) },
        joint: { type: 'hinge', anchor: [0, l.flap.hinge.y, l.flap.hinge.z], axis: [1, 0, 0], damping: 0.002, range: [-5, l.flap.swing], ...(band ? { load: band } : {}) },
      },
    ],
    exclude: [['rotor', 'inner-body'], ['rotor', 'chute'], ['flap', 'inner-body'], ['flap', 'chute']],
    // the flap's magnet, sealed in its counterweight, swings with it
    ...(p.flapMagnets ? { magnets: treatFlapMagnets(l, poses), attached: { 'flap-magnet': 'flap' } } : {}),
    motors: [{ id: 'motor', title: '28BYJ-48 (output shaft, on the rotor)', body: 'rotor', ...TREAT_MOTOR, speed: firmwareDegrees(firmware.halfSteps), acceleration: firmwareDegrees(firmware.acceleration) }],
    items,
    counters: [
      treatOutletCounter(p),
      {
        id: 'stray', title: 'Treats off their path, among the ESP32 case and the wiring (left of the rotor’s block)', group: 'treats', kind: 'inside',
        min: [-l.halfWidth, l.front, T.base], max: [-l.legOut - 0.5, l.back, l.lipZ],
      },
      {
        id: 'stray-motor', title: 'Treats off their path, at the motor and the ULN2003 (right of the rotor’s block)', group: 'treats', kind: 'inside',
        min: [l.legOut + 0.5, l.front, T.base], max: [l.halfWidth, l.back, l.lipZ],
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

/** The fasteners, from the parts library: ISO 4762 M3 screws (the motor's ears: `motorScrew`; the cap: `capScrew`; the ULN2003 board
 * and the base plate: `screw`), each into an ISO 4032 M3 nut (`treatBolts`). */
export const TREAT_FASTENERS = { screw: 'iso-4762-m3x8', motorScrew: 'iso-4762-m3x6', capScrew: 'iso-4762-m3x10', nut: 'iso-4032-m3' } as const;

/** Every value the generator needs, as `[name, value]` pairs (an OpenSCAD list it looks names up in). */
export function treatScadValues(p: TreatDispenserParameters): [string, number | number[] | number[][] | boolean][] {
  const l = treatDispenserLayout(p);
  const T = TREAT_DISPENSER;
  const bay = treatBayLayout(p);
  const poses = treatPartPoses(l);
  const motor = motorPart(), screw = findPart(TREAT_FASTENERS.screw);
  if (!screw) throw new Error('Missing the M3 screw.');
  const round = (value: number) => Math.round(value * 1e6) / 1e6;
  const pose = (q: Pose) => [...q.position.map(round), ...q.rotation];
  const parts = { 'inner-body': 1, 'outer-body': 2 } as const;
  const bolts = treatBolts(p);
  const length = (id: string) => { const part = findPart(id); if (!part) throw new Error(`Missing ${id}.`); return dimensionOf(part, 'l'); };
  return [
    ['WALL', T.wall], ['SHELL', T.shell], ['BASE', T.base], ['HALF_W', l.halfWidth], ['FRONT', l.front], ['BACK', l.back], ['BASE_RECT', treatFootprint(p).map(round)],
    ['R', l.R], ['ROTOR_END', round(l.rotorEnd)], ['POCKET', [round(l.pocket.length), round(l.pocket.width), T.pocketRamp, round(l.pocket.turn), round(l.pocket.floor)]],
    ['BORE_R', round(l.bore.radius)], ['BORE_HALF', round(l.bore.half)], ['BLOCK', [round(l.block.halfX), round(l.block.halfY)]], ['SLOT', [round(l.slot.halfX), round(l.slot.halfY)]],
    ['AXIS_Z', round(l.axisZ)], ['BLOCK_BOTTOM', round(l.blockBottom)], ['BLOCK_TOP', round(l.blockTop)], ['BLOCK_BACK', round(l.blockBack)], ['CAVITY_R', round(l.cavityR)], ['DROP_Y', round(l.drop.front)],
    // the flap: hinge (y, z), plate length and lean, thickness, hub, hole, boss, boss length, mouth, width
    ['FLAP', [round(l.flap.hinge.y), round(l.flap.hinge.z), round(l.flap.length), round(l.flap.angle), T.flap.thickness, T.flap.hub, T.flap.hole, T.flap.boss, T.flap.bossLength, T.flap.mouth, round(l.flap.width), T.flap.mouthAngle]],
    // its counterweight: arm thickness, weight (y, z), the weight's centre behind the hinge, the swing, the recess's radius round the hinge
    ['WEIGHT', [T.flap.arm, ...T.flap.weight, T.flap.reach, l.flap.swing, round(l.flap.sweep)]],
    // the magnets (`flapMagnets`): fitted (1) or not, the cavities' radius, the flap's cavity (y, z from, z to) and the inner body's
    ['MAGNET', [p.flapMagnets ? 1 : 0, round(l.magnets.radius), round(l.magnets.flap.y), round(l.magnets.flap.z0), round(l.magnets.flap.z1), round(l.magnets.body.y), round(l.magnets.body.z0), round(l.magnets.body.z1)]], ['BLOCK_SLOPE', round(l.blockSlope)], ['CAVITY_BACK', round(l.flap.cavityBack)], ['GABLE_HALF', round(l.gableHalf)],
    // the rubber band's way (`flapBand`, cut and built whether or not one is fitted): its plane (y) and line (z); the side walls' slots
    // (y from, to; z from, to); the ledges (x from, to; top, thickness, width), the pegs (x, y, top), their grooves (depth, opening and
    // floor half heights round the line); the grooves' floors from the middle
    ['BAND', [round(l.band.y), round(l.band.z), round(l.band.slot.y0), round(l.band.slot.y1), round(l.band.slot.z0), round(l.band.slot.z1), round(l.band.ledge.x0), round(l.band.ledge.x1), round(l.band.ledge.top), T.band.ledge[1], T.band.ledge[0], ...T.band.peg, round(l.band.pegTop), T.band.groove, T.band.grooveOpen, T.band.grooveFloor]],
    ['BAND_NOTCHES', [...T.band.notches]],
    ['LIP_Z', round(l.lipZ)], ['LIP_R', round(l.lipR)], ['BOSS_TOP', round(l.bossTop)],
    ['CHUTE', [round(l.chuteIn), round(l.chuteOut), round(l.legIn), round(l.legOut)]], ['CHUTE_END', T.chuteEnd], ['CHUTE_BACK', round(l.chuteBack)],
    ['CHUTE_SLOPE', T.chuteSlope], ['EXIT_Z', T.base + T.exitZ], ['CHUTE_FLOOR', T.chuteFloor], ['CHUTE_WALL', T.chuteWall], ['CHUTE_SIDE', T.chuteSide],
    ['NECK_T', l.neck.T], ['NECK_E', l.neck.E], ['NECK_BORE', l.neck.bore], ['NECK_PITCH', l.neck.pitch], ['NECK_TURNS', round(l.neck.turns)],
    ['THREAD_CLEARANCE', p.threadClearance], ['THREAD_R', round(l.threadR)], ['BOSS_R', round(l.bossR)],
    ['MOTOR_FACE', round(l.motorFace)], ['BOSS_D', dimensionOf(motor, 'db', 'max')], ['SHAFT_D', dimensionOf(motor, 'd', 'max')], ['SHAFT_FLATS', dimensionOf(motor, 's', 'max')],
    // the shaft's round part, from the mounting face to where its flats begin (the longest shaft, the shortest flats)
    ['SHAFT_ROUND', round(dimensionOf(motor, 'l', 'max') - dimensionOf(motor, 'lf', 'min'))],
    ['CAP', [T.capFlange, T.capRadius, T.stub, T.stubLength]], ['GAP', T.gap],
    // the cap's lugs: their face towards the outer body's left wall, thickness, half side, the screws' distance from the axis
    ['LUG', [round(l.lugFace), T.lugThickness, T.lug, round(l.capScrewR)]],
    ['FOOT', T.foot], ['FEET', treatFeet(l).map(foot => foot.map(round))], ['RIM', [T.rim, T.rimHeight]], ['COLLAR', [T.collar, T.collarDepth]], ['STANDOFF', [T.standoff, round(l.standoffLength)]], ['COLUMN_R', CORNER_COLUMN.radius],
    // the screws: [head's seat x, y, z, axis x, y, z, the nut's way in x, y, z, length, nut's face along the axis, slot, part]
    ['BOLTS', bolts.map(bolt => [...bolt.at.map(round), ...bolt.axis, ...bolt.entry, length(bolt.screw), round(bolt.nutAt), round(bolt.slot), parts[bolt.nutIn]])],
    // a nut's bay across its flats and along its axis; a screw's clearance hole; room for its head (diameter, height)
    ['NUT', [round(l.bay.across), round(l.bay.depth)]], ['M3_HOLE', ISO_273_CLEARANCE_HOLES.M3.medium],
    ['HEAD', [round(dimensionOf(screw, 'dk', 'max') + 0.6), round(dimensionOf(screw, 'k', 'max') + 0.3)]],
    ['CASE_POS', bay.caseFrame.position.map(round)], ['CASE_ROT', bay.caseFrame.rotation], ['USB', bay.usb.map(round)],
    ['P_INNER', pose(poses['inner-body'])], ['P_OUTER', pose(poses['outer-body'])], ['P_CHUTE', pose(poses.chute)], ['P_ROTOR', pose(poses.rotor)], ['P_CAP', pose(poses.cap)], ['P_FLAP', pose(poses.flap)],
  ];
}

/** `treatScadValues` as an OpenSCAD literal. */
export function treatScadLayout(p: TreatDispenserParameters): string {
  const literal = (value: number | number[] | number[][] | boolean): string => typeof value === 'boolean' ? String(value) : JSON.stringify(value);
  return `[${treatScadValues(p).map(([name, value]) => `["${name}",${literal(value)}]`).join(',')}]`;
}

/* -------------------------------------------------------------------------------------------------------------------------------
 * The assembly
 * ----------------------------------------------------------------------------------------------------------------------------- */

export const TREAT_PRINTED_PARTS = ['inner-body', 'outer-body', 'rotor', 'flap', 'cap', 'chute', 'base', 'coupon', 'case-bottom', 'case-top'] as const;

const HOUSING = '#cdbfe3';

/**
 * Where the assembly draws the optional band: the library's loose loop (round, its width along Z), squeezed into an ellipse over the
 * flap's arm, as wide (y) as the slots allow and reaching the pegs' outer faces of its notch. The real band dips into the pegs' grooves
 * and lies on the arm; a scaled ring cannot, so it is drawn straight, just over the pegs' tops (less than a millimetre over the arm).
 */
export function treatBandPose(l: TreatDispenserLayout, p: Pick<TreatDispenserParameters, 'flapBand' | 'flapBandNotch'>) {
  const part = treatBandPart(p);
  if (!part) return undefined;
  const outer = dimensionOf(part, 'length') / Math.PI, inner = outer - dimensionOf(part, 'thickness');
  const along = l.band.pegOut(p.flapBandNotch - 1), across = (TREAT_DISPENSER.band.slot / 2 - 0.5) * inner / outer;
  const z = Math.max(l.flap.hinge.z + TREAT_DISPENSER.flap.hub, l.band.pegTop) + 0.05;
  return { part, pose: { position: [0, l.band.y, z] as Vec3, rotation: [0, 0, 0] as Vec3, scale: [along / inner, across / inner, 1] as Vec3 } };
}

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
  const motor = motorPart(), driver = driverPart(), board = findPart(ESP32_CASE_BOARD), nut = nutPart(), header = caseAssembly.references?.find(reference => reference.id === 'header-1');
  if (!board || !header) throw new Error('Missing the treat dispenser’s electronics.');
  const coupon: Pose = { position: [-110, 0, 0], rotation: [0, 0, 0] };
  // the motor's own frame: its can's back at z = 0, its mounting face at z = L, the shaft at +Y; here the shaft points −X along the
  // rotor's axis, 8 mm behind the can's axis (its can in front), its ears above and below
  const motorPose: Pose = { position: [l.motorFace + l.motorLength, l.canY, l.axisZ], rotation: rotationAngles([[0, 0, -1], [0, 1, 0], [1, 0, 0]]) };
  // every screw and nut where it sits; each moves in the step of the part it holds (the nuts first, into their bays)
  const bolts = treatBolts(p).map(bolt => ({ bolt, ...treatBoltPoses(bolt) }));
  const ids = (group: string, kind: 'screw' | 'nut') => bolts.filter(({ bolt }) => bolt.id.startsWith(group)).map(({ bolt }) => `${bolt.id}-${kind}`);
  const screw = (id: string) => findPart(id)?.title ?? id;
  const band = treatBandPose(l, p);
  return {
    partColors: { 'inner-body': HOUSING, 'outer-body': '#e8e2f2', base: '#3d3f45', chute: HOUSING, rotor: '#2f3136', flap: '#d9822b', cap: '#2f3136', coupon: '#d9822b', 'case-bottom': '#497c85', 'case-top': '#e5d9bb' },
    poses: {
      'inner-body': poses['inner-body'], 'outer-body': poses['outer-body'], base: poses.base, chute: poses.chute, rotor: poses.rotor, flap: poses.flap, cap: poses.cap, coupon,
      'case-bottom': inCase('bottom'), 'case-top': inCase('top'),
      motor: motorPose, driver: bay.driverPose,
      board: inCase('board'), 'header-1': inCase('header-1'), 'header-2': inCase('header-2'),
      ...Object.fromEntries(bolts.flatMap(({ bolt, screw, nut }) => [[`${bolt.id}-screw`, screw], [`${bolt.id}-nut`, nut]])),
      ...(band ? { band: band.pose } : {}),
      // the optional magnets, sealed in at print pauses (the library's disc: its axis Z, its bottom face at z = 0)
      ...(p.flapMagnets ? {
        'flap-magnet': { position: [0, l.magnets.flap.y, l.magnets.flap.centre - l.magnets.thickness / 2], rotation: [0, 0, 0] },
        'body-magnet': { position: [0, l.magnets.body.y, l.magnets.body.centre - l.magnets.thickness / 2], rotation: [0, 0, 0] },
      } : {}),
    },
    references: [
      { id: 'motor', part: motor.id, title: motor.title },
      { id: 'driver', part: driver.id, title: driver.title },
      { id: 'board', part: board.id, title: board.title },
      { id: 'header-1', part: header.part, title: `${header.title.replace(/ \(row \d\)$/, '')} (row 1)` },
      { id: 'header-2', part: header.part, title: `${header.title.replace(/ \(row \d\)$/, '')} (row 2)` },
      ...bolts.flatMap(({ bolt }) => [
        { id: `${bolt.id}-screw`, part: bolt.screw, title: `${screw(bolt.screw)} (${bolt.label})` },
        { id: `${bolt.id}-nut`, part: nut.id, title: `${nut.title} (${bolt.label})` },
      ]),
      ...(band ? [{ id: 'band', part: band.part.id, title: `${band.part.title} (across the flap’s arm, in notch ${p.flapBandNotch}; drawn straight over the pegs: it lies on the arm and dips into the pegs’ grooves)` }] : []),
      ...(p.flapMagnets ? [
        { id: 'flap-magnet', part: TREAT_DISPENSER.flap.magnet.part, title: `${screw(TREAT_DISPENSER.flap.magnet.part)} (in the flap’s counterweight, sealed in at a print pause)` },
        { id: 'body-magnet', part: TREAT_DISPENSER.flap.magnet.part, title: `${screw(TREAT_DISPENSER.flap.magnet.part)} (in the inner body over the counterweight, sealed in at a print pause; repelling the flap’s)` },
      ] : []),
    ],
    steps: [
      { title: 'Push two M3 nuts into the inner body’s motor bays, from the front', parts: ids('motor', 'nut'), from: [0, -16, 0] },
      { title: 'Drop M3 nuts into the ULN2003’s standoffs and the cap’s lugs', parts: [...ids('driver', 'nut'), ...ids('cap', 'nut')], from: [0, 0, 8] },
      { title: 'Snap the flap’s hub onto the two bosses behind the slot, pushed up and back from the bore (before the motor and the rotor: their shafts fill the bore); it swings freely', parts: ['flap', ...(p.flapMagnets ? ['flap-magnet'] : [])], from: [0, -12, -12] },
      ...(band ? [{ title: `Thread the rubber band (#${p.flapBand}) through the slot in one side wall, over the flap’s arm and out through the other (a bent paper clip pulls it through); hook its ends round the pegs of notch ${p.flapBandNotch} on both sides, into their grooves`, parts: ['band'], from: [0, 0, 6] }] : []),
      { title: 'Screw the motor to the inner body’s right side, its shaft into the block (two M3 × 6)', parts: ['motor', ...ids('motor', 'screw')], from: [45, 0, 0] },
      { title: 'Screw the ULN2003 board to its standoffs under the motor (four M3 × 8); plug in the motor', parts: ['driver', ...ids('driver', 'screw')], from: [45, 0, 0] },
      { title: 'Push M3 nuts into the outer body’s left corner columns, from inside', parts: ids('corner-left', 'nut'), from: [14, 0, 0] },
      { title: 'Push M3 nuts into the outer body’s right corner columns, from inside', parts: ids('corner-right', 'nut'), from: [-14, 0, 0] },
      { title: 'Lower the outer body over the inner body, the thread through its top (plug the jumper wires into the ULN2003 first)', parts: ['outer-body', ...ids('corner', 'nut')], from: [0, 0, 150] },
      { title: 'Push the chute up between the inner body’s legs, from below, its end through the front wall', parts: ['chute'], from: [0, 0, -85] },
      { title: 'Screw the base plate on from below, the inner body’s feet in its rims: four M3 × 8 into the outer body’s corners, whose top clamps the inner body’s collar', parts: ['base', ...ids('corner', 'screw')], from: [0, 0, -120] },
      { title: 'Slide the rotor in through the left wall onto the motor’s shaft; close the opening with the cap (two M3 × 10 into the lugs)', parts: ['rotor', 'cap', ...ids('cap', 'screw')], from: [-90, 0, 0] },
      { title: 'Plug the jumper wires onto either header row; push the ESP32-C3 case into the back wall’s window from behind, lid out, USB-C down', parts: ['case-bottom', 'case-top', 'board', 'header-1', 'header-2'], from: [0, 60, 0] },
    ],
    lift: 125,
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
  // a fingertip (a 1 mm ball, kinematic: it does not give) in the pocket under the funnel, by its leading face, halfway up: a foreign
  // object (the pocket drawn mouth up, turned by `pocket.turn` towards +Y)
  const lean = l.pocket.turn * Math.PI / 180, py = l.pocket.width / 2 - 1.5, pz = l.R / 2;
  const obstruction: Vec3 = [0, py * Math.cos(lean) + pz * Math.sin(lean), l.axisZ - py * Math.sin(lean) + pz * Math.cos(lean)];
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
      counter(primeEnd + presses * cycle + 0.25, 0, 'stray'), counter(primeEnd + presses * cycle + 0.25, 0, 'stray-motor'),
    ],
  };
  return [
    dispense,
    {
      id: 'idle', title: 'Filled and left alone for 6 s: no treat leaves, none strays', duration: 6,
      checks: [counter(6, 0), counter(6, 0, 'stray'), counter(6, 0, 'stray-motor'), field(6, 'idleExits', 0)],
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
