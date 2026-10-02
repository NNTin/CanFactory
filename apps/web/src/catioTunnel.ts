import { dimensionOf, findPart, TUNNEL_FOOT, TUNNEL_HARDWARE as HW, tunnelFoot, type Part } from '@canfactory/contracts';
import { CATIO, type CatioView } from './catioDesign.ts';
import type { CatioMode } from './catioSettings.ts';
import { fastenersAlong, parseControlled, subassemblyStorageKey, type AssemblyStep, type BomLine, type CameraPreset, type DesignDecision, type SubassemblyControl, type V3 } from './catioSubassembly.ts';
import { parseWindowInsert, WINDOW_INSERT_DEFAULT, windowFor, windowInsertLayout, type WindowInsertConfig, type WindowSpec } from './catioWindowInsert.ts';

/**
 * The tunnel: the enclosed, supported walkway from the window insert's cat port to the enclosure's rear cat port. Millimetres;
 * X along the wall, +Y outdoors, Z up; the wall face is Y=0 and the grass at the wall Z=0, as in catioDesign.ts.
 *
 * The route is solved, not drawn: it leaves the window port straight out from the wall, runs `approach` to its first turn,
 * crosses to a point `final` short of the enclosure port and arrives there square to it. Both turn angles follow from where the
 * port is, so they can be any angle. A difference in floor height is climbed by a straight sloped run inside one leg, between
 * two vertical bends. Turns happen only where the tunnel is level and bends only where it runs straight, so the floor never
 * tilts sideways (no compound mitres). Every turn and bend is an angle joint of the chosen type; its geometry is exact (see
 * `jointSetback`). The layout below is the one source for the 3D scene, the parts list and the tests.
 */
export interface TunnelConfig {
  /** The enclosure port's centre along the wall from the window's centre (+ to the right, seen from the garden). */
  portX: number;
  /** How far the enclosure port's face is from the wall. */
  portY: number;
  /** Which way the tunnel runs into the port, in degrees from straight out of the wall (+ turned to the right). */
  portFacing: number;
  /** The port's floor (its threshold) above the grass at the wall. */
  portHeight: number;
  /** The straight run out from the wall before the first turn. */
  approach: number;
  /** The straight run square into the port after the last turn. */
  final: number;
  /** The leg that climbs or falls to the port's height. */
  slopeLeg: 'approach' | 'middle' | 'final';
  /** The steepest the sloped run may be, in degrees. */
  maxSlope: 10 | 15 | 20 | 25;
  /** How the sections meet at a turn or a bend. */
  angleJoint: 'angle-collar' | 'mitred-ends';
  /** The longest section; each straight run is divided into equal sections no longer. */
  sectionLength: 500 | 750 | 1000;
  /** M8 bolts through each pair of flanges. */
  couplingBolts: 4 | 6 | 8;
  /** Foot diameter of the levelling feet. */
  footDiameter: 25 | 32 | 40;
  /** How much the ground falls away from the wall, in per cent. */
  groundFall: 0 | 1 | 2 | 4;
  /** How far the ground under any foot may be above or below that fall, in mm. */
  groundTolerance: 10 | 15 | 20 | 25;
}

export const TUNNEL_DEFAULT: TunnelConfig = {
  portX: 1200, portY: 3000, portFacing: 0, portHeight: 500, approach: 700, final: 700, slopeLeg: 'middle', maxSlope: 20,
  angleJoint: 'angle-collar', sectionLength: 750, couplingBolts: 6, footDiameter: 40, groundFall: 2, groundTolerance: 15,
};

/** Fixed sizes of the tunnel. */
export const TUNNEL = {
  /** Each end of a section is a flange ring: `thickness` along the tunnel, `width` out from the clear opening. */
  flange: { thickness: 30, width: 70 },
  /** Rails along the corners, the floor board, and the gap left to the wall at the window. */
  rail: 40, floor: 18, wallGap: 10,
  bearer: { width: 45, depth: 70 }, leg: 45, brace: { width: 70, thickness: 22 }, braceFrom: 300,
  /** A support too low for legs is a solid bearer ripped to depth: never shallower than this. */
  minBlock: 45,
  /** Legs are cut to whole multiples of this; the foot takes up the rest. */
  legRound: 5,
  slab: { size: 300, thickness: 40 },
  cleat: { size: 20, pitch: 120 },
  /** The shortest straight run: a level run before and after a slope, and one between joints. */
  minRun: 150,
  /** A rail shorter than this is left out: the flanges are screwed to the collar's floor there. */
  minRail: 20,
  /** The sharpest turn each joint type is offered for. */
  maxTurn: { 'angle-collar': 135, 'mitred-ends': 90 },
  staplePitch: 150, floorScrewPitch: 200,
  mesh: { opening: CATIO.meshOpening, wire: CATIO.wire },
} as const;

/** The fixed interfaces: the window insert's port (where the tunnel starts) and the tunnel's clear size. */
export interface TunnelSite { w: number; h: number; floorZ: number; window: WindowSpec; insert: WindowInsertConfig }

/** The window insert as saved on its own page (or its defaults), in the modular window saved on the catio concept page. */
export function tunnelSite(): TunnelSite {
  const window = windowFor('modular');
  let insert = WINDOW_INSERT_DEFAULT;
  try { insert = parseWindowInsert((JSON.parse(localStorage.getItem(subassemblyStorageKey('window-insert')) ?? 'null') as { config?: unknown } | null)?.config) ?? insert; } catch { /* defaults */ }
  const tunnel = window.tunnel ?? { width: 300, height: 300 };
  return { w: tunnel.width, h: tunnel.height, floorZ: windowInsertLayout('modular', insert, window).floor, window, insert };
}

// Vectors
const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul = (a: V3, s: number): V3 => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const len = (a: V3) => Math.hypot(...a);
const unit = (a: V3): V3 => mul(a, 1 / len(a));
const UP: V3 = [0, 0, 1];
const rad = (deg: number) => deg * Math.PI / 180;
const deg = (r: number) => r * 180 / Math.PI;
/** Plan direction of a heading: degrees from +Y (straight out of the wall), + turned to the right (towards +X). */
const heading = (psi: number, pitch = 0): V3 => [Math.sin(psi) * Math.cos(pitch), Math.cos(psi) * Math.cos(pitch), Math.sin(pitch)];
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
export const vec = { add, sub, mul, dot, cross, len, unit };

/** A piece's frame: `y` along the tunnel, `x` across it to the right and horizontal (no roll, ever), `z` its up. */
export interface Frame { x: V3; y: V3; z: V3 }
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

