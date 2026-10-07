import type { Dimension, Part, PartFamily } from './schema.ts';
import { measured } from './sources.ts';

export const magnetFamily: PartFamily = {
  id: 'magnet', title: 'Magnets',
  description: 'Neodymium (NdFeB) magnets by product: discs, blocks, rings and countersunk pot magnets, with the maker’s tolerance, grade and pull force.',
  attributes: [{ key: 'shape', label: 'Shape' }, { key: 'grade', label: 'Grade' }, { key: 'coating', label: 'Coating' }, { key: 'manufacturer', label: 'Manufacturer' }],
  dimensions: [
    { key: 'diameter', label: 'Diameter', symbol: 'D', required: false },
    { key: 'innerDiameter', label: 'Hole diameter', symbol: 'd', required: false },
    { key: 'countersinkDiameter', label: 'Countersink diameter', symbol: 'd2', required: false },
    { key: 'length', label: 'Length', symbol: 'L', required: false },
    { key: 'width', label: 'Width', symbol: 'W', required: false },
    { key: 'thickness', label: 'Height (along the magnetisation)', symbol: 'H', required: true },
  ],
};

type Shape = 'disc' | 'block' | 'ring' | 'countersunk-pot';
interface Magnet {
  sku: string; shape: Shape; url: string; grade: string; pullForce: string; maxTemperature: number; weight: number;
  size: Partial<Record<'diameter' | 'innerDiameter' | 'countersinkDiameter' | 'length' | 'width' | 'thickness', number>>;
  extra?: string;
}

const SUPERMAGNETE = 'https://www.supermagnete.de/eng/';
// Every supermagnete article below states a tolerance of ±0.1 mm, axial magnetisation (through the height) and a nickel
// (Ni-Cu-Ni) coating; the grade, pull force, working temperature and weight are each article's own. The 1 mm discs (S-xx-01-N),
// for thin parts such as the cat collar tag, were read on 2026-10-07.
const MAGNETS: Magnet[] = [
  { sku: 'S-04-02-N', shape: 'disc', url: `${SUPERMAGNETE}disc-magnets-neodymium/disc-magnet-4mm-2mm_S-04-02-N`, grade: 'N45', pullForce: 'approx. 420 g (4.12 N)', maxTemperature: 80, weight: 0.19, size: { diameter: 4, thickness: 2 } },
  { sku: 'S-05-01-N', shape: 'disc', url: `${SUPERMAGNETE}disc-magnets-neodymium/disc-magnet-5mm-1mm_S-05-01-N`, grade: 'N45', pullForce: 'approx. 320 g (3.14 N)', maxTemperature: 80, weight: 0.15, size: { diameter: 5, thickness: 1 } },
  { sku: 'S-05-02-N52N', shape: 'disc', url: `${SUPERMAGNETE}disc-magnets-neodymium/disc-magnet-5mm-2mm_S-05-02-N`, grade: 'N52', pullForce: 'approx. 680 g (6.67 N)', maxTemperature: 65, weight: 0.3, size: { diameter: 5, thickness: 2 } },
  { sku: 'S-06-01-N', shape: 'disc', url: `${SUPERMAGNETE}disc-magnets-neodymium/disc-magnet-6mm-1mm_S-06-01-N`, grade: 'N45', pullForce: 'approx. 400 g (3.92 N)', maxTemperature: 80, weight: 0.21, size: { diameter: 6, thickness: 1 } },
  { sku: 'S-06-02-N', shape: 'disc', url: `${SUPERMAGNETE}disc-magnets-neodymium/disc-magnet-6mm-2mm_S-06-02-N`, grade: 'N45', pullForce: 'approx. 740 g (7.26 N)', maxTemperature: 80, weight: 0.43, size: { diameter: 6, thickness: 2 } },
  { sku: 'S-06-03-N', shape: 'disc', url: `${SUPERMAGNETE}disc-magnets-neodymium/disc-magnet-6mm-3mm_S-06-03-N`, grade: 'N45', pullForce: 'approx. 990 g (9.71 N)', maxTemperature: 80, weight: 0.64, size: { diameter: 6, thickness: 3 } },
  { sku: 'S-08-01-N', shape: 'disc', url: `${SUPERMAGNETE}disc-magnets-neodymium/disc-magnet-8mm-1mm_S-08-01-N`, grade: 'N45', pullForce: 'approx. 540 g (5.3 N)', maxTemperature: 80, weight: 0.38, size: { diameter: 8, thickness: 1 } },
  { sku: 'S-08-02-N', shape: 'disc', url: `${SUPERMAGNETE}disc-magnets-neodymium/disc-magnet-8mm-2mm_S-08-02-N`, grade: 'N45', pullForce: 'approx. 1.1 kg (10.8 N)', maxTemperature: 80, weight: 0.76, size: { diameter: 8, thickness: 2 } },
  { sku: 'S-08-03-N', shape: 'disc', url: `${SUPERMAGNETE}disc-magnets-neodymium/disc-magnet-8mm-3mm_S-08-03-N`, grade: 'N45', pullForce: 'approx. 1.5 kg (14.7 N)', maxTemperature: 80, weight: 1.1, size: { diameter: 8, thickness: 3 } },
  { sku: 'S-10-01-N', shape: 'disc', url: `${SUPERMAGNETE}disc-magnets-neodymium/disc-magnet-10mm-1mm_S-10-01-N`, grade: 'N35', pullForce: 'approx. 540 g (5.3 N)', maxTemperature: 80, weight: 0.6, size: { diameter: 10, thickness: 1 } },
  { sku: 'S-10-02-N', shape: 'disc', url: `${SUPERMAGNETE}disc-magnets-neodymium/disc-magnet-10mm-2mm_S-10-02-N`, grade: 'N42', pullForce: 'approx. 1.3 kg (12.7 N)', maxTemperature: 80, weight: 1.2, size: { diameter: 10, thickness: 2 } },
  { sku: 'S-10-03-N', shape: 'disc', url: `${SUPERMAGNETE}disc-magnets-neodymium/disc-magnet-10mm-3mm_S-10-03-N`, grade: 'N42', pullForce: 'approx. 1.8 kg (17.7 N)', maxTemperature: 80, weight: 1.8, size: { diameter: 10, thickness: 3 } },
  { sku: 'S-12-02-N', shape: 'disc', url: `${SUPERMAGNETE}disc-magnets-neodymium/disc-magnet-12mm-2mm_S-12-02-N`, grade: 'N45', pullForce: 'approx. 1.7 kg (16.7 N)', maxTemperature: 80, weight: 1.7, size: { diameter: 12, thickness: 2 } },
  { sku: 'Q-05-05-02-N', shape: 'block', url: `${SUPERMAGNETE}block-magnets-neodymium/block-magnet-5mm-5mm-2mm_Q-05-05-02-N`, grade: 'N45', pullForce: 'approx. 650 g (6.37 N)', maxTemperature: 80, weight: 0.38, size: { length: 5, width: 5, thickness: 2 } },
  { sku: 'Q-10-05-02-N', shape: 'block', url: `${SUPERMAGNETE}block-magnets-neodymium/block-magnet-10mm-5mm-2mm_Q-10-05-02-N`, grade: 'N50', pullForce: 'approx. 1.2 kg (11.8 N)', maxTemperature: 80, weight: 0.76, size: { length: 10, width: 5, thickness: 2 } },
  { sku: 'Q-10-10-02-N', shape: 'block', url: `${SUPERMAGNETE}block-magnets-neodymium/block-magnet-10mm-10mm-2mm_Q-10-10-02-N`, grade: 'N45', pullForce: 'approx. 1 kg (9.81 N)', maxTemperature: 80, weight: 1.5, size: { length: 10, width: 10, thickness: 2 } },
  { sku: 'R-10-04-05-N', shape: 'ring', url: `${SUPERMAGNETE}ring-magnets-neodymium/ring-magnet-10mm-4mm-5mm_R-10-04-05-N`, grade: 'N42', pullForce: 'approx. 2.5 kg (24.5 N)', maxTemperature: 80, weight: 2.5, size: { diameter: 10, innerDiameter: 4, thickness: 5 } },
  { sku: 'CSN-10', shape: 'countersunk-pot', url: `${SUPERMAGNETE}pot-magnets-with-countersunk-hole/countersunk-pot-magnet-10mm_CSN-10`, grade: 'N38', pullForce: 'approx. 1.3 kg (12.7 N)', maxTemperature: 80, weight: 2, size: { diameter: 10, innerDiameter: 3, countersinkDiameter: 4.8, thickness: 4.5 },
    extra: 'The magnet sits in a steel pot, so it holds only on its open face. supermagnete names ISO 7046-2 M2.5 countersunk screws to fasten it.' },
];

