import type { Part, PartFamily } from './schema.ts';
import { measured } from './sources.ts';

/**
 * Solid-core hookup wire, for the wires routed on a prototype board and laid in a printed wire guide: one part is one wire (a
 * gauge, insulation and maker), sold by the reel. A guide's channel is cut to the insulation's largest outer diameter
 * (`dimensionOf(part, 'D', 'max')`, see `hookupWireChannelWidth`), and its funnels to the conductor. See docs/adding-parts.md,
 * “Hookup wire”.
 */
export const hookupWireFamily: PartFamily = {
  id: 'hookup-wire', title: 'Hookup wire',
  description: 'Solid-core hookup and wire-wrap wire by gauge: the conductor’s diameter, the insulation’s outer diameter with its tolerance and its wall, the cross-section, the insulation material and the temperature rating.',
  attributes: [
    { key: 'awg', label: 'Gauge (AWG)' }, { key: 'crossSection', label: 'Cross-section' }, { key: 'conductor', label: 'Conductor' },
    { key: 'insulation', label: 'Insulation' }, { key: 'temperature', label: 'Temperature rating' }, { key: 'voltage', label: 'Voltage rating' },
    { key: 'ul', label: 'UL style' }, { key: 'manufacturer', label: 'Manufacturer' },
  ],
  dimensions: [
    { key: 'd', label: 'Conductor diameter', symbol: 'd', required: true },
    { key: 'D', label: 'Insulation outer diameter (a channel takes the max)', symbol: 'D', required: true },
    { key: 't', label: 'Insulation wall, nominal', symbol: 't', required: false },
  ],
};

/** A wire's numbers that are not lengths: its gauge, its cross-section in mm² and its highest rated temperature in °C. */
export interface HookupWireRating { awg: number; crossSection: number; temperature: number }

/**
 * ASTM B258's solid conductors: the diameter (mm, from the standard's inches) and cross-section (mm²) of each gauge in the library.
 * d(n) = 0.127 mm × 92^((36 − n) / 39), A = π d² / 4.
 */
export const AWG_SOLID: Record<number, { d: number; area: number }> = {
  22: { d: 0.6438, area: 0.3255 }, 24: { d: 0.5106, area: 0.2047 }, 26: { d: 0.4049, area: 0.1288 }, 30: { d: 0.2546, area: 0.0509 },
};

const INCH = 25.4;
const mm = (inches: number) => Math.round(inches * INCH * 10000) / 10000;

const awg = measured('standard', 'astm-b258-table');
const estimate = measured('estimated', 'canfactory-hookup-wire-estimate');

interface WireRow {
  id: string; awg: 22 | 24 | 26 | 30; title: string; designation: string; aliases: string[]; description: string;
  product: Part['product']; conductor: string; insulation: string; temperature: number; voltage: string; ul: string; manufacturer: string;
  dimensions: Part['dimensions']; sources: string[]; notes: string;
}

function wire(row: WireRow): Part {
  return {
    id: row.id, family: 'hookup-wire', title: row.title, designation: row.designation, aliases: row.aliases, description: row.description,
    standard: null, product: row.product,
    attributes: {
      awg: String(row.awg), crossSection: `${AWG_SOLID[row.awg]?.area ?? 0} mm²`, conductor: row.conductor, insulation: row.insulation,
      temperature: `${row.temperature} °C`, voltage: row.voltage, ul: row.ul, manufacturer: row.manufacturer,
    },
    dimensions: row.dimensions, sources: row.sources, notes: row.notes, preview: { kind: 'procedural' },
  };
}

const alpha3051 = measured('manufacturer', 'alpha-wire-3051-1');
const alpha3050 = measured('manufacturer', 'alpha-wire-3050-1');
const jonard = measured('manufacturer', 'jonard-kynar-30');
const ALPHA_NOTES = 'Alpha Wire gives the conductor and the insulated diameter in inches (± 0.002"), and the wall as a nominal 0.016"; they are converted here. UL AWM style 1569 rates it 105 °C and style 1007 80 °C, both 300 V; the library lists the higher rating. PVC softens near a soldering iron: keep the guide’s funnels clear of the solder side.';