export interface Joint {
  id: string; kind: 'turn' | 'bend';
  /** Signed degrees: a turn + to the right, a bend + upwards. */
  angle: number;
  /** Where the centre lines of the two runs meet. */
  vertex: V3; a: V3; b: V3;
  /** How far each run stops short of the vertex along its centre line (0 for mitred ends). */
  setback: number;
  /** Distance from the floor's centre line to the profile's edge on the inside of the joint. */
  inside: number;
  /** The angle collar that fills it, when there is one. */
  collar: string | null;
}
export interface Piece {
  id: string; kind: 'section' | 'collar'; name: string;
  frame: Frame; start: Face; end: Face; length: number;
  /** Degrees the piece climbs (its axis); a collar's is that of its chord. */
  pitch: number;
  joint: string | null;
}
export interface Interface { id: string; kind: 'wall' | 'coupling' | 'port'; face: Face; before: string | null; after: string | null }
export interface Bolt { at: V3; n: V3 }
export interface Coupling { id: string; face: Face; stage: 5 | 6; bolts: Bolt[]; use: string }
export interface Foot { id: string; at: V3; designGround: number; actualGround: number; slabTop: number; setting: number; actualSetting: number; leg: number }
export interface Support {
  id: string; at: V3; along: V3; across: V3; length: number; top: number;
  kind: 'trestle' | 'block'; depth: number; slope: number; feet: Foot[];
  brace: { from: V3; to: V3 } | null;
  /** Points where screws go up through the bearer into the flanges or collar rails above. */
  fixings: V3[];
}
export interface MeshPanel { id: string; piece: string; name: string; corners: [V3, V3, V3, V3]; edges: { from: V3; to: V3; drive: V3; use: string }[] }
export interface Fastener { partId: string; component: 'rail-screws' | 'floor-screws' | 'cleat-screws' | 'staples' | 'bearer-screws' | 'brace-screws' | 'flange-screws'; at: V3; direction: V3; use: string; across?: V3 }
/** A rectangle of the profile: u from u0 to u1, v from v0 to v1. */
export type Rect = [u0: number, u1: number, v0: number, v1: number];
export interface Member { id: string; piece: string; name: string; section: string; from: Face; fromOffset: number; to: Face; toOffset: number; rect: Rect; kind: 'flange' | 'rail' | 'floor' }

/** The deepest it can stay out of the wall while the profile clears it: the flange's outer edge. */
const F = TUNNEL.flange.width; const T = TUNNEL.flange.thickness;

/**
 * How far each run stops short of the joint's vertex, so that the backs of the two flanges either side of the joint (the
 * runs' own square end flanges, or an angle collar's two flanges) meet exactly on the bisector plane at the profile's inside
 * edge, and open into a wedge towards the outside. For a joint turning the axis by θ, with the profile's inside edge `inside`
 * from the floor's centre line and flanges `thickness` thick: e = thickness + inside · tan θ/2. (The back of the first flange
 * is the plane a·(X − J) = −(e − thickness); it meets the bisector plane at (e − thickness) / sin θ/2 inwards of the vertex,
 * which is the inside edge, inside / cos θ/2 there.) Mitred ends meet on the bisector plane through the vertex: no setback.
 */
export function jointSetback(theta: number, inside: number, type: TunnelConfig['angleJoint']): number {
  if (type === 'mitred-ends') return 0;
  return T + inside * Math.tan(Math.abs(theta) / 2);
}

/** The ground: falling away from the wall, with bumps no larger than the tolerance (the same at every reload). */
export function groundAt(config: TunnelConfig, x: number, y: number, actual = true): number {
  const fall = -config.groundFall / 100 * Math.max(0, y);
  if (!actual) return fall;
  const bump = 0.62 * Math.sin(x / 370 + 1.3) * Math.sin(y / 530 - 0.4) + 0.38 * Math.cos(x / 210 - y / 290 + 0.7);
  return fall + config.groundTolerance * bump;
}

function part(id: string): Part {
  const found = findPart(id); if (!found) throw new Error(`The parts library has no ${id}.`); return found;
}

type Run = { kind: 'run'; dir: V3; length: number; psi: number; pitch: number; leg: number };
type JointItem = { kind: 'joint'; joint: Omit<Joint, 'vertex' | 'collar' | 'id'> };

