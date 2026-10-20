import { CATIO_DOOR_HARDWARE as HW, dimensionOf, findPart, type BomLine, type CatioMeshSpec, type Part } from '@canfactory/contracts';
import { meshCut } from './catioMesh.ts';
import { STANDARD_PORT } from './catioPort.ts';
import { E_PROFILE_SEAL } from './catioPrintedLatch.ts';
import { fastenersAlong, type V3 } from './catioSubassembly.ts';

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
/**
 * How a set-in door is seated in its opening (`setInDoor`): against stop strips glued inside it (the default: nothing to cut, but
 * the strips narrow the opening by their lap each side), or in a rebate cut round the opening's edge (the opening stays clear).
 */
export const DOOR_SEATS = ['stops', 'rebate'] as const;
export type DoorSeat = typeof DOOR_SEATS[number];
export const DOOR_SEAT_DEFAULT: DoorSeat = 'stops';
export const DOOR_SEAT_LABELS: Record<DoorSeat, string> = { stops: 'Stop strips inside the opening', rebate: 'A rebate round the opening' };
export const DOOR_SEAT_SETTING = 'Door seat';
export const PORT_CLOSURES = ['removable-panel', 'sliding-gate'] as const;
export type PortClosure = typeof PORT_CLOSURES[number];
/** What a new or reset design closes its cat ports with. */
export const PORT_CLOSURE_DEFAULT: PortClosure = 'removable-panel';
export const PORT_CLOSURE_LABELS: Record<PortClosure, string> = { 'removable-panel': 'Removable panel with turn buttons', 'sliding-gate': 'Vertical sliding gate' };
/** The setting's label in the catio planner, as the sub-assembly pages name where it is set. */
export const PORT_CLOSURE_SETTING = 'Cat-port closure';
export const isPortClosure = (value: unknown): value is PortClosure => PORT_CLOSURES.includes(value as PortClosure);

