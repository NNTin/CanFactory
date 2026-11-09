import { DEFAULT_LIGHTER_KEYCHAIN, LIGHTER_KEYCHAIN as K, lighterKeychainLayout } from '@canfactory/contracts';

const L = lighterKeychainLayout(DEFAULT_LIGHTER_KEYCHAIN);

/** Dimension-derived schematic of the default prints, seen across the lighter's flat face. The editor's STL viewer shows the real parts. */
export function LighterKeychainIllustration() {
  // Left: as it hangs from the keys: the split ring, the plate's eyelet, the plate on the foot, the holder turned over on the lighter.
  // Right: the holder alone on a fridge door, held by its flat foot.
  const s = 2.2, cx = 62, w = 2 * L.outlineY * s, bore = (22 + 2 * DEFAULT_LIGHTER_KEYCHAIN.fit) * s;
  const ringR = L.ringD / 2 * s, ringCy = 8 + ringR;
  const eyeTop = ringCy + ringR - 2 * 0.9 * s, eyeH = (L.eyeZ + L.eyeR) * s;
  const plateTop = eyeTop + eyeH, plateH = L.floor * s;
  const foot = plateTop + plateH, sleeve = L.top * s;
  const body = 50 * s, hood = 12 * s;
  const magnets = (y0: number, flip: 1 | -1, x0: number) => [-1, 1].map(side =>
    <rect key={side} x={x0 + side * L.magnetY * s - L.magnetD / 2 * s} y={flip > 0 ? y0 + L.skin * s : y0 - (L.skin + L.magnetT) * s} width={L.magnetD * s} height={L.magnetT * s} fill="#9aa3ab" stroke="#5f676e" strokeWidth=".5" />);
  // the fridge on the right: the holder's foot against it, the lighter sticking out sideways
  const fx = 182, fy = 56, fs = 0.95;
  return <svg className="lighter-keychain-illustration" viewBox="0 0 250 210" role="img" aria-label="A BIC Mini lighter in a holder hanging from a keychain by magnets; beside it the holder stuck to a fridge door by its flat foot">
    {/* the split ring and the eyelet */}
    <ellipse cx={cx} cy={ringCy} rx={ringR * 0.35} ry={ringR} fill="none" stroke="#9aa3ab" strokeWidth="2.2" />
    <path d={`M${cx - L.eyeR * s},${plateTop} V${eyeTop + L.eyeR * s} A${L.eyeR * s},${L.eyeR * s} 0 0 1 ${cx + L.eyeR * s},${eyeTop + L.eyeR * s} V${plateTop} Z`} fill="#2b2f36" />
    <circle cx={cx} cy={plateTop - L.eyeZ * s} r={L.hole / 2 * s} fill="#f6f7f4" />
    {/* the keychain plate and the holder's foot, face to face; the magnets sealed in both */}
    <rect x={cx - w / 2} y={plateTop} width={w} height={plateH} rx="2" fill="#2b2f36" />
    <rect x={cx - w / 2} y={foot} width={w} height={sleeve} rx="2" fill="#d9482b" />
    {magnets(foot, -1, cx)}{magnets(foot, 1, cx)}
    <line x1={cx - w / 2 - 4} x2={cx + w / 2 + 4} y1={foot} y2={foot} stroke="#f6f7f4" strokeWidth=".6" strokeDasharray="2 1.5" />
    {/* the lighter, base up in the sleeve (dashed), its hood below the mouth */}
    <rect x={cx - bore / 2} y={foot + plateH} width={bore} height={body} rx="3" fill="#f2c94c" fillOpacity=".55" stroke="#b08a1e" strokeWidth=".6" strokeDasharray="2 1.5" />
    <rect x={cx - bore / 2 + 1} y={foot + plateH + body} width={bore - 2} height={hood} rx="2" fill="#c7ccd1" stroke="#7e858b" strokeWidth=".6" />
    {/* the fridge door and the holder on it */}
    <rect x={fx - 6} y="14" width="6" height="180" fill="#dce5df" />
    <rect x={fx} y={fy - L.outlineY * fs} width={L.top * fs} height={2 * L.outlineY * fs} rx="1.5" fill="#d9482b" />
    <rect x={fx + L.floor * fs} y={fy - bore / s / 2 * fs} width={62 * fs} height={bore / s * fs} rx="2" fill="#f2c94c" fillOpacity=".55" stroke="#b08a1e" strokeWidth=".5" />
    <text x="122" y="132" fill="#52665b" fontSize="7" letterSpacing="1">PULLS OFF, SNAPS BACK</text>
    <text x="122" y="144" fill="#52665b" fontSize="7" letterSpacing="1">{`${2 * K.magnets} MAGNETS, SEALED IN`}</text>
    <text x="122" y="156" fill="#52665b" fontSize="7" letterSpacing="1">FLAT FOOT: A FRIDGE MAGNET</text>
  </svg>;
}