/** Everything the tunnel is, placed and installed. */
export function tunnelLayout(config: TunnelConfig, site: TunnelSite = tunnelSite()) {
  const { w, h, floorZ } = site;
  const errors: string[] = [];
  const type = config.angleJoint;
  const S: V3 = [0, TUNNEL.wallGap, floorZ];
  const E: V3 = [config.portX, config.portY, config.portHeight];
  const psiE = rad(config.portFacing);
  const dE = heading(psiE);
  // The centre line in plan: out from the wall, across, and square into the port.
  const V1: V3 = add(S, mul(heading(0), config.approach));
  const V2: V3 = sub([E[0], E[1], S[2]], mul(dE, config.final));
  const middle = sub(V2, V1); const middleLength = Math.hypot(middle[0], middle[1]);
  const psiM = middleLength > 1e-6 ? Math.atan2(middle[0], middle[1]) : 0;
  const turns = [wrap(psiM), wrap(psiE - psiM)];
  const lateral = w / 2 + F;
  const maxTurn = TUNNEL.maxTurn[type];
  turns.forEach((theta, i) => {
    if (Math.abs(deg(theta)) > maxTurn + 1e-9) errors.push(`The ${i === 0 ? 'first' : 'second'} turn would be ${Math.abs(deg(theta)).toFixed(1)}°; ${type === 'angle-collar' ? 'angle collars' : 'mitred ends'} go to ${maxTurn}°. Move the port, change its facing or the straight runs.`);
  });
  const turnSetback = turns.map(theta => Math.abs(deg(theta)) < 0.05 ? null : jointSetback(theta, lateral, type));
  const legs = [
    { psi: 0, length: config.approach, in: 0, out: turnSetback[0] ?? 0 },
    { psi: psiM, length: middleLength, in: turnSetback[0] ?? 0, out: turnSetback[1] ?? 0 },
    { psi: psiE, length: config.final, in: turnSetback[1] ?? 0, out: 0 },
  ];
  // The climb: one straight sloped run inside the chosen leg, level runs of equal length before and after it.
  const rise = E[2] - S[2]; const up = rise > 0; const slopeLegIndex = { approach: 0, middle: 1, final: 2 }[config.slopeLeg];
  const insideUp = h + F; const insideDown = F;
  const [r1, r2] = up ? [insideUp, insideDown] : [insideDown, insideUp];
  const bendSetbacks = (phi: number) => [jointSetback(phi, r1, type), jointSetback(phi, r2, type)] as const;
  let slope: { pitch: number; run: number; footprint: number } | null = null;
  if (Math.abs(rise) >= 0.5) {
    const climb = Math.abs(rise);
    const runAt = (phi: number) => { const [e1, e2] = bendSetbacks(phi); return climb / Math.sin(phi) - e1 - e2; };
    let phi = rad(config.maxSlope); let run = runAt(phi);
    if (run < TUNNEL.minRun) {
      // Too little to climb for the steepest slope: a shallower one over the shortest run.
      const at = (p: number) => { const [e1, e2] = bendSetbacks(p); return Math.sin(p) * (TUNNEL.minRun + e1 + e2) - climb; };
      let lo = 1e-6; let hi = phi;
      for (let i = 0; i < 100; i++) { const mid = (lo + hi) / 2; if (at(mid) > 0) hi = mid; else lo = mid; }
      phi = (lo + hi) / 2; run = TUNNEL.minRun;
    }
    const [e1, e2] = bendSetbacks(phi);
    slope = { pitch: up ? phi : -phi, run, footprint: e1 + (e1 + run + e2) * Math.cos(phi) + e2 };
  }

  // The sequence of straight runs and the joints between them.
  const items: (Run | JointItem)[] = [];
  legs.forEach((leg, i) => {
    if (i > 0) {
      const theta = turns[i - 1] ?? 0; const e = turnSetback[i - 1];
      if (e !== null && e !== undefined) items.push({ kind: 'joint', joint: { kind: 'turn', angle: deg(theta), a: heading(legs[i - 1]?.psi ?? 0), b: heading(leg.psi), setback: e, inside: lateral } });
    }
    const available = leg.length - leg.in - leg.out;
    const level = (length: number) => items.push({ kind: 'run', dir: heading(leg.psi), length, psi: leg.psi, pitch: 0, leg: i });
    if (slope && i === slopeLegIndex) {
      const flat = (available - slope.footprint) / 2;
      if (flat < TUNNEL.minRun - 1e-6) errors.push(`The ${config.slopeLeg} leg is too short to climb ${Math.round(Math.abs(rise))} mm at up to ${config.maxSlope}°: it needs ${Math.ceil(slope.footprint + 2 * TUNNEL.minRun + leg.in + leg.out)} mm. Lengthen it, slope another leg or allow a steeper slope.`);
      const phi = Math.abs(slope.pitch); const [e1, e2] = bendSetbacks(phi); const s = Math.sign(slope.pitch);
      level(Math.max(flat, 1));
      items.push({ kind: 'joint', joint: { kind: 'bend', angle: s * deg(phi), a: heading(leg.psi), b: heading(leg.psi, slope.pitch), setback: e1, inside: r1 } });
      items.push({ kind: 'run', dir: heading(leg.psi, slope.pitch), length: slope.run, psi: leg.psi, pitch: slope.pitch, leg: i });
      items.push({ kind: 'joint', joint: { kind: 'bend', angle: -s * deg(phi), a: heading(leg.psi, slope.pitch), b: heading(leg.psi), setback: e2, inside: r2 } });
      level(Math.max(flat, 1));
    } else {
      if (available < TUNNEL.minRun - 1e-6) errors.push(`The ${['approach', 'middle', 'final'][i]} run is too short for its ${i === 1 ? 'turns' : 'turn'}: ${Math.max(0, Math.round(available))} mm left between the joints, at least ${TUNNEL.minRun} needed.`);
      level(Math.max(available, 1));
    }
  });

  // Walk the sequence: sections of each run, an angle collar or a shared mitre at each joint.
  const pieces: Piece[] = []; const joints: Joint[] = []; const interfaces: Interface[] = [];
  let at = S; let pendingMitre: V3 | null = null;
  let sectionCount = 0;
  items.forEach((item, index) => {
    if (item.kind === 'joint') {
      const j = item.joint; const id = `joint-${joints.length + 1}`;
      const chord = unit(add(j.a, j.b));
      if (type === 'angle-collar') {
        const vertex = add(at, mul(j.a, j.setback)); const end = add(vertex, mul(j.b, j.setback));
        const collarId = `collar-${joints.length + 1}`;
        const frame = frameAlong(chord);
        pieces.push({ id: collarId, kind: 'collar', name: `Angle collar ${joints.length + 1}`, frame, start: { at, n: j.a, frame: frameAlong(j.a) }, end: { at: end, n: j.b, frame: frameAlong(j.b) },
          length: len(sub(end, at)), pitch: deg(Math.asin(chord[2])), joint: id });
        joints.push({ ...j, id, vertex, collar: collarId });
        at = end;
      } else {
        joints.push({ ...j, id, vertex: at, collar: null });
        pendingMitre = chord;
      }
      return;
    }
    const n = Math.max(1, Math.ceil(item.length / config.sectionLength - 1e-9)); const piece = item.length / n;
    const next = items[index + 1];
    const frame = frameAlong(item.dir);
    for (let k = 0; k < n; k++) {
      const end = add(at, mul(item.dir, piece));
      const startNormal: V3 = k === 0 && pendingMitre ? pendingMitre : item.dir;
      const endNormal: V3 = k === n - 1 && next?.kind === 'joint' && type === 'mitred-ends' ? unit(add(next.joint.a, next.joint.b)) : item.dir;
      sectionCount++;
      pieces.push({ id: `section-${sectionCount}`, kind: 'section', name: `Section ${sectionCount}`, frame, start: { at, n: startNormal, frame }, end: { at: end, n: endNormal, frame },
        length: piece, pitch: deg(item.pitch), joint: null });
      at = end;
    }
    pendingMitre = null;
  });

  // Faces between pieces: the wall end, the couplings, the port end.
  const first = pieces[0]; const last = pieces.at(-1);
  if (first) interfaces.push({ id: 'wall', kind: 'wall', face: first.start, before: null, after: first.id });
  pieces.slice(1).forEach((p, i) => { const prev = pieces[i]; if (prev) interfaces.push({ id: `coupling-${i + 1}`, kind: 'coupling', face: { ...p.start, frame: prev.kind === 'collar' ? p.start.frame : prev.end.frame }, before: prev.id, after: p.id }); });
  if (last) interfaces.push({ id: 'port', kind: 'port', face: last.end, before: last.id, after: null });
  const arrived = last ? len(sub(last.end.at, E)) : Infinity;
  if (errors.length === 0 && arrived > 0.01) errors.push('The route does not reach the port.');

  // Bolts on every coupling and at the port: up the outer flange stiles, and across the head for 8.
  const sideHeights = config.couplingBolts === 4 ? [0.15, 0.85] : [0.15, 0.5, 0.85];
  const pattern: [number, number][] = [
    ...[-1, 1].flatMap(s => sideHeights.map(f => [s * (w / 2 + 40 + (F - 40) / 2), f * h] as [number, number])),
    ...(config.couplingBolts === 8 ? [[-w / 4, h + 40 + (F - 40) / 2], [w / 4, h + 40 + (F - 40) / 2]] as [number, number][] : []),
  ];
  const couplings: Coupling[] = interfaces.filter(i => i.kind !== 'wall').map(i => ({
    id: i.id, face: i.face, stage: i.kind === 'port' ? 6 : 5, use: i.kind === 'port' ? 'Last flange to the enclosure’s port flange' : 'Flange to flange',
    bolts: pattern.map(([u, v]) => ({ at: facePoint(i.face, u, v), n: i.face.n })),
  }));

  // Members: each piece has a flange ring at both ends, rails along its four corners and a floor board.
  const members: Member[] = [];
  const ring: [string, Rect][] = [
    ['stile-left', [-w / 2 - F, -w / 2, -F, h + F]], ['stile-right', [w / 2, w / 2 + F, -F, h + F]],
    ['head', [-w / 2, w / 2, h, h + F]], ['sill', [-w / 2, w / 2, -F, 0]],
  ];
  const r = TUNNEL.rail; const fl = TUNNEL.floor; const outer = w / 2 + r;
  for (const p of pieces) {
    for (const [end, face, offset] of [['start', p.start, T], ['end', p.end, -T]] as const) {
      for (const [name, rect] of ring) members.push({ id: `${p.id}-${end}-${name}`, piece: p.id, name: `Flange ${name.replace('-', ', ')}`, section: `${T} × ${F}`, from: face, fromOffset: 0, to: face, toOffset: offset, rect, kind: 'flange' });
    }
    const bottom = p.kind === 'collar' ? -F : -fl - r;
    const rails: [string, Rect][] = [
      ['bottom-left', [-outer, -w / 2, bottom, -fl]], ['bottom-right', [w / 2, outer, bottom, -fl]],
      ['top-left', [-outer, -w / 2, h, h + r]], ['top-right', [w / 2, outer, h, h + r]],
    ];
    for (const [name, rect] of rails) {
      const rail: Member = { id: `${p.id}-rail-${name}`, piece: p.id, name: `Rail, ${name.replace('-', ' ')}`, section: `${r} × ${rect[3] - rect[2]}`, from: p.start, fromOffset: T, to: p.end, toOffset: -T, rect, kind: 'rail' };
      // where the flanges nearly touch (the inside of a sharp joint) there is no room for a rail
      if (memberCut(rail).length >= TUNNEL.minRail) members.push(rail);
    }
    members.push({ id: `${p.id}-floor`, piece: p.id, name: 'Floor board', section: `${fl} mm exterior plywood`, from: p.start, fromOffset: T, to: p.end, toOffset: -T, rect: [-outer, outer, -fl, 0], kind: 'floor' });
  }

  // Mesh: both sides and the roof of every piece, edges stapled to the rails and turned onto the flanges.
  const panels: MeshPanel[] = []; const fasteners: Fastener[] = [];
  const mid = (rect: Rect): [number, number] => [(rect[0] + rect[1]) / 2, (rect[2] + rect[3]) / 2];
  for (const p of pieces) {
    const s0 = (u: number, v: number) => facePoint(p.start, u, v, T); const s1 = (u: number, v: number) => facePoint(p.end, u, v, -T);
    const back = mul(p.start.n, -1); const forward = p.end.n;
    for (const side of [-1, 1]) {
      const u = side * outer; const inward = mul(p.frame.x, -side);
      const c: [V3, V3, V3, V3] = [s0(u, -fl - r), s1(u, -fl - r), s1(u, h + r), s0(u, h + r)];
      panels.push({ id: `${p.id}-mesh-${side < 0 ? 'left' : 'right'}`, piece: p.id, name: `${p.name}: side mesh, ${side < 0 ? 'left' : 'right'}`, corners: c, edges: [
        { from: c[0], to: c[1], drive: inward, use: 'Onto the bottom rail' }, { from: c[3], to: c[2], drive: inward, use: 'Onto the top rail' },
        { from: c[0], to: c[3], drive: back, use: 'Turned onto the flange' }, { from: c[1], to: c[2], drive: forward, use: 'Turned onto the flange' },
      ] });
    }
    const c: [V3, V3, V3, V3] = [s0(-outer, h + r), s1(-outer, h + r), s1(outer, h + r), s0(outer, h + r)];
    const down = mul(p.frame.z, -1); const railLine = (s: number) => [s0(s * (w / 2 + r / 2), h + r), s1(s * (w / 2 + r / 2), h + r)] as const;
    const [la, lb] = railLine(-1); const [ra, rb] = railLine(1);
    panels.push({ id: `${p.id}-mesh-roof`, piece: p.id, name: `${p.name}: roof mesh`, corners: c, edges: [
      { from: la, to: lb, drive: down, use: 'Onto the top rail' }, { from: ra, to: rb, drive: down, use: 'Onto the top rail' },
      { from: c[0], to: c[3], drive: back, use: 'Turned onto the flange' }, { from: c[1], to: c[2], drive: forward, use: 'Turned onto the flange' },
    ] });
    // Rails into the flanges: two screws into each rail's end grain, driven from the flange's outer face.
    for (const m of members.filter(m => m.piece === p.id && m.kind === 'rail')) {
      const [u, v] = mid(m.rect);
      for (const [face, into] of [[p.start, p.start.n], [p.end, mul(p.end.n, -1)]] as const) {
        for (const k of [-1, 1]) fasteners.push({ partId: HW.railScrew, component: 'rail-screws', at: facePoint(face, u + k * 8, v + k * 8), direction: into, use: `${p.kind === 'collar' ? 'Collar' : 'Section'} rails through the flanges` });
      }
    }
    // The floor board down onto the bottom rails.
    for (const s of [-1, 1]) {
      const a = s0(s * (w / 2 + r / 2), 0); const b = s1(s * (w / 2 + r / 2), 0); const l = len(sub(b, a));
      const count = p.kind === 'collar' ? 1 : fastenersAlong(l - 60, TUNNEL.floorScrewPitch);
      for (let i = 0; i < count; i++) {
        const t = count === 1 ? 0.5 : (30 + i * (l - 60) / (count - 1)) / l;
        fasteners.push({ partId: HW.floorScrew, component: 'floor-screws', at: add(a, mul(sub(b, a), t)), direction: down, use: 'Floor board onto the bottom rails' });
      }
    }
  }
  // Cleats across the floor of every sloped section, for grip.
  const cleats: { id: string; piece: string; center: V3; frame: Frame; length: number }[] = [];
  for (const p of pieces.filter(p => p.kind === 'section' && Math.abs(p.pitch) > 0.01)) {
    const count = Math.floor((p.length - 2 * T) / TUNNEL.cleat.pitch);
    for (let i = 0; i < count; i++) {
      const y = T + (i + 0.5) * (p.length - 2 * T) / count;
      const center = add(add(p.start.at, mul(p.frame.y, y)), mul(p.frame.z, TUNNEL.cleat.size / 2));
      cleats.push({ id: `${p.id}-cleat-${i}`, piece: p.id, center, frame: p.frame, length: w });
      for (const s of [-1, 1]) fasteners.push({ partId: HW.cleatScrew, component: 'cleat-screws', at: add(add(center, mul(p.frame.x, s * w / 4)), mul(p.frame.z, TUNNEL.cleat.size / 2)), direction: mul(p.frame.z, -1), use: 'Cleats onto the sloped floor' });
    }
  }
  const staple = part(HW.staple);
  for (const panel of panels) for (const e of panel.edges) {
    const l = len(sub(e.to, e.from)); const count = fastenersAlong(l, TUNNEL.staplePitch); const along = unit(sub(e.to, e.from));
    for (let i = 0; i < count; i++) fasteners.push({ partId: staple.id, component: 'staples', at: add(e.from, mul(sub(e.to, e.from), (i + 0.5) / count)), direction: e.drive, across: along, use: `Mesh: ${e.use.toLowerCase()}` });
  }

  // Supports: one under the wall end, the port end, every straight coupling, and every joint (under its collar or mitre).
  const foot = tunnelFoot(config.footDiameter); const insertNut = part(HW.footInsertNut); const lockNut = part(HW.couplingNut);
  const l3 = dimensionOf(foot, 'l3');
  /** A foot's stud: at least the supplied nut out of the timber, and the insert nut's length still in it. */
  const travel = { min: dimensionOf(lockNut, 'm'), max: dimensionOf(foot, 'l1') - dimensionOf(insertNut, 'l') };
  const middleSetting = (travel.min + travel.max) / 2;
  const minLeg = dimensionOf(insertNut, 'l') + 5;
  const underside = (q: [number, number]) => {
    let best: number | null = null; let slopeAt = 0;
    for (const p of pieces) {
      const a = facePoint(p.start, -lateral, -F); const b = facePoint(p.start, lateral, -F); const c = facePoint(p.end, lateral, -F);
      const normal = unit(cross(sub(b, a), sub(c, a)));
      if (Math.abs(normal[2]) < 1e-9) continue;
      const z = a[2] - (normal[0] * (q[0] - a[0]) + normal[1] * (q[1] - a[1])) / normal[2];
      const point: V3 = [q[0], q[1], z];
      if (dot(sub(point, p.start.at), p.start.n) < -0.5 || dot(sub(point, p.end.at), p.end.n) > 0.5) continue;
      if (Math.abs(dot(sub(point, p.start.at), p.frame.x)) > 3 * lateral) continue;
      if (best === null || z < best) { best = z; slopeAt = p.pitch; }
    }
    return best === null ? null : { z: best, slope: slopeAt };
  };
  const supports: Support[] = [];
  const station = (id: string, centre: V3, along: V3, width: number, fixings: V3[]) => {
    const a = unit([along[0], along[1], 0]); const across = unit(cross(a, UP));
    const half = TUNNEL.bearer.width / 2;
    let top = Infinity; let slopeAt = 0;
    for (const s of [-1, 0, 1]) for (const t of [-1, 0, 1]) {
      const q = add(add(centre, mul(a, s * half)), mul(across, t * (width / 2 - 1)));
      const found = underside([q[0], q[1]]); if (found && found.z < top) { top = found.z; if (s === 0 && t === 0) slopeAt = found.slope; }
      if (found && s === 0 && t === 0) slopeAt = found.slope;
    }
    if (!Number.isFinite(top)) top = centre[2] - F;
    const legAt = (side: number) => add([centre[0], centre[1], 0], mul(across, side * (width / 2 - TUNNEL.leg / 2)));
    const ends = [-1, 1].map(side => {
      const q = legAt(side); const design = groundAt(config, q[0], q[1], false);
      return { q, design, actual: groundAt(config, q[0], q[1]), room: top - (design + TUNNEL.slab.thickness) - (l3 + middleSetting) };
    });
    const room = Math.min(...ends.map(e => e.room));
    const trestle = room >= TUNNEL.bearer.depth + minLeg;
    const depth = trestle ? TUNNEL.bearer.depth : Math.round(ends.reduce((sum, e) => sum + e.room, 0) / ends.length);
    if (!trestle && depth < TUNNEL.minBlock) errors.push(`At the ${id.replace('-', ' ')} the tunnel is too close to the ground for a support: ${Math.round(room + l3 + middleSetting)} mm under it, at least ${Math.ceil(TUNNEL.minBlock + l3 + middleSetting + TUNNEL.slab.thickness)} mm needed. Raise the port or slope the approach.`);
    const feet: Foot[] = ends.map((e, i) => {
      const leg = trestle ? Math.round((e.room - TUNNEL.bearer.depth) / TUNNEL.legRound) * TUNNEL.legRound : 0;
      const slabDesign = e.design + TUNNEL.slab.thickness; const slabTop = e.actual + TUNNEL.slab.thickness;
      const bottom = top - depth - leg;
      const setting = bottom - slabDesign - l3; const actualSetting = bottom - slabTop - l3;
      return { id: `${id}-foot-${i === 0 ? 'left' : 'right'}`, at: [e.q[0], e.q[1], slabTop], designGround: e.design, actualGround: e.actual, slabTop, setting, actualSetting, leg };
    });
    const longest = Math.max(...feet.map(f => f.leg));
    const [left, right] = feet.map(f => f.at);
    const brace = trestle && longest > TUNNEL.braceFrom && left && right
      ? { from: [left[0], left[1], left[2] + l3 + (feet[0]?.actualSetting ?? 0) + 40] as V3, to: [right[0], right[1], top - depth - 40] as V3 } : null;
    supports.push({ id, at: [centre[0], centre[1], top], along: a, across, length: width, top, kind: trestle ? 'trestle' : 'block', depth, slope: slopeAt, feet, brace, fixings });
  };
  const flangeFixings = (face: Face, sides: number[]) => sides.flatMap(s => [-1, 1].map(k => facePoint(face, k * (w / 2 + r / 2), -F, s * T / 2)));
  if (first) station('support-wall', add(first.start.at, mul(heading(0), TUNNEL.bearer.width / 2)), heading(0), w + 2 * F, flangeFixings(first.start, [1]));
  for (const i of interfaces.filter(i => i.kind === 'coupling')) {
    const before = pieces.find(p => p.id === i.before); const after = pieces.find(p => p.id === i.after);
    if (before?.kind === 'collar' || after?.kind === 'collar') continue;
    const joint = joints.find(j => j.collar === null && len(sub(j.vertex, i.face.at)) < 1e-6);
    const width = joint?.kind === 'turn' ? (w + 2 * F) / Math.cos(rad(joint.angle) / 2) : w + 2 * F;
    station(joint ? `support-${joint.id}` : `support-${i.id}`, i.face.at, i.face.n, width, flangeFixings(i.face, [-1, 1]));
  }
  for (const j of joints.filter(j => j.collar)) {
    const c = pieces.find(p => p.id === j.collar); if (!c) continue;
    const centre = mul(add(c.start.at, c.end.at), 0.5);
    const width = j.kind === 'turn' ? (w + 2 * F) / Math.cos(rad(j.angle) / 2) : w + 2 * F;
    const fixings = [-1, 1].map(k => add(add(centre, mul(c.frame.x, k * (w / 2 + r / 2))), mul(c.frame.z, -F)));
    station(`support-${j.id}`, centre, c.frame.y, width, fixings.map(p => [p[0], p[1], p[2]] as V3));
  }
  if (last) station('support-port', sub(last.end.at, mul(dE, TUNNEL.bearer.width / 2)), dE, w + 2 * F, flangeFixings(last.end, [-1]));
  // Fixing points take their height from the bearer they go up through.
  for (const s of supports) s.fixings = s.fixings.map(p => [p[0], p[1], s.top]);
  const short = supports.find(s => s.feet.some(f => f.setting - config.groundTolerance < travel.min - 1e-6 || f.setting + config.groundTolerance > travel.max + 1e-6));
  if (short) errors.push(`A ${config.footDiameter} mm foot (${dimensionOf(foot, 'l1')} mm stud) cannot take up ±${config.groundTolerance} mm of uneven ground at the ${short.id.replace('support-', '').replace('-', ' ')}: its stud travels ${Math.round(travel.min)}–${Math.round(travel.max)} mm. Choose a 40 mm foot or a smaller tolerance.`);
  for (const s of supports) {
    for (const p of s.fixings) fasteners.push({ partId: HW.bearerScrew, component: 'flange-screws', at: [p[0], p[1], p[2] - s.depth], direction: [0, 0, 1], use: 'Up through the bearer into the flanges above' });
    if (s.kind === 'trestle') for (const f of s.feet) for (const k of [-1, 1]) fasteners.push({ partId: HW.bearerScrew, component: 'bearer-screws', at: add([f.at[0], f.at[1], s.top], mul(s.along, k * 11)), direction: [0, 0, -1], use: 'Down through the bearer into the legs' });
    if (s.brace) for (const end of [s.brace.from, s.brace.to]) for (const k of [-1, 1]) fasteners.push({ partId: HW.braceScrew, component: 'brace-screws', at: add(add(end, mul(s.along, -(TUNNEL.leg / 2 + TUNNEL.brace.thickness))), [0, 0, k * 15]), direction: s.along, use: 'Brace onto the legs' });
  }
  // The route must stay out of the wall and the house.
  for (const p of pieces) for (const face of [p.start, p.end]) for (const u of [-lateral, lateral]) {
    if (facePoint(face, u, -F)[1] < TUNNEL.wallGap - 0.5 && errors.every(e => !e.startsWith('The route runs'))) errors.push('The route runs back into the wall: move the port further out or shorten the final run.');
  }

  const totalLength = pieces.reduce((sum, p) => sum + p.length, 0);
  return {
    config, site, w, h, S, E, dE, V1, V2, turns: turns.map(deg), rise, slope: slope ? { pitch: deg(slope.pitch), run: slope.run, footprint: slope.footprint } : null,
    pieces, joints, interfaces, couplings, members, panels, cleats, fasteners, supports, foot, insertNut, lockNut, travel, errors, totalLength,
  };
}
export type TunnelLayout = ReturnType<typeof tunnelLayout>;

