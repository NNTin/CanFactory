import { CATIO_DOOR_HARDWARE as HW, dimensionOf, findPart, type BomLine, type CatioMeshSpec, type Part } from '@canfactory/contracts';
import { meshCut } from './catioMesh.ts';
import { E_PROFILE_SEAL } from './catioPrintedLatch.ts';
import { clearOf, fastenersAlong, type V3 } from './catioSubassembly.ts';

/**
 * The catio's removable doors: a panel that is lifted out of its opening once every turn button over it has been turned clear,
 * after the PawHut cat tunnel's removable doors (docs/concepts/catio/removable-doors.md). One layout, drawn once
 * (catioDoorScene.ts), for the window insert's cat port, the enclosures' cat ports and the tunnel's side access.
 *
 * What is copied is the mechanism. The construction below (seat, locating, overlaps, spacing, detent) is this design's proposal:
 * the reference's photos do not show it, and none of it has been built or tested.
 *
 * These turn buttons retain a door. They are not the turn buttons that hold the tunnel on its supports (`supportFixing`), nor the
 * toggle latches that couple sections.
 */
export const PORT_CLOSURES = ['removable-panel', 'sliding-gate'] as const;
export type PortClosure = typeof PORT_CLOSURES[number];
/** What a new or reset design closes its cat ports with. */
export const PORT_CLOSURE_DEFAULT: PortClosure = 'removable-panel';
/** What every design saved before the choice existed has: the mechanism it was drawn with. */
export const PORT_CLOSURE_LEGACY: PortClosure = 'sliding-gate';
export const PORT_CLOSURE_LABELS: Record<PortClosure, string> = { 'removable-panel': 'Removable panel with turn buttons', 'sliding-gate': 'Vertical sliding gate' };
/** The setting's label on the catio concept page, as the sub-assembly pages name where it is set. */
export const PORT_CLOSURE_SETTING = 'Cat-port closure';
export const isPortClosure = (value: unknown): value is PortClosure => PORT_CLOSURES.includes(value as PortClosure);

/** How the pages name a cat port's closure, and what is done to shut and to open it. */
export const CLOSURE_WORDS: Record<PortClosure, { thing: string; shut: string; close: string; open: string }> = {
  'removable-panel': { thing: 'cat-port panel', shut: 'seated, every turn button turned over it', close: 'seat its panel and turn every button over it', open: 'turn every button clear and lift its panel out' },
  'sliding-gate': { thing: 'cat gate', shut: 'shut and latched', close: 'lower its gate and latch it', open: 'unlatch its gate and slide it up' },
};

/**
 * A sliding gate rises by its own height, so it needs twice the port's height above the port's floor, and `allowance` for what
 * holds it. Only a sliding gate has this limit: a removable panel leaves the opening altogether.
 */
export const slidingGateRise = (height: number, allowance: number) => 2 * height + allowance;

/** Fixed sizes of a removable panel and what holds it: this design's proposal, in mm. */
export const DOOR = {
  /** A panel that lies on the frame round its opening laps this far onto it, and stands `clearance` from what locates it. */
  lap: 13, clearance: 2,
  /** A solid panel: exterior plywood. */
  solid: { thickness: 12 },
  /** A mesh panel: a frame of `frame` timber, the mesh on its cat side, and `cover` strips over the mesh's cut edges. */
  frame: { width: 30, thickness: 20 }, cover: 8, meshLayer: 2,
  /** A mesh panel longer than this has a mullion, so that it does not flex between its buttons. */
  mullionSpan: 600,
  /** The seal a solid panel is pressed onto: an E-profile `height` high, squashed to `gap`. */
  seal: { gap: 3, height: 4, width: 9 },
  /** A stop strip, where no frame is there to seat the panel: it laps `lap` over the opening and is `depth` deep. */
  stop: { lap: 12, depth: 10 },
  /**
   * A turn button: a printed bar on a screw `tail` from one end, lying `overlap` over the panel when closed. A `pip` under its
   * tail drops into a dimple in the timber at the closed and at the open position.
   */
  button: { thickness: 6, width: 16, overlap: 12, tail: 8, pip: 1 },
  /** No two buttons along a retained edge are farther apart than this, nor a corner farther than half of it from the nearest. */
  pitch: 250,
  /** A solid panel's pull, on its operator's side. */
  pull: { width: 90, height: 22, depth: 10 },
  /** A pivot screw bites at least this far into timber, and `behind` of that into what its mount is fixed on. */
  bite: 20, behind: 12,
  /** Screws along a strip or stop, and along a cover strip over mesh, no farther apart than these. */
  fixingPitch: 150, coverPitch: 100,
  /** Lifted out, a panel is drawn this far clear of everything fixed before it is carried aside. */
  withdraw: 20,
  /** The smallest opening a panel is made for. */
  minOpening: 150,
} as const;

