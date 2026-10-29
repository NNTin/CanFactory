import type { Part, PartFamily } from './schema.ts';
import { measured } from './sources.ts';

/**
 * Rubber bands by size number: the numbered office bands of Alliance Rubber's size chart (the size numbers most makers use). The treat
 * dispenser's flap can take one as a spring, hooked into notches on the inner body (`flapBand`).
 */
export const rubberBandFamily: PartFamily = {
  id: 'rubber-band', title: 'Rubber bands',
  description: 'Numbered rubber bands by product: flat length (half the band’s circumference), width, and a thickness worked out from the maker’s count per pound and the compound’s specific gravity.',
  attributes: [{ key: 'size', label: 'Size' }, { key: 'compound', label: 'Compound' }, { key: 'durometer', label: 'Hardness' }, { key: 'manufacturer', label: 'Manufacturer' }],
  dimensions: [
    { key: 'length', label: 'Flat length (half the circumference)', symbol: 'L', required: true },
    { key: 'width', label: 'Width', symbol: 'W', required: true },
    { key: 'thickness', label: 'Thickness (wall)', symbol: 't', required: true },
  ],
};

/** Alliance Rubber's Sterling® compound, the size chart's: specific gravity, hardness (Shore A), ultimate elongation, permanent set. */
export const STERLING = { gravity: 1.12, durometer: 42, elongation: 7.5, set: 0.1 } as const;

interface RubberBand {
  size: string;
  /** As the chart gives them: length and width, inches; the approximate count per pound of Sterling bands. */
  inches: [length: number, width: number]; perPound: number;
}

// Alliance Rubber's “Rubber Band Size Chart” (read verbatim 2026-10-24): the 1/16″ and 1/8″ wide sizes with a Sterling count
const BANDS: RubberBand[] = [
  { size: '8', inches: [7 / 8, 1 / 16], perPound: 7100 },
  { size: '10', inches: [1.25, 1 / 16], perPound: 5000 },
  { size: '12', inches: [1.75, 1 / 16], perPound: 3400 },
  { size: '14', inches: [2, 1 / 16], perPound: 3100 },
  { size: '16', inches: [2.5, 1 / 16], perPound: 2300 },
  { size: '18', inches: [3, 1 / 16], perPound: 1900 },
  { size: '19', inches: [3.5, 1 / 16], perPound: 1700 },
  { size: '27', inches: [1.25, 1 / 8], perPound: 2400 },
  { size: '30', inches: [2, 1 / 8], perPound: 1500 },
  { size: '31', inches: [2.5, 1 / 8], perPound: 1200 },
  { size: '32', inches: [3, 1 / 8], perPound: 950 },
  { size: '33', inches: [3.5, 1 / 8], perPound: 850 },
];

const POUND = 453.59237;
const round = (value: number, digits = 3) => Math.round(value * 10 ** digits) / 10 ** digits;

export const rubberBandParts: Part[] = BANDS.map((band): Part => {
  const [length, width] = band.inches.map(inches => round(inches * 25.4));
  // a band's volume from its weight (a pound over the count) and the compound's density, over its circumference (twice the flat
  // length) and width
  const volume = POUND / band.perPound / STERLING.gravity * 1000;
  const thickness = round(volume / (2 * (length ?? 0) * (width ?? 0)), 2);
  return {
    id: `alliance-sterling-${band.size}`, family: 'rubber-band',
    title: `Rubber band #${band.size} (${band.inches[0] === 7 / 8 ? '7/8' : band.inches[0]}″ × ${band.inches[1] === 1 / 16 ? '1/16' : '1/8'}″)`,
    designation: `Alliance Sterling® #${band.size}`, aliases: [`#${band.size}`, `size ${band.size}`],
    description: `A size ${band.size} rubber band: ${length} mm flat (a ${round(2 * (length ?? 0), 1)} mm loop), ${width} mm wide, about ${thickness} mm thick, of Alliance Rubber’s Sterling® compound (${STERLING.durometer} Shore A).`,
    standard: null, product: { manufacturer: 'Alliance Rubber Company', sku: `#${band.size}`, url: 'https://www.rubberband.com/about-us/rubber-band-size-chart/' },
    attributes: { size: `#${band.size}`, compound: 'Sterling®', durometer: `${STERLING.durometer} Shore A`, manufacturer: 'Alliance Rubber Company' },
    dimensions: {
      length: measured('manufacturer', 'alliance-rubber-size-chart')(length ?? 0),
      width: measured('manufacturer', 'alliance-rubber-size-chart')(width ?? 0),
      thickness: measured('estimated', 'alliance-rubber-size-chart')(thickness),
    },
    sources: ['alliance-rubber-size-chart'],
    notes: `Length and width from the chart’s inches (${band.inches.map(value => round(value, 4)).join(' × ')} in), no tolerances given. The thickness is not published: it is the band’s volume (a pound over the chart’s approximate ${band.perPound} Sterling bands per pound, at the compound’s specific gravity ${STERLING.gravity}) over its circumference and width, so it carries the count’s approximation. Sterling: ultimate elongation ${STERLING.elongation * 100}%, permanent set ${STERLING.set * 100}% (the chart). Other makers’ bands of the same number differ in compound and thickness.`,
    preview: { kind: 'procedural' },
  };
});