/** How the pages name a cat port's closure, and what is done to shut and to open it. */
export const CLOSURE_WORDS: Record<PortClosure, { thing: string; shut: string; close: string; open: string }> = {
  'removable-panel': { thing: 'cat-port panel', shut: 'seated, every turn button turned over it and locked by its pin', close: 'seat its panel, turn every button over it and drop each one’s locking pin', open: 'lift every button’s locking pin, turn the buttons clear and lift its panel out' },
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
   * A turn button: a printed bar on a screw `tail` from one end, lying `overlap` over the panel when closed. Closed, its captive
   * locking pin (`CATIO_DOOR_HARDWARE.lockPin`, a 2.5 mm parallel pin under a printed knob `knob` high) stands `into` deep in a
   * hole in the timber under it, between the pivot and the panel's edge: it cannot be turned until the pin is lifted out by its
   * knob. A printed collar under the button keeps the pin captive.
   */
  button: { thickness: 6, width: 16, overlap: 12, tail: 8, lock: { diameter: 2.5, into: 6, knob: { diameter: 8, height: 3 } } },
  /** No two buttons along a retained edge are farther apart than this, nor a corner farther than half of it from the nearest. */
  pitch: 250,
  /** A solid panel's pull, on its operator's side. */
  pull: { width: 90, height: 22, depth: 10 },
  /** A pivot screw bites at least this far into timber, and `behind` of that into what its mount is fixed on (a strip). */
  bite: 18, behind: 12,
  /** Screws along a strip or stop, and along a cover strip over mesh, no farther apart than these. */
  fixingPitch: 150, coverPitch: 100,
  /** Lifted out, a panel is drawn this far clear of everything fixed before it is carried aside. */
  withdraw: 20,
  /** The smallest opening a panel is made for. */
  minOpening: 150,
  /**
   * A set-in door (after the PawHut tunnel's: a slim panel in its opening, about flush with the frame round it): its frame `frame`
   * wide and `frameThick` deep, the mesh `meshLayer` on its back (the cat's side), a solid one `solid` deep. It stands `recess`
   * behind the frame's face. Its seat laps `lap`: stop strips `stop` deep inside the opening, or a rebate `lap` wide. Each of its
   * four buttons pivots `pivotEdge` out from the opening's (or the rebate's) edge.
   */
  setIn: { frame: 25, frameThick: 17, solid: 18, recess: 1, lap: 12, stop: 10, pivotEdge: 10, staplePitch: 60 },
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
  /** Its locking pin's hole in the timber under it, closed (u, v): on the way from the pivot to the panel's edge. */
  lock: [number, number];
}
export interface DoorFastener {
  partId: string; role: 'pivot' | 'strip' | 'stop' | 'frame' | 'cover' | 'pull' | 'staple';
  at: V3; direction: V3; use: string;
  /** In the panel, which comes out. */
  moves: boolean;
}
export interface DoorPanel {
  id: string; fit: 'inset' | 'blank' | 'set-in'; material: 'solid' | 'mesh';
  /** A set-in door's seat: stop strips inside the opening, or a rebate cut round it (then `rebate` is its width and depth). */
  seat?: DoorSeat; rebate?: { width: number; depth: number } | null;
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
  /** How far the panel is drawn out along n to clear everything fixed. */
  withdraw: number;
  /** Where it is then set aside, clear of the route (u, v, n from its seat), where the page knows such a place; otherwise it is carried away. */
  stow: V3 | null;
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
    // every bay between two uprights (all alike) has a rail at its head and at its sill
    const [first] = bays; const bay = first ? first[1] - first[0] : 0;
    timber.push({ id: `${id}-rail`, name: `${name}, rail`, section, length: bay, cut: `${Number(bay.toFixed(1))} long`, use, moves: true, boxes: bays.flatMap(([a, b]) => [box(a, b, v0, v0 + fw, n0, n1), box(a, b, v1 - fw, v1, n0, n1)]) });
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
  const made = (pivot: V3, closed: [number, number], open: [number, number]): DoorButton => {
    const d = lockDistance(away);
    return { id, side, pivot, closed, open, reach, tail, lock: [pivot[0] + closed[0] * d, pivot[1] + closed[1] * d] };
  };
  switch (side) {
    case 'left': return made([u0 - away, along, under], [1, 0], [0, -1]);
    case 'right': return made([u1 + away, along, under], [-1, 0], [0, -1]);
    case 'head': return made([along, v1 + away, under], [0, -1], [1, 0]);
    case 'sill': return made([along, v0 - away, under], [0, 1], [1, 0]);
  }
}

/** The pivot screws of `buttons`, each down through its button and washer; `mount` of its length is in what the buttons turn on. */
function pivots(buttons: DoorButton[], partId: string, mount: number, errors: string[]): DoorFastener[] {
  const screw = part(partId); const through = DOOR.button.thickness + dimensionOf(part(HW.washer), 'h');
  const bite = dimensionOf(screw, 'l') - through;
  if (bite < Math.max(DOOR.bite, mount + DOOR.behind) - 1e-9) errors.push(`A turn button’s pivot screw (${screw.designation}) would bite only ${bite} mm into the timber under it.`);
  return buttons.map(b => ({ partId, role: 'pivot', at: [b.pivot[0], b.pivot[1], b.pivot[2] + DOOR.button.thickness], direction: [0, 0, -1], use: 'Door turn buttons: each one’s pivot, through its washer', moves: false }));
}

function finish(door: Omit<DoorPanel, 'depth' | 'withdraw' | 'stow' | 'errors'>, stow: V3 | undefined, errors: string[]): DoorPanel {
  const { width, height } = door.opening;
  if (width < DOOR.minOpening || height < DOOR.minOpening) errors.push(`A removable panel needs an opening of at least ${DOOR.minOpening / 10} cm each way.`);
  for (const b of door.buttons) {
    // turned open, a button lies along its edge: its side must stand clear of the panel as it comes out
    const away = b.reach - DOOR.button.overlap;
    if (away - DOOR.button.width / 2 < 1) { errors.push('The turn buttons would not turn clear of the panel: there is too little timber beside the opening for their pivots.'); break; }
  }
  const depth = Math.max(door.buttonUnder + DOOR.button.thickness, door.pull ? door.pull.center[2] + door.pull.size[2] / 2 : 0, door.front);
  const withdraw = depth - door.back + DOOR.withdraw;
  return { ...door, depth, withdraw, stow: stow ?? null, errors };
}