export type DoorSide = 'left' | 'right' | 'head' | 'sill';
/**
 * A door's own frame: `u` across the opening, `v` up it, `n` out of it towards whoever operates it, which is the way the panel
 * comes out. The origin is the middle of the opening's bottom edge, on the seat: the plane the panel is pressed against.
 */
export interface DoorFrame { origin: V3; u: V3; v: V3; n: V3 }
/** A box in a door's frame: `size` and `center` as (u, v, n). */
export interface DoorBox { size: V3; center: V3 }
export interface DoorTimber {
  id: string; name: string; section: string; length: number; cut: string; use: string; boxes: DoorBox[];
  /** Part of the panel, which comes out; otherwise fixed round the opening. */
  moves: boolean;
}
export interface DoorButton {
  id: string; side: DoorSide;
  /** Its pivot on the face it turns on (u, v, n), the washer between. */
  pivot: V3;
  /** Which way it points closed (over the panel) and open (clear of it), as (u, v). */
  closed: [number, number]; open: [number, number];
  /** From its pivot to its tip, and to its other end. */
  reach: number; tail: number;
}
export interface DoorFastener {
  partId: string; role: 'pivot' | 'strip' | 'stop' | 'frame' | 'cover' | 'pull';
  at: V3; direction: V3; use: string;
  /** In the panel, which comes out. */
  moves: boolean;
}
export interface DoorPanel {
  id: string; fit: 'face' | 'inset'; material: 'solid' | 'mesh';
  opening: { width: number; height: number };
  /** The panel, seated: its outline (u0, u1, v0, v1), and its back and front along n. */
  rect: [number, number, number, number]; back: number; front: number;
  /** How far the seat overlaps the panel's edge all round, at its narrowest. */
  seatLap: number;
  /** The face the buttons turn on, the washer between; their undersides are `buttonUnder`. */
  mount: number; buttonUnder: number;
  /** How far a panel can move towards its buttons before it bears on them: none for one pressed onto its seal. */
  play: number;
  timber: DoorTimber[];
  /** The mesh of a mesh panel, on its frame's cat side. */
  mesh: { width: number; height: number; center: V3 } | null;
  /** The seal of a solid panel, round its seat: the strips' boxes and its length. */
  seal: { boxes: DoorBox[]; length: number } | null;
  pull: DoorBox | null;
  buttons: DoorButton[];
  fasteners: DoorFastener[];
  washer: Part;
  /** The farthest anything stands out from the seat, towards the operator. */
  depth: number;
  /** How far the panel is drawn out along n to clear everything fixed, and where it is then set aside (u, v, n from its seat). */
  withdraw: number; stow: V3;
  errors: string[];
}

function part(id: string): Part {
  const found = findPart(id);
  if (!found) throw new Error(`The parts library has no ${id}.`);
  return found;
}
const box = (u0: number, u1: number, v0: number, v1: number, n0: number, n1: number): DoorBox => ({ size: [u1 - u0, v1 - v0, n1 - n0], center: [(u0 + u1) / 2, (v0 + v1) / 2, (n0 + n1) / 2] });
/** `count` positions along `from`–`to`, each in the middle of an equal share of it. */
const shared = (from: number, to: number, count: number) => Array.from({ length: count }, (_, i) => from + (to - from) * (i + 0.5) / count);
/** Buttons along an edge `length` long: none farther apart than the pitch, nor a corner farther than half of it from one. */
export const buttonsAlong = (length: number, least: number) => Math.max(least, Math.ceil(length / DOOR.pitch - 1e-9));

interface PanelBody { timber: DoorTimber[]; mesh: DoorPanel['mesh']; fasteners: DoorFastener[]; thickness: number }

