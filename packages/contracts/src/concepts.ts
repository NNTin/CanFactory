import { dimensionOf, findPart, parts, type Part } from './parts/index.ts';

/**
 * Concept pages that use parts of the library, so that the library's “Used by” lists them beside the models. A concept is
 * not a model (no SCAD, no render): its page lives in the web app at `#/concepts/<id>`, and the part ids it may use are
 * listed here, once, for both that page and the library.
 */
export interface ConceptPartLink { partId: string; via: string }
export interface ConceptPage { id: string; title: string; parts: ConceptPartLink[] }

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
} as const;

/** The window insert's clamp feet: Ganter GN 343.2 KR on an M8 stud, in these diameters. */
export const WINDOW_INSERT_FOOT = { thread: 'M8', diameters: [25, 32, 40], member: 40, travel: 8 } as const;

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
    ...WINDOW_INSERT_FOOT.diameters.flatMap(d1 => {
      const { spreader, bearing } = windowInsertFeet(d1);
      return [{ partId: spreader.id, via: `Spreader feet (${d1} mm)` }, { partId: bearing.id, via: `Bearing feet under the sill (${d1} mm)` }];
    }),
  ].filter((link, index, all) => all.findIndex(other => other.partId === link.partId && other.via === link.via) === index),
};

export const conceptPages: readonly ConceptPage[] = [windowInsertConcept];
