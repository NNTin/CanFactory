import type { CSSProperties } from 'react';
import { findPart, SPRING_BALL_DETENT_DEFAULT as D, springBallDetentLayout } from '@canfactory/contracts';

const BALL = findPart(D.ball); const SPRING = findPart(D.spring); const SET_SCREW = findPart(D.setScrew);
const L = BALL && SPRING && SET_SCREW ? springBallDetentLayout(D, { ball: BALL, spring: SPRING, setScrew: SET_SCREW }) : null;

/** Pixels per millimetre; the axis runs left (back face) to right (nose), at `AXIS_Y`. */
const SCALE = 7, BACK_X = 30, AXIS_Y = 95;
const x = (z: number) => BACK_X + z * SCALE, y = (r: number) => AXIS_Y - r * SCALE;

/**
 * The default detent in section, at the model's defaults: the printed body (its thread's crests and roots along both walls), the
 * press cap in its back, the spring and the ball on the nose's lip, standing out of the nose. On card hover or focus the ball is
 * pushed in by its travel, the spring compressed with it, and let go again (`.sbd-*` in styles.css).
 */
export function SpringBallDetentIllustration() {
  if (!L) return <svg viewBox="0 0 240 190" aria-hidden="true" />;
  const length = D.bodyLength; const { major, minor } = L.thread; const pitch = L.thread.pitch ?? 1.5;
  // one wall in section, above the axis (side 1) or below it (-1): the plain collar behind the slot, the thread's teeth (crest flat,
  // flanks, root), the nose's chamfer, then back inside along the lip, the cone and the bore
  const wall = (side: 1 | -1) => {
    const p = (z: number, r: number) => `${x(z)} ${AXIS_Y - side * r * SCALE}`;
    const points = [p(0, minor / 2), p(L.tool.depth, minor / 2)];
    for (let z = L.tool.depth + pitch; z < length - pitch; z += pitch)
      points.push(p(z - pitch * 0.35, major / 2), p(z - pitch * 0.2, major / 2), p(z + pitch * 0.15, minor / 2));
    points.push(p(length - 0.8, minor / 2), p(length, minor / 2 - 0.8), p(length, L.opening / 2), p(L.contact, L.opening / 2), p(L.coneBottom, L.bore / 2), p(0, L.bore / 2));
    return `M${points.join(' L')} Z`;
  };
  const face = length + 0.3; const chord = Math.sqrt(L.r ** 2 - (face - L.centre) ** 2);
  // the spring from the cap's face to the ball, compressed on hover by scaling it towards the cap
  const coils = 6; const springLength = L.springTop - L.seat; const step = springLength / coils; const halfDe = (SPRING ? (SPRING.dimensions['De']?.value ?? 4) : 4) / 2;
  const spring = Array.from({ length: coils }, (_, i) => `L${x(L.seat + step * (i + 0.5))} ${y(halfDe - 0.3)} L${x(L.seat + step * (i + 1))} ${y(-(halfDe - 0.3))}`).join(' ');
  return <svg viewBox="0 0 240 190" aria-hidden="true" className="spring-ball-detent-illustration"
    style={{ '--sbd-push': `${(-D.travel * SCALE).toFixed(1)}px`, '--sbd-squeeze': ((springLength - D.travel) / springLength).toFixed(3), '--sbd-origin': `${x(L.seat).toFixed(1)}px ${AXIS_Y}px` } as CSSProperties}>
    {/* the mating part, 0.3 mm off the nose, with a dimple the ball's tip sits in */}
    <path d={`M${x(face)} 30 V${AXIS_Y - chord * SCALE} A${L.r * SCALE} ${L.r * SCALE} 0 0 1 ${x(face)} ${AXIS_Y + chord * SCALE} V160 H${x(face + 4)} V30 Z`} fill="#e8e3d6" stroke="#c9c1ad" strokeWidth="1" />
    <path d={wall(1)} fill="#5f7350" stroke="#4b5c3f" strokeWidth=".8" strokeLinejoin="round" />
    <path d={wall(-1)} fill="#5f7350" stroke="#4b5c3f" strokeWidth=".8" strokeLinejoin="round" />
    {/* the press cap, flush with the slot's floor */}
    <rect x={x(L.tool.depth)} y={y(L.bore / 2 - 0.05)} width={L.cap.length * SCALE} height={(L.bore - 0.1) * SCALE} fill="#d98460" stroke="#b56a49" strokeWidth=".8" />
    <path className="sbd-spring" d={`M${x(L.seat)} ${y(0)} ${spring}`} fill="none" stroke="#8d9298" strokeWidth={Math.max(1.5, (SPRING?.dimensions['d']?.value ?? 0.6) * SCALE)} strokeLinejoin="round" />
    <circle className="sbd-ball" cx={x(L.centre)} cy={AXIS_Y} r={L.r * SCALE} fill="#cfd2d6" stroke="#8d9298" strokeWidth="1" />
  </svg>;
}
