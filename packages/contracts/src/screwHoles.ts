import { dimensionOf, ISO_273_CLEARANCE_HOLES, type MetricThread, type Part } from './parts/index.ts';

/**
 * Clearance holes for library screws, shared by the printed parts that are screwed on (the toggle latch's plates, the printed corner
 * bracket, the printed screen hook): DIN EN 20273 (ISO 273) for a metric thread, and for a wood screw, which the standard does not
 * cover, the same allowances over its diameter as it gives for M4 and M5.
 */
export const WOOD_SCREW_PLAY = { fine: 0.3, medium: 0.5, coarse: 0.8 } as const;

/** The three clearance holes (fine, medium, coarse) for a library screw: DIN EN 20273 for a metric thread, the allowances above for a wood screw. */
export function clearanceHoles(part: Part): [number, number, number] {
  if (part.family === 'wood-screw') {
    const d = dimensionOf(part, 'd');
    return [WOOD_SCREW_PLAY.fine, WOOD_SCREW_PLAY.medium, WOOD_SCREW_PLAY.coarse].map(play => Math.round((d + play) * 100) / 100) as [number, number, number];
  }
  const thread = String(part.attributes['thread']);
  if (!(thread in ISO_273_CLEARANCE_HOLES)) throw new Error(`${part.id} has no DIN EN 20273 clearance hole.`);
  const holes = ISO_273_CLEARANCE_HOLES[thread as MetricThread];
  return [holes.fine, holes.medium, holes.coarse];
}

/**
 * A countersunk wood screw's seat in a printed plate, as the toggle latch's plates have it: a countersink `sinkPlay` wider than the
 * head and as deep as the head is high, so that the head sits flush; under it at least `minStraight` of plain hole; `wall` of plate
 * round the countersink; and the screw reaching at least `minReach` past the plate's back.
 */
export const PRINTED_SCREW_SEAT = { sinkPlay: 0.4, minStraight: 1, wall: 1.5, minReach: 4 } as const;

/** The countersink's diameter at the plate's face, for a countersunk screw. */
export const countersinkDiameter = (screw: Part) => dimensionOf(screw, 'dk', 'max') + PRINTED_SCREW_SEAT.sinkPlay;

/** Why a countersunk wood screw does not seat in a printed plate `thickness` thick and `width` wide (the hole across it), if it does not. */
export function plateScrewIssue(screw: Part, thickness: number, width: number): string | null {
  const s = PRINTED_SCREW_SEAT;
  if (screw.family !== 'wood-screw' || screw.attributes['head'] !== 'countersunk') return `${screw.designation} is not a countersunk wood screw.`;
  if (dimensionOf(screw, 'k', 'max') > thickness - s.minStraight + 1e-9) return `The ${dimensionOf(screw, 'dk')} mm head of a ${screw.designation} is ${dimensionOf(screw, 'k')} mm high: the plate must be at least ${dimensionOf(screw, 'k', 'max') + s.minStraight} mm thick to take its countersink.`;
  if (countersinkDiameter(screw) + 2 * s.wall > width + 1e-9) return `The countersink of a ${screw.designation} (${countersinkDiameter(screw)} mm) needs a strip at least ${countersinkDiameter(screw) + 2 * s.wall} mm wide.`;
  if (dimensionOf(screw, 'l') < thickness + s.minReach - 1e-9) return `A ${screw.designation} is too short: it must reach at least ${s.minReach} mm past the ${thickness} mm plate.`;
  return null;
}

/**
 * Every DIN 7997 countersunk wood screw of the library, by diameter: the printed corner bracket and screen hook offer them all, and
 * their validation says when one does not seat (`plateScrewIssue`). Listed rather than computed, so that the parameters' types name
 * them; a test keeps the list equal to the library's.
 */
export const PRINTED_WOOD_DIAMETERS = ['3 mm', '3.5 mm', '4 mm', '4.5 mm', '5 mm', '6 mm'] as const;
export const PRINTED_WOOD_SCREWS = [
  'din-7997-3x12', 'din-7997-3x16', 'din-7997-3x20', 'din-7997-3x25', 'din-7997-3x30', 'din-7997-3-5x16', 'din-7997-3-5x20',
  'din-7997-3-5x25', 'din-7997-3-5x30', 'din-7997-3-5x35', 'din-7997-3-5x40', 'din-7997-4x20', 'din-7997-4x25', 'din-7997-4x30',
  'din-7997-4x35', 'din-7997-4x40', 'din-7997-4x45', 'din-7997-4x50', 'din-7997-4-5x25', 'din-7997-4-5x30', 'din-7997-4-5x35',
  'din-7997-4-5x40', 'din-7997-4-5x45', 'din-7997-4-5x50', 'din-7997-4-5x60', 'din-7997-5x30', 'din-7997-5x35', 'din-7997-5x40',
  'din-7997-5x50', 'din-7997-5x60', 'din-7997-5x70', 'din-7997-5x80', 'din-7997-6x40', 'din-7997-6x50', 'din-7997-6x60',
  'din-7997-6x70', 'din-7997-6x80', 'din-7997-6x90', 'din-7997-6x100',
] as const;
export type PrintedWoodScrew = typeof PRINTED_WOOD_SCREWS[number];
