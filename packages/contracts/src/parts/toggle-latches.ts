import type { Part, PartFamily } from './schema.ts';
import { measured } from './sources.ts';

/**
 * Over-centre toggle latches (draw latches): a lever on a base plate swings a hook over a separate catch bracket and, pressed
 * down past its centre, draws the two together by its stroke and stays shut. Tool-free and quick to release, they join two parts
 * that must come apart again: the window catio's tunnel docks to its window insert with them.
 */
export const toggleLatchFamily: PartFamily = {
  id: 'toggle-latch', title: 'Toggle latches',
  description: 'Over-centre latches with a separate catch bracket: a lever draws the hook onto the catch and locks past its centre, joining two parts without tools.',
  attributes: [{ key: 'type', label: 'Type' }, { key: 'length', label: 'Length' }, { key: 'material', label: 'Material' }, { key: 'holdingForce', label: 'Holding force' }, { key: 'manufacturer', label: 'Manufacturer' }],
  dimensions: [
    { key: 'b1', label: 'Width of the base plate', symbol: 'b1', required: true },
    { key: 'b2', label: 'Width of the catch bracket', symbol: 'b2', required: true },
    { key: 'b3', label: 'Length of the base plate', symbol: 'b3', required: true },
    { key: 'b4', label: 'Length of the catch bracket', symbol: 'b4', required: true },
    { key: 'd', label: 'Mounting hole diameter', symbol: 'd', required: true },
    { key: 'h1', label: 'Height of the closed latch', symbol: 'h1', required: true },
    { key: 'h2', label: 'Height of the catch bracket’s hook', symbol: 'h2', required: true },
    { key: 'h3', label: 'Height over the safety catch', symbol: 'h3', required: false },
    { key: 'h4', label: 'Height over the padlock eye', symbol: 'h4', required: false },
    { key: 'l1', label: 'Overall length, closed, least (l1 long type, l5 short type)', symbol: 'l1 / l5', required: true },
    { key: 'l2', label: 'Base plate to catch bracket mounting holes, least (l2 long type, l4 short type)', symbol: 'l2 / l4', required: true },
    { key: 'l3', label: 'Base plate end to its mounting holes', symbol: 'l3', required: true },
    { key: 'm1', label: 'Base plate hole spacing', symbol: 'm1', required: true },
    { key: 'm2', label: 'Base plate end to its holes', symbol: 'm2', required: true },
    { key: 'm3', label: 'Catch bracket end to its holes', symbol: 'm3', required: true },
    { key: 'm4', label: 'Catch bracket hole spacing', symbol: 'm4', required: true },
    { key: 'r', label: 'Lever radius', symbol: 'r', required: true },
    { key: 'w1', label: 'Stroke (draw as the lever closes)', symbol: 'w1', required: true },
    { key: 'w2', label: 'Adjustable range of the hook', symbol: 'w2', required: true },
  ],
};

// Ganter's table for GN 831 size 100, read from its product page: the dimensions common to every type, then those that differ.
// Holding capacity F_H 1000 N; b1 25.5, b2 22, b3 26, b4 14, d 4.2, h1 18.5, h2 8.5, l3 19.5, m1 14.3, m2 7, m3 4, m4 8, r 51, w1 5.5.
const GN_831 = { holding: 1000, b1: 25.5, b2: 22, b3: 26, b4: 14, d: 4.2, h1: 18.5, h2: 8.5, l3: 19.5, m1: 14.3, m2: 7, m3: 4, m4: 8, r: 51, w1: 5.5 } as const;
// Per type: least overall length l1 (long, identification 1) and l5 (short, 2), least hole spacing l2 (long) and l4 (short), the
// hook's adjustable range w2, and the height over the safety catch (h3, type S) or the padlock eye (h4, type SV).
const GN_831_TYPES: { type: 'A' | 'S' | 'SV'; name: string; l1: number; l2: number; l5: number; l4: number; w2: number; h3?: number; h4?: number }[] = [
  { type: 'A', name: 'without safety catch', l1: 67, l2: 56, l5: 54, l4: 31, w2: 12 },
  { type: 'S', name: 'with safety catch', l1: 74, l2: 63, l5: 61, l4: 38, w2: 8, h3: 21.5 },
  { type: 'SV', name: 'with padlock eye', l1: 67, l2: 56, l5: 54, l4: 31, w2: 12, h4: 25.5 },
];
const MATERIALS = [
  { code: 'ST', name: 'steel', attribute: 'Steel, zinc plated', text: 'zinc-plated, blue passivated steel' },
  { code: 'NI', name: 'stainless', attribute: 'Stainless steel', text: 'stainless steel (AISI 304 sheet, AISI 303 hook and pin)' },
] as const;
const LENGTHS = [{ id: 1, name: 'long' }, { id: 2, name: 'short' }] as const;

const ganter = GN_831_TYPES.flatMap(t => MATERIALS.flatMap(material => LENGTHS.map((length): Part => {
  const dimension = measured('manufacturer', 'ganter-gn-831');
  const designation = `GN 831-100-${t.type}-${material.code}-${length.id}`;
  const long = length.id === 1;
  const { holding, ...common } = GN_831;
  return {
    id: `ganter-gn-831-100-${t.type.toLowerCase()}-${material.code.toLowerCase()}-${length.id}`, family: 'toggle-latch',
    title: `Toggle latch GN 831, ${length.name}, ${t.name}, ${material.name}`, designation, aliases: [],
    description: `A Ganter GN 831 size 100 toggle latch in ${material.text}, ${length.name} type (identification no. ${length.id}), ${t.name}: its lever draws the hook ${common.w1} mm onto a separate catch bracket and holds ${holding} N.`,
    standard: null, product: { manufacturer: 'Otto Ganter GmbH & Co. KG', sku: designation, url: 'https://www.ganternorm.com/en/products/2.4-Tensioning-with-clamping-mechanisms/Toggle-latches/GN-831-Toggle-latches-Steel-Stainless-Steel' },
    attributes: { type: `${t.type}, ${t.name}`, length: long ? 'Long (1)' : 'Short (2)', material: material.attribute, holdingForce: `${holding} N`, manufacturer: 'Ganter' },
    dimensions: {
      ...Object.fromEntries(Object.entries(common).map(([key, value]) => [key, dimension(value)])),
      l1: dimension(long ? t.l1 : t.l5), l2: dimension(long ? t.l2 : t.l4), w2: dimension(t.w2),
      ...(t.h3 ? { h3: dimension(t.h3) } : {}), ...(t.h4 ? { h4: dimension(t.h4) } : {}),
    },
    sources: ['ganter-gn-831'],
    notes: `Ganter lists the overall length${long ? ' l1' : ' l5'} and hole spacing${long ? ' l2' : ' l4'} as least values: the hook can be set up to w2 further, which takes up how far apart the two parts end up. The holes take ${common.d} mm screws; the catch bracket (b2 × b4) is drawn and dimensioned as part of the article.${t.type === 'SV' ? ' The drawing gives the padlock eye as Ø6.' : ''}`,
    preview: { kind: 'procedural' },
  };
})));

export const toggleLatchParts: Part[] = [...ganter];
