import { CAMERA_HARDWARE as H, DEFAULT_CAMERA_HOUSING, cameraHousingLayout, type CameraHousingParameters } from '@canfactory/contracts';


type Point = [number, number, number];
/** The card is a dimension-derived isometric schematic, not a substitute for the live STL preview. */
export function CameraHousingIllustration({ parameters = DEFAULT_CAMERA_HOUSING }: { parameters?: CameraHousingParameters } = {}) {
  const P = parameters, L = cameraHousingLayout(P), scale = Math.min(1, 94 / (L.width + L.length));
  const view = (ox: number, exploded: boolean) => {
    const project = ([x, y, z]: Point): [number, number] => [ox + (x - y) * 0.94 * scale, 150 + (x + y) * 0.37 * scale - z * 1.15];
    const polygon = (points: Point[]) => points.map(point => project(point).join(',')).join(' ');
    const rect = (x: number, y: number, z: number, w: number, d: number) => polygon([[x, y, z], [x + w, y, z], [x + w, y + d, z], [x, y + d, z]]);
    const box = (x: number, y: number, z: number, w: number, d: number, height: number, color: string, open = false) => <g stroke="#344c48" strokeWidth=".55" strokeLinejoin="round">
      <polygon points={rect(x, y, z + height, w, d)} fill={open ? '#365854' : color} />
      <polygon points={polygon([[x, y + d, z], [x + w, y + d, z], [x + w, y + d, z + height], [x, y + d, z + height]])} fill={color} />
      <polygon points={polygon([[x + w, y, z], [x + w, y + d, z], [x + w, y + d, z + height], [x + w, y, z + height]])} fill={color} style={{ filter: 'brightness(.86)' }} />
      {open && <polygon points={rect(x + P.wall, y + P.wall, z + height, w - 2 * P.wall, d - 2 * P.wall)} fill="#aac4b7" />}
    </g>;
    const ring = (x: number, y: number, z: number, r: number, color: string) => {
      const [cx, cy] = project([x, y, z]);
      return <ellipse cx={cx} cy={cy} rx={r * 1.33 * scale} ry={r * 0.52 * scale} fill={color} stroke="#344c48" strokeWidth=".55" />;
    };
    const rise = exploded ? 51 : 0, boardRise = exploded ? 23 : 0;
    const bz = L.boardZ + boardRise;
    const [cx, cy] = L.aperture;
    const [ax, ay] = project([L.width / 2, L.boardY + 11, L.seam]);
    return <g data-view={exploded ? 'exploded' : 'assembled'}>
      <ellipse cx={ox} cy="172" rx="49" ry="8" fill="#d7dfd3" opacity=".65" />
      {exploded && <path d={`M${ox} 55 V151`} stroke="#81998e" strokeWidth=".7" strokeDasharray="2 3" />}
      {box(-L.width / 2, L.back, 0, L.width, L.length, L.seam, '#6d9890', true)}
      <polygon points={polygon([[-P.usbWidth / 2, P.length / 2, L.usbZ - P.usbHeight / 2], [P.usbWidth / 2, P.length / 2, L.usbZ - P.usbHeight / 2], [P.usbWidth / 2, P.length / 2, Math.min(L.seam, L.usbZ + P.usbHeight / 2)], [-P.usbWidth / 2, P.length / 2, Math.min(L.seam, L.usbZ + P.usbHeight / 2)]])} fill="#273e3a" />
      <ellipse cx={ax} cy={ay + 1} rx="2" ry="3" fill="#273e3a" />
      {P.ventilation && [0, 1, 2].map(row => <polygon key={row} points={polygon([[L.width / 2, L.boardY + 5, P.wall + 0.8 + 3 * row], [L.width / 2, L.boardY + 17, P.wall + 0.8 + 3 * row], [L.width / 2, L.boardY + 17, Math.min(L.seam, P.wall + 2.6 + 3 * row)], [L.width / 2, L.boardY + 5, Math.min(L.seam, P.wall + 2.6 + 3 * row)]])} fill="#365854" />)}
      {exploded && <>
        {[-1, 1].map(s => <g key={s}>{ring(s * P.mountSpacing / 2, 0, P.wall + 1, 2.5, '#d7ab54')}{ring(s * P.mountSpacing / 2, 0, P.wall + 1.1, 1.1, '#344c48')}</g>)}
        {P.heatsinkEnabled && <g data-heatsink="backside">
          {box(L.heatsinkX - L.heatsinkW / 2, L.heatsinkY - L.heatsinkL / 2, bz - P.adhesiveThickness - 1.5, L.heatsinkW, L.heatsinkL, 1.5, '#3b4046')}
          {[0, 1, 2, 3].map(i => <g key={i}>{box(L.heatsinkX - L.heatsinkW / 2 + i * L.heatsinkW * 11 / 36, L.heatsinkY - L.heatsinkL / 2, bz - P.adhesiveThickness - L.heatsinkH, L.heatsinkW / 12, L.heatsinkL, L.heatsinkH - 1.5, '#3b4046')}</g>)}
        </g>}
        {box(-H.width / 2, L.boardY, bz, H.width, H.length, H.thickness, '#29473b')}
        {box(-H.width / 2 + 0.5, L.boardY + 0.2, bz + 4.2, 16.8, 14.7, 1.25, '#456653')}
        {box(-4.47, L.boardY + 15.2, bz + H.thickness, 8.94, 7.34, 3.31, '#b7c1bd')}
        {box(L.lens[0] - 4, L.lens[1] - 4, bz + 8, 8, 8, 2, '#303733')}
        {ring(L.lens[0], L.lens[1], bz + H.height, 4, '#151f1c')}
        {ring(L.lens[0], L.lens[1], bz + H.height + 0.1, 1.2, '#7fa9b2')}
      </>}
      {box(-L.width / 2, L.back, L.seam + rise, L.width, L.length, L.top - L.seam, '#e5d9bb')}
      {ring(cx, cy, L.top + rise + 0.1, P.cameraDiameter / 2, '#273e3a')}
      {!exploded && ring(cx, cy, L.top + 0.2, 2.2, '#7fa9b2')}
      {L.corners.map(([x, y], i) => <g key={i}>{ring(x, y, L.top + rise + 0.2, 1.8, '#c3a163')}{ring(x, y, L.top + rise + 0.3, 0.7, '#43534b')}</g>)}
      {P.ventilation && [-5, 0, 5].map(x => <polygon key={x} points={rect(x - 0.7, -P.length / 2 + 5, L.top + rise + 0.1, 1.4, 8)} fill="#63786b" />)}
      <text x={ox} y="187" textAnchor="middle" fill="#52665b" fontSize="7" fontWeight="600" letterSpacing="1">{exploded ? 'EXPLODED' : 'ASSEMBLED'}</text>
    </g>;
  };
  return <svg viewBox="0 0 240 195" role="img" aria-label="XIAO Sense housing: assembled and exploded views" className="camera-housing-illustration">
    <title>Guided tray, backside heatsink, camera stack and screw-on hood</title>
    <text x="14" y="16" fill="#52665b" fontSize="7" letterSpacing="1.4">XIAO SENSE / INDOOR CAMERA</text>
    {P.heatsinkEnabled && <text x="14" y="28" fill="#52665b" fontSize="6" letterSpacing=".8">BACKSIDE HEATSINK / DEFAULT ON</text>}
    {view(59, false)}{view(181, true)}
  </svg>;
}
