import { DEFAULT_MITER_BOX, MITER_BOX, miterBoxLayout } from '@canfactory/contracts';

/**
 * The miter box from above, drawn from its layout (1 px = 1 mm): the fence along the top (part of the base, stopping short of the
 * turntable, whose two retaining pins reach over its rim), a strip of stock against it under the two hold-downs, and the turntable's guide (its two slotted posts on the saw's line, the lock knob beside it) over the scale. On hover
 * the guide swings to the 45° stop, across to 22.5° the other way and back to the square cut.
 */
export function MiterBoxIllustration() {
  const l = miterBoxLayout(DEFAULT_MITER_BOX);
  const cx = 120, cy = 50;
  const X = (x: number) => cx + x, Y = (y: number) => cy + y;
  const half = l.postWidth / 2, pl = l.guideLength;
  const fence = (s: number) => [[l.fenceStart, 0], [l.halfLength, 0], [l.halfLength, -MITER_BOX.fence], [l.fenceStart, -MITER_BOX.fence]]
    .map(([x = 0, y = 0]) => `${X(s * x)},${Y(y)}`).join(' ');
  const polar = (r: number, degrees: number) => [X(-r * Math.sin(degrees * Math.PI / 180)), Y(r * Math.cos(degrees * Math.PI / 180))] as const;
  const ticks = Array.from({ length: 2 * MITER_BOX.maxAngle / MITER_BOX.tick + 1 }, (_, i) => -MITER_BOX.maxAngle + i * MITER_BOX.tick);
  const stockWidth = DEFAULT_MITER_BOX.stockWidth - 6;
  const post = (y: number) => <g>
    <rect x={X(-half)} y={Y(y - pl / 2)} width={l.postWidth} height={pl} rx="1" fill="#c56f4d" stroke="#7d4130" strokeWidth=".6" />
    <rect x={X(-l.slot / 2)} y={Y(y - pl / 2)} width={l.slot} height={pl} fill="#3b2a24" />
  </g>;
  const knob = (x: number, y: number, key: string) => <g key={key}>
    <circle cx={X(x)} cy={Y(y)} r={MITER_BOX.knob.diameter / 2} fill="#e0b048" stroke="#9a7420" strokeWidth=".7" strokeDasharray="2.2 1" />
    <circle cx={X(x)} cy={Y(y)} r="5" fill="none" stroke="#9a7420" strokeWidth=".5" />
  </g>;
  return <svg viewBox="0 0 240 210" role="img" aria-label="Adjustable miter box from above: a turning saw guide with two slotted posts over a scale, a fence and two hold-down clamps" className="miter-box-illustration">
    <title>Adjustable miter box: the saw guide turns and locks at any angle; hold-downs clamp the stock</title>
    <rect x={X(-l.halfLength)} y={Y(l.back)} width={2 * l.halfLength} height={l.front - l.back} rx="3" fill="#e4dccb" stroke="#a89f8c" strokeWidth=".8" />
    <rect x={X(-l.halfLength)} y={Y(-MITER_BOX.fence)} width={2 * l.halfLength} height={l.W + MITER_BOX.fence} fill="#d6ccb6" />
    {/* the scale round the arm's tip */}
    {ticks.map(a => {
      const long = a % 22.5 === 0, [x1, y1] = polar(l.scaleFrom, a), [x2, y2] = polar(l.scaleFrom + (long ? 6 : 3), a);
      return <line key={a} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#6c6457" strokeWidth={long ? '.8' : '.5'} />;
    })}
    {[-45, -22.5, 0, 22.5, 45].map(a => {
      const [x, y] = polar(l.labelAt + 1, a);
      return <text key={a} x={x} y={y + 2} textAnchor="middle" fontSize="5.5" fill="#6c6457">{Math.abs(a)}</text>;
    })}
    {/* the turning guide */}
    <g className="mb-guide">
      <circle cx={X(0)} cy={Y(0)} r={l.turntable} fill="#d98460" stroke="#a65a3e" strokeWidth=".8" fillOpacity=".92" />
      <path d={`M${X(-l.armHalf)},${Y(0)} V${Y(l.armTip)} H${X(l.armHalf)} V${Y(0)} Z`} fill="#d98460" stroke="#a65a3e" strokeWidth=".8" />
      <circle cx={X(l.knobX)} cy={Y(l.knobY)} r={l.wingR} fill="#d98460" stroke="#a65a3e" strokeWidth=".8" />
      <line x1={X(0)} y1={Y(-l.turntable)} x2={X(0)} y2={Y(l.armTip)} stroke="#3b2a24" strokeWidth={l.slot} />
    </g>
    {/* the stock, against the fence */}
    <rect className="mb-stock" x={X(-l.halfLength + 4)} y={Y(0)} width={2 * l.halfLength - 8} height={stockWidth} fill="#e9c58f" stroke="#b78b52" strokeWidth=".6" />
    {[6, 12, 18].map(y => <path key={y} d={`M${X(-l.halfLength + 6)},${Y(y)} q 40 -2 80 1 t 90 -1`} fill="none" stroke="#c99e64" strokeWidth=".5" />)}
    {/* the fence and the hold-downs' sockets (one piece with the base), the turntable's retaining pins; the guide's posts, pin and knob over the stock; the hold-downs */}
    {[-1, 1].map(s => <g key={s}>
      <polygon points={fence(s)} fill="#c9bea6" stroke="#8f8571" strokeWidth=".7" />
      <rect x={X(s * l.holdX - l.holdPinL / 2)} y={Y(l.blockBack)} width={l.holdPinL} height={-MITER_BOX.fence - l.blockBack} fill="#c9bea6" stroke="#8f8571" strokeWidth=".7" />
      <rect x={X(s * l.retainTip)} y={Y(l.retainY - l.retainD / 2)} width={l.retainL} height={l.retainD} rx="1" fill="#b9c0c4" stroke="#6d757a" strokeWidth=".4"
        transform={`rotate(${s > 0 ? MITER_BOX.retainAngle : 180 - MITER_BOX.retainAngle} ${X(s * l.retainTip)} ${Y(l.retainY)})`} />
    </g>)}
    <g className="mb-guide">
      {post(-l.rearPost)}{post(l.frontPost)}
      <circle cx={X(l.pinX)} cy={Y(l.pinY)} r={l.pinR + .4} fill="#9aa3a8" stroke="#5f676b" strokeWidth=".5" />
      {knob(l.knobX, l.knobY, 'lock')}
    </g>
    {[-1, 1].map(s => <g key={s}>
      <rect x={X(s * l.holdX - MITER_BOX.holdDown.width / 2)} y={Y(l.columnBack)} width={MITER_BOX.holdDown.width} height={l.beamTip - l.columnBack} rx="1.5" fill="#5f7350" stroke="#3d4b33" strokeWidth=".7" />
      <rect x={X(s * l.holdX - 3.3)} y={Y(l.slotFrom - 3.3)} width="6.6" height={l.slotTo - l.slotFrom + 6.6} rx="3.3" fill="#3d4b33" />
      {knob(s * l.holdX, (l.slotFrom + l.slotTo) / 2, `clamp-${s}`)}
    </g>)}
    <text x="12" y="188" fill="#52665b" fontSize="7" letterSpacing="1">ANY ANGLE · STOPS 0 / 22.5 / 45</text>
  </svg>;
}
