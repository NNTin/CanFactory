import { useEffect, useRef, useState } from 'react';
import { DEFAULT_CORNER_LATCH, cornerLatchLayout, toggleLatchMechanism as M } from '@canfactory/contracts';

/** Seconds for one cycle: locked, open (back over centre), unhook, hook, close (over centre), locked. */
const CYCLE_SECONDS = 7;
const CORNER_LAYOUT = cornerLatchLayout(DEFAULT_CORNER_LATCH);

const toPath = (points: M.Vec2[]) => `M${points.map(([x, y]) => `${x} ${y}`).join('L')}Z`;
const circle = ([x, y]: M.Vec2, r: number) => `M${x + r} ${y}a${r} ${r} 0 1 0 ${-2 * r} 0a${r} ${r} 0 1 0 ${2 * r} 0Z`;
const P = M.TOGGLE_LATCH_PROFILES, G = M.TOGGLE_LATCH_GEOMETRY;
// Each part's side, in its own frame: the base's and the catch's whole sections (plate and knuckle or hook) and the base's pivot
// pin, the lever's side plate
// with its pivot hole and its link pin, the link's side bar with its hole and the bar across its end.
const PATHS = {
  base: toPath(P.baseKnuckle),
  basePin: circle(G.base.pivot, G.base.pinDiameter / 2),
  catch: toPath(P.catchHook),
  lever: toPath(P.leverSide) + circle(G.lever.pivot, G.lever.pivotDiameter / 2),
  leverPin: circle(G.lever.pin, G.lever.pinDiameter / 2),
  link: toPath(P.linkSide) + circle(G.link.hole, G.link.holeDiameter / 2),
  linkBar: toPath(P.linkBar),
};

/**
 * The toggle latch from the side, drawn from its parts' real profiles and moved by the shared mechanism (`toggleLatchMechanism`):
 * the base fixed on its board, the lever turning on the base's pins, the link hanging on the lever's pins and hooked under the
 * catch's hook, and the catch on the lid's board, drawn in by the link. On card hover or focus it loops: opening back over the
 * dead centre, which releases the catch, unhooking, hooking and closing over centre to the lock. At rest, and with reduced motion,
 * it shows the latch locked. The dashed line is the link's pull, from the dip in the hook through the lever's pins: the lever locks
 * once the line has passed the pivot.
 */
export function ToggleLatchIllustration({ corner = false }: { corner?: boolean } = {}) {
  // Pixels per mm and the mounting-plane origin; leave room below it for the corner's upright foot.
  const SCALE = corner ? 1.65 : 3.4, ORIGIN_X = corner ? 138 : 128, ORIGIN_Y = corner ? 85 : 160;
  /** The SVG transform that draws a part placed in the plane by `placement`, the plane mirrored so that the base is on the left. */
  function transform({ m, t }: M.Placement2D): string {
    return `matrix(${-SCALE * m[0]} ${-SCALE * m[2]} ${-SCALE * m[1]} ${-SCALE * m[3]} ${ORIGIN_X - SCALE * t[0]} ${ORIGIN_Y - SCALE * t[1]})`;
  }
  const x = (u: number) => ORIGIN_X - SCALE * u, y = (v: number) => ORIGIN_Y - SCALE * v;

  const svg = useRef<SVGSVGElement>(null);
  // null at rest: the latch locked
  const [t, setT] = useState<number | null>(null);
  useEffect(() => {
    const card = svg.current?.closest('.model-card');
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
  }, []);

  const state = t === null ? { ...M.latchState(M.CLOSED), title: 'Locked' } : M.latchCycleState(t);
  const nose = M.placePoint(state.link, G.link.nose.centre);
  const along: M.Vec2 = [state.pin[0] - nose[0], state.pin[1] - nose[1]];
  const reach = 1.25;
  const { legLength, holeAt, bite } = CORNER_LAYOUT;
  const thickness = DEFAULT_CORNER_LATCH.plankThickness;
  const closedOffset = M.latchState(M.CLOSED).offset;
  const section = (points: M.Vec2[]) => toPath(points.map(([u, v]) => [x(u), y(v)]));
  return <svg ref={svg} viewBox="0 0 240 190" aria-hidden="true" className="toggle-latch-illustration" data-latch-mount={corner ? 'outside-corner' : 'flat'} data-latch-state={state.title}>
    <ellipse cx="120" cy="176" rx="104" ry="8" fill="#c8cec1" opacity=".35" />
    {corner ? <g className="tl-corner-mounts">
      {/* Upright plank covers the horizontal plank's end; both screws enter broad faces, beyond the joint. */}
      <path d={section([[closedOffset + thickness, 0], [legLength + 12, 0], [legLength + 12, -thickness], [closedOffset + thickness, -thickness]])} fill="#b9946b" />
      <path d={section([[state.offset, 0], [state.offset + thickness, 0], [state.offset + thickness, -legLength - 6], [state.offset, -legLength - 6]])} fill="#a9845d" />
      <path d={section([[0, 0], [legLength, 0], [legLength, 4], [0, 4]])} fill="#7b8e6b" />
      <path d={section([[state.offset, 4], [state.offset, -legLength], [state.offset - 4, -legLength], [state.offset - 4, -12], [state.offset - 12, 0], [state.offset - 12, 4]])} fill="#7b8e6b" />
      <path d={`M${x(holeAt)} ${y(4)}V${y(-bite)}M${x(state.offset - 4)} ${y(-holeAt)}H${x(state.offset + bite)}`} stroke="#686b6b" strokeWidth="2.5" />
    </g> : <>
      <rect x={x(42)} y={ORIGIN_Y} width={SCALE * 42} height="14" rx="2" fill="#b9946b" />
      <rect x={x(state.offset)} y={ORIGIN_Y} width={SCALE * 42} height="14" rx="2" fill="#a9845d" />
    </>}
    <path d={PATHS.base} transform={transform(M.BASE_PLACEMENT)} fill="#7b8e6b" />
    <path d={PATHS.basePin} transform={transform(M.BASE_PLACEMENT)} fill="#5f7350" />
    <path d={PATHS.catch} transform={transform(state.catch)} fill="#7b8e6b" />
    <g className="tl-lever" transform={transform(state.lever)}>
      <path d={PATHS.lever} fill="#d98460" fillRule="evenodd" />
      <path d={PATHS.leverPin} fill="#b5603f" />
    </g>
    <g className="tl-link" transform={transform(state.link)}>
      <path d={PATHS.linkBar} fill="#3f6ea6" />
      <path d={PATHS.link} fill="#5b86bd" fillOpacity=".72" fillRule="evenodd" />
    </g>
    <line x1={x(nose[0])} y1={y(nose[1])} x2={x(nose[0] + along[0] * reach)} y2={y(nose[1] + along[1] * reach)} stroke="#3d463b" strokeWidth=".8" strokeDasharray="3 2" opacity={state.taut ? 0.55 : 0} />
    <circle cx={x(state.pin[0])} cy={y(state.pin[1])} r="1.6" fill="#f4f1e6" />
  </svg>;
}

/** The same mechanism, with its actual perpendicular mounting feet and a wooden outside corner. */
export function OutsideCornerToggleLatchIllustration() { return <ToggleLatchIllustration corner />; }