/** The panel itself over `rect`, its back at `back`: a plywood sheet, or a timber frame with mesh under cover strips. */
function panelBody(material: DoorPanel['material'], [u0, u1, v0, v1]: DoorPanel['rect'], back: number): PanelBody {
  const width = u1 - u0; const height = v1 - v0;
  if (material === 'solid') {
    const t = DOOR.solid.thickness;
    return { thickness: t, mesh: null, fasteners: [], timber: [{ id: 'panel-sheet', name: 'Cat-port panel', section: `${t} mm exterior plywood`, length: height, cut: `${width} × ${height}, edges sealed`, use: 'Stands on the threshold, pressed onto the seal round the port', moves: true, boxes: [box(u0, u1, v0, v1, back, back + t)] }] };
  }
  const { width: fw, thickness: ft } = DOOR.frame; const cover = DOOR.cover; const layer = DOOR.meshLayer;
  const thickness = cover + layer + ft; const frameBack = back + cover + layer;
  const timber: DoorTimber[] = []; const fasteners: DoorFastener[] = [];
  const bayCount = Math.max(1, Math.ceil(width / DOOR.mullionSpan - 1e-9));
  const mullions = Array.from({ length: bayCount - 1 }, (_, i) => u0 + width * (i + 1) / bayCount);
  /** The frame's members and, over the mesh on its cat side, the cover strips in the same outline. */
  const outline = (id: string, name: string, section: string, n0: number, n1: number, use: string) => {
    const stiles = [u0 + fw / 2, ...mullions, u1 - fw / 2];
    timber.push({ id: `${id}-stile`, name: `${name}, upright`, section, length: height, cut: `${height} long`, use, moves: true, boxes: stiles.map(u => box(u - fw / 2, u + fw / 2, v0, v1, n0, n1)) });
    const bays = stiles.slice(1).map((u, i) => [(stiles[i] ?? u) + fw / 2, u - fw / 2] as const);
    // every bay between two uprights has a rail at its head and at its sill
    for (const [a, b] of bays) timber.push({ id: `${id}-rail`, name: `${name}, rail`, section, length: b - a, cut: `${b - a} long`, use, moves: true, boxes: [box(a, b, v0, v0 + fw, n0, n1), box(a, b, v1 - fw, v1, n0, n1)] });
    return { stiles, bays };
  };
  const { stiles, bays } = outline('panel-frame', 'Panel frame', `${fw} × ${ft}`, frameBack, frameBack + ft, 'Butt jointed and screwed; the mesh is laid on its cat side');
  outline('panel-cover', 'Panel cover strip', `${fw} × ${cover}`, back, back + cover, 'Over the mesh’s cut edges, on the panel’s cat side');
  // one screw through each upright into the end of each rail, and screws through the cover strips and the mesh into the frame
  for (const [a, b] of bays) for (const v of [v0 + fw / 2, v1 - fw / 2]) {
    // (the two through a mullion pass each other, one above the other)
    fasteners.push({ partId: HW.frameScrew, role: 'frame', at: [a - fw, v - 5, frameBack + ft / 2], direction: [1, 0, 0], use: 'Panel frame: uprights into the rails’ ends', moves: true });
    fasteners.push({ partId: HW.frameScrew, role: 'frame', at: [b + fw, v + 5, frameBack + ft / 2], direction: [-1, 0, 0], use: 'Panel frame: uprights into the rails’ ends', moves: true });
    for (const u of shared(a, b, fastenersAlong(b - a, DOOR.coverPitch) - 1)) fasteners.push({ partId: HW.coverScrew, role: 'cover', at: [u, v, back], direction: [0, 0, 1], use: 'Cover strips through the mesh into the panel frame', moves: true });
  }
  for (const u of stiles) for (const v of shared(v0, v1, fastenersAlong(height, DOOR.coverPitch) - 1)) fasteners.push({ partId: HW.coverScrew, role: 'cover', at: [u, v, back], direction: [0, 0, 1], use: 'Cover strips through the mesh into the panel frame', moves: true });
  return { thickness, timber, fasteners, mesh: { width: width - fw, height: height - fw, center: [(u0 + u1) / 2, (v0 + v1) / 2, back + cover + layer / 2] } };
}

/** A turn button on `side`, its pivot `away` from the panel's edge there, at `along` that edge. */
function button(id: string, side: DoorSide, [u0, u1, v0, v1]: DoorPanel['rect'], along: number, away: number, under: number): DoorButton {
  const reach = away + DOOR.button.overlap; const tail = DOOR.button.tail;
  switch (side) {
    case 'left': return { id, side, pivot: [u0 - away, along, under], closed: [1, 0], open: [0, -1], reach, tail };
    case 'right': return { id, side, pivot: [u1 + away, along, under], closed: [-1, 0], open: [0, -1], reach, tail };
    case 'head': return { id, side, pivot: [along, v1 + away, under], closed: [0, -1], open: [1, 0], reach, tail };
    case 'sill': return { id, side, pivot: [along, v0 - away, under], closed: [0, 1], open: [1, 0], reach, tail };
  }
}

