import type { Part, PartFamily } from './schema.ts';
import { measured } from './sources.ts';

export const insertNutFamily: PartFamily = {
  id: 'insert-nut', title: 'Insert nuts for wood',
  description: 'Steel sleeves with a metric thread inside and a coarse wood thread outside, screwed into a drilled hole to give timber a lasting machine thread.',
  attributes: [{ key: 'thread', label: 'Thread' }, { key: 'standard', label: 'Standard' }],
  dimensions: [
    { key: 'd', label: 'Outer diameter of the wood thread', symbol: 'd2', required: true },
    { key: 'core', label: 'Core diameter of the wood thread', symbol: 'd3', required: true },
    { key: 'l', label: 'Length', symbol: 'l', required: true },
    { key: 'threadLength', label: 'Length of the metric thread', symbol: 'l2', required: true },
    { key: 'hole', label: 'Hole diameter', symbol: 'd5', required: true },
  ],
};

// DIN 7965 (the reference's table): thread, d2, d3, d5, l2, and the length l the table marks for that thread.
const DIN_7965: [thread: string, d: number, core: number, hole: number, threadLength: number, l: number][] = [
  ['M6', 12, 9.5, 10.5, 9, 15], ['M8', 16, 12.5, 14.5, 11, 18], ['M10', 18.5, 15, 17, 13, 25],
];

const din7965 = DIN_7965.map(([thread, d, core, hole, threadLength, l]): Part => {
  const dimension = measured('standard', 'fasteners-eu-din-7965');
  return {
    id: `din-7965-${thread.toLowerCase()}x${l}`, family: 'insert-nut', title: `Insert nut for wood ${thread} × ${l}`,
    designation: `DIN 7965 ${thread} × ${l}`, aliases: [],
    description: `A steel insert nut (DIN 7965) with an ${thread} thread inside and a coarse ${d} mm wood thread outside, ${l} mm long, screwed into a ${hole} mm hole in timber.`,
    standard: 'din-7965', product: null, attributes: { thread, standard: 'DIN 7965' },
    dimensions: { d: dimension(d), core: dimension(core), l: dimension(l), threadLength: dimension(threadLength), hole: dimension(hole) },
    sources: ['din-7965', 'fasteners-eu-din-7965'],
    notes: 'The reference’s table lists d5 without labelling it in its legend; it is read here as the hole, since it lies between the core and outer diameter of the wood thread, as the hole for an insert nut must. Drill a test hole in the actual timber first: hardwood takes the larger hole, softwood a smaller one.',
    preview: { kind: 'procedural' },
  };
});

export const insertNutParts: Part[] = [...din7965];
