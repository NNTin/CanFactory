import { dimensionOf, findPart, WINDOW_INSERT_FOOT, WINDOW_INSERT_HARDWARE as HW, windowInsertFeet, type Part } from '@canfactory/contracts';
import { CATIO, CATIO_DERIVED, type CatioView } from './catioDesign.ts';
import { loadCatioSettings, type CatioMode } from './catioSettings.ts';
import { fastenersAlong, parseControlled, type AssemblyStep, type BomLine, type CameraPreset, type DesignDecision, type SubassemblyControl, type V3 } from './catioSubassembly.ts';

/**
 * The window insert: the removable timber collar that sits in the exterior window recess, its mesh, and the clamps that hold
 * it there without drilling. Millimetres; X along the wall, +Y outdoors, Z up; grass Z=0, exterior wall face Y=0, as in
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
  /** How the insert is held in the recess. */
  attachment: 'spreader-feet' | 'folding-wedges';
  /** Clamps (or wedge pairs) along each side of the collar. */
  clampsPerSide: 2 | 3;
  /** Foot diameter of the spreader and bearing feet. */
  footDiameter: 25 | 32 | 40;
}

export const WINDOW_INSERT_DEFAULT: WindowInsertConfig = {
  cornerJoint: 'half-lap', junctionJoint: 'housed', meshFixing: 'staples-and-battens', fixingPitch: 150,
  attachment: 'spreader-feet', clampsPerSide: 2, footDiameter: 32,
};

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
  mesh: { opening: CATIO.meshOpening, wire: CATIO.wire, overlap: 30 },
} as const;

/** The existing window the insert fits, as the whole-catio concept assumes it. */
export interface WindowSpec {
  glassWidth: number; glassHeight: number; sashWidth: number; sashHeight: number;
  /** The exterior recess (wall opening) the insert sits in, and its floor (the exterior sill). */
  openingWidth: number; openingHeight: number; recessFloor: number;
  sill: number; sashY: number;
  /** The cat port's clear size, with tunnel only. */
  tunnel: { width: number; height: number } | null;
}

