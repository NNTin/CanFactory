import { dimensionOf, findPart, PRESSURE_PAD_SURFACES, pressurePadMinDiameter, pressurePadMinHeight, WINDOW_INSERT_FOOT, WINDOW_INSERT_HARDWARE as HW, WINDOW_INSERT_PAD, windowInsertFeet, windowInsertPadScrews, type Part, type PressurePadSurface } from '@canfactory/contracts';
import { CATIO, CATIO_DERIVED, type CatioView } from './catioDesign.ts';
import { validateWindowProfile, WINDOW_PROFILE_DEFAULT, WINDOW_PROFILE_RANGES, windowFrame, type WindowProfile } from './catioWindow.ts';
import { loadCatioSettings, type CatioMode } from './catioSettings.ts';
import { fastenersAlong, parseControlled, type AssemblyStep, type BomLine, type CameraPreset, type DesignDecision, type SubassemblyControl, type V3 } from './catioSubassembly.ts';

/**
 * The window insert: the removable timber collar that sits in the exterior window recess, its mesh, and the clamps that hold
 * it there without drilling: pressed into the recess, or hung on the window frame's lip like an insect screen. Millimetres; X along the wall, +Y outdoors, Z up; grass Z=0, exterior wall face Y=0, as in
 * catioDesign.ts. The layout below is the one source for the 3D scene, the parts list and the tests.
 */
export interface WindowInsertConfig {
  /** How the collar's four members meet at its corners. */
  cornerJoint: 'half-lap' | 'butt-screwed';
  /** How the cat port's transom and jambs meet the collar (with tunnel only). */
  junctionJoint: 'housed' | 'butt-screwed';
  /** How the wire mesh is held on the timber. */
  meshFixing: 'staples-and-battens' | 'staples' | 'battens';
  /** Greatest spacing of staples and batten screws along a fixed edge. */
  fixingPitch: 100 | 150 | 200;
  /** How the insert is held: pressed into the recess, or hung on the window frame's outer lip (and standing on its feet). */
  attachment: 'spreader-feet' | 'folding-wedges' | 'frame-hooks';
  /** Hung on the window frame: how far the collar overlaps the frame's face beyond the lip's tips, at the head and sides. */
  frameOverlap: 10 | 15 | 20 | 25;
  /** Clamps (or wedge pairs) along each side of the collar. */
  clampsPerSide: 2 | 3;
  /** Spreader feet: printed pressure pads on library screws, or Ganter levelling feet. */
  clampPad: 'printed' | 'ganter';
  /** Printed pads: from the pad's back to its sole, in mm. It sets the clamp gap. */
  padHeight: number;
  /** Printed pads: the sole that presses on the reveal. */
  padSurface: PressurePadSurface;
  /** Foot diameter of the spreader and bearing feet (or pads). */
  footDiameter: 25 | 32 | 40;
  /** The window as it is (catioWindow.ts): its fixed frame's width from outside, its lip, the seal gap and its depth. */
  frameFace: number; frameLip: number; sealGap: number; frameDepth: number;
}

export const WINDOW_INSERT_DEFAULT: WindowInsertConfig = {
  cornerJoint: 'half-lap', junctionJoint: 'housed', meshFixing: 'staples-and-battens', fixingPitch: 150,
  attachment: 'spreader-feet', frameOverlap: 15, clampsPerSide: 2, clampPad: 'printed', padHeight: 24.5, padSurface: 'grooved', footDiameter: 32,
  ...WINDOW_PROFILE_DEFAULT,
};

/** The window's profile, as the insert's settings hold it. */
export const windowProfileOf = (config: WindowProfile): WindowProfile => ({ frameFace: config.frameFace, frameLip: config.frameLip, sealGap: config.sealGap, frameDepth: config.frameDepth });

/** The settings that move the cat port's floor (the clamp gap sets it), which the tunnel and the coupling start from. */
export const WINDOW_FLOOR_SETTINGS: (keyof WindowInsertConfig)[] = ['attachment', 'clampPad', 'padHeight', 'footDiameter'];

/** The pad heights offered, in mm: at least what holds the thrust pad's lock nut over its floor and grooves. */
export const PAD_HEIGHT = { min: 18, max: 40, step: 0.5 } as const;

/** Fixed sizes of the insert. The collar section is the concept's (catioDesign.ts); the rest are this design's defaults. */
export const INSERT = {
  member: CATIO.collarMember, depth: CATIO.collarDepth, y: CATIO.collarY,
  /** Cat port transom and jambs (with tunnel), and the cover battens. */
  portMember: 40, batten: { width: 40, thickness: 15 },
  threshold: 18,
  /** How far each spreader foot is turned out from the collar to bear on the reveal. */
  travel: WINDOW_INSERT_FOOT.travel,
  /** Gap all round for folding wedges, and the wedges: length, width and thick end. The pair is driven 2 mm proud. */
  wedgeGap: 16, wedge: { length: 150, width: 40, thickness: 14 },
  /** Direct: how far the passage sleeve runs out from the collar towards the enclosure's rear portal. */
  sleeve: 90,
  /** Depth of the housings the transom and jambs sit in. */
  housing: 10,
  /** With tunnel: the cat gate's middle this far out from the collar's back, and its latch box (x, y, z) this far behind the gate. */
  gate: { y: 14, latchY: 16, latch: [42, 20, 12] },
  mesh: { opening: CATIO.meshOpening, wire: CATIO.wire, overlap: 30 },
} as const;

/**
 * Hung on the window frame: how the screen hooks sit. Once the feet stand, the short hooks' turned strips clear the sill lip's tip by
 * `clearance`, so the feet carry the insert and the hooks only keep it on the frame. Each barb lies in the seal gap, `gap` clear of
 * the lip's back and of the closed sash, and reaches at least `engage` behind the lip. To hang it, the insert is lifted by the short
 * hooks' reach behind the lip and `clearance` more; the long hooks' strips stay `clearance` below the head lip's tip meanwhile.
 */
export const HOOK_FIT = { clearance: 1, gap: 0.5, engage: 3 } as const;

/** The existing window the insert fits, as the whole-catio concept assumes it. */
export interface WindowSpec {
  glassWidth: number; glassHeight: number; sashWidth: number; sashHeight: number;
  /** The exterior recess (wall opening) the insert sits in, and its floor (the exterior sill). */
  openingWidth: number; openingHeight: number; recessFloor: number;
  sill: number;
  /** The window's frame and sash as they really are (catioWindow.ts). */
  profile: WindowProfile;
  /** The cat port's clear size, with tunnel only. */
  tunnel: { width: number; height: number } | null;
}

/**
 * Direct uses the original fixed sizes; with tunnel follows the window and tunnel saved on the catio concept page. Either way the
 * window's frame profile is the one set on this page (`config`, the defaults when absent).
 */
export function windowFor(variant: CatioMode, config: WindowProfile = WINDOW_INSERT_DEFAULT): WindowSpec {
  const profile = windowProfileOf(config);
  if (variant === 'direct') return {
    glassWidth: CATIO.glass, glassHeight: CATIO.glass, sashWidth: CATIO.sash, sashHeight: CATIO.sash,
    openingWidth: CATIO.fixedFrame, openingHeight: CATIO.fixedFrame, recessFloor: CATIO_DERIVED.fixedBottom, sill: CATIO.sill, profile, tunnel: null,
  };
  const c = loadCatioSettings().config;
  return {
    glassWidth: c.glassWidth, glassHeight: c.glassHeight, sashWidth: c.sashWidth, sashHeight: c.sashHeight,
    // The modular scene's fixed frame is the sash + 45 mm a side; its floor sits 45 mm below the sill.
    openingWidth: c.sashWidth + 90, openingHeight: c.sashHeight + 90, recessFloor: CATIO.sill - 45, sill: CATIO.sill, profile,
    tunnel: { width: c.tunnelWidth, height: c.tunnelHeight },
  };
}

