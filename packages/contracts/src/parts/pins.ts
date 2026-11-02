import type { Part, PartFamily } from './schema.ts';
import { measured } from './sources.ts';

export const pinFamily: PartFamily = {
  id: 'pin', title: 'Pins and dowels',
  description: 'Parallel (dowel) pins: hardened ISO 8734 pins with rounded ends, and ISO 2338 pins of unhardened or austenitic stainless steel (A1), for axles, hinges and locating parts.',
  attributes: [{ key: 'diameter', label: 'Diameter' }, { key: 'standard', label: 'Standard' }, { key: 'length', label: 'Length' }, { key: 'material', label: 'Material' }],
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

interface PinStandard {
  source: string; reference: string; code: string; name: string; title: string; describe: (d: number, l: number) => string; rows: [d: number, c: number, lengths: number[]][];
  /** The material's attribute, and its grade where it is part of the designation and the id (e.g. A1). */
  material: string; grade?: string;
}

function pins(standard: PinStandard): Part[] {
  const dimension = measured('standard', standard.reference);
  return standard.rows.flatMap(([d, c, lengths]) => lengths.map((l): Part => {
    const [low, high] = m6(d);
    const grade = standard.grade;
    return {
      id: `${standard.code}-${String(d).replace('.', '-')}x${l}${grade ? `-${grade.toLowerCase()}` : ''}`, family: 'pin', title: `${standard.title} ${d} × ${l}`,
      designation: `${standard.name} ${d} m6 × ${l}${grade ? ` – ${grade}` : ''}`, aliases: [], description: standard.describe(d, l),
      standard: standard.source, product: null, attributes: { diameter: `${d} mm`, standard: standard.name, length: `${l} mm`, material: standard.material },
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
  material: 'Hardened steel',
  rows: [
    [2, 0.35, [6, 8, 10, 12, 16, 20]], [2.5, 0.4, [6, 8, 10, 12, 16, 20]], [3, 0.5, [8, 10, 12, 16, 20, 24, 30]],
    [4, 0.63, [8, 10, 12, 16, 20, 24, 30, 40]], [5, 0.8, [10, 12, 16, 20, 24, 30, 40, 50]], [6, 1.2, [12, 16, 20, 24, 30, 40, 50, 60]],
    [8, 1.6, [16, 20, 24, 30, 40, 50, 60, 80]],
  ],
});

// ISO 2338: d, c (the reference's table), trade lengths. The same table lists the stainless grades A1 and A4 ("Makings").
const ISO_2338_ROWS: PinStandard['rows'] = [
  [2, 0.3, [8, 10, 12, 16, 20]], [2.5, 0.4, [8, 10, 12, 16, 20]], [3, 0.45, [8, 10, 12, 16, 20, 30]],
  [4, 0.6, [10, 12, 16, 20, 30, 40]], [5, 0.75, [10, 12, 16, 20, 30, 40, 50]], [6, 0.9, [12, 16, 20, 30, 40, 50, 60]],
  [8, 1.2, [16, 20, 30, 40, 50, 60, 80]],
];
const iso2338 = pins({
  source: 'iso-2338', reference: 'fasteners-eu-iso-2338', code: 'iso-2338', name: 'ISO 2338', title: 'Parallel pin',
  describe: (d, l) => `An unhardened steel parallel pin, ${d} mm in diameter (m6) and ${l} mm long, with chamfered ends (ISO 2338, formerly DIN 7).`,
  material: 'Steel', rows: ISO_2338_ROWS,
});
// The same pins in austenitic stainless steel A1 (listed for ISO 2338 by the same table; it does not rust): the id and designation add the grade.
const iso2338A1 = pins({
  source: 'iso-2338', reference: 'fasteners-eu-iso-2338', code: 'iso-2338', name: 'ISO 2338', title: 'Stainless parallel pin',
  describe: (d, l) => `A stainless steel (austenitic, A1) parallel pin, ${d} mm in diameter (m6) and ${l} mm long, with chamfered ends (ISO 2338 – A1, formerly DIN 7).`,
  material: 'Stainless steel A1', grade: 'A1', rows: ISO_2338_ROWS,
});

export const pinParts: Part[] = [...iso8734, ...iso2338, ...iso2338A1];
