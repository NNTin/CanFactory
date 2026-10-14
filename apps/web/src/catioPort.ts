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

/** How a door is held on a port: by the port's own toggle latches, as a coupling is, or by turn buttons on its ring. */
export const DOOR_FIXINGS = ['latches', 'turn-buttons'] as const;
export type DoorFixing = typeof DOOR_FIXINGS[number];
export const DOOR_FIXING_LABELS: Record<DoorFixing, string> = { latches: 'The port’s own toggle latches', 'turn-buttons': 'Turn buttons on the port’s ring' };

/** The ring's outline: the port's size across its outer edges. */
export const portOutline = (s: number) => s + 2 * F;
/**
 * A cube's edge: each face a standard port whose ring stands flush with the face, the rings of two faces meeting edge to edge at
 * the inside of the corner between them. That leaves a notch `T` × `T` along each edge, outside both rings, in which both faces'
 * latch plates stand, and keeps a coupled element of one face clear of the other's.
 */
export const cubeEdge = (s: number) => s + 2 * (F + T);
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
 * The space a closed printed latch takes at its mount: across it, along the joint from its base plate's far edge to its catch
 * plate's, and out from the faces' plane to the base's back (the lever folded over centre on it). For checking it against what
 * stands round a port.
 */
export function latchEnvelope(mount: LatchMount): OrientedBox {
  const across = cross(mount.pull, mount.out);
  const { along, locked, length } = PRINTED_LATCH;
  // from the catch plate's far edge (behind the seam by the lock and its own plate) to the base plate's (ahead of it by its plate)
  const from = -(locked + along); const to = along; const out = TL.TOGGLE_LATCH_GEOMETRY.base.back;
  const centre = add(add(mount.at, mul(mount.pull, (from + to) / 2)), mul(mount.out, out / 2));
  return { center: centre, size: [length, to - from, out], axes: { x: across, y: mount.pull, z: mount.out } };
}
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
