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
    { key: 'ww', label: 'Width over the wire housing’s side ledges', symbol: 'ww', required: false },
    { key: 'wh', label: 'Side ledges’ outer face, from the body’s axis', symbol: 'wh', required: false },
    { key: 'wb', label: 'Where the ledges’ chamfer meets the housing’s side, from the body’s axis', symbol: 'wb', required: false },
    { key: 'wf', label: 'Side ledges’ front end, from the mounting face', symbol: 'wf', required: false },
    { key: 'sw', label: 'Wire slot width, in the housing’s outer face', symbol: 'sw', required: false },
    { key: 'sl', label: 'Wire slot length, along the axis', symbol: 'sl', required: false },
    { key: 'sd', label: 'Wire slot depth', symbol: 'sd', required: false },
    { key: 'sf', label: 'Wire slot, from the mounting face to its near edge', symbol: 'sf', required: false },
    { key: 'lt', label: 'Thickness of the housing’s lip over the body’s back rim', symbol: 'lt', required: false },
    { key: 'll', label: 'Length of that lip, past the housing’s back end', symbol: 'll', required: false },
    { key: 'lg', label: 'Gap in the middle of that lip', symbol: 'lg', required: false },
    { key: 'rb', label: 'Radius of the body’s back edge', symbol: 'rb', required: false },
    { key: 'lead', label: 'Lead length, from the motor to the end of the plug', symbol: 'ℓ', required: false },
    { key: 'pw', label: 'Plug width', symbol: 'B', required: false },
    { key: 'pt', label: 'Plug thickness', symbol: 'T', required: false },
    { key: 'ph', label: 'Plug height, along the lead', symbol: 'H', required: false },
  ],
};

const kiatronics = measured('manufacturer', 'kiatronics-28byj-48');
const model = measured('estimated', 'printables-343236');
const jst = measured('manufacturer', 'jst-xh');

export const stepperMotorParts: Part[] = [
  {
    id: 'kiatronics-28byj-48-5v', family: 'stepper-motor', title: '28BYJ-48 geared stepper motor, 5 V', designation: '28BYJ-48 – 5V', aliases: ['28BYJ-48', '28BYJ48', 'OSEPP STEPD-01'],
    description: 'A Ø28 × 19 mm 5 V unipolar geared stepper motor (1:64): two ears with Ø4.2 mm holes 35 mm apart, a Ø5 mm shaft with two flats 3 mm apart, 8 mm off the body’s axis, and a blue wire housing (with side ledges, a wire slot and a lip over the back rim) whose 5-wire lead ends in a JST XH plug.',
    standard: null, product: { manufacturer: 'Kiatronics', sku: '28BYJ-48 – 5V', url: 'https://www.mouser.com/datasheet/2/758/stepd-01-data-sheet-1143075.pdf' },
    attributes: { voltage: '5 V DC', gearRatio: '1:64', stepAngle: '5.625°/64', resistance: '50 Ω ± 7 %', connector: 'JST XHP-5 (2.5 mm pitch)', manufacturer: 'Kiatronics' },
    dimensions: {
      D: kiatronics(28), L: kiatronics(19), a: kiatronics(35, 34.8, 35.2), dh: kiatronics(4.2, 4.05, 4.35), r: kiatronics(3.5), W: kiatronics(42), t: model(0.9),
      e: kiatronics(8), d: kiatronics(5, 4.9, 5), l: kiatronics(10, 9.5, 10.5), s: kiatronics(3, 2.9, 3), lf: kiatronics(6, 5.8, 6.2), db: kiatronics(9), hb: kiatronics(1.5),
      bw: kiatronics(14.6, 14.6, 14.8), bh: kiatronics(17), bl: model(16.5), lead: kiatronics(250, 240, 260),
      ww: model(17.4), wh: model(12.7), wb: model(13.7), wf: model(3.8), sw: model(6.8), sl: model(1.2), sd: model(1), sf: model(2.3),
      lt: model(0.6), ll: model(0.9), lg: model(3), rb: model(1.65),
      pw: jst(14.8), pt: jst(5.7), ph: jst(7.5),
    },
    sources: ['kiatronics-28byj-48', 'printables-343236', 'printables-121424', 'jst-xh', 'fulling-28byj48-12-300-01'],
    notes: 'Kiatronics’s drawing gives the body (Ø28 × 19), the ears (2 × Ø4.2 ± 0.15 holes 35 ± 0.2 apart, R3.5 ends, 7 wide), the shaft (Ø5 −0.1, 10 ± 0.5 past the mounting face, flats 3 −0.1 apart over the last 6 ± 0.2, 8 off the axis), the Ø9 × 1.5 boss, the wire housing (14.6 +0.2 wide, 17 from the axis) and the lead (230 ± 10 to the plug, 250 ± 10 to its end; AWG26, a JST XHP-5 housing with SXH-001T-P0.6 contacts); the plug’s size is JST’s catalogue (XHP-5: 14.8 × 5.7, 7.5 high, 2.5 mm pitch). The width over the ears is the drawing’s 35 + 2 × R3.5. Not on the drawing, so measured off Joe’s detailed model (Printables 343236; its numbers, not its file, are used): the ears’ thickness (0.9 mm) and the blue wire housing. The housing is 16.5 mm long from the mounting face, ending 2.8 mm short of the back (Fulling’s drawing: 2.7). Side ledges 17.4 mm over them run down the body to 12.7 mm from the axis and chamfer into the housing’s side at 13.7 mm, stopping 3.8 mm short of the mounting face. The wires leave through a 6.8 × 1.2 mm slot, 1 mm deep, in the housing’s outer face, 2.3 mm behind the mounting face, where Kiatronics draws the lead. A lip 0.6 mm thick reaches 0.9 mm past the housing’s back end over the body’s rim, with a 3 mm gap in its middle. The body’s back edge is rounded (R1.65). The model also orients the flats parallel to the line through the two holes, as Philip McGaw’s model (Printables 121424) does. Where the models differ from the drawing, the drawing is used: model 343236’s body is 19.3 mm long, its housing 14.5 mm wide and its boss 1.7 mm high; 121424’s body is 20 mm long. Wires (Kiatronics’s numbering): 1 blue, 2 pink, 3 yellow, 4 orange (the coils), 5 red (the common, to +5 V). The gear ratio is nominal: the gear train is about 1:63.68, so a turn of the shaft takes about 2038 full steps, not 2048. Changzhou Fulling’s 12 V version (28BYJ48-12-300-01, 300 Ω) has the same shaft and body, holes 35 ± 0.1 apart, a 14.5 mm housing 17.5 mm from the axis and a 300 mm lead. Many shops sell copies of this motor; measure yours before a tight fit, and design pockets to the largest sizes.',
    preview: { kind: 'procedural' },
  },
];