/** The pivot screws of `buttons`, each down through its button and washer; `mount` of its length is in what the buttons turn on. */
function pivots(buttons: DoorButton[], partId: string, mount: number, errors: string[]): DoorFastener[] {
  const screw = part(partId); const through = DOOR.button.thickness + dimensionOf(part(HW.washer), 'h');
  const bite = dimensionOf(screw, 'l') - through;
  if (bite < Math.max(DOOR.bite, mount + DOOR.behind) - 1e-9) errors.push(`A turn button’s pivot screw (${screw.designation}) would bite only ${bite} mm into the timber under it.`);
  return buttons.map(b => ({ partId, role: 'pivot', at: [b.pivot[0], b.pivot[1], b.pivot[2] + DOOR.button.thickness], direction: [0, 0, -1], use: 'Door turn buttons: each one’s pivot, through its washer', moves: false }));
}

function finish(door: Omit<DoorPanel, 'depth' | 'withdraw' | 'stow' | 'errors'>, land: number, errors: string[]): DoorPanel {
  const { width, height } = door.opening;
  if (width < DOOR.minOpening || height < DOOR.minOpening) errors.push(`A removable panel needs an opening of at least ${DOOR.minOpening / 10} cm each way.`);
  for (const b of door.buttons) {
    // turned open, a button lies along its edge: its side must stand clear of the panel as it comes out
    const away = b.reach - DOOR.button.overlap;
    if (away - DOOR.button.width / 2 < 1) { errors.push('The turn buttons would not turn clear of the panel: there is too little timber beside the opening for their pivots.'); break; }
  }
  const depth = Math.max(door.buttonUnder + DOOR.button.thickness, door.pull ? door.pull.center[2] + door.pull.size[2] / 2 : 0, door.front);
  const withdraw = depth - door.back + DOOR.withdraw;
  return { ...door, depth, withdraw, stow: [door.rect[1] - door.rect[0] + 2 * land + 60, 0, withdraw + 40], errors };
}

/**
 * A panel that lies on the frame round its opening, from the operator's side: the frame's own face is its seat on both sides and
 * at the head, where it laps `DOOR.lap` onto members `land` wide; a stop strip across the floor seats its foot. It stands on the
 * floor between locating strips on that frame, which carry the turn buttons, so that screws only keep it from coming out. Solid,
 * it is pressed onto a seal round the seat (the window port); meshed, it is a framed mesh panel (an enclosure's ports).
 */