/**
 * A mesh panel set into its opening from outside, against stop strips all round inside it: flush with the timber round the
 * opening, which locates it with `DOOR.clearance` each side; it stands on the opening's sill. Turn buttons on the timber above
 * and below (their pivots `pivots.head` and `pivots.sill` from the opening's edges) keep it in. `cavity` is the opening's depth,
 * which the stops and the panel fill (the tunnel's side access, between two rails).
 */
export function insetPanel({ id, width, height, cavity, pivots: at, stow }: { id: string; width: number; height: number; cavity: number; pivots: { head: number; sill: number }; stow?: V3 }): DoorPanel {
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
  return finish({ id, fit: 'inset', material: 'mesh', opening: { width, height }, rect, back: 0, front, seatLap: lap - c, mount, buttonUnder, play: dimensionOf(washer, 'h'), timber, mesh: body.mesh, seal: null, pull: null, buttons, fasteners, washer }, stow, errors);
}

/**
 * A floor door's plug: a block of plywood, `T` deep, that fills the port's opening (`DOOR.clearance` all round) from the door's back to
 * the ring's inner face, so that the floor inside is flat and the cat stands on the plug, not in a recess.
 */
function floorPlug(size: number, depth: number, back: number): { timber: DoorTimber; fasteners: DoorFastener[] } {
  const c = DOOR.clearance; const half = size / 2 - c;
  return {
    timber: { id: 'floor-plug', name: 'Floor plug', section: `${depth} mm deep, exterior plywood glued up`, length: size - 2 * c, cut: `${size - 2 * c} × ${size - 2 * c}`, use: 'In the port’s opening, on the door’s inner face: the floor the cat stands on there, flush with the ring', moves: true,
      boxes: [box(-half, half, c, size - c, back - depth, back)] },
    fasteners: shared(-half, half, 2).flatMap(u => shared(c, size - c, 2).map(v => ({ partId: HW.stopScrew, role: 'frame' as const, at: [u, v, back + DOOR.solid.thickness] as V3, direction: [0, 0, -1] as V3, use: 'Floor plug: screwed on through the door’s sheet', moves: true }))),
  };
}

/** The depth of a standard port's ring, which a floor door's plug fills. */
const STANDARD_RING_DEPTH = STANDARD_PORT.ring.thickness;

/**
 * A door on a standard port held by the port's own toggle latches, as a coupling is: a blank, made like the port's flange ring
 * (`land` wide, `STANDARD_RING_DEPTH` deep, round an opening `size` square) and closed on its outer face by mesh under cover strips,
 * or by a plywood sheet. It stands `gap` off the port, across the latches' gap, and carries their other halves on its sides, so a
 * port takes it or another element's port alike. Solid, on a floor face, a plug fills the port's opening (`floor`).
 */