export function validateTunnel(_variant: CatioMode, config: TunnelConfig, site: TunnelSite = tunnelSite()): string[] {
  return tunnelLayout(config, site).errors;
}

const side = (angle: number) => angle > 0 ? 'right' : 'left';
const fmt = (n: number, digits = 1) => Number(n.toFixed(digits)).toString();
/** A joint in words, e.g. “37.4° turn to the right” or “14.2° bend up”. */
export function describeJoint(j: Pick<Joint, 'kind' | 'angle'>): string {
  return j.kind === 'turn' ? `${fmt(Math.abs(j.angle))}° turn to the ${side(j.angle)}` : `${fmt(Math.abs(j.angle))}° bend ${j.angle > 0 ? 'up' : 'down'}`;
}

/** Stage 0 is the site; 1–2 the supports; 3–4 the sections, framed and meshed on the trestles' line, raised; 5–6 laid and fixed. */
export function tunnelSteps(_variant: CatioMode, config: TunnelConfig): readonly AssemblyStep[] {
  const l = tunnelLayout(config);
  const joints = l.joints.length ? l.joints.map(describeJoint).join(', ') : 'no angle joints';
  const collar = config.angleJoint === 'angle-collar';
  const legs = l.supports.filter(s => s.kind === 'trestle').length; const blocks = l.supports.length - legs;
  return [
    { title: 'The site as it is', detail: `The window insert is fitted with its cat gate shut; the enclosure stands with its rear port ${fmt(l.E[2] / 10)} cm above the grass. The ground between falls ${config.groundFall}% away from the wall and is uneven by up to ±${config.groundTolerance} mm.` },
    { title: 'Bed the slabs, build the supports', detail: `Bed a 30 × 30 cm paving slab in the grass under every foot position (${l.supports.length * 2}). For each support: screw an M8 insert nut into each leg’s foot end (or into the underside of a low bearer), screw the levelling foot’s stud into it, screw the bearer down onto the legs and, on tall ones, the diagonal brace across. ${legs} trestles, ${blocks} low bearers.` },
    { title: 'Level the supports', detail: 'Stretch a string line (or use a laser) at each bearer’s design height from the window floor. Turn each foot on its stud until the bearer top meets the line, then jam the foot’s nut up against the timber. The feet, not the ground, set the heights.' },
    { title: collar ? 'Frame the sections and collars' : 'Frame the sections', detail: `On trestles beside the line (shown raised over it): screw the four rails between each section’s two flange rings, then screw the floor board down onto the bottom rails. ${collar ? 'Each angle collar is built the same way between two flanges set at its angle.' : 'Sections at a joint have their flanges on the mitre: cut the rails and floor to the mitre angle.'} Sloped sections get cleats across the floor.` },
    { title: 'Mesh the sections', detail: 'Staple the side and roof mesh to the rails and turn its ends onto the flanges, stapling every 15 cm.' },
    { title: 'Lay and couple', detail: `Lay the pieces onto the supports from the window end: ${joints}. At every coupling push ${config.couplingBolts} M8 × 80 bolts through both flanges with a large washer each side and tighten the nuts.` },
    { title: 'Fix down and dock', detail: 'Screw up through each bearer into the flanges above. Press the foam strip between the first flange and the wall; nothing is fixed to the wall or the window insert. Bolt the last flange to the enclosure’s port flange. Open the gates.' },
  ];
}