export const hookupWireParts: Part[] = [
  wire({
    id: 'alpha-wire-3051-1', awg: 22, title: 'Alpha Wire 3051/1 hookup wire, 22 AWG solid, PVC', designation: 'Alpha Wire 3051/1',
    aliases: ['22 AWG solid hook-up wire, UL 1007', 'UL 1569 22 AWG solid'],
    description: 'Alpha Wire’s 22 AWG solid tinned-copper hookup wire under a 0.016" PVC wall, 1.45 mm over the insulation: the usual breadboard and prototype-board wire.',
    product: { manufacturer: 'Alpha Wire', sku: '3051/1', url: 'https://www.alphawire.com/Products/Wire/Hook-Up-Wire/Premium/3051_1' },
    conductor: 'solid tinned copper', insulation: 'PVC', temperature: 105, voltage: '300 V', ul: '1007 / 1569', manufacturer: 'Alpha Wire',
    dimensions: { d: alpha3051(mm(0.025)), D: alpha3051(mm(0.057), mm(0.055), mm(0.059)), t: alpha3051(mm(0.016)) },
    sources: ['alpha-wire-3051-1', 'astm-b258-table'], notes: ALPHA_NOTES,
  }),
  wire({
    id: 'alpha-wire-3050-1', awg: 24, title: 'Alpha Wire 3050/1 hookup wire, 24 AWG solid, PVC', designation: 'Alpha Wire 3050/1',
    aliases: ['24 AWG solid hook-up wire, UL 1007', 'UL 1569 24 AWG solid'],
    description: 'Alpha Wire’s 24 AWG solid tinned-copper hookup wire under a 0.016" PVC wall, 1.32 mm over the insulation: thinner than 22 AWG, so more channels fit between the holes.',
    product: { manufacturer: 'Alpha Wire', sku: '3050/1', url: 'https://www.alphawire.com/Products/Wire/Hook-Up-Wire/Premium/3050_1' },
    conductor: 'solid tinned copper', insulation: 'PVC', temperature: 105, voltage: '300 V', ul: '1007 / 1569', manufacturer: 'Alpha Wire',
    dimensions: { d: alpha3050(mm(0.020)), D: alpha3050(mm(0.052), mm(0.050), mm(0.054)), t: alpha3050(mm(0.016)) },
    sources: ['alpha-wire-3050-1', 'astm-b258-table'], notes: ALPHA_NOTES,
  }),
  wire({
    id: 'generic-hookup-wire-26awg-solid-pvc', awg: 26, title: 'Hookup wire, 26 AWG solid, PVC (generic)', designation: '26 AWG solid PVC hookup wire, UL 1007',
    aliases: ['26 AWG solid core wire', 'UL 1007 26 AWG solid'],
    description: 'The generic 26 AWG solid tinned-copper hookup wire under PVC sold on reels by many shops, about 1.2 mm over the insulation.',
    product: { manufacturer: 'Generic (sold unbranded by many shops)', sku: '26 AWG solid PVC hookup wire', url: 'https://github.com/NNTin/CanFactory/blob/develop/docs/adding-parts.md#hookup-wire' },
    conductor: 'solid tinned copper', insulation: 'PVC', temperature: 80, voltage: '300 V', ul: '1007', manufacturer: 'Generic',
    // the conductor is the gauge's; the wall is UL 1007's usual nominal 0.016" (as Alpha's 22 and 24 AWG), ± 0.002" as theirs
    dimensions: { d: awg(AWG_SOLID[26]?.d ?? 0), D: estimate(mm(0.048), mm(0.046), mm(0.050)), t: estimate(mm(0.016)) },
    sources: ['astm-b258-table', 'canfactory-hookup-wire-estimate'],
    notes: 'No maker of this unbranded wire publishes a drawing. The conductor is ASTM B258’s 26 AWG; the insulation is drawn as UL 1007’s usual nominal 0.016" PVC wall, as Alpha Wire’s 22 and 24 AWG, with their ± 0.002" on the outer diameter: estimated. Measure your reel, and correct a value under the same id. Rated 80 °C (UL 1007).',
  }),
  wire({
    id: 'jonard-kynar-30awg', awg: 30, title: 'Jonard 30 AWG Kynar wire-wrap wire', designation: 'Jonard Tools R-30 series, 30 AWG Kynar',
    aliases: ['30 AWG wire-wrap wire', 'Kynar wire-wrap wire'],
    description: 'Jonard’s 30 AWG wire-wrap wire: a solid silver-plated copper conductor under a thin 0.005" Kynar (PVDF) wall, 0.5 mm over the insulation, for dense routing.',
    product: { manufacturer: 'Jonard Tools', sku: 'R-30 (30 AWG Kynar, white, 100 ft)', url: 'https://jonard.com/wire-wrap-wire-kynar-and-tefzel?v=431' },
    conductor: 'solid silver-plated copper', insulation: 'Kynar (PVDF)', temperature: 105, voltage: 'not rated', ul: '1423', manufacturer: 'Jonard Tools',
    dimensions: { d: awg(AWG_SOLID[30]?.d ?? 0), D: jonard(mm(0.020)), t: jonard(mm(0.005)) },
    sources: ['jonard-kynar-30', 'astm-b258-table'],
    notes: 'Jonard gives the gauge (0.25 mm), the 0.005" wall and the 0.020" (0.50 mm) overall diameter, without a tolerance; the conductor is ASTM B258’s 30 AWG. Kynar stands soldering heat better than PVC, and its thin wall packs the most channels between the holes, but it nicks easily on sharp channel edges.',
  }),
];

/** A hookup wire's gauge, cross-section and temperature rating, or undefined for any other part. */
export function hookupWireRating(part: Part): HookupWireRating | undefined {
  if (part.family !== 'hookup-wire') return undefined;
  const number = (key: string) => Number.parseFloat(part.attributes[key] ?? '');
  return { awg: number('awg'), crossSection: number('crossSection'), temperature: number('temperature') };
}

/** The width of a guide channel for a hookup wire: its insulation's largest outer diameter plus the clearance. */
export function hookupWireChannelWidth(part: Part, clearance: number): number {
  const D = part.dimensions['D'];
  if (part.family !== 'hookup-wire' || !D) throw new Error(`${part.id} is not a hookup wire.`);
  return (D.max ?? D.value) + clearance;
}