function part(id: string): Part {
  const found = findPart(id);
  if (!found) throw new Error(`The parts library has no ${id}.`);
  return found;
}
const dim = (p: Part, key: string) => dimensionOf(p, key);

export type Side = 'left' | 'right' | 'head' | 'sill';
export interface Box { size: V3; center: V3 }
export interface TimberPiece { id: string; component: string; name: string; section: string; length: number; cut: string; use: string; boxes: Box[] }
export interface FixedEdge { from: V3; to: V3; /** Covered by a cover batten in the batten options; otherwise always stapled. */ face: boolean; use: string }
export interface MeshPanel { id: string; name: string; width: number; height: number; center: V3; plane: 'xy' | 'xz' | 'yz'; edges: FixedEdge[] }
export interface Clamp { id: string; side: Side; kind: 'spreader' | 'bearing' | 'wedge'; /** On the collar's outer face. */ at: V3; /** Outwards, towards the reveal. */ normal: V3; /** Along the member. */ along: V3 }
/**
 * A screen hook, hung on the window frame: a strip screwed to the back of a stile, turned into the window under the lip's tip and
 * bent up (at the head) or down (at the sill) behind the lip. `boxes` are its leg, its turn and its barb.
 */
export interface Hook {
  id: string; side: 'left' | 'right'; end: 'head' | 'sill'; part: Part; x: number; boxes: Box[];
  /** The barb's faces along Y, and how far it reaches behind the lip past the lip's tip. */
  barb: { outer: number; inner: number; engage: number };
}
export interface Fastener {
  partId: string; component: 'corner-screws' | 'threshold-screws' | 'port-screws' | 'batten-screws' | 'staples' | 'hook-screws';
  at: V3; /** Driven in this direction from `at`. */ direction: V3; use: string;
  /** A staple's crown runs this way, across the wire it holds. */ across?: V3;
}