const partSize = (p: Part) => {
  const d = (key: string) => p.dimensions[key] ? `${key} ${p.dimensions[key].value}` : '';
  switch (p.family) {
    case 'wood-screw': return [d('d'), d('l'), d('dk')].filter(Boolean).join(' · ');
    case 'screw': return [d('d'), d('l'), `A/F ${p.dimensions['s']?.value ?? ''}`].join(' · ');
    case 'washer': return [d('d1'), d('d2'), d('h')].filter(Boolean).join(' · ');
    case 'nail': return [d('d'), d('l')].join(' · ');
    case 'insert-nut': return [d('d'), d('l'), d('hole')].join(' · ');
    case 'levelling-foot': return [d('d1'), d('l1'), d('l3'), `A/F ${p.dimensions['s']?.value ?? ''}`].join(' · ');
    case 'nut': return [d('s'), d('m')].join(' · ');
    default: return '';
  }
};

/** The length of a member along its middle line, and how its ends are cut. */
export function memberCut(m: Member): { length: number; cut: string } {
  const [u0, u1, v0, v1] = m.rect;
  if (m.kind === 'flange') {
    const tall = v1 - v0 > u1 - u0; const uc = (u0 + u1) / 2; const vc = (v0 + v1) / 2;
    const length = tall ? len(sub(facePoint(m.from, uc, v1), facePoint(m.from, uc, v0))) : len(sub(facePoint(m.from, u1, vc), facePoint(m.from, u0, vc)));
    const angle = deg(Math.acos(Math.min(1, dot(m.from.n, m.from.frame.y))));
    return { length, cut: angle < 0.05 ? `${Math.round(length)} long` : `${Math.round(length)} long, on a ${fmt(angle)}° mitre face` };
  }
  const uc = (u0 + u1) / 2; const vc = (v0 + v1) / 2;
  const a = facePoint(m.from, uc, vc, m.fromOffset); const b = facePoint(m.to, uc, vc, m.toOffset);
  const axis = unit(sub(b, a));
  const ends = [m.from.n, m.to.n].map(n => deg(Math.acos(Math.min(1, Math.abs(dot(n, axis))))));
  const cuts = ends.map(e => e < 0.05 ? 'square' : `${fmt(e)}°`);
  const length = len(sub(b, a));
  if (m.kind === 'floor') {
    const edges = [u0, u1].map(u => Math.round(len(sub(facePoint(m.to, u, vc, m.toOffset), facePoint(m.from, u, vc, m.fromOffset)))));
    return { length, cut: edges[0] === edges[1] ? `${Math.round(u1 - u0)} × ${edges[0]}` : `${Math.round(u1 - u0)} wide, ${Math.min(...edges)} to ${Math.max(...edges)} long (tapered)` };
  }
  return { length, cut: cuts.every(c => c === 'square') ? `${Math.round(length)} long, square ends` : `${Math.round(length)} long, ends ${cuts.join(' / ')}` };
}

