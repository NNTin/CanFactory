import { dimensionOf, findPart, parts, type Part } from './parts/index.ts';
import { hexScrew, PRESSURE_PAD, pressurePadSeat } from './pressurePad.ts';
import { PRINTED_CORNER_BRACKET_SCREW } from './printedCornerBracket.ts';
import { PRINTED_SCREEN_HOOK_SCREW } from './printedScreenHook.ts';

/**
 * Concept pages that use parts of the library, so that the library's “Used by” lists them beside the models. A concept is
 * not a model (no SCAD, no render): its page lives in the web app at `#/concepts/<id>`, and the part ids it may use are
 * listed here, once, for both that page and the library. The models of the library it has printed (`models`) are listed the
 * same way, so that a model's editor can name the pages that use it (`modelUsage`).
 */
export interface ConceptPartLink { partId: string; via: string }
export interface ConceptModelLink { modelId: string; via: string }
export interface ConceptPage { id: string; title: string; parts: ConceptPartLink[]; models: ConceptModelLink[] }

/** The window catio's window insert: the fixed hardware of its joints and mesh, by role. */
export const WINDOW_INSERT_HARDWARE = {
  halfLapScrew: 'din-7997-4x50',
  buttScrew: 'din-7997-5x70',
  transomScrew: 'din-7997-5x70',
  jambScrew: 'din-7997-6x90',
  thresholdScrew: 'din-7997-4x35',
  battenScrew: 'din-7997-4x35',
  staple: 'din-1159-2-5x25',
  insertNut: 'din-7965-m8x18',
  jamNut: 'iso-4032-m8',
  /** Hung on the window frame: the screen hooks behind the frame's lip, long at the head and short at the sill, and their screws. */
  hookTop: 'windhager-03651-5a',
  hookBottom: 'windhager-03651-5b',
  hookScrew: 'din-7997-3x16',
} as const;

/** The window insert's clamp feet: Ganter GN 343.2 KR on an M8 stud, in these diameters. */
export const WINDOW_INSERT_FOOT = { thread: 'M8', diameters: [25, 32, 40], member: 40, travel: 8 } as const;

/**
 * The window insert's flat corner brackets (GAH Alberts Stuhlwinkel), the sizes offered: legs 75–150 mm, at most 25 mm wide so they
 * sit on the 40 mm members. 100 × 100 × 19 by default.
 */
export const WINDOW_INSERT_BRACKETS = ['gah-alberts-stuhlwinkel-75x75x16', 'gah-alberts-stuhlwinkel-90x90x19', 'gah-alberts-stuhlwinkel-100x100x19', 'gah-alberts-stuhlwinkel-125x125x22', 'gah-alberts-stuhlwinkel-150x150x25'] as const;
export type WindowInsertBracket = typeof WINDOW_INSERT_BRACKETS[number];

/**
 * The DIN 7997 screw for a corner bracket's holes: the thickest that passes its hole with 0.3 mm to spare (the holes are countersunk
 * for it), long enough to bite 30 mm into the timber through the plate.
 */
export function cornerBracketScrew(bracket: Part): Part {
  const hole = dimensionOf(bracket, 'd');
  const d = [6, 5, 4.5, 4].find(size => size <= hole - 0.3) ?? 4;
  return libraryPart(`din-7997-${String(d).replace('.', '-')}x${d === 6 ? 40 : 35}`);
}

function libraryPart(id: string): Part {
  const found = findPart(id);
  if (!found) throw new Error(`The parts library has no ${id}.`);
  return found;
}

/** The shortest stud of a levelling foot of this diameter and the insert's thread that is at least `least` mm long. */
export function footWithStud(d1: number, least: number): Part {
  const candidates = parts.filter(p => p.family === 'levelling-foot' && dimensionOf(p, 'd1') === d1 && p.attributes['thread'] === WINDOW_INSERT_FOOT.thread)
    .sort((a, b) => dimensionOf(a, 'l1') - dimensionOf(b, 'l1'));
  const found = candidates.find(p => dimensionOf(p, 'l1') >= least) ?? candidates.at(-1);
  if (!found) throw new Error(`No ${d1} mm levelling foot.`);
  return found;
}

