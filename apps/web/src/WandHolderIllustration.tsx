import { DEFAULT_WAND_HOLDER, WAND_HOLDER as W, wandHolderLayout } from '@canfactory/contracts';

type Point2 = [number, number];
const DEG = Math.PI / 180;
const L = wandHolderLayout(DEFAULT_WAND_HOLDER);
const pts = (points: Point2[]) => points.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(' ');
/** An arc of radius r about (cx, cy) from `from` to `to` degrees (counter-clockwise, y up in the model's frame, down on screen). */
const arc = (cx: number, cy: number, r: number, from: number, to: number, n = 48): Point2[] =>
  Array.from({ length: n + 1 }, (_, i): Point2 => { const a = (from + (to - from) * i / n) * DEG; return [cx + r * Math.cos(a), cy - r * Math.sin(a)]; });

/** Dimension-derived schematic of the default holder on a ~100 mm post. The editor's STL viewer shows the real part. */
export function WandHolderIllustration() {
  // Side view, looking along +Y: the post upright, the clip round it (mouth to the right), the socket on the left with the wand in it.
  const s = 0.62, cx = 70, ground = 205, post = 100 * s;
  const clipBottom = 118, clipTop = clipBottom - W.height * s;
  const outside = (L.crest + W.ridge + W.band) * 100 / W.gripD * s;
  const tubeX = cx + L.tubeX * 100 / W.gripD * s, tubeR = L.tube * s, tubeTop = clipBottom - L.tubeHeight * s, boreR = L.bore * s;
  const handleTop = tubeTop - 42, handleR = DEFAULT_WAND_HOLDER.handleDiameter / 2 * s;
  const rope = Array.from({ length: 30 }, (_, i) => ground - 4 - i * 6.5).filter(y => y > 18 && (y > clipBottom + 1 || y < clipTop - 1));

  // Plan view, from above: the clip seated on the post (opened from its relaxed size to the post's), and arrows for the arms'
  // spread as the post goes in.
  const k = 100 / W.gripD, p = 0.58 * k, px = 180, py = 66;
  const band = (r0: number, r1: number) => {
    const from = L.tip, to = 360 - L.tip;
    return pts([...arc(px, py, r1 * p, from, to), ...arc(px, py, r0 * p, to, from)]);
  };
  const lip = (side: 1 | -1): [Point2, Point2] => {
    const a = L.tip * DEG, d = W.flareAngle * DEG;
    const start: Point2 = [px + L.middle * p * Math.cos(a), py - side * L.middle * p * Math.sin(a)];
    const end: Point2 = [start[0] + W.flare * p * Math.cos(d), start[1] - side * W.flare * p * Math.sin(d)];
    return [start, end];
  };
  return <svg className="wand-holder-illustration" viewBox="0 0 250 210" role="img" aria-label="A wand holder clipped round a sisal scratching post, a feather wand standing in its socket; above, the clip seen from the top, spreading to snap on">
    <defs>
      <pattern id="wh-sisal" width="6" height="6.5" patternUnits="userSpaceOnUse"><rect width="6" height="6.5" fill="#d8c398" /><path d="M0,6 L6,4.5" stroke="#b49a68" strokeWidth="1.1" /></pattern>
    </defs>
    {/* floor and post */}
    <ellipse cx={cx} cy={ground} rx={post * 0.75} ry="4" fill="#dce5df" />
    <rect x={cx - post / 2} y="14" width={post} height={ground - 14} fill="url(#wh-sisal)" stroke="#9c845a" strokeWidth=".7" />
    {rope.map(y => <path key={y} d={`M${cx - post / 2},${y} q ${post / 2} 2.2 ${post} -1.2`} fill="none" stroke="#a58b5c" strokeWidth=".5" />)}
    {/* the clip's band in front of the post, its socket on the left, its lip on the right */}
    <rect x={cx - outside} y={clipTop} width={2 * outside} height={clipBottom - clipTop} rx="1.5" fill="#2f8f6f" stroke="#1f5f4a" strokeWidth=".8" />
    {Array.from({ length: 5 }, (_, i) => clipTop + (i + 1) * (clipBottom - clipTop) / 6).map(y => <line key={y} x1={cx - outside + 3} x2={cx + outside - 3} y1={y} y2={y} stroke="#287a5f" strokeWidth=".5" />)}
    <rect x={tubeX - tubeR} y={tubeTop} width={2 * tubeR} height={clipBottom - tubeTop} rx="1.5" fill="#3aa27f" stroke="#1f5f4a" strokeWidth=".8" />
    <rect x={tubeX - boreR} y={tubeTop} width={2 * boreR} height="1.6" fill="#1f5f4a" />
    {/* the wand: its rigid handle in the socket, a spring wire bending over to the feathers */}
    <rect x={tubeX - handleR} y={handleTop} width={2 * handleR} height={tubeTop - handleTop + 14} rx="1" fill="#e2a14a" stroke="#a46d26" strokeWidth=".6" />
    <path d={`M${tubeX},${handleTop} C ${tubeX - 4},${handleTop - 30} ${tubeX + 40},${handleTop - 52} ${tubeX + 70},${handleTop - 40}`} fill="none" stroke="#6d7479" strokeWidth="1.1" />
    <g transform={`translate(${tubeX + 70} ${handleTop - 40}) rotate(28)`}>
      {[-30, -10, 10, 30].map(a => <path key={a} d="M0,0 q 6,-4 16,-2 q -8,3 -16,2 Z" transform={`rotate(${a})`} fill={a < 0 ? '#d9574a' : '#5d8fd0'} stroke="#7a3a33" strokeWidth=".35" />)}
    </g>
    {/* the plan view */}
    <circle cx={px} cy={py} r={L.crest * p} fill="url(#wh-sisal)" stroke="#9c845a" strokeWidth=".6" />
    <polygon points={band(L.inside, L.outside)} fill="#2f8f6f" stroke="#1f5f4a" strokeWidth=".6" />
    {([1, -1] as const).map(side => {
      const [ex, ey] = lip(side)[1];
      return <g key={`l${side}`}>
        <polyline points={pts(lip(side))} fill="none" stroke="#2f8f6f" strokeWidth={W.band * p} strokeLinecap="round" />
        <path d={`M${ex + 3},${ey - side * 3} v${-side * 9}`} stroke="#52665b" strokeWidth=".9" />
        <path d={`M${ex + 3},${ey - side * 14} l-2.6,${side * 4} h5.2 Z`} fill="#52665b" />
      </g>;
    })}
    <path d={`M${px + L.tubeX * p + L.tube * p},${py - 6} L${px - L.outside * p + 0.5},${py - 11} L${px - L.outside * p + 0.5},${py + 11} L${px + L.tubeX * p + L.tube * p},${py + 6} Z`} fill="#2f8f6f" />
    <circle cx={px + L.tubeX * p} cy={py} r={L.tube * p} fill="#3aa27f" stroke="#1f5f4a" strokeWidth=".6" />
    <circle cx={px + L.tubeX * p} cy={py} r={L.bore * p} fill="#e2a14a" stroke="#a46d26" strokeWidth=".4" />
    {/* push: the post goes into the mouth */}
    <path d={`M${px + 66},${py} h-12`} stroke="#52665b" strokeWidth="1.2" />
    <path d={`M${px + 54},${py - 3.5} l-5,3.5 l5,3.5 Z`} fill="#52665b" />
    <text x="128" y="132" fill="#52665b" fontSize="7" letterSpacing="1">SNAPS ON FROM THE SIDE</text>
    <text x="128" y="144" fill="#52665b" fontSize="7" letterSpacing="1">{`POSTS ${W.postMin}–${W.postMax} MM`}</text>
    <text x="128" y="156" fill="#52665b" fontSize="7" letterSpacing="1">{`Ø${DEFAULT_WAND_HOLDER.handleDiameter} SOCKET, ${DEFAULT_WAND_HOLDER.socketDepth} DEEP`}</text>
  </svg>;
}
