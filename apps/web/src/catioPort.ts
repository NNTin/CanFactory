import { toggleLatchMechanism as TL } from '@canfactory/contracts';
import { latchHeights, PRINTED_LATCH, type LatchMount } from './catioPrintedLatch.ts';
import type { V3 } from './catioSubassembly.ts';

/**
 * The standard port (docs/concepts/catio/standard-port.md): the one interface every tunnel element presents, so that any element
 * couples to any other. A square clear opening, `s` each way (the tunnel's clear size), in a flange ring `T` thick and `F` wide.
 * The ends of every section and collar are such a port, every face of a cube is, and so are the window insert's docking frame and
 * the enclosure's port flange.
 *
 * A port is either coupled to another element's port, or closed by a door: a removable wall, held by the port's own latches or by
 * turn buttons on its ring (`DoorFixing`). The latches and bolts stand at stations that are the same on all four sides of the ring,
 * so a port fits another at any of four rotations. Seen from outside, every port carries the base plates of its latches on its left
 * side and the catch plates on its right: two ports facing each other then have a base across from every catch, whichever two
 * elements they belong to.
 */
export const STANDARD_PORT = {
  /** The flange ring round the opening: `thickness` deep, `width` out from the opening. */
  ring: { thickness: 30, width: 70 },
} as const;
const T = STANDARD_PORT.ring.thickness; const F = STANDARD_PORT.ring.width;

/** How a door is held on a port: set into it, by turn buttons on its ring (the default), or a blank held by the port's own toggle latches, as a coupling is. */
export const DOOR_FIXINGS = ['turn-buttons', 'latches'] as const;
export type DoorFixing = typeof DOOR_FIXINGS[number];
export const DOOR_FIXING_LABELS: Record<DoorFixing, string> = { 'turn-buttons': 'Set in, turn buttons on the port’s ring', latches: 'A blank on the port’s own toggle latches' };

/** The ring's outline: the port's size across its outer edges. */
export const portOutline = (s: number) => s + 2 * F;
/**
 * A cube's edge: each face a standard port whose ring stands flush with the face, and between the rings of two faces, along each
 * edge, a pocket `CUBE_POCKET` deep outside both rings in which both faces' latches stand and their levers swing open, closed
 * inside by a fillet strip glued to both rings. The pocket is the least that keeps every face's latch, open or closed, clear of the
 * other faces' rings, latches and coupled elements (`cubePocket`).
 */
export const cubeEdge = (s: number) => s + 2 * (F + T + CUBE_POCKET);
/** The corner blocks inside a cube, one at each corner behind its three rings: this much each way. */
export const CUBE_BLOCK = 40;

// Vectors
const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a: V3, k: number): V3 => [a[0] * k, a[1] * k, a[2] * k];
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit = (a: V3): V3 => mul(a, 1 / Math.hypot(...a));
const UP: V3 = [0, 0, 1];

/** A right-handed frame: x across, y along, z = x × y. */
export interface Frame { x: V3; y: V3; z: V3 }
/** The frame of a run along `y`: x horizontal, to the right looking along it, and z up off it. */
export function frameAlong(y: V3): Frame { const x = unit(cross(y, UP)); return { x, y, z: cross(x, y) }; }
/**
 * A face where a piece ends: the plane through `at` with forward normal `n`, on which the tunnel's profile (u across, v up from
 * the floor) is mapped from `frame`, along the frame's axis. A square end has `n` = the axis; a mitred end the bisector.
 */
export interface Face { at: V3; n: V3; frame: Frame }
/** The profile point (u, v) on a face, or on the parallel plane `offset` along its normal: the frame's line through (u, v) meets it there. */
export function facePoint(face: Face, u: number, v: number, offset = 0): V3 {
  const { x, y, z } = face.frame; const across = add(mul(x, u), mul(z, v));
  return add(add(face.at, across), mul(y, (offset - dot(face.n, across)) / dot(face.n, y)));
}

/** A rectangle of the profile: u from u0 to u1, v from v0 to v1. */
export type Rect = [u0: number, u1: number, v0: number, v1: number];
/** The flange ring's four members round an opening `s` square, in its face's profile (v up from the opening's floor). */
export function portRing(s: number): [name: 'stile-left' | 'stile-right' | 'head' | 'sill', rect: Rect][] {
  return [
    ['stile-left', [-s / 2 - F, -s / 2, -F, s + F]], ['stile-right', [s / 2, s / 2 + F, -F, s + F]],
    ['head', [-s / 2, s / 2, s, s + F]], ['sill', [-s / 2, s / 2, -F, 0]],
  ];
}

