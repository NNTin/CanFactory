import type { CSSProperties } from 'react';
import { findPart, PRINTED_SCREEN_HOOK_DEFAULT as H, PRINTED_SCREEN_HOOK_SCREW, printedScreenHookShape } from '@canfactory/contracts';

/** The model's default window (a VEKA Softline 82 MD): its lip and seal gap. */
const WINDOW = { frameLip: 15.5, sealGap: 3.5 };
const SCREW = findPart(PRINTED_SCREEN_HOOK_SCREW.screw);
const P = { ...H, ...WINDOW };
const S = SCREW ? printedScreenHookShape(P, SCREW) : null;

/** Pixels per millimetre, and where the head lip's tip on the frame's outer face is drawn. */
const SCALE = 1.6, FACE_X = 122, TIP_Y = 80;
/** Seen from the side, the room to the left: `u` into the window from the frame's face, `v` up from the lip's tip. */
const x = (u: number) => FACE_X - u * SCALE, y = (v: number) => TIP_Y - v * SCALE;
const rect = (u0: number, u1: number, v0: number, v1: number) => `M${x(u0)} ${y(v0)}H${x(u1)}V${y(v1)}H${x(u0)}Z`;

/**
 * The long printed screen hook at the window's head, in section, at the model's default window: the fixed frame's lip above its
 * tip, the closed sash behind the seal gap, the insert's stile on the frame's face and the hook screwed to the stile's back, its
 * barb up behind the lip in the middle of the seal gap. On card hover or focus the insert is lifted by the short hooks' rise, as it
 * is to hang it, and let down again (`.psh-*` in styles.css).
 */
export function PrintedScreenHookIllustration() {
  if (!S) return <svg viewBox="0 0 240 190" aria-hidden="true" />;
  const lip = P.frameLip, sash = lip + P.sealGap;
  const turnTop = -S.headClear;
  const hook = `M${x(0)} ${y(turnTop - P.legLength)}H${x(P.legThickness)}V${y(turnTop - P.turnThickness - S.gusset)}L${x(P.legThickness + S.gusset)} ${y(turnTop - P.turnThickness)}H${x(S.back)}V${y(turnTop + S.rise.long)}H${x(S.front)}V${y(turnTop)}H${x(0)}Z`;
  return <svg viewBox="0 0 240 190" aria-hidden="true" className="printed-screen-hook-illustration" style={{ '--psh-lift': `${(-S.lift * SCALE).toFixed(1)}px` } as CSSProperties}>
    {/* the fixed frame's lip above its tip, and the frame's body over the sash behind it */}
    <path d={rect(0, lip, 0, 30)} fill="#d6d9d2" stroke="#a8ad9f" strokeWidth="1" />
    <path d={rect(lip, sash + 30, 18, 30)} fill="#d6d9d2" stroke="#a8ad9f" strokeWidth="1" />
    {/* the closed sash behind the seal gap, its glass, and the seal pressed against the lip's back */}
    <path d={rect(sash, sash + 30, -52, 18)} fill="#eef0ea" stroke="#c3c8bb" strokeWidth="1" />
    <path d={rect(sash + 14, sash + 19, -52, 6)} fill="#cfe0e8" />
    <path d={rect(lip, sash, 10, 17)} fill="#3d4246" opacity=".75" />
    <g className="psh-part psh-insert">
      {/* the insert's stile on the frame's face, 15 mm past the lip's tip, and the hook screwed to its back, barb up behind the lip */}
      <path d={rect(-36, 0, turnTop - P.legLength - 6, 15)} fill="#e4cf9e" stroke="#cdb57f" strokeWidth="1" />
      <path d={hook} fill="#5f7350" stroke="#4b5c3f" strokeWidth=".8" strokeLinejoin="round" />
      {S.holes.map(v => <path key={v} d={rect(-12, P.legThickness, turnTop + v - 1, turnTop + v + 1)} fill="#8d9298" />)}
    </g>
  </svg>;
}