/** The feet of one diameter: a spreader stud passes the collar member, the travel and two jammed nuts; a bearing foot needs none. */
export function windowInsertFeet(d1: number): { spreader: Part; bearing: Part } {
  const nut = libraryPart(WINDOW_INSERT_HARDWARE.jamNut);
  return { spreader: footWithStud(d1, WINDOW_INSERT_FOOT.member + WINDOW_INSERT_FOOT.travel + 2 * dimensionOf(nut, 'm') + 1), bearing: footWithStud(d1, 0) };
}

/**
 * The window insert's printed pressure pads (the `pressure-pad` model), the default clamps: a thrust pad on an ISO 10511 lock nut at
 * the tip of each spreader screw, and a foot on the screw's head under the sill rail. The pads' height and sole are the page's to
 * choose; their nut, fit and relief are the model's defaults.
 */
export const WINDOW_INSERT_PAD = { thread: 'M8', thrustNut: 'iso-10511-m8', fit: 0.4, relief: 1 } as const;

/**
 * The screws the printed pads go on, both ISO 4017 M8 from the library. A spreader screw is turned from inside: from its tip in the
 * thrust pad's nut it passes the travel, the collar member, and the lock nut on the member's inner face, 1 mm clear of its head. A
 * bearing screw's head sits in its foot under the sill rail: it passes the travel and fills the insert nut.
 */
export function windowInsertPadScrews(): { spreader: Part; bearing: Part } {
  const nut = libraryPart(WINDOW_INSERT_PAD.thrustNut); const jam = libraryPart(WINDOW_INSERT_HARDWARE.jamNut); const insert = libraryPart(WINDOW_INSERT_HARDWARE.insertNut);
  return {
    spreader: hexScrew(WINDOW_INSERT_PAD.thread, pressurePadSeat('thrust', nut) + WINDOW_INSERT_FOOT.travel + WINDOW_INSERT_FOOT.member + dimensionOf(jam, 'm') + 1),
    bearing: hexScrew(WINDOW_INSERT_PAD.thread, PRESSURE_PAD.lip + WINDOW_INSERT_FOOT.travel + dimensionOf(insert, 'l')),
  };
}

const h = WINDOW_INSERT_HARDWARE;
export const windowInsertConcept: ConceptPage = {
  id: 'catio/window-insert', title: 'Window catio: window insert',
  parts: [
    { partId: h.halfLapScrew, via: 'Collar corners (half-lap)' },
    { partId: h.buttScrew, via: 'Collar corners (butt joint)' },
    { partId: h.transomScrew, via: 'Port transom (with tunnel)' },
    { partId: h.jambScrew, via: 'Port jambs (with tunnel)' },
    { partId: h.thresholdScrew, via: 'Threshold and cover battens' },
    { partId: h.staple, via: 'Mesh to timber' },
    { partId: h.insertNut, via: 'Clamp threads in the collar' },
    { partId: h.jamNut, via: 'Spreader studs (jammed nuts)' },
    { partId: h.jamNut, via: 'Printed pads (lock nut on each spreader screw)' },
    { partId: windowInsertPadScrews().spreader.id, via: 'Printed pads (spreader screws, turned from inside)' },
    { partId: windowInsertPadScrews().bearing.id, via: 'Printed pads (in the feet under the sill)' },
    { partId: WINDOW_INSERT_PAD.thrustNut, via: 'Printed pads (on each spreader screw’s tip)' },
    ...WINDOW_INSERT_BRACKETS.map(id => ({ partId: id, via: 'Collar corners (flat corner bracket)' })),
    ...WINDOW_INSERT_BRACKETS.map(id => ({ partId: cornerBracketScrew(libraryPart(id)).id, via: 'Collar corners (screws of the corner brackets)' })),
    { partId: h.hookTop, via: 'Hung on the window frame (hooks at the head)' },
    { partId: h.hookBottom, via: 'Hung on the window frame (hooks at the sill)' },
    { partId: h.hookScrew, via: 'Hung on the window frame (screws of the hooks)' },
    { partId: PRINTED_CORNER_BRACKET_SCREW.screw, via: 'Collar corners (screws of the printed corner brackets)' },
    { partId: PRINTED_SCREEN_HOOK_SCREW.screw, via: 'Hung on the window frame (screws of the printed hooks)' },
    ...WINDOW_INSERT_FOOT.diameters.flatMap(d1 => {
      const { spreader, bearing } = windowInsertFeet(d1);
      return [{ partId: spreader.id, via: `Spreader feet (${d1} mm)` }, { partId: bearing.id, via: `Bearing feet under the sill (${d1} mm)` }];
    }),
  ].filter((link, index, all) => all.findIndex(other => other.partId === link.partId && other.via === link.via) === index),
  models: [
    { modelId: 'printed-corner-bracket', via: 'Collar corners (flat corner brackets, the default)' },
    { modelId: 'printed-screen-hook', via: 'Hung on the window frame (screen hooks, the default)' },
    { modelId: 'pressure-pad', via: 'Spreader and bearing feet (printed pads, the default)' },
  ],
};

