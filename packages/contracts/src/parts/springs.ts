import type { Part, PartFamily } from './schema.ts';
import { measured } from './sources.ts';

export const springFamily: PartFamily = {
  id: 'spring', title: 'Compression springs',
  description: 'Cylindrical helical compression springs of spring-steel wire (EN 10270-1) by product, with their free and least lengths and spring rate (DIN EN 13906-1).',
  attributes: [
    { key: 'outerDiameter', label: 'Outer diameter' }, { key: 'wire', label: 'Wire' }, { key: 'rate', label: 'Spring rate' },
    { key: 'ends', label: 'Ends' }, { key: 'material', label: 'Material' }, { key: 'manufacturer', label: 'Manufacturer' },
  ],
  dimensions: [
    { key: 'd', label: 'Wire diameter', symbol: 'd', required: true },
    { key: 'De', label: 'Outer coil diameter', symbol: 'De', required: true },
    { key: 'L0', label: 'Free length', symbol: 'L0', required: true },
    { key: 'Ln', label: 'Least length in static use (solid length plus the least coil gaps)', symbol: 'Ln', required: true },
    { key: 'Lndyn', label: 'Least length in dynamic use', symbol: 'Lndyn', required: false },
  ],
};

interface Spring {
  sku: string; d: number; De: number; DeTol: number; L0: number; L0Tol: number; Ln: number; Lndyn: number;
  /** Spring rate R in N/mm, and the largest force in static use Fn in N. */
  R: number; Fn: number; n: number; ends: 'closed' | 'closed and ground';
}

// Gutekunst's article data, as each article page gives it: d, De ± its tolerance, L0 ± its tolerance, Ln, Lndyn, R, Fn, the
// active coils n and the ends. All of EN 10270-1 spring steel wire, made to DIN EN 13906-1 (tolerances DIN EN 15800).
const SPRINGS: Spring[] = [
  { sku: 'D-024', d: 0.25, De: 2.25, DeTol: 0.1, L0: 7.8, L0Tol: 0.33, Ln: 3.42, Lndyn: 3.62, R: 0.585, Fn: 2.565, n: 8.5, ends: 'closed' },
  { sku: 'D-027', d: 0.3, De: 2.2, DeTol: 0.1, L0: 13, L0Tol: 0.38, Ln: 5.4, Lndyn: 6.38, R: 0.962, Fn: 7.314, n: 12.5, ends: 'closed' },
  { sku: 'D-039', d: 0.32, De: 2.82, DeTol: 0.1, L0: 6.5, L0Tol: 0.27, Ln: 3.22, Lndyn: 3.39, R: 1.243, Fn: 4.081, n: 5.5, ends: 'closed' },
  { sku: 'D-054', d: 0.4, De: 3.6, DeTol: 0.15, L0: 8.3, L0Tol: 0.32, Ln: 4.03, Lndyn: 4.25, R: 1.447, Fn: 6.177, n: 5.5, ends: 'closed' },
  { sku: 'D-077', d: 0.5, De: 4.5, DeTol: 0.15, L0: 10, L0Tol: 0.38, Ln: 4.29, Lndyn: 4.56, R: 1.809, Fn: 10.33, n: 5.5, ends: 'closed and ground' },
  { sku: 'D-082', d: 0.5, De: 3.7, DeTol: 0.15, L0: 7.9, L0Tol: 0.28, Ln: 4.19, Lndyn: 4.42, R: 3.533, Fn: 13.093, n: 5.5, ends: 'closed and ground' },
  { sku: 'D-088', d: 0.5, De: 3, DeTol: 0.1, L0: 8.7, L0Tol: 0.32, Ln: 5.83, Lndyn: 6.12, R: 4.794, Fn: 13.738, n: 8.5, ends: 'closed and ground' },
  { sku: 'D-102', d: 0.63, De: 5.63, DeTol: 0.2, L0: 12.5, L0Tol: 0.44, Ln: 5.4, Lndyn: 5.73, R: 2.334, Fn: 16.576, n: 5.5, ends: 'closed and ground' },
  { sku: 'D-107', d: 0.63, De: 4.63, DeTol: 0.15, L0: 9.6, L0Tol: 0.33, Ln: 5.28, Lndyn: 5.57, R: 4.559, Fn: 19.691, n: 5.5, ends: 'closed and ground' },
  { sku: 'D-134', d: 0.8, De: 5.8, DeTol: 0.2, L0: 12, L0Tol: 0.38, Ln: 6.7, Lndyn: 7.05, R: 6.07, Fn: 32.182, n: 5.5, ends: 'closed and ground' },
  { sku: 'D-139', d: 0.8, De: 4.8, DeTol: 0.15, L0: 9.7, L0Tol: 0.31, Ln: 6.61, Lndyn: 6.92, R: 11.855, Fn: 36.69, n: 5.5, ends: 'closed and ground' },
];

export const springParts: Part[] = SPRINGS.map((spring): Part => {
  const dimension = measured('manufacturer', 'gutekunst-compression-springs');
  const { sku, d, De, L0 } = spring;
  return {
    id: `gutekunst-${sku.toLowerCase()}`, family: 'spring', title: `Compression spring ${d} × ${De} × ${L0}`, designation: `Gutekunst ${sku}`, aliases: [],
    description: `A compression spring of ${d} mm spring-steel wire, ${De} mm outside and ${L0} mm long unloaded, with ${spring.n} active coils and ${spring.ends} ends; ${spring.R} N/mm, at most ${spring.Fn} N at its least length of ${spring.Ln} mm (Gutekunst ${sku}).`,
    standard: null, product: { manufacturer: 'Gutekunst Federn', sku, url: `https://www.federnshop.com/en/products/compression_springs/${sku.toLowerCase()}.html` },
    attributes: { outerDiameter: `${De} mm`, wire: `${d} mm`, rate: `${spring.R} N/mm`, ends: spring.ends, material: 'EN 10270-1 spring steel', manufacturer: 'Gutekunst Federn' },
    dimensions: {
      d: dimension(d), De: dimension(De, Number((De - spring.DeTol).toFixed(3)), Number((De + spring.DeTol).toFixed(3))),
      L0: dimension(L0, Number((L0 - spring.L0Tol).toFixed(3)), Number((L0 + spring.L0Tol).toFixed(3))),
      Ln: dimension(spring.Ln), Lndyn: dimension(spring.Lndyn),
    },
    sources: ['gutekunst-compression-springs', 'din-en-13906-1'],
    notes: `Spring rate R = ${spring.R} N/mm; largest force in static use Fn = ${spring.Fn} N, at Ln. Do not compress it below Ln; a spring that works every time (as in a detent) lasts longest above Lndyn. The inner diameter is De − 2d.`,
    preview: { kind: 'procedural' },
  };
});

/** A library spring's rate in N/mm (its `rate` attribute). */
export function springRate(part: Part): number {
  const rate = Number.parseFloat(part.attributes['rate'] ?? '');
  if (!Number.isFinite(rate)) throw new Error(`${part.id} has no spring rate.`);
  return rate;
}
