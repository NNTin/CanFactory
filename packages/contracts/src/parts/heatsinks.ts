import type { Part, PartFamily } from './schema.ts';
import { measured } from './sources.ts';

export const heatsinkFamily: PartFamily = {
  id: 'heatsink', title: 'Heatsinks',
  description: 'Small adhesive aluminium heatsinks. Footprint and height size the enclosure; fin shapes are illustrative and thermal performance depends on the complete assembly.',
  attributes: [{ key: 'material', label: 'Material' }, { key: 'attachment', label: 'Attachment' }, { key: 'manufacturer', label: 'Manufacturer' }],
  dimensions: [
    { key: 'W', label: 'Width', symbol: 'W', required: true },
    { key: 'L', label: 'Length', symbol: 'L', required: true },
    { key: 'H', label: 'Height excluding adhesive', symbol: 'H', required: true },
  ],
};
const seeed = measured('manufacturer', 'seeed-xiao-heatsink');
const estimate = measured('estimated', 'canfactory-heatsink-estimate');
const sky = measured('manufacturer', 'same-sky-hsb02-101007');
export const heatsinkParts: Part[] = [
  {
    id: 'seeed-xiao-aluminium-heatsink', family: 'heatsink', title: 'Seeed XIAO 10 mm heatsink', designation: 'XIAO aluminium heatsink (one piece of SKU 114010001)', aliases: ['114010001'],
    description: 'XIAO ESP32S3 (Sense)-specific, adhesive aluminium heatsink, sold as a two-piece pack. The housing uses one on the backside thermal pad, not above the camera.',
    standard: null, product: { manufacturer: 'Seeed Studio', sku: '114010001', url: 'https://www.seeedstudio.com/Aluminum-Heat-Sink-For-XIAO-2pcs-p-5972.html' },
    attributes: { material: 'Aluminium', attachment: 'Thermal adhesive included', manufacturer: 'Seeed Studio' },
    dimensions: { W: seeed(10), L: seeed(10), H: estimate(10) },
    sources: ['seeed-xiao-heatsink', 'seeed-xiao-heatsink-installation', 'canfactory-heatsink-estimate'],
    notes: 'Only the 10 × 10 mm footprint is published. Height is a 10 mm modelling estimate, NOT a manufacturer dimension or tolerance. Measure your sink and adhesive; increase the housing’s extra heatsink allowance if necessary. One library instance means one sink, not the two-piece retail pack. Use the backside thermal pad, leaving BAT pads and locating holes free. Fin/base details are illustrative. No enclosure temperature guarantee.', preview: { kind: 'procedural' },
  },
  {
    id: 'same-sky-hsb02-101007', family: 'heatsink', title: 'Same Sky 10 × 10 × 7 mm heatsink', designation: 'HSB02-101007', aliases: ['CUI HSB02-101007'],
    description: 'A compact black-anodized AL 6063-T5 BGA heatsink. A dimensional alternative for the XIAO backside thermal pad, not a Seeed-approved accessory; thermal adhesive must be supplied separately.',
    standard: null, product: { manufacturer: 'Same Sky', sku: 'HSB02-101007', url: 'https://www.sameskydevices.com/product/resource/hsb02-101007.pdf' },
    attributes: { material: 'Aluminium AL 6063-T5', attachment: 'Separate thermal adhesive required', manufacturer: 'Same Sky' },
    dimensions: { W: sky(10, 9.62, 10.38), L: sky(10, 9.62, 10.38), H: sky(7, 6.62, 7.38) },
    sources: ['same-sky-hsb02-101007', 'seeed-xiao-heatsink-installation'],
    notes: 'Dimensions and ±0.38 mm general tolerance are from drawing revision 1.03, 2025-12-12. The housing/preview uses tolerance maxima. Fit, electrical isolation and cooling on XIAO are not manufacturer-validated; check the delivered part and board before bonding. Fin details are illustrative. Adhesive thickness is additional. Do not use electrically conductive adhesive across exposed pads.', preview: { kind: 'procedural' },
  },
];