/** Direct uses the original fixed sizes; with tunnel follows the window and tunnel saved on the catio concept page. */
export function windowFor(variant: CatioMode): WindowSpec {
  if (variant === 'direct') return {
    glassWidth: CATIO.glass, glassHeight: CATIO.glass, sashWidth: CATIO.sash, sashHeight: CATIO.sash,
    openingWidth: CATIO.fixedFrame, openingHeight: CATIO.fixedFrame, recessFloor: CATIO_DERIVED.fixedBottom, sill: CATIO.sill, sashY: CATIO_DERIVED.sashY, tunnel: null,
  };
  const c = loadCatioSettings().config;
  return {
    glassWidth: c.glassWidth, glassHeight: c.glassHeight, sashWidth: c.sashWidth, sashHeight: c.sashHeight,
    // The modular scene's fixed frame is the sash + 45 mm a side; its floor sits 45 mm below the sill.
    openingWidth: c.sashWidth + 90, openingHeight: c.sashHeight + 90, recessFloor: CATIO.sill - 45, sill: CATIO.sill, sashY: -200,
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
export interface Fastener {
  partId: string; component: 'corner-screws' | 'threshold-screws' | 'port-screws' | 'batten-screws' | 'staples';
  at: V3; /** Driven in this direction from `at`. */ direction: V3; use: string;
  /** A staple's crown runs this way, across the wire it holds. */ across?: V3;
}

/** Every piece of the insert, placed in the recess (installed and tightened). */
export function windowInsertLayout(variant: CatioMode, config: WindowInsertConfig, window: WindowSpec = windowFor(variant)) {
  const { member: m, depth: D, y: yc } = INSERT;
  const spreader = config.attachment === 'spreader-feet';
  const nut = part(HW.jamNut);
  // A spreader stud runs through the member, the travel and the two jammed nuts on its inner end (windowInsertFeet).
  const { spreader: spreaderFoot, bearing: bearingFoot } = windowInsertFeet(config.footDiameter);
  const gap = spreader ? dim(spreaderFoot, 'l3') + INSERT.travel : INSERT.wedgeGap;
  const W = window.openingWidth - 2 * gap; const H = window.openingHeight - 2 * gap;
  const z0 = window.recessFloor + gap; const x0 = -W / 2;
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
    clamps.push({ id: `left-${i}`, side: 'left', kind: kind('left'), at: [x0, yc, z], normal: [-1, 0, 0], along: [0, 0, 1] });
    clamps.push({ id: `right-${i}`, side: 'right', kind: kind('right'), at: [-x0, yc, z], normal: [1, 0, 0], along: [0, 0, 1] });
    clamps.push({ id: `head-${i}`, side: 'head', kind: kind('head'), at: [x, yc, z0 + H], normal: [0, 0, 1], along: [1, 0, 0] });
    clamps.push({ id: `sill-${i}`, side: 'sill', kind: kind('sill'), at: [x, yc, z0], normal: [0, 0, -1], along: [1, 0, 0] });
  }

  return {
    variant, config, window, gap, W, H, Wi, Hi, x0, z0, yIn, yOut, floor, port, timber, panels, fasteners, clamps,
    spreaderFoot, bearingFoot, nut, insertNut: part(HW.insertNut),
  };
}
export type WindowInsertLayout = ReturnType<typeof windowInsertLayout>;

/** `count` positions spread evenly over `length`, centred on zero. */
function spaced(length: number, count: number): number[] {
  if (count <= 1) return [0];
  return Array.from({ length: count }, (_, i) => -length / 2 + i * length / (count - 1));
}

export function validateWindowInsert(variant: CatioMode, config: WindowInsertConfig, window: WindowSpec = windowFor(variant)): string[] {
  const errors: string[] = [];
  const l = windowInsertLayout(variant, config, window);
  if (l.W - 2 * INSERT.member < window.sashWidth * 0.6) errors.push('The collar opening is too narrow for this window.');
  if (l.port) {
    const { width: w, height: h } = l.port;
    if (w + 2 * INSERT.portMember > l.Wi - 2 * 60) errors.push('The cat port and its jambs must fit between the collar stiles and their clamps.');
    if (l.floor + 2 * h + 50 > l.z0 + l.H - INSERT.member - 40) errors.push('The sliding gate needs room above the port for its full travel inside the collar.');
  }
  const stud = dimensionOf(l.spreaderFoot, 'l1');
  if (config.attachment === 'spreader-feet' && stud < INSERT.member + INSERT.travel + 2 * dimensionOf(l.nut, 'm')) errors.push('No stud of this foot is long enough to pass the collar and take two nuts.');
  return errors;
}

/** Stage 0 is the window as it is; stages 1–3 happen on a bench outside, 4–6 at the window. */
export function windowInsertSteps(variant: CatioMode, config: WindowInsertConfig): readonly AssemblyStep[] {
  const joint = config.cornerJoint === 'half-lap'
    ? 'Lay the sill and head rails, laps facing outdoors. Glue the laps and press the stiles onto them from the outdoor side. Then drive two 4 × 50 screws into each corner from the outdoor face, one corner after another'
    : 'Stand the two stiles. Slide the head and sill rails in between them from the outdoor side. Then drive two 5 × 70 screws through each stile into the end grain of the rail';
  const clamp = config.attachment === 'spreader-feet'
    ? 'In this order, at every clamp: (1) screw an M8 insert nut into the outer face of the collar; (2) screw the levelling foot’s stud through it from outside until the foot’s hexagon touches the collar. Short studs go under the sill rail, long ones in the stiles and head. (3) On each long stud’s inner end, run on the foot’s own nut from inside, then (4) a second M8 nut, and jam the two together.'
    : 'At every clamp, set the inner wedge against the collar from outside, then lay the outer wedge loosely on it, thin end to thick end. Tape each pair so none can fall when the insert is lifted in.';
  const mesh = config.meshFixing === 'staples' ? 'staple its edges' : config.meshFixing === 'battens' ? 'press the cover battens over its edges and screw them on from the outdoor face' : 'staple its edges, then press the cover battens over them and screw them on from the outdoor face';
  const fill = variant === 'direct'
    ? `Lower the threshold onto the sill rail and screw it down from above. Slide the passage sleeve mesh on from outdoors and ${mesh}.`
    : `Lower the threshold onto the sill rail and screw it down from above. Slide the transom into its stile housings from outdoors, then each jamb up into the transom. Screw the transom through the stiles and the jambs up from under the sill rail. Offer the infill mesh from outdoors and ${mesh}.`;
  const tighten = config.attachment === 'spreader-feet'
    ? 'From inside, through the open window: put a 13 mm spanner on each spreader’s jammed nuts and turn the stud, so the foot moves out until its pad bears on the reveal. Tighten opposite pairs in turn. No drilling; the pads only press.'
    : 'From outside, drive each inner wedge along the member until the pair fills the gap. Drive opposite pairs in turn. No drilling; the wedges only press.';
  return [
    { title: 'Existing window', detail: 'The sash opens inward. The insert is built outside and sits only in the exterior recess.' },
    { title: 'Join the collar', detail: `${joint}. Check the diagonals are equal.` },
    { title: config.attachment === 'spreader-feet' ? 'Fit the clamp hardware' : 'Prepare the wedges', detail: clamp },
    { title: variant === 'direct' ? 'Threshold and passage mesh' : 'Cat port and infill mesh', detail: fill },
    { title: 'Set it into the recess', detail: 'Carry the insert to the window from the garden and stand it on the recess floor, clear of the closed sash.' },
    { title: config.attachment === 'spreader-feet' ? 'Tighten from inside' : 'Drive the wedges', detail: tighten },
    { title: variant === 'direct' ? 'Brackets and check' : 'Gate and check', detail: variant === 'direct'
      ? 'Offer the removable docking brackets to the collar face from outdoors, ready for the enclosure’s rear portal. Open and close the window: it clears the insert.'
      : 'Fix the gate tracks on the room side of the port. Lower the sliding cat gate into them from above, then fit the latch. Keep the gate shut until a tunnel is coupled. Open and close the window: it clears the insert.' },
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
    case 'nut': return [d('s'), d('m')].join(' · ');
    default: return '';
  }
};

/** The parts list: timber cut list, mesh panels, and hardware by part of the library. */
export function windowInsertBom(variant: CatioMode, config: WindowInsertConfig, window: WindowSpec = windowFor(variant)): BomLine[] {
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
    if (c.kind === 'bearing') add(l.bearingFoot.id, 'Under the sill rail: carries the insert on the recess floor');
    else { add(l.spreaderFoot.id, 'In the stiles and head rail: presses on the reveal'); add(l.nut.id, 'Jammed against the foot’s own nut on the inner end of each spreader stud'); }
  }
  for (const [partId, entry] of counts) {
    const p = part(partId);
    lines.push({ id: partId, group: 'Hardware', name: p.title, quantity: entry.quantity, size: `${p.designation} · ${partSize(p)}`, use: [...entry.uses].join('; '), partId });
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
    { label: 'Collar · outside', value: `${cm(l.W)} × ${cm(l.H)} cm` },
    { label: config.attachment === 'spreader-feet' ? 'Clamp gap · each side' : 'Wedge gap · each side', value: `${cm(l.gap)} cm` },
    { label: variant === 'direct' ? 'Passage · clear' : 'Cat port · clear', value: l.port ? `${cm(l.port.width)} × ${cm(l.port.height)} cm` : `${cm(l.Wi)} × ${cm(l.z0 + l.H - INSERT.member - l.floor)} cm` },
  ];
}