/**
 * The bolt stations of a port `s` square: `perSide` on each of its four sides, on the middle line of the ring's outer 30 mm (clear of
 * the rails along a section's corners), at the latches' fractions of the side. The same on every side, so the set is unchanged by a
 * quarter turn of the port about its centre.
 */
export function boltStations(s: number, perSide: 1 | 2 | 3): [u: number, v: number][] {
  const line = s / 2 + 40 + (F - 40) / 2; const along = latchHeights(perSide).map(f => (f - 0.5) * s);
  return [
    ...along.map(a => [-line, s / 2 + a] as [number, number]), ...along.map(a => [line, s / 2 - a] as [number, number]),
    ...along.map(a => [a, s / 2 + line] as [number, number]), ...along.map(a => [-a, s / 2 - line] as [number, number]),
  ];
}
/** The bolts per coupling offered: `perSide` on each of the four sides. */
export const BOLTS_PER_SIDE = { 4: 1, 8: 2, 12: 3 } as const;

/** Which latch half a port carries on each side, seen from outside it: the base plate on its left, the catch plate on its right. */
export const portHalf = (side: -1 | 1): 'base' | 'catch' => side < 0 ? 'base' : 'catch';

/**
 * A latch across the joint at a port, and which side of it its base plate is on: the port's own (`port`) or the element outside
 * it, coupled to it or closing it as a door (`outside`).
 */
export interface PortLatch extends LatchMount { base: 'port' | 'outside' }
/**
 * The printed latches between the port on `face` and whatever is `gap` outside it, `perSide` on each of the two sides across the
 * face's frame (its left and right, x), at the latch fractions of the opening's height. `face` is the port's plane, its normal `n`
 * pointing into the port's own element, and its frame's x is to the right seen from outside. Seen from outside, the port has its
 * base plates on its left side and its catch plates on its right (`portHalf`), so the element outside has its catches on the left
 * and its bases on the right: across every joint each latch's base is on one element and its catch on the other.
 */
export function portLatches(id: string, face: Face, s: number, perSide: 1 | 2 | 3, gap: number): PortLatch[] {
  return ([-1, 1] as const).flatMap(side => latchHeights(perSide).map((f, k) => {
    const base = portHalf(side) === 'base' ? 'port' as const : 'outside' as const;
    // the seam: the base plate's edge, `overhang` proud of the face of whichever element it is on, into the gap
    const offset = base === 'port' ? -PRINTED_LATCH.overhang : -(gap - PRINTED_LATCH.overhang);
    return {
      id: `${id}-latch-${side < 0 ? 'left' : 'right'}-${k}`, side, base,
      at: facePoint(face, side * (s / 2 + F), f * s, offset), out: mul(face.frame.x, side),
      // from the catch to the base, along the joint
      pull: mul(face.n, base === 'port' ? 1 : -1),
    };
  }));
}

/** A cube's six faces: back and front along its axis, left and right across it, top and bottom. */
export const PORT_FACES = ['back', 'front', 'left', 'right', 'top', 'bottom'] as const;
export type PortFace = typeof PORT_FACES[number];
export type PortRole = 'coupling' | 'door';

/**
 * The six faces of a cube of edge `C` round `centre`, in the frame of the run that enters it (`frame`: y along the run, z up), each
 * a standard port's plane: its normal `n` into the cube, its frame's x to the right seen from outside, its z up the opening, and
 * `at` on the plane at the foot of the opening's middle (the profile's origin: u 0, v 0). The back face is the one the run enters
 * by, as a section's start face is.
 */
export function cubeFaces(centre: V3, frame: Frame, C: number, s: number): Record<PortFace, Face> {
  const { x, y, z } = frame; const half = C / 2;
  /** The face whose outward normal is `out`, its profile's x and up `u` and `v` (so that u × (−out) = v, seen from outside). */
  const face = (out: V3, u: V3, v: V3): Face => ({ at: add(add(centre, mul(out, half)), mul(v, -s / 2)), n: mul(out, -1), frame: { x: u, y: mul(out, -1), z: v } });
  return {
    back: face(mul(y, -1), x, z), front: face(y, mul(x, -1), z),
    left: face(mul(x, -1), mul(y, -1), z), right: face(x, y, z),
    top: face(z, x, y), bottom: face(mul(z, -1), x, mul(y, -1)),
  };
}

