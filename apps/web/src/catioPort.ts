import { toggleLatchMechanism as TL } from '@canfactory/contracts';
import { latchHeights, PRINTED_LATCH, type LatchMount } from './catioPrintedLatch.ts';
import type { V3 } from './catioSubassembly.ts';

/**
 * The standard port (docs/concepts/catio/standard-port.md): the one interface every tunnel element presents, so that any element
 * couples to any other. A square clear opening, `s` each way (the tunnel's clear size), in a frame `T` deep and `F` wide, flush with
 * the element's 40 × 40 rails, as the end frames of a PawHut tunnel module are: every element is a flush box. The ends of every
 * section and collar are such a port, so are the two side openings of every section's end bay (`sidePortFace`), the window
 * insert's port frame and the enclosure's port.
 *
 * A port is either coupled to another element's port, or closed by a door: a removable wall, held by the port's own latches or by
 * turn buttons on its ring (`DoorFixing`). The latches and bolts stand at stations that are the same on all four sides of the ring,
 * so a port fits another at any of four rotations. Seen from outside, every port carries the base plates of its latches on its left
 * side and the catch plates on its right: two ports facing each other then have a base across from every catch, whichever two
 * elements they belong to.
 */
export const STANDARD_PORT = {
  /** The frame round the opening: `thickness` deep, `width` out from the opening, the rails' section, so that it is flush with them. */
  ring: { thickness: 40, width: 40 },
} as const;
const T = STANDARD_PORT.ring.thickness; const F = STANDARD_PORT.ring.width;

/** How a door is held on a port: set into it, by turn buttons on its ring (the default), or a blank held by the port's own toggle latches, as a coupling is. */
export const DOOR_FIXINGS = ['turn-buttons', 'latches'] as const;
export type DoorFixing = typeof DOOR_FIXINGS[number];
export const DOOR_FIXING_LABELS: Record<DoorFixing, string> = { 'turn-buttons': 'Set in, turn buttons on the port’s ring', latches: 'A blank on the port’s own toggle latches' };

/** The ring's outline: the port's size across its outer edges. */
export const portOutline = (s: number) => s + 2 * F;
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
 * The bolt stations of a port `s` square: `perSide` on each of its four sides, on the middle line of the frame, at the latches'
 * fractions of the side. The same on every side, so the set is unchanged by a quarter turn of the port about its centre.
 */
export function boltStations(s: number, perSide: 1 | 2 | 3): [u: number, v: number][] {
  const line = s / 2 + F / 2; const along = latchHeights(perSide).map(f => (f - 0.5) * s);
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
/**
 * Which sides of a port its latches stand on: its stiles' outer faces (left and right, `perSide` each, at the latch fractions of
 * its height), or its head's top face (two, at a fifth of the width in from each side), where a joint leaves the stiles no free face
 * on one element: an end butted into a side opening, whose posts are flanked by the section's own side.
 */
export type LatchSides = 'stiles' | 'head';
export function portLatches(id: string, face: Face, s: number, perSide: 1 | 2 | 3, gap: number, where: LatchSides = 'stiles'): PortLatch[] {
  const mount = (side: -1 | 1, k: number, u: number, v: number, out: V3, name: string): PortLatch => {
    const base = portHalf(side) === 'base' ? 'port' as const : 'outside' as const;
    // the seam: the base plate's edge, `overhang` proud of the face of whichever element it is on, into the gap
    const offset = base === 'port' ? -PRINTED_LATCH.overhang : -(gap - PRINTED_LATCH.overhang);
    // from the catch to the base, along the joint
    return { id: `${id}-latch-${name}-${k}`, side, base, at: facePoint(face, u, v, offset), out, pull: mul(face.n, base === 'port' ? 1 : -1) };
  };
  // on the head: two, one each side of the middle, lying on the top faces across the joint
  if (where === 'head') return latchHeights(2).map((f, k) => { const side: -1 | 1 = f < 0.5 ? -1 : 1; return mount(side, k, (f - 0.5) * s, s + F, face.frame.z, 'head'); });
  return ([-1, 1] as const).flatMap(side => latchHeights(perSide).map((f, k) => mount(side, k, side * (s / 2 + F), f * s, mul(face.frame.x, side), side < 0 ? 'left' : 'right')));
}

/** A box's six faces: back and front along its axis, left and right across it, top and bottom. */
type BoxFace = 'back' | 'front' | 'left' | 'right' | 'top' | 'bottom';

/**
 * The six faces of a box `C` each way round `centre`, in the frame of the run along it (`frame`: y along the run, z up), each a
 * standard port's plane: its normal `n` into the box, its frame's x to the right seen from outside, its z up the opening, and `at`
 * on the plane at the foot of the opening's middle (the profile's origin: u 0, v 0). The back face is the one the run enters by,
 * as a section's start face is.
 */
function boxFaces(centre: V3, frame: Frame, C: number, s: number): Record<BoxFace, Face> {
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

/** The least room left round a latch's parts as it swings open. */
export const SWING_CLEAR = 2;

/**
 * A side opening: every section starts with a square end bay, its end frame's stiles, then a bay post (`T` along, `F` across) one
 * opening further on, and the top and bottom rails, so that each of its two sides is an opening `s` square framed `F` wide all round,
 * exactly as an end frame is. Unused, it is closed by the standard door; at a turn the run before couples its end into it, as PawHut
 * tunnels make an L: a door taken out of one module's side and the next module's end butted into the opening.
 *
 * Its face, on the section's `side` (+1 right, −1 left, looking along it), round the middle of the opening at `centre` (half the
 * tunnel's height up, in the section's frame): its normal into the section, its frame's x to the right seen from outside, as a
 * section's end faces are.
 */
export function sidePortFace(centre: V3, frame: Frame, s: number, side: -1 | 1): Face {
  const faces = boxFaces(centre, frame, s + 2 * F, s); return side > 0 ? faces.right : faces.left;
}
/** From a section's start face to the middle of its end bay's side openings: the end frame and half an opening. */
export const sidePortOffset = (s: number) => T + s / 2;
/** The shortest section: one end bay, its far post the far end frame. */
export const sidePortLength = (s: number) => s + 2 * T;

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
    // on the frame's band, over the head (the opening is cut out), clear of the bolt guides on its middle line
    `<text x="${m + half}" y="${m + 9}" font-size="5">THIS SIDE OUT · lay on the frame’s face · holes: ${t.boltHole} mm bolt guides · notches: latch stations</text>`,
    `<text x="${m + half}" y="${m + F - 4}" font-size="5">latches: base plates on the left side, catches on the right, seen from outside</text>`,
    `</g>`,
    `</svg>`,
  ].join('\n');
}
