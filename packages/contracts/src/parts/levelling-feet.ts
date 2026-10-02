import type { Part, PartFamily } from './schema.ts';
import { measured } from './sources.ts';

/**
 * Swivelling feet on a threaded stud. Besides levelling machines, a foot turned in a threaded hole presses its pad against a
 * surface without fixing to it: the window catio's insert is held in the window recess this way (a padded spreader clamp).
 */
export const levellingFootFamily: PartFamily = {
  id: 'levelling-foot', title: 'Levelling feet and pressure pads',
  description: 'Swivelling feet on a threaded stud that level a frame or, turned in a threaded hole, press a padded foot against a wall or reveal as a clamp.',
  attributes: [{ key: 'thread', label: 'Thread' }, { key: 'footDiameter', label: 'Foot diameter' }, { key: 'pad', label: 'Pad' }, { key: 'manufacturer', label: 'Manufacturer' }],
  dimensions: [
    { key: 'd1', label: 'Foot diameter', symbol: 'd1', required: true },
    { key: 'd', label: 'Thread diameter', symbol: 'd2', required: true },
    { key: 'l1', label: 'Stud length (above the hexagon)', symbol: 'l1', required: true },
    { key: 'l2', label: 'Height of the foot without its cap, to the top of the hexagon', symbol: 'l2', required: true },
    { key: 'l3', label: 'Height of the foot with its cap', symbol: 'l3', required: false },
    { key: 'l4', label: 'Foot plate thickness', symbol: 'l4', required: true },
    { key: 'l5', label: 'Foot plate and cap thickness', symbol: 'l5', required: false },
    { key: 's', label: 'Hexagon width across flats', symbol: 'A/F', required: true },
  ],
};

// Ganter's table for GN 343.2: d1, thread, stud lengths l1, l2, l3, l4, l5, A/F, and the static load of a type KR foot in kN.
const GN_343_2: [d1: number, thread: string, l1: number[], l2: number, l3: number, l4: number, l5: number, af: number, loadKr: number][] = [
  [25, 'M8', [40, 50, 63], 19, 20.5, 4, 5.5, 12, 1], [25, 'M10', [50, 63, 80], 19, 20.5, 4, 5.5, 12, 1],
  [32, 'M8', [40, 50, 63], 23, 24.5, 5, 6.5, 12, 2], [32, 'M10', [50, 63, 80], 23, 24.5, 5, 6.5, 15, 2],
  [40, 'M8', [50, 63, 80], 26, 27.5, 6, 7.5, 15, 3], [40, 'M10', [50, 63, 80], 26, 27.5, 6, 7.5, 15, 3],
];

const ganter = GN_343_2.flatMap(([d1, thread, lengths, l2, l3, l4, l5, af, load]) => lengths.map((l1): Part => {
  const dimension = measured('manufacturer', 'ganter-gn-343-2');
  const designation = `GN 343.2-${d1}-${thread}-${l1}-KR`;
  return {
    id: `ganter-gn-343-2-${d1}-${thread.toLowerCase()}-${l1}-kr`, family: 'levelling-foot', title: `Levelling foot ${d1} mm, ${thread} × ${l1}, rubber pad`,
    designation, aliases: [],
    description: `A Ganter GN 343.2 steel levelling foot, ${d1} mm across, that swivels 15° on a ball under an ${thread} × ${l1} threaded stud with a hex nut; type KR has a non-gliding elastomer (TPE) cap.`,
    standard: null, product: { manufacturer: 'Otto Ganter GmbH & Co. KG', sku: designation, url: 'https://www.ganternorm.com/en/products/3.4-Installing-lifting-dampening-with-levelling-feet-lifting-gear-and-rubber-elements/Levelling-feet/GN-343.2-Leveling-Feet-Steel-with-Threaded-Stud' },
    attributes: { thread, footDiameter: `${d1} mm`, pad: 'TPE, non-gliding (KR)', manufacturer: 'Ganter' },
    dimensions: { d1: dimension(d1), d: dimension(Number(thread.slice(1))), l1: dimension(l1), l2: dimension(l2), l3: dimension(l3), l4: dimension(l4), l5: dimension(l5), s: dimension(af) },
    sources: ['ganter-gn-343-2'],
    notes: `Steel, property class 5.8, zinc plated; the cap is TPE of about 78 Shore A; an ISO 4032 hex nut is supplied on the stud. Ganter gives a static load of ${load} kN for type KR (the cap limits it).`,
    preview: { kind: 'procedural' },
  };
}));

export const levellingFootParts: Part[] = [...ganter];
