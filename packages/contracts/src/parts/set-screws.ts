import type { Part, PartFamily } from './schema.ts';
import { measured } from './sources.ts';

export const setScrewFamily: PartFamily = {
  id: 'set-screw', title: 'Set screws',
  description: 'Headless hexagon socket set screws (grub screws) with a flat point, ISO 4026: threaded all along, turned with a hex key.',
  attributes: [{ key: 'thread', label: 'Thread' }, { key: 'point', label: 'Point' }, { key: 'length', label: 'Length' }],
  dimensions: [
    { key: 'd', label: 'Thread diameter', symbol: 'd', required: true },
    { key: 'pitch', label: 'Thread pitch', symbol: 'P', required: true },
    { key: 'l', label: 'Length', symbol: 'l', required: true },
    { key: 'dp', label: 'Flat point diameter', symbol: 'dp', required: true },
    { key: 's', label: 'Hex key (socket width across flats)', symbol: 's', required: true },
    { key: 't', label: 'Socket depth (shorter screws)', symbol: 't', required: true },
  ],
};

// ISO 4026: thread, P, dp max / min, s nominal / min / max, t min (the shorter lengths' row), trade lengths.
const ROWS: [thread: string, pitch: number, dp: [number, number], s: [number, number, number], t: number, lengths: number[]][] = [
  ['M3', 0.5, [2, 1.75], [1.5, 1.52, 1.545], 1.2, [3, 4, 5, 6, 8, 10]],
  ['M4', 0.7, [2.5, 2.25], [2, 2.02, 2.045], 1.5, [4, 5, 6, 8, 10, 12]],
  ['M5', 0.8, [3.5, 3.2], [2.5, 2.52, 2.56], 2, [5, 6, 8, 10, 12]],
  ['M6', 1, [4, 3.7], [3, 3.02, 3.08], 2, [6, 8, 10, 12, 16]],
  ['M8', 1.25, [5.5, 5.2], [4, 4.02, 4.095], 3, [8, 10, 12, 16]],
];

export const setScrewParts: Part[] = ROWS.flatMap(([thread, pitch, [dpMax, dpMin], [s, sMin, sMax], t, lengths]) => lengths.map((l): Part => {
  const dimension = measured('standard', 'fasteners-eu-iso-4026');
  return {
    id: `iso-4026-${thread.toLowerCase()}x${l}`, family: 'set-screw', title: `Set screw ${thread} × ${l}`, designation: `ISO 4026 ${thread} × ${l}`,
    aliases: [`DIN 913 ${thread}x${l}`],
    description: `An ${thread} hexagon socket set screw, ${l} mm long and headless, with a ${dpMax} mm flat point, turned with a ${s} mm hex key (ISO 4026, formerly DIN 913).`,
    standard: 'iso-4026', product: null, attributes: { thread, point: 'flat', length: `${l} mm` },
    dimensions: {
      d: dimension(Number(thread.slice(1))), pitch: dimension(pitch), l: dimension(l), dp: dimension(dpMax, dpMin, dpMax),
      s: dimension(s, sMin, sMax), t: dimension(t, t),
    },
    sources: ['iso-4026', 'fasteners-eu-iso-4026', 'iso-261'],
    notes: 'The lengths listed are common trade lengths within the range of the standard. t is the least socket depth of the shorter lengths.',
    preview: { kind: 'procedural' },
  };
}));