export function facePanel({ id, width, height, material, land }: { id: string; width: number; height: number; material: DoorPanel['material']; land: number }): DoorPanel {
  const errors: string[] = [];
  const { lap, clearance: c } = DOOR; const washer = part(HW.washer); const sealed = material === 'solid';
  const rect: DoorPanel['rect'] = [-width / 2 - lap, width / 2 + lap, 0, height + lap];
  const back = sealed ? DOOR.seal.gap : 0;
  const body = panelBody(material, rect, back); const front = back + body.thickness;
  // the buttons press a sealed panel onto its seal; a mesh panel has the washer's thickness of play under them
  const play = sealed ? 0 : dimensionOf(washer, 'h');
  const mount = front + play - dimensionOf(washer, 'h'); const buttonUnder = mount + dimensionOf(washer, 'h');
  const stripWidth = land - lap - c;
  if (stripWidth < DOOR.button.width) errors.push('The frame beside the port is too narrow for the panel’s locating strips and turn buttons.');
  const stripTop = rect[3] + c; const outer = width / 2 + land;
  const section = `${stripWidth} × ${mount}`;
  const timber: DoorTimber[] = [...body.timber,
    { id: 'strip-side', name: 'Locating strip, side', section, length: stripTop, cut: `${stripTop} long`, use: 'On each port jamb beside the panel: locates it and carries the turn buttons', moves: false,
      boxes: [-1, 1].map(s => box(...(s < 0 ? [-outer, rect[0] - c] as const : [rect[1] + c, outer] as const), 0, stripTop, 0, mount)) },
    { id: 'strip-head', name: 'Locating strip, head', section, length: 2 * outer, cut: `${2 * outer} long`, use: 'On the transom over the panel: locates it and carries the turn buttons', moves: false, boxes: [box(-outer, outer, stripTop, stripTop + stripWidth, 0, mount)] },
    { id: 'stop-sill', name: 'Sill stop', section: `${DOOR.stop.lap} × ${DOOR.stop.depth}`, length: width, cut: `${width} long`, use: 'Across the port’s floor between the jambs: the seat under the panel’s foot', moves: false, boxes: [box(-width / 2, width / 2, 0, DOOR.stop.lap, -DOOR.stop.depth, 0)] },
  ];
  const away = c + stripWidth / 2;
  const buttons = [
    ...(['left', 'right'] as const).flatMap(side => shared(rect[2], rect[3], buttonsAlong(rect[3] - rect[2], 2)).map((v, i) => button(`${id}-button-${side}-${i}`, side, rect, v, away, buttonUnder))),
    ...shared(rect[0], rect[1], buttonsAlong(rect[1] - rect[0], 1)).map((u, i) => button(`${id}-button-head-${i}`, 'head', rect, u, away, buttonUnder)),
  ];
  const fasteners: DoorFastener[] = [...body.fasteners, ...pivots(buttons, sealed ? HW.pivot.sealed : HW.pivot.mesh, mount, errors)];
  // the strips' own screws, between the pivots
  const stripScrew = sealed ? HW.stripScrew.sealed : HW.stripScrew.mesh;
  const along = (from: number, to: number, avoid: number[]) => clearOf(shared(from, to, fastenersAlong(to - from, DOOR.fixingPitch) - 1), avoid, 15, from + 10, to - 10);
  for (const s of [-1, 1]) for (const v of along(0, stripTop, buttons.filter(b => b.side === (s < 0 ? 'left' : 'right')).map(b => b.pivot[1])))
    fasteners.push({ partId: stripScrew, role: 'strip', at: [s * (outer - stripWidth / 2), v, mount], direction: [0, 0, -1], use: 'Locating strips onto the port jambs and transom', moves: false });
  for (const u of along(-outer, outer, buttons.filter(b => b.side === 'head').map(b => b.pivot[0])))
    fasteners.push({ partId: stripScrew, role: 'strip', at: [u, stripTop + stripWidth / 2, mount], direction: [0, 0, -1], use: 'Locating strips onto the port jambs and transom', moves: false });
  for (const u of shared(-width / 2, width / 2, fastenersAlong(width, DOOR.fixingPitch) - 1))
    fasteners.push({ partId: HW.stopScrew, role: 'stop', at: [u, DOOR.stop.lap, -DOOR.stop.depth / 2], direction: [0, -1, 0], use: 'Sill stop, glued and screwed down onto the port’s floor', moves: false });
  // the seal: round the seat, on the jambs, the transom and the sill stop
  const sw = DOOR.seal.width; const su = width / 2 + lap / 2; const sv = height + lap / 2; const s0 = DOOR.stop.lap / 2;
  const seal = sealed ? { length: 2 * (2 * su) + 2 * (sv - s0), boxes: [
    ...[-1, 1].map(s => box(s * su - sw / 2, s * su + sw / 2, s0, sv, 0, back)), box(-su, su, sv - sw / 2, sv + sw / 2, 0, back), box(-su, su, s0 - sw / 2, s0 + sw / 2, 0, back),
  ] } : null;
  const pullSize = DOOR.pull;
  const pull = sealed ? box(-pullSize.width / 2, pullSize.width / 2, rect[3] / 2 - pullSize.height / 2, rect[3] / 2 + pullSize.height / 2, front, front + pullSize.depth) : null;
  if (pull) for (const s of [-1, 1]) fasteners.push({ partId: HW.pullScrew, role: 'pull', at: [s * (pullSize.width / 2 - 10), rect[3] / 2, front + 3], direction: [0, 0, -1], use: 'Pull onto the panel', moves: true });
  return finish({ id, fit: 'face', material, opening: { width, height }, rect, back, front, seatLap: Math.min(lap, DOOR.stop.lap), mount, buttonUnder, play, timber, mesh: body.mesh, seal, pull, buttons, fasteners, washer }, land, errors);
}

/**
 * A mesh panel set into its opening from outside, against stop strips all round inside it: flush with the timber round the
 * opening, which locates it with `DOOR.clearance` each side; it stands on the opening's sill. Turn buttons on the timber above
 * and below (their pivots `pivots.head` and `pivots.sill` from the opening's edges) keep it in. `cavity` is the opening's depth,
 * which the stops and the panel fill (the tunnel's side access, between two rails).
 */