export function blankPanel({ id, size, material, land, gap, floor = false, stow }: { id: string; size: number; material: DoorPanel['material']; land: number; gap: number; floor?: boolean; stow?: V3 }): DoorPanel {
  const errors: string[] = [];
  const t = STANDARD_RING_DEPTH; const outer = size / 2 + land; const washer = part(HW.washer);
  const rect: DoorPanel['rect'] = [-outer, outer, size / 2 - outer, size / 2 + outer];
  const ring = `${t} × ${land}`; const back = gap; const ringFront = gap + t;
  const timber: DoorTimber[] = [
    { id: 'blank-stile', name: 'Door ring, stile', section: ring, length: 2 * outer, cut: `${2 * outer} long`, use: 'Made like a flange ring: its sides carry the latches’ plates', moves: true,
      boxes: [-1, 1].map(s => box(...(s < 0 ? [-outer, -size / 2] as const : [size / 2, outer] as const), rect[2], rect[3], back, ringFront)) },
    { id: 'blank-rail', name: 'Door ring, head or sill', section: ring, length: size, cut: `${size} long`, use: 'Between the stiles', moves: true,
      boxes: [box(-size / 2, size / 2, size, rect[3], back, ringFront), box(-size / 2, size / 2, rect[2], 0, back, ringFront)] },
  ];
  const fasteners: DoorFastener[] = [];
  let mesh: DoorPanel['mesh'] = null; let front = ringFront;
  if (material === 'solid') {
    const sheet = DOOR.solid.thickness;
    timber.push({ id: 'blank-sheet', name: 'Door sheet', section: `${sheet} mm exterior plywood`, length: 2 * outer, cut: `${2 * outer} × ${2 * outer}, edges sealed`, use: 'Screwed over the door ring’s outer face', moves: true, boxes: [box(-outer, outer, rect[2], rect[3], ringFront, ringFront + sheet)] });
    front = ringFront + sheet;
    for (const s of [-1, 1]) for (const k of shared(rect[2], rect[3], fastenersAlong(2 * outer, DOOR.coverPitch))) {
      fasteners.push({ partId: HW.coverScrew, role: 'cover', at: [s * (outer - land / 2), k, front], direction: [0, 0, -1], use: 'Door sheet onto its ring', moves: true });
      fasteners.push({ partId: HW.coverScrew, role: 'cover', at: [k - size / 2, size / 2 + s * (outer - land / 2), front], direction: [0, 0, -1], use: 'Door sheet onto its ring', moves: true });
    }
  } else {
    // the mesh over the opening onto the ring, its cut edges clamped under cover strips
    const { cover, meshLayer: layer } = DOOR; const edge = size / 2 + 30; const strip = 30;
    mesh = { width: 2 * edge, height: 2 * edge, center: [0, size / 2, ringFront + layer / 2] };
    front = ringFront + layer + cover;
    timber.push({ id: 'blank-cover', name: 'Door cover strip', section: `${strip} × ${cover}`, length: 2 * (size / 2 + 40), cut: `${2 * (size / 2 + 40)} long`, use: 'Over the mesh’s cut edges, on the door ring’s outer face', moves: true,
      boxes: [
        ...[-1, 1].map(s => box(...(s < 0 ? [-size / 2 - 40, -size / 2 - 10] as const : [size / 2 + 10, size / 2 + 40] as const), -40, size + 40, ringFront + layer, front)),
        ...[-1, 1].map(s => box(-size / 2 - 40, size / 2 + 40, ...(s < 0 ? [-40, -10] as const : [size + 10, size + 40] as const), ringFront + layer, front)),
      ] });
    for (const s of [-1, 1]) for (const k of shared(-size / 2 - 40, size / 2 + 40, fastenersAlong(size + 80, DOOR.coverPitch))) {
      fasteners.push({ partId: HW.coverScrew, role: 'cover', at: [s * (size / 2 + 25), size / 2 + k, front], direction: [0, 0, -1], use: 'Cover strips through the mesh into the door ring', moves: true });
      fasteners.push({ partId: HW.coverScrew, role: 'cover', at: [k, size / 2 + s * (size / 2 + 25), front], direction: [0, 0, -1], use: 'Cover strips through the mesh into the door ring', moves: true });
    }
  }
  if (floor) {
    if (material !== 'solid') errors.push('A floor door must be solid.');
    // the plug stands on the door's sheet, inside its ring, and fills the gap and the port's opening up to the port ring's inner face
    const plug = floorPlug(size, 2 * t + gap, ringFront);
    timber.push(plug.timber);
    fasteners.push(...plug.fasteners.map(f => ({ ...f, at: [f.at[0], f.at[1], front] as V3 })));
  }
  return finish({ id, fit: 'blank', material, opening: { width: size, height: size }, rect, back, front, seatLap: land, mount: 0, buttonUnder: 0, play: 0, timber, mesh, seal: null, pull: null, buttons: [], fasteners, washer }, stow, errors);
}


