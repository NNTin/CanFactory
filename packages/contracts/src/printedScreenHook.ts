import type { Part } from './parts/index.ts';
import { countersinkDiameter, plateScrewIssue, PRINTED_SCREW_SEAT } from './screwHoles.ts';

/**
 * The printed insect-screen hook (models/printed-screen-hook/generator.scad, docs/printed-screen-hook.md): a leg screwed to the back of
 * a screen frame (the window catio insert's stile), a turn into the window just inside the fixed frame's lip, and a barb that
 * reaches behind the lip, in the seal gap in front of the closed sash. It is made for one window: the barb stands where the lip's
 * thickness and the seal gap put it, so nothing is bent on site. The long hook goes at the head (its barb up behind the head lip),
 * the short one at the sill (barb down behind the sill lip): lifted, the frame hangs on the long hooks, and let down, the short
 * ones drop behind the sill lip.
 *
 * Its section, as generated (`u`, `v`): `u` from the leg's face on the stile into the window, `v` along the stile from the turn's
 * outer face (the face towards the lip's tip) away from the leg; the barb rises to +v, the leg runs to -v. Millimetres.
 */

/**
 * How a screen hook sits on the window, for every hook (bought or printed). Once the feet stand, the short hooks' turns clear the
 * sill lip's tip by `clearance`, so the feet carry the insert and the hooks only keep it on the frame. Each barb lies in the seal
 * gap, `gap` clear of the lip's back and of the closed sash, and reaches at least `engage` behind the lip.
 */
export const SCREEN_HOOK_FIT = { clearance: 1, gap: 0.5, engage: 3 } as const;

export interface PrintedScreenHookSize {
  /** The window: the fixed frame's lip, from its outer face to its back, and the seal gap from there to the closed sash. */
  frameLip: number; sealGap: number;
  /** How far both barbs reach behind the lip, hung; and how far the short hooks' turns stand off the sill lip. */
  engage: number; clearance: number;
  width: number; legLength: number; legThickness: number; turnThickness: number; barbThickness: number;
}

/** The strip's sizes: as wide as the bought strip and a little more, thick enough to print and screw into, the barb thin enough for a seal gap. */
export const PRINTED_SCREEN_HOOK_DEFAULT = {
  engage: 6, clearance: SCREEN_HOOK_FIT.clearance, width: 10, legLength: 40, legThickness: 4, turnThickness: 4, barbThickness: 2,
} as const;
/** DIN 7997 3 × 20: through the 4 mm leg it bites 16 mm into the stile, as the bought hooks' 3 × 16 through their strip. */
export const PRINTED_SCREEN_HOOK_SCREW = { diameter: '3 mm', screw: 'din-7997-3x20' } as const;
/** The thinnest barb that prints well: three 0.4 mm lines. */
export const PRINTED_BARB_MIN = 1.2;
/** The largest fillet between the leg and the turn, on the side away from the lip. */
export const PRINTED_HOOK_GUSSET = 3;

/**
 * The hook's section and holes, from its sizes. `front` and `back` are the barb's faces (`u`): centred in the seal gap, so `front`
 * lies (gap - barb) / 2 behind the lip's back. `rise` is how far each barb stands past the turn's outer face: the short one reaches
 * `engage` behind the sill lip with its turn `clearance` off the lip's tip; to hang the insert it is lifted by that rise, so the long
 * hooks' turns stand that and `clearance` more below the head lip's tip, and their barbs rise `engage` past the tip from there.
 * `holes` are the two screw holes along the leg (`v`, negative), clear of the fillet and of the leg's end.
 */
export function printedScreenHookShape(p: PrintedScreenHookSize, screw: Part) {
  const front = p.frameLip + (p.sealGap - p.barbThickness) / 2;
  const back = front + p.barbThickness;
  const sill = p.engage + p.clearance; const headClear = sill + p.clearance;
  const rise = { long: p.engage + headClear, short: sill };
  const gusset = Math.max(0, Math.min(PRINTED_HOOK_GUSSET, front - p.legThickness - 0.5));
  const sink = countersinkDiameter(screw) / 2 + PRINTED_SCREW_SEAT.wall;
  const holes = [-(p.turnThickness + gusset + sink), -(p.legLength - sink)];
  return { front, back, rise, headClear, lift: sill, gusset, holes, sink };
}
export type PrintedScreenHookShape = ReturnType<typeof printedScreenHookShape>;

/** What keeps these sizes, for this window, from making a hook that hangs the frame and lets the sash close, by the parameter to change. */
export function printedScreenHookIssues(p: PrintedScreenHookSize, screw: Part): { field: string; message: string }[] {
  const issues: { field: string; message: string }[] = [];
  const seat = plateScrewIssue(screw, p.legThickness, p.width);
  if (seat) issues.push({ field: 'woodScrew', message: seat });
  const gap = SCREEN_HOOK_FIT.gap;
  if (p.barbThickness + 2 * gap > p.sealGap + 1e-9) issues.push({ field: 'barbThickness', message: `A ${p.barbThickness} mm barb leaves less than ${gap} mm each side in a ${p.sealGap} mm seal gap: the sash would not close over it. Make the barb thinner (at least ${PRINTED_BARB_MIN} mm), or use bought hooks.` });
  const shape = printedScreenHookShape(p, screw);
  // the leg, and its screws' heads, stand clear of the closed sash; the turn runs on from the leg to the barb
  if (p.legThickness > p.frameLip + p.sealGap - gap + 1e-9) issues.push({ field: 'legThickness', message: `The leg must be at most ${p.frameLip + p.sealGap - gap} mm thick to stand clear of the closed sash.` });
  else if (shape.front - p.legThickness < 1 - 1e-9) issues.push({ field: 'legThickness', message: `The leg must be at least 1 mm thinner than the lip and half the seal gap (${shape.front} mm), for the turn to reach the barb.` });
  const [first = 0, last = 0] = shape.holes;
  if (-last - -first < 2 * shape.sink - 1e-9) issues.push({ field: 'legLength', message: `The leg must be at least ${Math.ceil(p.turnThickness + shape.gusset + 3 * shape.sink)} mm long to take two screws.` });
  if (p.engage < SCREEN_HOOK_FIT.engage - 1e-9) issues.push({ field: 'engage', message: `The barbs must reach at least ${SCREEN_HOOK_FIT.engage} mm behind the lip.` });
  return issues;
}
