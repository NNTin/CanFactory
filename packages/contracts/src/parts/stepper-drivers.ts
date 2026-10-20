import type { Part, PartFamily } from './schema.ts';
import { measured } from './sources.ts';

/**
 * Stepper motor driver boards that a print holds (the ULN2003 board sold with the 28BYJ-48). A case or carrier is designed round
 * the board's outline and mounting holes, the motor's connector with its plug in it, the pin headers and the tallest parts, so
 * each board has its layout (`stepperDriverLayout`) besides its dimensions. See docs/adding-parts.md, “Stepper motors and driver
 * boards”.
 */
export const stepperDriverFamily: PartFamily = {
  id: 'stepper-driver', title: 'Stepper motor drivers',
  description: 'Stepper motor driver boards (ULN2003), with the board outline, the mounting holes, the motor’s connector, the pin headers, the LEDs and the tallest parts.',
  attributes: [{ key: 'driver', label: 'Driver' }, { key: 'motorConnector', label: 'Motor connector' }, { key: 'supply', label: 'Supply' }, { key: 'manufacturer', label: 'Manufacturer' }],
  dimensions: [
    { key: 'L', label: 'Board length', symbol: 'L', required: true },
    { key: 'W', label: 'Board width', symbol: 'W', required: true },
    { key: 't', label: 'PCB thickness', symbol: 't', required: true },
    { key: 'd', label: 'Mounting hole diameter', symbol: 'd', required: true },
    { key: 'hx', label: 'Mounting hole spacing across the board (along W), centre to centre', symbol: 'hx', required: true },
    { key: 'hy', label: 'Mounting hole spacing along the board (along L), centre to centre', symbol: 'hy', required: true },
    { key: 'c', label: 'Mounting hole centre from the board’s edges', symbol: 'c', required: true },
    { key: 'e', label: 'Pin header pitch', symbol: 'e', required: true },
    { key: 'em', label: 'Motor connector pitch', symbol: 'em', required: true },
    { key: 'H', label: 'Overall height, PCB underside to the top of the tallest part', symbol: 'H', required: true },
    { key: 'Hm', label: 'Overall height with the motor’s plug in its connector', symbol: 'Hm', required: true },
  ],
};

/** A point in the board's plane. */
export interface StepperDriverPoint { x: number; y: number }
/** A pin: its name, the header it belongs to and its centre. */
export interface StepperDriverPin extends StepperDriverPoint { name: string; header: 'motor' | 'input' | 'power' }
/**
 * A part on top of the board: a box (`width` along X, `length` along Y) or a cylinder (`round`, diameter `width`), centred at
 * (`x`, `y`), from `base` above the PCB (zero when omitted) up by `height`.
 */
export interface StepperDriverComponent {
  name: string; kind: 'chip' | 'socket' | 'led' | 'resistor' | 'connector' | 'header';
  shape: 'box' | 'round'; x: number; y: number; width: number; length: number; height: number; base?: number;
}
/**
 * Where everything on a driver board is. Frame: millimetres, Z up; the PCB's underside on z = 0 with its corner at the origin;
 * the board's width (`W`) along X and its length (`L`) along Y, seen from the component side. Heights are from the PCB's top
 * face (z = `t`).
 */
export interface StepperDriverLayout {
  holes: StepperDriverPoint[];
  /** The pins of the headers and of the motor's connector; a header pin stands `pinHeight` above the PCB. */
  pins: StepperDriverPin[];
  pinHeight: number;
  components: StepperDriverComponent[];
  /** The motor's plug in its connector, as a box: a case leaves room for it and for its lead, which leaves its top. */
  plug: StepperDriverComponent;
}

const model = measured('estimated', 'printables-1404255');
const jst = measured('manufacturer', 'jst-xh');
const round = (value: number) => Math.round(value * 1000) / 1000;

/** A row of `count` pins at the pin header pitch, centred at (`x`, `y`), along X or along Y. */
const row = (header: StepperDriverPin['header'], names: string[], x: number, y: number, along: 'x' | 'y', pitch: number): StepperDriverPin[] =>
  names.map((name, i) => {
    const offset = round((i - (names.length - 1) / 2) * pitch);
    return { name, header, x: along === 'x' ? round(x + offset) : x, y: along === 'y' ? round(y + offset) : y };
  });

const PITCH = 2.54;
const MOTOR_PITCH = 2.5;

