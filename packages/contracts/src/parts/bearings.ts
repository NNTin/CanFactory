import type { Part, PartFamily } from './schema.ts';
import { measured } from './sources.ts';

export const bearingFamily: PartFamily = {
  id: 'bearing', title: 'Ball bearings',
  description: 'Single-row deep groove ball bearings in the common small sizes, such as the 608 of skateboards and filament spool holders.',
  attributes: [{ key: 'series', label: 'Series' }, { key: 'bore', label: 'Bore' }],
  dimensions: [
    { key: 'd', label: 'Bore', symbol: 'd', required: true },
    { key: 'D', label: 'Outside diameter', symbol: 'D', required: true },
    { key: 'B', label: 'Width', symbol: 'B', required: true },
  ],
};

// Boundary dimensions per ISO 15 (DIN 625): designation, d, D, B.
const BEARINGS: [designation: string, d: number, D: number, B: number][] = [
  ['623', 3, 10, 4], ['624', 4, 13, 5], ['625', 5, 16, 5], ['626', 6, 19, 6], ['608', 8, 22, 7],
  ['688', 8, 16, 5], ['6800', 10, 19, 5], ['6000', 10, 26, 8], ['6001', 12, 28, 8],
];

export const bearingParts: Part[] = BEARINGS.map(([designation, d, D, B]): Part => {
  const dimension = measured('standard', 'igus-ball-bearing-table');
  // The three-digit designations are the miniature bearings; 60xx and 68xx are the 6000 and 6800 (thin section) series.
  const series = designation.length === 3 ? 'miniature' : `${designation.slice(0, 2)}00`;
  return {
    id: `bearing-${designation}`, family: 'bearing', title: `Ball bearing ${designation}`, designation,
    aliases: [`${designation}-2Z`, `${designation}-2RS`],
    description: `A ${designation} deep groove ball bearing with a ${d} mm bore, ${D} mm outside diameter and ${B} mm width (ISO 15 boundary dimensions; open, shielded -2Z and sealed -2RS versions share them).`,
    standard: 'iso-15', product: null, attributes: { series, bore: `${d} mm` },
    dimensions: { d: dimension(d), D: dimension(D), B: dimension(B) },
    sources: ['iso-15', 'igus-ball-bearing-table'], notes: null, preview: { kind: 'procedural' },
  };
});