/** The parts list: cut list, mesh, hardware by library part, and groundwork. */
export function tunnelBom(_variant: CatioMode, config: TunnelConfig, site: TunnelSite = tunnelSite()): BomLine[] {
  const l = tunnelLayout(config, site);
  const lines: BomLine[] = [];
  const timber = (key: string, name: string, size: string, use: string, quantity = 1) => {
    const same = lines.find(line => line.group === 'Timber' && line.name === name && line.size === size);
    if (same) { same.quantity += quantity; return; }
    lines.push({ id: `timber-${key}-${lines.length}`, group: 'Timber', name, quantity, size, use });
  };
  for (const m of l.members) {
    const piece = l.pieces.find(p => p.id === m.piece); const collar = piece?.kind === 'collar';
    const { cut } = memberCut(m);
    const name = m.kind === 'flange' ? `Flange ${m.rect[3] - m.rect[2] > m.rect[1] - m.rect[0] ? 'stile' : 'head or sill'}` : m.kind === 'rail' ? (collar ? 'Collar rail' : 'Section rail') : (collar ? 'Collar floor' : 'Floor board');
    const use = m.kind === 'flange' ? 'Flange rings at both ends of every section and collar' : m.kind === 'rail' ? 'Along the corners, between the flanges' : 'The cat’s floor, on the bottom rails';
    timber(m.kind, name, `${m.section} · ${cut}`, use);
  }
  for (const c of l.cleats) timber('cleat', 'Floor cleat', `${TUNNEL.cleat.size} × ${TUNNEL.cleat.size} · ${Math.round(c.length)} long`, 'Across the floor of sloped sections, for grip');
  for (const s of l.supports) {
    const bevel = Math.abs(s.slope) > 0.05 ? `, top bevelled ${fmt(Math.abs(s.slope))}°` : '';
    if (s.kind === 'trestle') timber('bearer', 'Bearer', `${TUNNEL.bearer.width} × ${TUNNEL.bearer.depth} · ${Math.round(s.length)} long${bevel}`, 'Across the top of each trestle, under the flanges');
    else timber('block', 'Low bearer', `${TUNNEL.bearer.width} × ${s.depth} (ripped from 45 × 95) · ${Math.round(s.length)} long${bevel}`, 'Where the tunnel is too low for legs: the feet go straight into it');
    for (const f of s.feet) if (f.leg > 0) timber('leg', 'Leg', `${TUNNEL.leg} × ${TUNNEL.leg} · ${f.leg} long`, 'Under the bearer ends; a foot in the bottom of each');
    if (s.brace) timber('brace', 'Brace', `${TUNNEL.brace.thickness} × ${TUNNEL.brace.width} · ${Math.round(len(sub(s.brace.to, s.brace.from)) + 80)} long, ends cut to the legs`, 'Diagonally across tall trestles');
  }
  for (const panel of l.panels) {
    const [a, b, c, d] = panel.corners;
    const long = Math.round(Math.max(len(sub(b, a)), len(sub(c, d)))); const short = Math.round(Math.min(len(sub(b, a)), len(sub(c, d)))); const across = Math.round(len(sub(d, a)));
    const kind = panel.name.includes('roof') ? 'Roof mesh' : 'Side mesh';
    const size = `${long === short ? long : `${short}–${long}`} × ${across} · ${TUNNEL.mesh.opening} mm openings, ${TUNNEL.mesh.wire} mm wire (nominal)`;
    const same = lines.find(line => line.group === 'Mesh' && line.name === kind && line.size === size);
    if (same) same.quantity++; else lines.push({ id: `mesh-${lines.length}`, group: 'Mesh', name: kind, quantity: 1, size, use: kind === 'Roof mesh' ? 'Over the top rails, ends turned onto the flanges' : 'Down each side, rail to rail' });
  }
  const counts = new Map<string, { quantity: number; uses: Set<string> }>();
  const addPart = (partId: string, use: string, quantity = 1) => {
    const entry = counts.get(partId) ?? { quantity: 0, uses: new Set<string>() };
    entry.quantity += quantity; entry.uses.add(use); counts.set(partId, entry);
  };
  for (const c of l.couplings) {
    addPart(HW.couplingBolt, 'Through each pair of flanges', c.bolts.length);
    addPart(HW.couplingWasher, 'Under every bolt head and nut', 2 * c.bolts.length);
    addPart(HW.couplingNut, 'On every coupling bolt', c.bolts.length);
  }
  for (const f of l.fasteners) addPart(f.partId, f.use.replace(/^Mesh: .*/, 'Mesh to rails and flanges'));
  for (const s of l.supports) for (let i = 0; i < s.feet.length; i++) { addPart(l.foot.id, 'Under every leg or low bearer, on a slab; its own nut locks it'); addPart(l.insertNut.id, 'In the foot end of each leg or low bearer'); }
  for (const [partId, entry] of counts) {
    const p = part(partId);
    lines.push({ id: partId, group: 'Hardware', name: p.title, quantity: entry.quantity, size: `${p.designation} · ${partSize(p)}`, use: [...entry.uses].join('; '), partId });
  }
  lines.push({ id: 'wall-seal', group: 'Hardware', name: 'Closed-cell foam strip (custom)', quantity: 1, size: `${TUNNEL.wallGap} × ${T} · ${Math.round(2 * (l.w + l.h + 4 * F))} long`, use: 'Between the first flange and the wall, round the window port' });
  lines.push({ id: 'slabs', group: 'Groundwork', name: 'Paving slab', quantity: l.supports.length * 2, size: `${TUNNEL.slab.size} × ${TUNNEL.slab.size} × ${TUNNEL.slab.thickness} concrete`, use: 'Bedded in the grass under every foot, so it cannot sink' });
  return lines;
}