/** Every piece of the insert, placed in the recess (installed and tightened). */
export function windowInsertLayout(variant: CatioMode, config: WindowInsertConfig, window: WindowSpec = windowFor(variant, config)) {
  const { member: m, depth: D } = INSERT;
  const hung = config.attachment === 'frame-hooks';
  // Hung on the window frame, the collar's back lies on the frame's outer face; pressed into the recess, it stands clear of it.
  const frameOf = windowFrame(window);
  const yc = hung ? frameOf.face + D / 2 : INSERT.y;
  // feet: the spreaders and bearing feet in the recess, or (hung) only the bearing feet under the sill rail
  const spreader = config.attachment !== 'folding-wedges';
  const nut = part(HW.jamNut);
  // A spreader stud runs through the member, the travel and the two jammed nuts on its inner end (windowInsertFeet).
  const { spreader: spreaderFoot, bearing: bearingFoot } = windowInsertFeet(config.footDiameter);
  // Printed pads: a thrust pad on a lock nut at the tip of each spreader screw, a foot on each bearing screw's head.
  const screws = windowInsertPadScrews();
  const pad = spreader && config.clampPad === 'printed' ? {
    height: config.padHeight, diameter: config.footDiameter, surface: config.padSurface,
    thrustNut: part(WINDOW_INSERT_PAD.thrustNut), spreaderScrew: screws.spreader, bearingScrew: screws.bearing,
  } : null;
  const gap = spreader ? (pad ? pad.height : dim(spreaderFoot, 'l3')) + INSERT.travel : INSERT.wedgeGap;
  // Hung, the collar overlaps the frame's face beyond the lip's tips at the head and sides, and stands on its feet at the sill.
  const W = hung ? frameOf.lip.width + 2 * config.frameOverlap : window.openingWidth - 2 * gap;
  const z0 = window.recessFloor + gap;
  const H = hung ? frameOf.lip.top + config.frameOverlap - z0 : window.openingHeight - 2 * gap; const x0 = -W / 2;
  const Wi = W - 2 * m; const Hi = H - 2 * m;
  const yOut = yc + D / 2; const yIn = yc - D / 2;
  const floor = z0 + m + INSERT.threshold;
  const timber: TimberPiece[] = []; const fasteners: Fastener[] = []; const panels: MeshPanel[] = [];
  const section = `${m} × ${D}`;
  const box = (size: V3, center: V3): Box => ({ size, center });

  // Collar corners. Half-lap: every member runs the full size, halved at both ends (rails on the room side, stiles outside).
  const lap = config.cornerJoint === 'half-lap';
  const rail = (id: 'head' | 'sill', z: number) => {
    const name = `Collar rail, ${id}`;
    if (!lap) return timber.push({ id: `collar-${id}`, component: `collar-${id}`, name, section, length: Wi, cut: `${Wi} long, square ends`, use: 'Between the stiles, screwed through them', boxes: [box([Wi, D, m], [0, yc, z])] });
    return timber.push({ id: `collar-${id}`, component: `collar-${id}`, name, section, length: W, cut: `${W} long, ${D / 2} mm half-lap at both ends (room side kept)`, use: 'Full width, lapped under the stiles',
      boxes: [box([Wi, D, m], [0, yc, z]), ...[-1, 1].map(s => box([m, D / 2, m], [s * (W - m) / 2, yIn + D / 4, z]))] });
  };
  const stile = (id: 'left' | 'right', x: number) => {
    const name = `Collar stile, ${id}`;
    if (!lap) return timber.push({ id: `collar-${id}`, component: `collar-${id}`, name, section, length: H, cut: `${H} long, square ends`, use: 'Full height; the rails butt between', boxes: [box([m, D, H], [x, yc, z0 + H / 2])] });
    return timber.push({ id: `collar-${id}`, component: `collar-${id}`, name, section, length: H, cut: `${H} long, ${D / 2} mm half-lap at both ends (outdoor side kept)`, use: 'Full height, lapped over the rails',
      boxes: [box([m, D, Hi], [x, yc, z0 + H / 2]), ...[z0 + m / 2, z0 + H - m / 2].map(z => box([m, D / 2, m], [x, yOut - D / 4, z]))] });
  };
  rail('sill', z0 + m / 2); rail('head', z0 + H - m / 2); stile('left', x0 + m / 2); stile('right', -x0 - m / 2);
  for (const sx of [-1, 1]) for (const z of [z0 + m / 2, z0 + H - m / 2]) {
    const corner = sx < 0 ? (z < z0 + H / 2 ? 'bottom left' : 'top left') : (z < z0 + H / 2 ? 'bottom right' : 'top right');
    if (lap) {
      // two screws on the diagonal, from the outdoor face through both laps
      const s = part(HW.halfLapScrew);
      for (const k of [-1, 1]) fasteners.push({ partId: s.id, component: 'corner-screws', at: [sx * (W / 2 - m / 2) + k * 9, yOut, z + k * 9], direction: [0, -1, 0], use: `Half-lap, ${corner} corner` });
    } else {
      // two screws through the stile into the end grain of the rail
      const s = part(HW.buttScrew);
      for (const k of [-1, 1]) fasteners.push({ partId: s.id, component: 'corner-screws', at: [sx * W / 2, yc + k * 15, z], direction: [-sx, 0, 0], use: `Butt joint, ${corner} corner` });
    }
  }

  // The threshold covers the sill rail: the cat's floor, and a lid over the bearing-foot studs.
  const thresholdEnd = variant === 'direct' ? yOut + INSERT.sleeve : 0;
  timber.push({ id: 'threshold', component: 'threshold', name: 'Threshold board', section: 'Exterior board', length: Wi, cut: `${Wi} × ${thresholdEnd - yIn} × ${INSERT.threshold}`, use: 'On the sill rail, between the stiles',
    boxes: [box([Wi, thresholdEnd - yIn, INSERT.threshold], [0, (yIn + thresholdEnd) / 2, z0 + m + INSERT.threshold / 2])] });
  for (const x of spaced(Wi - 80, 3)) fasteners.push({ partId: HW.thresholdScrew, component: 'threshold-screws', at: [x, yc, floor], direction: [0, 0, -1], use: 'Threshold into the sill rail' });

  const o = INSERT.mesh.overlap; const faceY = yOut + INSERT.mesh.wire / 2;
  const edge = (from: V3, to: V3, face: boolean, use: string): FixedEdge => ({ from, to, face, use });
  const frameEdges = (left: number, right: number, bottom: number, top: number, use: string) => [
    edge([left, faceY, bottom], [right, faceY, bottom], true, use), edge([left, faceY, top], [right, faceY, top], true, use),
    edge([left, faceY, bottom], [left, faceY, top], true, use), edge([right, faceY, bottom], [right, faceY, top], true, use),
  ];
  let port: { width: number; height: number; transomZ: number } | null = null;
  if (variant === 'direct') {
    // A mesh passage sleeve continues the collar's opening towards the enclosure; its edges turn onto the collar face.
    const top = z0 + H - m; const y0 = yOut; const y1 = yOut + INSERT.sleeve;
    for (const side of [-1, 1]) panels.push({ id: `sleeve-${side < 0 ? 'left' : 'right'}`, name: `Passage sleeve, ${side < 0 ? 'left' : 'right'} side`, width: INSERT.sleeve, height: top - floor, center: [side * Wi / 2, (y0 + y1) / 2, (floor + top) / 2], plane: 'yz',
      edges: [edge([side * Wi / 2, faceY, floor], [side * Wi / 2, faceY, top], true, 'Turned onto the collar stile'), edge([side * Wi / 2, y0, floor], [side * Wi / 2, y1, floor], false, 'Along the threshold edge')] });
    panels.push({ id: 'sleeve-roof', name: 'Passage sleeve, roof', width: Wi, height: INSERT.sleeve, center: [0, (y0 + y1) / 2, top], plane: 'xy',
      edges: [edge([-Wi / 2, faceY, top], [Wi / 2, faceY, top], true, 'Turned onto the collar head')] });
  } else {
    const tunnel = window.tunnel ?? { width: 300, height: 300 };
    const w = tunnel.width; const h = tunnel.height; const pm = INSERT.portMember;
    const transomZ = floor + h; const housed = config.junctionJoint === 'housed'; const hd = INSERT.housing; const py = yOut - pm / 2;
    port = { width: w, height: h, transomZ };
    timber.push({ id: 'transom', component: 'port-frame', name: 'Port transom', section: `${pm} × ${pm}`, length: Wi + (housed ? 2 * hd : 0),
      cut: housed ? `${Wi + 2 * hd} long, ends into ${hd} mm housings in the stiles` : `${Wi} long, square ends`, use: 'Across the collar above the cat port',
      boxes: [box([Wi + (housed ? 2 * hd : 0), pm, pm], [0, py, transomZ + pm / 2])] });
    for (const side of [-1, 1]) timber.push({ id: `port-jamb-${side < 0 ? 'left' : 'right'}`, component: 'port-frame', name: `Port jamb, ${side < 0 ? 'left' : 'right'}`, section: `${pm} × ${pm}`,
      length: h + (housed ? hd : 0), cut: housed ? `${h + hd} long, top into a ${hd} mm housing in the transom` : `${h} long, square ends`, use: 'Beside the cat port, on the threshold',
      boxes: [box([pm, pm, h + (housed ? hd : 0)], [side * (w / 2 + pm / 2), py, floor + (h + (housed ? hd : 0)) / 2])] });
    const endScrew = part(HW.transomScrew);
    for (const side of [-1, 1]) for (const k of housed ? [0] : [-1, 1]) fasteners.push({ partId: endScrew.id, component: 'port-screws', at: [side * W / 2, py + k * 10, transomZ + pm / 2], direction: [-side, 0, 0], use: housed ? 'Transom, housed into the stile' : 'Transom, butt jointed to the stile' });
    // The jambs are screwed from below through the sill rail and threshold into their end grain.
    const jambScrew = part(HW.jambScrew);
    for (const side of [-1, 1]) for (const k of [-1, 1]) fasteners.push({ partId: jambScrew.id, component: 'port-screws', at: [side * (w / 2 + pm / 2) + k * 9, py, z0], direction: [0, 0, 1], use: 'Port jamb, from under the sill rail' });
    // Infill mesh on the outdoor face: left and right of the port up to the transom, and one panel above it.
    const left = x0 + m - o; const portLeft = -w / 2 - pm + o;
    const bottom = z0 + m - o; const middle = transomZ + o; const upper = transomZ + pm - o; const top = z0 + H - m + o;
    for (const side of [-1, 1]) {
      const s = -side; // the left panel is built from the left edge; the right one is its mirror
      panels.push({ id: `infill-${side < 0 ? 'left' : 'right'}`, name: `Infill mesh, ${side < 0 ? 'left' : 'right'} of the port`, width: portLeft - left, height: middle - bottom, center: [s * (left + portLeft) / 2, faceY, (bottom + middle) / 2], plane: 'xz',
        edges: frameEdges(Math.min(s * left, s * portLeft), Math.max(s * left, s * portLeft), bottom, middle, 'Over the collar, transom and port jamb') });
    }
    panels.push({ id: 'infill-top', name: 'Infill mesh above the port', width: Wi + 2 * o, height: top - upper, center: [0, faceY, (upper + top) / 2], plane: 'xz',
      edges: frameEdges(-Wi / 2 - o, Wi / 2 + o, upper, top, 'Over the collar and transom') });
    // Nothing continues the port to the wall face: a tunnel's docking frame (catioCoupling.ts) fits over the jambs and transom
    // and carries the passage on from there.
  }

  // Cover battens over the face edges: a frame round the collar, plus the transom and port jambs.
  const battens = config.meshFixing !== 'staples';
  const bt = INSERT.batten.thickness; const bw = INSERT.batten.width; const by = yOut + INSERT.mesh.wire + bt / 2;
  if (battens) {
    for (const [id, z] of [['head', z0 + H - m / 2], ['sill', z0 + m / 2]] as const) timber.push({ id: `batten-${id}`, component: 'cover-battens', name: `Cover batten, ${id}`, section: `${bw} × ${bt}`, length: W, cut: `${W} long`, use: `Over the mesh edge on the collar ${id}`, boxes: [box([W, bt, bw], [0, by, z])] });
    for (const side of [-1, 1]) timber.push({ id: `batten-${side < 0 ? 'left' : 'right'}`, component: 'cover-battens', name: `Cover batten, ${side < 0 ? 'left' : 'right'}`, section: `${bw} × ${bt}`, length: Hi, cut: `${Hi} long`, use: 'Over the mesh edge on the stile, between the head and sill battens', boxes: [box([bw, bt, Hi], [side * (W - m) / 2, by, z0 + H / 2])] });
    if (port) {
      const { width: w, transomZ } = port; const pm = INSERT.portMember;
      timber.push({ id: 'batten-transom', component: 'cover-battens', name: 'Cover batten, transom', section: `${pm} × ${bt}`, length: Wi, cut: `${Wi} long`, use: 'Over the mesh edges on the transom', boxes: [box([Wi, bt, pm], [0, by, transomZ + pm / 2])] });
      for (const side of [-1, 1]) timber.push({ id: `batten-jamb-${side < 0 ? 'left' : 'right'}`, component: 'cover-battens', name: `Cover batten, port jamb, ${side < 0 ? 'left' : 'right'}`, section: `${pm} × ${bt}`, length: transomZ - floor, cut: `${transomZ - floor} long`, use: 'Over the mesh edges on the port jamb', boxes: [box([pm, bt, transomZ - floor], [side * (w / 2 + pm / 2), by, (floor + transomZ) / 2])] });
    }
    const battenScrew = part(HW.battenScrew);
    for (const piece of timber.filter(t => t.component === 'cover-battens')) {
      const [b] = piece.boxes; if (!b) continue;
      const along = b.size[0] > b.size[2] ? 0 : 2; const length = b.size[along];
      for (const t of spaced(length - 40, fastenersAlong(length - 40, config.fixingPitch))) {
        const at: V3 = [...b.center]; at[along] += t; at[1] = by + bt / 2;
        fasteners.push({ partId: battenScrew.id, component: 'batten-screws', at, direction: [0, -1, 0], use: `Through the ${piece.name.toLowerCase()} and mesh` });
      }
    }
  }
  // Staples on the face edges in the staple options, and on every edge without a face for a batten in all options.
  const staple = part(HW.staple);
  for (const panel of panels) for (const e of panel.edges) if (!e.face || config.meshFixing !== 'battens') {
    const length = Math.hypot(e.to[0] - e.from[0], e.to[1] - e.from[1], e.to[2] - e.from[2]);
    const count = fastenersAlong(length, config.fixingPitch);
    const direction: V3 = e.face ? [0, -1, 0] : [0, 0, -1];
    const unit = [e.to[0] - e.from[0], e.to[1] - e.from[1], e.to[2] - e.from[2]].map(v => v / length) as V3;
    const across: V3 = [unit[1] * direction[2] - unit[2] * direction[1], unit[2] * direction[0] - unit[0] * direction[2], unit[0] * direction[1] - unit[1] * direction[0]];
    for (let i = 0; i < count; i++) fasteners.push({ partId: staple.id, component: 'staples', at: e.from.map((v, k) => v + ((e.to[k] ?? 0) - v) * i / (count - 1)) as V3, direction, across, use: `${panel.name}: ${e.use.toLowerCase()}` });
  }

  // Clamps on all four sides at the same fractions of each inner span; the sill's carry the weight.
  const fractions = config.clampsPerSide === 2 ? [0.2, 0.8] : [0.15, 0.5, 0.85];
  const clamps: Clamp[] = [];
  for (const [i, f] of fractions.entries()) {
    const x = -Wi / 2 + f * Wi; const z = z0 + m + f * Hi;
    const kind = (side: Side): Clamp['kind'] => spreader ? (side === 'sill' ? 'bearing' : 'spreader') : 'wedge';
    // hung on the window frame, only the bearing feet under the sill rail
    if (!hung) {
      clamps.push({ id: `left-${i}`, side: 'left', kind: kind('left'), at: [x0, yc, z], normal: [-1, 0, 0], along: [0, 0, 1] });
      clamps.push({ id: `right-${i}`, side: 'right', kind: kind('right'), at: [-x0, yc, z], normal: [1, 0, 0], along: [0, 0, 1] });
      clamps.push({ id: `head-${i}`, side: 'head', kind: kind('head'), at: [x, yc, z0 + H], normal: [0, 0, 1], along: [1, 0, 0] });
    }
    clamps.push({ id: `sill-${i}`, side: 'sill', kind: kind('sill'), at: [x, yc, z0], normal: [0, 0, -1], along: [1, 0, 0] });
  }

  // Hung on the window frame: a long hook at the head and a short one at the sill of each stile, on the stile's back where it lies
  // over the lip's opening. Each strip is turned into the window just inside the lip's tip and bent at `bend` (inner size), which
  // puts its barb in the middle of the seal gap, behind the lip and in front of the closed sash: the sash closes over it.
  const hooks: Hook[] = [];
  /** The bend (inner size), the lift to hang it, the turns' places on the stiles from the collar's top and bottom, the barbs' reach. */
  let hookFit: { bend: number; lift: number; headClear: number; fromTop: number; fromBottom: number; engage: { head: number; sill: number } } | null = null;
  if (hung) {
    const top = part(HW.hookTop); const bottom = part(HW.hookBottom); const screw = part(HW.hookScrew);
    const t = dim(top, 't'); const w = dim(top, 'w'); const l = dim(top, 'l');
    const { frameLip: X, sealGap: g } = window.profile;
    // the barb's lip-side face half the spare gap behind the lip's back; the bend is the inner size from the leg to it, to 0.5 mm
    const bend = Math.round((X + (g - t) / 2 - t) * 2) / 2;
    const yLeg = yIn - t; const outer = yLeg - bend; const inner = outer - t;
    const c = HOOK_FIT.clearance;
    const sillEngage = dim(bottom, 'h') - t - c;
    const lift = sillEngage + c; const headClear = lift + c;
    const round = (v: number) => Math.round(v * 10) / 10;
    hookFit = { bend, lift: round(lift), headClear: round(headClear), fromTop: round(headClear + config.frameOverlap), fromBottom: round(frameOf.lip.bottom + c - z0),
      engage: { head: round(dim(top, 'h') - t - headClear), sill: round(sillEngage) } };
    const lipX = frameOf.lip.width / 2;
    for (const sx of [-1, 1] as const) {
      // centred on the stile's part over the opening, between the lip's tip and the stile's inner edge
      const x = sx * (lipX + Wi / 2) / 2; const side = sx < 0 ? 'left' : 'right';
      const strip = (y0: number, y1: number, z0: number, z1: number): Box => box([w, y1 - y0, z1 - z0], [x, (y0 + y1) / 2, (z0 + z1) / 2]);
      // at the head: the turn's top face headClear below the lip's tip, the leg down the stile, the barb up behind the lip
      const zHead = frameOf.lip.top - headClear;
      hooks.push({ id: `hook-head-${side}`, side, end: 'head', part: top, x,
        boxes: [strip(yLeg, yIn, zHead - l, zHead), strip(inner, yLeg, zHead - t, zHead), strip(inner, outer, zHead - t, zHead - t + dim(top, 'h'))],
        barb: { outer, inner, engage: hookFit.engage.head } });
      // at the sill: the turn's underside `c` above the lip's tip, the leg up the stile, the barb down behind the lip
      const zSill = frameOf.lip.bottom + c;
      hooks.push({ id: `hook-sill-${side}`, side, end: 'sill', part: bottom, x,
        boxes: [strip(yLeg, yIn, zSill, zSill + l), strip(inner, yLeg, zSill, zSill + t), strip(inner, outer, zSill + t - dim(bottom, 'h'), zSill + t)],
        barb: { outer, inner, engage: hookFit.engage.sill } });
      // two screws through each leg's hole and slot, from the room side into the stile
      for (const [z, end] of [[zHead - l * 0.35, 'head'], [zHead - l * 0.8, 'head'], [zSill + l * 0.35, 'sill'], [zSill + l * 0.8, 'sill']] as const)
        fasteners.push({ partId: screw.id, component: 'hook-screws', at: [x, yLeg, z], direction: [0, 1, 0], use: `Screen hook at the ${end}, into the back of the ${side} stile` });
    }
  }

  return {
    variant, config, window, frame: frameOf, gap, W, H, Wi, Hi, x0, z0, yIn, yOut, floor, port, timber, panels, fasteners, clamps, hooks, hookFit,
    spreaderFoot, bearingFoot, pad, nut, insertNut: part(HW.insertNut),
  };
}
export type WindowInsertLayout = ReturnType<typeof windowInsertLayout>;

