import { PRINTED_CORNER_BRACKET_DEFAULT as B, printedCornerBracketHoles, WINDOW_INSERT_MEMBER } from '@canfactory/contracts';

/** Pixels per millimetre, and where the frame's outer corner is drawn (top left: the bracket's leg A runs right, leg B down). */
const SCALE = 1.05, ORIGIN_X = 52, ORIGIN_Y = 30;
const px = (mm: number) => mm * SCALE;
const M = WINDOW_INSERT_MEMBER;
/** How far of each member is drawn, past the bracket's legs. */
const RAIL = B.legA + 50, STILE = B.legB + 40;

/**
 * The printed corner bracket at its default size on the window insert's collar corner, seen from the room side: the stile (full
 * height) and the head rail butted between, the green plate let in across the joint with its holes past the joint, each on the
 * member its leg runs along. On card hover or focus the plate lifts off, its screws rise out of it, and both settle again
 * (`.pcb-*` in styles.css).
 */
export function PrintedCornerBracketIllustration() {
  const holes = printedCornerBracketHoles(B).map(hole => hole.leg === 'a' ? { u: hole.along, v: hole.across } : { u: hole.across, v: hole.along });
  const sink = 4;
  return <svg viewBox="0 0 240 190" aria-hidden="true" className="printed-corner-bracket-illustration">
    <ellipse cx="128" cy="172" rx="96" ry="9" fill="#c8cec1" opacity=".35" />
    {/* the stile, full height, and the rail butted against it; the joint line between them */}
    <rect x={ORIGIN_X} y={ORIGIN_Y} width={px(M)} height={px(STILE)} fill="#e4cf9e" />
    <rect x={ORIGIN_X + px(M)} y={ORIGIN_Y} width={px(RAIL - M)} height={px(M)} fill="#ead8ac" />
    <path d={`M${ORIGIN_X + px(M)} ${ORIGIN_Y}V${ORIGIN_Y + px(M)}`} stroke="#b89a62" strokeWidth="1.2" />
    <path d={`M${ORIGIN_X + px(M)} ${ORIGIN_Y + px(M)}H${ORIGIN_X + px(RAIL)}M${ORIGIN_X + px(M)} ${ORIGIN_Y + px(M)}V${ORIGIN_Y + px(STILE)}`} stroke="#cdb57f" strokeWidth="1.5" />
    {/* the recess the plate is let into */}
    <path d={`M${ORIGIN_X} ${ORIGIN_Y}h${px(B.legA)}v${px(B.width)}h${-px(B.legA - B.width)}v${px(B.legB - B.width)}h${-px(B.width)}z`} fill="#b89a62" opacity=".5" />
    <g className="pcb-part pcb-plate">
      <path d={`M${ORIGIN_X} ${ORIGIN_Y}h${px(B.legA)}v${px(B.width)}h${-px(B.legA - B.width)}v${px(B.legB - B.width)}h${-px(B.width)}z`} fill="#5f7350" stroke="#4b5c3f" strokeWidth="1" strokeLinejoin="round" />
      <path d={`M${ORIGIN_X + 2} ${ORIGIN_Y + 2}h${px(B.legA) - 4}`} stroke="#8fa27c" strokeWidth="1.5" />
      {holes.map(({ u, v }) => <circle key={`${u}-${v}`} cx={ORIGIN_X + px(u)} cy={ORIGIN_Y + px(v)} r={sink} fill="#3d4b33" />)}
    </g>
    <g className="pcb-part pcb-screws">
      {holes.map(({ u, v }) => <g key={`${u}-${v}`}>
        <circle cx={ORIGIN_X + px(u)} cy={ORIGIN_Y + px(v)} r={sink - 0.6} fill="#a3a8ad" />
        <path d={`M${ORIGIN_X + px(u) - 2} ${ORIGIN_Y + px(v)}h4M${ORIGIN_X + px(u)} ${ORIGIN_Y + px(v) - 2}v4`} stroke="#5b6066" strokeWidth="1" />
      </g>)}
    </g>
  </svg>;
}
