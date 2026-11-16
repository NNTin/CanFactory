import type { Part, PartFamily } from './schema.ts';
import { measured } from './sources.ts';

export const torsionSpringFamily: PartFamily = {
  id: 'torsion-spring', title: 'Torsion springs',
  description: 'Cylindrical helical torsion springs with straight tangential legs (DIN EN 13906-3), by product: wire, coil, legs, leg position, largest torque and angle, and the mandrel (pin or screw) they turn on.',
  attributes: [
    { key: 'innerDiameter', label: 'Inner diameter' }, { key: 'wire', label: 'Wire' }, { key: 'legPosition', label: 'Leg position' },
    { key: 'coils', label: 'Coils' }, { key: 'winding', label: 'Winding' }, { key: 'maxTorque', label: 'Largest torque' },
    { key: 'maxAngle', label: 'Largest angle' }, { key: 'rate', label: 'Spring rate' }, { key: 'material', label: 'Material' },
    { key: 'manufacturer', label: 'Manufacturer' },
  ],
  dimensions: [
    { key: 'd', label: 'Wire diameter', symbol: 'd', required: true },
    { key: 'Di', label: 'Inner coil diameter', symbol: 'Di', required: true },
    { key: 'De', label: 'Outer coil diameter (Di + 2d)', symbol: 'De', required: true },
    { key: 'Dd', label: 'Mandrel diameter: the pin or screw it turns on, from the least to the largest', symbol: 'Dd', required: true },
    { key: 'Lk', label: 'Length of the coil body, unloaded', symbol: 'Lk0', required: true },
    { key: 'Ls', label: 'Leg length', symbol: 'Ls', required: true },
  ],
};

interface TorsionSpring {
  sku: string; d: number; Di: number; DiTol: number; DdMin: number; DdMax: number; nt: number; Lk0: number; Ls: number;
  /** The angle between the legs' positions unloaded, in degrees (0, 90, 180 or 270), and the coiling direction. */
  legs: 0 | 90 | 180 | 270; winding: 'left' | 'right';
  /** The largest torque Mn in N·mm (± its tolerance) and the largest angle it is turned by, αn, in degrees. */
  Mn: number; MnTol: number; alphan: number;
}

// Gutekunst's article data, as each article page gives it: d, Di ± its tolerance, Ddmin and Ddmax, the total coils nt, Lk0, Ls, the
// leg position when relaxed, the coiling direction, Mn ± its tolerance and αn. All stainless spring steel 1.4310 with straight
// tangential legs (leg shape TS1), quality grade 2 of DIN EN 15800. One product line: the same wire, coil and legs in each of the
// four leg positions, which differ only by the coils (nt) between the legs.
const SPRINGS: TorsionSpring[] = [
  { sku: 'T-16100L', d: 0.5, Di: 2.5, DiTol: 0.08, DdMin: 2, DdMax: 2.25, nt: 2, Lk0: 1.5, Ls: 25, legs: 0, winding: 'left', Mn: 14.86, MnTol: 5.06, alphan: 28.28 },
  { sku: 'T-16101L', d: 0.5, Di: 2.5, DiTol: 0.08, DdMin: 2, DdMax: 2.25, nt: 3.25, Lk0: 2.13, Ls: 25, legs: 90, winding: 'left', Mn: 14.86, MnTol: 4.5, alphan: 46.01 },
  { sku: 'T-16102L', d: 0.5, Di: 2.5, DiTol: 0.08, DdMin: 2, DdMax: 2.25, nt: 4.5, Lk0: 2.75, Ls: 25, legs: 180, winding: 'left', Mn: 14.86, MnTol: 4.16, alphan: 63.74 },
  { sku: 'T-16103L', d: 0.5, Di: 2.5, DiTol: 0.08, DdMin: 2, DdMax: 2.25, nt: 5.75, Lk0: 3.38, Ls: 25, legs: 270, winding: 'left', Mn: 14.86, MnTol: 3.92, alphan: 81.39 },
];

const LEG_TEXT: Record<TorsionSpring['legs'], string> = {
  0: 'its legs leaving the coil at the same side, pointing in opposite directions',
  90: 'its legs a quarter turn apart',
  180: 'its legs leaving the coil at opposite sides, side by side and pointing the same way (as on a clothes peg)',
  270: 'its legs three quarters of a turn apart',
};

export const torsionSpringParts: Part[] = SPRINGS.map((spring): Part => {
  const dimension = measured('manufacturer', 'gutekunst-torsion-springs');
  const { sku, d, Di, Ls } = spring;
  const round = (value: number) => Number(value.toFixed(3));
  const rate = round(spring.Mn / spring.alphan);
  return {
    id: `gutekunst-${sku.toLowerCase()}`, family: 'torsion-spring', title: `Torsion spring ${d} × ${Di} × ${Ls}, ${spring.legs}°`, designation: `Gutekunst ${sku}`, aliases: [],
    description: `A torsion spring of ${d} mm stainless spring wire, ${Di} mm inside, ${spring.nt} coils ${spring.Lk0} mm long, with ${LEG_TEXT[spring.legs]}; two straight ${Ls} mm legs, at most ${spring.Mn} N·mm when turned by ${spring.alphan}° (Gutekunst ${sku}).`,
    standard: null, product: { manufacturer: 'Gutekunst Federn', sku, url: `https://www.federnshop.com/en/products/torsion_springs/${sku.toLowerCase()}.html` },
    attributes: {
      innerDiameter: `${Di} mm`, wire: `${d} mm`, legPosition: `${spring.legs}°`, coils: String(spring.nt), winding: spring.winding,
      maxTorque: `${spring.Mn} N·mm`, maxAngle: `${spring.alphan}°`, rate: `${rate} N·mm/°`, material: '1.4310 stainless spring steel', manufacturer: 'Gutekunst Federn',
    },
    dimensions: {
      d: dimension(d), Di: dimension(Di, round(Di - spring.DiTol), round(Di + spring.DiTol)),
      De: dimension(round(Di + 2 * d), round(Di - spring.DiTol + 2 * d), round(Di + spring.DiTol + 2 * d)),
      Dd: dimension(spring.DdMax, spring.DdMin, spring.DdMax), Lk: dimension(spring.Lk0), Ls: dimension(Ls),
    },
    sources: ['gutekunst-torsion-springs', 'din-en-13906-3'],
    notes: `Largest torque Mn = ${spring.Mn} ± ${spring.MnTol} N·mm at αn = ${spring.alphan}°, so about ${rate} N·mm per degree (Mn / αn; the maker gives no rate). Load it only in the winding direction (closing the coils), and no further than αn. Its coil narrows as it is wound: turn it on a pin or screw of Ddmin to Ddmax (${spring.DdMin}–${spring.DdMax} mm). De is Di + 2d; the maker gives no De. The legs may be cut shorter.`,
    preview: { kind: 'procedural' },
  };
});