/** `count` positions spread evenly over `length`, centred on zero. */
function spaced(length: number, count: number): number[] {
  if (count <= 1) return [0];
  return Array.from({ length: count }, (_, i) => -length / 2 + i * length / (count - 1));
}

export function validateWindowInsert(variant: CatioMode, config: WindowInsertConfig, window: WindowSpec = windowFor(variant, config)): string[] {
  const errors: string[] = [...validateWindowProfile(window)];
  const l = windowInsertLayout(variant, config, window);
  const hook = l.hooks[0]; const fit = l.hookFit;
  if (hook && fit) {
    const { frameLip: X, sealGap: g, frameFace } = window.profile;
    const t = dimensionOf(hook.part, 't');
    if (X < dimensionOf(hook.part, 'x1') || X > dimensionOf(hook.part, 'x2')) errors.push(`The screen hooks bend for a frame lip ${dimensionOf(hook.part, 'x1')}–${dimensionOf(hook.part, 'x2')} mm thick, not ${X} mm.`);
    // the barb, as bent (to 0.5 mm), clear of the lip's back and of the closed sash's face
    if (Math.min(hook.barb.inner - l.frame.sashFace, l.frame.lipBack - hook.barb.outer) < HOOK_FIT.gap - 1e-9) errors.push(`The seal gap (${g} mm) is too narrow for the hooks’ ${t} mm strip: the sash would not close over them.`);
    if (Math.min(fit.engage.head, fit.engage.sill) < HOOK_FIT.engage) errors.push('The hooks would not reach far enough behind the frame’s lip.');
    if (frameFace - config.frameOverlap < fit.lift) errors.push(`Hanging the insert needs ${fit.lift} mm of room above the collar to lift it; it overlaps the frame too far.`);
    if (l.frame.lip.bottom - l.z0 < 8) errors.push('Standing on these feet, the collar does not reach over the frame below the lip’s tip: choose lower feet or pads.');
    // the cat gate's latch stands behind the collar's back, in front of the closed sash
    const latchBack = l.yIn + INSERT.gate.y - INSERT.gate.latchY - INSERT.gate.latch[1] / 2;
    if (l.port && latchBack - l.frame.sashFace < HOOK_FIT.gap) errors.push(`The cat gate’s latch needs ${Math.ceil(l.yIn - latchBack + HOOK_FIT.gap)} mm between the frame’s face and the closed sash; this window has ${l.frame.face - l.frame.sashFace} mm.`);
    if (INSERT.member - config.frameOverlap < dimensionOf(hook.part, 'w') + 4) errors.push('The collar overlaps the frame too far: the hooks need the stiles’ inner part over the window opening.');
  }
  if (l.W - 2 * INSERT.member < window.sashWidth * 0.6) errors.push('The collar opening is too narrow for this window.');
  if (l.port) {
    const { width: w, height: h } = l.port;
    if (w + 2 * INSERT.portMember > l.Wi - 2 * 60) errors.push('The cat port and its jambs must fit between the collar stiles and their clamps.');
    if (l.floor + 2 * h + 50 > l.z0 + l.H - INSERT.member - 40) errors.push('The sliding gate needs room above the port for its full travel inside the collar.');
  }
  const stud = dimensionOf(l.spreaderFoot, 'l1');
  if (config.attachment === 'spreader-feet' && !l.pad && stud < INSERT.member + INSERT.travel + 2 * dimensionOf(l.nut, 'm')) errors.push('No stud of this foot is long enough to pass the collar and take two nuts.');
  if (l.pad) {
    const shape = { surface: l.pad.surface, relief: WINDOW_INSERT_PAD.relief, fit: WINDOW_INSERT_PAD.fit };
    const least = Math.max(pressurePadMinHeight({ ...shape, padType: 'thrust' }, l.pad.thrustNut), pressurePadMinHeight({ ...shape, padType: 'foot' }, l.pad.bearingScrew));
    if (l.pad.height < least - 1e-9) errors.push(`A printed pad must be at least ${Math.ceil(least * 2) / 2} mm high to hold its nut or screw head.`);
    const narrowest = Math.max(pressurePadMinDiameter({ ...shape, padType: 'thrust' }, l.pad.thrustNut), pressurePadMinDiameter({ ...shape, padType: 'foot' }, l.pad.bearingScrew));
    if (l.pad.diameter < narrowest - 1e-9) errors.push(`A printed pad must be at least ${Math.ceil(narrowest)} mm across to hold its nut or screw head.`);
  }
  return errors;
}

