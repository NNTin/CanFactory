import { Type, type Static } from 'typebox';
import type { Assembly } from './models.ts';
import { devBoardLayout, dimensionOf, findPart } from './parts/index.ts';

export const Esp32CaseParametersSchema = Type.Object({
  flushHeaders: Type.Boolean({ title: 'Flush pin headers', description: 'Widen the base openings so the header insulators pass through the floor and seat against the PCB. Disable for the original narrow slots and external spacers.', default: true }),
  ledHoles: Type.Boolean({ title: 'LED openings', description: 'Two 2 mm holes above the red power and blue GPIO8 LEDs. Disable to retain the original closed lid.', default: true }),
}, { additionalProperties: false });
export type Esp32CaseParameters = Static<typeof Esp32CaseParametersSchema>;
export const DEFAULT_ESP32_CASE: Esp32CaseParameters = { ledHoles: true, flushHeaders: true };
export const ESP32_CASE_BOARD = 'nologo-esp32-c3-supermini';
export const ESP32_CASE_HEADER = 'wurth-61300811121';
const board = findPart(ESP32_CASE_BOARD) ?? (() => { throw new Error('Missing ESP32-C3 board.'); })();
const header = findPart(ESP32_CASE_HEADER) ?? (() => { throw new Error('Missing pin header.'); })();
const layout = devBoardLayout(board) ?? (() => { throw new Error('Missing ESP32-C3 board layout.'); })();
const dim = (key: string) => dimensionOf(header, key);
/** Source frame: long dimension +X, USB towards -X; PCB underside at z=0. */
export const ESP32_CASE = {
  pcbX: 22.6, pcbZ: 0, baseCentre: [11.4, 9] as const, lidCentre: [11.6, 9] as const,
  floorBottom: -1.7, lidRoof: 5.86, externalHeaderBodyTop: -1.8, ledDiameter: 2,
};
// The two rows share their source X centre. Derive the cutouts from the PCB pins,
// using the manufacturer's maximum insulator envelope plus 0.2 mm per side.
const columns = [...new Set(layout.pins.map(pin => pin.x))].sort((a, b) => a - b);
export const ESP32_CASE_HEADER_OPENINGS = columns.map(x => {
  const pins = layout.pins.filter(pin => pin.x === x);
  const centreY = pins.reduce((total, pin) => total + pin.y, 0) / pins.length;
  return { x: ESP32_CASE.pcbX - centreY - ESP32_CASE.baseCentre[0], y: x - ESP32_CASE.baseCentre[1] };
});
export const ESP32_CASE_HEADER_DEFINES = {
  HEADER_X: ESP32_CASE_HEADER_OPENINGS[0]?.x ?? 0,
  HEADER_Y: Math.abs(ESP32_CASE_HEADER_OPENINGS[0]?.y ?? 0),
  HEADER_LENGTH: dimensionOf(header, 'L', 'max') + 0.4,
  HEADER_WIDTH: dimensionOf(header, 'W', 'max') + 0.4,
};
/** Raise the assembly until the installed mating-pin tips touch the viewer floor. */
export function esp32CaseGround(parameters: Esp32CaseParameters): number {
  const bodyTop = parameters.flushHeaders ? ESP32_CASE.pcbZ : ESP32_CASE.externalHeaderBodyTop;
  return dim('h') + dim('post') - bodyTop;
}
/** LED axes in the roof-down lid's own SCAD frame, derived from the same board layout the viewer draws. */
export const ESP32_CASE_LEDS = layout.components.filter(component => component.kind === 'led').map(component => ({
  name: component.name,
  board: [component.x, component.y] as const,
  print: [ESP32_CASE.pcbX - component.y - ESP32_CASE.lidCentre[0], ESP32_CASE.lidCentre[1] - component.x] as [number, number],
}));
if (ESP32_CASE_LEDS.length !== 2) throw new Error('Expected the SuperMini power and GPIO8 LEDs.');
export const ESP32_CASE_LED_DEFINES = Object.fromEntries(ESP32_CASE_LEDS.flatMap((led, index) => [
  [`LED_${index === 0 ? 'RED' : 'BLUE'}_X`, led.print[0]], [`LED_${index === 0 ? 'RED' : 'BLUE'}_Y`, led.print[1]],
]));

export function esp32CaseAssembly(parameters: Esp32CaseParameters = DEFAULT_ESP32_CASE): Assembly {
  const ground = esp32CaseGround(parameters);
  const bodyTop = parameters.flushHeaders ? ESP32_CASE.pcbZ : ESP32_CASE.externalHeaderBodyTop;
  const frame = (x: number, y: number, z: number): [number, number, number] => [x - 11.4, y - 9, z + ground];
  const headerPoses = Object.fromEntries(columns.map((x, index) => {
    const pins = layout.pins.filter(pin => pin.x === x);
    const centreY = pins.reduce((total, pin) => total + pin.y, 0) / pins.length;
    // Local row Y becomes source -X; short tails point up through the PCB.
    return [`header-${index + 1}`, { position: frame(ESP32_CASE.pcbX - centreY, x, bodyTop + dim('tail')), rotation: [180, 0, 90] }];
  }));
  return {
    partColors: { bottom: '#497c85', top: '#e5d9bb' },
    poses: {
      bottom: { position: [0, 0, ground + ESP32_CASE.floorBottom] },
      top: { position: [0.2, 0, ground + ESP32_CASE.lidRoof], rotation: [180, 0, 0] },
      board: { position: frame(ESP32_CASE.pcbX, 0, ESP32_CASE.pcbZ), rotation: [0, 0, 90] },
      ...headerPoses,
    },
    references: [
      { id: 'board', part: board.id, title: board.title },
      ...columns.map((_, index) => ({ id: `header-${index + 1}`, part: header.id, title: `${header.title} (row ${index + 1})` })),
    ],
    steps: [
      { title: 'With the board seated, insert both headers from below and solder', parts: ['header-1', 'header-2'], from: [0, 0, -14] },
      { title: 'Slide the lid into the rails from the antenna end', parts: ['top'], from: [30, 0, 0] },
    ],
    lift: 20,
  };
}
