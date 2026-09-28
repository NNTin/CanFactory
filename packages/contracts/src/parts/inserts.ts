import type { Dimension, Part, PartFamily } from './schema.ts';
import { measured } from './sources.ts';

export const insertFamily: PartFamily = {
  id: 'threaded-insert', title: 'Threaded inserts',
  description: 'Brass heat-set inserts that are melted into a printed hole to give it a durable metal thread, with the hole each maker recommends.',
  attributes: [{ key: 'thread', label: 'Thread' }, { key: 'manufacturer', label: 'Manufacturer' }, { key: 'variant', label: 'Variant' }],
  dimensions: [
    { key: 'l', label: 'Length', symbol: 'L', required: true },
    { key: 'd', label: 'Outer (knurl) diameter', symbol: 'D1', required: true },
    { key: 'pilot', label: 'Pilot (lead-in) diameter', symbol: 'D3', required: false },
    { key: 'hole', label: 'Recommended hole diameter', symbol: 'D2', required: true },
    { key: 'holeDepth', label: 'Least hole depth', symbol: 'T', required: true },
    { key: 'wall', label: 'Least wall around the hole', symbol: 'W', required: true },
  ],
};

// CNC Kitchen's table: type, L, D1 (insert diameter), D2 (hole diameter), W (least wall). Blind holes at least L + 1 mm deep.
const CNC_KITCHEN: [thread: string, l: number, d: number, hole: number, wall: number, variant: string][] = [
  ['M2', 3, 3.6, 3.2, 1.3, 'standard'], ['M2.5', 4, 4.6, 4, 1.6, 'standard'], ['M3', 5.7, 4.6, 4, 1.6, 'standard'],
  ['M3', 3, 4.6, 4, 1.6, 'short'], ['M3', 4, 5, 4.4, 1.6, 'Voron (M3 × 5 × 4)'], ['M4', 8.1, 6.3, 5.7, 2.1, 'standard'],
  ['M4', 4, 6.3, 5.7, 2.1, 'short'], ['M5', 9.5, 7.1, 6.5, 2.6, 'standard'], ['M5', 5.8, 7.1, 6.5, 2.6, 'short'],
  ['M6', 12.7, 8.7, 8.1, 3.3, 'standard'], ['M8', 12.7, 10.2, 9.7, 4.5, 'standard'],
];
const cncKitchen = CNC_KITCHEN.map(([thread, l, d, hole, wall, variant]): Part => {
  const dimension = measured('manufacturer', 'cnc-kitchen-inserts');
  const size = variant.startsWith('Voron') ? `${thread} × 5 × 4` : `${thread} × ${l}`;
  const dimensions: Record<string, Dimension> = { l: dimension(l), d: dimension(d), hole: dimension(hole), holeDepth: dimension(l + 1), wall: dimension(wall) };
  return {
    id: `cnc-kitchen-${size.toLowerCase().replace(/ × /g, 'x').replace('.', '-')}`, family: 'threaded-insert',
    title: `Heat-set insert ${size}${variant === 'standard' ? '' : ` (${variant.startsWith('Voron') ? 'Voron' : variant})`}`,
    designation: `CNC Kitchen ${size}`, aliases: [],
    description: `A CNC Kitchen brass heat-set insert with an ${thread} thread, ${l} mm long and ${d} mm across its knurls, melted into a ${hole} mm hole at least ${l + 1} mm deep, with at least ${wall} mm of wall around it.`,
    standard: null, product: { manufacturer: 'CNC Kitchen', sku: size, url: 'https://cnckitchen.store/' },
    attributes: { thread, manufacturer: 'CNC Kitchen', variant }, dimensions, sources: ['cnc-kitchen-inserts'],
    notes: 'CNC Kitchen asks for blind holes at least 1 mm deeper than the insert (`holeDepth` is L + 1 mm).', preview: { kind: 'procedural' },
  };
});

// ruthex's drawings: L, D1 (knurl), pilot, hole, least hole depth, least wall.
const RUTHEX: [thread: string, l: number, d: number, pilot: number, hole: number, holeDepth: number, wall: number, url: string][] = [
  ['M2', 4, 3.6, 3.1, 3.2, 5, 1.3, 'https://www.ruthex.de/en/products/ruthex-gewindeeinsatz-m2-70-stuck-rx-m2x4-messing-gewindebuchsen'],
  ['M3', 5.7, 4.6, 3.91, 4, 6.7, 1.6, 'https://www.ruthex.de/en/products/ruthex-gewindeeinsatz-m3-100-stuck-rx-m3x5-7-messing-gewindebuchsen'],
  ['M4', 8.1, 6.3, 5.5, 5.6, 9.1, 2.1, 'https://www.ruthex.de/en/products/ruthex-gewindeeinsatz-m4-50-stuck-rx-m4x8-1-messing-gewindebuchsen'],
  ['M5', 9.5, 7.1, 6.3, 6.4, 10.5, 2.6, 'https://www.ruthex.de/en/products/ruthex-gewindeeinsatz-m5-50-stuck-rx-m5x9-5-messing-gewindebuchsen'],
];
const ruthex = RUTHEX.map(([thread, l, d, pilot, hole, holeDepth, wall, url]): Part => {
  const dimension = measured('manufacturer', 'ruthex-inserts');
  const sku = `RX-${thread}x${l}`;
  return {
    id: `ruthex-rx-${thread.toLowerCase()}x${String(l).replace('.', '-')}`, family: 'threaded-insert',
    title: `Heat-set insert ${thread} × ${l} (ruthex)`, designation: `ruthex ${sku}`, aliases: [],
    description: `A ruthex brass heat-set insert with an ${thread} thread and opposed spiral knurls, ${l} mm long and ${d} mm across, melted into a ${hole} mm hole at least ${holeDepth} mm deep, with at least ${wall} mm of wall around it.`,
    standard: null, product: { manufacturer: 'ruthex', sku, url },
    attributes: { thread, manufacturer: 'ruthex', variant: 'standard' },
    dimensions: { l: dimension(l), d: dimension(d), pilot: dimension(pilot), hole: dimension(hole), holeDepth: dimension(holeDepth), wall: dimension(wall) },
    sources: ['ruthex-inserts'], notes: null, preview: { kind: 'procedural' },
  };
});

// TODO(parts): press-in (knurled, non-heated) inserts, once a manufacturer's dimension table is found.
export const insertParts: Part[] = [...cncKitchen, ...ruthex];