/** Stage 0 is the window as it is; stages 1–3 happen on a bench outside, 4–6 at the window. */
export function windowInsertSteps(variant: CatioMode, config: WindowInsertConfig): readonly AssemblyStep[] {
  const joint = config.cornerJoint === 'half-lap'
    ? 'Lay the sill and head rails, laps facing outdoors. Glue the laps and press the stiles onto them from the outdoor side. Then drive two 4 × 50 screws into each corner from the outdoor face, one corner after another'
    : 'Stand the two stiles. Slide the head and sill rails in between them from the outdoor side. Then drive two 5 × 70 screws through each stile into the end grain of the rail';
  const hung = config.attachment === 'frame-hooks';
  const printed = config.attachment !== 'folding-wedges' && config.clampPad === 'printed';
  const fit = hung ? windowInsertLayout(variant, config).hookFit : null;
  const hookText = fit ? ` Then bend the four screen hooks with pliers at ${fit.bend} mm (the set’s gauge has a scale): two long ones for the head, two short ones for the sill. Screw each to the back of a stile, where it lies over the window opening, with two 3 × 16 screws from the room side: the long ones with their bends ${fit.fromTop} mm below the collar’s top and their tips pointing up, the short ones with their bends ${fit.fromBottom} mm above its bottom and their tips pointing down.` : '';
  const clamp = hung
    ? (printed
      ? 'Under the sill rail, at every foot: (1) screw an M8 insert nut into the rail’s underside; (2) slide a hexagon head screw’s head into a printed foot and screw it up into the insert nut by turning the foot.'
      : 'Under the sill rail, at every foot: (1) screw an M8 insert nut into the rail’s underside; (2) screw a short-stud levelling foot into it from below until the foot’s hexagon touches the rail.') + hookText
    : printed
    ? 'In this order, at every clamp: (1) screw an M8 insert nut into the outer face of the collar. Under the sill rail: (2) slide a hexagon head screw’s head into a printed foot and screw it up into the insert nut by turning the foot. In the stiles and head: (2) run a lock nut onto a long hexagon head screw and screw it through the member from inside, out through the insert nut; (3) run a nylon-insert lock nut onto its tip from outside until the tip is flush with it; (4) slide a printed thrust pad onto that nut from the side and press it past the bumps at the slot’s mouth.'
    : config.attachment === 'spreader-feet'
    ? 'In this order, at every clamp: (1) screw an M8 insert nut into the outer face of the collar; (2) screw the levelling foot’s stud through it from outside until the foot’s hexagon touches the collar. Short studs go under the sill rail, long ones in the stiles and head. (3) On each long stud’s inner end, run on the foot’s own nut from inside, then (4) a second M8 nut, and jam the two together.'
    : 'At every clamp, set the inner wedge against the collar from outside, then lay the outer wedge loosely on it, thin end to thick end. Tape each pair so none can fall when the insert is lifted in.';
  const mesh = config.meshFixing === 'staples' ? 'staple its edges' : config.meshFixing === 'battens' ? 'press the cover battens over its edges and screw them on from the outdoor face' : 'staple its edges, then press the cover battens over them and screw them on from the outdoor face';
  const fill = variant === 'direct'
    ? `Lower the threshold onto the sill rail and screw it down from above. Slide the passage sleeve mesh on from outdoors and ${mesh}.`
    : `Lower the threshold onto the sill rail and screw it down from above. Slide the transom into its stile housings from outdoors, then each jamb up into the transom. Screw the transom through the stiles and the jambs up from under the sill rail. Offer the infill mesh from outdoors and ${mesh}.`;
  const tighten = hung
    ? `${printed ? 'Turn each printed foot by hand' : 'Turn each foot’s hexagon with a 13 mm spanner'} until the short hooks stand ${HOOK_FIT.clearance} mm clear of the sill lip: the feet carry the insert, the hooks only keep it on the frame. Close the sash: the hooks’ tips lie in the seal gap, so it closes and locks as over an insect screen; the seal is pressed locally at the four hooks.`
    : printed
    ? 'From inside, through the open window: put a 13 mm spanner on each spreader screw’s head and turn it, so the pad moves out, without turning, until it bears on the reveal. Tighten opposite pairs in turn, then run each lock nut up against the collar. No drilling; the pads only press.'
    : config.attachment === 'spreader-feet'
    ? 'From inside, through the open window: put a 13 mm spanner on each spreader’s jammed nuts and turn the stud, so the foot moves out until its pad bears on the reveal. Tighten opposite pairs in turn. No drilling; the pads only press.'
    : 'From outside, drive each inner wedge along the member until the pair fills the gap. Drive opposite pairs in turn. No drilling; the wedges only press.';
  return [
    { title: 'Existing window', detail: hung
      ? 'A tilt-and-turn window: the sash opens inward and closes against the fixed frame’s outer lip. The insert is built outside and hangs on that lip, like an insect screen.'
      : 'The sash opens inward. The insert is built outside and sits only in the exterior recess.' },
    { title: 'Join the collar', detail: `${joint}. Check the diagonals are equal.` },
    { title: hung ? 'Fit the feet and hooks' : config.attachment === 'spreader-feet' ? 'Fit the clamp hardware' : 'Prepare the wedges', detail: clamp },
    { title: variant === 'direct' ? 'Threshold and passage mesh' : 'Cat port and infill mesh', detail: fill },
    hung
      ? { title: 'Hang it on the window frame', detail: `Open the sash. Carry the insert to the window from the garden, lift it ${fit?.lift ?? 0} mm higher than it will stand, and slip the long hooks up behind the frame’s head lip. Swing its foot in flat against the frame and let it down: the short hooks drop behind the sill lip and the feet stand on the recess floor.` }
      : { title: 'Set it into the recess', detail: 'Carry the insert to the window from the garden and stand it on the recess floor, clear of the closed sash.' },
    { title: hung ? 'Level it and close the window' : config.attachment === 'spreader-feet' ? 'Tighten from inside' : 'Drive the wedges', detail: tighten },
    { title: variant === 'direct' ? 'Brackets and check' : 'Gate and check', detail: variant === 'direct'
      ? 'Offer the removable docking brackets to the collar face from outdoors, ready for the enclosure’s rear portal. Open and close the window: it clears the insert.'
      : 'Fix the gate tracks on the room side of the port. Lower the sliding cat gate into them from above, then fit the latch. Keep the gate shut until a tunnel is docked: the insert–tunnel coupling page screws a docking frame onto the port’s face, which then stays on the insert. Open and close the window: it clears the insert.' },
  ];
}

