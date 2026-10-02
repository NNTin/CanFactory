import type { Part, PartFamily } from './schema.ts';
import { measured } from './sources.ts';

export const woodScrewFamily: PartFamily = {
  id: 'wood-screw', title: 'Wood screws',
  description: 'Screws with a coarse, self-tapping wood thread, by standard, diameter and length: for timber frames, battens and joints.',
  attributes: [{ key: 'diameter', label: 'Diameter' }, { key: 'head', label: 'Head' }, { key: 'standard', label: 'Standard' }, { key: 'length', label: 'Length' }],
  dimensions: [
    { key: 'd', label: 'Nominal (thread) diameter', symbol: 'd', required: true },
    { key: 'l', label: 'Length, including the countersunk head', symbol: 'l', required: true },
    { key: 'dk', label: 'Head diameter', symbol: 'dk', required: true },
    { key: 'k', label: 'Head height', symbol: 'k', required: true },
    { key: 'b', label: 'Thread length (least)', symbol: 'b', required: false },
  ],
};

// DIN 7997 (the reference's table): d, k, dk (the table's d1), trade lengths. The thread runs at least 0.6 × l.
const DIN_7997: [d: number, k: number, dk: number, lengths: number[]][] = [
  [3, 1.65, 5.6, [12, 16, 20, 25, 30]], [3.5, 1.93, 6.5, [16, 20, 25, 30, 35, 40]], [4, 2.2, 7.5, [20, 25, 30, 35, 40, 45, 50]],
  [4.5, 2.35, 8.3, [25, 30, 35, 40, 45, 50, 60]], [5, 2.5, 9.2, [30, 35, 40, 50, 60, 70, 80]], [6, 3, 11, [40, 50, 60, 70, 80, 90, 100]],
];

const din7997 = DIN_7997.flatMap(([d, k, dk, lengths]) => lengths.map((l): Part => {
  const dimension = measured('standard', 'fasteners-eu-din-7997');
  const size = `${d} × ${l}`;
  return {
    id: `din-7997-${String(d).replace('.', '-')}x${l}`, family: 'wood-screw', title: `Countersunk wood screw ${size}`,
    designation: `DIN 7997 ${size}`, aliases: [],
    description: `A ${d} mm countersunk wood screw, ${l} mm long overall, with a cross recess and a ${dk} mm head that sits flush in a countersink (DIN 7997).`,
    standard: 'din-7997', product: null, attributes: { diameter: `${d} mm`, head: 'countersunk', standard: 'DIN 7997', length: `${l} mm` },
    dimensions: { d: dimension(d), l: dimension(l), dk: dimension(dk), k: dimension(k), b: dimension(Number((0.6 * l).toFixed(1)), Number((0.6 * l).toFixed(1)), null) },
    sources: ['din-7997', 'fasteners-eu-din-7997'],
    notes: 'The lengths listed are common trade lengths within the range of the standard. The thread length is the standard’s least (0.6 × l); many screws are threaded further. The standard gives no thread pitch: the wood thread cuts its own.',
    preview: { kind: 'procedural' },
  };
}));

export const woodScrewParts: Part[] = [...din7997];