const SHAPE_TEXT: Record<Shape, string> = { disc: 'Disc magnet', block: 'Block magnet', ring: 'Ring magnet', 'countersunk-pot': 'Countersunk pot magnet' };

function size(magnet: Magnet): string {
  const { diameter, innerDiameter, length, width, thickness } = magnet.size;
  if (magnet.shape === 'block') return `${length} × ${width} × ${thickness} mm`;
  if (magnet.shape === 'ring') return `Ø ${diameter} / ${innerDiameter} × ${thickness} mm`;
  return `Ø ${diameter} × ${thickness} mm`;
}

export const magnetParts: Part[] = MAGNETS.map((magnet): Part => {
  const dimension = measured('manufacturer', 'supermagnete');
  const dimensions: Record<string, Dimension> = Object.fromEntries(Object.entries(magnet.size).map(([key, value]) =>
    // Only the outer sizes carry the stated ±0.1 mm; the countersink's figures are nominal.
    [key, ['innerDiameter', 'countersinkDiameter'].includes(key) ? dimension(value) : dimension(value, Number((value - 0.1).toFixed(2)), Number((value + 0.1).toFixed(2)))]));
  return {
    id: `supermagnete-${magnet.sku.toLowerCase()}`, family: 'magnet', title: `${SHAPE_TEXT[magnet.shape]} ${size(magnet)}, ${magnet.grade}`,
    designation: `supermagnete ${magnet.sku}`, aliases: [],
    description: `A nickel-plated ${magnet.grade} neodymium ${SHAPE_TEXT[magnet.shape].toLowerCase()}, ${size(magnet)} (±0.1 mm), magnetised through its height; pull force ${magnet.pullForce}, up to ${magnet.maxTemperature} °C, ${magnet.weight} g (supermagnete ${magnet.sku}).${magnet.extra ? ` ${magnet.extra}` : ''}`,
    standard: null, product: { manufacturer: 'supermagnete', sku: magnet.sku, url: magnet.url },
    attributes: { shape: magnet.shape, grade: magnet.grade, coating: 'nickel (Ni-Cu-Ni)', manufacturer: 'supermagnete', pullForce: magnet.pullForce, maxTemperature: `${magnet.maxTemperature} °C` },
    dimensions, sources: ['supermagnete'], notes: 'Tolerance, grade, pull force, working temperature and weight as stated on the article’s own page (see its link). Size a pocket from the greatest size, plus play.',
    preview: { kind: 'procedural' },
  };
});