const sideName: Record<Side, string> = { left: 'left stile', right: 'right stile', head: 'head rail', sill: 'sill rail' };
const partSize = (p: Part) => {
  const d = (key: string) => p.dimensions[key] ? `${key} ${p.dimensions[key].value}` : '';
  switch (p.family) {
    case 'wood-screw': return [d('d'), d('l'), d('dk')].filter(Boolean).join(' · ');
    case 'nail': return [d('d'), d('l')].join(' · ');
    case 'insert-nut': return [d('d'), d('l'), d('hole')].join(' · ');
    case 'levelling-foot': return [d('d1'), d('l1'), d('l3'), `A/F ${p.dimensions['s']?.value ?? ''}`].join(' · ');
    case 'nut': return [d('s'), p.dimensions['h'] ? d('h') : d('m')].join(' · ');
    case 'screw': return [d('d'), d('l'), `A/F ${p.dimensions['s']?.value ?? ''}`].join(' · ');
    case 'screen-hook': return [d('h'), d('w'), d('t')].join(' · ');
    default: return '';
  }
};

/** The parts list: timber cut list, mesh panels, and hardware by part of the library. */
export function windowInsertBom(variant: CatioMode, config: WindowInsertConfig, window: WindowSpec = windowFor(variant, config)): BomLine[] {
  const l = windowInsertLayout(variant, config, window);
  const lines: BomLine[] = [];
  // Timber: identical cuts are counted together.
  for (const piece of l.timber) {
    const same = lines.find(line => line.group === 'Timber' && line.name.replace(/, (left|right|head|sill)$/, '') === piece.name.replace(/, (left|right|head|sill)$/, '') && line.size === `${piece.section} · ${piece.cut}`);
    if (same) { same.quantity++; same.name = same.name.replace(/, (left|right|head|sill)$/, ''); continue; }
    lines.push({ id: piece.id, group: 'Timber', name: piece.name, quantity: 1, size: `${piece.section} · ${piece.cut}`, use: piece.use });
  }
  if (config.attachment === 'folding-wedges') {
    const { length, width, thickness } = INSERT.wedge;
    lines.push({ id: 'folding-wedges', group: 'Timber', name: 'Folding wedge', quantity: 2 * l.clamps.length, size: `${length} × ${width}, ${thickness} mm to 0`, use: `Pairs: ${config.clampsPerSide} on each side of the collar` });
  }
  if (variant === 'modular' && l.port) lines.push({ id: 'cat-gate', group: 'Timber', name: 'Sliding cat gate', quantity: 1, size: `${l.port.width + 20} × ${l.port.height + 20} × 12 exterior plywood`, use: 'Slides up in its tracks on the room side of the port' });
  for (const panel of l.panels) lines.push({ id: panel.id, group: 'Mesh', name: panel.name, quantity: 1, size: `${Math.round(panel.width)} × ${Math.round(panel.height)} · ${INSERT.mesh.opening} mm openings, ${INSERT.mesh.wire} mm wire (nominal)`, use: [...new Set(panel.edges.map(e => e.use))].join('; ') });
  const counts = new Map<string, { quantity: number; uses: Set<string> }>();
  const add = (partId: string, use: string, quantity = 1) => {
    const entry = counts.get(partId) ?? { quantity: 0, uses: new Set<string>() };
    const plain = use.replace(/, (top|bottom) (left|right) corner$/, '').replace(/^.*: /, '');
    entry.quantity += quantity; entry.uses.add(plain.charAt(0).toUpperCase() + plain.slice(1)); counts.set(partId, entry);
  };
  for (const f of l.fasteners) add(f.partId, f.use);
  for (const c of l.clamps) {
    if (c.kind === 'wedge') continue;
    add(l.insertNut.id, `In the ${sideName[c.side]}`);
    if (l.pad) {
      if (c.kind === 'bearing') add(l.pad.bearingScrew.id, 'Under the sill rail: its head in a printed foot, up into the insert nut');
      else {
        add(l.pad.spreaderScrew.id, 'In the stiles and head rail: turned from inside, pushes a printed thrust pad onto the reveal');
        add(l.nut.id, 'Locks each spreader screw against the collar’s inner face');
        add(l.pad.thrustNut.id, 'On the tip of each spreader screw, inside its thrust pad');
      }
    } else if (c.kind === 'bearing') add(l.bearingFoot.id, 'Under the sill rail: carries the insert on the recess floor');
    else { add(l.spreaderFoot.id, 'In the stiles and head rail: presses on the reveal'); add(l.nut.id, 'Jammed against the foot’s own nut on the inner end of each spreader stud'); }
  }
  for (const hook of l.hooks) add(hook.part.id, `${hook.end === 'head' ? 'At the head of each stile: slipped up behind the frame’s head lip' : 'At the sill end of each stile: dropped behind the frame’s sill lip'}, bent at ${l.hookFit?.bend ?? 0} mm`);
  for (const [partId, entry] of counts) {
    const p = part(partId);
    lines.push({ id: partId, group: 'Hardware', name: p.title, quantity: entry.quantity, size: `${p.designation} · ${partSize(p)}`, use: [...entry.uses].join('; '), partId });
  }
  if (l.pad) {
    const sole = `${l.pad.surface} sole`; const size = `Ø ${l.pad.diameter} × ${l.pad.height} mm · ${sole} · PETG`;
    const spreaders = l.clamps.filter(c => c.kind === 'spreader').length;
    if (spreaders > 0) lines.push({ id: 'thrust-pads', group: 'Hardware', name: 'Pressure pad, thrust pad', quantity: spreaders, modelId: 'pressure-pad', size: `${size} · for an ${l.pad.thrustNut.designation} nut`, use: 'On each spreader screw’s tip: presses on the reveal without turning' });
    lines.push({ id: 'foot-pads', group: 'Hardware', name: 'Pressure pad, foot', quantity: l.clamps.length - spreaders, modelId: 'pressure-pad', size: `${size} · for an ${l.pad.bearingScrew.designation} head`, use: 'Under the sill rail: stands on the recess floor; turned by hand to set the height' });
  }
  if (variant === 'modular' && l.port) {
    lines.push({ id: 'gate-tracks', group: 'Hardware', name: 'Gate track (custom)', quantity: 2, size: `12 × 12 × ${2 * l.port.height + 45} channel`, use: 'Room side of the port, screwed to the threshold and transom' });
    lines.push({ id: 'gate-latch', group: 'Hardware', name: 'Gate latch (custom)', quantity: 1, size: 'Spring bolt, schematic', use: 'Holds the gate shut' });
  } else lines.push({ id: 'docking-brackets', group: 'Hardware', name: 'Docking bracket (custom, from the original concept)', quantity: 4, size: '55 × 108 × 5 steel angle, schematic', use: 'Collar face to the enclosure’s rear portal; removable' });
  return lines;
}

