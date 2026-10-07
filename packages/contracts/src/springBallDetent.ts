import { dimensionOf, springRate, type Part } from './parts/index.ts';

/**
 * The spring ball detent (models/spring-ball-detent/generator.scad, docs/spring-ball-detent.md): a printed plunger body that holds a
 * bought steel ball part-way out of its nose on a bought compression spring, as Ganter's GN 615 spring plungers do. The body is
 * threaded (it screws into a tapped hole) or plain (it is pressed or glued into a hole, or built into a part). It is printed standing on
 * its back face, nose up. Either the ball and spring go in from the back, which a printed press cap (pushed in up to the floor of the
 * tool feature) or a set screw (which adjusts the preload) then closes; or the back is solid and they go in through an opening in the
 * side, where the spring holds itself and the ball: one end in the bore above the opening, the other in a pocket below it. A slot or a
 * hex socket in the back face turns a threaded body.
 *
 * Every size along the axis (`z`) is measured from the back face (z = 0) to the nose (z = bodyLength). Millimetres.
 */

export const DETENT_THREADS = ['M6', 'M8', 'M10', 'M12'] as const;
export type DetentThread = typeof DETENT_THREADS[number];
/** ISO 261 coarse pitches of the body's threads, as ISO 4026's table lists them with each thread. */
export const DETENT_THREAD_PITCH: Record<DetentThread, number> = { M6: 1, M8: 1.25, M10: 1.5, M12: 1.75 };
export const DETENT_BODIES = ['threaded', 'plain'] as const;
export type DetentBody = typeof DETENT_BODIES[number];
export const DETENT_RETENTIONS = ['press-cap', 'set-screw', 'side-opening'] as const;
export type DetentRetention = typeof DETENT_RETENTIONS[number];
export const DETENT_TOOL_FEATURES = ['slot', 'hex', 'none'] as const;
export type DetentToolFeature = typeof DETENT_TOOL_FEATURES[number];

/** Hex key sizes (ISO 2936) a socket in the back can be cut for, in mm across the flats. */
export const HEX_KEYS = [1.5, 2, 2.5, 3, 4, 5, 6, 8] as const;

/**
 * The fixed rules of the design. Mirrored in generator.scad.
 * - `wall`: the least printed wall between any hole and the root of the body's thread (two 0.4 mm lines).
 * - `lipOverlap`: how far the nose's lip reaches over the ball, radially, at least: a tenth of the ball's diameter, from 0.2 to 0.3 mm
 *   (`lipOverlap(ball)`); `lipEdge`: the lip's edge at the nose face.
 * - `minProtrusion`: the least the ball stands out of the nose.
 * - `innerShare`: the spring's inner diameter, at most, as a share of the ball's, so that the ball sits on the spring's end coil;
 *   `outerShare`: its outer diameter, at least, as a share of the bore's, so that the bore guides it.
 * - `minPreload` (mm, and as a share of the spring's deflection): how much the spring is compressed with the ball out, at least.
 * - `preloadShare`: where in its working range the press cap sets the spring's installed length, from the shortest allowed (the
 *   spring at its least length Ln at full travel) to the longest (least preload): a quarter of the way, for a firm click.
 * - `capMin`: the press cap's least length, to hold in the bore; `capPlay`: its core under the bore's diameter; `capRibs` crush ribs
 *   `capRibWidth` wide stand out to the bore's diameter plus the interference.
 * - `keyPlay`: a hex socket's play over its key.
 * - The side opening: `sideEngage`, how far each end of the spring stays in the closed bore beyond the opening, also with the ball
 *   pushed in, so that it cannot come out sideways; `sideMargin`, how much longer than the spring's least length the opening is, to
 *   put it in compressed; `backFloor`, the least solid back behind the pocket (and under the tool feature).
 * - `plainChamfer`: the 45° chamfer round both ends of a plain body.
 */
export const DETENT = {
  wall: 0.8, lipOverlap: { share: 0.1, min: 0.2, max: 0.3 }, lipEdge: 0.2, minProtrusion: 0.2, innerShare: 0.8, outerShare: 0.6,
  minPreload: { mm: 0.3, share: 0.1 }, preloadShare: 0.25,
  capMin: 3, capPlay: 0.1, capRibs: 6, capRibWidth: 0.6, keyPlay: 0.15,
  sideEngage: 1.5, sideMargin: 0.5, backFloor: 1.2, plainChamfer: 0.5,
} as const;

