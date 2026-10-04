import { dimensionOf, findPart, PRESSURE_PAD, PRESSURE_PAD_SURFACES, pressurePadMinDiameter, pressurePadMinHeight, TUNNEL_FOOT, TUNNEL_HARDWARE as HW, TUNNEL_PAD, tunnelFoot, tunnelPadScrew, type Part, type PressurePadSurface } from '@canfactory/contracts';
import { toggleLatchMechanism as TL } from '@canfactory/contracts';
import { CATIO, type CatioView } from './catioDesign.ts';
import { E_PROFILE_SEAL, latchHeights, PRINTED_LATCH, PRINTED_LATCH_JOINT, printedLatchLine, printedLatchScrews, type LatchMount } from './catioPrintedLatch.ts';
import type { CatioMode } from './catioSettings.ts';
import { couplingGap, savedTunnelCoupling, type TunnelCouplingConfig } from './catioTunnelJoint.ts';
import { fastenerClashes, fastenersAlong, loadSubassemblyConfig, parseControlled, type AssemblyStep, type BomLine, type CameraPreset, type DesignDecision, type SubassemblyControl, type SubassemblyFact, type SubassemblyPreset, type V3 } from './catioSubassembly.ts';
import { parseWindowInsert, WINDOW_FLOOR_SETTINGS, WINDOW_INSERT_DEFAULT, windowFor, windowInsertLayout, type WindowInsertConfig, type WindowSpec } from './catioWindowInsert.ts';

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
  /** Whether the port's floor is level with the window port's (wherever the window insert puts that) or at `portHeight`. */
  portLevel: 'window' | 'own';
  /** The port's floor (its threshold) above the grass at the wall, when it has its own height. */
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
  /** The feet: printed pressure pads on library screws, or Ganter levelling feet. */
  footPad: 'printed' | 'ganter';
  /** Printed feet: from the pad's back to its sole, in mm. */
  padHeight: number;
  /** Printed feet: the sole that stands on the slab. */
  padSurface: PressurePadSurface;
  /** Foot diameter of the levelling feet (or printed pads). */
  footDiameter: 25 | 32 | 40;
  /** How much the ground falls away from the wall, in per cent. */
  groundFall: 0 | 1 | 2 | 4;
  /** How far the ground under any foot may be above or below that fall, in mm. */
  groundTolerance: 10 | 15 | 20 | 25;
  /** How the tunnel is held on its supports. */
  supportFixing: SupportFixing;
  /** Trestles that stand only when fixed to the tunnel, or supports that stand on their own (a sole along the tunnel under each leg). */
  supportBase: 'trestle' | 'self-standing';
}

/**
 * How the tunnel is held on its supports: screwed up through the bearers (the original), strapped over each support with a rubber
 * strap, dropped over dowels in the bearer top, dropped into printed cradles on the bearer, latched down with vertical printed
 * toggle latches, held by turn buttons over keepers on the flanges, or resting by its own weight.
 */
export const SUPPORT_FIXINGS = ['screws', 'strap', 'dowels', 'cradle', 'latch', 'turn-buttons', 'gravity'] as const;
export type SupportFixing = typeof SUPPORT_FIXINGS[number];
export const SUPPORT_FIXING_LABELS: Record<SupportFixing, string> = {
  screws: 'Screwed up through the bearer', strap: 'Rubber strap over the support', dowels: 'Dowels in the bearer top', cradle: 'Printed cradles on the bearer',
  latch: 'Vertical printed toggle latches', 'turn-buttons': 'Turn buttons over keepers', gravity: 'Gravity only',
};

export const TUNNEL_DEFAULT: TunnelConfig = {
  portX: 1200, portY: 3000, portFacing: 0, portLevel: 'own', portHeight: 500, approach: 700, final: 700, slopeLeg: 'middle', maxSlope: 20,
  angleJoint: 'angle-collar', sectionLength: 750, footPad: 'printed', padHeight: 27.5, padSurface: 'grooved', footDiameter: 40, groundFall: 2, groundTolerance: 15,
  supportFixing: 'screws', supportBase: 'trestle',
};

/** The printed feet's heights offered, in mm: at least what holds the screw's head over the floor and grooves. */
export const TUNNEL_PAD_HEIGHT = { min: 13, max: 40, step: 0.5 } as const;

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
  /** A self-standing support's sole: along the tunnel under each leg (or each end of a low bearer), a foot near each of its ends. */
  sole: { thickness: 22, width: 95, length: 300, footInset: 40 },
  /** How the tunnel is held on its supports (`supportFixing`); sizes of this design, not of products. */
  fixing: {
    /** ISO 2338 parallel pins, two under each flange (or collar rail), half in the bearer. */
    dowel: { partId: HW.dowel, into: 20 },
    /** A printed cradle on each bearer end: a base the tunnel sits on, and lips round it. */
    cradle: { seat: 4, wall: 5, lip: 20, clearance: 0.5, reach: 75 },
    /** A rubber tarp strap over each support, hooked under a timber cleat on each bearer end; stretched by this much when hooked. */
    strap: { width: 25, stretch: 1.25, cleat: { size: 20, length: 60 } },
    /** The EPDM pad between bearer and flanges that the vertical latch squashes (its over-centre give), as thick as the coupling's gap. */
    latchPad: 3,
    /** A hardwood keeper on each flange's side just above the bearer, and a printed turn button on the bearer's end that laps over it. */
    keeper: { out: 20, high: 20, above: 15 }, button: { thickness: 15, width: 24 },
  },
} as const;

/** The fixed interfaces: the window insert's port (where the tunnel starts) and the tunnel's clear size. */
export interface TunnelSite { w: number; h: number; floorZ: number; window: WindowSpec; insert: WindowInsertConfig }