/** A box in the world: its centre and its size along `axes` (x, y, z of a frame). */
export interface OrientedBox { center: V3; size: V3; axes: Frame }
/**
 * Where the printed latch's parts reach, in its own plane (u along the pull from the seam, v out from the faces' plane): closed,
 * and over its whole movement, from closed back over centre to open and the link swung off the hook (`TL.latchState`, the same
 * poses `buildPrintedLatches` draws). Its width is the widest part's, centred on the mount.
 */
export const LATCH_REACH = (() => {
  const P = TL.TOGGLE_LATCH_PROFILES; const G = TL.TOGGLE_LATCH_GEOMETRY;
  const points = (state: TL.LatchState) => ([[state.lever, P.leverSide], [state.lever, P.leverBridge], [state.link, P.linkSide], [state.link, P.linkBar],
    [TL.BASE_PLACEMENT, TL.BASE_PLATE_SECTION], [state.catch, TL.CATCH_PLATE_SECTION]] as const).flatMap(([placement, profile]) => TL.placeProfile(placement, profile as TL.Vec2[]));
  const range = (list: TL.Vec2[]) => ({ u: [Math.min(...list.map(q => q[0])), Math.max(...list.map(q => q[0]))] as [number, number], v: [Math.min(...list.map(q => q[1])), Math.max(...list.map(q => q[1]))] as [number, number] });
  const moving: TL.Vec2[] = [];
  for (let i = 0; i <= 40; i++) moving.push(...points(TL.latchState(TL.CLOSED + (TL.OPEN - TL.CLOSED) * i / 40)));
  for (let i = 0; i <= 20; i++) moving.push(...points(TL.latchState(TL.OPEN, TL.SWING * i / 20)));
  return { closed: range(points(TL.latchState(TL.CLOSED))), swing: range(moving), width: Math.max(G.base.length, G.catch.length, G.lever.width, G.link.width) };
})();
const reachBox = (mount: LatchMount, { u, v }: { u: [number, number]; v: [number, number] }): OrientedBox => {
  const across = cross(mount.pull, mount.out);
  const centre = add(add(mount.at, mul(mount.pull, (u[0] + u[1]) / 2)), mul(mount.out, (v[0] + v[1]) / 2));
  return { center: centre, size: [LATCH_REACH.width, u[1] - u[0], v[1] - v[0]], axes: { x: across, y: mount.pull, z: mount.out } };
};
/** The space a closed printed latch takes at its mount: its plates, and the lever folded over centre along the joint. */
export const latchEnvelope = (mount: LatchMount): OrientedBox => reachBox(mount, LATCH_REACH.closed);
/** The space a printed latch sweeps at its mount as it opens: the lever back over centre and out, the link swung off its hook. */
export const latchSwing = (mount: LatchMount): OrientedBox => reachBox(mount, LATCH_REACH.swing);
/** Whether two oriented boxes overlap by more than `clearance` (separating axis test over both boxes' axes and their cross products). */
export function boxesOverlap(a: OrientedBox, b: OrientedBox, clearance = 0): boolean {
  const axesOf = (q: OrientedBox) => [q.axes.x, q.axes.y, q.axes.z];
  const candidates = [...axesOf(a), ...axesOf(b), ...axesOf(a).flatMap(p => axesOf(b).map(q => cross(p, q)))].filter(v => Math.hypot(...v) > 1e-9).map(unit);
  const d: V3 = [b.center[0] - a.center[0], b.center[1] - a.center[1], b.center[2] - a.center[2]];
  const radius = (q: OrientedBox, axis: V3) => axesOf(q).reduce((r, e, i) => r + Math.abs(dot(e, axis)) * (q.size[i] ?? 0) / 2, 0);
  return candidates.every(axis => Math.abs(dot(d, axis)) < radius(a, axis) + radius(b, axis) - clearance);
}
/** A ring member's box: `rect` of the face's profile, `from` to `to` along its normal. */
export function memberBox(face: Face, rect: Rect, from: number, to: number): OrientedBox {
  const [u0, u1, v0, v1] = rect;
  const centre = facePoint(face, (u0 + u1) / 2, (v0 + v1) / 2, (from + to) / 2);
  return { center: centre, size: [u1 - u0, Math.abs(to - from), v1 - v0], axes: { x: face.frame.x, y: face.frame.y, z: face.frame.z } };
}