export function insetPanel({ id, width, height, cavity, pivots: at }: { id: string; width: number; height: number; cavity: number; pivots: { head: number; sill: number } }): DoorPanel {
  const errors: string[] = [];
  const c = DOOR.clearance; const washer = part(HW.washer); const { lap, depth } = DOOR.stop;
  const rect: DoorPanel['rect'] = [-width / 2 + c, width / 2 - c, 0, height - 2 * c];
  const body = panelBody('mesh', rect, 0); const front = body.thickness;
  if (depth + body.thickness > cavity + 1e-9) errors.push(`A side-access panel and its stops need ${depth + body.thickness} mm of depth; the opening has ${cavity} mm.`);
  const mount = front; const buttonUnder = mount + dimensionOf(washer, 'h');
  const section = `${lap} × ${depth}`;
  const timber: DoorTimber[] = [...body.timber,
    { id: 'stop-long', name: 'Access stop, head and sill', section, length: width, cut: `${width} long`, use: 'Inside the opening, along its head and its sill: the seat the panel is pressed against', moves: false,
      boxes: [box(-width / 2, width / 2, 0, lap, -depth, 0), box(-width / 2, width / 2, height - lap, height, -depth, 0)] },
    { id: 'stop-end', name: 'Access stop, end', section, length: height - 2 * lap, cut: `${height - 2 * lap} long`, use: 'Inside the opening, up each end between the long stops', moves: false,
      boxes: [-1, 1].map(s => box(...(s < 0 ? [-width / 2, -width / 2 + lap] as const : [width / 2 - lap, width / 2] as const), lap, height - lap, -depth, 0)) },
  ];
  const count = buttonsAlong(rect[1] - rect[0], 2);
  const buttons = [
    ...shared(rect[0], rect[1], count).map((u, i) => button(`${id}-button-head-${i}`, 'head', rect, u, at.head + 2 * c, buttonUnder)),
    ...shared(rect[0], rect[1], count).map((u, i) => button(`${id}-button-sill-${i}`, 'sill', rect, u, at.sill, buttonUnder)),
  ];
  const fasteners: DoorFastener[] = [...body.fasteners, ...pivots(buttons, HW.pivot.inset, 0, errors)];
  for (const v of [lap / 2, height - lap / 2]) for (const u of shared(-width / 2, width / 2, fastenersAlong(width, DOOR.fixingPitch) - 1))
    fasteners.push({ partId: HW.stopScrew, role: 'stop', at: [u, v, 0], direction: [0, 0, -1], use: 'Access stops, glued and screwed', moves: false });
  for (const s of [-1, 1]) for (const v of shared(lap, height - lap, Math.max(1, fastenersAlong(height - 2 * lap, DOOR.fixingPitch) - 1)))
    fasteners.push({ partId: HW.stopScrew, role: 'stop', at: [s * (width / 2 - lap / 2), v, 0], direction: [0, 0, -1], use: 'Access stops, glued and screwed', moves: false });
  return finish({ id, fit: 'inset', material: 'mesh', opening: { width, height }, rect, back: 0, front, seatLap: lap - c, mount, buttonUnder, play: dimensionOf(washer, 'h'), timber, mesh: body.mesh, seal: null, pull: null, buttons, fasteners, washer }, 0, errors);
}

/** A point of a door's frame in the world. */
export function doorPoint(frame: DoorFrame, [u, v, n]: V3): V3 {
  return [0, 1, 2].map(i => (frame.origin[i] ?? 0) + (frame.u[i] ?? 0) * u + (frame.v[i] ?? 0) * v + (frame.n[i] ?? 0) * n) as V3;
}
/** A direction of a door's frame in the world. */
export function doorDirection(frame: DoorFrame, [u, v, n]: V3): V3 {
  return [0, 1, 2].map(i => (frame.u[i] ?? 0) * u + (frame.v[i] ?? 0) * v + (frame.n[i] ?? 0) * n) as V3;
}
/** A door box's bounds in the world (the box of its corners, when the door stands at an angle). */
export function doorBounds(frame: DoorFrame, b: DoorBox): { min: V3; max: V3 } {
  const centre = doorPoint(frame, b.center);
  const half = [0, 1, 2].map(i => (Math.abs(frame.u[i] ?? 0) * b.size[0] + Math.abs(frame.v[i] ?? 0) * b.size[1] + Math.abs(frame.n[i] ?? 0) * b.size[2]) / 2);
  return { min: centre.map((x, i) => x - (half[i] ?? 0)) as V3, max: centre.map((x, i) => x + (half[i] ?? 0)) as V3 };
}