export function windowInsertFacts(variant: CatioMode, config: WindowInsertConfig) {
  const l = windowInsertLayout(variant, config);
  const cm = (mm: number) => `${Number((mm / 10).toFixed(1))}`;
  return [
    { label: 'Exterior recess · assumed', value: `${cm(l.window.openingWidth)} × ${cm(l.window.openingHeight)} cm` },
    { label: 'Window frame · from outside', value: `${config.frameFace} mm wide, lip ${config.frameLip} mm` },
    { label: 'Collar · outside', value: `${cm(l.W)} × ${cm(l.H)} cm` },
    ...(l.hookFit
      ? [{ label: 'Feet · under the sill rail', value: `${cm(l.gap)} cm` }, { label: 'Hooks · bent at', value: `${l.hookFit.bend} mm` }]
      : [{ label: config.attachment === 'spreader-feet' ? 'Clamp gap · each side' : 'Wedge gap · each side', value: `${cm(l.gap)} cm` }]),
    { label: variant === 'direct' ? 'Passage · clear' : 'Cat port · clear', value: l.port ? `${cm(l.port.width)} × ${cm(l.port.height)} cm` : `${cm(l.Wi)} × ${cm(l.z0 + l.H - INSERT.member - l.floor)} cm` },
    // the clamp gap sets it, and the tunnel starts from it
    ...(l.port ? [{ label: 'Cat port floor · above the grass', value: `${cm(l.floor)} cm` }] : []),
  ];
}

export function windowInsertViews(variant: CatioMode, config: WindowInsertConfig): Record<CatioView, CameraPreset> {
  const l = windowInsertLayout(variant, config);
  const cz = l.window.recessFloor + l.window.openingHeight / 2; const span = Math.max(l.window.openingWidth, l.window.openingHeight);
  // the left clamp, or (hung) the head hook on the left, where it reaches behind the lip
  const clamp = l.clamps.find(c => c.side === 'left') ?? l.clamps[0];
  const hook = l.hooks.find(h => h.end === 'head');
  const focus: V3 = hook ? [hook.x, l.frame.face, l.frame.lip.top] : clamp ? [clamp.at[0], clamp.at[1], clamp.at[2]] : [l.x0, -60, cz];
  return {
    Exterior: { position: [span * 1.25, span * 1.9, cz + span * 0.9], target: [0, 60, cz] },
    Interior: { position: [span * 0.9, -span * 1.9, cz + span * 0.55], target: [0, -80, cz] },
    Front: { position: [0, span * 2.6, cz], target: [0, 0, cz] },
    Side: { position: [span * 2.4, -60, cz + 80], target: [0, -60, cz] },
    Top: { position: [0, -60, cz + span * 2.6], target: [0, -59, cz] },
    // from outdoors and beside the reveal: from the room, the fixed frame hides the gap between collar and reveal. Hung, from the
    // room through the open window, up at the head hook where it reaches behind the frame's lip
    Mounting: hook ? { position: [focus[0] + 330, focus[1] - 520, focus[2] - 260], target: focus } : { position: [focus[0] - 480, focus[1] + 470, focus[2] + 260], target: focus },
  };
}

const PAD_SOLE: Record<PressurePadSurface, string> = { flat: 'Flat', grooved: 'Grooved', domed: 'Domed' };

export const WINDOW_INSERT_CONTROLS: SubassemblyControl<WindowInsertConfig>[] = [
  { key: 'cornerJoint', label: 'Collar corners', group: 'Timber joints', help: 'Half-laps lock the corners against the spreaders’ outward push; butt joints are quicker but hold only by screws in end grain.',
    options: [{ value: 'half-lap', label: 'Half-lap, glued + 2 screws' }, { value: 'butt-screwed', label: 'Butt joint + 2 screws' }] },
  { key: 'junctionJoint', label: 'Port transom & jambs', group: 'Timber joints', variants: ['modular'], help: 'Housings carry the transom and jambs on timber; butt joints rely on the screws alone.',
    options: [{ value: 'housed', label: 'Housed 10 mm + screw' }, { value: 'butt-screwed', label: 'Butt joint + screws' }] },
  { key: 'meshFixing', label: 'Mesh to timber', group: 'Mesh', help: 'Staples hold the wire; battens clamp it along the whole edge and cover the cut ends. Where the passage sleeve meets the threshold edge (direct) it is always stapled.',
    options: [{ value: 'staples-and-battens', label: 'Staples under cover battens' }, { value: 'staples', label: 'Staples only' }, { value: 'battens', label: 'Cover battens only' }] },
  { key: 'fixingPitch', label: 'Fixing spacing', group: 'Mesh', help: 'The greatest distance between staples, and between batten screws, along an edge.',
    options: [{ value: 100, label: '10 cm' }, { value: 150, label: '15 cm' }, { value: 200, label: '20 cm' }] },
  { key: 'attachment', label: 'Held in the recess by', group: 'Window attachment', help: 'No drilling either way. Spreader feet are tightened and released from inside; wedges are cheaper but driven from outside. Hung on the window frame, the collar lies on the frame’s face and four bought screen hooks reach behind its lip, like an insect screen’s, while feet under the sill rail carry it: the window still closes with the insert in place.',
    options: [{ value: 'spreader-feet', label: 'Padded spreader feet' }, { value: 'folding-wedges', label: 'Folding timber wedges' }, { value: 'frame-hooks', label: 'Hooks on the window frame + feet' }] },
  { key: 'frameOverlap', label: 'Overlap on the frame', group: 'Window attachment', when: c => c.attachment === 'frame-hooks',
    help: 'How far the collar lies on the fixed frame’s face beyond the lip’s tips, at the head and sides (insect screens: at least 15 mm). The rest of each 40 mm stile lies over the window opening, where the hooks are screwed.',
    options: [{ value: 10, label: '10 mm' }, { value: 15, label: '15 mm' }, { value: 20, label: '20 mm' }, { value: 25, label: '25 mm' }] },
  { key: 'clampPad', label: 'Spreader feet', group: 'Window attachment', when: c => c.attachment !== 'folding-wedges',
    help: 'Printed pressure pads (the pressure-pad model, in PETG) on M8 hexagon head screws and nuts from the parts library; or bought Ganter levelling feet. Both are turned from inside.',
    options: [{ value: 'printed', label: 'Printed pads on M8 screws' }, { value: 'ganter', label: 'Ganter GN 343.2 levelling feet' }] },
  { key: 'padHeight', label: 'Pad height', group: 'Window attachment', when: c => c.attachment !== 'folding-wedges' && c.clampPad === 'printed', options: [],
    help: 'From the pad’s back to its sole. With the 8 mm of travel it is the clamp gap round the collar, so it sets the collar’s size and the cat port’s floor. 24.5 mm keeps the gap of the 32 mm Ganter foot.',
    range: { ...PAD_HEIGHT, unit: 'mm' } },
  { key: 'padSurface', label: 'Pad sole', group: 'Window attachment', when: c => c.attachment !== 'folding-wedges' && c.clampPad === 'printed',
    help: 'Grooves bite into rough render and drain; a flat sole bears all over on a smooth reveal; a dome rocks to follow a reveal that is not square to the screw.',
    options: PRESSURE_PAD_SURFACES.map(value => ({ value, label: PAD_SOLE[value] })) },
  { key: 'clampsPerSide', label: 'Clamps per side', group: 'Window attachment', help: 'On each of the four sides. Three spread the load on a soft or uneven reveal. Hung on the window frame, only the sill rail has them: the feet that carry the insert.',
    options: [{ value: 2, label: '2 (8 in all)' }, { value: 3, label: '3 (12 in all)' }] },
  { key: 'footDiameter', label: 'Foot diameter', group: 'Window attachment', help: 'Of the printed pads or the Ganter feet. A larger pad presses more gently on render; a larger Ganter foot is also taller, which widens the gap round the collar.',
    options: [{ value: 25, label: '25 mm' }, { value: 32, label: '32 mm' }, { value: 40, label: '40 mm' }] },
  { key: 'frameFace', label: 'Frame width, from outside', group: 'The window', options: [], range: { ...WINDOW_PROFILE_RANGES.frameFace, unit: 'mm' },
    help: 'How wide the fixed frame shows from outside, from its outer edge to the tip of its lip, over the closed sash. 73 mm is a VEKA Softline 82 window. Hung on the frame, the collar lies on this face.' },
  { key: 'frameLip', label: 'Frame lip thickness', group: 'The window', options: [], range: { ...WINDOW_PROFILE_RANGES.frameLip, unit: 'mm' },
    help: 'Open the window and measure the fixed frame’s outermost leg, from its outer face to the seal on its back (Windhager calls it X). The hooks are bent to it; they suit 5–35 mm.' },
  { key: 'sealGap', label: 'Seal gap', group: 'The window', options: [], range: { ...WINDOW_PROFILE_RANGES.sealGap, unit: 'mm' },
    help: 'From the lip’s back to the closed sash’s face, where the outer seal is: the frame’s face to the sash’s face, less the lip. The hooks’ tips lie in it, so the sash still closes.' },
  { key: 'frameDepth', label: 'Frame depth', group: 'The window', options: [], range: { ...WINDOW_PROFILE_RANGES.frameDepth, unit: 'mm' },
    help: 'The window’s depth from outside to the room (Bautiefe): 82 mm for VEKA Softline 82, 70 mm for many older windows. It only changes the drawing.' },
];