/**
 * A set-in door: a slim panel in its opening, about flush with the frame round it (`DOOR.setIn`), after the PawHut tunnel's doors.
 * It is seated on all four sides, by stop strips glued inside the opening or in a rebate cut round its edge (`seat`), and kept in
 * by four door turn buttons on the frame’s face, one at the middle of each side, each locked by its pin (three where no frame is below
 * the opening to take one: `sillButton` false, a window port standing on its threshold). Mesh (its mesh stapled on
 * the back of a slim frame) or solid (plywood: a window port, pressed onto a seal when `sealed`, with a pull; or a cube's floor, with
 * a plug that makes up the ring's depth behind it). The opening is `width` × `height`, its foot the frame's origin, and `depth` deep
 * (the frame's thickness behind its face). n points out of the opening, towards whoever opens it.
 */
export function setInDoor({ id, width, height, material, seat, depth, sealed = false, floor = false, sillButton = true, stow }: { id: string; width: number; height: number; material: DoorPanel['material']; seat: DoorSeat; depth: number; sealed?: boolean; floor?: boolean; sillButton?: boolean; stow?: V3 }): DoorPanel {
  const errors: string[] = [];
  const S = DOOR.setIn; const c = DOOR.clearance; const washer = part(HW.washer);
  const thick = material === 'solid' ? S.solid : S.frameThick + DOOR.meshLayer;
  const gap = sealed ? DOOR.seal.gap : 0;
  // the panel's outline: inside the opening, or out into the rebate
  const out = seat === 'rebate' ? S.lap - c : -c;
  const rect: DoorPanel['rect'] = [-width / 2 - out, width / 2 + out, -out, height + out];
  // the buttons turn on their washers on the frame's face: a mesh panel lies just behind it, a sealed one right under the buttons, so
  // that they press it onto its seal
  const buttonUnder = dimensionOf(washer, 'h');
  const front = sealed ? buttonUnder : -S.recess; const back = front - thick;
  const seated = gap - back;
  if (seat === 'rebate' && seated > depth - 8) errors.push(`A rebate for a ${thick} mm door leaves less than 8 mm of the ${depth} mm frame behind it.`);
  if (seat === 'stops' && seated + S.stop > depth + 1e-9) errors.push(`The ${thick} mm door and its stops need ${Math.round(seated + S.stop)} mm of the opening's depth; the frame is ${depth} mm deep.`);
  const timber: DoorTimber[] = []; const fasteners: DoorFastener[] = [];
  let mesh: DoorPanel['mesh'] = null;
  const [u0, u1, v0, v1] = rect; const fw = S.frame;
  if (material === 'solid') {
    timber.push({ id: 'panel-sheet', name: floor ? 'Door sheet' : 'Cat-port panel', section: `${S.solid} mm exterior plywood`, length: v1 - v0, cut: `${Math.round(u1 - u0)} × ${Math.round(v1 - v0)}, edges sealed`, use: floor ? 'The floor door, set in from below' : 'Set into the port, against its seat', moves: true, boxes: [box(u0, u1, v0, v1, back, front)] });
  } else {
    const fb = back + DOOR.meshLayer;
    timber.push({ id: 'panel-frame-stile', name: 'Door frame, upright', section: `${fw} × ${S.frameThick}`, length: v1 - v0, cut: `${Math.round(v1 - v0)} long`, use: 'Butt jointed and screwed; the mesh stapled on its back', moves: true,
      boxes: [box(u0, u0 + fw, v0, v1, fb, front), box(u1 - fw, u1, v0, v1, fb, front)] });
    timber.push({ id: 'panel-frame-rail', name: 'Door frame, rail', section: `${fw} × ${S.frameThick}`, length: u1 - u0 - 2 * fw, cut: `${Math.round(u1 - u0 - 2 * fw)} long`, use: 'Between the uprights', moves: true,
      boxes: [box(u0 + fw, u1 - fw, v0, v0 + fw, fb, front), box(u0 + fw, u1 - fw, v1 - fw, v1, fb, front)] });
    mesh = { width: u1 - u0 - 4, height: v1 - v0 - 4, center: [0, (v0 + v1) / 2, back + DOOR.meshLayer / 2] };
    for (const [a, b] of [[u0, v0], [u1, v0], [u0, v1], [u1, v1]] as const) fasteners.push({ partId: HW.frameScrew, role: 'frame', at: [a, b + (b === v0 ? fw / 2 : -fw / 2), (fb + front) / 2], direction: [a === u0 ? 1 : -1, 0, 0], use: 'Door frame: uprights into the rails’ ends', moves: true });
    // the mesh's edges stapled to the frame's back all round
    for (const [x0, y0, x1, y1] of [[u0, v0, u1, v0], [u1, v0, u1, v1], [u1, v1, u0, v1], [u0, v1, u0, v0]] as const) {
      const l = Math.hypot(x1 - x0, y1 - y0); const n = Math.max(2, Math.ceil(l / S.staplePitch));
      const inset = (q: number, lo: number, hi: number) => q === lo ? q + fw / 2 : q === hi ? q - fw / 2 : q;
      for (let i = 0; i < n; i++) { const t = (i + 0.5) / n; fasteners.push({ partId: HW.staple, role: 'staple', at: [inset(x0 + (x1 - x0) * t, u0, u1), inset(y0 + (y1 - y0) * t, v0, v1), back], direction: [0, 0, 1], use: 'Door mesh stapled onto its frame’s back', moves: true }); }
    }
  }
  // the seat: stop strips inside the opening behind the panel, or the rebate's own shoulder
  const seatAt = back - gap;
  if (seat === 'stops') {
    const lap = S.lap; const n0 = seatAt - S.stop;
    timber.push({ id: 'stop-long', name: 'Door stop, head and sill', section: `${lap} × ${S.stop}`, length: width, cut: `${width} long`, use: 'Glued and screwed inside the opening, behind the door: its seat', moves: false,
      boxes: [box(-width / 2, width / 2, 0, lap, n0, seatAt), box(-width / 2, width / 2, height - lap, height, n0, seatAt)] });
    timber.push({ id: 'stop-end', name: 'Door stop, side', section: `${lap} × ${S.stop}`, length: height - 2 * lap, cut: `${height - 2 * lap} long`, use: 'Glued and screwed inside the opening, between the head and sill stops', moves: false,
      boxes: [-1, 1].map(s => box(...(s < 0 ? [-width / 2, -width / 2 + lap] as const : [width / 2 - lap, width / 2] as const), lap, height - lap, n0, seatAt)) });
    for (const v of [lap / 2, height - lap / 2]) for (const u of shared(-width / 2, width / 2, Math.max(2, fastenersAlong(width, DOOR.fixingPitch) - 1)))
      fasteners.push({ partId: HW.stopScrew, role: 'stop', at: [u, v, seatAt], direction: [0, 0, -1], use: 'Door stops, glued and screwed', moves: false });
    for (const s2 of [-1, 1]) for (const v of shared(lap, height - lap, Math.max(1, fastenersAlong(height - 2 * lap, DOOR.fixingPitch) - 1)))
      fasteners.push({ partId: HW.stopScrew, role: 'stop', at: [s2 * (width / 2 - lap / 2), v, seatAt], direction: [0, 0, -1], use: 'Door stops, glued and screwed', moves: false });
  }
  // a floor door: a plug on its back makes the floor up to the frame's inner face
  if (floor) {
    if (material !== 'solid') errors.push('A floor door must be solid.');
    const inner = seat === 'stops' ? width / 2 - S.lap - c : width / 2 - c; const plugDepth = depth + back;
    if (plugDepth > 1) {
      const vlo = seat === 'stops' ? S.lap + c : c; const vhi = height - vlo;
      timber.push({ id: 'floor-plug', name: 'Floor plug', section: `${Math.round(plugDepth)} mm deep, exterior plywood`, length: 2 * inner, cut: `${Math.round(2 * inner)} × ${Math.round(vhi - vlo)}`, use: 'On the floor door’s back, inside its seat: the floor the cat stands on there, flush with the ring', moves: true, boxes: [box(-inner, inner, vlo, vhi, -depth, back)] });
      for (const u of [-inner / 2, inner / 2]) for (const v of [vlo + (vhi - vlo) / 4, vhi - (vhi - vlo) / 4]) fasteners.push({ partId: HW.stopScrew, role: 'frame', at: [u, v, front], direction: [0, 0, -1], use: 'Floor plug: screwed on through the door’s sheet', moves: true });
    }
  }
  // four buttons on the frame's face, one at the middle of each side, `pivotEdge` beyond the opening's (or the rebate's) edge
  const away = c + S.pivotEdge;
  const mount = 0;
  const buttons = [
    button(`${id}-button-left`, 'left', rect, (v0 + v1) / 2, away, buttonUnder), button(`${id}-button-right`, 'right', rect, (v0 + v1) / 2, away, buttonUnder),
    button(`${id}-button-head`, 'head', rect, 0, away, buttonUnder), ...(sillButton ? [button(`${id}-button-sill`, 'sill', rect, 0, away, buttonUnder)] : []),
  ];
  fasteners.push(...pivots(buttons, HW.pivot.inset, 0, errors));
  // the seal of a sealed panel: on its seat, round the opening
  const sealBoxes = sealed ? (() => { const w2 = width / 2; const sw = DOOR.seal.width; const lap = seat === 'stops' ? S.lap / 2 : 0; return [
    ...[-1, 1].map(s2 => box(s2 * (w2 - lap) - sw / 2, s2 * (w2 - lap) + sw / 2, 0, height, seatAt, back)), box(-w2, w2, height - lap - sw / 2, height - lap + sw / 2, seatAt, back), box(-w2, w2, lap - sw / 2, lap + sw / 2, seatAt, back),
  ]; })() : [];
  const seal = sealed ? { boxes: sealBoxes, length: 2 * width + 2 * height } : null;
  const pullSize = DOOR.pull;
  const pull = sealed ? box(-pullSize.width / 2, pullSize.width / 2, (v0 + v1) / 2 - pullSize.height / 2, (v0 + v1) / 2 + pullSize.height / 2, front, front + pullSize.depth) : null;
  if (pull) for (const s2 of [-1, 1]) fasteners.push({ partId: HW.pullScrew, role: 'pull', at: [s2 * (pullSize.width / 2 - 10), (v0 + v1) / 2, front + 3], direction: [0, 0, -1], use: 'Pull onto the panel', moves: true });
  const rebate = seat === 'rebate' ? { width: S.lap, depth: seated } : null;
  return finish({ id, fit: 'set-in', seat, rebate, material, opening: { width, height }, rect, back, front, seatLap: S.lap - c, mount, buttonUnder, play: buttonUnder - front, timber, mesh, seal, pull, buttons, fasteners, washer }, stow, errors);
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

/** With nowhere to set it aside, a panel is carried this much farther out and away. */
const CARRIED = 80;
/**
 * A door on its way from seated and retained (`travel` 0) to removed (1): first every button turns a quarter turn clear (`turn`
 * 0–1), then the panel is drawn straight out, then set aside where the page stows it, or carried away (`gone` once it is).
 * `offset` is the panel's, in the door's frame.
 */
export function doorPose(door: Pick<DoorPanel, 'withdraw' | 'stow'>, travel: number): { turn: number; offset: V3; out: number; gone: boolean } {
  const turn = ease(clamp01(travel / DOOR_TRAVEL.turned));
  const out = ease(clamp01((travel - DOOR_TRAVEL.turned) / (DOOR_TRAVEL.out - DOOR_TRAVEL.turned)));
  const aside = ease(clamp01((travel - DOOR_TRAVEL.out) / (1 - DOOR_TRAVEL.out)));
  const end: V3 = door.stow ?? [0, 0, door.withdraw + CARRIED];
  return { turn, out, gone: !door.stow && travel >= 1, offset: [aside * end[0], aside * end[1], out * door.withdraw + aside * (end[2] - door.withdraw)] };
}

/** What a door is doing at `travel`, for the caption under a stage; null when it is seated or set aside. */
export function doorAction(door: Pick<DoorPanel, 'buttons'>, travel: number, name: string): string | null {
  if (travel <= 0 || travel >= 1) return null;
  if (travel < DOOR_TRAVEL.turned) return door.buttons.length ? `${door.buttons.length} × Door turn button: its locking pin lifted, turned a quarter turn clear of the ${name}` : `The ${name}’s latches: levers lifted, links unhooked`;
  return travel < DOOR_TRAVEL.out ? `${name.charAt(0).toUpperCase()}${name.slice(1)}: drawn straight out of its opening` : `${name.charAt(0).toUpperCase()}${name.slice(1)}: stowed clear of the route`;
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

/**
 * How far a button's locking pin is from its pivot: half way to the panel's edge, but at least clear of the pivot screw's head
 * (`LOCK_FROM_PIVOT`) and of the edge.
 */
export const LOCK_FROM_PIVOT = 6;
export function lockDistance(away: number) { return Math.min(Math.max(LOCK_FROM_PIVOT, away / 2), away - DOOR.button.lock.diameter); }
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
  const { width, thickness, tail, lock } = DOOR.button;
  for (const [length, quantity] of lengths) lines.push({ id: `${prefix}-door-buttons-${length}`, group: 'Hardware', name: 'Door turn button, printed (custom)', quantity,
    size: `PETG · ${length} × ${width} × ${thickness} · countersunk hole for a 4 mm screw ${tail} mm from one end · a ${lock.diameter} mm hole for its locking pin, with a printed knob (Ø ${lock.knob.diameter} × ${lock.knob.height}) and a collar keeping it captive`,
    use: `${where}: turned over the panel’s edge to keep it in, its locking pin dropped ${lock.into} mm into a hole in the timber; the pin lifted by its knob, a quarter turn clear to let it out. Not yet a model of the library: its strength and its pin are untested` });
  if (door.pull) lines.push({ id: `${prefix}-door-pull`, group: 'Hardware', name: 'Panel pull, printed (custom)', quantity: count, size: `PETG · ${DOOR.pull.width} × ${DOOR.pull.height} × ${DOOR.pull.depth}, two screw holes`, use: `${where}: on the panel’s room side, to draw it out by` });
  if (door.seal) lines.push({ id: `${prefix}-door-seal`, group: 'Hardware', name: E_PROFILE_SEAL, quantity: count, size: `about ${DOOR.seal.width} × ${DOOR.seal.height} · ${Math.ceil(door.seal.length / 10) * 10} long`, use: `${where}: round the panel’s seat, on the jambs, the transom and the sill stop; squashed to ${DOOR.seal.gap} mm` });
  return lines;
}

/** A door's library parts that are not drawn as fasteners: the washer under each button. */
export function doorLibraryParts(door: DoorPanel): { partId: string; quantity: number; use: string }[] {
  return [
    { partId: door.washer.id, quantity: door.buttons.length, use: 'Under each door turn button, on its pivot: the button turns on it' },
    { partId: HW.lockPin, quantity: door.buttons.length, use: 'Each door turn button’s captive locking pin, into its hole in the timber' },
  ];
}

/** The facts a page's brief gives of a door. */
export function doorFacts(door: DoorPanel): { panel: string; retention: string } {
  const [u0, u1, v0, v1] = door.rect; const sides = [...new Set(door.buttons.map(b => b.side))];
  const names: Record<DoorSide, string> = { left: 'jamb', right: 'jamb', head: 'head', sill: 'sill' };
  const panel = `${Math.round(u1 - u0)} × ${Math.round(v1 - v0)} × ${door.front - door.back} mm`;
  if (door.fit === 'blank') return { panel, retention: 'the port’s own toggle latches, as a coupling' };
  return {
    panel,
    retention: `${door.buttons.length} turn buttons (${[...new Set(sides.map(s => names[s]))].join(' and ')}), ${DOOR.button.overlap} mm over the panel · seat ${door.seatLap} mm`,
  };
}