/** A door's fasteners in the world, for a page to count with its own and to keep its own screws clear of. */
export function doorFasteners(door: DoorPanel, frame: DoorFrame): (DoorFastener & { at: V3; direction: V3 })[] {
  return door.fasteners.map(f => ({ ...f, at: doorPoint(frame, f.at), direction: doorDirection(frame, f.direction) }));
}

const clamp01 = (t: number) => Math.min(1, Math.max(0, t));
const ease = (t: number) => t * t * (3 - 2 * t);
/** The turn buttons turn clear during this first share of a door's travel; the panel then comes out, and is set aside. */
export const DOOR_TRAVEL = { turned: 0.4, out: 0.7 } as const;

/**
 * A door on its way from seated and retained (`travel` 0) to removed and set aside (1): first every button turns a quarter turn
 * clear (`turn` 0–1), then the panel is drawn straight out, then carried aside. `offset` is the panel's, in the door's frame.
 */
export function doorPose(door: Pick<DoorPanel, 'withdraw' | 'stow'>, travel: number): { turn: number; offset: V3; out: number } {
  const turn = ease(clamp01(travel / DOOR_TRAVEL.turned));
  const out = ease(clamp01((travel - DOOR_TRAVEL.turned) / (DOOR_TRAVEL.out - DOOR_TRAVEL.turned)));
  const aside = ease(clamp01((travel - DOOR_TRAVEL.out) / (1 - DOOR_TRAVEL.out)));
  return { turn, out, offset: [aside * door.stow[0], aside * door.stow[1], out * door.withdraw + aside * (door.stow[2] - door.withdraw)] };
}

/** What a door is doing at `travel`, for the caption under a stage; null when it is seated or set aside. */
export function doorAction(door: Pick<DoorPanel, 'buttons'>, travel: number, name: string): string | null {
  if (travel <= 0 || travel >= 1) return null;
  if (travel < DOOR_TRAVEL.turned) return `${door.buttons.length} × Door turn button: turned a quarter turn clear of the ${name}`;
  return travel < DOOR_TRAVEL.out ? `${name.charAt(0).toUpperCase()}${name.slice(1)}: drawn straight out of its opening` : `${name.charAt(0).toUpperCase()}${name.slice(1)}: set aside, clear of the route`;
}

/** A button's outline as (u, v) corners, `turn` of the way from closed (0) to open (1): a quarter turn about its pivot. */
export function buttonOutline(b: DoorButton, turn: number): [number, number][] {
  const angle = turn * Math.PI / 2;
  const d: [number, number] = [b.closed[0] * Math.cos(angle) + b.open[0] * Math.sin(angle), b.closed[1] * Math.cos(angle) + b.open[1] * Math.sin(angle)];
  const side: [number, number] = [-d[1], d[0]]; const half = DOOR.button.width / 2;
  return ([[b.reach, half], [b.reach, -half], [-b.tail, -half], [-b.tail, half]] as const).map(([a, s]) => [b.pivot[0] + d[0] * a + side[0] * s, b.pivot[1] + d[1] * a + side[1] * s]);
}
/** How far a button lies over the panel at `turn`: the depth of its outline inside the panel's, 0 when it is clear. */
export function buttonOverlap(door: Pick<DoorPanel, 'rect'>, b: DoorButton, turn: number): number {
  const [u0, u1, v0, v1] = door.rect;
  return Math.max(0, ...buttonOutline(b, turn).map(([u, v]) => Math.min(u - u0, u1 - u, v - v0, v1 - v)));
}
/** The circle a button sweeps about its pivot: its radius. */
export const buttonSweep = (b: DoorButton) => Math.hypot(Math.max(b.reach, b.tail), DOOR.button.width / 2);

/**
 * How well a panel is retained: along each buttoned edge, the widest gap between two buttons and the farthest a corner is from the
 * nearest; and the sides the seat holds it on.
 */
