import { dimensionOf, parts, type Part } from './parts/index.ts';

/**
 * The printed pressure pad (models/pressure-pad/generator.scad, docs/pressure-pad.md): a round pad on the end of a library
 * screw, in place of a bought levelling foot. A thrust pad holds a nut run onto the screw's tip in a round chamber, where it
 * turns freely, so the pad presses without turning; a foot locks the screw's hexagon head in a hexagon pocket, so turning the pad
 * turns the screw. Either is slid on sideways and held in by the lip over the nut or head.
 *
 * Along the screw, a pad is measured from its back (the lip's outer face, against the insert nut or timber) to its sole.
 */

/** The fixed sizes of the generator (LIP, FLOOR, TIP, WALL, SNAP, CHAMFER); a test compares them with the SCAD file. */
export const PRESSURE_PAD = {
  /** The back over the nut or head, which holds it in. */
  lip: 3,
  /** Solid between the chamber (or the tip recess) and the sole's grooves or dome. */
  floor: 3,
  /** A thrust pad's recess under its nut, for the screw's tip. */
  tipRecess: 2,
  /** Least wall round the chamber. */
  wall: 3,
  /** Each of the two bumps at the chamber's mouth narrows it this much below the nut's or head's width across flats. */
  snap: 0.15,
  chamfer: 0.8,
} as const;

export const PRESSURE_PAD_TYPES = ['thrust', 'foot'] as const;
export type PressurePadType = typeof PRESSURE_PAD_TYPES[number];
export const PRESSURE_PAD_SURFACES = ['flat', 'grooved', 'domed'] as const;
export type PressurePadSurface = typeof PRESSURE_PAD_SURFACES[number];

/** What decides a pad's least size besides the nut or screw it holds. */
export interface PressurePadShape { padType: PressurePadType; surface: PressurePadSurface; relief: number; fit: number }

/** The pocket for the nut (thrust) or the screw's head (foot): its depth, the shank's hole, the chamber's widest extent. */
export function pressurePadPocket(padType: PressurePadType, part: Part, fit: number) {
  const flats = dimensionOf(part, 's', 'max');
  const thrust = padType === 'thrust';
  const height = thrust ? dimensionOf(part, part.dimensions['h'] ? 'h' : 'm', 'max') : dimensionOf(part, 'k', 'max');
  return {
    depth: height + fit, hole: dimensionOf(part, 'd') + 2 * fit,
    // a nut turns in a round chamber over its corners; a head sits in a hexagon pocket
    chamber: thrust ? flats * 2 / Math.sqrt(3) + 2 * fit : (flats + 2 * fit) * 2 / Math.sqrt(3),
    recess: thrust ? PRESSURE_PAD.tipRecess : 0,
  };
}

/** The lowest pad that holds this nut or screw head over a solid floor and the sole's relief. */
export function pressurePadMinHeight(shape: PressurePadShape, part: Part): number {
  const pocket = pressurePadPocket(shape.padType, part, shape.fit);
  return PRESSURE_PAD.lip + pocket.depth + pocket.recess + PRESSURE_PAD.floor + (shape.surface === 'flat' ? 0 : shape.relief);
}

/** The narrowest pad that leaves `wall` round the chamber. */
export function pressurePadMinDiameter(shape: Pick<PressurePadShape, 'padType' | 'fit'>, part: Part): number {
  return pressurePadPocket(shape.padType, part, shape.fit).chamber + 2 * PRESSURE_PAD.wall;
}

/**
 * How far into the pad, from its back, the screw is held: a thrust pad's nut is run on until the screw's tip is flush with its far
 * face, so the tip lies the lip and the nut's height in; a foot's head bears on the lip, so the screw leaves the pad at its back.
 */
export function pressurePadSeat(padType: PressurePadType, part: Part): number {
  return padType === 'thrust' ? PRESSURE_PAD.lip + dimensionOf(part, part.dimensions['h'] ? 'h' : 'm', 'max') : PRESSURE_PAD.lip;
}

/** The shortest ISO 4017 hexagon head screw of this thread at least `least` long, else the longest there is. */
export function hexScrew(thread: string, least: number): Part {
  const candidates = parts.filter(p => p.family === 'screw' && p.attributes['standard'] === 'ISO 4017' && p.attributes['thread'] === thread)
    .sort((a, b) => dimensionOf(a, 'l') - dimensionOf(b, 'l'));
  const found = candidates.find(p => dimensionOf(p, 'l') >= least - 1e-9) ?? candidates.at(-1);
  if (!found) throw new Error(`The parts library has no ISO 4017 ${thread} screw.`);
  return found;
}