/** ISO 68-1's basic depth of an external thread's profile (h3 = 0.61343 P). */
const THREAD_DEPTH = 0.61343;

export interface SpringBallDetentSize {
  body: DetentBody; thread: DetentThread; bodyDiameter: number; protrusion: number; travel: number; retention: DetentRetention; bodyLength: number;
  toolFeature: DetentToolFeature; clearance: number; threadPlay: number; capInterference: number;
}
export interface DetentParts { ball: Part; spring: Part; setScrew: Part }

const round = (value: number, digits = 2) => Math.round(value * 10 ** digits) / 10 ** digits;

/**
 * The body's outside: a threaded body's printed thread (its major diameter, the nominal less the play, and its root), or a plain
 * body's diameter as both; `d` is the nominal size the tool feature is proportioned from, and `maxHole` the largest hole that leaves
 * `wall`.
 */
export function detentThread(p: Pick<SpringBallDetentSize, 'body' | 'thread' | 'threadPlay' | 'bodyDiameter'>) {
  if (p.body === 'plain') return { d: p.bodyDiameter, pitch: null, major: p.bodyDiameter, minor: p.bodyDiameter, maxHole: p.bodyDiameter - 2 * DETENT.wall };
  const d = Number(p.thread.slice(1)); const pitch = DETENT_THREAD_PITCH[p.thread];
  const major = d - p.threadPlay; const minor = major - 2 * THREAD_DEPTH * pitch;
  return { d, pitch, major, minor, maxHole: minor - 2 * DETENT.wall };
}

/**
 * The tool feature's sizes, for a body of nominal size `d`: a slot d/5 wide (at least 1.2 mm) and d/4 deep; a hex socket for the
 * smallest key that passes `through` (what goes in through it: the press cap or the set screw), or, behind a solid back (`through`
 * null), the largest key up to d/2, as GN 615.3; or none.
 */
export function detentToolFeature(p: Pick<SpringBallDetentSize, 'toolFeature'>, d: number, through: number | null) {
  if (p.toolFeature === 'none') return { kind: 'none' as const, width: null, depth: 0, key: null, across: null, corners: null };
  if (p.toolFeature === 'slot') return { kind: 'slot' as const, width: round(Math.max(1.2, d / 5), 1), depth: d / 4, key: null, across: null, corners: null };
  const key = through === null ? [...HEX_KEYS].reverse().find(size => size <= d / 2 + 1e-9) ?? 1.5 : HEX_KEYS.find(size => size + DETENT.keyPlay >= through - 1e-9) ?? 8;
  const across = key + DETENT.keyPlay;
  return { kind: 'hex' as const, width: null, depth: Math.max(2, key), key, across, corners: across * 2 / Math.sqrt(3) };
}

/**
 * The body's layout from its sizes and the chosen ball, spring and set screw.
 * - The ball: a bore `bore` wide (its largest diameter plus the clearance) ends in a 45° cone up to the lip's opening `opening`, which
 *   the ball touches `lipEdge` below the nose, so that it stands `protrusion` out; `contactDrop` is the ball's centre below the lip.
 * - The spring rests on the ball's lower half where its end coil's inner edge touches it (`nest` below the ball's centre), and on the
 *   cap's face or the set screw's point (`seat`), compressed to `installed` with the ball out and `installed - travel` pushed in.
 * - A set screw turns in a hole tapped from its tap drill (d − P) up to `tapTop`, where it gives the least installed length; backed
 *   out to the longest installed length, its back end is still `slack` inside the tool feature's floor.
 * - A side opening runs from `sideEngage` above the pocket's floor (the seat) to `sideEngage` below the spring's top with the ball
 *   pushed in. It must take the ball, and the spring compressed to its least length and `sideMargin` more, so the spring's shortest
 *   installed length is that plus the travel and both engagements. The back is solid up to the seat.
 */