/** How far closed latches' halves reach into a ring along its depth, from its face: past it (the lever lies 32 mm along the joint). */
export const LATCH_INTO_RING = LATCH_REACH.closed.u[1] - PRINTED_LATCH.overhang;

/**
 * The pocket a cube needs along each edge: the least whole millimetres, at least `CUBE_POCKET_LEAST`, for which no face's latch,
 * closed or swinging open, reaches another face's ring, closed latch or coupled element (a standard element's ring across the gap
 * outside it). The same for every size of port: the faces meet the same way at the corner.
 */
export const CUBE_POCKET_LEAST = 0;
/** The least room left round a latch's parts as it swings open. */
export const CUBE_SWING_CLEAR = 2;
function cubeClashes(pocket: number, s = 300): boolean {
  const C = s + 2 * (F + T + pocket); const gap = 3; const faces = cubeFaces([0, 0, 0], { x: [1, 0, 0], y: [0, 1, 0], z: [0, 0, 1] }, C, s);
  const latches = PORT_FACES.flatMap(f => portLatches(f, faces[f], s, 3, gap).map(q => ({ face: f, closed: latchEnvelope(q), swing: latchSwing(q) })));
  const solid = PORT_FACES.flatMap(f => [
    ...portRing(s).map(([, rect]) => ({ face: f, box: memberBox(faces[f], rect, 0, T) })),
    ...portRing(s).map(([, rect]) => ({ face: f, box: memberBox(faces[f], rect, -gap - T, -gap) })),
  ]);
  // (swinging, at least `CUBE_SWING_CLEAR` clear: a lever is not printed or fitted to the tenth of a millimetre)
  return latches.some(q => solid.some(r => r.face !== q.face && (boxesOverlap(q.swing, r.box, -CUBE_SWING_CLEAR) || boxesOverlap(q.closed, r.box, 0.01)))
    || latches.some(r => r.face !== q.face && boxesOverlap(q.swing, r.closed, -CUBE_SWING_CLEAR)));
}
export const CUBE_POCKET = (() => {
  for (let pocket = CUBE_POCKET_LEAST; pocket <= 100; pocket++) if (!cubeClashes(pocket)) return pocket;
  throw new Error('No pocket keeps a cube’s latches clear of each other.');
})();
export { cubeClashes };

/**
 * A side port: the standard port on the side of a long section, so that another element's end couples onto it there and the
 * tunnel turns 90° without a cube. Its ring lies on the outer faces of the section's rails and floor board, its mating face flush
 * with the outlines of the section's flanges (the rails stand `SIDE_RING_SET` inside them), its opening the section's clear opening:
 * level with the floor, as high as the tunnel. The section runs on past it by a short stub, closed at its end by a door.
 *
 * Along the section, beside the ring on each side, is a pocket `SIDE_POCKET` long in which the latches at the ring's two sides
 * stand and their levers swing open: between the ring and the stub's flange, the least that keeps every latch of the side port and
 * of the stub's end port, closed or swinging open, clear of the other's rings, latches and the elements outside them
 * (`sideClashes`). Behind the latches, a pocket post (`sidePocketPost`) closes the side between the floor and the top rail.
 */
export const SIDE_RAIL = 40;
/** How far a section's rails stand inside its flanges' outline: the side ring's depth, so that its face is flush with the flanges. */
export const SIDE_RING_SET = F - SIDE_RAIL;
/** The faces of a section with a side port on its right, seen along it: its start (back) face and the side port's, round the port's middle. */
export function sidePortFaces(centre: V3, frame: Frame, s: number, pocket: number): { back: Face; side: Face } {
  const D = s / 2 + F + pocket + T;
  const back = cubeFaces(centre, frame, 2 * D, s).back;
  const side = cubeFaces(centre, frame, s + 2 * F, s).right;
  return { back, side };
}
/** How far into the side ring, from its face, the latches' parts reach as they swing: what the pocket post stays behind. */
export const LATCH_SWING_INTO = Math.max(LATCH_REACH.swing.u[1] - PRINTED_LATCH.overhang, LATCH_INTO_RING);
/**
 * Whether a side port with this pocket clashes: every latch of the side port and of the stub's end port (closed, and swinging open
 * with `CUBE_SWING_CLEAR` to spare) against the other port's ring, the ring of an element coupled to it (or a door's blank) across
 * the gap, the other's closed latches, and the section's rails.
 */
