import { useEffect, useRef, useState } from 'react';
import { DEFAULT_WINDOW_CAT_GUARD, windowCatGuardLayout } from '@canfactory/contracts';

/** Seconds for one cycle: tilt the window, the left panel, the right panel, the top strip, a pause, then everything back. */
const CYCLE_SECONDS = 9;
/** Pixels per millimetre; the gap (depth into the room) is drawn `DEPTH` times deeper so that the side panels read at card size. */
const SCALE = 0.155, DEPTH = 2.6;
/** Where the window opening's bottom-left corner (on the frame's plane) is drawn. */
const ORIGIN_X = 62, ORIGIN_Y = 150;

const P = DEFAULT_WINDOW_CAT_GUARD;
const LAYOUT = windowCatGuardLayout(P);
const W = P.width * SCALE, H = P.height * SCALE, GAP = P.gap * SCALE * DEPTH, TIP = P.tipWidth * SCALE * DEPTH;
const RIBS = LAYOUT.ribs.map(rib => rib * SCALE * DEPTH);

type Point = [number, number, number];
/**
 * Cavalier projection, seen from the room, a little from the right and above: x along the window's width, y out of the frame's
 * plane into the room, z up (the model's assembly frame, docs/window-cat-guard.md#assembly).
 */
const project = ([x, y, z]: Point): [number, number] => [ORIGIN_X + x - 0.72 * y, ORIGIN_Y - z + 0.5 * y];
const path = (points: Point[]) => `M${points.map(point => project(point).map(value => value.toFixed(2)).join(' ')).join('L')}Z`;
const line = (a: Point, b: Point) => `M${project(a).map(v => v.toFixed(2)).join(' ')}L${project(b).map(v => v.toFixed(2)).join(' ')}`;
const shift = ([x, y, z]: Point, [dx, dy, dz]: Point, k: number): Point => [x + dx * k, y + dy * k, z + dz * k];

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));
const ease = (value: number) => { const v = clamp01(value); return v * v * (3 - 2 * v); };
const span = (t: number, from: number, to: number) => ease((t - from) / (to - from));

/** The timeline: when each part arrives (0..1 of the cycle). */
const TILT: [number, number] = [0.02, 0.12];
const LEFT: [number, number] = [0.14, 0.36];
const RIGHT: [number, number] = [0.36, 0.58];
const STRIP: [number, number] = [0.58, 0.78];
const CLEAR: [number, number] = [0.9, 0.99];

/** How far each of `count` parts has arrived when they come in one after another between `from` and `to`. */
const staggered = (t: number, [from, to]: [number, number], count: number) =>
  Array.from({ length: count }, (_, i) => span(t, from + (to - from) * i / count, from + (to - from) * (i + 1) / count));

export interface GuardFrame {
  /** How far the sash is tilted open (0..1). */
  tilt: number;
  /** How far each segment has arrived (0..1): the side panels from their top segment down, the strip from its right end. */
  left: number[]; right: number[]; strip: number[];
  /** What is happening, for the card's `data-guard-stage`. */
  stage: string;
}

/** The illustration at `t` (0..1 of the cycle), or at rest (null): the guard standing in the tilted window. */
export function guardFrame(t: number | null): GuardFrame {
  const sides = LAYOUT.sideSegments, strips = LAYOUT.stripSegments;
  if (t === null) return { tilt: 1, left: Array<number>(sides).fill(1), right: Array<number>(sides).fill(1), strip: Array<number>(strips).fill(1), stage: 'Guarded' };
  const clear = span(t, ...CLEAR);
  const away = (values: number[]) => values.map(value => value * (1 - clear));
  const stage = t < TILT[1] ? 'Tilt the window' : t < LEFT[1] ? 'Left panel' : t < RIGHT[1] ? 'Right panel' : t < STRIP[1] ? 'Top strip' : t < CLEAR[0] ? 'Guarded' : 'Close the window';
  return {
    tilt: span(t, ...TILT) * (1 - clear),
    left: away(staggered(t, LEFT, sides)), right: away(staggered(t, RIGHT, sides)),
    // from the right end: the order the strip is joined in
    strip: away(staggered(t, STRIP, strips).reverse()),
    stage,
  };
}