export function springBallDetentLayout(p: SpringBallDetentSize, { ball, spring, setScrew }: DetentParts) {
  const thread = detentThread(p);
  const r = dimensionOf(ball, 'd') / 2;
  const bore = round(dimensionOf(ball, 'd', 'max') + p.clearance, 4);
  const lipDrop = r - p.protrusion - DETENT.lipEdge;
  const opening = 2 * Math.sqrt(Math.max(0, r * r - lipDrop * lipDrop));
  const contact = p.bodyLength - DETENT.lipEdge;
  const centre = contact - lipDrop;
  const coneBottom = contact - (bore - opening) / 2;
  const wire = dimensionOf(spring, 'd'); const outer = dimensionOf(spring, 'De'); const inner = outer - 2 * wire;
  const nest = Math.sqrt(Math.max(0, r * r - (inner / 2) ** 2));
  const springTop = centre - nest;
  const free = dimensionOf(spring, 'L0'); const least = dimensionOf(spring, 'Ln');
  const deflection = free - least;
  const preload = Math.max(DETENT.minPreload.mm, DETENT.minPreload.share * deflection);
  const side = p.retention === 'side-opening';
  const longest = free - preload;
  const opensTo = Math.max(least + DETENT.sideMargin, bore);
  const shortest = side ? opensTo + p.travel + 2 * DETENT.sideEngage : least + p.travel;
  const installed = shortest + DETENT.preloadShare * (longest - shortest);
  const seat = springTop - installed;
  const screwD = dimensionOf(setScrew, 'd'); const screwPitch = dimensionOf(setScrew, 'pitch');
  const through = p.retention === 'press-cap' ? bore + p.capInterference : p.retention === 'set-screw' ? screwD : null;
  const tool = detentToolFeature(p, thread.d, through);
  const rate = springRate(spring);
  return {
    thread, r, bore, lipDrop, opening, contact, centre, coneBottom, inner, nest, springTop, free, least, preload, longest, shortest, installed, seat, tool, rate,
    /** The side opening, from `bottom` to `top` above the back face; the spring goes in compressed to at most `fit`. */
    side: { bottom: seat + DETENT.sideEngage, top: springTop - p.travel - DETENT.sideEngage, fit: installed - p.travel - 2 * DETENT.sideEngage, backFloor: seat - tool.depth },
    /** The cap: from the tool feature's floor to the seat. */
    cap: { length: seat - tool.depth, core: bore - DETENT.capPlay, ribs: bore + p.capInterference },
    /** The set screw's hole and travel: its seat from `seatLeast` (longest installed length) to `seatMost` (shortest). */
    screw: { d: screwD, tap: round(screwD - screwPitch, 3), tapTop: springTop - shortest, seatLeast: springTop - longest, seatMost: springTop - shortest, slack: springTop - longest - dimensionOf(setScrew, 'l') - tool.depth },
    /** The spring's force with the ball out and pushed in, in N. */
    force: { out: rate * (free - installed), in: rate * (free - installed + p.travel) },
  };
}
export type SpringBallDetentLayout = ReturnType<typeof springBallDetentLayout>;

/** How far the nose's lip reaches over this ball, radially, at least (`DETENT.lipOverlap`). */
export function lipOverlap(ball: Part): number {
  const o = DETENT.lipOverlap;
  return Math.min(o.max, Math.max(o.min, o.share * dimensionOf(ball, 'd')));
}

/** The largest and smallest protrusion this ball allows: the lip still reaches `lipOverlap` over it, and touches it at most 45° up. */
export function protrusionRange(ball: Part) {
  const r = dimensionOf(ball, 'd') / 2; const rMin = dimensionOf(ball, 'd', 'min') / 2;
  const reach = rMin - lipOverlap(ball);
  return { max: round(r - Math.sqrt(r * r - reach * reach) - DETENT.lipEdge, 2), min: round(Math.max(DETENT.minProtrusion, r * (1 - Math.SQRT1_2) - DETENT.lipEdge), 2) };
}