/**
 * The catio tunnel: the fixed hardware of its couplings, sections and supports, by role. Couplings are bolted flange to flange
 * with M8 hexagon screws through two 30 mm flanges; each support leg (or a low bearer) stands on a levelling foot screwed into an
 * insert nut in its end grain, locked by the nut supplied on the foot's stud.
 */
export const TUNNEL_HARDWARE = {
  couplingBolt: 'iso-4017-m8x80',
  couplingWasher: 'iso-7093-m8',
  couplingNut: 'iso-4032-m8',
  footInsertNut: 'din-7965-m8x18',
  railScrew: 'din-7997-5x70',
  floorScrew: 'din-7997-4x40',
  cleatScrew: 'din-7997-4x35',
  bearerScrew: 'din-7997-6x100',
  braceScrew: 'din-7997-5x50',
  staple: 'din-1159-2-5x25',
  /** Through the printed toggle latches' plates at latched couplings: the latch model's default screw. */
  latchScrew: 'din-7997-4x25',
  /** Dowels in the bearers' tops, when the tunnel is held on its supports by them. */
  dowel: 'iso-2338-8x40',
} as const;

/** The tunnel's support feet: Ganter GN 343.2 KR on an M8 stud, in these diameters, each with its longest stud (the most travel). */
export const TUNNEL_FOOT = { thread: 'M8', diameters: [25, 32, 40] } as const;

/** The levelling foot of this diameter with the longest M8 stud: the stud's travel is what takes up uneven ground. */
export function tunnelFoot(d1: number): Part {
  return footWithStud(d1, Number.POSITIVE_INFINITY);
}

/**
 * The tunnel's printed support feet (the `pressure-pad` model as a foot), the default: the head of the longest ISO 4017 M8 screw in
 * the library locked in the pad, its shank up into the leg's insert nut, an ISO 4032 nut jammed up against the timber.
 */
export const TUNNEL_PAD = { thread: 'M8', fit: 0.4, relief: 1 } as const;
export function tunnelPadScrew(): Part {
  return hexScrew(TUNNEL_PAD.thread, Number.POSITIVE_INFINITY);
}

const t = TUNNEL_HARDWARE;
export const tunnelConcept: ConceptPage = {
  id: 'catio/tunnel', title: 'Window catio: tunnel',
  parts: [
    { partId: t.couplingBolt, via: 'Flange couplings' },
    { partId: t.couplingWasher, via: 'Flange couplings (both sides)' },
    { partId: t.couplingNut, via: 'Flange couplings' },
    { partId: t.footInsertNut, via: 'Foot threads in the supports' },
    { partId: t.railScrew, via: 'Rails into the flanges' },
    { partId: t.floorScrew, via: 'Floor boards onto the bottom rails' },
    { partId: t.cleatScrew, via: 'Floor cleats on sloped sections' },
    { partId: t.bearerScrew, via: 'Bearers to legs and flanges' },
    { partId: t.braceScrew, via: 'Support braces' },
    { partId: t.staple, via: 'Mesh to timber' },
    ...TUNNEL_FOOT.diameters.map(d1 => ({ partId: tunnelFoot(d1).id, via: `Support feet (${d1} mm)` })),
    { partId: tunnelPadScrew().id, via: 'Printed support feet (screw locked in each foot)' },
    { partId: hexScrew(TUNNEL_PAD.thread, 60).id, via: 'Printed feet under self-standing soles, for ±10 mm (the shorter screw stays inside the sole)' },
    { partId: t.couplingNut, via: 'Printed support feet (nut jammed against the leg)' },
    { partId: t.latchScrew, via: 'Printed toggle latches at the couplings' },
    { partId: t.dowel, via: 'Dowels in the bearers’ tops' },
    { partId: t.floorScrew, via: 'Strap cleats and turn-button keepers on the bearers’ ends' },
    { partId: t.braceScrew, via: 'Turn buttons’ pivots on the flanges' },
  ],
  models: [
    { modelId: 'pressure-pad', via: 'Support feet (printed, the default)' },
    { modelId: 'toggle-latch', via: 'Latched couplings (printed toggle latches)' },
  ],
};