/** A side panel's segment `k` (1 = top) in the plane x = `x`, `arrived` of the way in from `from`. */
function SidePanelSegment({ x, k, arrived, from }: { x: number; k: number; arrived: number; from: Point }) {
  if (arrived <= 0) return null;
  const length = H / LAYOUT.sideSegments;
  const z0 = H - k * length, z1 = z0 + length;
  const width = (z: number) => TIP + (GAP - TIP) * z / H;
  const at = (point: Point) => shift(point, from, 1 - arrived);
  const outline: Point[] = [[x, 0, z0], [x, width(z0), z0], [x, width(z1), z1], [x, 0, z1]].map(point => at(point as Point));
  return <g className="wcg-segment" opacity={Math.min(1, arrived * 2.5)}>
    <path d={path(outline)} fill="url(#wcg-honeycomb)" stroke="#3d6680" strokeWidth=".9" strokeLinejoin="round" />
    <path d={line(at([x, width(z0) / 2, z0]), at([x, width(z1) / 2, z1]))} stroke="#2f5873" strokeWidth="2.2" strokeLinecap="round" />
  </g>;
}

/** The top strip's segment `k` (1 = its left end), lying across the top gap, `arrived` of the way down. */
function StripSegment({ k, arrived }: { k: number; arrived: number }) {
  if (arrived <= 0) return null;
  const piece = W / LAYOUT.stripSegments;
  const x0 = (k - 1) * piece, x1 = k * piece - 0.6;
  const at = (point: Point) => shift(point, [0, 0, 26], 1 - arrived);
  return <g className="wcg-segment" opacity={Math.min(1, arrived * 2.5)}>
    <path d={path([[x0, 0, H], [x1, 0, H], [x1, GAP, H], [x0, GAP, H]].map(point => at(point as Point)))} fill="url(#wcg-honeycomb-strip)" stroke="#a87a1f" strokeWidth=".9" strokeLinejoin="round" />
    {RIBS.map(rib => <path key={rib} d={line(at([x0, rib, H]), at([x1, rib, H]))} stroke="#9a6f17" strokeWidth="1.6" strokeLinecap="round" />)}
  </g>;
}

/**
 * The window cat guard going into a tilted window, from the room: the sash tilts open, leaving a wedge-shaped gap at each side and
 * a gap across the top; the left side panel goes in segment by segment from the top, then the right one, then the top strip,
 * segment by segment from its right end, lands on them. The segments are the default guard's (3 per side panel, 5 in the
 * strip, `windowCatGuardLayout`), with the gap drawn deeper than it is. On card hover or focus it loops: afterwards the guard
 * comes out and the window closes. At rest, and with reduced motion, it shows the guard in the tilted window.
 */
