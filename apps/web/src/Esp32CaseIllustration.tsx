import { ESP32_CASE_LEDS } from '@canfactory/contracts';
type Point = [number, number, number];

/** Dimension-derived schematic. The editor's STL viewer shows the converted source geometry. */
export function Esp32CaseIllustration() {
  const view = (cx: number, exploded: boolean) => {
    const project = ([x, y, z]: Point): [number, number] => [cx + (x - y) * 1.65, 140 + (x + y) * 0.63 - z * 3.1];
    const polygon = (points: Point[]) => points.map(point => project(point).join(',')).join(' ');
    const rect = (x: number, y: number, z: number, w: number, d: number) => polygon([[x, y, z], [x + w, y, z], [x + w, y + d, z], [x, y + d, z]]);
    const lidX = exploded ? 15 : 0, lidZ = exploded ? 12 : 0;
    return <g data-view={exploded ? 'exploded' : 'assembled'} stroke="#35575d" strokeWidth=".65" strokeLinejoin="round">
      <ellipse cx={cx} cy="166" rx="45" ry="7" fill="#dce5df" stroke="none" />
      <polygon points={rect(-12.9, -10.9, 6.06, 25.8, 21.8)} fill="#a8c3be" />
      <polygon points={rect(-11.3, -9.3, 6.08, 22.6, 18.6)} fill="#35575d" />
      <polygon points={polygon([[-12.9, 10.9, 0], [12.9, 10.9, 0], [12.9, 10.9, 7.56], [-12.9, 10.9, 7.56]])} fill="#497c85" />
      <polygon points={polygon([[12.9, -10.9, 0], [12.9, 10.9, 0], [12.9, 10.9, 7.56], [12.9, -10.9, 7.56]])} fill="#3c6874" />
      <polygon points={polygon([[12.92, -4.97, 1.7], [12.92, 4.97, 1.7], [12.92, 4.97, 5.86], [12.92, -4.97, 5.86]])} fill="#243e44" />
      {exploded && <path d={`M${project([12.9, 0, 7.56]).join(',')} l24,9`} fill="none" stroke="#77948b" strokeDasharray="2 2" />}
      <g className="esp32-case-card-lid">
        <polygon points={rect(-12.5 + lidX, -9.9, 7.56 + lidZ, 25.4, 19.8)} fill="#e5d9bb" />
        <polygon points={polygon([[-12.5 + lidX, 9.9, 6.56 + lidZ], [12.9 + lidX, 9.9, 6.56 + lidZ], [12.9 + lidX, 9.9, 7.56 + lidZ], [-12.5 + lidX, 9.9, 7.56 + lidZ]])} fill="#c7ba9c" />
        {ESP32_CASE_LEDS.map(led => <polygon key={led.name} points={polygon(Array.from({ length: 24 }, (_, i): Point => {
          const a = i * Math.PI / 12;
          return [led.print[0] + 0.2 + lidX + Math.cos(a), -led.print[1] + Math.sin(a), 7.58 + lidZ];
        }))} fill="#263f43" stroke="none" />)}
        {[-5.2, 5.2].map((y, index) => {
          const [x, py] = project([-5 + lidX, y, 7.58 + lidZ]);
          return <g key={y}>
            <polyline points={polygon([[-8 + lidX, y - 2.3, 7.58 + lidZ], [-2 + lidX, y - 2.3, 7.58 + lidZ], [-2 + lidX, y + 2.3, 7.58 + lidZ], [-8 + lidX, y + 2.3, 7.58 + lidZ]])} fill="none" />
            <text x={x} y={py + 2} textAnchor="middle" stroke="none" fill="#53615b" fontSize="6" fontWeight="700">{index === 0 ? 'B' : 'R'}</text>
          </g>;
        })}
      </g>
      <text x={cx} y="185" textAnchor="middle" stroke="none" fill="#52665b" fontSize="7" letterSpacing="1">{exploded ? 'SLIDING LID' : 'ASSEMBLED'}</text>
    </g>;
  };
  return <svg viewBox="0 0 240 195" role="img" aria-label="ESP32-C3 SuperMini case: assembled and sliding lid views" className="esp32-case-illustration">
    <title>Original two-piece case with USB-C access and BOOT / RESET tabs</title>
    <text x="12" y="18" fill="#52665b" fontSize="7" letterSpacing="1">ESP32-C3 / SUPERMINI</text>
    {view(55, false)}{view(164, true)}
  </svg>;
}