export function windowInsertViews(variant: CatioMode, config: WindowInsertConfig): Record<CatioView, CameraPreset> {
  const l = windowInsertLayout(variant, config);
  const cz = l.window.recessFloor + l.window.openingHeight / 2; const span = Math.max(l.window.openingWidth, l.window.openingHeight);
  const clamp = l.clamps.find(c => c.side === 'left') ?? l.clamps[0];
  const focus: V3 = clamp ? [clamp.at[0], clamp.at[1], clamp.at[2]] : [l.x0, -60, cz];
  return {
    Exterior: { position: [span * 1.25, span * 1.9, cz + span * 0.9], target: [0, 60, cz] },
    Interior: { position: [span * 0.9, -span * 1.9, cz + span * 0.55], target: [0, -80, cz] },
    Front: { position: [0, span * 2.6, cz], target: [0, 0, cz] },
    Side: { position: [span * 2.4, -60, cz + 80], target: [0, -60, cz] },
    Top: { position: [0, -60, cz + span * 2.6], target: [0, -59, cz] },
    // from outdoors and beside the reveal: from the room, the fixed frame hides the gap between collar and reveal
    Mounting: { position: [focus[0] - 480, focus[1] + 470, focus[2] + 260], target: focus },
  };
}

export const WINDOW_INSERT_CONTROLS: SubassemblyControl<WindowInsertConfig>[] = [
  { key: 'cornerJoint', label: 'Collar corners', group: 'Timber joints', help: 'Half-laps lock the corners against the spreaders’ outward push; butt joints are quicker but hold only by screws in end grain.',
    options: [{ value: 'half-lap', label: 'Half-lap, glued + 2 screws' }, { value: 'butt-screwed', label: 'Butt joint + 2 screws' }] },
  { key: 'junctionJoint', label: 'Port transom & jambs', group: 'Timber joints', variants: ['modular'], help: 'Housings carry the transom and jambs on timber; butt joints rely on the screws alone.',
    options: [{ value: 'housed', label: 'Housed 10 mm + screw' }, { value: 'butt-screwed', label: 'Butt joint + screws' }] },
  { key: 'meshFixing', label: 'Mesh to timber', group: 'Mesh', help: 'Staples hold the wire; battens clamp it along the whole edge and cover the cut ends. Where the passage sleeve meets the threshold edge (direct) it is always stapled.',
    options: [{ value: 'staples-and-battens', label: 'Staples under cover battens' }, { value: 'staples', label: 'Staples only' }, { value: 'battens', label: 'Cover battens only' }] },
  { key: 'fixingPitch', label: 'Fixing spacing', group: 'Mesh', help: 'The greatest distance between staples, and between batten screws, along an edge.',
    options: [{ value: 100, label: '10 cm' }, { value: 150, label: '15 cm' }, { value: 200, label: '20 cm' }] },
  { key: 'attachment', label: 'Held in the recess by', group: 'Window attachment', help: 'Both only press on the recess: no drilling. Spreader feet are tightened and released from inside; wedges are cheaper but driven from outside.',
    options: [{ value: 'spreader-feet', label: 'Padded spreader feet' }, { value: 'folding-wedges', label: 'Folding timber wedges' }] },
  { key: 'clampsPerSide', label: 'Clamps per side', group: 'Window attachment', help: 'On each of the four sides. Three spread the load on a soft or uneven reveal.',
    options: [{ value: 2, label: '2 (8 in all)' }, { value: 3, label: '3 (12 in all)' }] },
  { key: 'footDiameter', label: 'Foot diameter', group: 'Window attachment', help: 'A larger pad presses more gently on render; it also widens the gap round the collar.',
    options: [{ value: 25, label: '25 mm' }, { value: 32, label: '32 mm' }, { value: 40, label: '40 mm' }] },
];