/**
 * The catio's insert–tunnel coupling: the docking frame screwed to the window insert's cat port, and the toggle latches that join
 * the tunnel's first flange to it without tools. GN 831 latches of the short type (identification no. 2) fit the depth of the
 * joint; any of its types and both materials can be chosen.
 */
export const COUPLING_HARDWARE = {
  frameScrew: 'din-7997-5x60',
  /** When the insert hangs on the window frame, its port frame lies deeper in the recess and the docking frame is thicker. */
  frameScrewDeep: 'din-7997-6x90',
  latchScrew: 'din-7997-4x25',
  lipScrew: 'din-7997-4x25',
} as const;
export const COUPLING_LATCH = { types: ['S', 'A', 'SV'], materials: ['NI', 'ST'], identification: 2 } as const;
/** The GN 831 toggle latch of this type and material, short type: the one that fits between the flange and the docking frame. */
export function couplingLatch(type: typeof COUPLING_LATCH.types[number], material: typeof COUPLING_LATCH.materials[number]): Part {
  return libraryPart(`ganter-gn-831-100-${type.toLowerCase()}-${material.toLowerCase()}-${COUPLING_LATCH.identification}`);
}

const c = COUPLING_HARDWARE;
export const insertTunnelCouplingConcept: ConceptPage = {
  id: 'catio/insert-tunnel-coupling', title: 'Window catio: insert–tunnel coupling',
  parts: [
    { partId: c.frameScrew, via: 'Docking frame to the port jambs and transom' },
    { partId: c.frameScrewDeep, via: 'Docking frame to the port jambs and transom (insert hung on the window frame)' },
    { partId: c.latchScrew, via: 'Latches and catch brackets; floor lip' },
    ...COUPLING_LATCH.types.flatMap(type => COUPLING_LATCH.materials.map(material => ({ partId: couplingLatch(type, material).id, via: `Toggle latches (type ${type}, ${material === 'NI' ? 'stainless' : 'steel'})` }))),
  ],
  models: [{ modelId: 'toggle-latch', via: 'Toggle latches (printed, the default)' }],
};

/**
 * The catio's tunnel–tunnel coupling: how two sections' flanges are joined, by printed toggle latches (the `toggle-latch` model,
 * screwed on with its default screws) or by M8 bolts through both flanges with a large washer each side.
 */
export const tunnelTunnelCouplingConcept: ConceptPage = {
  id: 'catio/tunnel-tunnel-coupling', title: 'Window catio: tunnel–tunnel coupling',
  parts: [
    { partId: t.latchScrew, via: 'Printed toggle latches (base and catch plates)' },
    { partId: t.couplingBolt, via: 'Bolted couplings' },
    { partId: t.couplingWasher, via: 'Bolted couplings (both sides)' },
    { partId: t.couplingNut, via: 'Bolted couplings' },
  ],
  models: [{ modelId: 'toggle-latch', via: 'Latched couplings (printed toggle latches, the default)' }],
};

export const conceptPages: readonly ConceptPage[] = [windowInsertConcept, tunnelConcept, insertTunnelCouplingConcept, tunnelTunnelCouplingConcept];

/** The concept pages that use a model of the library, printed: what its editor lists under “Used by”. */
export function modelUsage(modelId: string): { pageId: string; title: string; via: string }[] {
  return conceptPages.flatMap(page => page.models.filter(link => link.modelId === modelId).map(link => ({ pageId: page.id, title: page.title, via: link.via })));
}
