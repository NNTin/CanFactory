import { catCollarTagSettings, collarTagLayout, DEFAULT_CAT_COLLAR_TAG as D, findPart } from '@canfactory/contracts';

const L = collarTagLayout(catCollarTagSettings(D));
const RING = findPart(D.splitRing);
/** Pixels per millimetre. */
const S = 2.8;

/**
 * The default tag as it is worn: a piece of the collar's strap with its D-ring, the split ring through the D-ring and the bail, and
 * the round tag with the cat's name, all at the model's defaults (the tag's outline, its bail and hole from `collarTagLayout`).
 */
export function CatCollarTagIllustration() {
  const ringR = RING ? ((RING.dimensions['D']?.value ?? 17) + (RING.dimensions['d']?.value ?? 13)) / 4 * S : 24;
  const cx = 120, strapTop = 8, strapH = 10 * S, dRingBottom = strapTop + strapH + 16;
  const ringCy = dRingBottom + ringR - 5, holeY = ringCy + ringR;
  // the tag's frame: the hole's centre at holeY
  const y = (mm: number) => holeY + (L.hole[1] - mm) * S;
  return <svg viewBox="0 0 240 190" aria-hidden="true" className="cat-collar-tag-illustration">
    <rect x="0" y={strapTop} width="240" height={strapH} rx="3" fill="#3a6ea5" />
    <path d={`M${cx - 14} ${strapTop + strapH - 2} V${dRingBottom - 9} A9 9 0 0 0 ${cx + 14} ${dRingBottom - 9} V${strapTop + strapH - 2}`} fill="none" stroke="#a3a8ad" strokeWidth="3" />
    <circle cx={cx} cy={y(L.hole[1])} r={L.earR * S} fill="#e8a33d" />
    <rect x={cx - L.earR * S} y={y(L.hole[1])} width={2 * L.earR * S} height={(L.hole[1] - L.hang[1] + L.earR) * S} fill="#e8a33d" />
    <circle cx={cx} cy={y(0)} r={D.width / 2 * S} fill="#e8a33d" stroke="#c98a2c" strokeWidth="1" />
    <circle cx={cx} cy={y(L.hole[1])} r={L.holeD / 2 * S} fill="#e9ece0" />
    {/* the split ring, through the D-ring and the bail's hole: drawn over the tag only where the hole shows it */}
    <mask id="cct-ring" maskUnits="userSpaceOnUse" x="0" y="0" width="240" height="190">
      <rect x="0" y="0" width="240" height="190" fill="#fff" />
      <circle cx={cx} cy={y(L.hole[1])} r={L.earR * S} fill="#000" />
      <circle cx={cx} cy={y(L.hole[1])} r={L.holeD / 2 * S} fill="#fff" />
    </mask>
    <circle cx={cx} cy={ringCy} r={ringR} fill="none" stroke="#c7cbd0" strokeWidth="3.5" mask="url(#cct-ring)" />
    <text x={cx} y={y(0) + D.frontTextSize * S * 0.36} textAnchor="middle" fontSize={D.frontTextSize * S} fontWeight="700" fontFamily="Liberation Sans, Arial, sans-serif" fill="#a86f1c">{D.frontLine1}</text>
  </svg>;
}