export function tunnelFacts(_variant: CatioMode, config: TunnelConfig) {
  const l = tunnelLayout(config);
  const cm = (mm: number) => fmt(mm / 10);
  const turns = l.joints.filter(j => j.kind === 'turn');
  const tallest = Math.max(0, ...l.supports.flatMap(s => s.feet.map(f => f.leg)));
  return [
    { label: 'Window port → enclosure port', value: `${cm(l.totalLength)} cm of tunnel` },
    { label: 'Rise · floor to floor', value: `${l.rise >= 0 ? '+' : '−'}${cm(Math.abs(l.rise))} cm${l.slope ? ` at ${fmt(Math.abs(l.slope.pitch))}°` : ''}` },
    { label: 'Turns', value: turns.length ? turns.map(j => `${fmt(Math.abs(j.angle))}° ${side(j.angle)}`).join(', ') : 'straight' },
    { label: 'Sections · supports', value: `${l.pieces.filter(p => p.kind === 'section').length} · ${l.supports.length} (longest leg ${cm(tallest)} cm)` },
    { label: 'Foot travel · ground taken up', value: `${fmt(l.travel.max - l.travel.min, 0)} mm · ±${config.groundTolerance} mm` },
  ];
}

/** The extent of the tunnel and its ports, for the cameras. */
export function tunnelBounds(l: TunnelLayout) {
  const points = l.pieces.flatMap(p => [p.start.at, p.end.at]).concat([[0, 0, l.site.window.recessFloor + l.site.window.openingHeight]]);
  const xs = points.map(p => p[0]); const ys = points.map(p => p[1]); const zs = points.map(p => p[2]);
  return { minX: Math.min(...xs) - 500, maxX: Math.max(...xs) + 500, minY: 0, maxY: Math.max(...ys) + 400, maxZ: Math.max(...zs) + l.h + 200 };
}

export function tunnelViews(_variant: CatioMode, config: TunnelConfig): Record<CatioView, CameraPreset> {
  const l = tunnelLayout(config);
  const b = tunnelBounds(l);
  const center: V3 = [(b.minX + b.maxX) / 2, b.maxY / 2, b.maxZ / 3];
  const extent = Math.max(b.maxX - b.minX, b.maxY, b.maxZ);
  const along = l.pieces[1]?.start.at ?? l.E;
  const support = [...l.supports].filter(s => s.id !== 'support-port' && s.id !== 'support-wall').sort((a, c) => Math.max(...c.feet.map(f => f.leg)) - Math.max(...a.feet.map(f => f.leg)))[0] ?? l.supports[0];
  const focus: V3 = support?.feet[1]?.at ?? [0, 500, 0];
  const out = support ? add(mul(support.across, 520), mul(support.along, 420)) : [500, 400, 0] as V3;
  return {
    Exterior: { position: [center[0] + extent * 0.95, center[1] + extent * 0.75, center[2] + extent * 0.7], target: center },
    Interior: { position: [0, -650, l.S[2] + l.h * 0.75], target: [along[0], along[1] + 800, along[2] + l.h * 0.3] },
    Front: { position: [center[0], b.maxY + extent * 1.5, center[2] + 150], target: [center[0], center[1], center[2]] },
    Side: { position: [b.maxX + extent * 1.6, center[1], center[2] + 100], target: center },
    Top: { position: [center[0], center[1], extent * 1.9], target: [center[0], center[1] + 1, 0] },
    Mounting: { position: [focus[0] + out[0], focus[1] + out[1], focus[2] + 260], target: [focus[0], focus[1], focus[2] + 120] },
  };
}