export function sideClashes(pocket: number, s = 300): boolean {
  const gap = 3; const frame: Frame = { x: [1, 0, 0], y: [0, 1, 0], z: [0, 0, 1] };
  const faces = sidePortFaces([0, 0, 0], frame, s, pocket);
  const latches = (['back', 'side'] as const).flatMap(f => portLatches(f, faces[f], s, 3, gap).map(q => ({ face: f, closed: latchEnvelope(q), swing: latchSwing(q) })));
  const solid: { face: string; box: OrientedBox }[] = (['back', 'side'] as const).flatMap(f => [
    ...portRing(s).map(([, rect]) => ({ face: f, box: memberBox(faces[f], rect, 0, T) })),
    ...portRing(s).map(([, rect]) => ({ face: f, box: memberBox(faces[f], rect, -gap - T, -gap) })),
  ]);
  // the section's rails along its corners on the side port's side, from the stub's flange on (the floor board is under the opening)
  const D = s / 2 + F + pocket + T; const r = SIDE_RAIL;
  for (const z of [[-18 - r, -18], [s, s + r]] as const) {
    const length = 4 * D;
    solid.push({ face: 'section', box: { center: [s / 2 + r / 2, -D + T + length / 2, (z[0] + z[1]) / 2 - s / 2], size: [r, length, z[1] - z[0]], axes: frame } });
  }
  return latches.some(q => solid.some(r2 => r2.face !== q.face && (boxesOverlap(q.swing, r2.box, -CUBE_SWING_CLEAR) || boxesOverlap(q.closed, r2.box, 0.01))))
    || latches.some(q => latches.some(r2 => r2.face !== q.face && boxesOverlap(q.swing, r2.closed, -CUBE_SWING_CLEAR)));
}
export const SIDE_POCKET = (() => {
  for (let pocket = 0; pocket <= 120; pocket++) if (!sideClashes(pocket)) return pocket;
  throw new Error('No pocket keeps a side port’s latches clear of the section’s end.');
})();
/** From a section's start face to the middle of a side port at its start: its stub, the pocket and half the ring's outline. */
export const sidePortOffset = (s: number) => T + SIDE_POCKET + F + s / 2;
/** The shortest section that takes a side port with a pocket on both sides of it. */
export const sidePortLength = (s: number) => 2 * sidePortOffset(s);
/**
 * A pocket post: in each pocket beside a side port, standing on the floor board under the top rail, from the opening's edge inwards
 * to just behind the latches' swing, `width` along the section and `depth` across it (from the clear opening's plane outwards).
 */
export const sidePocketPost = (s: number) => ({ width: SIDE_POCKET, depth: Math.floor(s / 2 + F - LATCH_SWING_INTO - CUBE_SWING_CLEAR - s / 2) });

/**
 * A cube's edge strips: in each of its 12 edges, filling the corner outside both rings' outlines (the pocket and a ring's depth,
 * square), glued and screwed to the two rings' sides; along the edge between the corner blocks, cut short of every latch station
 * there (any side of a face may carry latches, at the same stations), so that each latch has its pocket to stand and swing in.
 * Each as (from, to) along the edge, measured from the cube's middle. They stiffen the cube and close its edges between the
 * latches.
 */
export function edgeStripSegments(s: number, perSide: 1 | 2 | 3): [number, number][] {
  const end = cubeEdge(s) / 2 - T - CUBE_BLOCK; const clear = LATCH_REACH.width / 2 + 2;
  const stations = latchHeights(perSide).map(f => (f - 0.5) * s).sort((a, b) => a - b);
  const cuts = [-end, ...stations.flatMap(z => [z - clear, z + clear]), end];
  const segments: [number, number][] = [];
  for (let i = 0; i < cuts.length; i += 2) { const a = cuts[i] ?? 0; const b = cuts[i + 1] ?? 0; if (b - a >= 20) segments.push([a, b]); }
  return segments;
}
/** An edge strip's section: the corner square outside both rings' outlines, from the outline to the cube's edge. */
export const edgeStripSection = (s: number) => cubeEdge(s) / 2 - (s / 2 + F);