// Karaneko's STEP model (Printables 1404255), moved into the layout's frame: its PCB runs x −9.8…21.6, y −24.9…10.4 with its top at
// z −54.2, so x + 9.8, y + 24.9 and z + 54.2 here.
const LAYOUT: StepperDriverLayout = {
  holes: [{ x: 2.5, y: 2.5 }, { x: 28.9, y: 2.5 }, { x: 2.5, y: 32.8 }, { x: 28.9, y: 32.8 }],
  pins: [
    // the motor's connector: five pins 2.5 mm apart in its housing, M1 at its −X end
    ...row('motor', ['M1', 'M2', 'M3', 'M4', 'M5'], 9.8, 23.32, 'x', MOTOR_PITCH),
    // the inputs (IN1–IN4) along the +X edge and the supply pins with the motor's on/off jumper along the −Y edge; the model gives
    // neither the order of the pins nor which two carry the jumper
    ...row('input', ['IN-a', 'IN-b', 'IN-c', 'IN-d'], 26.25, 13.35, 'y', PITCH),
    ...row('power', ['P-a', 'P-b', 'P-c', 'P-d'], 9.85, 6.65, 'x', PITCH),
  ],
  pinHeight: 8,
  components: [
    { name: 'ULN2003 (DIP-16)', kind: 'chip', shape: 'box', x: 11, y: 13.8, width: 19, length: 6.1, height: 3.2, base: 5.5 },
    { name: 'DIP-16 socket', kind: 'socket', shape: 'box', x: 11, y: 13.8, width: 20, length: 10, height: 5.2 },
    { name: 'Motor connector (5-pin XH header)', kind: 'connector', shape: 'box', x: 9.8, y: 22.65, width: 14.6, length: 5.3, height: 7.2 },
    { name: 'Input header (4 pins)', kind: 'header', shape: 'box', x: 26.25, y: 13.35, width: 2.3, length: 10.1, height: 2.5 },
    { name: 'Supply and jumper header (4 pins)', kind: 'header', shape: 'box', x: 9.85, y: 6.65, width: 10.1, length: 2.3, height: 2.5 },
    ...[6, 10.333, 14.667, 19].flatMap((x, i): StepperDriverComponent[] => [
      { name: `LED ${i + 1} collar`, kind: 'led', shape: 'round', x, y: 30.3, width: 3.8, length: 3.8, height: 1 },
      { name: `LED ${i + 1} (Ø3 mm)`, kind: 'led', shape: 'round', x, y: 30.3, width: 3, length: 3, height: 4, base: 1 },
    ]),
    ...[27.05, 24.383, 21.717, 19.05].map((y, i): StepperDriverComponent =>
      ({ name: `LED resistor ${i + 1}`, kind: 'resistor', shape: 'box', x: 25.4, y, width: 6.8, length: 1.6, height: 1.8 })),
  ],
  plug: { name: 'The motor’s plug (JST XHP-5) in its connector', kind: 'connector', shape: 'box', x: 9.8, y: 22.6, width: 14.6, length: 5.6, height: 8, base: 2 },
};

/** The top of a part above the PCB. */
export const stepperDriverComponentTop = (component: StepperDriverComponent) => (component.base ?? 0) + component.height;

const t = 1.6;
const tallest = Math.max(LAYOUT.pinHeight, ...LAYOUT.components.map(stepperDriverComponentTop));

export const stepperDriverParts: Part[] = [
  {
    id: 'uln2003-stepper-driver-board', family: 'stepper-driver', title: 'ULN2003 stepper motor driver board', designation: 'ULN2003 stepper motor driver board (5-pin XH connector, 4 LEDs)',
    aliases: ['ULN2003 Stepper Motor Driver Test Module', 'ULN2003A driver board', '28BYJ-48 driver board'],
    description: 'The 35.3 × 31.4 mm green ULN2003 board sold with the 28BYJ-48: a ULN2003 (DIP-16) in a socket, a 5-pin XH connector that the motor plugs into, four LEDs, four input pins, the supply pins with an on/off jumper, and an Ø3 mm mounting hole in each corner.',
    standard: null, product: { manufacturer: 'Generic (sold unbranded by many shops)', sku: 'ULN2003 stepper motor driver board', url: 'https://www.printables.com/model/1404255-uln2003-5v-stepper-motor' },
    attributes: { driver: 'ULN2003 (DIP-16)', motorConnector: 'XH, 5 pins (2.5 mm pitch)', supply: '5–12 V', manufacturer: 'Generic' },
    dimensions: {
      L: model(35.3), W: model(31.4), t: model(t), d: model(3), hx: model(26.4), hy: model(30.3), c: model(2.5), e: model(PITCH), em: jst(MOTOR_PITCH),
      H: model(round(t + tallest)), Hm: model(round(t + stepperDriverComponentTop(LAYOUT.plug))),
    },
    sources: ['printables-1404255', 'jst-xh'],
    notes: 'No maker publishes a drawing of this board: every value is read off Karaneko’s STEP model (Printables 1404255, public domain), the board with its parts and the motor’s plug in place; the motor connector’s 2.5 mm pitch is JST’s (XH series). The model spaces the header pins 2.47 mm apart: they are drawn at the 2.54 mm pitch of a pin header, centred where the model has them. The tallest part is the ULN2003 in its socket (8.7 mm above the PCB); the motor’s plug stands 10 mm above it, its lead leaving upwards. The model gives the order of neither the inputs (IN1–IN4) nor the supply and jumper pins, and draws no jumper (a jumper on its pins stands about as high as the chip), no leads under the PCB (through-hole leads stand out below it, so stand the board off its floor) and no silkscreen. Sellers’ copies of this board differ: a GrabCAD remix moves the holes by about 1 mm for a later revision of the PCB, and Printables 770445 draws the board 36 × 31 mm. Measure your board before a tight fit, and correct the value under the same id.',
    preview: { kind: 'procedural' },
  },
];

/** The layout of a stepper driver board of the library (see `StepperDriverLayout`), or undefined for any other part. */
export function stepperDriverLayout(part: Part): StepperDriverLayout | undefined {
  return part.id === 'uln2003-stepper-driver-board' ? LAYOUT : undefined;
}