const mm = (label: string) => ({ unit: label, scale: label === 'cm' ? 10 : 1 });
export const TUNNEL_CONTROLS: SubassemblyControl<TunnelConfig>[] = [
  { key: 'portX', label: 'Port along the wall', group: 'Enclosure port (fixed interface)', help: 'Its centre from the window’s centre; + is to the right, seen from the garden.', options: [], range: { min: -4000, max: 4000, step: 10, ...mm('cm') } },
  { key: 'portY', label: 'Port out from the wall', group: 'Enclosure port (fixed interface)', help: 'From the wall face to the port’s face, where the last flange bolts on.', options: [], range: { min: 800, max: 8000, step: 10, ...mm('cm') } },
  { key: 'portFacing', label: 'Port faces', group: 'Enclosure port (fixed interface)', help: 'The way the tunnel runs into it, from straight out of the wall; + turned to the right. The turns follow.', options: [], range: { min: -120, max: 120, step: 1, ...mm('°') } },
  { key: 'portHeight', label: 'Port floor height', group: 'Enclosure port (fixed interface)', help: 'The enclosure’s threshold above the grass at the wall. The window port’s floor is fixed by the window insert.', options: [], range: { min: 150, max: 1400, step: 5, ...mm('cm') } },
  { key: 'approach', label: 'Straight out from the wall', group: 'Route', help: 'Before the first turn, measured from the wall to where the centre lines meet.', options: [], range: { min: 300, max: 5000, step: 10, ...mm('cm') } },
  { key: 'final', label: 'Straight into the port', group: 'Route', help: 'After the last turn, square to the port.', options: [], range: { min: 300, max: 5000, step: 10, ...mm('cm') } },
  { key: 'slopeLeg', label: 'Climb in', group: 'Route', help: 'The leg that climbs (or falls) to the port’s height, between two bends, with level runs either side.',
    options: [{ value: 'approach', label: 'The run out from the wall' }, { value: 'middle', label: 'The middle run' }, { value: 'final', label: 'The run into the port' }] },
  { key: 'maxSlope', label: 'Steepest slope', group: 'Route', help: 'Cats manage 25° on cleats; gentler is kinder to old cats. A small climb uses a shallower slope over a short run.',
    options: [10, 15, 20, 25].map(v => ({ value: v as TunnelConfig['maxSlope'], label: `${v}°` })) },
  { key: 'angleJoint', label: 'Turns and bends', group: 'Joints', help: 'A collar is a short wedge between two square flanges: every section stays a plain box. Mitred ends need no extra piece but cut the sections at a joint to the angle.',
    options: [{ value: 'angle-collar', label: 'Angle collar, bolted' }, { value: 'mitred-ends', label: 'Mitred ends, bolted' }] },
  { key: 'couplingBolts', label: 'Bolts per coupling', group: 'Joints', help: 'M8 bolts through each pair of flanges, outside the mesh where a spanner reaches.',
    options: [{ value: 4, label: '4 · two each side' }, { value: 6, label: '6 · three each side' }, { value: 8, label: '8 · three each side, two on top' }] },
  { key: 'sectionLength', label: 'Longest section', group: 'Sections', help: 'Each straight run is split into equal sections no longer than this: shorter ones are lighter to carry and need more supports.',
    options: [500, 750, 1000].map(v => ({ value: v as TunnelConfig['sectionLength'], label: `${v / 10} cm` })) },
  { key: 'footDiameter', label: 'Foot diameter', group: 'Supports', help: 'The 40 mm foot has an 80 mm stud: the most travel. The smaller feet have 63 mm studs.',
    options: TUNNEL_FOOT.diameters.map(v => ({ value: v, label: `${v} mm` })) },
  { key: 'groundFall', label: 'Ground falls away', group: 'Supports', help: 'The measured fall of the ground from the wall; the legs are cut to it.',
    options: [0, 1, 2, 4].map(v => ({ value: v as TunnelConfig['groundFall'], label: `${v}%` })) },
  { key: 'groundTolerance', label: 'Uneven by up to', group: 'Supports', help: 'How far the slab under any foot may sit above or below that fall. The feet take it up; the legs are not recut.',
    options: [10, 15, 20, 25].map(v => ({ value: v as TunnelConfig['groundTolerance'], label: `±${v} mm` })) },
];

export const parseTunnel = (raw: unknown) => parseControlled(TUNNEL_DEFAULT, TUNNEL_CONTROLS, raw);

export const TUNNEL_DECISIONS: DesignDecision[] = [
  { title: 'Turns on the level, climbs in a straight line', parameter: 'Climb in',
    choice: 'The route turns only where it is level and climbs only where it runs straight: one sloped run between two vertical bends, inside one leg, with level runs before and after it.',
    why: 'A joint that turns and climbs at once is a compound mitre: the two sections would meet with one rolled against the other and the floor tilted sideways. Kept apart, every joint is a plain mitre about one axis, every floor stays level across, and the angles are exact. The slope is the steepest allowed (20° by default) so the climb is short; a small climb gets a shallower slope over a 15 cm run.' },
  { title: 'Angle collars at every turn and bend', parameter: 'Turns and bends',
    choice: 'A short wedge-shaped collar between two square flange rings, cut to the joint’s angle (any angle up to 135°), bolted to the sections either side like any coupling.',
    why: 'All sections stay plain boxes with square flanges, so a section can move to another place in the route, and only the small collars are cut to angles. The collar’s two flanges meet at the inside of the joint; each run stops short of the vertex by 30 + r · tan θ/2, r being the profile’s inside edge from the floor’s centre line. Mitred ends (up to 90°) save the collars but cut the two sections at each joint to the angle.' },
  { title: 'Bolted flanges, not clamps', parameter: 'Bolts per coupling',
    choice: 'Every section ends in a 30 × 70 flange ring that stands 30 mm proud of the mesh; neighbours are bolted through both rings with ISO 4017 M8 × 80 bolts, ISO 7093 large washers and ISO 4032 nuts (6 per coupling by default).',
    why: 'Bolts outside the mesh are reached with a 13 mm spanner from outside, take the tunnel apart again, and are all library parts. 80 mm grips 2 × 30 mm of flange, two washers and the nut with the thread through. The window end is not fixed: the insert only presses on the recess and must not carry the tunnel, so the first flange stands 10 mm off the wall on a foam strip and its own support. The port end bolts to a matching flange on the enclosure, the one requirement the tunnel places on it.' },
  { title: 'Levelling feet on every support', parameter: 'Uneven by up to',
    choice: 'A support under the wall end, the port end, every coupling and every joint. Each stands on two Ganter GN 343.2 levelling feet (40 mm, M8 × 80 stud) in DIN 7965 insert nuts, on paving slabs. Legs are cut to the designed fall of the ground; the feet are set to mid-travel there.',
    why: 'Nothing is assumed level. The stud may run from the supplied nut’s height (6.8 mm) out to the stud length less the insert nut (62 mm), so each foot takes up ±27 mm of slab height; the page checks every foot against the chosen tolerance, and its scene sets each foot to the uneven ground it stands on. Slabs stop the feet sinking into grass. Where the tunnel is too low for legs, the feet screw straight into a bearer ripped to depth.' },
  { title: 'The enclosure is a fixed interface', parameter: 'Port floor height',
    choice: 'The enclosure is not designed here: only its rear port is, by where it is, which way it faces, its floor height and a 30 mm flange with the same bolt pattern.',
    why: 'The tunnel is solved from both ports: the window port’s floor follows the window insert as set on its page, the enclosure’s from these values. Its door can be higher or lower than the window; the tunnel climbs or falls the difference.' },
];
