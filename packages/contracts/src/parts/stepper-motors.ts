import type { Part, PartFamily } from './schema.ts';
import { measured } from './sources.ts';

/**
 * Geared stepper motors that a print holds or drives (the 28BYJ-48). A bracket is designed around the body, the two mounting ears,
 * the shaft (offset from the body's axis, with two flats) and the blue wire housing on the side. See docs/adding-parts.md,
 * “Stepper motors and driver boards”.
 *
 * Frame of the preview: millimetres, Z up; the body's back on z = 0 and its mounting face (the ears) at z = `L`, the body's axis
 * on x = y = 0, the ears along X, the shaft at y = +`e` and the wire housing towards −Y.
 */
export const stepperMotorFamily: PartFamily = {
  id: 'stepper-motor', title: 'Stepper motors',
  description: 'Small geared stepper motors by product (28BYJ-48), with the body, the mounting ears, the offset shaft with its flats, the wire housing and the plug of the lead, as their makers draw them.',
  attributes: [{ key: 'voltage', label: 'Voltage' }, { key: 'gearRatio', label: 'Gear ratio' }, { key: 'stepAngle', label: 'Step angle' }, { key: 'resistance', label: 'Coil resistance' }, { key: 'connector', label: 'Connector' }, { key: 'manufacturer', label: 'Manufacturer' }],
  dimensions: [
    { key: 'D', label: 'Body diameter', symbol: 'D', required: true },
    { key: 'L', label: 'Body length, from the back to the mounting face', symbol: 'L', required: true },
    { key: 'a', label: 'Mounting hole spacing, centre to centre', symbol: 'a', required: true },
    { key: 'dh', label: 'Mounting hole diameter', symbol: 'dh', required: true },
    { key: 'r', label: 'Radius of the ears’ ends, round the holes', symbol: 'R', required: true },
    { key: 'W', label: 'Width over the ears', symbol: 'W', required: true },
    { key: 't', label: 'Thickness of the ears', symbol: 't', required: true },
    { key: 'e', label: 'Shaft offset from the body’s axis', symbol: 'e', required: true },
    { key: 'd', label: 'Shaft diameter', symbol: 'd', required: true },
    { key: 'l', label: 'Shaft length past the mounting face (with the boss)', symbol: 'l', required: true },
    { key: 's', label: 'Width across the shaft’s two flats', symbol: 's', required: true },
    { key: 'lf', label: 'Length of the flats, from the shaft’s tip', symbol: 'lf', required: true },
    { key: 'db', label: 'Diameter of the boss round the shaft', symbol: 'db', required: true },
    { key: 'hb', label: 'Height of the boss above the mounting face', symbol: 'hb', required: true },
    { key: 'bw', label: 'Wire housing width', symbol: 'bw', required: true },
    { key: 'bh', label: 'Wire housing, from the body’s axis to its outer face', symbol: 'bh', required: true },
    { key: 'bl', label: 'Wire housing length, from the mounting face', symbol: 'bl', required: true },
    { key: 'lead', label: 'Lead length, from the motor to the end of the plug', symbol: 'ℓ', required: false },
    { key: 'pw', label: 'Plug width', symbol: 'B', required: false },
    { key: 'pt', label: 'Plug thickness', symbol: 'T', required: false },
    { key: 'ph', label: 'Plug height, along the lead', symbol: 'H', required: false },
  ],
};

const kiatronics = measured('manufacturer', 'kiatronics-28byj-48');
const model = measured('estimated', 'printables-121424');
const jst = measured('manufacturer', 'jst-xh');

export const stepperMotorParts: Part[] = [
  {
    id: 'kiatronics-28byj-48-5v', family: 'stepper-motor', title: '28BYJ-48 geared stepper motor, 5 V', designation: '28BYJ-48 – 5V', aliases: ['28BYJ-48', '28BYJ48', 'OSEPP STEPD-01'],
    description: 'A Ø28 × 19 mm 5 V unipolar geared stepper motor (1:64): two ears with Ø4.2 mm holes 35 mm apart, a Ø5 mm shaft with two flats 3 mm apart, 8 mm off the body’s axis, and a blue wire housing with a 5-wire lead to a JST XH plug.',
    standard: null, product: { manufacturer: 'Kiatronics', sku: '28BYJ-48 – 5V', url: 'https://www.mouser.com/datasheet/2/758/stepd-01-data-sheet-1143075.pdf' },
    attributes: { voltage: '5 V DC', gearRatio: '1:64', stepAngle: '5.625°/64', resistance: '50 Ω ± 7 %', connector: 'JST XHP-5 (2.5 mm pitch)', manufacturer: 'Kiatronics' },
    dimensions: {
      D: kiatronics(28), L: kiatronics(19), a: kiatronics(35, 34.8, 35.2), dh: kiatronics(4.2, 4.05, 4.35), r: kiatronics(3.5), W: model(42), t: model(0.5),
      e: kiatronics(8), d: kiatronics(5, 4.9, 5), l: kiatronics(10, 9.5, 10.5), s: kiatronics(3, 2.9, 3), lf: kiatronics(6, 5.8, 6.2), db: kiatronics(9), hb: kiatronics(1.5),
      bw: kiatronics(14.6, 14.6, 14.8), bh: kiatronics(17), bl: model(18), lead: kiatronics(250, 240, 260),
      pw: jst(14.8), pt: jst(5.7), ph: jst(7.5),
    },
    sources: ['kiatronics-28byj-48', 'printables-121424', 'jst-xh', 'fulling-28byj48-12-300-01'],
    notes: 'Kiatronics’s drawing gives the body (Ø28 × 19), the ears (2 × Ø4.2 ± 0.15 holes 35 ± 0.2 apart, R3.5 ends, 7 wide), the shaft (Ø5 −0.1, 10 ± 0.5 past the mounting face, flats 3 −0.1 apart over the last 6 ± 0.2, 8 off the axis), the Ø9 × 1.5 boss, the wire housing (14.6 +0.2 wide, 17 from the axis) and the lead (230 ± 10 to the plug, 250 ± 10 to its end; AWG26, a JST XHP-5 housing with SXH-001T-P0.6 contacts); the plug’s size is JST’s catalogue (XHP-5: 14.8 × 5.7, 7.5 high, 2.5 mm pitch). Not on the drawing, so measured off Philip McGaw’s fit-check model (Printables 121424, made to that drawing): the ears’ thickness (0.5 mm), the width over the ears (42 mm) and the wire housing’s length (18 mm from the mounting face). The model also orients the flats parallel to the line through the two holes. Where the model differs from the drawing, the drawing is used: the model’s body is 20 mm long, its housing 15 mm wide and its holes Ø4.3 mm. Wires (Kiatronics’s numbering): 1 blue, 2 pink, 3 yellow, 4 orange (the coils), 5 red (the common, to +5 V). The gear ratio is nominal: the gear train is about 1:63.68, so a turn of the shaft takes about 2038 full steps, not 2048. Changzhou Fulling’s 12 V version (28BYJ48-12-300-01, 300 Ω) has the same shaft and body, holes 35 ± 0.1 apart, a 14.5 mm housing 17.5 mm from the axis and a 300 mm lead. Many shops sell copies of this motor; measure yours before a tight fit, and design pockets to the largest sizes.',
    preview: { kind: 'procedural' },
  },
];
