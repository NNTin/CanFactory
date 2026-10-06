import { dimensionOf, type Part } from './parts/index.ts';
import { countersinkDiameter, plateScrewIssue, PRINTED_SCREW_SEAT } from './screwHoles.ts';

/**
 * The printed corner bracket (models/printed-corner-bracket/generator.scad, docs/printed-corner-bracket.md): a flat L-shaped plate
 * screwed across the corner of a timber frame, one leg on each member, as a bought flat corner bracket (Stuhlwinkel) is. Its frame,
 * as generated: the outer corner at the origin, leg A along +X, leg B along +Y, the plate's back (against the timber) on z = 0 and
 * its face, with the countersinks, at z = thickness. Millimetres.
 */
export interface PrintedCornerBracketSize {
  legA: number; legB: number; width: number; thickness: number;
  holesPerLeg: number; holeSpacing: number; firstHole: number;
}

/** The window catio's insert collar member (catioDesign.ts, CATIO.collarMember): 40 mm wide on its room-side face. The defaults follow it. */
export const WINDOW_INSERT_MEMBER = 40;

/**
 * The bracket's sizes for a frame of `member`-wide members, the defaults: legs of 2.5 members, as the 100 mm bracket on the 40 mm
 * collar it replaces; half a member wide, so that it lies on the member's outer half (beside the screen hooks of a hung insert);
 * 5 mm thick; and three holes on each leg, spread over the part of the leg that lies on the other member, past the joint, so that
 * every screw holds the member its leg runs along.
 */
export function printedCornerBracketFor(member: number): PrintedCornerBracketSize {
  const leg = 2.5 * member; const holesPerLeg = 3; const holeSpacing = (leg - member) / holesPerLeg;
  return { legA: leg, legB: leg, width: member / 2, thickness: 5, holesPerLeg, holeSpacing, firstHole: member + holeSpacing / 2 };
}

export const PRINTED_CORNER_BRACKET_DEFAULT = printedCornerBracketFor(WINDOW_INSERT_MEMBER);
/** DIN 7997 4 × 35: through the 5 mm plate it bites 30 mm into the timber, as the bought brackets' screws do. */
export const PRINTED_CORNER_BRACKET_SCREW = { diameter: '4 mm', screw: 'din-7997-4x35' } as const;

/** The holes, in the plate's plane: on leg `a` or `b`, `along` it from the outer corner and `across` it from its outer edge. */
export function printedCornerBracketHoles(p: PrintedCornerBracketSize): { leg: 'a' | 'b'; along: number; across: number }[] {
  return (['a', 'b'] as const).flatMap(leg => Array.from({ length: p.holesPerLeg }, (_, i) => ({ leg, along: p.firstHole + i * p.holeSpacing, across: p.width / 2 })));
}

/** What keeps these sizes and this screw from making a bracket, by the parameter to change. */
export function printedCornerBracketIssues(p: PrintedCornerBracketSize, screw: Part): { field: string; message: string }[] {
  const issues: { field: string; message: string }[] = [];
  const seat = plateScrewIssue(screw, p.thickness, p.width);
  if (seat) issues.push({ field: 'woodScrew', message: seat });
  const sink = countersinkDiameter(screw) / 2 + PRINTED_SCREW_SEAT.wall;
  if (p.holesPerLeg > 1 && p.holeSpacing < 2 * sink - 1e-9) issues.push({ field: 'holeSpacing', message: `The countersinks of a ${screw.designation} need the holes at least ${2 * sink} mm apart.` });
  // the first hole past the corner square, so that each leg's holes stay off the other leg's
  if (p.firstHole - sink < p.width - 1e-9) issues.push({ field: 'firstHole', message: `The first hole must be at least ${p.width + sink} mm from the outer corner, past the corner square.` });
  const last = p.firstHole + (p.holesPerLeg - 1) * p.holeSpacing + sink;
  for (const [field, leg] of [['legA', p.legA], ['legB', p.legB]] as const)
    if (last > leg + 1e-9) issues.push({ field, message: `The ${p.holesPerLeg} holes ${p.holeSpacing} mm apart, the first ${p.firstHole} mm from the corner, need the leg at least ${Math.ceil(last)} mm long.` });
  return issues;
}

/** How far a screw reaches into the timber through the plate: its head sits flush in the countersink. */
export const printedCornerBracketBite = (p: PrintedCornerBracketSize, screw: Part) => dimensionOf(screw, 'l') - p.thickness;