/** The window insert as saved on its own page (or its defaults), in the modular window saved on the catio concept page. */
export function tunnelSite(): TunnelSite {
  const window = windowFor('modular');
  const insert = loadSubassemblyConfig('window-insert', parseWindowInsert, WINDOW_INSERT_DEFAULT);
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
  /** How far an angle collar's ends are from the vertex along the runs' centre lines (0 for mitred ends): `jointSetback`. */
  setback: number;
  /** How far each run stops short of the vertex: the setback, and a latched coupling's gap to the collar. */
  stop: number;
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
/**
 * Where two pieces meet, or a piece meets a port. `face` is the start face of the piece after it (the end face at the port); at a
 * latched coupling the piece before it ends `gap` short of that face.
 */
export interface Interface { id: string; kind: 'wall' | 'coupling' | 'port'; face: Face; before: string | null; after: string | null; gap: number }
export interface Bolt { at: V3; n: V3 }
/**
 * A flange-to-flange joint: bolted face to face, or latched with printed toggle latches across a gap (the tunnel–tunnel coupling
 * page's mechanism). Latches are mounted on the flanges' outer sides: each base plate on the flange before the joint, its catch on
 * the one after it. `seal` is the E-profile's run round the flange's face, when there is one.
 */
export interface Coupling {
  id: string; face: Face; stage: 5 | 6; kind: 'bolted' | 'latched'; gap: number; bolts: Bolt[]; latches: LatchMount[]; seal: { length: number } | null; use: string;
  before: string | null; after: string | null;
}
/**
 * A foot under a support. A trestle's leg (or a low bearer's end) stands on one foot; a self-standing support's on a sole with a
 * foot near each end, both on the one slab. `end` is the leg it carries (0 left, 1 right); the end's first foot (`primary`) carries
 * its leg, slab and sole in the lists and the scene.
 */
export interface Foot {
  id: string; at: V3; designGround: number; actualGround: number; slabTop: number; setting: number; actualSetting: number; leg: number;
  end: 0 | 1; primary: boolean; legAt: V3; slabAt: V3;
}
/** A box in a support's own frame: `size` across, along and up; `center` in the world. */
export interface SupportBox { center: V3; size: V3 }
/** How the tunnel is held on one support (`supportFixing`), placed. */
export interface SupportHold {
  /** Whether the support is held to the tunnel at all: a trestle cannot stand on its own along the tunnel. */
  attached: boolean;
  dowels: V3[];
  /** The cradles' parts: each base and its lips. */
  cradles: { side: -1 | 1; boxes: SupportBox[] }[];
  /** The strap's path from hook to hook over the tunnel, its stretched length, and the cleats it hooks under. */
  strap: { path: V3[]; length: number; cleats: SupportBox[] } | null;
  /** Vertical latches: base plate on the flanges' side above, catch on the bearer's end below. */
  latches: LatchMount[];
  /** Turn buttons: pivot on the bearer's end, and the keepers on the flanges' sides they lap over. */
  buttons: { side: -1 | 1; pivot: V3; keepers: SupportBox[]; arm: SupportBox[]; piece: string }[];
}
export interface Support {
  id: string; at: V3; along: V3; across: V3; length: number; top: number;
  kind: 'trestle' | 'block'; depth: number; slope: number; feet: Foot[];
  brace: { from: V3; to: V3 } | null;
  /** Points on the bearer's top under the flanges or collar rails above: where screws go up, or dowels stand. */
  fixings: V3[];
  /** Flanges over the bearer (0 under an angle collar), and whether the bearer's ends are flush with their sides. */
  flanges: 0 | 1 | 2; flush: boolean;
  /** The flanges' extent along the tunnel from the support's centre (none under a collar). */
  footprint: [number, number] | null;
  /** What lies between the bearer's top and the tunnel: a cradle's base or the latch's pad. */
  seat: number;
  /** A self-standing support's soles, one under each leg. */
  soles: SupportBox[];
  hold: SupportHold;
}
export interface MeshPanel { id: string; piece: string; name: string; corners: [V3, V3, V3, V3]; edges: { from: V3; to: V3; drive: V3; use: string }[] }
export interface Fastener {
  partId: string;
  component: 'rail-screws' | 'floor-screws' | 'cleat-screws' | 'staples' | 'bearer-screws' | 'brace-screws' | 'flange-screws' | 'latch-screws' | 'catch-screws' | 'sole-screws'
    | 'dowels' | 'cradle-screws' | 'strap-cleat-screws' | 'support-latch-screws' | 'support-catch-screws' | 'keeper-screws' | 'button-screws';
  at: V3; direction: V3; use: string; across?: V3;
  /** The piece it fixes into (for those built into one), the latch it holds, and the support it holds the tunnel on. */
  piece?: string; of?: string; support?: string;
}
/** A rectangle of the profile: u from u0 to u1, v from v0 to v1. */
export type Rect = [u0: number, u1: number, v0: number, v1: number];
export interface Member { id: string; piece: string; name: string; section: string; from: Face; fromOffset: number; to: Face; toOffset: number; rect: Rect; kind: 'flange' | 'rail' | 'floor' }

/** A printed latch's screws: at least this far inside the flange's timber, and this far from any other screw in it. */
export const LATCH_SCREW_EDGE = 5; export const LATCH_SCREW_CLEARANCE = 12;

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

/** The enclosure port's floor above the grass: the window port's when level with it, else its own. */
export const portFloor = (config: TunnelConfig, site: TunnelSite) => config.portLevel === 'window' ? site.floorZ : config.portHeight;
/** A climb this small is likely meant to be level: the window port's floor moved since the height was set. */
export const NEARLY_LEVEL = 30;

/**
 * Everything the tunnel is, placed and installed, with its sections coupled as the tunnel–tunnel coupling page sets them (`joint`).
 * Latched couplings leave a gap between the flanges, which the route makes room for: each straight run holds its sections and the
 * gaps between them, and stops a gap further short of an angle collar. Mitred joints and the enclosure end are always bolted.
 */
export function tunnelLayout(config: TunnelConfig, site: TunnelSite = tunnelSite(), joint: TunnelCouplingConfig = savedTunnelCoupling()) {
  const { w, h, floorZ } = site;
  const errors: string[] = [];
  const type = config.angleJoint;
  /** The gap at a latched coupling: between sections, and between a section and an angle collar (square couplings only). */
  const gap = couplingGap(joint);
  /** How far a run stops short of a joint's vertex: the collar's setback and its coupling's gap; a mitre meets on the bisector, bolted. */
  const stopAt = (theta: number, inside: number) => type === 'angle-collar' ? jointSetback(theta, inside, type) + gap : 0;
  const S: V3 = [0, TUNNEL.wallGap, floorZ];
  const E: V3 = [config.portX, config.portY, portFloor(config, site)];
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
  const turnStop = turns.map(theta => Math.abs(deg(theta)) < 0.05 ? null : stopAt(theta, lateral));
  const legs = [
    { psi: 0, length: config.approach, in: 0, out: turnStop[0] ?? 0 },
    { psi: psiM, length: middleLength, in: turnStop[0] ?? 0, out: turnStop[1] ?? 0 },
    { psi: psiE, length: config.final, in: turnStop[1] ?? 0, out: 0 },
  ];
  // The climb: one straight sloped run inside the chosen leg, level runs of equal length before and after it.
  const rise = E[2] - S[2]; const up = rise > 0; const slopeLegIndex = { approach: 0, middle: 1, final: 2 }[config.slopeLeg];
  const insideUp = h + F; const insideDown = F;
  const [r1, r2] = up ? [insideUp, insideDown] : [insideDown, insideUp];
  /** Each bend's stop: the climb runs from vertex to vertex over both stops and the sloped run. */
  const bendSetbacks = (phi: number) => [stopAt(phi, r1), stopAt(phi, r2)] as const;
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
      const theta = turns[i - 1] ?? 0; const e = turnSetback[i - 1]; const stop = turnStop[i - 1];
      if (e !== null && e !== undefined) items.push({ kind: 'joint', joint: { kind: 'turn', angle: deg(theta), a: heading(legs[i - 1]?.psi ?? 0), b: heading(leg.psi), setback: e, stop: stop ?? e, inside: lateral } });
    }
    // a run straight after another (a turn too small to make) is coupled to it across the gap, which comes off its length
    const available = leg.length - leg.in - leg.out - (items.at(-1)?.kind === 'run' ? gap : 0);
    const level = (length: number) => items.push({ kind: 'run', dir: heading(leg.psi), length, psi: leg.psi, pitch: 0, leg: i });
    if (slope && i === slopeLegIndex) {
      const flat = (available - slope.footprint) / 2;
      if (flat < TUNNEL.minRun - 1e-6) errors.push(`The ${config.slopeLeg} leg is too short to climb ${Math.round(Math.abs(rise))} mm at up to ${config.maxSlope}°: it needs ${Math.ceil(slope.footprint + 2 * TUNNEL.minRun + leg.in + leg.out)} mm. Lengthen it, slope another leg or allow a steeper slope.`);
      const phi = Math.abs(slope.pitch); const [e1, e2] = bendSetbacks(phi); const s = Math.sign(slope.pitch);
      level(Math.max(flat, 1));
      items.push({ kind: 'joint', joint: { kind: 'bend', angle: s * deg(phi), a: heading(leg.psi), b: heading(leg.psi, slope.pitch), setback: jointSetback(phi, r1, type), stop: e1, inside: r1 } });
      items.push({ kind: 'run', dir: heading(leg.psi, slope.pitch), length: slope.run, psi: leg.psi, pitch: slope.pitch, leg: i });
      items.push({ kind: 'joint', joint: { kind: 'bend', angle: -s * deg(phi), a: heading(leg.psi, slope.pitch), b: heading(leg.psi), setback: jointSetback(phi, r2, type), stop: e2, inside: r2 } });
      level(Math.max(flat, 1));
    } else {
      if (available < TUNNEL.minRun - 1e-6) errors.push(`The ${['approach', 'middle', 'final'][i]} run is too short for its ${i === 1 ? 'turns' : 'turn'}: ${Math.max(0, Math.round(available))} mm left between the joints, at least ${TUNNEL.minRun} needed.`);
      level(Math.max(available, 1));
    }
  });

  // Walk the sequence: sections of each run, an angle collar or a shared mitre at each joint; a latched coupling's gap before every
  // piece but the first, except across a mitre.
  const pieces: Piece[] = []; const joints: Joint[] = []; const interfaces: Interface[] = [];
  let at = S; let pendingMitre: V3 | null = null;
  let sectionCount = 0;
  items.forEach((item, index) => {
    if (item.kind === 'joint') {
      const j = item.joint; const id = `joint-${joints.length + 1}`;
      const chord = unit(add(j.a, j.b));
      if (type === 'angle-collar') {
        at = add(at, mul(j.a, j.stop - j.setback));
        const vertex = add(at, mul(j.a, j.setback)); const end = add(vertex, mul(j.b, j.setback));
        const collarId = `collar-${joints.length + 1}`;
        const frame = frameAlong(chord);
        pieces.push({ id: collarId, kind: 'collar', name: `Angle collar ${joints.length + 1}`, frame, start: { at, n: j.a, frame: frameAlong(j.a) }, end: { at: end, n: j.b, frame: frameAlong(j.b) },
          length: len(sub(end, at)), pitch: deg(Math.asin(chord[2])), joint: id });
        joints.push({ ...j, id, vertex, collar: collarId });
        at = add(end, mul(j.b, j.stop - j.setback));
      } else {
        joints.push({ ...j, id, vertex: at, collar: null });
        pendingMitre = chord;
      }
      return;
    }
    // n sections no longer than the longest, and the n − 1 gaps between them, fill the run
    const n = Math.max(1, Math.ceil((item.length + gap) / (config.sectionLength + gap) - 1e-9)); const piece = (item.length - (n - 1) * gap) / n;
    const next = items[index + 1];
    const frame = frameAlong(item.dir);
    // after another run, straight on: the gap of the coupling between them
    if (index > 0 && items[index - 1]?.kind === 'run') at = add(at, mul(item.dir, gap));
    for (let k = 0; k < n; k++) {
      if (k > 0) at = add(at, mul(item.dir, gap));
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
  if (first) interfaces.push({ id: 'wall', kind: 'wall', face: first.start, before: null, after: first.id, gap: 0 });
  pieces.slice(1).forEach((p, i) => {
    const prev = pieces[i]; if (!prev) return;
    interfaces.push({ id: `coupling-${i + 1}`, kind: 'coupling', face: { ...p.start, frame: prev.kind === 'collar' ? p.start.frame : prev.end.frame }, before: prev.id, after: p.id, gap: len(sub(p.start.at, prev.end.at)) });
  });
  if (last) interfaces.push({ id: 'port', kind: 'port', face: last.end, before: last.id, after: null, gap: 0 });
  const arrived = last ? len(sub(last.end.at, E)) : Infinity;
  if (errors.length === 0 && arrived > 0.01) errors.push('The route does not reach the port.');

  // Bolts on every bolted coupling and at the port: up the outer flange stiles, and across the head for 8. Printed latches on the
  // outer sides of every square coupling when they are chosen: base plates on the flange before it, catches on the one after.
  const sideHeights = joint.boltsPerCoupling === 4 ? [0.15, 0.85] : [0.15, 0.5, 0.85];
  const pattern: [number, number][] = [
    ...[-1, 1].flatMap(s => sideHeights.map(f => [s * (w / 2 + 40 + (F - 40) / 2), f * h] as [number, number])),
    ...(joint.boltsPerCoupling === 8 ? [[-w / 4, h + 40 + (F - 40) / 2], [w / 4, h + 40 + (F - 40) / 2]] as [number, number][] : []),
  ];
  // up the clear opening's height beside the mesh, as the bolts are: clear of the rails' screws at its top and bottom corners
  const latchAt = latchHeights(joint.latchesPerSide).map(f => f * h);
  const fasteners: Fastener[] = [];
  const couplings: Coupling[] = interfaces.filter(i => i.kind !== 'wall').map(i => {
    const square = dot(i.face.n, i.face.frame.y) > 1 - 1e-9;
    const latched = i.kind === 'coupling' && joint.mechanism === 'printed-latch' && square;
    const latches: LatchMount[] = !latched ? [] : ([-1, 1] as const).flatMap(side => latchAt.map((v, k) => ({
      id: `${i.id}-latch-${side < 0 ? 'left' : 'right'}-${k}`, side,
      // the seam: the base plate's edge, `overhang` proud of the flange before the gap
      at: facePoint(i.face, side * (w / 2 + F), v, -(i.gap - PRINTED_LATCH.overhang)), out: mul(i.face.frame.x, side), pull: mul(i.face.n, -1),
    })));
    for (const mount of latches) {
      const screws = printedLatchScrews(mount);
      for (const f of screws.base) fasteners.push({ partId: HW.latchScrew, component: 'latch-screws', ...f, use: 'Latch base plates onto the flanges', of: mount.id, ...(i.before ? { piece: i.before } : {}) });
      for (const f of screws.catch) fasteners.push({ partId: HW.latchScrew, component: 'catch-screws', ...f, use: 'Latch catch plates onto the flanges', of: mount.id, ...(i.after ? { piece: i.after } : {}) });
    }
    return {
      id: i.id, face: i.face, stage: i.kind === 'port' ? 6 : 5, kind: latched ? 'latched' : 'bolted', gap: i.gap, latches, before: i.before, after: i.after,
      use: i.kind === 'port' ? 'Last flange to the enclosure’s port flange' : 'Flange to flange',
      bolts: latched ? [] : pattern.map(([u, v]) => ({ at: facePoint(i.face, u, v), n: i.face.n })),
      // along the middle of the flange ring's face
      seal: latched && joint.seal === 'e-profile' ? { length: 2 * (w + F) + 2 * (h + F) } : null,
    };
  });
  if (couplings.some(c => c.kind === 'latched')) {
    const { along, overhang, length } = PRINTED_LATCH;
    if (along - overhang > T) errors.push(`The printed latch’s plates (${along} mm along the joint) are longer than the flanges are thick (${T} mm).`);
    if (TL.TOGGLE_LATCH_GEOMETRY.base.holeZ - overhang < LATCH_SCREW_EDGE - 1e-9) errors.push(`The printed latch’s screws would sit less than ${LATCH_SCREW_EDGE} mm inside the flanges.`);
    if (latchAt.some(v => v - length / 2 < -F - 1e-9 || v + length / 2 > h + F + 1e-9)) errors.push('A printed latch does not fit on the flange’s side: it would stand over the bearer or above the flange.');
  }

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
  const panels: MeshPanel[] = [];
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
        for (const k of [-1, 1]) fasteners.push({ partId: HW.railScrew, component: 'rail-screws', at: facePoint(face, u + k * 8, v + k * 8), direction: into, use: `${p.kind === 'collar' ? 'Collar' : 'Section'} rails through the flanges`, piece: p.id });
      }
    }
    // The floor board down onto the bottom rails.
    for (const s of [-1, 1]) {
      const a = s0(s * (w / 2 + r / 2), 0); const b = s1(s * (w / 2 + r / 2), 0); const l = len(sub(b, a));
      const count = p.kind === 'collar' ? 1 : fastenersAlong(l - 60, TUNNEL.floorScrewPitch);
      for (let i = 0; i < count; i++) {
        const t = count === 1 ? 0.5 : (30 + i * (l - 60) / (count - 1)) / l;
        fasteners.push({ partId: HW.floorScrew, component: 'floor-screws', at: add(a, mul(sub(b, a), t)), direction: down, use: 'Floor board onto the bottom rails', piece: p.id });
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
      for (const s of [-1, 1]) fasteners.push({ partId: HW.cleatScrew, component: 'cleat-screws', at: add(add(center, mul(p.frame.x, s * w / 4)), mul(p.frame.z, TUNNEL.cleat.size / 2)), direction: mul(p.frame.z, -1), use: 'Cleats onto the sloped floor', piece: p.id });
    }
  }
  const staple = part(HW.staple);
  for (const panel of panels) for (const e of panel.edges) {
    const l = len(sub(e.to, e.from)); const count = fastenersAlong(l, TUNNEL.staplePitch); const along = unit(sub(e.to, e.from));
    for (let i = 0; i < count; i++) fasteners.push({ partId: staple.id, component: 'staples', at: add(e.from, mul(sub(e.to, e.from), (i + 0.5) / count)), direction: e.drive, across: along, use: `Mesh: ${e.use.toLowerCase()}`, piece: panel.piece });
  }

  // Supports: one under the wall end, the port end, every straight coupling, and every joint (under its collar or mitre).
  // A Ganter foot, or a printed pad with the screw's head locked in it: its height (`l3`) and the stud out of it.
  const pad = config.footPad === 'printed' ? { height: config.padHeight, diameter: config.footDiameter, surface: config.padSurface, screw: tunnelPadScrew() } : null;
  const foot = pad ? pad.screw : tunnelFoot(config.footDiameter); const insertNut = part(HW.footInsertNut); const lockNut = part(HW.couplingNut);
  const l3 = pad ? pad.height : dimensionOf(foot, 'l3');
  const stud = pad ? dimensionOf(pad.screw, 'l') - PRESSURE_PAD.lip : dimensionOf(foot, 'l1');
  /** A foot's stud: at least the lock nut out of the timber, and the insert nut's length still in it. */
  const travel = { min: dimensionOf(lockNut, 'm'), max: stud - dimensionOf(insertNut, 'l') };
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
  const FX = TUNNEL.fixing; const sole = config.supportBase === 'self-standing' ? TUNNEL.sole : null;
  const method = config.supportFixing;
  /** Where the vertical latch fits: two flanges over the bearer (one latch spans both), the bearer's ends flush with their sides. */
  const latchFits = (flanges: number, flush: boolean) => flanges === 2 && flush;
  const station = (id: string, centre: V3, along: V3, width: number, fixings: V3[], flanges: 0 | 1 | 2, footprint: [number, number] | null, over: string[]) => {
    const a = unit([along[0], along[1], 0]); const across = unit(cross(a, UP));
    const half = TUNNEL.bearer.width / 2;
    const flush = flanges > 0 && Math.abs(width / 2 - lateral) < 1e-6;
    const seat = method === 'cradle' ? FX.cradle.seat : method === 'latch' && latchFits(flanges, flush) ? FX.latchPad : 0;
    let top = Infinity; let slopeAt = 0;
    for (const s of [-1, 0, 1]) for (const t of [-1, 0, 1]) {
      const q = add(add(centre, mul(a, s * half)), mul(across, t * (width / 2 - 1)));
      const found = underside([q[0], q[1]]); if (found && found.z < top) { top = found.z; if (s === 0 && t === 0) slopeAt = found.slope; }
      if (found && s === 0 && t === 0) slopeAt = found.slope;
    }
    if (!Number.isFinite(top)) top = centre[2] - F;
    top -= seat;
    const legAt = (side: number) => add([centre[0], centre[1], 0], mul(across, side * (width / 2 - TUNNEL.leg / 2)));
    const soleThickness = sole ? sole.thickness : 0;
    const ends = [-1, 1].map(side => {
      const q = legAt(side); const design = groundAt(config, q[0], q[1], false);
      return { q, design, actual: groundAt(config, q[0], q[1]), room: top - (design + TUNNEL.slab.thickness) - (l3 + middleSetting) - soleThickness };
    });
    const room = Math.min(...ends.map(e => e.room));
    const trestle = room >= TUNNEL.bearer.depth + minLeg;
    const depth = trestle ? TUNNEL.bearer.depth : Math.round(ends.reduce((sum, e) => sum + e.room, 0) / ends.length);
    if (!trestle && depth < TUNNEL.minBlock) errors.push(`At the ${id.replace('-', ' ')} the tunnel is too close to the ground for a support: ${Math.round(room + l3 + middleSetting + soleThickness)} mm under it, at least ${Math.ceil(TUNNEL.minBlock + l3 + middleSetting + soleThickness + TUNNEL.slab.thickness)} mm needed. Raise the port or slope the approach${sole ? ', or use trestles without soles' : ''}.`);
    // each leg (or low bearer end) on one foot, or on a sole along the tunnel with a foot near each of its ends; one slab under each
    const offsets = sole ? [-(sole.length / 2 - sole.footInset), sole.length / 2 - sole.footInset] : [0];
    const soles: SupportBox[] = [];
    const feet: Foot[] = ends.flatMap((e, i) => {
      const leg = trestle ? Math.round((e.room - TUNNEL.bearer.depth) / TUNNEL.legRound) * TUNNEL.legRound : 0;
      const slabTop = e.actual + TUNNEL.slab.thickness; const slabDesign = e.design + TUNNEL.slab.thickness;
      const bottom = top - depth - leg - soleThickness;
      if (sole) soles.push({ center: [e.q[0], e.q[1], bottom + sole.thickness / 2], size: [sole.width, sole.length, sole.thickness] });
      return offsets.map((o, k): Foot => {
        const at = add(e.q, mul(a, o));
        return {
          id: `${id}-foot-${i === 0 ? 'left' : 'right'}${sole ? `-${k}` : ''}`, at: [at[0], at[1], slabTop], designGround: e.design, actualGround: e.actual, slabTop,
          setting: bottom - slabDesign - l3, actualSetting: bottom - slabTop - l3, leg, end: i === 0 ? 0 : 1, primary: k === 0, legAt: [e.q[0], e.q[1], slabTop], slabAt: [e.q[0], e.q[1], e.actual],
        };
      });
    });
    const legs = [0, 1].map(end => feet.find(f => f.end === end && f.primary));
    const longest = Math.max(...feet.map(f => f.leg));
    const [left, right] = legs;
    const legBottom = (f: Foot) => f.slabTop + l3 + f.actualSetting + soleThickness;
    const brace = trestle && longest > TUNNEL.braceFrom && left && right
      ? { from: [left.legAt[0], left.legAt[1], legBottom(left) + 40] as V3, to: [right.legAt[0], right.legAt[1], top - depth - 40] as V3 } : null;
    const support: Support = {
      id, at: [centre[0], centre[1], top], along: a, across, length: width, top, kind: trestle ? 'trestle' : 'block', depth, slope: slopeAt, feet, brace, fixings,
      flanges, flush, footprint, seat, soles, hold: { attached: false, dowels: [], cradles: [], strap: null, latches: [], buttons: [] },
    };
    supportOver.set(id, over);
    supports.push(support);
  };
  /** The pieces resting on each support. */
  const supportOver = new Map<string, string[]>();
  /** Up into a flange's middle, either side of the floor: at `offsets` along the face's normal (a flange before a gap is behind it). */
  const flangeFixings = (face: Face, offsets: number[]) => offsets.flatMap(o => [-1, 1].map(k => facePoint(face, k * (w / 2 + r / 2), -F, o)));
  const bw = TUNNEL.bearer.width / 2;
  if (first) station('support-wall', add(first.start.at, mul(heading(0), bw)), heading(0), w + 2 * F, flangeFixings(first.start, [T / 2]), 1, [-bw, T - bw], [first.id]);
  for (const i of interfaces.filter(i => i.kind === 'coupling')) {
    const before = pieces.find(p => p.id === i.before); const after = pieces.find(p => p.id === i.after);
    if (before?.kind === 'collar' || after?.kind === 'collar') continue;
    const joint = joints.find(j => j.collar === null && len(sub(j.vertex, i.face.at)) < 1e-6);
    const width = joint?.kind === 'turn' ? (w + 2 * F) / Math.cos(rad(joint.angle) / 2) : w + 2 * F;
    // the bearer under the middle of the gap, into both flanges
    station(joint ? `support-${joint.id}` : `support-${i.id}`, sub(i.face.at, mul(i.face.n, i.gap / 2)), i.face.n, width, flangeFixings(i.face, [-(i.gap + T / 2), T / 2]), 2,
      [-(i.gap / 2 + T), i.gap / 2 + T], [i.before ?? '', i.after ?? '']);
  }
  for (const j of joints.filter(j => j.collar)) {
    const c = pieces.find(p => p.id === j.collar); if (!c) continue;
    const centre = mul(add(c.start.at, c.end.at), 0.5);
    const width = j.kind === 'turn' ? (w + 2 * F) / Math.cos(rad(j.angle) / 2) : w + 2 * F;
    const fixings = [-1, 1].map(k => add(add(centre, mul(c.frame.x, k * (w / 2 + r / 2))), mul(c.frame.z, -F)));
    station(`support-${j.id}`, centre, c.frame.y, width, fixings.map(p => [p[0], p[1], p[2]] as V3), 0, null, [c.id]);
  }
  if (last) station('support-port', sub(last.end.at, mul(dE, bw)), dE, w + 2 * F, flangeFixings(last.end, [-T / 2]), 1, [bw - T, bw], [last.id]);
  // Fixing points take their height from the bearer they go up through.
  for (const s of supports) s.fixings = s.fixings.map(p => [p[0], p[1], s.top]);

  // How the tunnel is held on each support (`supportFixing`), placed in the support's frame: across it, along the tunnel, up.
  for (const s of supports) {
    const over = supportOver.get(s.id) ?? [];
    const halfLength = s.length / 2; const top = s.top; const under = top + s.seat;
    const point = (u: number, al: number, z: number): V3 => { const q = add(add([s.at[0], s.at[1], 0], mul(s.across, u)), mul(s.along, al)); return [q[0], q[1], z]; };
    const box = (u0: number, u1: number, a0: number, a1: number, z0: number, z1: number): SupportBox => ({ center: point((u0 + u1) / 2, (a0 + a1) / 2, (z0 + z1) / 2), size: [Math.abs(u1 - u0), Math.abs(a1 - a0), Math.abs(z1 - z0)] });
    const hold = s.hold;
    const outer = s.flanges > 0 ? lateral : w / 2 + r;
    const pieceAt = (al: number) => over.length > 1 ? (al < 0 ? over[0] : over[1]) : over[0];
    if (method === 'screws') {
      hold.attached = true;
      for (const p of s.fixings) fasteners.push({ partId: HW.bearerScrew, component: 'flange-screws', support: s.id, at: [p[0], p[1], p[2] - s.depth], direction: [0, 0, 1], use: 'Up through the bearer into the flanges above' });
    } else if (method === 'dowels') {
      hold.attached = true;
      for (const p of s.fixings) {
        const at: V3 = [p[0], p[1], top - FX.dowel.into]; hold.dowels.push(at);
        fasteners.push({ partId: FX.dowel.partId, component: 'dowels', support: s.id, at, direction: [0, 0, 1], use: 'Dowels in the bearers’ tops, into the flanges above' });
      }
    } else if (method === 'cradle') {
      hold.attached = true;
      const { wall, lip, clearance, reach } = FX.cradle;
      const [a0, a1] = s.footprint ? [s.footprint[0] - clearance - wall, s.footprint[1] + clearance + wall] : [-bw, bw];
      for (const side of [-1, 1] as const) {
        // the end lip just outside the flanges' sides (beyond the bearer's end), or the collar's rails (on the bearer)
        const inner = side * (halfLength - reach); const end = side * (outer + clearance);
        const endOut = end + side * wall; const base = [inner, s.flanges > 0 ? endOut : side * halfLength].sort((x, y) => x - y) as [number, number];
        const boxes = [box(base[0], base[1], a0, a1, top, under), box(end, endOut, a0, a1, top, under + lip)];
        if (s.footprint) for (const [l0, l1] of [[a0, a0 + wall], [a1 - wall, a1]] as const) boxes.push(box(base[0], base[1], l0, l1, top, under + lip));
        hold.cradles.push({ side, boxes });
        for (const k of [-1, 1]) fasteners.push({ partId: HW.latchScrew, component: 'cradle-screws', support: s.id, at: point(side * (halfLength - reach / 2), k * 10, under), direction: [0, 0, -1], use: 'Cradles onto the bearers’ ends' });
      }
    } else if (method === 'strap') {
      hold.attached = true;
      const { size, length } = FX.strap.cleat;
      const hookZ = top - s.depth / 2 - size / 2;
      const crown = under + (s.flanges > 0 ? h + 2 * F : F + h + r);
      const cleats = ([-1, 1] as const).map(side => box(side * halfLength, side * (halfLength + size), -length / 2, length / 2, hookZ, hookZ + size));
      const path: V3[] = [point(-(halfLength + size / 2), 0, hookZ), point(-outer, 0, crown), point(outer, 0, crown), point(halfLength + size / 2, 0, hookZ)];
      hold.strap = { path, length: path.slice(1).reduce((n, q, i) => n + len(sub(q, path[i] ?? q)), 0), cleats };
      for (const side of [-1, 1] as const) for (const k of [-1, 1]) fasteners.push({ partId: HW.floorScrew, component: 'strap-cleat-screws', support: s.id, at: point(side * (halfLength + size), k * 18, hookZ + size / 2), direction: mul(s.across, -side), use: 'Strap cleats onto the bearers’ ends' });
    } else if (method === 'latch' && latchFits(s.flanges, s.flush)) {
      hold.attached = true;
      for (const side of [-1, 1] as const) {
        // the base plate spans both flanges' sides above the pad, the catch the bearer's end below: the lever pulls the flanges down
        const mount: LatchMount = { id: `${s.id}-latch-${side < 0 ? 'left' : 'right'}`, side, at: point(side * halfLength, 0, under - PRINTED_LATCH.overhang), out: mul(s.across, side), pull: [0, 0, 1] };
        hold.latches.push(mount);
        const screws = printedLatchScrews(mount);
        for (const f of screws.base) fasteners.push({ partId: HW.latchScrew, component: 'support-latch-screws', support: s.id, ...f, use: 'Vertical latch base plates onto the flanges’ sides', of: mount.id, piece: pieceAt(dot(sub(f.at, s.at), s.along)) ?? '' });
        for (const f of screws.catch) fasteners.push({ partId: HW.latchScrew, component: 'support-catch-screws', support: s.id, ...f, use: 'Vertical latch catch plates onto the bearers’ ends', of: mount.id });
      }
    } else if (method === 'turn-buttons' && s.flanges > 0 && s.flush) {
      hold.attached = true;
      const { out, high } = FX.keeper; const thick = FX.button.thickness;
      const kz0 = top - 30;
      const centres = s.flanges === 2 && s.footprint ? [s.footprint[0] + T / 2, s.footprint[1] - T / 2] : s.footprint ? [(s.footprint[0] + s.footprint[1]) / 2] : [];
      for (const side of [-1, 1] as const) for (const c of centres) {
        // the keeper on the bearer's end; the button on the flange's side, hanging down beside it and hooked under it
        const u0 = side * halfLength; const u1 = side * (halfLength + out);
        const keepers = [box(u0, u1, c + 1, c + 13, kz0, kz0 + high)];
        const b0 = side * lateral; const b1 = side * (lateral + thick);
        const arm = [box(b0, b1, c - 13, c - 1, kz0 - 6, under + 26), box(b0, b1, c - 13, c + 13, kz0 - 6, kz0)];
        const pivot = point(side * (lateral + thick), c - 7, under + 20);
        hold.buttons.push({ side, pivot, keepers, arm, piece: pieceAt(c) ?? '' });
        fasteners.push({ partId: HW.braceScrew, component: 'button-screws', support: s.id, at: pivot, direction: mul(s.across, -side), use: 'Turn buttons onto the flanges’ sides (their pivots)', piece: pieceAt(c) ?? '' });
        fasteners.push({ partId: HW.floorScrew, component: 'keeper-screws', support: s.id, at: point(side * (halfLength + out), c + 7, kz0 + high / 2), direction: mul(s.across, -side), use: 'Keepers onto the bearers’ ends' });
      }
    }
  }
  const loose = supports.filter(s => !s.hold.attached);
  if (loose.length && config.supportBase === 'trestle') {
    const why = method === 'gravity' ? 'With gravity only, nothing holds a support to the tunnel'
      : method === 'latch' ? `A vertical latch fits only where two flanges meet over a bearer flush with their sides, so ${loose.length} of the supports have nothing holding them to the tunnel`
        : `Turn buttons fit only under flanges flush with the bearer’s ends, so ${loose.length} of the supports have nothing holding them to the tunnel`;
    errors.push(`${why}, and a trestle cannot stand on its own along the tunnel (${loose.map(s => s.id.replace('support-', '').replace('-', ' ')).join(', ')}). Choose self-standing supports, or another fixing.`);
  }
  const short = supports.find(s => s.feet.some(f => f.setting - config.groundTolerance < travel.min - 1e-6 || f.setting + config.groundTolerance > travel.max + 1e-6));
  if (pad) {
    const shape = { padType: 'foot' as const, surface: pad.surface, relief: TUNNEL_PAD.relief, fit: TUNNEL_PAD.fit };
    const least = pressurePadMinHeight(shape, pad.screw);
    if (pad.height < least - 1e-9) errors.push(`A printed foot must be at least ${Math.ceil(least * 2) / 2} mm high to hold its screw’s head.`);
    if (pad.diameter < pressurePadMinDiameter(shape, pad.screw) - 1e-9) errors.push('A printed foot this narrow cannot hold its screw’s head.');
  }
  if (short) errors.push(`A ${config.footDiameter} mm ${pad ? 'printed foot' : 'foot'} (${stud} mm stud) cannot take up ±${config.groundTolerance} mm of uneven ground at the ${short.id.replace('support-', '').replace('-', ' ')}: its stud travels ${Math.round(travel.min)}–${Math.round(travel.max)} mm. ${pad ? 'Choose a smaller tolerance, or the Ganter feet.' : 'Choose a 40 mm foot or a smaller tolerance.'}`);
  for (const s of supports) {
    if (s.kind === 'trestle') for (const f of s.feet.filter(q => q.primary)) for (const k of [-1, 1]) fasteners.push({ partId: HW.bearerScrew, component: 'bearer-screws', at: add([f.legAt[0], f.legAt[1], s.top], mul(s.along, k * 11)), direction: [0, 0, -1], use: 'Down through the bearer into the legs' });
    // a sole is screwed up into its leg (or the low bearer's end)
    for (const f of s.feet.filter(q => q.primary && s.soles.length)) for (const k of [-1, 1]) {
      const bottom = f.slabTop + l3 + f.actualSetting;
      fasteners.push({ partId: HW.braceScrew, component: 'sole-screws', at: add([f.legAt[0], f.legAt[1], bottom], mul(s.along, k * 60)), direction: [0, 0, 1], use: 'Up through the soles into the legs or low bearers' });
    }
    if (s.brace) for (const end of [s.brace.from, s.brace.to]) for (const k of [-1, 1]) fasteners.push({ partId: HW.braceScrew, component: 'brace-screws', at: add(add(end, mul(s.along, -(TUNNEL.leg / 2 + TUNNEL.brace.thickness))), [0, 0, k * 15]), direction: s.along, use: 'Brace onto the legs' });
  }
  // A latch's screws must keep clear of the screws up through the bearers and of the rails' screws in the same flanges.
  const latchScrews = fasteners.filter(f => f.component === 'latch-screws' || f.component === 'catch-screws');
  const others = fasteners.filter(f => f.component === 'flange-screws' || f.component === 'rail-screws');
  // (only those in the same flanges: a screw's axis runs on far past it)
  const clash = latchScrews.some(f => {
    const near = others.filter(g => len(sub(g.at, f.at)) < 2 * T + 120);
    return fastenerClashes([f], near, LATCH_SCREW_CLEARANCE).length + fastenerClashes(near, [f], LATCH_SCREW_CLEARANCE).length > 0;
  });
  if (clash) errors.push(`A printed latch’s screw would come within ${LATCH_SCREW_CLEARANCE} mm of a bearer or rail screw in the same flange.`);
  // The route must stay out of the wall and the house.
  for (const p of pieces) for (const face of [p.start, p.end]) for (const u of [-lateral, lateral]) {
    if (facePoint(face, u, -F)[1] < TUNNEL.wallGap - 0.5 && errors.every(e => !e.startsWith('The route runs'))) errors.push('The route runs back into the wall: move the port further out or shorten the final run.');
  }

  const totalLength = pieces.reduce((sum, p) => sum + p.length, 0);
  return {
    config, site, w, h, S, E, dE, V1, V2, turns: turns.map(deg), rise, slope: slope ? { pitch: deg(slope.pitch), run: slope.run, footprint: slope.footprint } : null,
    joint, gap, pieces, joints, interfaces, couplings, members, panels, cleats, fasteners, supports, foot, pad, footHeight: l3, stud, insertNut, lockNut, travel, errors, totalLength,
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

/**
 * How the tunnel is held on its supports, in words for the assembly steps of the pages that show it: what goes on each support
 * before the tunnel (`support`), on the flanges while framing (`pieces`), how the pieces go down (`lay`), and what holds them
 * (`hold`). Empty where there is nothing to do.
 */
export function supportFixingSteps(l: TunnelLayout, scope: 'all' | 'one' = 'all') {
  const FX = TUNNEL.fixing; const each = scope === 'all' ? 'each' : 'the';
  const held = l.supports.filter(s => s.hold.attached);
  const latched = held.filter(s => s.hold.latches.length); const buttoned = held.filter(s => s.hold.buttons.length);
  const loose = l.supports.length - held.length;
  const rest = loose && l.config.supportFixing !== 'gravity' ? ` The ${loose === 1 ? 'support' : `${loose} supports`} where they do not fit only carr${loose === 1 ? 'ies' : 'y'} the tunnel, standing on ${loose === 1 ? 'its' : 'their'} soles.` : '';
  switch (l.config.supportFixing) {
    case 'screws': return { support: '', pieces: '', lay: '', hold: `Screw up through ${each} bearer into the flanges above (countersunk 6 × 100, two into each flange or collar rail).` };
    case 'dowels': return { support: `Drill two 8 mm holes ${FX.dowel.into} mm deep in ${each} bearer’s top under each flange (or collar rail) and tap an 8 × 40 parallel pin into each, half of it standing proud.`,
      pieces: 'Drill matching 8 mm holes in the flanges’ (and collar rails’) undersides, 21 mm deep.', lay: ' over its dowels', hold: 'Nothing to fix: the sections rest on their dowels and lift straight off.' };
    case 'cradle': return { support: `Screw a printed cradle onto ${each} end of ${each} bearer, two 4 × 25 screws through its base.`, pieces: '', lay: ' into its cradles',
      hold: `Nothing to fix: the cradles’ ${FX.cradle.lip} mm lips hold the flanges (and collar rails) in place, and they lift straight out.` };
    case 'strap': return { support: `Screw a 20 × 20 timber cleat onto both ends of ${each} bearer, two 4 × 40 screws each.`, pieces: '', lay: '',
      hold: `Hook a rubber tarp strap under the cleat at one end of ${each} bearer, stretch it over the tunnel (over the flanges, or over a collar’s roof) and hook it under the other: about ${Math.round((FX.strap.stretch - 1) * 100)} % stretched, it holds the tunnel down on its support.` };
    case 'latch': return { support: latched.length ? `Stick a ${FX.latchPad} mm EPDM pad along the top of ${scope === 'all' ? 'each bearer that two flanges meet over' : 'the bearer'}, and screw a vertical latch’s catch plate onto both of its ends, hook upwards.` : '',
      pieces: '', lay: '',
      hold: latched.length ? `Once both sections are down, screw each vertical latch’s base plate (lever and link snapped on) across the two flanges’ outer sides over the bearer, one 4 × 25 screw into each flange, hook its link over the catch on the bearer’s end and press the lever down over centre: it draws the flanges down onto the pad. To lift a section off, open its latches and take out the one screw in its flange.${rest}` : `No support has two flanges meeting over it, so no latch fits.${rest}` };
    case 'turn-buttons': return { support: buttoned.length ? `Screw a hardwood keeper onto both ends of ${scope === 'all' ? 'each bearer under flanges' : 'the bearer'}, under each flange, one 4 × 40 screw each.` : '',
      pieces: buttoned.length ? 'Screw a printed turn button onto each flange’s outer side where it will sit on a bearer, loosely on a 5 × 50 screw so it turns.' : '', lay: buttoned.length ? ', every turn button turned up out of the way' : '',
      hold: buttoned.length ? `Turn each button down so its foot hooks under the keeper on the bearer’s end.${rest}` : `No support has flanges flush with its ends, so no turn button fits.${rest}` };
    case 'gravity': return { support: '', pieces: '', lay: '', hold: 'Nothing to fix: the tunnel rests on its self-standing supports by its own weight, held in line by its couplings.' };
  }
}

/** Stage 0 is the site; 1–2 the supports; 3–4 the sections, framed and meshed on the trestles' line, raised; 5–6 laid and fixed. */
export function tunnelSteps(_variant: CatioMode, config: TunnelConfig): readonly AssemblyStep[] {
  const l = tunnelLayout(config);
  const joints = l.joints.length ? l.joints.map(describeJoint).join(', ') : 'no angle joints';
  const collar = config.angleJoint === 'angle-collar';
  const legs = l.supports.filter(s => s.kind === 'trestle').length; const blocks = l.supports.length - legs;
  const latched = l.couplings.filter(c => c.kind === 'latched'); const bolted = l.couplings.filter(c => c.kind === 'bolted' && c.stage === 5);
  const perCoupling = 2 * l.joint.latchesPerSide;
  const plates = latched.length ? ` Screw the printed toggle latches’ plates onto the flanges’ outer sides, ${perCoupling} at each coupling: base plates (lever and link snapped on) on the flange before it, catch plates on the one after, two 4 × 25 screws each.` : '';
  const couple = [
    latched.length ? `At ${latched.length === l.couplings.filter(c => c.stage === 5).length ? 'every coupling' : `${latched.length} square couplings`}${latched.some(c => c.seal) ? ' stick the E-profile seal round the flange’s face, lay the next piece' : ' lay the next piece'} ${l.gap} mm short of it, hook each latch’s link over its catch and press the lever down over centre.` : '',
    bolted.length ? `At ${latched.length ? `the ${bolted.length} mitred ${bolted.length === 1 ? 'joint' : 'joints'}` : 'every coupling'} push ${l.joint.boltsPerCoupling} M8 × 80 bolts through both flanges with a large washer each side and tighten the nuts.` : '',
  ].filter(Boolean).join(' ');
  const foot = l.pad
    ? `slide the head of an ${l.pad.screw.designation} into a printed foot, run an M8 nut up its shank and screw it into the insert nut by turning the foot`
    : 'screw the levelling foot’s stud into it';
  const fixing = supportFixingSteps(l);
  const sole = config.supportBase === 'self-standing' ? ' Each leg (or low bearer end) stands on a 22 × 95 sole along the tunnel, screwed up into it with two 5 × 50 screws, with an insert nut and a foot near each of the sole’s ends, so the support stands on its own.' : '';
  const level = l.pad
    ? 'Turn each printed foot by hand until the bearer top meets the line, then jam its nut up against the timber.'
    : 'Turn each foot on its stud until the bearer top meets the line, then jam the foot’s nut up against the timber.';
  return [
    { title: 'The site as it is', detail: `The window insert is fitted with its cat gate shut and the insert–tunnel coupling’s docking frame on its port; the enclosure stands with its rear port ${fmt(l.E[2] / 10)} cm above the grass. The ground between falls ${config.groundFall}% away from the wall and is uneven by up to ±${config.groundTolerance} mm.` },
    { title: 'Bed the slabs, build the supports', detail: `Bed a 30 × 30 cm paving slab in the grass under every foot position (${l.supports.length * 2}). For each support: screw an M8 insert nut into each leg’s foot end (or into the underside of a low bearer), ${foot}, screw the bearer down onto the legs and, on tall ones, the diagonal brace across. ${legs} trestles, ${blocks} low bearers.${sole}` },
    { title: 'Level the supports', detail: `Stretch a string line (or use a laser) at each bearer’s design height from the window floor. ${level} The feet, not the ground, set the heights.${fixing.support ? ` ${fixing.support}` : ''}` },
    { title: collar ? 'Frame the sections and collars' : 'Frame the sections', detail: `On trestles beside the line (shown raised over it): screw the four rails between each section’s two flange rings, then screw the floor board down onto the bottom rails. ${collar ? 'Each angle collar is built the same way between two flanges set at its angle.' : 'Sections at a joint have their flanges on the mitre: cut the rails and floor to the mitre angle.'} Sloped sections get cleats across the floor.${plates}${fixing.pieces ? ` ${fixing.pieces}` : ''}` },
    { title: 'Mesh the sections', detail: 'Staple the side and roof mesh to the rails and turn its ends onto the flanges, stapling every 15 cm.' },
    { title: 'Lay and couple', detail: `Lay the pieces onto the supports${fixing.lay} from the window end: ${joints}. ${couple} (The tunnel–tunnel coupling page sets how.)` },
    { title: 'Fix down and dock', detail: `${fixing.hold} Close the latches between the first flange and the window insert’s docking frame (the insert–tunnel coupling page); nothing of the tunnel rests on the wall or the insert. Bolt the last flange to the enclosure’s port flange: always bolted, whatever the couplings are. Open the gates.` },
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
    case 'pin': return [d('d'), d('l')].join(' · ');
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

/**
 * The cut list and mesh of the tunnel's pieces (only `pieces` of them, when given), and of its supports unless `supports` is false:
 * by kind of member, then longest first, then the mesh panels.
 */
export function tunnelCutList(l: TunnelLayout, { pieces, supports = true }: { pieces?: string[]; supports?: boolean } = {}): BomLine[] {
  const lines: BomLine[] = [];
  const of = (id: string) => !pieces || pieces.includes(id);
  const timber = (key: string, name: string, size: string, use: string, quantity = 1) => {
    const same = lines.find(line => line.group === 'Timber' && line.name === name && line.size === size);
    if (same) { same.quantity += quantity; return; }
    lines.push({ id: `timber-${key}-${lines.length}`, group: 'Timber', name, quantity, size, use });
  };
  for (const m of l.members.filter(q => of(q.piece))) {
    const piece = l.pieces.find(p => p.id === m.piece); const collar = piece?.kind === 'collar';
    const { cut } = memberCut(m);
    const name = m.kind === 'flange' ? `Flange ${m.rect[3] - m.rect[2] > m.rect[1] - m.rect[0] ? 'stile' : 'head or sill'}` : m.kind === 'rail' ? (collar ? 'Collar rail' : 'Section rail') : (collar ? 'Collar floor' : 'Floor board');
    const use = m.kind === 'flange' ? 'Flange rings at both ends of every section and collar' : m.kind === 'rail' ? 'Along the corners, between the flanges' : 'The cat’s floor, on the bottom rails';
    timber(m.kind, name, `${m.section} · ${cut}`, use);
  }
  for (const c of l.cleats.filter(q => of(q.piece))) timber('cleat', 'Floor cleat', `${TUNNEL.cleat.size} × ${TUNNEL.cleat.size} · ${Math.round(c.length)} long`, 'Across the floor of sloped sections, for grip');
  if (supports) for (const s of l.supports) {
    const bevel = Math.abs(s.slope) > 0.05 ? `, top bevelled ${fmt(Math.abs(s.slope))}°` : '';
    if (s.kind === 'trestle') timber('bearer', 'Bearer', `${TUNNEL.bearer.width} × ${TUNNEL.bearer.depth} · ${Math.round(s.length)} long${bevel}`, 'Across the top of each trestle, under the flanges');
    else timber('block', 'Low bearer', `${TUNNEL.bearer.width} × ${s.depth} (ripped from 45 × 95) · ${Math.round(s.length)} long${bevel}`, 'Where the tunnel is too low for legs: the feet go straight into it');
    for (const f of s.feet.filter(q => q.primary)) if (f.leg > 0) timber('leg', 'Leg', `${TUNNEL.leg} × ${TUNNEL.leg} · ${f.leg} long`, s.soles.length ? 'Under the bearer ends, on a sole' : 'Under the bearer ends; a foot in the bottom of each');
    if (s.soles.length) timber('sole', 'Sole', `${TUNNEL.sole.thickness} × ${TUNNEL.sole.width} · ${TUNNEL.sole.length} long`, 'Along the tunnel under each leg (or low bearer end), a foot near each end: the support stands on its own', s.soles.length);
    if (s.hold.strap) timber('strap-cleat', 'Strap cleat', `${TUNNEL.fixing.strap.cleat.size} × ${TUNNEL.fixing.strap.cleat.size} · ${TUNNEL.fixing.strap.cleat.length} long`, 'On both ends of each bearer: the strap hooks under it', 2);
    const keepers = s.hold.buttons.length;
    if (keepers) timber('keeper', 'Keeper', `hardwood ${TUNNEL.fixing.keeper.out} × ${TUNNEL.fixing.keeper.high} · 12 long`, 'On the bearer’s ends under each flange: the turn button hooks under it', keepers);
    if (s.brace) timber('brace', 'Brace', `${TUNNEL.brace.thickness} × ${TUNNEL.brace.width} · ${Math.round(len(sub(s.brace.to, s.brace.from)) + 80)} long, ends cut to the legs`, 'Diagonally across tall trestles');
  }
  for (const panel of l.panels.filter(q => of(q.piece))) {
    const [a, b, c, d] = panel.corners;
    const long = Math.round(Math.max(len(sub(b, a)), len(sub(c, d)))); const short = Math.round(Math.min(len(sub(b, a)), len(sub(c, d)))); const across = Math.round(len(sub(d, a)));
    const kind = panel.name.includes('roof') ? 'Roof mesh' : 'Side mesh';
    const size = `${long === short ? long : `${short}–${long}`} × ${across} · ${TUNNEL.mesh.opening} mm openings, ${TUNNEL.mesh.wire} mm wire (nominal)`;
    const same = lines.find(line => line.group === 'Mesh' && line.name === kind && line.size === size);
    if (same) same.quantity++; else lines.push({ id: `mesh-${lines.length}`, group: 'Mesh', name: kind, quantity: 1, size, use: kind === 'Roof mesh' ? 'Over the top rails, ends turned onto the flanges' : 'Down each side, rail to rail' });
  }
  // the cut list by kind of member, then longest first
  const kinds = ['Flange stile', 'Flange head or sill', 'Section rail', 'Collar rail', 'Floor board', 'Collar floor', 'Floor cleat', 'Bearer', 'Low bearer', 'Leg', 'Sole', 'Brace', 'Strap cleat', 'Keeper'];
  const length = (line: BomLine) => Number(/· (\d+)/.exec(line.size)?.[1] ?? 0);
  const cut = lines.filter(line => line.group === 'Timber').sort((x, y) => kinds.indexOf(x.name) - kinds.indexOf(y.name) || length(y) - length(x));
  return [...cut, ...lines.filter(line => line.group !== 'Timber')];
}

/** The parts list: cut list, mesh, hardware by library part, and groundwork. */
export function tunnelBom(_variant: CatioMode, config: TunnelConfig, site: TunnelSite = tunnelSite(), joint: TunnelCouplingConfig = savedTunnelCoupling()): BomLine[] {
  const l = tunnelLayout(config, site, joint);
  const lines: BomLine[] = tunnelCutList(l);
  const counts = new Map<string, { quantity: number; uses: Set<string> }>();
  const addPart = (partId: string, use: string, quantity = 1) => {
    const entry = counts.get(partId) ?? { quantity: 0, uses: new Set<string>() };
    entry.quantity += quantity; entry.uses.add(use); counts.set(partId, entry);
  };
  for (const c of l.couplings.filter(k => k.kind === 'bolted')) {
    addPart(HW.couplingBolt, c.stage === 6 ? 'Through the last flange and the enclosure’s port flange' : 'Through each bolted pair of flanges', c.bolts.length);
    addPart(HW.couplingWasher, 'Under every bolt head and nut', 2 * c.bolts.length);
    addPart(HW.couplingNut, 'On every coupling bolt', c.bolts.length);
  }
  for (const f of l.fasteners) addPart(f.partId, f.use.replace(/^Mesh: .*/, 'Mesh to rails and flanges'));
  for (const s of l.supports) for (let i = 0; i < s.feet.length; i++) {
    if (l.pad) { addPart(l.foot.id, 'Its head locked in a printed foot under every leg or low bearer'); addPart(l.lockNut.id, 'Jammed up against the timber on every foot’s screw'); }
    else addPart(l.foot.id, 'Under every leg or low bearer, on a slab; its own nut locks it');
    addPart(l.insertNut.id, 'In the foot end of each leg or low bearer');
  }
  for (const [partId, entry] of counts) {
    const p = part(partId);
    lines.push({ id: partId, group: 'Hardware', name: p.title, quantity: entry.quantity, size: `${p.designation} · ${partSize(p)}`, use: [...entry.uses].join('; '), partId });
  }
  const latched = l.couplings.filter(c => c.kind === 'latched');
  const couplingLatches = latched.reduce((n, c) => n + c.latches.length, 0);
  const supportLatches = l.supports.reduce((n, s) => n + s.hold.latches.length, 0);
  const latchUses = [
    couplingLatches ? `${l.joint.latchesPerSide === 1 ? 'One' : l.joint.latchesPerSide === 2 ? 'Two' : 'Three'} on each side of every square coupling: base plate on the flange before it, catch plate on the one after` : '',
    supportLatches ? `${supportLatches} upright on the supports: base plate across the flanges’ sides, catch plate on the bearer’s end` : '',
  ].filter(Boolean);
  if (couplingLatches + supportLatches) lines.push(printedLatchLine(couplingLatches + supportLatches, latchUses.join('; ')));
  const sealed = latched.filter(c => c.seal);
  const sealLength = sealed[0]?.seal?.length ?? 0;
  if (sealed.length) lines.push({ id: 'coupling-seal', group: 'Hardware', name: E_PROFILE_SEAL, quantity: sealed.length, size: `about ${PRINTED_LATCH_JOINT.seal.width} × ${PRINTED_LATCH_JOINT.seal.height} · ${Math.ceil(sealLength / 10) * 10} long each`, use: `Round each latched coupling’s flange face; squashed to the ${l.gap} mm gap` });
  // how the tunnel is held on its supports: the custom parts (the dowels and screws are library parts, counted above)
  const FX = TUNNEL.fixing;
  const custom = (id: string, name: string, quantity: number, size: string, use: string) => { if (quantity > 0) lines.push({ id, group: 'Hardware', name, quantity, size, use }); };
  const straps = new Map<number, number>();
  for (const s of l.supports) if (s.hold.strap) { const length = Math.ceil(s.hold.strap.length / FX.strap.stretch / 50) * 50; straps.set(length, (straps.get(length) ?? 0) + 1); }
  for (const [length, quantity] of [...straps].sort((x, y) => x[0] - y[0])) custom(`strap-${length}`, 'EPDM tarp strap with S-hooks (custom)', quantity, `${FX.strap.width} mm wide · about ${length} mm unstretched, ${Math.round((FX.strap.stretch - 1) * 100)} % stretched when hooked`, 'Over the tunnel at a support, hooked under the cleats on the bearer’s ends');
  custom('support-cradles', 'Support cradle, printed (custom)', l.supports.reduce((n, s) => n + s.hold.cradles.length, 0), `PETG · ${FX.cradle.seat} mm base, ${FX.cradle.lip} mm lips, ${FX.cradle.wall} mm walls, ${FX.cradle.reach} mm onto the bearer · shaped to the flanges or collar rails over it`, 'On both ends of every bearer, the tunnel set into them');
  custom('latch-pads', `EPDM pad strip, ${FX.latchPad} mm (custom)`, l.supports.filter(s => s.hold.latches.length).length, `${FX.latchPad} × ${TUNNEL.bearer.width} · ${Math.round(l.w + 2 * F)} long`, 'Along the bearer’s top under the flanges: the vertical latches squash it as they lock');
  custom('turn-buttons', 'Turn button, printed (custom)', l.supports.reduce((n, s) => n + s.hold.buttons.length, 0), `PETG · ${FX.button.thickness} thick · an arm down past the bearer’s top and a foot under its keeper`, 'On each flange’s side over a bearer, turned on a 5 × 50 screw');
  if (l.pad) lines.push({ id: 'foot-pads', group: 'Hardware', name: 'Pressure pad, foot', quantity: l.supports.reduce((n, s) => n + s.feet.length, 0), modelId: 'pressure-pad',
    size: `Ø ${l.pad.diameter} × ${l.pad.height} mm · ${l.pad.surface} sole · PETG · for an ${l.pad.screw.designation} head`, use: 'Under every leg or low bearer, on a slab: turned by hand to level' });
  lines.push({ id: 'slabs', group: 'Groundwork', name: 'Paving slab', quantity: l.supports.length * 2, size: `${TUNNEL.slab.size} × ${TUNNEL.slab.size} × ${TUNNEL.slab.thickness} concrete`, use: 'Bedded in the grass under every foot, so it cannot sink' });
  return lines;
}

export function tunnelFacts(_variant: CatioMode, config: TunnelConfig, site: TunnelSite = tunnelSite()): SubassemblyFact[] {
  const l = tunnelLayout(config, site);
  const cm = (mm: number) => fmt(mm / 10);
  const turns = l.joints.filter(j => j.kind === 'turn');
  const tallest = Math.max(0, ...l.supports.flatMap(s => s.feet.map(f => f.leg)));
  return [
    { label: 'Window port floor · above the grass', value: `${cm(l.S[2])} cm`, from: { page: 'window-insert', settings: WINDOW_FLOOR_SETTINGS } },
    { label: 'Window port → enclosure port', value: `${cm(l.totalLength)} cm of tunnel` },
    { label: 'Rise · floor to floor', value: l.slope ? `${l.rise >= 0 ? '+' : '−'}${cm(Math.abs(l.rise))} cm at ${fmt(Math.abs(l.slope.pitch))}°${Math.abs(l.rise) < NEARLY_LEVEL ? ' · nearly level: set the port floor level with the window port' : ''}` : 'level' },
    { label: 'Turns', value: turns.length ? turns.map(j => `${fmt(Math.abs(j.angle))}° ${side(j.angle)}`).join(', ') : 'straight' },
    { label: 'Sections · supports', value: `${l.pieces.filter(p => p.kind === 'section').length} · ${l.supports.length} (${tallest > 0 ? `longest leg ${cm(tallest)} cm` : 'low bearers, no legs'})` },
    { label: 'Foot travel · ground taken up', value: `${fmt(l.travel.max - l.travel.min, 0)} mm · ±${config.groundTolerance} mm` },
    { label: 'On the supports', value: `${SUPPORT_FIXING_LABELS[config.supportFixing]}${l.supports.some(s => !s.hold.attached) && config.supportFixing !== 'gravity' ? ` (${l.supports.filter(s => s.hold.attached).length} of ${l.supports.length})` : ''} · ${config.supportBase === 'self-standing' ? 'self-standing' : 'trestles'}` },
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
  { key: 'portLevel', label: 'Port floor', group: 'Enclosure port (fixed interface)', help: 'Level with the window port follows the window insert wherever its clamps put the port’s floor, so the tunnel stays level when the insert changes.',
    options: [{ value: 'window', label: 'Level with the window port' }, { value: 'own', label: 'At its own height' }] },
  { key: 'portHeight', label: 'Port floor height', group: 'Enclosure port (fixed interface)', help: 'The enclosure’s threshold above the grass at the wall. The window port’s floor is set by the window insert; the tunnel climbs or falls the difference.', options: [], range: { min: 150, max: 1400, step: 0.5, ...mm('cm') }, when: c => c.portLevel === 'own' },
  { key: 'approach', label: 'Straight out from the wall', group: 'Route', help: 'Before the first turn, measured from the wall to where the centre lines meet.', options: [], range: { min: 300, max: 5000, step: 10, ...mm('cm') } },
  { key: 'final', label: 'Straight into the port', group: 'Route', help: 'After the last turn, square to the port.', options: [], range: { min: 300, max: 5000, step: 10, ...mm('cm') } },
  { key: 'slopeLeg', label: 'Climb in', group: 'Route', help: 'The leg that climbs (or falls) to the port’s height, between two bends, with level runs either side.',
    options: [{ value: 'approach', label: 'The run out from the wall' }, { value: 'middle', label: 'The middle run' }, { value: 'final', label: 'The run into the port' }] },
  { key: 'maxSlope', label: 'Steepest slope', group: 'Route', help: 'Cats manage 25° on cleats; gentler is kinder to old cats. A small climb uses a shallower slope over a short run.',
    options: [10, 15, 20, 25].map(v => ({ value: v as TunnelConfig['maxSlope'], label: `${v}°` })) },
  { key: 'angleJoint', label: 'Turns and bends', group: 'Joints', help: 'A collar is a short wedge between two square flanges: every section stays a plain box. Mitred ends need no extra piece but cut the sections at a joint to the angle.',
    options: [{ value: 'angle-collar', label: 'Angle collar' }, { value: 'mitred-ends', label: 'Mitred ends, bolted' }] },
  { key: 'sectionLength', label: 'Longest section', group: 'Sections', help: 'Each straight run is split into equal sections no longer than this: shorter ones are lighter to carry and need more supports.',
    options: [500, 750, 1000].map(v => ({ value: v as TunnelConfig['sectionLength'], label: `${v / 10} cm` })) },
  { key: 'footPad', label: 'Feet', group: 'Supports',
    help: 'Printed feet (the pressure-pad model, in PETG) on the library’s longest M8 hexagon head screw, turned by hand; or bought Ganter levelling feet.',
    options: [{ value: 'printed', label: 'Printed feet on M8 × 80 screws' }, { value: 'ganter', label: 'Ganter GN 343.2 levelling feet' }] },
  { key: 'padHeight', label: 'Foot height', group: 'Supports', when: c => c.footPad === 'printed', options: [], range: { ...TUNNEL_PAD_HEIGHT, unit: 'mm' },
    help: 'From the foot’s back to its sole. The legs are cut shorter for a taller foot; the travel stays the screw’s.' },
  { key: 'padSurface', label: 'Foot sole', group: 'Supports', when: c => c.footPad === 'printed',
    help: 'Grooves grip a slab and drain; a flat sole bears all over; a dome rocks to stand square on a slab that is not level.',
    options: PRESSURE_PAD_SURFACES.map(value => ({ value, label: value.charAt(0).toUpperCase() + value.slice(1) })) },
  { key: 'footDiameter', label: 'Foot diameter', group: 'Supports', help: 'Of the printed feet or the Ganter feet. The 40 mm Ganter foot has an 80 mm stud, the most travel; the smaller ones have 63 mm studs. Every printed foot has the 80 mm screw.',
    options: TUNNEL_FOOT.diameters.map(v => ({ value: v, label: `${v} mm` })) },
  { key: 'groundFall', label: 'Ground falls away', group: 'Supports', help: 'The measured fall of the ground from the wall; the legs are cut to it.',
    options: [0, 1, 2, 4].map(v => ({ value: v as TunnelConfig['groundFall'], label: `${v}%` })) },
  { key: 'groundTolerance', label: 'Uneven by up to', group: 'Supports', help: 'How far the slab under any foot may sit above or below that fall. The feet take it up; the legs are not recut.',
    options: [10, 15, 20, 25].map(v => ({ value: v as TunnelConfig['groundTolerance'], label: `±${v} mm` })) },
  { key: 'supportFixing', label: 'Held on the supports by', group: 'Supports',
    help: 'Screws bind the tunnel to its supports for good; the others let a section lift off to be moved. Dowels and cradles locate it and keep the supports upright; a strap, vertical latches or turn buttons also hold it down; gravity only needs supports that stand on their own.',
    options: SUPPORT_FIXINGS.map(value => ({ value, label: SUPPORT_FIXING_LABELS[value] })) },
  { key: 'supportBase', label: 'Supports stand', group: 'Supports',
    help: `A trestle is one bearer on two legs across the tunnel: along it, it stands only when fixed to the tunnel. A ${TUNNEL.sole.thickness} × ${TUNNEL.sole.width} sole along the tunnel under each leg, with a foot near each end, lets every support stand on its own.`,
    options: [{ value: 'trestle', label: 'Held up by the tunnel (trestles)' }, { value: 'self-standing', label: 'On their own (a sole under each leg)' }] },
];

/** Ready-made routes besides the defaults. Level ones keep the port level with the window port, whatever the insert's clamps make it. */
export const TUNNEL_PRESETS: SubassemblyPreset<TunnelConfig>[] = [
  { id: 'straight', label: 'Straight', description: 'Straight out from the window to a port at the same height: no turns, no bends, square sections only.',
    config: () => ({ ...TUNNEL_DEFAULT, portX: 0, portY: 2500, portFacing: 0, portLevel: 'window' }) },
  { id: 'right-angle', label: '90° turn right', description: 'Out from the wall, one 90° turn to the right, then along the wall to a port at the same height.',
    config: () => ({ ...TUNNEL_DEFAULT, portX: 2200, portY: TUNNEL.wallGap + 1000, portFacing: 90, portLevel: 'window', approach: 1000, final: 1000 }) },
  { id: 'rising', label: 'Rising', description: 'Straight out to a door 90 cm above the grass: a climb at 20° in the middle run, level either side.',
    config: () => ({ ...TUNNEL_DEFAULT, portX: 0, portY: 4000, portFacing: 0, portHeight: 900, slopeLeg: 'middle' }) },
];

export const parseTunnel = (raw: unknown) => parseControlled(TUNNEL_DEFAULT, TUNNEL_CONTROLS, raw);

export const TUNNEL_DECISIONS: DesignDecision[] = [
  { title: 'Turns on the level, climbs in a straight line', parameter: 'Climb in',
    choice: 'The route turns only where it is level and climbs only where it runs straight: one sloped run between two vertical bends, inside one leg, with level runs before and after it.',
    why: 'A joint that turns and climbs at once is a compound mitre: the two sections would meet with one rolled against the other and the floor tilted sideways. Kept apart, every joint is a plain mitre about one axis, every floor stays level across, and the angles are exact. The slope is the steepest allowed (20° by default) so the climb is short; a small climb gets a shallower slope over a 15 cm run.' },
  { title: 'Angle collars at every turn and bend', parameter: 'Turns and bends',
    choice: 'A short wedge-shaped collar between two square flange rings, cut to the joint’s angle (any angle up to 135°), coupled to the sections either side like any coupling.',
    why: 'All sections stay plain boxes with square flanges, so a section can move to another place in the route, and only the small collars are cut to angles. The collar’s two flanges meet at the inside of the joint; each run stops short of the vertex by 30 + r · tan θ/2, r being the profile’s inside edge from the floor’s centre line. Mitred ends (up to 90°) save the collars but cut the two sections at each joint to the angle.' },
  { title: 'Flange couplings: latched, or bolted', from: { page: 'tunnel-tunnel-coupling', settings: ['mechanism', 'latchesPerSide', 'boltsPerCoupling', 'seal'] },
    choice: `Every section ends in a ${T} × ${F} flange ring that stands ${T} mm proud of the mesh. By default neighbours are joined by printed toggle latches on the rings’ outer sides (2 each side), across a ${PRINTED_LATCH_JOINT.gap} mm gap with an EPDM E-profile seal; or they are bolted face to face through both rings with ISO 4017 M8 × 80 bolts, ISO 7093 large washers and ISO 4032 nuts (6 per coupling). The tunnel–tunnel coupling page sets which. Mitred joints and the enclosure end are bolted either way.`,
    why: 'Latches close by hand and leave nothing loose in the grass; bolts outside the mesh are reached with a 13 mm spanner, have a rated hold, and are all library parts (80 mm grips 2 × 30 mm of flange, two washers and the nut with the thread through). Each run holds its sections and the gaps between them, so the route still ends exactly at the enclosure port. A mitre’s two flanges are not square to the runs, so their side faces do not line up for a latch. The window end is not bolted: the insert only presses on the recess and must not carry the tunnel, so the first flange stands 10 mm off the wall on its own support and is latched, without tools, to a docking frame on the insert (the insert–tunnel coupling page). The port end bolts to a matching flange on the enclosure, the one requirement the tunnel places on it.' },
  { title: 'Levelling feet on every support', parameter: 'Uneven by up to',
    choice: 'A support under the wall end, the port end, every coupling and every joint. Each stands on two printed feet (the pressure-pad model, 40 mm, PETG) on ISO 4017 M8 × 80 screws, in DIN 7965 insert nuts, on paving slabs; Ganter GN 343.2 levelling feet remain selectable. Legs are cut to the designed fall of the ground; the feet are set to mid-travel there.',
    why: 'Nothing is assumed level. A printed foot’s screw may run from the lock nut’s height (6.8 mm) out to its length less the foot’s 3 mm lip and the insert nut (59 mm), so each foot takes up about ±26 mm of slab height (a 40 mm Ganter foot’s stud ±27 mm); the page checks every foot against the chosen tolerance, and its scene sets each foot to the uneven ground it stands on. Slabs stop the feet sinking into grass. Where the tunnel is too low for legs, the feet screw straight into a bearer ripped to depth.' },
  { title: 'Held on the supports, but not for good', parameter: 'Held on the supports by',
    choice: `Seven ways, the screws by default: 6 × 100 screws up through each bearer into the flanges (the original); a rubber tarp strap over each support, hooked under a cleat on each bearer end; two ${TUNNEL.fixing.dowel.into * 2} mm parallel pins under each flange, half in the bearer; printed cradles on the bearer ends whose ${TUNNEL.fixing.cradle.lip} mm lips hold the flanges; vertical printed toggle latches from the flanges’ sides to the bearer’s ends, over a ${TUNNEL.fixing.latchPad} mm pad; turn buttons on the flanges hooked under keepers on the bearer; or gravity only.`,
    why: 'Screws bind the sections to the supports: every move means unscrewing from below, and re-driven screws hold less. Dowels and cradles let a section lift straight off and keep a trestle upright, but hold nothing down; the strap, the latches and the buttons also hold the tunnel down, without tools. The latch fits only where two flanges meet over a bearer (its 38 mm plate is wider than one 30 mm flange), the buttons only under flanges flush with the bearer’s ends; the tunnel has no face facing up near its bearers, so a button hooks under a keeper on the bearer instead of over the tunnel. Where a fixing does not fit, and with gravity only, the support must stand on its own: the page says which.' },
  { title: 'Trestles, or supports that stand on their own', parameter: 'Supports stand',
    choice: `By default each support is a trestle: a bearer on two legs across the tunnel, each leg on one foot. Self-standing: each leg (or a low bearer’s end) stands on a ${TUNNEL.sole.thickness} × ${TUNNEL.sole.width} × ${TUNNEL.sole.length} sole along the tunnel with a foot near each end, on the one slab.`,
    why: `Along the tunnel a trestle is only ${TUNNEL.bearer.width} mm wide on one foot per leg: it stands because it is fixed to the tunnel. With soles it stands on its own, so supports can be set out and levelled first and sections lifted on and off freely; a sole costs ${TUNNEL.sole.thickness} mm of height (a support too low for it is reported) and two more feet per support.` },
  { title: 'The enclosure is a fixed interface', parameter: 'Port floor height',
    choice: 'The enclosure is not designed here: only its rear port is, by where it is, which way it faces, its floor height and a 30 mm flange with the same bolt pattern.',
    why: 'The tunnel is solved from both ports: the window port’s floor follows the window insert as set on its page, the enclosure’s from these values. Its door can be higher or lower than the window; the tunnel climbs or falls the difference. “Level with the window port” keeps the two floors equal when the insert’s clamps move the window port’s floor, instead of leaving a few millimetres to climb.' },
];
