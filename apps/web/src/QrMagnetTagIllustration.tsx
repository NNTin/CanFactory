import { useEffect, useRef, useState } from 'react';
import { DEFAULT_QR_MAGNET_TAG, qrTagCode, qrTagLayout, qrTagSettings } from '@canfactory/contracts';

/** Seconds for one cycle: the border alone, the centre going in, the code appearing, a pause, then the centre lifting out. */
const CYCLE_SECONDS = 7;
/** Pixels per millimetre, and where the tile's centre is drawn. */
const SCALE = 2, CX = 118, CY = 100;
/** The tile's thickness is drawn as an oblique offset, down and to the right, per millimetre of depth. */
const DX = 0.9, DY = 0.7;

const P = DEFAULT_QR_MAGNET_TAG;
const LAYOUT = qrTagLayout(qrTagSettings(P));
const CODE = qrTagCode(P);
const N = CODE.symbol.size;
const SIZE = P.size * SCALE, SEAT = LAYOUT.seatWidth * SCALE, CENTRE = LAYOUT.centreWidth * SCALE;
const MODULE = LAYOUT.codeWidth * SCALE / (N + 2 * P.quietZone);
const DEPTH = LAYOUT.height * SCALE;

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));
const ease = (value: number) => { const v = clamp01(value); return v * v * (3 - 2 * v); };
const span = (t: number, from: number, to: number) => ease((t - from) / (to - from));

/** The timeline (0..1 of the cycle). */
const CENTRE_IN: [number, number] = [0.12, 0.4];
const CODE_IN: [number, number] = [0.42, 0.72];
const OUT: [number, number] = [0.88, 0.98];

export interface TagFrame {
  /** How far the centre has come into the seat (0: away in front of the tag, 1: seated). */
  centre: number;
  /** How much of the code has appeared, row by row from the top (0..1). */
  code: number;
  /** What is happening, for the card's `data-tag-stage`. */
  stage: string;
}

/** The illustration at `t` (0..1 of the cycle), or at rest (null): the finished tag. */
export function tagFrame(t: number | null): TagFrame {
  if (t === null) return { centre: 1, code: 1, stage: 'Tag' };
  const out = span(t, ...OUT);
  const stage = t < CENTRE_IN[0] ? 'Border' : t < CENTRE_IN[1] ? 'Centre in' : t < CODE_IN[1] ? 'Code' : t < OUT[0] ? 'Tag' : 'Lift out';
  return { centre: span(t, ...CENTRE_IN) * (1 - out), code: span(t, ...CODE_IN) * (1 - out), stage };
}

const rounded = (x: number, y: number, w: number, r: number) => <rect x={x - w / 2} y={y - w / 2} width={w} height={w} rx={r} />;

/**
 * The magnetic QR code tag on a fridge door: the blue border with its seat, and the light centre with the default tag's own code
 * (`https://example.com` at H, `qrTagCode`) raised on it in the dark filament. On card hover or focus it loops: the centre comes
 * in from the front and drops into the seat, then the code appears row by row; afterwards the centre lifts out again. At rest, and
 * with reduced motion, it shows the finished tag. `data-tag-stage` names the stage for the browser test.
 */
export function QrMagnetTagIllustration({ at = null }: { at?: number | null } = {}) {
  const svg = useRef<SVGSVGElement>(null);
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

  const state = tagFrame(t);
  // the centre comes towards the tag along the depth axis: from in front (up and to the left), larger, then into the seat
  const away = 1 - state.centre;
  const lift = away * 34;
  const [ox, oy] = [-DX * lift, -DY * lift];
  const grow = 1 + away * 0.12;
  const half = (N + 2 * P.quietZone) * MODULE / 2;
  const rows = state.code * N;
  return <svg ref={svg} viewBox="0 0 240 190" aria-hidden="true" className="qr-magnet-tag-illustration" data-tag-stage={state.stage}>
    {/* the fridge door and its handle */}
    <rect x="8" y="6" width="224" height="178" rx="10" fill="#eef1f2" stroke="#d4dadd" />
    <rect x="212" y="40" width="7" height="104" rx="3.5" fill="#cdd4d8" />
    {/* the border: its side, then its front with the seat */}
    <g fill="#1f4f9c">{rounded(CX + DEPTH * DX / 2, CY + DEPTH * DY / 2, SIZE, P.cornerRadius * SCALE)}</g>
    <g fill="#2f6fd6" stroke="#255bb0" strokeWidth=".8">{rounded(CX, CY, SIZE, P.cornerRadius * SCALE)}</g>
    <g fill="#1d4a92">{rounded(CX, CY, SEAT, LAYOUT.seatRadius * SCALE)}</g>
    {/* the centre: a soft shadow while it is in front of the tag, its light base, and the code raised on it */}
    {away > 0 && <g fill="#000" opacity={0.12 * away}>{rounded(CX + 3 * away, CY + 4 * away, CENTRE, LAYOUT.centreRadius * SCALE)}</g>}
    <g className="qrt-centre" transform={`translate(${(CX + ox).toFixed(2)} ${(CY + oy).toFixed(2)}) scale(${grow.toFixed(3)})`}>
      <g fill="#c9ced2">{rounded(0.8, 0.7, CENTRE, LAYOUT.centreRadius * SCALE)}</g>
      <g fill="#f3f5f6" stroke="#d5dadd" strokeWidth=".5">{rounded(0, 0, CENTRE, LAYOUT.centreRadius * SCALE)}</g>
      <g fill="#1b1d22">
        {CODE.rects.filter(([, y]) => y < rows).map(([x, y, w, h]) =>
          <rect key={`${x}:${y}`} className="qrt-module" x={(-half + (P.quietZone + x) * MODULE).toFixed(2)} y={(-half + (P.quietZone + y) * MODULE).toFixed(2)} width={(w * MODULE + 0.15).toFixed(2)} height={(h * MODULE + 0.15).toFixed(2)} />)}
      </g>
    </g>
  </svg>;
}