/**
 * The marking template for a standard port: a 6 mm plywood sheet the ring's outline, laid on a ring's face to mark and pre-drill
 * it, so that every port is set out from the same template and any one fits any other at any quarter turn.
 *
 * - every bolt station of every count offered (one, two or three on each side), as a 9 mm drill guide;
 * - every latch station, as a notch on each of the four outer edges: the latch's middle, where its plates are screwed on the
 *   ring's side (base plates on the left side seen from outside, catch plates on the right);
 * - the opening, cut out;
 * - a mark on one face ("this side out") and nothing that is not the same on all four sides, so a quarter turn maps it onto itself.
 */
export interface PortTemplate { size: number; opening: number; bolts: [number, number][]; notches: { side: 0 | 1 | 2 | 3; along: number }[]; thickness: number; boltHole: number }
export function portTemplate(s: number): PortTemplate {
  const fractions = [...new Set(([1, 2, 3] as const).flatMap(n => latchHeights(n)).map(f => Math.round(f * 1000) / 1000))].sort((a, b) => a - b);
  const bolts: [number, number][] = [];
  for (const n of [1, 2, 3] as const) for (const q of boltStations(s, n)) if (!bolts.some(b => Math.hypot(b[0] - q[0], b[1] - q[1]) < 1e-6)) bolts.push(q);
  // the notches along each side, measured along it from its middle, the same on every side
  const notches = ([0, 1, 2, 3] as const).flatMap(side => fractions.map(f => ({ side, along: (f - 0.5) * s })));
  return { size: portOutline(s), opening: s, bolts, notches, thickness: 6, boltHole: 9 };
}
/** The template drawn at 1:1, in millimetres, as an SVG document: cut lines black, drill guides as circles, notches as V cuts. */
export function portTemplateSvg(s: number): string {
  const t = portTemplate(s); const half = t.size / 2; const m = 20; const W = t.size + 2 * m;
  // the profile's (u, v) with v up from the opening's foot, in the drawing's (x, y) with y down, centred on the sheet
  const x = (u: number) => m + half + u; const y = (v: number) => m + half - (v - s / 2);
  const notch = 6;
  const sideNotch = (side: 0 | 1 | 2 | 3, along: number) => {
    // sides: 0 left, 1 head, 2 right, 3 sill; a V cut `notch` deep into the edge
    if (side === 0) return `M ${m} ${y(s / 2 + along) - notch / 2} L ${m + notch} ${y(s / 2 + along)} L ${m} ${y(s / 2 + along) + notch / 2}`;
    if (side === 2) return `M ${m + t.size} ${y(s / 2 - along) - notch / 2} L ${m + t.size - notch} ${y(s / 2 - along)} L ${m + t.size} ${y(s / 2 - along) + notch / 2}`;
    if (side === 1) return `M ${x(along) - notch / 2} ${m} L ${x(along)} ${m + notch} L ${x(along) + notch / 2} ${m}`;
    return `M ${x(-along) - notch / 2} ${m + t.size} L ${x(-along)} ${m + t.size - notch} L ${x(-along) + notch / 2} ${m + t.size}`;
  };
  const r = (n: number) => Number(n.toFixed(2));
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}mm" height="${W}mm" viewBox="0 0 ${W} ${W}">`,
    `<title>Standard port marking template, ${s} mm port: 1:1, 6 mm plywood</title>`,
    `<g fill="none" stroke="#000" stroke-width="0.3">`,
    `<rect x="${m}" y="${m}" width="${t.size}" height="${t.size}"/>`,
    `<rect x="${x(-s / 2)}" y="${y(s)}" width="${s}" height="${s}"/>`,
    ...t.notches.map(q => `<path d="${sideNotch(q.side, q.along)}"/>`),
    ...t.bolts.map(([u, v]) => `<circle cx="${r(x(u))}" cy="${r(y(v))}" r="${t.boltHole / 2}"/>`),
    `</g>`,
    `<g font-family="sans-serif" font-size="6" fill="#000" text-anchor="middle">`,
    // on the ring's band, over the head: the opening is cut out
    `<text x="${m + half}" y="${m + 34}">THIS SIDE OUT · lay on the ring’s face</text>`,
    `<text x="${m + half}" y="${m + 44}">holes: ${t.boltHole} mm bolt guides · notches: latch stations</text>`,
    `<text x="${m + half}" y="${m + 54}">latches: base plates on the left side, catches on the right, seen from outside</text>`,
    `</g>`,
    `</svg>`,
  ].join('\n');
}