/** Why these sizes, ball, spring and set screw do not make a working detent, by the parameter to change. */
export function springBallDetentIssues(p: SpringBallDetentSize, parts: DetentParts): { field: string; message: string }[] {
  const { ball, spring, setScrew } = parts;
  const issues: { field: string; message: string }[] = [];
  const layout = springBallDetentLayout(p, parts);
  const { thread, bore, tool } = layout;
  const mm = (value: number) => `${round(value)} mm`;
  const ballD = dimensionOf(ball, 'd');
  const plain = p.body === 'plain';
  const body = plain ? `a ${mm(p.bodyDiameter)} plain body` : `an ${p.thread} body (its printed thread’s root is ${mm(thread.minor)} across)`;
  const larger = plain ? 'a wider body' : 'a larger thread';
  if (bore > thread.maxHole + 1e-9) issues.push({ field: 'ball', message: `A ${ballD} mm ball needs a ${mm(bore)} bore, but ${body} takes at most ${mm(thread.maxHole)} with ${DETENT.wall} mm of wall. Choose a smaller ball or ${larger}.` });
  const outerMax = dimensionOf(spring, 'De', 'max');
  if (outerMax > bore + 1e-9) issues.push({ field: 'spring', message: `The ${spring.designation} spring is up to ${mm(outerMax)} wide: it does not fit the ${ballD} mm ball’s ${mm(bore)} bore. Choose a narrower spring or a larger ball.` });
  else if (dimensionOf(spring, 'De') < DETENT.outerShare * bore - 1e-9) issues.push({ field: 'spring', message: `The ${spring.designation} spring is only ${mm(dimensionOf(spring, 'De'))} wide: it would wander in the ${ballD} mm ball’s ${mm(bore)} bore. Choose a spring at least ${mm(DETENT.outerShare * bore)} wide.` });
  else if (layout.inner > DETENT.innerShare * ballD + 1e-9) issues.push({ field: 'spring', message: `The ${spring.designation} spring is ${mm(layout.inner)} wide inside: the ${ballD} mm ball would sink into it. Choose a spring at most ${mm(DETENT.innerShare * ballD)} wide inside (thicker wire), or a larger ball.` });
  const range = protrusionRange(ball);
  if (p.protrusion > range.max + 1e-9) issues.push({ field: 'protrusion', message: `A ${ballD} mm ball can stand out at most ${mm(range.max)}: further, the nose’s lip would reach less than ${lipOverlap(ball)} mm over it. Choose less protrusion or a larger ball.` });
  else if (p.protrusion < range.min - 1e-9) issues.push({ field: 'protrusion', message: `A ${ballD} mm ball must stand out at least ${mm(range.min)}, so that it touches the lip’s edge, not the cone below it.` });
  if (p.travel < p.protrusion - 1e-9) issues.push({ field: 'travel', message: `The travel must be at least the protrusion (${mm(p.protrusion)}), so that the ball can be pushed in flush with the nose.` });
  const most = layout.free - layout.least - layout.preload;
  if (p.travel > most + 1e-9) issues.push({ field: 'travel', message: `The ${spring.designation} spring can be compressed ${mm(layout.free - layout.least)}, from ${mm(layout.free)} to its least length of ${mm(layout.least)}; less ${mm(layout.preload)} of preload that leaves at most ${mm(most)} of travel before it goes solid. Choose less travel or a longer spring.` });
  const feature = tool.kind === 'slot' ? 'slot' : tool.kind === 'hex' ? 'hex socket' : 'back face';
  if (p.retention === 'side-opening' && layout.shortest > layout.longest + 1e-9) issues.push({ field: 'spring', message: `Through a side opening the ${spring.designation} spring must go in compressed to ${mm(layout.least + DETENT.sideMargin)} (the ${ballD} mm ball needs ${mm(bore)}), and then reach ${DETENT.sideEngage} mm past both ends of the opening even with the ball pushed ${mm(p.travel)} in: it would have to be ${mm(layout.shortest)} long installed, but with its least preload it is at most ${mm(layout.longest)}. Choose a longer spring, less travel, or another retention.` });
  // Along the body: the cap, the backed-out set screw, or the solid back must leave room for the tool feature.
  const need = p.retention === 'press-cap' ? DETENT.capMin - layout.cap.length : p.retention === 'set-screw' ? -layout.screw.slack : DETENT.backFloor - layout.side.backFloor;
  const least = mm(Math.ceil((p.bodyLength + need) * 2) / 2);
  if (need > 1e-9) issues.push({ field: 'bodyLength', message: p.retention === 'press-cap'
    ? `The body must be at least ${least} long, for a press cap of at least ${DETENT.capMin} mm behind this ball and spring.`
    : p.retention === 'set-screw'
      ? `The body must be at least ${least} long, so that the ${setScrew.designation}, backed out to the least preload, stays below the ${feature}. Or choose a shorter set screw.`
      : `The body must be at least ${least} long, to leave ${DETENT.backFloor} mm of solid back behind the spring’s pocket${tool.kind === 'none' ? '' : `, under the ${feature}`}.` });
  if (p.retention === 'set-screw') {
    if (layout.screw.d > thread.maxHole + 1e-9) issues.push({ field: 'setScrew', message: `The ${setScrew.designation}’s thread is ${mm(layout.screw.d)} across, but ${body} takes at most ${mm(thread.maxHole)}. Choose a smaller set screw, a larger thread, or the press cap.` });
    else if (layout.screw.tap < bore - 1e-9) issues.push({ field: 'setScrew', message: `The ball and spring go in through the set screw’s ${mm(layout.screw.tap)} tap hole, which is narrower than the ${mm(bore)} bore. Choose a larger set screw, or the press cap.` });
    else if (dimensionOf(setScrew, 'dp', 'min') <= layout.inner + 1e-9) issues.push({ field: 'setScrew', message: `The ${setScrew.designation}’s ${mm(dimensionOf(setScrew, 'dp', 'min'))} flat point is no wider than the spring is inside (${mm(layout.inner)}): the spring would slip over it. Choose a larger set screw.` });
  }
  if (tool.kind === 'hex' && tool.corners > thread.maxHole + 1e-9) issues.push({ field: 'toolFeature', message: `A hex socket for a ${tool.key} mm key${p.retention === 'side-opening' ? '' : `, which the ${p.retention === 'press-cap' ? 'press cap' : 'set screw'} must pass,`} is ${mm(tool.corners)} across its corners: ${body} takes at most ${mm(thread.maxHole)}. Choose the slot, or ${larger}.` });
  if (!plain && tool.kind === 'none') issues.push({ field: 'toolFeature', message: 'A threaded body needs a slot or a hex socket in its back to screw it in.' });
  return issues;
}

