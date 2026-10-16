import { CATIO_MESH_DEFAULT, CATIO_MESHES, catioMesh, type CatioMesh, type CatioMeshSpec, dimensionOf, findPart, hexScrew, PRESSURE_PAD, PRESSURE_PAD_SURFACES, pressurePadMinDiameter, pressurePadMinHeight, TUNNEL_FOOT, TUNNEL_HARDWARE as HW, TUNNEL_PAD, tunnelFoot, type Part, type PressurePadSurface } from '@canfactory/contracts';
import { toggleLatchMechanism as TL } from '@canfactory/contracts';
import { MESH_LABELS, meshCut, meshRollLine } from './catioMesh.ts';
import { type CatioView } from './catioDesign.ts';
import { E_PROFILE_SEAL, latchHeights, PRINTED_LATCH, PRINTED_LATCH_JOINT, printedLatchLine, printedLatchScrews } from './catioPrintedLatch.ts';
import type { CatioMode } from './catioSettings.ts';
import { blankPanel, CLOSURE_WORDS, DOOR, doorBom, doorFacts, doorLibraryParts, PORT_CLOSURE_LABELS, PORT_CLOSURE_SETTING, setInDoor, type DoorFrame, type DoorPanel } from './catioDoor.ts';
import { BOLTS_PER_SIDE, boltStations, portOutline, DOOR_FIXING_LABELS, facePoint, frameAlong, portLatches, portRing, sidePortFace, sidePortLength, sidePortOffset, STANDARD_PORT, type Face, type Frame, type PortLatch, type Rect } from './catioPort.ts';
import { couplingGap, savedTunnelCoupling, SUPPORT_FIXING_LABELS, SUPPORT_SOLE, supportControls, type SupportBase, type SupportFixing, type TunnelCouplingConfig } from './catioTunnelJoint.ts';
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
  /**
   * How the tunnel turns: at a 90° side port (the run before couples its end onto a standard port in the side of the next run's
   * first section, catioPort.ts), with an angle collar cut to any angle, or with two sections mitred to it. Bends into and out of a
   * climb are angle collars unless the turns are mitred.
   */
  angleJoint: 'side-port' | 'angle-collar' | 'mitred-ends';
  /** What the tunnel is meshed with: soft cat netting or welded wire mesh (`CATIO_MESHES`). */
  mesh: CatioMesh;
  /** The longest section, in pitches (the shortest section that takes a side port, and a coupling's gap): each run's pitches are shared among as few as can take them. */
  sectionLength: 1 | 2 | 3 | 4;
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
  supportBase: SupportBase;
}

export { SUPPORT_FIXINGS, SUPPORT_FIXING_LABELS, type SupportFixing } from './catioTunnelJoint.ts';

export const TUNNEL_DEFAULT: TunnelConfig = {
  portX: 1149, portY: 2930, portFacing: 0, portLevel: 'own', portHeight: 500, approach: 700, final: 2000, slopeLeg: 'final', maxSlope: 20,
  angleJoint: 'side-port', mesh: CATIO_MESH_DEFAULT, sectionLength: 3, footPad: 'printed', padHeight: 27.5, padSurface: 'grooved', footDiameter: 40, groundFall: 2, groundTolerance: 15,
  supportFixing: 'screws', supportBase: 'trestle',
};

/** The printed feet's heights offered, in mm: at least what holds the screw's head over the floor and grooves. */
export const TUNNEL_PAD_HEIGHT = { min: 13, max: 40, step: 0.5 } as const;

/** Fixed sizes of the tunnel. */
export const TUNNEL = {
  /** Each end of a section is a flange ring, the standard port's (catioPort.ts): `thickness` along the tunnel, `width` out from the clear opening. */
  flange: STANDARD_PORT.ring,
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
  /** Over a section's end bay a net hood ends `hoodTurn` down each top rail's outer face. The floor lies in a `floorRebate` rebate along each bottom rail's inner top edge. */
  access: { hoodTurn: 10 }, floorRebate: 10,
  /** The sharpest turn each joint type is offered for. */
  maxTurn: { 'side-port': 90, 'angle-collar': 135, 'mitred-ends': 90 },
  staplePitch: 150, floorScrewPitch: 200,
  /** A self-standing support's sole: along the tunnel under each leg, a foot near each of its ends. */
  sole: SUPPORT_SOLE,
  /** A self-standing low bearer: this wide along the tunnel, on a foot near each of its four corners. */
  wideBlock: { width: 195, footInset: 25 },
  /** How the tunnel is held on its supports (`supportFixing`); sizes of this design, not of products. */
  fixing: {
    /** ISO 2338 parallel pins, two under each flange (or collar rail), half in the bearer. */
    dowel: { partId: HW.dowel, into: 20 },
    /** A rubber tarp strap over each support, hooked under a timber cleat on each bearer end; stretched by this much when hooked. */
    strap: { width: 25, stretch: 1.25, cleat: { size: 20, length: 60 } },
    /**
     * Turn buttons: a hardwood keeper on each flange's side just above the bearer (`above` up, `out` proud, `length` along the
     * tunnel), a printed post on the bearer's end beside it rising to the keeper's top, and a printed button on the post that turns
     * flat about a vertical screw: closed it lies over the keeper `clearance` above it, open it points straight out from the tunnel.
     */
    keeper: { out: 15, high: 12, above: 8, length: 15 }, post: { thick: 12, width: 10, down: 35 }, button: { thickness: 6, width: 11, clearance: 0.5 },
  },
} as const;

/** The fixed interfaces: the window insert's port (where the tunnel starts) and the tunnel's clear size. */
export interface TunnelSite { w: number; h: number; floorZ: number; window: WindowSpec; insert: WindowInsertConfig }

/** The window insert as saved on its own page (or its defaults), in the modular window saved on the catio concept page. */
export function tunnelSite(): TunnelSite {
  const insert = loadSubassemblyConfig('window-insert', parseWindowInsert, WINDOW_INSERT_DEFAULT);
  const window = windowFor('modular', insert);
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
export { facePoint, frameAlong, type Face, type Frame, type Rect };

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
  /** The section whose side port turns it, at a side-port turn. */
  side: string | null;
}
export interface Piece {
  id: string; kind: 'section' | 'collar'; name: string;
  frame: Frame; start: Face; end: Face; length: number;
  /** Degrees the piece climbs (its axis); a collar's is that of its chord. */
  pitch: number;
  joint: string | null;
  /**
   * A side port in the section's side, at a side-port turn (catioPort.ts `sidePortFace`): `offset` along it from its start, on its
   * `side` (+1 right, −1 left, looking along it), `face` the port's plane (normal into the section), `from` the piece whose end is
   * coupled to it. The section's start is then a stub, its port closed by a door.
   */
  sidePort: { offset: number; side: -1 | 1; face: Face; from: string } | null;
}
/**
 * Where two pieces meet, or a piece meets a port. `face` is the start face of the piece after it (the end face at the port); at a
 * latched coupling the piece before it ends `gap` short of that face.
 */
/** `side`: the piece before is coupled into a side opening of the piece after it (a turn), so its latches stand on the head. */
export interface Interface { id: string; kind: 'wall' | 'coupling' | 'port'; face: Face; before: string | null; after: string | null; gap: number; side?: boolean }
export interface Bolt { at: V3; n: V3 }
/**
 * A flange-to-flange joint: bolted face to face, or latched with printed toggle latches across a gap (the tunnel–tunnel coupling
 * page's mechanism). Latches are mounted on the flanges' outer sides: on each side the base plate on one flange and its catch on
 * the other (`PortLatch.base`: `port` is the piece after the joint, `outside` the one before it). `seal` is the E-profile's run round
 * the flange's face, when there is one.
 */
export interface Coupling {
  id: string; face: Face; stage: 5 | 6; kind: 'bolted' | 'latched'; gap: number; bolts: Bolt[]; latches: PortLatch[]; seal: { length: number } | null; use: string;
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
  /** The strap's path from hook to hook over the tunnel, its stretched length, and the cleats it hooks under. */
  strap: { path: V3[]; length: number; cleats: SupportBox[] } | null;
  /**
   * Turn buttons, one at each flange's side: the keeper on the flange (`piece`), the post on the bearer's end and the button on it,
   * turning about a vertical axis through `pivot` (its screw's head).
   */
  buttons: { side: -1 | 1; pivot: V3; keeper: SupportBox; post: SupportBox; button: SupportBox; piece: string; turn: -1 | 1 }[];
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
  /** A self-standing support's soles, one under each leg. */
  soles: SupportBox[];
  /** The bearer's width along the tunnel: wide for a self-standing low bearer. */
  width: number;
  /** Whether it stands on its own: on soles, or a wide low bearer on four feet. */
  stands: boolean;
  hold: SupportHold;
}
/** A mesh panel and the lines it is stapled along. `cut` is a cut edge of the mesh; a net passes over the top rails uncut, as one hood. */
export interface MeshPanel { id: string; piece: string; name: string; corners: [V3, V3, V3, V3]; edges: { from: V3; to: V3; drive: V3; use: string; cut: boolean }[] }
export interface Fastener {
  partId: string;
  component: 'rail-screws' | 'floor-screws' | 'cleat-screws' | 'staples' | 'bearer-screws' | 'brace-screws' | 'flange-screws' | 'latch-screws' | 'catch-screws' | 'sole-screws'
    | 'dowels' | 'strap-cleat-screws' | 'keeper-screws' | 'post-screws' | 'button-screws';
  at: V3; direction: V3; use: string; across?: V3;
  /** The piece it fixes into (for those built into one), the latch it holds, and the support it holds the tunnel on. */
  piece?: string; of?: string; support?: string;
}
/**
 * A door closing an opening that is not coupled (catioDoor.ts `setInDoor`, or `blankPanel` on the port's own latches): a side
 * opening of a section's end bay (`left`, `right`), or its start where the run before comes in from the side (`start`). In its own
 * frame `frame` (n out of the section), with the latches that hold it when the port's own latches do (base plates on the port's
 * left seen from outside, on the door's right).
 */
export interface PortDoor { id: string; piece: string; at: 'start' | 'left' | 'right'; face: Face; door: DoorPanel; frame: DoorFrame; latches: PortLatch[] }
/** A member: its section's `rect` in the profile of `from`, from `fromOffset` along its normal to `toOffset` along `to`'s; a post's `rect` is its plan and height, between offsets along the section. */
export interface Member { id: string; piece: string; name: string; section: string; from: Face; fromOffset: number; to: Face; toOffset: number; rect: Rect; kind: 'flange' | 'rail' | 'floor' | 'post' }

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
type JointItem = { kind: 'joint'; joint: Omit<Joint, 'vertex' | 'collar' | 'id' | 'side'> };

/** The enclosure port's floor above the grass: the window port's when level with it, else its own. */
export const portFloor = (config: TunnelConfig, site: TunnelSite) => config.portLevel === 'window' ? site.floorZ : config.portHeight;
/** The brief says where the enclosure port was placed when whole elements put it this far from where it was asked. */
export const PORT_MOVED = 1;
/** A climb this small is likely meant to be level: the window port's floor moved since the height was set. */
export const NEARLY_LEVEL = 30;

/**
 * The port's facing that side-port turns can make: straight out from the wall, or along it (±90°), whichever is nearest.
 * (Angle collars and mitred ends take any facing up to their sharpest turn.)
 */
export const squareFacing = (facing: number) => Math.abs(facing) < 45 ? 0 : Math.sign(facing) * 90;
/**
 * The standard tunnel element's length along a run, which every section's length is a whole number of (with the gaps): the shortest
 * section that takes a side port, and a coupling's gap.
 */
export const tunnelPitch = (site: Pick<TunnelSite, 'w'>, joint: Pick<TunnelCouplingConfig, 'mechanism'>) => sidePortLength(site.w) + couplingGap(joint);
/** A port at least this far to one side of the window is beside it: a tunnel turning at side ports turns to reach it. */
export const SQUARE_ROUTE_SIDE = sidePortOffset(300);
/**
 * The route legs of a tunnel turning at side ports, which only turns 90°: out from the wall, then along the wall to the port's line, then
 * out to it (a port facing straight out, beside the window: `approach` is the run out, the rest follows), or out from the wall to
 * the port's line and along it into the port (a port facing along the wall: both follow). Nearer than `SQUARE_ROUTE_SIDE` to the
 * window's line, the tunnel runs straight out. Which of the route's settings it uses.
 */
export function squareRoute(config: Pick<TunnelConfig, 'portX' | 'portFacing'>): { kind: 'straight' | 'offset' | 'along'; uses: ('approach' | 'final')[] } {
  const facing = squareFacing(config.portFacing);
  if (facing !== 0) return { kind: 'along', uses: [] };
  return Math.abs(config.portX) < SQUARE_ROUTE_SIDE ? { kind: 'straight', uses: [] } : { kind: 'offset', uses: ['approach'] };
}

/**
 * Everything the tunnel is, placed and installed, with its sections coupled as the tunnel–tunnel coupling page sets them (`joint`).
 * It is made of standard elements (catioPort.ts): every piece ends in the standard port, and every straight run is a whole number of
 * pitches (the shortest section that takes a side port, and a coupling's gap), in sections a whole number of pitches long. The route
 * runs towards the enclosure port as set (`asked`) and ends where those whole elements end (`E`); the brief says how far that is
 * from where it was asked. A climb is the one length solved exactly: a whole number of long sections, sloped as steeply as it
 * takes to reach the port's floor, up to the steepest slope allowed.
 */