export const parseWindowInsert = (raw: unknown) => parseControlled(WINDOW_INSERT_DEFAULT, WINDOW_INSERT_CONTROLS, raw);

export const WINDOW_INSERT_DECISIONS: DesignDecision[] = [
  { title: 'Held by pressure, not fixings', parameter: 'Held in the recess by',
    choice: 'Rubber-padded swivelling levelling feet (Ganter GN 343.2, type KR) turned out of M8 insert nuts in the collar: two or three on each stile and the head press on the reveals; those under the sill rail stand on the recess floor and carry the weight.',
    why: 'This formalises the concept’s “padded clamps against the solid exterior recess”. Nothing is drilled or glued to the building; releasing the studs frees the insert. The 15° swivel and elastomer pads follow an uneven render reveal; tightening from inside the open window keeps the original concept’s reach-through adjustment. Folding wedges are offered as the low-cost alternative, but they are driven and loosened from outside. Rejected: a bar across the inside of the frame (stops the sash closing), tension straps through the open sash (same), and adhesive or suction mounts (unreliable outdoors).' },
  { title: 'Spreaders on all four sides', parameter: 'Clamps per side',
    choice: 'The clamps act in opposed pairs (left–right, head–sill), so their forces cancel in the collar instead of pushing it out of the recess.',
    why: 'Weight goes straight down through the sill feet onto the exterior sill; the side and head pairs give the friction that resists a cat pushing on the mesh. The feet sit at the room-side half of the collar, behind the mesh, where the hand reaches.' },
  { title: 'Half-lapped collar corners', parameter: 'Collar corners',
    choice: 'Each 40 × 60 collar member is halved 30 mm deep at its ends, glued and screwed with two DIN 7997 4 × 50 screws from the outdoor face.',
    why: 'The spreaders push the stiles and rails apart at the corners. A lap carries that on long-grain glue and timber shoulders; a butt joint (the alternative) holds only by screws in end grain.' },
  { title: 'Mesh clamped under battens', parameter: 'Mesh to timber',
    choice: 'DIN 1159 2.5 × 25 staples over the wire every 15 cm, then 40 × 15 cover battens screwed through the mesh with DIN 7997 4 × 35 screws.',
    why: 'Staples locate the mesh while it is tensioned; the battens clamp the whole edge so a pulling claw cannot work single wires free, and they cover the sharp cut ends. Staples only or battens only remain selectable.' },
  { title: 'Collar sized from the clamps', parameter: 'Foot diameter',
    choice: 'The collar is the recess size less the clamp gap on each side: the foot’s height with its cap plus 8 mm of thread travel (32.5 mm for the default 32 mm foot).',
    why: 'The original concept left 10 mm round its 98 cm collar, too little for any real clamp. Here the gap follows from the chosen part, so the collar (93.5 cm by default) and its cut list change with it. The whole-catio scenes keep their schematic 98 cm collar until this is adopted there.' },
];