export function doorRetention(door: DoorPanel): { span: number; corner: number } {
  let span = 0; let corner = 0;
  const [u0, u1, v0, v1] = door.rect;
  for (const side of ['left', 'right', 'head', 'sill'] as const) {
    const upright = side === 'left' || side === 'right';
    const at = door.buttons.filter(b => b.side === side).map(b => b.pivot[upright ? 1 : 0]).sort((a, b) => a - b);
    const first = at[0]; const last = at.at(-1); if (first === undefined || last === undefined) continue;
    const [from, to] = upright ? [v0, v1] : [u0, u1];
    corner = Math.max(corner, first - from, to - last);
    for (let i = 1; i < at.length; i++) span = Math.max(span, (at[i] ?? 0) - (at[i - 1] ?? 0));
  }
  return { span, corner };
}

/** A button's length, pivot hole to both ends. */
const buttonLength = (b: DoorButton) => b.reach + b.tail;

/**
 * A door's lines of a parts list, `count` doors alike: its timber and mesh, its printed buttons and pull and its seal. Its screws and
 * washers are library parts, counted by the page with its other fasteners (`doorLibraryParts`).
 */
export function doorBom(door: DoorPanel, { prefix, where, mesh, count = 1 }: { prefix: string; where: string; mesh: CatioMeshSpec; count?: number }): BomLine[] {
  const lines: BomLine[] = [];
  for (const piece of door.timber) lines.push({ id: `${prefix}-${piece.id}`, group: 'Timber', name: piece.name, quantity: piece.boxes.length * count, size: `${piece.section} · ${piece.cut}`, use: `${where}: ${piece.use.charAt(0).toLowerCase()}${piece.use.slice(1)}` });
  if (door.mesh) lines.push({ id: `${prefix}-mesh`, group: 'Mesh', name: 'Removable panel mesh', quantity: count, size: `${Math.round(door.mesh.width)} × ${Math.round(door.mesh.height)} · ${meshCut(mesh)}`, use: `${where}: between the panel’s frame and its cover strips, clamped along every edge` });
  const lengths = new Map<number, number>();
  for (const b of door.buttons) lengths.set(buttonLength(b), (lengths.get(buttonLength(b)) ?? 0) + count);
  const { width, thickness, tail, pip } = DOOR.button;
  for (const [length, quantity] of lengths) lines.push({ id: `${prefix}-door-buttons-${length}`, group: 'Hardware', name: 'Door turn button, printed (custom)', quantity,
    size: `PETG · ${length} × ${width} × ${thickness} · countersunk hole for a 4 mm screw ${tail} mm from one end · ${pip} mm detent pip under that end`,
    use: `${where}: turned over the panel’s edge to keep it in, a quarter turn clear to let it out. Not yet a model of the library: its strength and its detent are untested` });
  if (door.pull) lines.push({ id: `${prefix}-door-pull`, group: 'Hardware', name: 'Panel pull, printed (custom)', quantity: count, size: `PETG · ${DOOR.pull.width} × ${DOOR.pull.height} × ${DOOR.pull.depth}, two screw holes`, use: `${where}: on the panel’s room side, to draw it out by` });
  if (door.seal) lines.push({ id: `${prefix}-door-seal`, group: 'Hardware', name: E_PROFILE_SEAL, quantity: count, size: `about ${DOOR.seal.width} × ${DOOR.seal.height} · ${Math.ceil(door.seal.length / 10) * 10} long`, use: `${where}: round the panel’s seat, on the jambs, the transom and the sill stop; squashed to ${DOOR.seal.gap} mm` });
  return lines;
}

/** A door's library parts that are not drawn as fasteners: the washer under each button. */
export function doorLibraryParts(door: DoorPanel): { partId: string; quantity: number; use: string }[] {
  return [{ partId: door.washer.id, quantity: door.buttons.length, use: 'Under each door turn button, on its pivot: the button turns on it' }];
}

/** The facts a page's brief gives of a door. */
export function doorFacts(door: DoorPanel): { panel: string; retention: string } {
  const [u0, u1, v0, v1] = door.rect; const sides = [...new Set(door.buttons.map(b => b.side))];
  const names: Record<DoorSide, string> = { left: 'jamb', right: 'jamb', head: 'head', sill: 'sill' };
  return {
    panel: `${Math.round(u1 - u0)} × ${Math.round(v1 - v0)} × ${door.front - door.back} mm`,
    retention: `${door.buttons.length} turn buttons (${[...new Set(sides.map(s => names[s]))].join(' and ')}), ${DOOR.button.overlap} mm over the panel · seat ${door.seatLap} mm`,
  };
}
