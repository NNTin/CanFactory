import type { Part, PartFamily } from './schema.ts';
import { measured } from './sources.ts';

/**
 * Flat corner brackets (Stuhlwinkel, L-Flachverbinder): an L-shaped steel plate screwed flat across the corner of a frame, one leg on
 * each member, so that the corner cannot open or rack. The window catio's insert collar has one at each corner.
 */
export const cornerBracketFamily: PartFamily = {
  id: 'corner-bracket', title: 'Flat corner brackets',
  description: 'L-shaped steel plates screwed flat across a frame’s corner, one leg on each member, to keep the corner square and closed.',
  attributes: [{ key: 'size', label: 'Size' }, { key: 'holes', label: 'Holes' }, { key: 'material', label: 'Material' }, { key: 'manufacturer', label: 'Manufacturer' }],
  dimensions: [
    { key: 'a', label: 'Length of one leg, over the corner', symbol: 'a', required: true },
    { key: 'b', label: 'Length of the other leg, over the corner', symbol: 'b', required: true },
    { key: 'c', label: 'Width of the legs', symbol: 'c', required: true },
    { key: 't', label: 'Plate thickness', symbol: 't', required: true },
    { key: 'd', label: 'Screw hole diameter', symbol: 'Ø', required: true },
    { key: 'd2', label: 'Diameter of the larger holes, for bolts or larger screws', symbol: 'Ø2', required: false },
  ],
};

// GAH Alberts Stuhlwinkel, steel, sendzimir galvanised, “mit beidseitig versenkten Schraublöchern”: one article of each size (the
// single piece, where Alberts also sells packs), read from each article's page: a × b × c, Materialstärke, Anzahl x Loch-Ø.
const ALBERTS_STUHLWINKEL: [article: string, a: number, c: number, t: number, holes: number, d: number][] = [
  ['339180', 25, 14, 1.5, 4, 4.5], ['339197', 30, 14, 1.5, 4, 4.5], ['339203', 40, 15, 1.75, 4, 4.5], ['339210', 50, 15, 1.75, 4, 4.5],
  ['339227', 60, 16, 1.75, 4, 5.5], ['339388', 75, 16, 1.75, 4, 5.5], ['339234', 90, 19, 2, 6, 5.3], ['332358', 100, 19, 2, 6, 5.3],
  ['332402', 125, 22, 2, 6, 6], ['332457', 150, 25, 3, 6, 6.5],
];

const alberts = ALBERTS_STUHLWINKEL.map(([article, a, c, t, holes, d]): Part => {
  const dimension = measured('manufacturer', 'alberts-stuhlwinkel');
  const size = `${a} × ${a} × ${c}`;
  return {
    id: `gah-alberts-stuhlwinkel-${a}x${a}x${c}`, family: 'corner-bracket', title: `Flat corner bracket ${size}`,
    designation: `GAH Alberts Stuhlwinkel ${size} mm, Art.-Nr. ${article}`, aliases: ['Stuhlwinkel', 'Flachwinkel'],
    description: `A flat L-shaped corner bracket with ${a} mm legs, ${c} mm wide and ${t} mm thick, in sendzimir-galvanised steel, with ${holes} countersunk ${d} mm screw holes (GAH Alberts ${article}).`,
    standard: null, product: { manufacturer: 'Gust. Alberts GmbH & Co. KG (GAH Alberts)', sku: article, url: `https://www.alberts.de/ean/4004338${article}` },
    attributes: { size: `${size} mm`, holes: `${holes} × Ø${d}`, material: 'Steel, sendzimir galvanised', manufacturer: 'GAH Alberts' },
    dimensions: { a: dimension(a), b: dimension(a), c: dimension(c), t: dimension(t), d: dimension(d) },
    sources: ['alberts-stuhlwinkel'],
    notes: `The screw holes are countersunk on both sides, so either face can lie outwards. Alberts gives the hole count and size but not where the holes are; ${holes / 2} on each leg is what its pictures show. Also sold in packs, and in other finishes (blue galvanised, brass-plated, plastic-coated, stainless) under other article numbers.`,
    preview: { kind: 'procedural' },
  };
});

// Simpson Strong-Tie L-PB, its technical data sheet: A × B × C × t, 10 holes Ø5 and 3 holes Ø8.5.
const simpson: Part = (() => {
  const dimension = measured('manufacturer', 'simpson-l-pb');
  return {
    id: 'simpson-strong-tie-l150pb', family: 'corner-bracket', title: 'Flat corner bracket 150 × 150 × 40, black',
    designation: 'Simpson Strong-Tie L150PB', aliases: ['L-Flachverbinder'],
    description: 'A flat L-shaped corner bracket with 150 mm legs, 40 mm wide and 2 mm thick, galvanised and powder-coated black, with 10 holes of 5 mm and 3 of 8.5 mm (Simpson Strong-Tie L150PB).',
    standard: null, product: { manufacturer: 'Simpson Strong-Tie GmbH', sku: 'L150PB', url: 'https://www.strongtie.de/de-DE/produkte/l-flachverbinder-l-pb' },
    attributes: { size: '150 × 150 × 40 mm', holes: '10 × Ø5, 3 × Ø8.5', material: 'Steel S 250 GD +Z 275, powder-coated RAL 9005', manufacturer: 'Simpson Strong-Tie' },
    dimensions: { a: dimension(150), b: dimension(150), c: dimension(40), t: dimension(2), d: dimension(5), d2: dimension(8.5) },
    sources: ['simpson-l-pb'],
    notes: 'For posts and beams of 90 × 90 to 200 × 200 mm; Simpson’s CSA5.0×35PB connector screws, black like the plate, go in the 5 mm holes. The data sheet gives no hole positions.',
    preview: { kind: 'procedural' },
  };
})();

export const cornerBracketParts: Part[] = [...alberts, simpson];

/**
 * Where a flat corner bracket's screw holes are, in its own plane: from its outer corner, `along` one leg and `across` it, on
 * either leg (`leg` a or b). Neither maker gives positions, so they are estimated: half the holes on each leg, centred across it,
 * evenly spaced over the leg beyond the corner square. The larger holes of a bracket that has them are left out.
 */
export function cornerBracketHoles(part: Part): { leg: 'a' | 'b'; along: number; across: number }[] {
  const count = Number.parseInt(part.attributes['holes'] ?? '0', 10); const perLeg = Math.max(1, Math.floor(count / 2));
  const c = part.dimensions['c']?.value ?? 0;
  return (['a', 'b'] as const).flatMap(leg => {
    const length = part.dimensions[leg]?.value ?? 0;
    return Array.from({ length: perLeg }, (_, i) => ({ leg, along: c + (length - c) * (i + 0.5) / perLeg, across: c / 2 }));
  });
}