export const parseWindowInsert = (raw: unknown) => parseControlled(WINDOW_INSERT_DEFAULT, WINDOW_INSERT_CONTROLS, raw);

export const WINDOW_INSERT_DECISIONS: DesignDecision[] = [
  { title: 'Held by pressure, not fixings', parameter: 'Held in the recess by',
    choice: 'Spreaders turned out of M8 insert nuts in the collar: two or three on each stile and the head press on the reveals; those under the sill rail stand on the recess floor and carry the weight.',
    why: 'This formalises the concept’s “padded clamps against the solid exterior recess”. Nothing is drilled or glued to the building; releasing the studs frees the insert. The pads’ grooved or domed soles (or the Ganter feet’s 15° swivel and elastomer caps) follow an uneven render reveal; tightening from inside the open window keeps the original concept’s reach-through adjustment. Folding wedges are offered as the low-cost alternative, but they are driven and loosened from outside. Rejected: a bar across the inside of the frame (stops the sash closing), tension straps through the open sash (same), and adhesive or suction mounts (unreliable outdoors).' },
  { title: 'Or hung on the window frame, like an insect screen', parameter: 'Held in the recess by',
    choice: 'The collar lies on the fixed frame’s outer face, overlapping it 15 mm beyond the lip’s tips. Two long and two short Windhager 03651 screen hooks, screwed to the stiles’ backs, reach behind the frame’s lip at the head and the sill; printed feet (or levelling feet) under the sill rail stand on the recess floor.',
    why: 'This is how insect screens hang on tilt-and-turn windows without drilling: their hooks catch the fixed frame’s outer lip (Blendrahmenüberschlag), not the sash, whose face lies behind the lip with only the seal between. Each hook is bent so that its tip lies in the seal gap, in front of the closed sash, so the window still closes. The feet carry the insert’s weight, about 10 kg, so the frame’s lip only keeps it from tipping out. Lifted by the short hooks’ reach, it is hung by the long ones and dropped over the sill lip, as a screen is.' },
  { title: 'Printed pads on library screws', parameter: 'Spreader feet',
    choice: 'Each spreader is an ISO 4017 M8 × 80 hexagon head screw turned from inside through the insert nut, locked by an ISO 4032 nut on the collar’s inner face. An ISO 10511 lock nut on its tip turns freely in a printed thrust pad (the pressure-pad model, PETG). Under the sill rail, an M8 × 30’s head sits in a printed foot, turned by hand. Ganter GN 343.2 levelling feet remain selectable.',
    why: 'Screws and nuts are cheap and to hand; bought levelling feet are not. The screw’s own head is the drive, so one nut locks it instead of two jammed on a stud. The thrust pad does not turn with the screw, so it does not scrub the render, as the Ganter foot’s ball does not. A printed pad does not swivel: the domed sole follows a reveal that is not square to the screw. PETG creeps under a constant load in summer sun, so check the clamps again after the first warm season.' },
  { title: 'Spreaders on all four sides', parameter: 'Clamps per side',
    choice: 'The clamps act in opposed pairs (left–right, head–sill), so their forces cancel in the collar instead of pushing it out of the recess.',
    why: 'Weight goes straight down through the sill feet onto the exterior sill; the side and head pairs give the friction that resists a cat pushing on the mesh. The feet sit at the room-side half of the collar, behind the mesh, where the hand reaches.' },
  { title: 'Half-lapped collar corners', parameter: 'Collar corners',
    choice: 'Each 40 × 60 collar member is halved 30 mm deep at its ends, glued and screwed with two DIN 7997 4 × 50 screws from the outdoor face.',
    why: 'The spreaders push the stiles and rails apart at the corners. A lap carries that on long-grain glue and timber shoulders; a butt joint (the alternative) holds only by screws in end grain.' },
  { title: 'Mesh clamped under battens', parameter: 'Mesh to timber',
    choice: 'DIN 1159 2.5 × 25 staples over the wire every 15 cm, then 40 × 15 cover battens screwed through the mesh with DIN 7997 4 × 35 screws.',
    why: 'Staples locate the mesh while it is tensioned; the battens clamp the whole edge so a pulling claw cannot work single wires free, and they cover the sharp cut ends. Staples only or battens only remain selectable.' },
  { title: 'The cat port ends at its frame', parameter: 'Port transom & jambs',
    choice: 'With tunnel, the port is a full-width transom and two jambs with the infill mesh round them. Nothing of the insert runs on to the wall face: the insert–tunnel coupling screws a docking frame onto the jambs and transom, and the frame stays on the insert from then on, also when it is lifted out.',
    why: 'The docking frame carries the passage from the port to the tunnel’s first flange and gives the latches their catch, so a mesh throat there would only be in its way. Its parts are on the coupling’s parts list; its screws are placed between this page’s batten screws and staples, so the mesh fixing and its spacing change it.' },
  { title: 'Collar sized from the clamps', parameter: 'Pad height',
    choice: 'The collar is the recess size less the clamp gap on each side: the printed pad’s height, or the Ganter foot’s height with its cap, plus 8 mm of thread travel (32.5 mm for the default 24.5 mm pad, as for the 32 mm foot).',
    why: 'The original concept left 10 mm round its 98 cm collar, too little for any real clamp. Here the gap follows from the chosen part, so the collar (93.5 cm by default) and its cut list change with it. The whole-catio scenes keep their schematic 98 cm collar until this is adopted there.' },
  { title: 'The window as it really is', parameter: 'Frame width, from outside',
    choice: 'A tilt-and-turn window: the fixed frame’s outer lip, 73 mm wide from outside and 15.5 mm thick, overlaps the closed sash, whose face lies 3.5 mm behind the lip across its seal; the frame and sash are 82 mm deep, with a 12 mm rebate gap round the sash’s edge.',
    why: 'These are a VEKA Softline 82 MD window’s: VEKA dimensions 82 mm and 73 mm; the lip and the seal gap are scaled from its section drawing. Measure your own window and set them under The window: they place the hooks, bend them, and check the sash still closes.' },
];
