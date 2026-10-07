import type { Part, PartFamily } from './schema.ts';
import { measured } from './sources.ts';

/**
 * Split rings (key rings): a flattened spring wire wound two turns, which a tag or key is threaded onto between the turns. The
 * cat collar tag hangs from the collar's D-ring on one.
 */
export const splitRingFamily: PartFamily = {
  id: 'split-ring', title: 'Split rings',
  description: 'Split key rings by product: two turns of flattened spring-steel or stainless wire, with the maker’s outside and inside diameter, band width, ring thickness and wire.',
  attributes: [{ key: 'nominal', label: 'Nominal size' }, { key: 'material', label: 'Material' }, { key: 'manufacturer', label: 'Manufacturer' }],
  dimensions: [
    { key: 'D', label: 'Outside diameter', symbol: 'D', required: true },
    { key: 'd', label: 'Inside diameter', symbol: 'd', required: true },
    { key: 'a', label: 'Band width (radial, the maker’s “A”)', symbol: 'A', required: true },
    { key: 'b', label: 'Ring thickness (both turns, the maker’s “B”)', symbol: 'B', required: true },
    { key: 'w', label: 'Wire diameter (before flattening)', symbol: 'dw', required: true },
  ],
};

type Material = 'stainless' | 'nickel';
interface SplitRing {
  /** keyring.com's item number, which its page names the ring by. */
  item: string; slug: string; nominal: string; material: Material;
  /** As published, in inches: outside and inside diameter, A, B, wire. */
  inches: [D: number, d: number, a: number, b: number, w: number];
  note?: string;
}

const KEYRING = 'https://keyring.com/';
// keyring.com's "Actual Key Ring Dimensions" of each article, made in the USA by Avco (the page's "Manufacturer"). The nominal size
// is the approximate inside diameter.
const RINGS: SplitRing[] = [
  { item: 'KR-90920-001', slug: '9mm-23-64-inch-diameter-small-split-keyring-usa', nominal: '23/64″ (9 mm)', material: 'nickel', inches: [0.430, 0.328, 0.051, 0.074, 0.045] },
  { item: 'KR-90930-001', slug: '12mm-15-32-inch-diameter-small-split-key-ring-usa', nominal: '15/32″ (12 mm)', material: 'nickel', inches: [0.542, 0.424, 0.057, 0.083, 0.051] },
  { item: 'KR-92000-001', slug: 'heavy-duty-split-key-ring-nickel-plated-1-2-inch-diameter-usa', nominal: '1/2″', material: 'nickel', inches: [0.670, 0.526, 0.072, 0.105, 0.064] },
  { item: 'KR-92100-001', slug: 'heavy-duty-split-key-ring-nickel-plated-5-8-inch-diameter-usa', nominal: '5/8″', material: 'nickel', inches: [0.740, 0.596, 0.072, 0.105, 0.064] },
  { item: 'KR-92200-001', slug: 'heavy-duty-split-key-ring-nickel-plated-3-4-inch-inch-diameter-usa', nominal: '3/4″', material: 'nickel', inches: [0.875, 0.707, 0.084, 0.110, 0.072],
    note: 'The page prints A as “..084 in.”; read as 0.084 in, which is (outside − inside diameter) / 2.' },
  { item: 'KR-9335-001', slug: 'stainless-steel-split-key-ring-1-2-inch-diameter-usa', nominal: '1/2″', material: 'stainless', inches: [0.670, 0.510, 0.070, 0.105, 0.050],
    note: 'Its A (0.070 in) is 0.010 in less than (outside − inside diameter) / 2; both figures are the page’s own.' },
  { item: 'KR-9337-001', slug: 'stainless-steel-split-key-ring-3-4-inch-diameter-usa', nominal: '3/4″', material: 'stainless', inches: [0.880, 0.715, 0.080, 0.120, 0.075] },
  { item: 'KR-93400-001', slug: 'stainless-steel-split-key-ring-1-inch-diameter-usa', nominal: '1″', material: 'stainless', inches: [1.100, 0.932, 0.084, 0.110, 0.072] },
];

const MATERIAL_TEXT: Record<Material, string> = { stainless: 'stainless steel (AISI 304)', nickel: 'nickel-plated spring-tempered steel' };
const mm = (inches: number) => Math.round(inches * 25.4 * 1000) / 1000;

export const splitRingParts: Part[] = RINGS.map((ring): Part => {
  const [D, d, a, b, w] = ring.inches.map(mm) as [number, number, number, number, number];
  const dimension = measured('manufacturer', 'keyring-com-split-rings');
  const material = MATERIAL_TEXT[ring.material];
  return {
    id: `avco-${ring.item.toLowerCase().replace(/-001$/, '')}`, family: 'split-ring',
    title: `Split ring ${ring.nominal}, ${ring.material === 'stainless' ? 'stainless steel' : 'nickel-plated'} (Ø ${D.toFixed(1)} mm)`,
    designation: `keyring.com ${ring.item}`, aliases: [],
    description: `A ${ring.nominal} split key ring of ${material}, made in the USA by Avco: Ø ${D} mm outside, Ø ${d} mm inside, a ${a} mm band of ${w} mm wire, ${b} mm thick over both turns.`,
    standard: null, product: { manufacturer: 'Avco', sku: ring.item, url: `${KEYRING}${ring.slug}/` },
    attributes: { nominal: ring.nominal, material, manufacturer: 'Avco' },
    dimensions: { D: dimension(D), d: dimension(d), a: dimension(a), b: dimension(b), w: dimension(w) },
    // the size chart lists Avco's #92000 to #92975: the heavy-duty nickel-plated rings, the same figures as their pages
    sources: ring.item.startsWith('KR-92') ? ['keyring-com-split-rings', 'keyring-com-split-ring-chart'] : ['keyring-com-split-rings'],
    notes: `Converted from the page’s inches (${ring.inches.join(', ')} in: outside, inside, A, B, wire). The page does not define A and B: A matches (outside − inside diameter) / 2, so it is the band’s radial width, and B is taken as the ring’s thickness over both turns. No tolerances are given.${ring.note ? ` ${ring.note}` : ''}`,
    preview: { kind: 'procedural' },
  };
});