export function WindowCatGuardIllustration({ at = null }: { at?: number | null } = {}) {
  const svg = useRef<SVGSVGElement>(null);
  // null at rest: the guard in the tilted window; `at` draws one moment of the cycle and does not animate
  const [t, setT] = useState<number | null>(at);
  useEffect(() => {
    const card = svg.current?.closest('.model-card');
    if (at !== null) return;
    if (!card || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let frame = 0, start = 0, active = false;
    const tick = (now: number) => {
      if (!start) start = now;
      setT(((now - start) / 1000 / CYCLE_SECONDS) % 1);
      frame = requestAnimationFrame(tick);
    };
    const play = () => { if (active) return; active = true; start = 0; setT(0); frame = requestAnimationFrame(tick); };
    const stop = () => { active = false; cancelAnimationFrame(frame); setT(null); };
    const events: [string, () => void][] = [['pointerenter', play], ['pointerleave', stop], ['focusin', play], ['focusout', stop]];
    for (const [name, handler] of events) card.addEventListener(name, handler);
    return () => { cancelAnimationFrame(frame); for (const [name, handler] of events) card.removeEventListener(name, handler); };
  }, [at]);

  const state = guardFrame(t);
  const g = GAP * state.tilt;
  // a point on the sash, which turns about its bottom edge: `z` up it, `x` along it
  const sash = (x: number, z: number): Point => [x, g * z / H, z];
  const frameWidth = 7, bar = 5;
  return <svg ref={svg} viewBox="0 0 240 190" aria-hidden="true" className="window-cat-guard-illustration" data-guard-stage={state.stage}>
    <defs>
      <pattern id="wcg-honeycomb" width="6" height="5.2" patternUnits="userSpaceOnUse">
        <rect width="6" height="5.2" fill="#6f9bb5" />
        <path d="M1.5 0h3l1.5 2.6-1.5 2.6h-3L0 2.6z" fill="#dde9ee" opacity=".55" />
      </pattern>
      <pattern id="wcg-honeycomb-strip" width="6" height="5.2" patternUnits="userSpaceOnUse">
        <rect width="6" height="5.2" fill="#d9a441" />
        <path d="M1.5 0h3l1.5 2.6-1.5 2.6h-3L0 2.6z" fill="#f6e7c3" opacity=".6" />
      </pattern>
      <linearGradient id="wcg-sky" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#c9dde6" />
        <stop offset="1" stopColor="#e3ece4" />
      </linearGradient>
    </defs>
    {/* the wall, the outside seen through the opening, and the frame round it */}
    <rect x={ORIGIN_X - 24} y={ORIGIN_Y - H - 34} width={W + 48} height={H + 52} rx="3" fill="#ddd8cb" />
    <path d={path([[0, 0, 0], [W, 0, 0], [W, 0, H], [0, 0, H]])} fill="url(#wcg-sky)" />
    <path d={`${path([[-frameWidth, 0, -frameWidth], [W + frameWidth, 0, -frameWidth], [W + frameWidth, 0, H + frameWidth], [-frameWidth, 0, H + frameWidth]])}${path([[0, 0, 0], [0, 0, H], [W, 0, H], [W, 0, 0]])}`} fill="#f4f1e8" stroke="#b9b29f" strokeWidth=".8" fillRule="evenodd" />
    {/* the sill */}
    <path d={path([[-frameWidth - 4, 0, -frameWidth], [W + frameWidth + 4, 0, -frameWidth], [W + frameWidth + 4, 16, -frameWidth], [-frameWidth - 4, 16, -frameWidth]])} fill="#cfc8b6" />
    {/* the left side panel stands behind the sash, seen through its glass */}
    {state.left.map((arrived, i) => <SidePanelSegment key={`l${i}`} x={0} k={i + 1} arrived={arrived} from={[26, 22, 0]} />)}
    {/* the sash: its frame and glass, tilted into the room about its bottom edge */}
    <path d={`${path([sash(0, 0), sash(W, 0), sash(W, H), sash(0, H)])}${path([sash(bar, bar), sash(bar, H - bar), sash(W - bar, H - bar), sash(W - bar, bar)])}`} fill="#fbfaf5" stroke="#b9b29f" strokeWidth=".8" fillRule="evenodd" />
    <path d={path([sash(bar, bar), sash(W - bar, bar), sash(W - bar, H - bar), sash(bar, H - bar)])} fill="#bcd6e2" opacity=".3" />
    <path d={line(sash(W * 0.62, H * 0.2), sash(W * 0.8, H * 0.75))} stroke="#fff" strokeWidth="2" opacity=".5" strokeLinecap="round" />
    <rect x={project(sash(W - bar - 6, H / 2))[0]} y={project(sash(W - bar - 6, H / 2))[1] - 6} width="2.4" height="9" rx="1.2" fill="#9c9483" />
    {state.right.map((arrived, i) => <SidePanelSegment key={`r${i}`} x={W} k={i + 1} arrived={arrived} from={[-26, 22, 0]} />)}
    {state.strip.map((arrived, i) => <StripSegment key={`s${i}`} k={i + 1} arrived={arrived} />)}
  </svg>;
}
