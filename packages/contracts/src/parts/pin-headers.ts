import type { Part, PartFamily } from './schema.ts';
import { measured } from './sources.ts';

export const pinHeaderFamily: PartFamily = {
  id: 'pin-header', title: 'Pin headers',
  description: 'Through-hole connector strips, with separate insulating-body, contact, mating-post and solder-tail dimensions. One part is one strip, not a pair.',
  attributes: [{ key: 'positions', label: 'Positions' }, { key: 'rows', label: 'Rows' }, { key: 'pitch', label: 'Pitch' }, { key: 'orientation', label: 'Orientation' }, { key: 'manufacturer', label: 'Manufacturer' }],
  dimensions: [
    { key: 'e', label: 'Contact pitch', symbol: 'e', required: true },
    { key: 'W', label: 'Insulator width', symbol: 'W', required: true },
    { key: 'L', label: 'Insulator length', symbol: 'L', required: true },
    { key: 'h', label: 'Insulator height', symbol: 'h', required: true },
    { key: 'd', label: 'Square contact width', symbol: 'd', required: true },
    { key: 'post', label: 'Mating post beyond insulator', symbol: 'C', required: true },
    { key: 'tail', label: 'Solder tail beyond insulator', symbol: 'B', required: true },
    { key: 'H', label: 'Overall contact length', symbol: 'A', required: true },
  ],
};
const wurth = measured('manufacturer', 'wurth-61300811121');
export const pinHeaderParts: Part[] = [{
  id: 'wurth-61300811121', family: 'pin-header', title: 'Würth 1 × 8 straight pin header, 2.54 mm', designation: 'WR-PHD 61300811121',
  aliases: ['1x8 male header', '2.54 mm eight-pin header'],
  description: 'A single row of eight 0.64 mm square contacts on 2.54 mm centres, with a 2.54 mm insulator, 6 mm mating posts and 3 mm solder tails. Two strips align with the ESP32-C3 SuperMini’s two eight-pin rows.',
  standard: null, product: { manufacturer: 'Würth Elektronik', sku: '61300811121', url: 'https://www.we-online.com/components/products/datasheet/61300811121.pdf' },
  attributes: { positions: '8', rows: '1', pitch: '2.54 mm', orientation: 'Straight', manufacturer: 'Würth Elektronik' },
  dimensions: { e: wurth(2.54, 2.49, 2.59), W: wurth(2.54, 2.39, 2.69), L: wurth(20.32, 19.97, 20.67), h: wurth(2.54), d: wurth(0.64, 0.49, 0.79), post: wurth(6, 5.8, 6.2), tail: wurth(3, 2.8, 3.2), H: wurth(11.54, 11.34, 11.74) },
  sources: ['wurth-61300811121'],
  notes: 'Nominal geometry follows drawing revision 003.000 (2023-01-08); insulator height is the nominal overall length minus the two contact projections, without an independently stated tolerance. The preview omits small moulding notches and contact-tip chamfers. Frame: row along Y, centred XY; solder-tail tips at z=0, insulator from z=3 to 5.54, mating tips at z=11.54. Installed below a PCB, rotate 180° about X. In the SuperMini case the plastic stays outside the floor, with only solder tails through the slots. Header dimensions and PCB thickness vary: measure the delivered parts and confirm solder access before assembly.',
  preview: { kind: 'procedural' },
}];