export function tunnelLayout(config: TunnelConfig, site: TunnelSite = tunnelSite(), joint: TunnelCouplingConfig = savedTunnelCoupling()) {
  const { w, h, floorZ } = site;
  const errors: string[] = [];
  const turnType = config.angleJoint;
  const square = turnType === 'side-port';
  /** Bends (into and out of a climb) are made with angle collars when the turns are at side ports: a side port only turns on the level. */
  const bendType: 'angle-collar' | 'mitred-ends' = turnType === 'mitred-ends' ? 'mitred-ends' : 'angle-collar';
  if (Math.abs(w - h) > 1e-6) errors.push(`The standard port is square: set the tunnel’s clear size the same both ways (it is ${w} × ${h} mm).`);
  /** The gap at a latched coupling: between sections, between a section and an angle collar, and at a side port (square couplings only). */
  const gap = couplingGap(joint);
  /** The standard element: the shortest section that takes a side port, and the pitch every straight run is a whole number of. */
  const unitLength = sidePortLength(w); const pitch = unitLength + gap;
  /** Where a side port is along the section that carries it, from its start: past the stub, the pocket and half the ring. */
  const sideOffset = sidePortOffset(w);
  /** A run as near `length` as whole elements make it, at least one: `k` pitches less the last gap. */
  const snapRun = (length: number) => { const k = Math.max(1, Math.round((length + gap) / pitch)); return { k, length: k * pitch - gap }; };
  /**
   * How far a run stops short of a joint's vertex: the collar's setback and its coupling's gap; at a side port, the run into it stops
   * at the port's face and the gap, out across the section that carries it; a mitre meets on the bisector.
   */
  const stopAt = (theta: number, inside: number, type: TunnelConfig['angleJoint']) => type === 'angle-collar' ? jointSetback(theta, inside, type) + gap : type === 'side-port' ? inside + gap : 0;
  const setbackOf = (theta: number, inside: number, type: TunnelConfig['angleJoint']) => type === 'side-port' ? inside : jointSetback(theta, inside, type);
  const S: V3 = [0, TUNNEL.wallGap, floorZ];
  /** Where the enclosure port was asked for: its face's foot, at its floor. */
  const asked: V3 = [config.portX, config.portY, portFloor(config, site)];
  const psiE = rad(square ? squareFacing(config.portFacing) : config.portFacing);
  const dE = heading(psiE);
  // The centre line in plan: out from the wall, across, and square into the port.
  const route = square ? squareRoute(config).kind : null;
  const V1: V3 = route === 'along' ? [S[0], asked[1], S[2]] : route === 'straight' ? [S[0], asked[1], S[2]] : add(S, mul(heading(0), config.approach));
  const V2: V3 = route === 'offset' ? [asked[0], V1[1], S[2]] : route ? V1 : sub([asked[0], asked[1], S[2]], mul(dE, config.final));
  const middle = sub(V2, V1); const middleLength = Math.hypot(middle[0], middle[1]);
  const psiM = middleLength > 1e-6 ? Math.atan2(middle[0], middle[1]) : 0;
  const lateral = w / 2 + F;
  /** The legs: out from the wall, across (none when the square route has no middle leg), into the port. */
  const finalLength = route === 'along' ? Math.sign(Math.sin(psiE)) * asked[0] : route === 'offset' ? asked[1] - V1[1] : route === 'straight' ? 0 : config.final;
  if (route === 'along' && finalLength < 0) errors.push(`A port facing ${config.portFacing > 0 ? 'right' : 'left'} along the wall must be to the ${config.portFacing > 0 ? 'right' : 'left'} of the window: move it, or turn it the other way.`);
  const plan = [
    { psi: 0, length: len(sub(V1, S)) },
    ...(middleLength > 1e-6 ? [{ psi: psiM, length: middleLength }] : []),
    ...(Math.abs(finalLength) > 1e-6 ? [{ psi: psiE, length: Math.abs(finalLength) }] : []),
  ];
  const turns = plan.slice(1).map((leg, i) => wrap(leg.psi - (plan[i]?.psi ?? 0)));
  const maxTurn = TUNNEL.maxTurn[turnType];
  turns.forEach((theta, i) => {
    if (Math.abs(deg(theta)) > maxTurn + 1e-9) errors.push(`The ${i === 0 ? 'first' : 'second'} turn would be ${Math.abs(deg(theta)).toFixed(1)}°; ${turnType === 'angle-collar' ? 'angle collars' : 'mitred ends'} go to ${maxTurn}°. Move the port, change its facing or the straight runs.`);
  });
  const turnSetback = turns.map(theta => Math.abs(deg(theta)) < 0.05 ? null : setbackOf(theta, lateral, turnType));
  const turnStop = turns.map(theta => Math.abs(deg(theta)) < 0.05 ? null : stopAt(theta, lateral, turnType));
  /** Where the run after a turn starts: as far past the vertex as the one before stops short of it; behind it by the stub, at a side port. */
  const turnStart = turns.map((theta, i) => Math.abs(deg(theta)) < 0.05 ? null : square ? -sideOffset : turnStop[i] ?? 0);
  const legs = plan.map((leg, i) => ({ ...leg, in: i > 0 ? turnStart[i - 1] ?? 0 : 0, out: turnStop[i] ?? 0 }));
  // The climb: one straight sloped run inside the chosen leg, level runs of equal length before and after it.
  const rise = asked[2] - S[2]; const up = rise > 0;
  const slopeLegIndex = Math.min(legs.length - 1, { approach: 0, middle: legs.length > 2 ? 1 : 0, final: legs.length - 1 }[config.slopeLeg]);
  const insideUp = h + F; const insideDown = F;
  const [r1, r2] = up ? [insideUp, insideDown] : [insideDown, insideUp];
  /** Each bend's stop: the climb runs from vertex to vertex over both stops and the sloped run. */
  const bendSetbacks = (phi: number) => [stopAt(phi, r1, bendType), stopAt(phi, r2, bendType)] as const;
  let slope: { pitch: number; run: number; footprint: number } | null = null;
  if (Math.abs(rise) >= 0.5) {
    const climb = Math.abs(rise); const steepest = rad(config.maxSlope);
    const reach = (p: number, run: number) => { const [e1, e2] = bendSetbacks(p); return Math.sin(p) * (e1 + run + e2); };
    // the fewest whole pitches of long section that climb it at no more than the steepest slope, sloped exactly to the port's floor
    const [s1, s2] = bendSetbacks(steepest);
    let sloped = Math.max(1, Math.ceil((climb / Math.sin(steepest) - s1 - s2 + gap) / pitch - 1e-9)) * pitch - gap;
    while (reach(steepest, sloped) < climb - 1e-9) sloped += pitch;
    let lo = 1e-6; let hi = steepest;
    for (let i = 0; i < 100; i++) { const mid = (lo + hi) / 2; if (reach(mid, sloped) > climb) hi = mid; else lo = mid; }
    const phi = (lo + hi) / 2; const [e1, e2] = bendSetbacks(phi);
    slope = { pitch: up ? phi : -phi, run: sloped, footprint: e1 + (e1 + sloped + e2) * Math.cos(phi) + e2 };
  }

  // The sequence of straight runs and the joints between them; every run whole elements long, at least one, so a leg too short for
  // its joints moves the port instead of failing.
  const items: (Run | JointItem)[] = [];
  legs.forEach((leg, i) => {
    if (i > 0) {
      const theta = turns[i - 1] ?? 0; const e = turnSetback[i - 1]; const stop = turnStop[i - 1];
      if (e !== null && e !== undefined) items.push({ kind: 'joint', joint: { kind: 'turn', angle: deg(theta), a: heading(legs[i - 1]?.psi ?? 0), b: heading(leg.psi), setback: e, stop: stop ?? e, inside: lateral } });
    }
    // a run straight after another (a turn too small to make) is coupled to it across the gap, which comes off its length
    const available = leg.length - leg.in - leg.out - (items.at(-1)?.kind === 'run' ? gap : 0);
    const level = (length: number) => items.push({ kind: 'run', dir: heading(leg.psi), length: snapRun(length).length, psi: leg.psi, pitch: 0, leg: i });
    if (slope && i === slopeLegIndex) {
      const flat = (available - slope.footprint) / 2;
      const phi = Math.abs(slope.pitch); const [e1, e2] = bendSetbacks(phi); const s = Math.sign(slope.pitch);
      level(Math.max(flat, 1));
      items.push({ kind: 'joint', joint: { kind: 'bend', angle: s * deg(phi), a: heading(leg.psi), b: heading(leg.psi, slope.pitch), setback: setbackOf(phi, r1, bendType), stop: e1, inside: r1 } });
      items.push({ kind: 'run', dir: heading(leg.psi, slope.pitch), length: slope.run, psi: leg.psi, pitch: slope.pitch, leg: i });
      items.push({ kind: 'joint', joint: { kind: 'bend', angle: -s * deg(phi), a: heading(leg.psi, slope.pitch), b: heading(leg.psi), setback: setbackOf(phi, r2, bendType), stop: e2, inside: r2 } });
      level(Math.max(flat, 1));
    } else {
      level(Math.max(available, 1));
    }
  });

  // Walk the sequence: the sections of each run, an angle collar, a side port or a shared mitre at each joint; a latched coupling's
  // gap before every piece but the first, except across a mitre.
  const pieces: Piece[] = []; const joints: Joint[] = []; const interfaces: Interface[] = [];
  let at = S; let pendingMitre: V3 | null = null;
  /** The side port the next run's first section carries: on which side, for which joint, coupled to which piece's end. */
  let pendingSide: { side: -1 | 1; joint: string; from: string } | null = null;
  let sectionCount = 0;
  items.forEach((item, index) => {
    if (item.kind === 'joint') {
      const j = item.joint; const id = `joint-${joints.length + 1}`;
      const chord = unit(add(j.a, j.b));
      const type = j.kind === 'turn' ? turnType : bendType;
      if (type === 'side-port') {
        // the run before ends at the side port's face and the gap; the next starts the stub's length behind the vertex
        const vertex = add(at, mul(j.a, j.stop));
        const from = pieces.at(-1)?.id ?? '';
        const x = frameAlong(j.b).x; const side: -1 | 1 = dot(mul(j.a, -1), x) > 0 ? 1 : -1;
        joints.push({ ...j, id, vertex, collar: null, side: null });
        pendingSide = { side, joint: id, from };
        at = sub(vertex, mul(j.b, sideOffset));
      } else if (type === 'angle-collar') {
        at = add(at, mul(j.a, j.stop - j.setback));
        const vertex = add(at, mul(j.a, j.setback)); const end = add(vertex, mul(j.b, j.setback));
        const collarId = `collar-${joints.length + 1}`;
        const frame = frameAlong(chord);
        pieces.push({ id: collarId, kind: 'collar', name: `Angle collar ${joints.length + 1}`, frame, start: { at, n: j.a, frame: frameAlong(j.a) }, end: { at: end, n: j.b, frame: frameAlong(j.b) },
          length: len(sub(end, at)), pitch: deg(Math.asin(chord[2])), joint: id, sidePort: null });
        joints.push({ ...j, id, vertex, collar: collarId, side: null });
        at = add(end, mul(j.b, j.stop - j.setback));
      } else {
        joints.push({ ...j, id, vertex: at, collar: null, side: null });
        pendingMitre = chord;
      }
      return;
    }
    // k pitches, in sections of at most the longest length, as even as whole pitches go
    const k = Math.round((item.length + gap) / pitch);
    const next = items[index + 1];
    const frame = frameAlong(item.dir);
    // after another run, straight on: the gap of the coupling between them
    if (index > 0 && items[index - 1]?.kind === 'run') at = add(at, mul(item.dir, gap));
    const count = Math.ceil(k / config.sectionLength - 1e-9);
    const lengths = Array.from({ length: count }, (_, i) => Math.floor(k / count) + (i < k % count ? 1 : 0));
    lengths.forEach((n, i) => {
      if (i > 0) at = add(at, mul(item.dir, gap));
      const piece = n * pitch - gap;
      const end = add(at, mul(item.dir, piece));
      const startNormal: V3 = i === 0 && pendingMitre ? pendingMitre : item.dir;
      const endNormal: V3 = i === count - 1 && next?.kind === 'joint' && bendTypeOf(next.joint) === 'mitred-ends' ? unit(add(next.joint.a, next.joint.b)) : item.dir;
      sectionCount++;
      const id = `section-${sectionCount}`;
      const start: Face = { at, n: startNormal, frame };
      // the first section after a side-port turn carries the side port, its stub behind it
      const side = i === 0 ? pendingSide : null;
      const sidePort = side ? { offset: sideOffset, side: side.side, from: side.from, face: sidePortFace(add(add(at, mul(item.dir, sideOffset)), mul(frame.z, h / 2)), frame, w, side.side) } : null;
      if (side) { const j = joints.find(q => q.id === side.joint); if (j) j.side = id; }
      pieces.push({ id, kind: 'section', name: `Section ${sectionCount}`, frame, start, end: { at: end, n: endNormal, frame },
        length: piece, pitch: deg(item.pitch), joint: null, sidePort });
      at = end;
    });
    pendingMitre = null; pendingSide = null;
  });
  /** How a joint of the sequence is made: turns as chosen, bends with collars when turns are at side ports. */
  function bendTypeOf(j: JointItem['joint']) { return j.kind === 'turn' ? turnType : bendType; }

  // Faces between pieces: the wall end, the couplings, the port end.
  const first = pieces[0]; const last = pieces.at(-1);
  if (first) interfaces.push({ id: 'wall', kind: 'wall', face: first.start, before: null, after: first.id, gap: 0 });
  pieces.slice(1).forEach((p, i) => {
    const prev = pieces[i]; if (!prev) return;
    // at a side-port turn the piece before is coupled to the side port, across the gap; the section's start is the stub's, shut by a door
    if (p.sidePort?.from === prev.id) { interfaces.push({ id: `coupling-${i + 1}`, kind: 'coupling', face: p.sidePort.face, before: prev.id, after: p.id, gap, side: true }); return; }
    interfaces.push({ id: `coupling-${i + 1}`, kind: 'coupling', face: { ...p.start, frame: prev.kind === 'collar' ? p.start.frame : prev.end.frame }, before: prev.id, after: p.id, gap: len(sub(p.start.at, prev.end.at)) });
  });
  // the enclosure's port is a standard port too: coupled as any other, across the coupling's gap
  if (last) interfaces.push({ id: 'port', kind: 'port', face: { ...last.end, at: add(last.end.at, mul(last.end.n, gap)) }, before: last.id, after: null, gap });
  /** Where the route ends: the enclosure port's face, a whole number of elements from the window. */
  const E: V3 = last ? add(last.end.at, mul(last.end.n, gap)) : asked;
  const moved = len(sub(E, asked));
  const facingMoved = Math.abs(deg(psiE) - config.portFacing);

  // Bolts on every bolted coupling: at the standard port's stations, the same on its four sides. Printed latches across every
  // square coupling when they are chosen, on the faces' sides: seen from outside, each port has its base plates on its left and
  // its catch plates on its right, so the element before the joint has the base on one side and the element after it on the other.
  const pattern = boltStations(w, BOLTS_PER_SIDE[joint.boltsPerCoupling]);
  const fasteners: Fastener[] = [];
  const latchFasteners = (mount: PortLatch, port: string | null, outside: string | null) => {
    const screws = printedLatchScrews(mount);
    const [basePiece, catchPiece] = mount.base === 'port' ? [port, outside] : [outside, port];
    for (const f of screws.base) fasteners.push({ partId: HW.latchScrew, component: 'latch-screws', ...f, use: 'Latch base plates onto the flanges', of: mount.id, ...(basePiece ? { piece: basePiece } : {}) });
    for (const f of screws.catch) fasteners.push({ partId: HW.latchScrew, component: 'catch-screws', ...f, use: 'Latch catch plates onto the flanges', of: mount.id, ...(catchPiece ? { piece: catchPiece } : {}) });
  };
  const couplings: Coupling[] = interfaces.filter(i => i.kind !== 'wall').map(i => {
    const square = dot(i.face.n, i.face.frame.y) > 1 - 1e-9;
    const latched = joint.mechanism === 'printed-latch' && square;
    // into a side opening the section's own sides flank its posts: there the latches lie on the head
    const latches: PortLatch[] = !latched ? [] : portLatches(i.id, i.face, w, joint.latchesPerSide, i.gap, i.side ? 'head' : 'stiles');
    for (const mount of latches) latchFasteners(mount, i.after, i.before);
    return {
      id: i.id, face: i.face, stage: i.kind === 'port' ? 6 : 5, kind: latched ? 'latched' : 'bolted', gap: i.gap, latches, before: i.before, after: i.after,
      use: i.kind === 'port' ? 'Last flange to the enclosure’s port flange' : 'Flange to flange',
      bolts: latched ? [] : pattern.map(([u, v]) => ({ at: facePoint(i.face, u, v), n: i.face.n })),
      // along the middle of the flange ring's face
      seal: latched && joint.seal === 'e-profile' ? { length: 2 * (w + F) + 2 * (h + F) } : null,
    };
  });
  if (couplings.some(c => c.kind === 'latched') || joint.doorFixing === 'latches') {
    const { along, overhang, length } = PRINTED_LATCH;
    if (along - overhang > T) errors.push(`The printed latch’s plates (${along} mm along the joint) are longer than the flanges are thick (${T} mm).`);
    if (TL.TOGGLE_LATCH_GEOMETRY.base.holeZ - overhang < LATCH_SCREW_EDGE - 1e-9) errors.push(`The printed latch’s screws would sit less than ${LATCH_SCREW_EDGE} mm inside the flanges.`);
    if (latchHeights(joint.latchesPerSide).some(f => f * h - length / 2 < -F - 1e-9 || f * h + length / 2 > h + F + 1e-9)) errors.push('A printed latch does not fit on the flange’s side: it would stand over the bearer or above the flange.');
  }

  // Members: each section and collar is a flush box: an end frame at both ends (the standard port), rails along its four corners flush
  // with them, and a floor board lying in a rebate along the bottom rails. A section starts with a square end bay: a bay post on
  // each side one opening on from the start frame, so that both its sides are openings framed like an end.
  const members: Member[] = [];
  const ring = portRing(w);
  const r = TUNNEL.rail; const fl = TUNNEL.floor; const outer = w / 2 + r; const rebate = TUNNEL.floorRebate;
  /** Where the end bay's side openings are along a section, from its start, and whether a bay post closes the bay (one bay long, the far end frame does). */
  const bay: [number, number] = [T, T + w];
  /** A section has its end bay where its start is square: beside a mitre the frame leans over where the bay would be. */
  const bayed = (p: Piece) => p.kind === 'section' && dot(p.start.n, p.frame.y) > 1 - 1e-9;
  const bayPosted = (p: Piece) => bayed(p) && p.length > unitLength + 1e-6;
  for (const p of pieces) {
    for (const [end, face, offset] of [['start', p.start, T], ['end', p.end, -T]] as const) {
      for (const [name, rect] of ring) members.push({ id: `${p.id}-${end}-${name}`, piece: p.id, name: `Flange ${name.replace('-', ', ')}`, section: `${T} × ${F}`, from: face, fromOffset: 0, to: face, toOffset: offset, rect, kind: 'flange' });
    }
    const rails: [string, Rect][] = [
      ['bottom-left', [-outer, -w / 2, -r, 0]], ['bottom-right', [w / 2, outer, -r, 0]],
      ['top-left', [-outer, -w / 2, h, h + r]], ['top-right', [w / 2, outer, h, h + r]],
    ];
    for (const [name, rect] of rails) {
      const rail: Member = { id: `${p.id}-rail-${name}`, piece: p.id, name: `Rail, ${name.replace('-', ' ')}`, section: `${r} × ${rect[3] - rect[2]}`, from: p.start, fromOffset: T, to: p.end, toOffset: -T, rect, kind: 'rail' };
      // where the flanges nearly touch (the inside of a sharp joint) there is no room for a rail
      if (memberCut(rail).length >= TUNNEL.minRail) members.push(rail);
    }
    members.push({ id: `${p.id}-floor`, piece: p.id, name: 'Floor board', section: `${fl} mm exterior plywood`, from: p.start, fromOffset: T, to: p.end, toOffset: -T, rect: [-w / 2 - rebate, w / 2 + rebate, -fl, 0], kind: 'floor' });
    if (bayPosted(p)) for (const side of [-1, 1] as const) {
      const across: [number, number] = side > 0 ? [w / 2, outer] : [-outer, -w / 2];
      members.push({ id: `${p.id}-bay-post-${side < 0 ? 'left' : 'right'}`, piece: p.id, name: 'Bay post', section: `${F} × ${T}`, from: p.start, fromOffset: bay[1], to: p.start, toOffset: bay[1] + T, rect: [across[0], across[1], 0, h], kind: 'post' });
    }
  }

  // Doors: every opening that is not coupled is closed by the standard door (catioDoor.ts), set in on turn buttons or a blank held
  // by the port's own latches: both side openings of every section's end bay but the one the run before is coupled into at a turn,
  // and that section's start.
  const doorGap = PRINTED_LATCH_JOINT.gap;
  const sideFace = (p: Piece, side: -1 | 1) => sidePortFace(add(add(p.start.at, mul(p.frame.y, sideOffset)), mul(p.frame.z, h / 2)), p.frame, w, side);
  const doors: PortDoor[] = pieces.filter(bayed).flatMap(p => {
    const open: { at: PortDoor['at']; face: Face }[] = [
      ...(p.sidePort ? [{ at: 'start' as const, face: p.start }] : []),
      ...([-1, 1] as const).filter(side => p.sidePort?.side !== side).map(side => ({ at: side < 0 ? 'left' as const : 'right' as const, face: sideFace(p, side) })),
    ];
    return open.map(({ at, face }) => {
      const id = `${p.id}-door-${at}`;
      const door = joint.doorFixing === 'latches'
        ? blankPanel({ id, size: w, material: 'mesh', land: F, gap: doorGap })
        : setInDoor({ id, width: w, height: w, material: 'mesh', seat: site.window.seat, depth: T });
      const frame: DoorFrame = { origin: face.at, u: face.frame.x, v: face.frame.z, n: mul(face.n, -1) };
      const latches = joint.doorFixing === 'latches' ? portLatches(id, face, w, joint.latchesPerSide, doorGap, at === 'start' ? 'stiles' : 'head') : [];
      for (const mount of latches) latchFasteners(mount, p.id, p.id);
      return { id, piece: p.id, at, face, door, frame, latches };
    });
  });
  for (const d of doors) errors.push(...d.door.errors.filter(e => !errors.includes(e)));

  // Mesh: both sides and the roof of every piece, edges stapled to the rails and turned onto the frames. Welded mesh is three
  // panels a piece. A net is one hood: down one side, over both top rails and down the other, so that it is pulled taut over the
  // roof and has no seam there; only its bottom edges and its ends are cut. A section's end bay has no side mesh: its sides are
  // openings, and over it a net ends on the top rails' outer faces.
  const mesh = catioMesh(config.mesh);
  const panels: MeshPanel[] = [];
  const mid = (rect: Rect): [number, number] => [(rect[0] + rect[1]) / 2, (rect[2] + rect[3]) / 2];
  for (const p of pieces) {
    const s0 = (u: number, v: number) => facePoint(p.start, u, v, T); const s1 = (u: number, v: number) => facePoint(p.end, u, v, -T);
    const back = mul(p.start.n, -1); const forward = p.end.n;
    for (const side of [-1, 1]) {
      const u = side * outer; const inward = mul(p.frame.x, -side);
      if (bayed(p)) {
        // the side beyond the end bay, from its bay post to the far end frame
        const at = (along: number, v: number) => add(add(add(p.start.at, mul(p.frame.y, along)), mul(p.frame.x, u)), mul(p.frame.z, v));
        const from = bay[1] + T; const vb = -r; const vt = h + r;
        const c: [V3, V3, V3, V3] = [at(from, vb), s1(u, vb), s1(u, vt), at(from, vt)];
        if (p.length - T - from >= 1) panels.push({ id: `${p.id}-mesh-beside-end-${side < 0 ? 'left' : 'right'}`, piece: p.id, name: `${p.name}: side mesh beyond the end bay, ${side < 0 ? 'left' : 'right'}`, corners: c, edges: [
          { from: c[0], to: c[1], drive: inward, use: 'Onto the bottom rail', cut: true }, { from: c[3], to: c[2], drive: inward, use: 'Onto the top rail', cut: true },
          { from: c[0], to: c[3], drive: mul(p.frame.y, 1), use: 'Turned onto the bay post', cut: true }, { from: c[1], to: c[2], drive: forward, use: 'Turned onto the flange', cut: true },
        ] });
        if (mesh.soft) {
          const turn = TUNNEL.access.hoodTurn; const e: [V3, V3, V3, V3] = [s0(u, h + r - turn), s1(u, h + r - turn), s1(u, h + r), s0(u, h + r)];
          panels.push({ id: `${p.id}-mesh-edge-${side < 0 ? 'left' : 'right'}`, piece: p.id, name: `${p.name}: hood edge, ${side < 0 ? 'left' : 'right'}`, corners: e, edges: [
            { from: s0(u, h + r - turn / 2), to: s1(u, h + r - turn / 2), drive: inward, use: 'Turned down onto the top rail', cut: true },
          ] });
        }
        continue;
      }
      const c: [V3, V3, V3, V3] = [s0(u, -r), s1(u, -r), s1(u, h + r), s0(u, h + r)];
      panels.push({ id: `${p.id}-mesh-${side < 0 ? 'left' : 'right'}`, piece: p.id, name: `${p.name}: side mesh, ${side < 0 ? 'left' : 'right'}`, corners: c, edges: [
        { from: c[0], to: c[1], drive: inward, use: 'Onto the bottom rail', cut: true },
        // a net runs on over the top rail, where the roof's staples hold it
        ...(mesh.soft ? [] : [{ from: c[3], to: c[2], drive: inward, use: 'Onto the top rail', cut: true }]),
        { from: c[0], to: c[3], drive: back, use: 'Turned onto the flange', cut: true }, { from: c[1], to: c[2], drive: forward, use: 'Turned onto the flange', cut: true },
      ] });
    }
    const c: [V3, V3, V3, V3] = [s0(-outer, h + r), s1(-outer, h + r), s1(outer, h + r), s0(outer, h + r)];
    const down = mul(p.frame.z, -1); const railLine = (s: number) => [s0(s * (w / 2 + r / 2), h + r), s1(s * (w / 2 + r / 2), h + r)] as const;
    const [la, lb] = railLine(-1); const [ra, rb] = railLine(1);
    panels.push({ id: `${p.id}-mesh-roof`, piece: p.id, name: `${p.name}: roof mesh`, corners: c, edges: [
      { from: la, to: lb, drive: down, use: 'Onto the top rail', cut: !mesh.soft }, { from: ra, to: rb, drive: down, use: 'Onto the top rail', cut: !mesh.soft },
      { from: c[0], to: c[3], drive: back, use: 'Turned onto the flange', cut: true }, { from: c[1], to: c[2], drive: forward, use: 'Turned onto the flange', cut: true },
    ] });
    // The bay posts, down through the top rail and up through the bottom rail.
    for (const m of members.filter(q => q.piece === p.id && q.kind === 'post')) {
      const [u0, u1] = m.rect; const along = (m.fromOffset + m.toOffset) / 2;
      const foot = add(add(p.start.at, mul(p.frame.y, along)), mul(p.frame.x, (u0 + u1) / 2));
      fasteners.push({ partId: HW.railScrew, component: 'rail-screws', at: add(foot, mul(p.frame.z, h + r)), direction: mul(p.frame.z, -1), use: 'Bay posts down through the top rail', piece: p.id });
      fasteners.push({ partId: HW.railScrew, component: 'rail-screws', at: add(foot, mul(p.frame.z, -r)), direction: p.frame.z, use: 'Bay posts up through the bottom rail', piece: p.id });
    }
    // Rails into the flanges: two screws into each rail's end grain, driven from the flange's outer face.
    for (const m of members.filter(m => m.piece === p.id && m.kind === 'rail')) {
      const [u, v] = mid(m.rect);
      for (const [face, into] of [[p.start, p.start.n], [p.end, mul(p.end.n, -1)]] as const) {
        for (const k of [-1, 1]) fasteners.push({ partId: HW.railScrew, component: 'rail-screws', at: facePoint(face, u + k * 8, v + k * 8), direction: into, use: `${p.kind === 'collar' ? 'Collar' : 'Section'} rails through the flanges`, piece: p.id });
      }
    }
    // The floor board down into the bottom rails' rebates.
    for (const s of [-1, 1]) {
      const a = s0(s * (w / 2 + rebate / 2), 0); const b = s1(s * (w / 2 + rebate / 2), 0); const l = len(sub(b, a));
      const count = p.kind === 'collar' ? 1 : fastenersAlong(l - 60, TUNNEL.floorScrewPitch);
      for (let i = 0; i < count; i++) {
        const t = count === 1 ? 0.5 : (30 + i * (l - 60) / (count - 1)) / l;
        fasteners.push({ partId: HW.floorScrew, component: 'floor-screws', at: add(a, mul(sub(b, a), t)), direction: down, use: 'Floor board down into the bottom rails’ rebates', piece: p.id });
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
    // a net's cut edge is held at every mesh; where it only passes over a rail, and all round welded mesh, a staple every `staplePitch`
    const l = len(sub(e.to, e.from)); const count = fastenersAlong(l, mesh.soft && e.cut ? Math.min(TUNNEL.staplePitch, mesh.opening) : TUNNEL.staplePitch); const along = unit(sub(e.to, e.from));
    for (let i = 0; i < count; i++) fasteners.push({ partId: staple.id, component: 'staples', at: add(e.from, mul(sub(e.to, e.from), (i + 0.5) / count)), direction: e.drive, across: along, use: `Mesh: ${e.use.toLowerCase()}`, piece: panel.piece });
  }

  // Supports: one under the wall end, the port end, every straight coupling, and every joint (under its collar or mitre).
  // A Ganter foot, or a printed pad with the screw's head locked in it: its height (`l3`) and the stud out of it.
  const insertNut = part(HW.footInsertNut); const lockNut = part(HW.couplingNut);
  /**
   * A foot's screw (or stud) runs up into a leg, a low bearer or a self-standing support's sole, and must stay inside it: a printed
   * foot takes the shortest library screw that still gives the travel the ground's tolerance needs. In a sole the tip's room limits
   * the travel too.
   */
  const soleDepth = config.supportBase === 'self-standing' ? TUNNEL.sole.thickness - 1 : Infinity;
  const needed = 2 * config.groundTolerance + TUNNEL.legRound + dimensionOf(insertNut, 'l') + dimensionOf(lockNut, 'm');
  const padScrew = hexScrew(TUNNEL_PAD.thread, needed + PRESSURE_PAD.lip);
  const pad = config.footPad === 'printed' ? { height: config.padHeight, diameter: config.footDiameter, surface: config.padSurface, screw: padScrew } : null;
  const foot = pad ? pad.screw : tunnelFoot(config.footDiameter);
  const l3 = pad ? pad.height : dimensionOf(foot, 'l3');
  const stud = pad ? dimensionOf(pad.screw, 'l') - PRESSURE_PAD.lip : dimensionOf(foot, 'l1');
  /** A foot's stud: at least the lock nut out of the timber, the insert nut's length still in it, and (in a sole) its tip inside. */
  const travel = { min: Math.max(dimensionOf(lockNut, 'm'), stud - soleDepth), max: stud - dimensionOf(insertNut, 'l') };
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
  /**
   * A support at `place(half)` (its centre, for a bearer `2 · half` wide along the tunnel), `width` across it. Self-standing, a
   * trestle's legs stand on soles; a support too low for legs on soles becomes a wide low bearer on four feet of its own.
   */
  const station = (id: string, place: (half: number) => V3, along: V3, width: number, fixings: V3[], flanges: 0 | 1 | 2, footprintAt: ((half: number) => [number, number]) | null, over: string[]) => {
    const a = unit([along[0], along[1], 0]); const across = unit(cross(a, UP));
    const flush = flanges > 0 && Math.abs(width / 2 - lateral) < 1e-6;
    const topAt = (half: number) => {
      const centre = place(half);
      let top = Infinity; let slopeAt = 0;
      for (const s of [-1, -0.5, 0, 0.5, 1]) for (const t of [-1, 0, 1]) {
        const q = add(add(centre, mul(a, s * half)), mul(across, t * (width / 2 - 1)));
        const found = underside([q[0], q[1]]); if (found && found.z < top) top = found.z;
        if (found && s === 0 && t === 0) slopeAt = found.slope;
      }
      // and no flange's bottom edge over the bearer lower than its top: a collar's underside is not one plane
      for (const p of pieces) for (const [face, sign] of [[p.start, 1], [p.end, -1]] as const) for (const offset of [0, sign * T]) for (let k = -4; k <= 4; k++) {
        const q = facePoint(face, k * lateral / 4, -F, offset); const d = sub(q, centre);
        if (Math.abs(dot(d, a)) <= half && Math.abs(dot(d, across)) <= width / 2) top = Math.min(top, q[2]);
      }
      return { centre, top: Number.isFinite(top) ? top : centre[2] - F, slopeAt };
    };
    /** On soles the insert nuts are in the soles, so a leg may be as short as nothing: the bearer straight on its soles. */
    const fit = (centre: V3, top: number, soleThickness: number, leastLeg = minLeg) => {
      const legAt = (side: number) => add([centre[0], centre[1], 0], mul(across, side * (width / 2 - TUNNEL.leg / 2)));
      const ends = [-1, 1].map(side => {
        const q = legAt(side); const design = groundAt(config, q[0], q[1], false);
        return { q, design, actual: groundAt(config, q[0], q[1]), room: top - (design + TUNNEL.slab.thickness) - (l3 + middleSetting) - soleThickness };
      });
      const room = Math.min(...ends.map(e => e.room));
      const trestle = room >= TUNNEL.bearer.depth + leastLeg;
      const depth = trestle ? TUNNEL.bearer.depth : Math.round(ends.reduce((sum, e) => sum + e.room, 0) / ends.length);
      return { ends, room, trestle, depth };
    };
    let half = TUNNEL.bearer.width / 2; let at = topAt(half);
    let stance: 'leg' | 'sole' | 'wide' = 'leg'; let chosen = fit(at.centre, at.top, 0);
    if (sole) {
      const onSoles = fit(at.centre, at.top, sole.thickness, 0);
      if (onSoles.trestle) { stance = 'sole'; chosen = onSoles; }
      else {
        // too low for a bearer on soles: a wide low bearer, ripped to depth, its feet straight into it
        stance = 'wide'; half = TUNNEL.wideBlock.width / 2; at = topAt(half);
        const plain = fit(at.centre, at.top, 0);
        chosen = { ...plain, trestle: false, depth: Math.round(plain.ends.reduce((sum, e) => sum + e.room, 0) / plain.ends.length) };
      }
    }
    const { centre, top, slopeAt } = at; const { ends, room, trestle, depth } = chosen;
    const ownSole = stance === 'sole' ? sole : null; const soleThickness = ownSole ? ownSole.thickness : 0;
    const footprint = footprintAt ? footprintAt(half) : null;
    if (!trestle && depth < TUNNEL.minBlock) errors.push(`At the ${id.replace('-', ' ')} the tunnel is too close to the ground for a support: ${Math.round(room + l3 + middleSetting)} mm under it, at least ${Math.ceil(TUNNEL.minBlock + l3 + middleSetting + TUNNEL.slab.thickness)} mm needed. Raise the port or slope the approach.`);
    // each leg (or low bearer end) on one foot; self-standing, on a sole along the tunnel or under a wide low bearer, a foot near each
    // end along the tunnel; one slab under each end
    const spread = ownSole ? ownSole.length / 2 - ownSole.footInset : stance === 'wide' ? TUNNEL.wideBlock.width / 2 - TUNNEL.wideBlock.footInset : 0;
    const offsets = spread ? [-spread, spread] : [0];
    const soles: SupportBox[] = [];
    const feet: Foot[] = ends.flatMap((e, i) => {
      const leg = trestle ? Math.max(0, Math.round((e.room - TUNNEL.bearer.depth) / TUNNEL.legRound) * TUNNEL.legRound) : 0;
      const slabTop = e.actual + TUNNEL.slab.thickness; const slabDesign = e.design + TUNNEL.slab.thickness;
      const bottom = top - depth - leg - soleThickness;
      if (ownSole) soles.push({ center: [e.q[0], e.q[1], bottom + ownSole.thickness / 2], size: [ownSole.width, ownSole.length, ownSole.thickness] });
      return offsets.map((o, k): Foot => {
        const at = add(e.q, mul(a, o));
        return {
          id: `${id}-foot-${i === 0 ? 'left' : 'right'}${spread ? `-${k}` : ''}`, at: [at[0], at[1], slabTop], designGround: e.design, actualGround: e.actual, slabTop,
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
      flanges, flush, footprint, soles, width: 2 * half, stands: stance !== 'leg', hold: { attached: false, dowels: [], strap: null, buttons: [] },
    };
    supportOver.set(id, over);
    supports.push(support);
  };
  /** The pieces resting on each support. */
  const supportOver = new Map<string, string[]>();
  /** Up into a flange's middle, either side of the floor: at `offsets` along the face's normal (a flange before a gap is behind it). */
  const flangeFixings = (face: Face, offsets: number[]) => offsets.flatMap(o => [-1, 1].map(k => facePoint(face, k * (w / 2 + r / 2), -F, o)));
  if (first) station('support-wall', half => add(first.start.at, mul(heading(0), half)), heading(0), w + 2 * F, flangeFixings(first.start, [T / 2]), 1, half => [-half, T - half], [first.id]);
  for (const i of interfaces.filter(i => i.kind === 'coupling')) {
    const before = pieces.find(p => p.id === i.before); const after = pieces.find(p => p.id === i.after);
    if (before?.kind === 'collar' || after?.kind === 'collar') continue;
    const joint = joints.find(j => j.collar === null && len(sub(j.vertex, i.face.at)) < 1e-6);
    const width = joint?.kind === 'turn' ? (w + 2 * F) / Math.cos(rad(joint.angle) / 2) : w + 2 * F;
    // the bearer under the middle of the gap, into both flanges
    station(joint ? `support-${joint.id}` : `support-${i.id}`, () => sub(i.face.at, mul(i.face.n, i.gap / 2)), i.face.n, width, flangeFixings(i.face, [-(i.gap + T / 2), T / 2]), 2,
      () => [-(i.gap / 2 + T), i.gap / 2 + T], [i.before ?? '', i.after ?? '']);
  }
  for (const j of joints.filter(j => j.collar)) {
    const c = pieces.find(p => p.id === j.collar); if (!c) continue;
    const centre = mul(add(c.start.at, c.end.at), 0.5);
    const width = j.kind === 'turn' ? (w + 2 * F) / Math.cos(rad(j.angle) / 2) : w + 2 * F;
    const fixings = [-1, 1].map(k => add(add(centre, mul(c.frame.x, k * (w / 2 + r / 2))), mul(c.frame.z, -F)));
    station(`support-${j.id}`, () => centre, c.frame.y, width, fixings.map(p => [p[0], p[1], p[2]] as V3), 0, null, [c.id]);
  }
  if (last) station('support-port', half => sub(last.end.at, mul(dE, half)), dE, w + 2 * F, flangeFixings(last.end, [-T / 2]), 1, half => [half - T, half], [last.id]);
  // Fixing points take their height from the bearer they go up through.
  for (const s of supports) s.fixings = s.fixings.map(p => [p[0], p[1], s.top]);

  // How the tunnel is held on each support (`supportFixing`), placed in the support's frame: across it, along the tunnel, up.
  for (const s of supports) {
    const over = supportOver.get(s.id) ?? [];
    const halfLength = s.length / 2; const top = s.top; const under = top;
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
    } else if (method === 'strap') {
      hold.attached = true;
      const { size, length } = FX.strap.cleat;
      const hookZ = top - s.depth / 2 - size / 2;
      const crown = under + (s.flanges > 0 ? h + 2 * F : F + h + r);
      const cleats = ([-1, 1] as const).map(side => box(side * halfLength, side * (halfLength + size), -length / 2, length / 2, hookZ, hookZ + size));
      const path: V3[] = [point(-(halfLength + size / 2), 0, hookZ), point(-outer, 0, crown), point(outer, 0, crown), point(halfLength + size / 2, 0, hookZ)];
      hold.strap = { path, length: path.slice(1).reduce((n, q, i) => n + len(sub(q, path[i] ?? q)), 0), cleats };
      for (const side of [-1, 1] as const) for (const k of [-1, 1]) fasteners.push({ partId: HW.floorScrew, component: 'strap-cleat-screws', support: s.id, at: point(side * (halfLength + size), k * 18, hookZ + size / 2), direction: mul(s.across, -side), use: 'Strap cleats onto the bearers’ ends' });
    } else if (method === 'turn-buttons' && s.flanges > 0 && s.flush) {
      hold.attached = true;
      const { keeper, post, button } = FX;
      const centres = s.flanges === 2 && s.footprint ? [s.footprint[0] + T / 2, s.footprint[1] - T / 2] : s.footprint ? [(s.footprint[0] + s.footprint[1]) / 2] : [];
      for (const side of [-1, 1] as const) for (const c of centres) {
        // out from the flush face of the flange's side and the bearer's end (x), along the tunnel from the flange's middle (a)
        const at = (x0: number, x1: number, a0: number, a1: number, z0: number, z1: number) => box(side * (halfLength + x0), side * (halfLength + x1), c + a0, c + a1, z0, z1);
        // the post at the flange's end nearer the bearer's middle (so it is on the bearer), the keeper at its other end, the button
        // pointing from the post to the keeper; open, it turns so that its far end points straight out from the tunnel
        const dir = c < 0 ? -1 : 1;
        const keeperTop = under + keeper.above + keeper.high;
        const [k0, k1] = dir < 0 ? [-T / 2 + 2, -T / 2 + 2 + keeper.length] : [T / 2 - 2 - keeper.length, T / 2 - 2];
        const keeperBox = at(0, keeper.out, k0, k1, under + keeper.above, keeperTop);
        const bottom = keeperTop + button.clearance;
        const pivotA = -dir * (T / 2 - 1 - post.width / 2);
        const postBox = at(0, post.thick, pivotA - post.width / 2, pivotA + post.width / 2, top - post.down, bottom);
        const buttonBox = at(post.thick / 2 - button.width / 2, post.thick / 2 + button.width / 2, Math.min(pivotA, dir < 0 ? k0 : k1), Math.max(pivotA, dir < 0 ? k0 : k1), bottom, bottom + button.thickness);
        const pivot = point(side * (halfLength + post.thick / 2), c + pivotA, bottom + button.thickness);
        const piece = pieceAt(c) ?? '';
        if (Math.abs(c + pivotA) + post.width / 2 > s.width / 2 + 1e-6) errors.push(`At the ${s.id.replace('support-', '').replace('-', ' ')} a turn button’s post would stand off the end of the bearer.`);
        hold.buttons.push({ side, pivot, keeper: keeperBox, post: postBox, button: buttonBox, piece, turn: dir * side < 0 ? 1 : -1 });
        const inward = mul(s.across, -side);
        fasteners.push({ partId: HW.floorScrew, component: 'keeper-screws', support: s.id, at: point(side * (halfLength + keeper.out), c + (k0 + k1) / 2, under + keeper.above + keeper.high / 2), direction: inward, use: 'Keepers onto the flanges’ sides', piece });
        for (const z of [top - post.down + 10, top - 12]) fasteners.push({ partId: HW.floorScrew, component: 'post-screws', support: s.id, at: point(side * (halfLength + post.thick), c + pivotA, z), direction: inward, use: 'Turn buttons’ posts onto the bearers’ ends' });
        fasteners.push({ partId: HW.latchScrew, component: 'button-screws', support: s.id, at: pivot, direction: [0, 0, -1], use: 'Turn buttons onto their posts (their pivots)' });
      }
    }
  }
  // a support with nothing holding it to the tunnel must stand on its soles
  const loose = supports.filter(s => !s.hold.attached && !s.stands);
  if (loose.length) {
    const names = loose.map(s => s.id.replace('support-', '').replace('-', ' ')).join(', ');
    const why = method === 'gravity' ? 'With gravity only, nothing holds a support to the tunnel'
      : `Turn buttons fit only under flanges flush with the bearer’s ends, so ${loose.length} of the supports have nothing holding them to the tunnel`;
    errors.push(config.supportBase === 'trestle'
      ? `${why}, and a trestle cannot stand on its own along the tunnel (${names}). Choose self-standing supports, or another fixing.`
      : `${why}, and ${loose.length === 1 ? 'a support is' : `${loose.length} supports are`} too low for soles to stand on (${names}). Choose another fixing, or raise the tunnel there.`);
  }
  // a foot's screw (or stud) runs up into a sole or a low bearer: its tip must stay inside it however far the foot is turned
  for (const s of supports) {
    const housing = s.soles.length ? TUNNEL.sole.thickness : s.kind === 'block' ? s.depth : Infinity;
    const deepest = Math.max(...s.feet.map(f => stud - (f.setting - config.groundTolerance)));
    if (deepest > housing - 1 + 1e-6) errors.push(`At the ${s.id.replace('support-', '').replace('-', ' ')} a foot’s ${pad ? 'screw' : 'stud'} would come out of the top of the ${s.soles.length ? 'sole' : 'low bearer'} (${Math.round(deepest)} mm up into ${Math.round(housing)} mm). ${pad ? 'Choose a smaller tolerance (a shorter screw)' : 'Choose the printed feet'}, or raise the tunnel there.`);
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
    if (s.kind === 'trestle') for (const f of s.feet.filter(q => q.primary)) for (const k of [-1, 1]) fasteners.push({ partId: HW.bearerScrew, component: 'bearer-screws', at: add([f.legAt[0], f.legAt[1], s.top], mul(s.along, k * 11)), direction: [0, 0, -1], use: s.soles.length && s.feet.some(f => f.leg === 0) ? 'Down through the bearer into the legs or soles' : 'Down through the bearer into the legs' });
    // a sole is screwed up into its leg (or the low bearer's end)
    // (across the leg, clear of the bearer's screws down into it; a bearer straight on its soles is screwed down into them instead)
    for (const f of s.feet.filter(q => q.primary && s.soles.length && q.leg > 0)) for (const k of [-1, 1]) {
      const bottom = f.slabTop + l3 + f.actualSetting;
      fasteners.push({ partId: HW.bearerScrew, component: 'sole-screws', at: add([f.legAt[0], f.legAt[1], bottom], mul(s.across, k * 11)), direction: [0, 0, 1], use: 'Up through the soles into the legs' });
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
    config, site, w, h, S, E, dE, V1, V2, asked, moved, facingMoved, unitLength, pitch, turns: turns.map(deg), rise, slope: slope ? { pitch: deg(slope.pitch), run: slope.run, footprint: slope.footprint } : null,
    joint, gap, mesh, pieces, joints, interfaces, couplings, members, panels, doors, cleats, fasteners, supports, foot, pad, footHeight: l3, stud, insertNut, lockNut, travel, errors, totalLength,
  };
}
export type TunnelLayout = ReturnType<typeof tunnelLayout>;

export function validateTunnel(_variant: CatioMode, config: TunnelConfig, site: TunnelSite = tunnelSite()): string[] {
  return tunnelLayout(config, site).errors;
}

const side = (angle: number) => angle > 0 ? 'right' : 'left';
/** Words as a list: “a”, “a and b”, “a, b and c”. */
const wordList = (words: string[]) => words.length < 2 ? words[0] ?? '' : `${words.slice(0, -1).join(', ')} and ${words.at(-1) ?? ''}`;
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
  const buttoned = held.filter(s => s.hold.buttons.length);
  const loose = l.supports.length - held.length;
  const rest = loose && l.config.supportFixing !== 'gravity' ? ` The ${loose === 1 ? 'support' : `${loose} supports`} where they do not fit only carr${loose === 1 ? 'ies' : 'y'} the tunnel, standing on ${loose === 1 ? 'its' : 'their'} soles.` : '';
  const low = l.config.supportBase === 'self-standing' ? l.supports.filter(s => !s.soles.length).length : 0;
  const lowNote = low ? ` (${low === 1 ? 'The one support' : `The ${low} supports`} too low for soles stand${low === 1 ? 's' : ''} on ${low === 1 ? 'its' : 'their'} feet alone and must be held by the tunnel.)` : '';
  switch (l.config.supportFixing) {
    case 'screws': return { support: '', pieces: '', lay: '', hold: `Screw up through ${each} bearer into the flanges above (countersunk 6 × 100, two into each flange or collar rail).${lowNote}` };
    case 'dowels': return { support: `Drill two 8 mm holes ${FX.dowel.into} mm deep in ${each} bearer’s top under each flange (or collar rail) and tap an 8 × 40 parallel pin into each, half of it standing proud.`,
      pieces: 'Drill matching 8 mm holes in the flanges’ (and collar rails’) undersides, 21 mm deep.', lay: ' over its dowels', hold: 'Nothing to fix: the sections rest on their dowels and lift straight off.' };
    case 'strap': return { support: `Screw a 20 × 20 timber cleat onto both ends of ${each} bearer, two 4 × 40 screws each.`, pieces: '', lay: '',
      hold: `Hook a rubber tarp strap under the cleat at one end of ${each} bearer, stretch it over the tunnel (over the flanges, or over a collar’s roof) and hook it under the other: about ${Math.round((FX.strap.stretch - 1) * 100)} % stretched, it holds the tunnel down on its support.` };
    case 'turn-buttons': return { support: buttoned.length ? `Screw a printed post onto both ends of ${scope === 'all' ? 'each bearer under flanges' : 'the bearer'}, beside where each flange will stand, two 4 × 40 screws each, and a printed turn button on top of each, loosely on a 4 × 25 screw so it turns, pointing straight out.` : '',
      pieces: buttoned.length ? 'Screw a hardwood keeper onto each flange’s outer side where it will sit on a bearer, just above the bearer, one 4 × 40 screw each.' : '', lay: buttoned.length ? ', every turn button pointing straight out' : '',
      hold: buttoned.length ? `Turn each button flat over the keeper beside it: it holds the flange down on the bearer. Turn it back out to lift the section off.${rest}` : `No support has flanges flush with its ends, so no turn button fits.${rest}` };
    case 'gravity': return { support: '', pieces: '', lay: '', hold: `Nothing to fix: the tunnel rests on its self-standing supports by its own weight, held in line by its couplings.${lowNote}` };
  }
}

/** Stage 0 is the site; 1–2 the supports; 3–4 the sections, framed and meshed on the trestles' line, raised; 5–6 laid and fixed. */
export function tunnelSteps(_variant: CatioMode, config: TunnelConfig): readonly AssemblyStep[] {
  const l = tunnelLayout(config);
  const joints = l.joints.length ? l.joints.map(describeJoint).join(', ') : 'no angle joints';
  const collar = l.pieces.some(p => p.kind === 'collar'); const ported = l.pieces.filter(p => p.sidePort).length;
  const legs = l.supports.filter(s => s.kind === 'trestle').length; const blocks = l.supports.length - legs;
  const latched = l.couplings.filter(c => c.kind === 'latched'); const bolted = l.couplings.filter(c => c.kind === 'bolted' && c.stage === 5);
  const perCoupling = 2 * l.joint.latchesPerSide;
  const plates = latched.length ? ` Screw the printed toggle latches’ plates onto the end frames’ outer sides, ${perCoupling} at each coupling, two 4 × 25 screws each: seen from outside each frame, the base plates (lever and link snapped on) on its left side and the catch plates on its right, so that every port mates with every other.${l.couplings.some(c => c.latches.some(q => q.id.includes('-head-'))) ? ' Where a run’s end butts into a side opening, two latches lie on the top instead, across the joint: on the end frame’s head and on the top rail over the opening.' : ''}` : '';
  const doorLatches = l.doors.filter(d => d.latches.length).length;
  const sideFrame = ` Every section starts with a square end bay: stand a ${F} × ${T} bay post on each side one opening (${l.w / 10} cm) on from the start frame, screwed down through the top rail and up through the bottom rail, so that both sides of the bay are openings framed like an end.${ported ? ` At each turn (${ported}) the run before butts its end into a side opening of the next run’s first section.` : ''}`;
  const doorWords = !l.doors.length ? '' : l.joint.doorFixing === 'latches'
    ? ` Close every opening that is not coupled with its door (${l.doors.length}): the end bays’ side openings, and the start of a section the run before comes into from the side: a blank frame with mesh clamped over it under cover strips. ${doorLatches ? `Screw on its latches’ plates as on a frame, ` : ''}hold it ${PRINTED_LATCH_JOINT.gap} mm off the opening and close its latches over centre.`
    : (() => { const d = l.doors[0]?.door; const rebate = d?.seat === 'rebate'; return ` Close every opening that is not coupled with its door (${l.doors.length}): the end bays’ side openings, and the start of a section the run before comes into from the side. Each is set into its opening: ${rebate ? `rout a ${d.rebate?.width ?? 0} × ${Math.round(d.rebate?.depth ?? 0)} rebate round the opening` : `glue and screw the ${DOOR.setIn.lap} × ${DOOR.setIn.stop} door stops inside it`}, screw a door turn button on its washer onto the frame at the middle of each side, pointing clear; set the panel in, turn every button over it and drop its locking pin. The side doors are the tunnel’s side access: lift one out to reach in.`; })();
  const couple = [
    latched.length ? `At ${latched.length === l.couplings.filter(c => c.stage === 5).length ? 'every coupling' : `${latched.length} square couplings`}${latched.some(c => c.seal) ? ' stick the E-profile seal round the flange’s face, lay the next piece' : ' lay the next piece'} ${l.gap} mm short of it, hook each latch’s link over its catch and press the lever down over centre.` : '',
    bolted.length ? `At ${latched.length ? `the ${bolted.length} mitred ${bolted.length === 1 ? 'joint' : 'joints'}` : 'every coupling'} push ${l.joint.boltsPerCoupling} M8 × 80 bolts through both flanges with a large washer each side and tighten the nuts.` : '',
  ].filter(Boolean).join(' ');
  const foot = l.pad
    ? `slide the head of an ${l.pad.screw.designation} into a printed foot, run an M8 nut up its shank and screw it into the insert nut by turning the foot`
    : 'screw the levelling foot’s stud into it';
  const fixing = supportFixingSteps(l);
  const sole = config.supportBase === 'self-standing' ? ` Each leg (or low bearer end) stands on a ${TUNNEL.sole.width} × ${TUNNEL.sole.thickness} sole on edge along the tunnel, two 6 × 100 screws up through it into the leg, with an insert nut and a foot near each of the sole’s ends (${l.pad ? `on ${l.pad.screw.designation} screws, short enough to stay inside the sole` : 'their studs inside the sole'}), so the support stands on its own.` : '';
  const level = l.pad
    ? 'Turn each printed foot by hand until the bearer top meets the line, then jam its nut up against the timber.'
    : 'Turn each foot on its stud until the bearer top meets the line, then jam the foot’s nut up against the timber.';
  const words = CLOSURE_WORDS[l.site.window.closure];
  const accessUse = l.doors.some(d => d.at !== 'start') ? ' The side doors are for reaching in from outside, to clean or to fetch a toy. Opening one opens the tunnel to the garden: secure the cats elsewhere first, with both ends’ ports shut, and turn every button back over the door, each pin dropped, before they return.' : '';
  return [
    { title: 'The site as it is', detail: `The window insert is fitted with its ${words.thing} ${words.shut} and the insert–tunnel coupling’s docking frame on its port; the enclosure stands with its rear port ${fmt(l.E[2] / 10)} cm above the grass. The ground between falls ${config.groundFall}% away from the wall and is uneven by up to ±${config.groundTolerance} mm.` },
    { title: 'Bed the slabs, build the supports', detail: `Bed a 30 × 30 cm paving slab in the grass under every foot position (${l.supports.length * 2}). For each support: screw an M8 insert nut into each leg’s foot end (or into the underside of a low bearer), ${foot}, screw the bearer down onto the legs and, on tall ones, the diagonal brace across. ${legs} trestles, ${blocks} low bearers.${sole}` },
    { title: 'Level the supports', detail: `Stretch a string line (or use a laser) at each bearer’s design height from the window floor. ${level} The feet, not the ground, set the heights.${fixing.support ? ` ${fixing.support}` : ''}` },
    { title: `Frame the ${wordList(['sections', ...(collar ? ['collars'] : [])])}`, detail: `On trestles beside the line (shown raised over it): screw the four rails between each section’s two end frames, flush with them, then lay the floor board into the rebates along the bottom rails and screw it down. ${collar ? 'Each angle collar is built the same way between two flanges set at its angle.' : config.angleJoint === 'mitred-ends' ? 'Sections at a joint have their flanges on the mitre: cut the rails and floor to the mitre angle.' : ''}${sideFrame} Sloped sections get cleats across the floor.${plates}${fixing.pieces ? ` ${fixing.pieces}` : ''}` },
    { title: `${l.mesh.soft ? 'Net the sections' : 'Mesh the sections'}${l.doors.length ? ', fit the doors' : ''}`, detail: `${meshingStep(l.mesh)} Leave each section’s end bay unmeshed at the sides${l.mesh.soft ? `: the hood ends ${TUNNEL.access.hoodTurn} mm down the top rails’ outer faces there` : ''}.${doorWords}` },
    { title: 'Lay and couple', detail: `Lay the pieces onto the supports${fixing.lay} from the window end: ${joints}. ${couple} (The tunnel–tunnel coupling page sets how.)` },
    { title: 'Fix down and dock', detail: `${fixing.hold} Close the latches between the first flange and the window insert’s docking frame (the insert–tunnel coupling page); nothing of the tunnel rests on the wall or the insert. ${l.couplings.find(c => c.stage === 6)?.kind === 'latched' ? 'Latch the last flange to the enclosure’s port flange, a standard port like every other' : `Bolt the last flange to the enclosure’s port flange (${l.joint.boltsPerCoupling} bolts)`}. Then open the cat ports at both ends: at each, ${words.open}. Before any part of the tunnel is uncoupled again, shut both ends’ ports first: at each, ${words.close}.${accessUse}` },
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
  if (m.kind === 'post') return { length: v1 - v0, cut: `${Math.round(v1 - v0)} long, square ends` };
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
  const ported = l.pieces.some(p => p.sidePort && of(p.id));
  for (const m of l.members.filter(q => of(q.piece))) {
    const piece = l.pieces.find(p => p.id === m.piece); const collar = piece?.kind === 'collar';
    const { cut } = memberCut(m);
    const name = m.kind === 'post' ? m.name : m.kind === 'flange' ? `Flange ${m.rect[3] - m.rect[2] > m.rect[1] - m.rect[0] ? 'stile' : 'head or sill'}` : m.kind === 'rail' ? (collar ? 'Collar rail' : 'Section rail') : (collar ? 'Collar floor' : 'Floor board');
    const use = m.kind === 'post' ? 'In the pocket each side of a side port, on the floor board under the top rail: closes the side behind the latches'
      : m.kind === 'flange' ? `Flange rings at both ends of every section and collar${ported ? ', and the side port’s on the rails of the section after each turn' : ''}: the standard port` : m.kind === 'rail'
      ? 'Along the corners, between the flanges' : 'The cat’s floor, on the bottom rails';
    timber(m.kind, name, `${m.section} · ${cut}`, use);
  }
  for (const c of l.cleats.filter(q => of(q.piece))) timber('cleat', 'Floor cleat', `${TUNNEL.cleat.size} × ${TUNNEL.cleat.size} · ${Math.round(c.length)} long`, 'Across the floor of sloped sections, for grip');
  if (supports) for (const s of l.supports) {
    const bevel = Math.abs(s.slope) > 0.05 ? `, top bevelled ${fmt(Math.abs(s.slope))}°` : '';
    if (s.kind === 'trestle') timber('bearer', 'Bearer', `${TUNNEL.bearer.width} × ${TUNNEL.bearer.depth} · ${Math.round(s.length)} long${bevel}`, 'Across the top of each trestle, under the flanges');
    else if (s.stands) timber('block', 'Low bearer, wide', `${Math.round(s.width)} × ${s.depth} (ripped to depth from a 200 wide beam) · ${Math.round(s.length)} long${bevel}`, 'Where the tunnel is too low for legs: wide along the tunnel, a foot near each corner, so it stands on its own');
    else timber('block', 'Low bearer', `${TUNNEL.bearer.width} × ${s.depth} (ripped from 45 × 95) · ${Math.round(s.length)} long${bevel}`, 'Where the tunnel is too low for legs: the feet go straight into it');
    for (const f of s.feet.filter(q => q.primary)) if (f.leg > 0) timber('leg', 'Leg', `${TUNNEL.leg} × ${TUNNEL.leg} · ${f.leg} long`, s.soles.length ? 'Under the bearer ends, on a sole' : 'Under the bearer ends; a foot in the bottom of each');
    if (s.soles.length) timber('sole', 'Sole', `${TUNNEL.sole.width} × ${TUNNEL.sole.thickness} on edge · ${TUNNEL.sole.length} long`, 'Along the tunnel under each leg (or low bearer end), a foot near each end: the support stands on its own', s.soles.length);
    if (s.hold.strap) timber('strap-cleat', 'Strap cleat', `${TUNNEL.fixing.strap.cleat.size} × ${TUNNEL.fixing.strap.cleat.size} · ${TUNNEL.fixing.strap.cleat.length} long`, 'On both ends of each bearer: the strap hooks under it', 2);
    const keepers = s.hold.buttons.length;
    if (keepers) timber('keeper', 'Keeper', `hardwood ${TUNNEL.fixing.keeper.out} × ${TUNNEL.fixing.keeper.high} · ${TUNNEL.fixing.keeper.length} long`, 'On each flange’s side just above a bearer: the turn button lies over it', keepers);
    if (s.brace) timber('brace', 'Brace', `${TUNNEL.brace.thickness} × ${TUNNEL.brace.width} · ${Math.round(len(sub(s.brace.to, s.brace.from)) + 80)} long, ends cut to the legs`, 'Diagonally across tall trestles');
  }
  // the template every ring of the tunnel is marked from (the page's drawing)
  if (supports) timber('template', 'Port marking template', `6 mm plywood · ${portOutline(l.w)} × ${portOutline(l.w)}, cut to the drawing`, 'Laid on every ring’s face to mark and pre-drill its bolt holes and latch stations: every port the same');
  // the doors: their frames and stops, alike counted together
  const accessLines = l.doors.filter(d => of(d.piece)).flatMap(d => doorBom(d.door, { prefix: 'door', where: d.at === 'start' ? 'Doors at the turns' : 'Side doors', mesh: l.mesh }));
  for (const line of accessLines.filter(q => q.group === 'Timber')) timber('access', line.name, line.size, line.use, line.quantity);
  const meshed = l.panels.filter(q => of(q.piece));
  if (meshed.length > 0 || accessLines.some(q => q.group === 'Mesh')) lines.push(meshRollLine(l.mesh));
  const span = (panel: MeshPanel) => { const [a, b, c, d] = panel.corners; return { long: Math.max(len(sub(b, a)), len(sub(c, d))), short: Math.min(len(sub(b, a)), len(sub(c, d))), across: len(sub(d, a)) }; };
  // a net: one hood a piece, as long as the piece's longer side and as wide as both sides and the roof together
  if (l.mesh.soft) for (const piece of l.pieces.filter(p => of(p.id))) {
    const spans = meshed.filter(q => q.piece === piece.id && !q.id.includes('-mesh-beside-')).map(span); if (spans.length === 0) continue;
    const long = Math.round(Math.max(...spans.map(s => s.long))); const short = Math.round(Math.min(...spans.map(s => s.short)));
    const size = `${long === short ? long : `${short}–${long}`} × ${Math.round(spans.reduce((sum, s) => sum + s.across, 0))} · ${meshCut(l.mesh)}`;
    const same = lines.find(line => line.name === 'Net hood' && line.size === size);
    const open = piece.kind === 'section';
    if (same) same.quantity++; else lines.push({ id: `mesh-${lines.length}`, group: 'Mesh', name: 'Net hood', quantity: 1, size, use: open ? 'In one piece down one side and over both top rails, turned down onto the far top rail over the side access or side port; its ends turned onto the flanges' : 'In one piece down one side, over both top rails and down the other; its ends turned onto the flanges' });
  }
  // beyond each section's end bay, a net piece fills the side between the bay post and the far end frame
  if (l.mesh.soft) for (const panel of meshed.filter(q => q.id.includes('-mesh-beside-'))) {
    const s2 = span(panel); const size = `${Math.round(s2.short)}–${Math.round(s2.long)} × ${Math.round(s2.across)} · ${meshCut(l.mesh)}`;
    const same = lines.find(line => line.name === 'Net, beside a side opening' && line.size === size);
    if (same) same.quantity++; else lines.push({ id: `mesh-${lines.length}`, group: 'Mesh', name: 'Net, beside a side opening', quantity: 1, size, use: 'Beside a side opening (between a mitred flange and the side-access panel, or beyond a side port’s pocket), stapled over every mesh to the rails and the flange' });
  }
  else for (const panel of meshed) {
    const [a, b, c, d] = panel.corners;
    const long = Math.round(Math.max(len(sub(b, a)), len(sub(c, d)))); const short = Math.round(Math.min(len(sub(b, a)), len(sub(c, d)))); const across = Math.round(len(sub(d, a)));
    const kind = panel.name.includes('roof') ? 'Roof mesh' : 'Side mesh';
    const size = `${long === short ? long : `${short}–${long}`} × ${across} · ${meshCut(l.mesh)}`;
    const same = lines.find(line => line.group === 'Mesh' && line.name === kind && line.size === size);
    if (same) same.quantity++; else lines.push({ id: `mesh-${lines.length}`, group: 'Mesh', name: kind, quantity: 1, size, use: kind === 'Roof mesh' ? 'Over the top rails, ends turned onto the flanges' : 'Down each side, rail to rail' });
  }
  // the doors' own mesh, alike counted together; their buttons and screws are hardware (`tunnelBom`)
  for (const line of accessLines.filter(q => q.group === 'Mesh')) {
    const same = lines.find(q => q.group === line.group && q.name === line.name && q.size === line.size);
    if (same) same.quantity += line.quantity; else lines.push({ ...line, id: `${line.id}-${lines.length}` });
  }
  // the cut list by kind of member, then longest first
  const kinds = ['Flange stile', 'Flange head or sill', 'Section rail', 'Collar rail', 'Edge strip', 'Corner block', 'Floor board', 'Collar floor', 'Floor cleat', 'Bearer', 'Low bearer', 'Low bearer, wide', 'Leg', 'Sole', 'Floor prop', 'Brace', 'Port marking template', 'Strap cleat', 'Keeper', 'Panel frame, upright', 'Panel frame, rail', 'Panel cover strip, upright', 'Panel cover strip, rail', 'Access stop, head and sill', 'Access stop, end',
    'Door ring, stile', 'Door ring, head or sill', 'Door cover strip', 'Door sheet', 'Floor plug', 'Door frame, upright', 'Door frame, rail', 'Door stop, head and sill', 'Door stop, side'];
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
  for (const [where, list] of [['Doors', l.doors]] as const) for (const a of list) {
    for (const f of a.door.fasteners) addPart(f.partId, `${where}: ${f.use.charAt(0).toLowerCase()}${f.use.slice(1)}`);
    for (const extra of doorLibraryParts(a.door)) if (extra.quantity) addPart(extra.partId, `${where}: ${extra.use.charAt(0).toLowerCase()}${extra.use.slice(1)}`, extra.quantity);
  }
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
  const doorLatches = l.doors.reduce((n, d) => n + d.latches.length, 0);
  const each = l.joint.latchesPerSide === 1 ? 'One' : l.joint.latchesPerSide === 2 ? 'Two' : 'Three';
  if (couplingLatches + doorLatches) lines.push(printedLatchLine(couplingLatches + doorLatches, [
    couplingLatches ? `${each} on each side of every square coupling` : '', doorLatches ? `${each.toLowerCase()} on each side of every stub’s end door` : '',
  ].filter(Boolean).join(', and ') + ': seen from outside, every port has the base plates on its left and the catch plates on its right'));
  const sealed = latched.filter(c => c.seal);
  const sealLength = sealed[0]?.seal?.length ?? 0;
  if (sealed.length) lines.push({ id: 'coupling-seal', group: 'Hardware', name: E_PROFILE_SEAL, quantity: sealed.length, size: `about ${PRINTED_LATCH_JOINT.seal.width} × ${PRINTED_LATCH_JOINT.seal.height} · ${Math.ceil(sealLength / 10) * 10} long each`, use: `Round each latched coupling’s flange face; squashed to the ${l.gap} mm gap` });
  // the doors' printed turn buttons, alike counted together (their pivots, washers and screws are counted above)
  for (const line of l.doors.flatMap(d => doorBom(d.door, { prefix: 'door', where: 'Doors', mesh: l.mesh })).filter(q => q.group === 'Hardware')) {
    const same = lines.find(q => q.name === line.name && q.size === line.size);
    if (same) same.quantity += line.quantity; else lines.push(line);
  }
  // how the tunnel is held on its supports: the custom parts (the dowels and screws are library parts, counted above)
  const FX = TUNNEL.fixing;
  const custom = (id: string, name: string, quantity: number, size: string, use: string) => { if (quantity > 0) lines.push({ id, group: 'Hardware', name, quantity, size, use }); };
  const straps = new Map<number, number>();
  for (const s of l.supports) if (s.hold.strap) { const length = Math.ceil(s.hold.strap.length / FX.strap.stretch / 50) * 50; straps.set(length, (straps.get(length) ?? 0) + 1); }
  for (const [length, quantity] of [...straps].sort((x, y) => x[0] - y[0])) custom(`strap-${length}`, 'EPDM tarp strap with S-hooks (custom)', quantity, `${FX.strap.width} mm wide · about ${length} mm unstretched, ${Math.round((FX.strap.stretch - 1) * 100)} % stretched when hooked`, 'Over the tunnel at a support, hooked under the cleats on the bearer’s ends');
  custom('turn-buttons', 'Turn button and post, printed (custom)', l.supports.reduce((n, s) => n + s.hold.buttons.length, 0), `PETG · post ${FX.post.thick} × ${FX.post.width} rising to the keeper’s top · button ${FX.button.width} × ${FX.button.thickness}, turning flat on a 4 × 25 screw`, 'On the bearer’s end beside each flange: the button turns over the flange’s keeper');
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
  const sideDoor = l.doors.find(d => d.at !== 'start'); const access = sideDoor ? doorFacts(sideDoor.door) : null;
  const sections = l.pieces.filter(p => p.kind === 'section').length; const ported = l.pieces.filter(p => p.sidePort).length;
  const placed = l.moved >= PORT_MOVED || l.facingMoved >= 0.05;
  return [
    { label: 'Window port floor · above the grass', value: `${cm(l.S[2])} cm`, from: { page: 'window-insert', settings: WINDOW_FLOOR_SETTINGS } },
    { label: 'Window port → enclosure port', value: `${cm(l.totalLength)} cm of tunnel` },
    ...(placed ? [{ label: 'Enclosure port · placed by whole elements', value: `${cm(l.E[0])} cm along, ${cm(l.E[1])} cm out${l.facingMoved >= 0.05 ? `, facing ${fmt(deg(Math.atan2(l.dE[0], l.dE[1])), 0)}°` : ''} · asked ${cm(l.asked[0])}, ${cm(l.asked[1])}${l.facingMoved >= 0.05 ? `, ${fmt(config.portFacing, 0)}°` : ''}: ${l.moved >= PORT_MOVED ? `${cm(l.moved)} cm off` : 'turned'}` }] : []),
    { label: 'Standard elements · pitch', value: `${wordList([...(sections ? [`${sections} ${sections === 1 ? 'section' : 'sections'}${ported ? ` (${ported} at the turns)` : ''}`] : []), ...(l.pieces.some(p => p.kind === 'collar') ? [`${l.pieces.filter(p => p.kind === 'collar').length} angle collars`] : [])])} · ${cm(l.pitch)} cm` },
    ...(l.doors.length ? [{ label: 'Doors · held by', value: `${l.doors.length} (${l.doors.filter(d => d.at !== 'start').length} in the end bays’ sides) · ${DOOR_FIXING_LABELS[l.joint.doorFixing].toLowerCase()}`, from: { page: 'tunnel-tunnel-coupling' as const, settings: ['doorFixing'] } }] : []),
    { label: 'Rise · floor to floor', value: l.slope ? `${l.rise >= 0 ? '+' : '−'}${cm(Math.abs(l.rise))} cm at ${fmt(Math.abs(l.slope.pitch))}°${Math.abs(l.rise) < NEARLY_LEVEL ? ' · nearly level: set the port floor level with the window port' : ''}` : 'level' },
    { label: 'Turns', value: turns.length ? turns.map(j => `${fmt(Math.abs(j.angle))}° ${side(j.angle)}`).join(', ') : 'straight' },
    { label: 'Supports', value: `${l.supports.length} (${tallest > 0 ? `longest leg ${cm(tallest)} cm` : 'low bearers, no legs'})` },
    { label: 'Foot travel · ground taken up', value: `${fmt(l.travel.max - l.travel.min, 0)} mm · ±${config.groundTolerance} mm` },
    ...(access ? [{ label: 'Side doors · end bays', value: `${l.doors.filter(d => d.at !== 'start').length} · ${access.panel} · ${access.retention}` }] : []),
    { label: 'Cat ports at both ends · closed by', value: PORT_CLOSURE_LABELS[l.site.window.closure], from: { page: 'concept' as const, settings: [PORT_CLOSURE_SETTING] } },
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
  { key: 'portX', label: 'Port along the wall', group: 'Enclosure port (fixed interface)', help: 'Its centre from the window’s centre; + is to the right, seen from the garden. The tunnel is whole standard elements, so it ends as near here as they make it: the brief says where.', options: [], range: { min: -4000, max: 4000, step: 1, ...mm('cm') } },
  { key: 'portY', label: 'Port out from the wall', group: 'Enclosure port (fixed interface)', help: 'From the wall face to the port’s face, where the last flange couples on. The tunnel ends as near it as whole elements make it.', options: [], range: { min: 500, max: 8000, step: 1, ...mm('cm') } },
  { key: 'portFacing', label: 'Port faces', group: 'Enclosure port (fixed interface)', help: 'The way the tunnel runs into it, from straight out of the wall; + turned to the right. The turns follow. (With side-port turns it is a choice: straight out, or along the wall either way.)', options: [], range: { min: -120, max: 120, step: 1, ...mm('°') }, when: c => c.angleJoint !== 'side-port' },
  { key: 'portFacing', label: 'Port faces', group: 'Enclosure port (fixed interface)', when: c => c.angleJoint === 'side-port',
    help: 'The way the tunnel runs into it. Side-port turns are 90°, so the port faces straight out from the wall or along it, to the right or to the left. (A facing saved at another angle is taken as the nearest of these.)',
    options: [{ value: -90, label: 'Along the wall, to the left (−90°)' }, { value: 0, label: 'Straight out from the wall (0°)' }, { value: 90, label: 'Along the wall, to the right (90°)' }] },
  { key: 'portLevel', label: 'Port floor', group: 'Enclosure port (fixed interface)', help: 'Level with the window port follows the window insert wherever its clamps put the port’s floor, so the tunnel stays level when the insert changes.',
    options: [{ value: 'window', label: 'Level with the window port' }, { value: 'own', label: 'At its own height' }] },
  { key: 'portHeight', label: 'Port floor height', group: 'Enclosure port (fixed interface)', help: 'The enclosure’s threshold above the grass at the wall. The window port’s floor is set by the window insert; the tunnel climbs or falls the difference.', options: [], range: { min: 150, max: 1400, step: 0.5, ...mm('cm') }, when: c => c.portLevel === 'own' },
  { key: 'approach', label: 'Straight out from the wall', group: 'Route', help: 'Before the first turn, measured from the wall to where the centre lines meet.', options: [], range: { min: 300, max: 5000, step: 10, ...mm('cm') },
    when: c => c.angleJoint !== 'side-port' || squareRoute(c).uses.includes('approach') },
  { key: 'final', label: 'Straight into the port', group: 'Route', help: 'After the last turn, square to the port.', options: [], range: { min: 300, max: 5000, step: 10, ...mm('cm') },
    when: c => c.angleJoint !== 'side-port' },
  { key: 'slopeLeg', label: 'Climb in', group: 'Route', help: 'The leg that climbs (or falls) to the port’s height, between two bends, with level runs either side.',
    options: [{ value: 'approach', label: 'The run out from the wall' }, { value: 'middle', label: 'The middle run' }, { value: 'final', label: 'The run into the port' }] },
  { key: 'maxSlope', label: 'Steepest slope', group: 'Route', help: 'Cats manage 25° on cleats; gentler is kinder to old cats. A small climb uses a shallower slope over a short run.',
    options: [10, 15, 20, 25].map(v => ({ value: v as TunnelConfig['maxSlope'], label: `${v}°` })) },
  { key: 'angleJoint', label: 'Turns and bends', group: 'Joints', help: 'At a side port the run before couples its end onto a standard port in the side of the next run’s first section: a 90° turn with nothing cut to an angle, the section running on past the port by a short stub closed by a door. A collar is a short wedge between two square flanges, cut to any angle: every section stays a plain box. Mitred ends need no extra piece but cut the sections at a joint to the angle, and are not standard ports. Bends into and out of a climb are collars, unless the turns are mitred.',
    options: [{ value: 'side-port', label: 'Side ports (90°)' }, { value: 'angle-collar', label: 'Angle collars (any angle)' }, { value: 'mitred-ends', label: 'Mitred ends, bolted' }] },
  { key: 'mesh', label: 'Mesh', group: 'Sections', help: 'Soft cat netting goes over each section as one hood, pulled taut over the roof, with a staple over every mesh of its cut edges. Welded wire mesh is stiff and bite-proof: three panels a section, stapled every 15 cm. Either is one roll from the parts library.',
    options: CATIO_MESHES.map(value => ({ value, label: MESH_LABELS[value] })) },
  { key: 'sectionLength', label: 'Longest section', group: 'Sections', help: 'In pitches: the shortest section that takes a side port and a coupling’s gap, about 58 cm. Every section is a whole number of them. Each run’s pitches are shared among as few sections as take them: shorter ones are lighter to carry and need more supports.',
    options: ([1, 2, 3, 4] as const).map(v => ({ value: v, label: `${v} ${v === 1 ? 'pitch' : 'pitches'} (about ${v * 58} cm)` })) },
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
  ...supportControls<TunnelConfig>('Supports'),
];

/**
 * A route's enclosure port moved to where its whole elements end, to the millimetre: so that a preset (or the defaults) shows no
 * port placed elsewhere than asked.
 */
export function placedRoute(config: TunnelConfig, site: TunnelSite = tunnelSite(), joint: TunnelCouplingConfig = savedTunnelCoupling()): TunnelConfig {
  const l = tunnelLayout(config, site, joint);
  return { ...config, portX: Math.round(l.E[0]), portY: Math.round(l.E[1]), ...(config.angleJoint === 'side-port' ? { portFacing: squareFacing(config.portFacing) } : {}) };
}

/** Ready-made routes besides the defaults, their ports where whole elements end. Level ones keep the port level with the window port, whatever the insert's clamps make it. */
export const TUNNEL_PRESETS: SubassemblyPreset<TunnelConfig>[] = [
  { id: 'straight', label: 'Straight', description: 'Straight out from the window to a port at the same height: no turns, no bends, square sections only.',
    config: () => placedRoute({ ...TUNNEL_DEFAULT, portX: 0, portY: 2500, portFacing: 0, portLevel: 'window' }) },
  { id: 'right-angle', label: '90° turn right', description: 'Out from the wall, one side port turning 90° to the right, then along the wall to a port at the same height.',
    config: () => placedRoute({ ...TUNNEL_DEFAULT, portX: 2200, portY: TUNNEL.wallGap + 1000, portFacing: 90, portLevel: 'window', approach: 1000, final: 1000 }) },
  { id: 'rising', label: 'Rising', description: 'Straight out to a door 90 cm above the grass: a climb at up to 20°, level runs either side.',
    config: () => placedRoute({ ...TUNNEL_DEFAULT, portX: 0, portY: 4000, portFacing: 0, portHeight: 900, slopeLeg: 'middle' }) },
];

/** How a section is meshed, for the assembly steps: a net as one hood held at every mesh of its cut edges, welded mesh as three stapled panels. */
export function meshingStep(mesh: CatioMeshSpec): string {
  return mesh.soft
    ? `Cut one piece of net for each section with scissors: as long as the section between its flanges plus a turn onto each, and wide enough to run down one side, over both top rails and down the other. Lay it over the section as a hood, pull it taut and staple it along both top rails every ${TUNNEL.staplePitch / 10} cm. Then pull each side down and put a staple over every mesh (${mesh.opening / 10} cm) along the bottom rails and where its ends turn onto the flanges: a net keeps a cat in only where every mesh of its edge is held.`
    : `Staple the side and roof mesh to the rails and turn its ends onto the flanges, stapling every ${TUNNEL.staplePitch / 10} cm.`;
}

/**
 * A saved tunnel, snapped to the standard elements on load: a longest section saved in millimetres (before sections came in whole
 * pitches) becomes the nearest whole number of pitches. Its route is laid out with whole elements like any other, and the brief says
 * where that puts the enclosure port. A tunnel saved with cube corners turns at side ports instead, the same right angles; its
 * straight runs of cubes (no longer offered) are long sections.
 */
export const parseTunnel = (raw: unknown) => {
  const saved = raw && typeof raw === 'object' && !Array.isArray(raw) ? { ...raw as Record<string, unknown> } : raw;
  if (saved && typeof saved === 'object') {
    const record = saved as Record<string, unknown>;
    if (typeof record['sectionLength'] === 'number') {
      const length = record['sectionLength'];
      if (length >= 100) record['sectionLength'] = Math.min(4, Math.max(1, Math.round(length / 500)));
    }
    if (record['angleJoint'] === 'cube-corner') record['angleJoint'] = 'side-port';
    delete record['straights'];
  }
  return parseControlled(TUNNEL_DEFAULT, TUNNEL_CONTROLS, saved);
};

export const TUNNEL_DECISIONS: DesignDecision[] = [
  { title: 'Side doors in every section’s end bay', parameter: 'Longest section',
    choice: `Every section starts with a square end bay: a ${F} × ${T} bay post on each side, one opening on from the start frame, so that both sides of the bay are openings framed like the ends. An opening that is not coupled is closed by the standard set-in door, its turn buttons on the frame. At a turn the run before butts its end into one of them.`,
    why: 'This is how the PawHut tunnel makes an L: a door is taken out of one module’s side, beside its end, and the next module’s end butts into the opening. One opening, one frame and one door everywhere, so any end meets any side; and the side doors are the tunnel’s side access, for reaching in to clean or to fetch a toy.' },
  { title: 'A net hood over every section', parameter: 'Mesh',
    choice: `Soft cat netting (${catioMesh('netting').part.title}), one piece a section: down one side, over both top rails and down the other. Its cut edges, along the bottom rails and on the flanges, get a staple over every mesh; over the top rails it is stapled every ${TUNNEL.staplePitch / 10} cm. Welded wire mesh, in three stapled panels, remains selectable.`,
    why: 'A net cannot span a roof like stiff mesh: laid as a flat panel it would sag between the rails. As one hood it is pulled taut over the two top rails by its own sides, has no seam at the roof for a paw to open, and takes two cuts instead of six. Its edge opens between fixings a hand apart, so every mesh of a cut edge is stapled.' },
  { title: 'Turns on the level, climbs in a straight line', parameter: 'Climb in',
    choice: 'The route turns only where it is level and climbs only where it runs straight: one sloped run between two vertical bends, inside one leg, with level runs before and after it.',
    why: 'A joint that turns and climbs at once is a compound mitre: the two sections would meet with one rolled against the other and the floor tilted sideways. Kept apart, every joint is a plain mitre about one axis, every floor stays level across, and the angles are exact. The slope is the steepest allowed (20° by default) so the climb is short; a small climb gets a shallower slope over a 15 cm run.' },
  { title: 'Standard elements, every one ending in the standard port', parameter: 'Longest section',
    choice: `Every piece ends in the same square port (catioPort.ts): the clear opening in a ${T} × ${F} flange ring, its latch and bolt stations the same on all four sides, and seen from outside its latches’ base plates on its left and their catch plates on its right. Every section is a whole number of pitches long: the shortest section that takes a side port (${sidePortLength(300) / 10} cm for a 30 cm opening) and a coupling’s gap.`,
    why: 'With one port, and base and catch on fixed sides of it, any element couples to any other, and to the window insert’s docking frame and the enclosure’s port: two ports facing each other have a base across from every catch, whatever they belong to. Whole elements mean nothing is cut to fit a route, so the tunnel ends where its elements end: the brief says how far that is from where the enclosure port was asked, and the defaults and presets are set there.' },
  { title: 'Turns into a side opening, angle collars at the bends', parameter: 'Turns and bends',
    choice: `At every turn the run before butts its end into a side opening of the next run’s first section: the end bay’s side, framed ${F} mm all round like an end, so the two frames meet face to face across the coupling’s gap. Its latches lie on the head, across the joint, since there the section’s own sides flank its posts; the shared bearer locates the bottom. A right angle, so the route runs out from the wall, along it and out again, square to the window and the port. The bends into and out of a climb are short wedge-shaped angle collars. Angle collars at the turns too (any angle up to 135°), or mitred ends, remain selectable.`,
    why: 'Flush boxes that butt together, end to end or an end into a side opening, are how commercial cat tunnels (PawHut, Omlet, Somerzby, Coziwow) are joined: nothing stands proud of the tunnel and nothing is cut to an angle. It replaced first cube corners, then a ring on the side with latch pockets and a stub, both bulky. A collar keeps every section a plain box, and only the small collars are cut to angles: a climb needs them, since a side opening only turns on the level. Mitred ends (up to 90°) save the collars but cut the two sections at each joint to the angle, and are not standard ports.' },
  { title: 'Flange couplings: latched, or bolted', from: { page: 'tunnel-tunnel-coupling', settings: ['mechanism', 'latchesPerSide', 'boltsPerCoupling', 'seal'] },
    choice: `Every element ends in a ${T} × ${F} flange ring that stands ${T} mm proud of the mesh. By default neighbours are joined by printed toggle latches on the rings’ outer sides (2 each side), across a ${PRINTED_LATCH_JOINT.gap} mm gap with an EPDM E-profile seal; or they are bolted face to face through both rings with ISO 4017 M8 × 80 bolts, ISO 7093 large washers and ISO 4032 nuts (8 per coupling, 2 on each side). The tunnel–tunnel coupling page sets which, for the enclosure end too. Mitred joints are bolted either way.`,
    why: 'Latches close by hand and leave nothing loose in the grass; bolts outside the mesh are reached with a 13 mm spanner, have a rated hold, and are all library parts (80 mm grips 2 × 30 mm of flange, two washers and the nut with the thread through). Every run is whole elements and the gaps between them. A mitre’s two flanges are not square to the runs, so their side faces do not line up for a latch. The window end is not bolted: the insert only presses on the recess and must not carry the tunnel, so the first flange stands 10 mm off the wall on its own support and is latched, without tools, to a docking frame on the insert (the insert–tunnel coupling page), set out to the standard port’s stations.' },
  { title: 'Levelling feet on every support', parameter: 'Uneven by up to',
    choice: 'A support under the wall end, the port end, every coupling and every joint. Each stands on two printed feet (the pressure-pad model, 40 mm, PETG) on ISO 4017 M8 × 80 screws, in DIN 7965 insert nuts, on paving slabs; Ganter GN 343.2 levelling feet remain selectable. Legs are cut to the designed fall of the ground; the feet are set to mid-travel there.',
    why: 'Nothing is assumed level. A printed foot’s screw may run from the lock nut’s height (6.8 mm) out to its length less the foot’s 3 mm lip and the insert nut (59 mm), so each foot takes up about ±26 mm of slab height (a 40 mm Ganter foot’s stud ±27 mm); the page checks every foot against the chosen tolerance, and its scene sets each foot to the uneven ground it stands on. Slabs stop the feet sinking into grass. Where the tunnel is too low for legs, the feet screw straight into a bearer ripped to depth.' },
  { title: 'Held on the supports, but not for good', parameter: 'Held on the supports by',
    choice: `Five ways, the screws by default: 6 × 100 screws up through each bearer into the flanges (the original); a rubber tarp strap over each support, hooked under a cleat on each bearer end; two ${TUNNEL.fixing.dowel.into * 2} mm parallel pins under each flange, half in the bearer; turn buttons on posts at the bearer’s ends, turned flat over keepers on the flanges; or gravity only.`,
    why: 'Screws bind the sections to the supports: every move means unscrewing from below, and re-driven screws hold less. Dowels let a section lift straight off and keep a trestle upright, but hold nothing down; the strap and the buttons also hold the tunnel down, without tools, and each belongs to one section or one support, so any section lifts off on its own. The buttons fit only under flanges flush with the bearer’s ends. A button turns flat, about a vertical screw, so it slides over its keeper and holds it down without ever swinging into it; a button turning on the flange’s side would swing its foot through the keeper it hooks. Rejected: a printed cradle on the bearer (it locates no better than dowels and is hard to print in one piece) and an upright printed toggle latch (its plate is wider than one flange, so it would span two sections and tie them together). Where a fixing does not fit, and with gravity only, the support must stand on its own: the page says which.' },
  { title: 'Trestles, or supports that stand on their own', parameter: 'Supports stand',
    choice: `By default each support is a trestle: a bearer on two legs across the tunnel, each leg on one foot. Self-standing: each leg (or a low bearer’s end) stands on a ${TUNNEL.sole.width} × ${TUNNEL.sole.thickness} sole on edge, ${TUNNEL.sole.length} long, along the tunnel, screwed up into it, with a foot near each end, both on the one slab.`,
    why: `Along the tunnel a trestle is only ${TUNNEL.bearer.width} mm wide on one foot per leg: it stands because it is fixed to the tunnel. With soles it stands on its own, so supports can be set out and levelled first and sections lifted on and off freely. Each foot’s insert nut and screw sit in the sole, not in a leg above it, so the sole is deep enough (${TUNNEL.sole.thickness} mm) to keep the screw’s tip inside it over its whole travel, and a printed foot takes the shortest library screw that gives the travel the ground needs (M8 × 60 for ±10 mm; M8 × 80, its tip held inside, for ±15 and ±20). A sole costs ${TUNNEL.sole.thickness} mm of height: a support too low for it, such as the low bearers near the wall, is reported.` },
  { title: 'The enclosure is a fixed interface', parameter: 'Port floor height',
    choice: 'The enclosure is not designed here: only its rear port is, by where it is, which way it faces, its floor height and a standard port to couple to.',
    why: 'The tunnel runs from both ports: the window port’s floor follows the window insert as set on its page, the enclosure’s from these values. Its door can be higher or lower than the window; the tunnel climbs or falls the difference exactly. Along and out from the wall it ends where its whole elements end, as near the port as they come. “Level with the window port” keeps the two floors equal when the insert’s clamps move the window port’s floor, instead of leaving a few millimetres to climb.' },
];