/**
 * The library's balls, springs and set screws the detent offers: every part of the three families (listed rather than computed, so
 * that the parameters' types name them; a test keeps the lists equal to the library's). The validation says when one does not fit.
 */
export const DETENT_BALLS = ['steel-ball-2-5-g100', 'steel-ball-3-g100', 'steel-ball-3-5-g100', 'steel-ball-4-g100', 'steel-ball-4-5-g100', 'steel-ball-5-g100', 'steel-ball-6-g100'] as const;
export const DETENT_SPRINGS = ['gutekunst-d-024', 'gutekunst-d-027', 'gutekunst-d-039', 'gutekunst-d-040', 'gutekunst-d-054', 'gutekunst-d-055', 'gutekunst-d-077', 'gutekunst-d-078', 'gutekunst-d-082', 'gutekunst-d-083', 'gutekunst-d-088', 'gutekunst-d-102', 'gutekunst-d-107', 'gutekunst-d-108', 'gutekunst-d-134', 'gutekunst-d-139'] as const;
export const DETENT_SET_SCREWS = [
  'iso-4026-m3x3', 'iso-4026-m3x4', 'iso-4026-m3x5', 'iso-4026-m3x6', 'iso-4026-m3x8', 'iso-4026-m3x10', 'iso-4026-m4x4', 'iso-4026-m4x5', 'iso-4026-m4x6',
  'iso-4026-m4x8', 'iso-4026-m4x10', 'iso-4026-m4x12', 'iso-4026-m5x5', 'iso-4026-m5x6', 'iso-4026-m5x8', 'iso-4026-m5x10', 'iso-4026-m5x12', 'iso-4026-m6x6',
  'iso-4026-m6x8', 'iso-4026-m6x10', 'iso-4026-m6x12', 'iso-4026-m6x16', 'iso-4026-m8x8', 'iso-4026-m8x10', 'iso-4026-m8x12', 'iso-4026-m8x16',
] as const;

/** The defaults: a threaded M10 body with a 4.5 mm ball on Gutekunst's D-107, about the size of Ganter's GN 615 M8 (a printed body needs thicker walls). */
export const SPRING_BALL_DETENT_DEFAULT = {
  body: 'threaded', thread: 'M10', bodyDiameter: 10, ball: 'steel-ball-4-5-g100', spring: 'gutekunst-d-107', protrusion: 0.8, travel: 1, retention: 'press-cap', setScrew: 'iso-4026-m6x6',
  bodyLength: 22, toolFeature: 'slot', clearance: 0.3, threadPlay: 0.2, capInterference: 0.2,
} as const;
