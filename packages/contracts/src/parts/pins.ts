import type { Part, PartFamily } from './schema.ts';
import { measured } from './sources.ts';

export const pinFamily: PartFamily = {
  id: 'pin', title: 'Pins and dowels',
  description: 'Parallel (dowel) pins: hardened ISO 8734 pins with rounded ends, and unhardened ISO 2338 pins, for axles, hinges and locating parts.',
  attributes: [{ key: 'diameter', label: 'Diameter' }, { key: 'standard', label: 'Standard' }, { key: 'length', label: 'Length' }],
  dimensions: [
    { key: 'd', label: 'Diameter (tolerance m6)', symbol: 'd', required: true },
    { key: 'l', label: 'Length', symbol: 'l', required: true },
    { key: 'c', label: 'End chamfer', symbol: 'c', required: true },
  ],
};

/** The m6 limits of a shaft (ISO 286-2), in mm above the nominal diameter, for diameters up to 10 mm. */
function m6(d: number): [number, number] {
  return d <= 3 ? [0.002, 0.008] : d <= 6 ? [0.004, 0.012] : [0.006, 0.015];
}

interface PinStandard { source: string; reference: string; code: string; name: string; title: string; describe: (d: number, l: number) => string; rows: [d: number, c: number, lengths: number[]][] }

function pins(standard: PinStandard): Part[] {
  const dimension = measured('standard', standard.reference);
  return standard.rows.flatMap(([d, c, lengths]) => lengths.map((l): Part => {
    const [low, high] = m6(d);
    return {
      id: `${standard.code}-${String(d).replace('.', '-')}x${l}`, family: 'pin', title: `${standard.title} ${d} × ${l}`,
      designation: `${standard.name} ${d} m6 × ${l}`, aliases: [], description: standard.describe(d, l),
      standard: standard.source, product: null, attributes: { diameter: `${d} mm`, standard: standard.name, length: `${l} mm` },
      dimensions: { d: { ...dimension(d, Number((d + low).toFixed(3)), Number((d + high).toFixed(3))), source: 'iso-286-2' }, l: dimension(l), c: dimension(c) },
      sources: [standard.source, standard.reference, 'iso-286-2'],
      notes: 'The lengths listed are common trade lengths within the range of the standard. The m6 diameter is slightly oversize, for a press fit in a reamed hole; in a printed hole, size the hole from the greatest diameter.',
      preview: { kind: 'procedural' },
    };
  }));
}

// ISO 8734: d, c (the reference's table), trade lengths.
const iso8734 = pins({
  source: 'iso-8734', reference: 'fasteners-eu-iso-8734', code: 'iso-8734', name: 'ISO 8734', title: 'Hardened dowel pin',
  describe: (d, l) => `A hardened steel dowel pin, ${d} mm in diameter (m6) and ${l} mm long, with one rounded and one chamfered end (ISO 8734, formerly DIN 6325).`,
  rows: [
    [2, 0.35, [6, 8, 10, 12, 16, 20]], [2.5, 0.4, [6, 8, 10, 12, 16, 20]], [3, 0.5, [8, 10, 12, 16, 20, 24, 30]],
    [4, 0.63, [8, 10, 12, 16, 20, 24, 30, 40]], [5, 0.8, [10, 12, 16, 20, 24, 30, 40, 50]], [6, 1.2, [12, 16, 20, 24, 30, 40, 50, 60]],
    [8, 1.6, [16, 20, 24, 30, 40, 50, 60, 80]],
  ],
});

// ISO 2338: d, c (the reference's table), trade lengths.
const iso2338 = pins({
  source: 'iso-2338', reference: 'fasteners-eu-iso-2338', code: 'iso-2338', name: 'ISO 2338', title: 'Parallel pin',
  describe: (d, l) => `An unhardened steel parallel pin, ${d} mm in diameter (m6) and ${l} mm long, with chamfered ends (ISO 2338, formerly DIN 7).`,
  rows: [
    [2, 0.3, [8, 10, 12, 16, 20]], [2.5, 0.4, [8, 10, 12, 16, 20]], [3, 0.45, [8, 10, 12, 16, 20, 30]],
    [4, 0.6, [10, 12, 16, 20, 30, 40]], [5, 0.75, [10, 12, 16, 20, 30, 40, 50]], [6, 0.9, [12, 16, 20, 30, 40, 50, 60]],
    [8, 1.2, [16, 20, 30, 40, 50, 60, 80]],
  ],
});

export const pinParts: Part[] = [...iso8734, ...iso2338];
