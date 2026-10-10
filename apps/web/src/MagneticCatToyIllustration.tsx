import { useId } from 'react';
import { DEFAULT_MAGNETIC_CAT_TOY, magneticCatToyLayout } from '@canfactory/contracts';

/** Exploded, dimension-derived four-layer schematic. The editor animates the actual STL components. */
export function MagneticCatToyIllustration() {
  const id = useId();
  const p = DEFAULT_MAGNETIC_CAT_TOY, l = magneticCatToyLayout(p);
  const project = (x: number, y: number, z: number): [number, number] => [120 + (x - y) * 0.62, 163 + (x + y) * 0.19 - z * 0.88];
  const polygon = (z: number) => [[-p.width / 2, -p.length / 2], [p.width / 2, -p.length / 2], [p.width / 2, p.length / 2], [-p.width / 2, p.length / 2]].map(([x = 0, y = 0]) => project(x, y, z).join(',')).join(' ');
  const circle = (x: number, y: number, z: number, r: number, color: string) => { const [cx, cy] = project(x, y, z); return <ellipse cx={cx} cy={cy} rx={r * 0.82} ry={r * 0.3} fill={color} stroke="#3f5754" strokeWidth=".7" />; };
  const coverZ = l.top + 65;
  const slot = (x: number) => { const a = project(x, -(l.slotLength - p.slotWidth) / 2, coverZ), b = project(x, (l.slotLength - p.slotWidth) / 2, coverZ); return `M${a.join(' ')}L${b.join(' ')}`; };
  const [bx, by] = project(0, 0, l.fieldTop + l.radius + 20);
  return <svg viewBox="0 0 240 210" role="img" aria-label="Magnetic cat toy: grid, thin field, magnetic ball and slotted cover" className="magnetic-cat-toy-illustration">
    <defs><mask id={id}><rect width="240" height="210" fill="white" />{l.slotCentres.map(x => <path key={x} d={slot(x)} stroke="black" strokeWidth={p.slotWidth * 0.39} strokeLinecap="round" />)}</mask></defs>
    <g data-layer="grid">
      <polygon points={polygon(0)} fill="#4f716b" stroke="#344e48" />
      {l.sockets.map(([x, y], i) => <g key={i}>{circle(x, y, 1, 3, '#263f3b')}</g>)}
      {l.holders.map(([x, y], i) => <g key={i}>{circle(x, y, 9, l.holderDiameter / 2, '#b16b66')}{circle(x, y, 10, l.grid.diameter / 2, '#e8d3c1')}</g>)}
    </g>
    <g data-layer="field"><polygon points={polygon(l.fieldZ + 12)} fill="#e5cf9b" fillOpacity=".83" stroke="#9e8756" /></g>
    <g data-layer="ball">
      <circle cx={bx} cy={by} r={l.radius * 0.66} fill="#efb95f" stroke="#976936" />
      <path d={`M${bx - l.radius * 0.66} ${by} Q${bx} ${by + 7} ${bx + l.radius * 0.66} ${by}`} fill="none" stroke="#b47f42" />
      <circle cx={bx} cy={by} r="3" fill="#626c79" />
    </g>
    <g data-layer="cover">
      {/* Raised front walls make the containment volume visible without hiding the field and ball. */}
      <path d={`M${project(p.width / 2, -p.length / 2, coverZ).join(' ')}L${project(p.width / 2, p.length / 2, coverZ).join(' ')}L${project(-p.width / 2, p.length / 2, coverZ).join(' ')}L${project(-p.width / 2, p.length / 2, coverZ - 19).join(' ')}L${project(p.width / 2, p.length / 2, coverZ - 19).join(' ')}L${project(p.width / 2, -p.length / 2, coverZ - 19).join(' ')}Z`} fill="#7aabba" stroke="#436e79" fillOpacity=".75" />
      <polygon points={polygon(coverZ)} fill="#649aa8" stroke="#436e79" mask={`url(#${id})`} />
    </g>
  </svg>;
}
