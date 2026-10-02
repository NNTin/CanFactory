import type { Part, PartFamily } from './schema.ts';
import { measured } from './sources.ts';

export const nailFamily: PartFamily = {
  id: 'nail', title: 'Nails and staples',
  description: 'Driven steel fasteners for timber: U-shaped wire staples that hold wire mesh, fencing or cables against a post or frame.',
  attributes: [{ key: 'kind', label: 'Kind' }, { key: 'standard', label: 'Standard' }, { key: 'size', label: 'Size' }],
  dimensions: [
    { key: 'd', label: 'Wire diameter', symbol: 'd', required: true },
    { key: 'l', label: 'Length (of each leg, crown to point)', symbol: 'l', required: true },
  ],
};

// DIN 1159 staples are designated by wire diameter × length; these are the sizes the reference lists.
const DIN_1159: [d: number, l: number][] = [[2.5, 25], [3.1, 31], [3.4, 34], [3.8, 38]];

const din1159 = DIN_1159.map(([d, l]): Part => {
  const dimension = measured('standard', 'kk-din-1159');
  const size = `${d} × ${l}`;
  return {
    id: `din-1159-${String(d).replace('.', '-')}x${l}`, family: 'nail', title: `Staple ${size}`, designation: `DIN 1159 ${size}`, aliases: [],
    description: `A U-shaped steel wire staple (DIN 1159 “Krampe”) of ${d} mm wire with ${l} mm pointed legs, driven over a wire into timber; usually hot-dip galvanised.`,
    standard: 'din-1159', product: null, attributes: { kind: 'staple', standard: 'DIN 1159', size },
    dimensions: { d: dimension(d), l: dimension(l) },
    sources: ['din-1159', 'kk-din-1159'],
    notes: 'The size is designated by wire diameter and length only. No source read gives the width across the legs, so the library does not list one; the preview draws it for illustration only.',
    preview: { kind: 'procedural' },
  };
});

// TODO(parts): round wire nails (EN 10230-1), once a published table of the standard is found.
export const nailParts: Part[] = [...din1159];
