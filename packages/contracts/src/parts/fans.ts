import type { Part, PartFamily } from './schema.ts';
import { measured } from './sources.ts';

export const fanFamily: PartFamily = {
  id: 'fan', title: 'Fans',
  description: 'Compact 5 V axial cooling fans. Frame, thickness and mounting dimensions size the enclosure; airflow and noise are free-air manufacturer ratings, not enclosure performance.',
  attributes: [{ key: 'voltage', label: 'Rated voltage' }, { key: 'control', label: 'Control' }, { key: 'manufacturer', label: 'Manufacturer' }, { key: 'mounting', label: 'Mounting pattern' }],
  dimensions: [
    { key: 'W', label: 'Frame width', symbol: 'W', required: true },
    { key: 'L', label: 'Frame length', symbol: 'L', required: true },
    { key: 'H', label: 'Installed thickness', symbol: 'H', required: true },
    { key: 'pitch', label: 'Mounting hole pitch', symbol: 'p', required: true },
    { key: 'hole', label: 'Mounting hole diameter', symbol: 'd', required: true },
  ],
};
const sunon = measured('manufacturer', 'sunon-dc-fan-catalogue');
const noctua = measured('manufacturer', 'noctua-nf-a4x10-5v-pwm');
const estimated = measured('estimated', 'noctua-nf-a4x10-5v-pwm');
export const fanParts: Part[] = [
  {
    id: 'sunon-mf30100v2-1000u-a99', family: 'fan', title: 'Sunon 30 mm 5 V fan', designation: 'MF30100V2-1000U-A99', aliases: [],
    description: 'A compact 30 × 30 × 10 mm, two-wire 5 V axial fan. Rated 0.08 A / 0.4 W, 4.7 CFM and 21 dB(A) in free air.',
    standard: null, product: { manufacturer: 'SUNON', sku: 'MF30100V2-1000U-A99', url: 'https://www.sunon.com/eu/MANAGE/Docs/WEBCONT/Files/1236/DC_20240630%28255-E%29_web.pdf' },
    attributes: { voltage: '5 V', control: '2-wire', manufacturer: 'SUNON', mounting: '3-corner' },
    dimensions: { W: sunon(30, 29.5, 30.5), L: sunon(30, 29.5, 30.5), H: sunon(10, 10, 10.5), pitch: sunon(24, 23.7, 24.3), hole: sunon(3.2, 2.9, 3.5) },
    sources: ['sunon-dc-fan-catalogue'], notes: 'Lead and connector shapes are omitted from the simplified preview. Three mounting holes; orient the missing corner and leads towards −X/−Y. Leave a cable route clear of the rotor. Check the delivered frame and hole pattern before printing.', preview: { kind: 'procedural' },
  },
  {
    id: 'noctua-nf-a4x10-5v-pwm', family: 'fan', title: 'Noctua 40 mm 5 V PWM fan', designation: 'NF-A4x10 5V PWM', aliases: [],
    description: 'A quiet 40 mm, four-wire 5 V PWM axial fan: maximum 0.07 A / 0.35 W, 5.24 CFM and 19.6 dB(A). Includes a USB power adaptor.',
    standard: null, product: { manufacturer: 'Noctua', sku: 'NF-A4x10 5V PWM', url: 'https://www.noctua.at/en/products/nf-a4x10-5v-pwm/specifications' },
    attributes: { voltage: '5 V', control: '4-wire PWM', manufacturer: 'Noctua', mounting: '4-corner' },
    dimensions: { W: noctua(40), L: noctua(40), H: noctua(12), pitch: noctua(32), hole: estimated(4.3) },
    sources: ['noctua-nf-a4x10-5v-pwm'],
    notes: 'Use the installed 12 mm thickness with anti-vibration pads (11 mm bare), not the marketing “10 mm” form factor. The 4.3 mm mounting-hole diameter is an estimate, not a published tolerance; verify your fan. Simplified frame/rotor preview omits pads and leads. Never connect this 5 V fan to 12 V or a GPIO.', preview: { kind: 'procedural' },
  },
];

/** Centred XY, fan standing on z=0, exhaust towards +Z. The three-hole fan is oriented with its lead corner at −X/−Y. */
export function fanMounts(part: Part): [number, number][] {
  const pitch = part.dimensions['pitch']?.value;
  if (part.family !== 'fan' || !pitch) throw new Error(`${part.id} is not an axial fan.`);
  return [-1, 1].flatMap(x => [-1, 1].flatMap(y => part.attributes['mounting'] === '3-corner' && x === -1 && y === -1 ? [] : [[x * pitch / 2, y * pitch / 2] as [number, number]]));
}
