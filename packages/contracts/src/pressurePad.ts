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

/** The nut's and the screw's dimensions an extender is sized from (largest values): heights and widths across flats. */
const nutHeight = (nut: Part) => dimensionOf(nut, nut.dimensions['h'] ? 'h' : 'm', 'max');

/**
 * The shortest extender: a lip at each end, the nut's hexagon pocket, at least `floor` of hollow bore between them (the screw
 * below runs on up it through the nut, as far as the leg's height needs) and the next screw's head pocket.
 */
export function pressurePadMinExtenderLength(nut: Part, screw: Part, fit: number): number {
  return 2 * PRESSURE_PAD.lip + nutHeight(nut) + fit + PRESSURE_PAD.floor + dimensionOf(screw, 'k', 'max') + fit;
}

/** The narrowest extender that leaves `wall` round the larger of its two hexagon pockets. */
export function pressurePadMinExtenderDiameter(nut: Part, screw: Part, fit: number): number {
  return (Math.max(dimensionOf(nut, 's', 'max'), dimensionOf(screw, 's', 'max')) + 2 * fit) * 2 / Math.sqrt(3) + 2 * PRESSURE_PAD.wall;
}

type LegShape = { padType: PressurePadType; height: number; fit: number; extenders: number; extenderLength: number };

/**
 * How far a screw may run on through an extender's nut into its hollow bore, past the nut's far face, which sets the leg's height
 * at that joint: `travel` up the bore to the next head's pocket, and `max`, less when the screw is too short to leave room for the
 * lock nut jammed against the extender's end as well (negative when it cannot take the lock nut at all).
 */
export function pressurePadExtenderTravel(p: LegShape, nut: Part, screw: Part): { travel: number; max: number } {
  const { lip } = PRESSURE_PAD; const nutH = nutHeight(nut); const l = dimensionOf(screw, 'l');
  const travel = p.extenderLength - 2 * lip - nutH - dimensionOf(screw, 'k', 'max') - p.fit;
  // foot: the screw leaves the pad's (or the extender's) lip below, passes the lock nut and the extender's lip into the nut;
  // thrust pad: the screw comes down past its lock nut and the extender's top lip into the nut
  const room = p.padType === 'foot' ? l - 2 * lip - nutH - nutH : l - lip - nutH - nutH;
  return { travel, max: Math.min(travel, room) };
}

/** A piece of a pressure pad's leg, placed: a printed part (`pad`, `extender-<n>`) or a library nut or screw. */
export interface PressurePadPiece {
  id: string; kind: 'pad' | 'extender' | 'nut' | 'screw';
  /** Its pose: its own frame (the STL as rendered, or the library part's: a screw's tip on z = 0 with its head up, a nut standing
   * on z = 0) turned about X, then Z, then moved. */
  position: [number, number, number]; rotation: [number, number, number];
  /** The two ends along the leg's axis, for the tests. */
  bottom: number; top: number;
}

/**
 * The leg as it stands, its sole on the floor (z = 0) and its axis along Z; every pocket's slot opens along +X. A library nut or
 * hexagon head is turned 30° about Z, so that its flats lie along the slot (the parts' own frames have their corners on Y).
 * `settings` gives, per extender, how far (0 to 1 of `pressurePadExtenderTravel`'s `max`) its screw has run on into its bore:
 * 0, the screw's tip flush with the nut's far face, is the longest leg and how an extender is slid on (the bore has no slot); the
 * default.
 *
 * - Foot: the pad (printed back up) holds the first screw's head, shank up. Each extender stands on the screw below it: a nut,
 *   locked in its bottom pocket, is run onto that screw, which runs on up the hollow bore; a lock nut on the screw is jammed up
 *   against the extender's bottom. The next screw's head sits in its top pocket.
 * - Thrust pad: a nut on the first screw's tip, flush with it, bears on the pad's chamber floor; the screw's head is up. Each
 *   extender is turned over, its head pocket down over the screw's head and its nut pocket up: the next screw, a lock nut on it,
 *   comes down through that nut into the bore, and the lock nut is jammed down on the extender's top.
 */
export function pressurePadLeg(p: LegShape, nut: Part, screw: Part, settings: readonly number[] = []): PressurePadPiece[] {
  const { lip } = PRESSURE_PAD; const { fit, height: H, extenderLength: L } = p;
  const nutH = nutHeight(nut); const l = dimensionOf(screw, 'l'); const k = dimensionOf(screw, 'k', 'max');
  const run = (i: number) => Math.max(0, pressurePadExtenderTravel(p, nut, screw).max) * (settings[i - 1] ?? 0);
  const pieces: PressurePadPiece[] = [{ id: 'pad', kind: 'pad', position: [0, 0, H], rotation: [180, 0, 0], bottom: 0, top: H }];
  const screwUp = (id: string, tip: number): PressurePadPiece => ({ id, kind: 'screw', position: [0, 0, tip], rotation: [0, 0, 30], bottom: tip, top: tip + l + k });
  const screwDown = (id: string, bearing: number): PressurePadPiece => ({ id, kind: 'screw', position: [0, 0, bearing + l], rotation: [180, 0, 30], bottom: bearing - k, top: bearing + l });
  const nutAt = (id: string, bottom: number, turned: boolean): PressurePadPiece =>
    ({ id, kind: 'nut', position: [0, 0, turned ? bottom + nutH : bottom], rotation: [turned ? 180 : 0, 0, 30], bottom, top: bottom + nutH });
  const extender = (index: number, bottom: number, turned: boolean): PressurePadPiece =>
    ({ id: `extender-${index}`, kind: 'extender', position: [0, 0, turned ? bottom + L : bottom], rotation: [turned ? 180 : 0, 0, 0], bottom, top: bottom + L });
  if (p.padType === 'foot') {
    // the head bears on the pad's lip: the screw leaves the pad's back
    let below = screwDown('screw-0', H - lip); pieces.push(below);
    for (let i = 1; i <= p.extenders; i++) {
      // the screw's tip has run `run(i)` past the nut, which stands on the extender's bottom lip
      const bottom = below.top - run(i) - nutH - lip;
      pieces.push(nutAt(`locknut-${i}`, bottom - nutH, false), nutAt(`nut-${i}`, bottom + lip, false), extender(i, bottom, false));
      below = screwDown(`screw-${i}`, bottom + L - lip); pieces.push(below);
    }
  } else {
    // the nut bears on the chamber's floor (towards the sole), the screw's tip flush with it
    const seat = H - lip - nutH - fit;
    pieces.push(nutAt('nut-0', seat, true));
    let below = screwUp('screw-0', seat); pieces.push(below);
    for (let i = 1; i <= p.extenders; i++) {
      // turned over: the head pocket down, its lip under the screw's head; the nut pocket up, the nut against its top lip
      const bottom = below.bottom + l - lip;
      const nutBottom = bottom + L - lip - nutH;
      pieces.push(extender(i, bottom, true), nutAt(`nut-${i}`, nutBottom, true), nutAt(`locknut-${i}`, bottom + L, true));
      below = screwUp(`screw-${i}`, nutBottom - run(i)); pieces.push(below);
    }
  }
  return pieces;
}
