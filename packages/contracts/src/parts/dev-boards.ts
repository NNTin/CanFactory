import type { Dimension, Part, PartFamily } from './schema.ts';
import { measured } from './sources.ts';

/**
 * Development boards: small microcontroller boards (ESP32-C3) that a print holds, such as a smart lamp's controller. A case or
 * carrier is designed around the board's outline, its pins, the USB-C receptacle at one end and the components on top, so each
 * board has its layout (`devBoardLayout`) besides its dimensions. See docs/adding-parts.md, “Development boards”.
 */
export const devBoardFamily: PartFamily = {
  id: 'dev-board', title: 'Development boards',
  description: 'Microcontroller boards by product (ESP32-C3), with the board outline, the pin holes, the USB-C receptacle and the components on top, as their makers draw them.',
  attributes: [{ key: 'chip', label: 'Chip' }, { key: 'pins', label: 'Pins' }, { key: 'edge', label: 'Pin edge' }, { key: 'usb', label: 'USB' }, { key: 'manufacturer', label: 'Manufacturer' }],
  dimensions: [
    { key: 'L', label: 'Board length, along the pin rows (without the USB-C overhang)', symbol: 'L', required: true },
    { key: 'W', label: 'Board width, across the pin rows', symbol: 'W', required: true },
    { key: 't', label: 'PCB thickness', symbol: 't', required: true },
    { key: 'r', label: 'Corner radius of the board', symbol: 'r', required: false },
    { key: 'e', label: 'Pin pitch', symbol: 'e', required: true },
    { key: 'e1', label: 'Pin row spacing, centre to centre', symbol: 'e1', required: true },
    { key: 'a', label: 'First pin from the board’s USB end, to its centre', symbol: 'a', required: true },
    { key: 'd', label: 'Pin hole diameter', symbol: 'd', required: true },
    { key: 'usbW', label: 'USB-C receptacle width', symbol: 'b', required: true },
    { key: 'usbH', label: 'USB-C receptacle height above the PCB', symbol: 'h', required: true },
    { key: 'usbOverhang', label: 'USB-C receptacle past the board’s end', symbol: 'c', required: true },
    { key: 'H', label: 'Overall height, PCB underside to the top of the tallest component', symbol: 'H', required: true },
  ],
};

/** A pin: its name and the centre of its hole. */
export interface DevBoardPin { name: string; x: number; y: number }
/**
 * A component on top of the board, as a box: its centre (`x`, `y`), its size along X (`width`) and Y (`length`) before it is
 * turned by `rotation` degrees about Z, and its `height` above the PCB. `sized` says where the size comes from: the part's own
 * data sheet (`manufacturer`) or the drawing and the package's usual size (`estimated`); every position is read off the drawing.
 */
export interface DevBoardComponent { name: string; x: number; y: number; width: number; length: number; height: number; rotation: number; sized: Dimension['basis'] }
/** A rectangle in the board's plane, from `x0, y0` to `x1, y1`. */
export interface DevBoardArea { x0: number; y0: number; x1: number; y1: number }
/**
 * Where everything on a board is. Frame: millimetres, Z up; the PCB's underside on z = 0 with its corner at the origin; the
 * board's width (`W`) along X and its length (`L`) along Y, the USB-C receptacle at the +Y end and the antenna at y = 0, seen
 * from the component side. Heights above the PCB are from its top face (z = `t`).
 */
export interface DevBoardLayout {
  pins: DevBoardPin[];
  /** Whether each pin also has a half hole (castellation) at the board's edge, at the same y, for soldering the board flat. */
  castellated: boolean;
  /** The USB-C receptacle's box: its plan (`y1` lies past the board's end by `usbOverhang`) and its height above the PCB. */
  usb: DevBoardArea & { height: number };
  components: DevBoardComponent[];
  /** Where the chip antenna radiates: keep metal, PCBs and thick walls away from here. */
  antennaKeepout: DevBoardArea;
  /** Whether the underside is bare (no components): a board can then lie flat on a printed floor. */
  bareUnderside: boolean;
  /** The colour of the solder mask, for previews. */
  solderMask: 'black' | 'blue';
}

interface Board {
  id: string; manufacturer: string; sku: string; url: string; title: string; designation: string; aliases: string[]; chip: string;
  source: string; sources: string[]; description: string; notes: string;
  /** Which dimensions the maker publishes (the others are estimated). */
  published: (keyof Board['dimensions'])[];
  dimensions: { L: number; W: number; t: number; r?: number; e: number; e1: number; a: number; d: number; usbW: number; usbH: number; usbOverhang: number };
  /** Pin names, from the USB end down: the column at x = (W − e1) / 2, then the one at x = (W + e1) / 2. */
  columns: [string[], string[]];
  edge: string;
  layout: Omit<DevBoardLayout, 'pins' | 'usb'> & { usb: { x0: number; y0: number } };
}

/** The usual height of a top-mount USB-C receptacle (16-pin, 3.16–3.26 mm); neither maker gives it. */
const USB_C_HEIGHT = 3.2;
const ESTIMATE = 'canfactory-dev-board-estimate';

const BOARDS: Board[] = [
  {
    id: 'nologo-esp32-c3-supermini', manufacturer: 'Nologo', sku: 'ESP32C3 SuperMini', url: 'https://wiki.nologo.tech/product/esp32/esp32c3/esp32c3supermini/esp32C3SuperMini.html',
    title: 'ESP32-C3 SuperMini', designation: 'ESP32-C3 SuperMini (Nologo ESP32C3SuperMini)', aliases: ['ESP32C3 SuperMini', 'ESP32-C3 Super Mini'], chip: 'ESP32-C3FN4',
    source: 'nologo-esp32c3-supermini', sources: ['nologo-esp32c3-supermini', ESTIMATE],
    description: 'A 22.52 × 18 mm ESP32-C3FN4 board with two rows of 8 pins 15.24 mm apart, castellated as well as drilled, a USB-C receptacle that overhangs one end, BOOT and RST buttons, a blue LED on GPIO8 and a chip antenna at the other end; components on top only.',
    notes: 'Board size, row spacing, pinout and the single-sided assembly are Nologo’s; everything else (the pitch and first pin, the holes, the receptacle and every component) is read off Nologo’s to-scale top-view render (39.4 px/mm) or is the usual size of its package, and the PCB thickness is assumed: measure a board before a tight fit. Many shops sell copies of this board (TENSTAR and others) whose components may sit slightly differently; the “Plus” version has a WS2812 LED and an antenna connector and is a different board. Small 0402 resistors and capacitors (under 0.5 mm high) are left out of the layout.',
    published: ['L', 'W', 'e1'],
    dimensions: { L: 22.52, W: 18, t: 1, e: 2.54, e1: 15.24, a: 1.57, d: 1, usbW: 9.25, usbH: USB_C_HEIGHT, usbOverhang: 1.93 },
    columns: [['GPIO5', 'GPIO6', 'GPIO7', 'GPIO8', 'GPIO9', 'GPIO10', 'GPIO20', 'GPIO21'], ['5V', 'GND', '3V3', 'GPIO4', 'GPIO3', 'GPIO2', 'GPIO1', 'GPIO0']],
    edge: 'castellated, drilled',
    layout: {
      castellated: true, bareUnderside: true, solderMask: 'black',
      usb: { x0: 4.14, y0: 16.71 },
      components: [
        { name: 'ESP32-C3FN4 (QFN32 5 × 5 mm)', x: 9.71, y: 7.89, width: 5, length: 5, height: 0.9, rotation: 45, sized: 'estimated' },
        { name: 'BOOT button', x: 6.19, y: 13.76, width: 4.1, length: 3.1, height: 2, rotation: 0, sized: 'estimated' },
        { name: 'RST button', x: 11.69, y: 13.76, width: 4.1, length: 3.1, height: 2, rotation: 0, sized: 'estimated' },
        { name: '3.3 V regulator (SOT23-5)', x: 3.73, y: 9.69, width: 2.9, length: 1.6, height: 1.3, rotation: 0, sized: 'estimated' },
        { name: 'Crystal (3.2 × 2.5 mm class)', x: 4.55, y: 4.97, width: 3.2, length: 2.1, height: 0.8, rotation: 0, sized: 'estimated' },
        { name: 'Diode (SOD-323)', x: 2.92, y: 20.73, width: 1.27, length: 1.7, height: 1, rotation: 0, sized: 'estimated' },
        { name: 'Red power LED', x: 2.99, y: 17.31, width: 0.6, length: 1, height: 0.5, rotation: 0, sized: 'estimated' },
        { name: 'Blue LED (GPIO8)', x: 13.56, y: 11.44, width: 1, length: 0.5, height: 0.5, rotation: 0, sized: 'estimated' },
        { name: 'Small SMD part (unmarked)', x: 13.86, y: 4.75, width: 0.85, length: 1.7, height: 0.7, rotation: 0, sized: 'estimated' },
        { name: 'Chip antenna', x: 8.98, y: 1.29, width: 7, length: 2.1, height: 1, rotation: 0, sized: 'estimated' },
      ],
      antennaKeepout: { x0: 4.45, y0: 0, x1: 13.51, y1: 3.3 },
    },
  },
  {
    id: 'waveshare-esp32-c3-zero', manufacturer: 'Waveshare', sku: 'ESP32-C3-Zero', url: 'https://www.waveshare.com/esp32-c3-zero.htm',
    title: 'Waveshare ESP32-C3-Zero', designation: 'Waveshare ESP32-C3-Zero', aliases: ['ESP32-C3-Zero-M (with pin headers)'], chip: 'ESP32-C3FH4',
    source: 'waveshare-esp32-c3-zero', sources: ['waveshare-esp32-c3-zero', 'waveshare-esp32-c3-zero-product', 'xinglight-xl-0807rgbc-ws2812b', ESTIMATE],
    description: 'A 23.5 × 18 mm ESP32-C3FH4 board with rounded corners and two rows of 9 castellated, drilled pins 15.24 mm apart, a USB-C receptacle that overhangs one end, BOOT and RESET buttons, a WS2812 RGB LED on GPIO10 and a ceramic antenna at the other end.',
    notes: 'Outline, corner radius, pitch, first pin, row inset (1.38 mm from each edge) and pinout are Waveshare’s drawing and pinout; the RGB LED is its data sheet’s 2.0 × 1.8 × 0.8 mm. The receptacle (Waveshare dimensions it 4.67 mm from one edge; its photograph shows a standard 8.94 mm wide receptacle, centred), the other components’ places and the PCB thickness are read off Waveshare’s to-scale photograph (14.6 px/mm) or assumed: measure a board before a tight fit. The ESP32-C3-Zero-M is the same board with pin headers soldered on. Waveshare: keep PCBs, metal and plastic off the ceramic antenna. Small 0402 resistors and capacitors (under 0.5 mm high) are left out of the layout.',
    published: ['L', 'W', 'r', 'e', 'e1', 'a'],
    dimensions: { L: 23.5, W: 18, t: 1, r: 1, e: 2.54, e1: 15.24, a: 1.59, d: 1, usbW: 8.94, usbH: USB_C_HEIGHT, usbOverhang: 1.58 },
    columns: [['5V', 'GND', '3V3', 'GPIO0', 'GPIO1', 'GPIO2', 'GPIO3', 'GPIO4', 'GPIO5'], ['GPIO21', 'GPIO20', 'GPIO19', 'GPIO18', 'GPIO10', 'GPIO9', 'GPIO8', 'GPIO7', 'GPIO6']],
    edge: 'castellated, drilled',
    layout: {
      castellated: true, bareUnderside: true, solderMask: 'blue',
      usb: { x0: 4.53, y0: 17.73 },
      components: [
        { name: 'ESP32-C3FH4 (QFN32 5 × 5 mm)', x: 8.4, y: 10.52, width: 5, length: 5, height: 0.9, rotation: 0, sized: 'estimated' },
        { name: 'BOOT button', x: 3.85, y: 12.51, width: 3.6, length: 4.1, height: 2, rotation: 0, sized: 'estimated' },
        { name: 'RESET button', x: 14.29, y: 12.51, width: 3.6, length: 4.1, height: 2, rotation: 0, sized: 'estimated' },
        { name: 'WS2812 RGB LED (XL-0807RGBC, GPIO10)', x: 8.76, y: 14.78, width: 2, length: 1.8, height: 0.8, rotation: 0, sized: 'manufacturer' },
        { name: '3.3 V regulator (SOT23-5)', x: 13.74, y: 7.39, width: 2.9, length: 1.6, height: 1.3, rotation: 0, sized: 'estimated' },
        { name: 'Crystal (2.5 × 2.0 mm class)', x: 3.5, y: 8.49, width: 2.5, length: 2, height: 0.6, rotation: 0, sized: 'estimated' },
        { name: 'Ceramic antenna', x: 8.93, y: 1.14, width: 6.6, length: 1.7, height: 1, rotation: 0, sized: 'estimated' },
      ],
      antennaKeepout: { x0: 2.4, y0: 0, x1: 15.6, y1: 3.85 },
    },
  },
];

const round = (value: number) => Math.round(value * 100) / 100;

function layoutOf(board: Board): DevBoardLayout {
  const { L, W, e, e1, a, usbW, usbH, usbOverhang } = board.dimensions;
  const pins = board.columns.flatMap((names, column) => names.map((name, i) => ({ name, x: round((W + (column === 0 ? -e1 : e1)) / 2), y: round(L - a - i * e) })));
  const { usb, ...rest } = board.layout;
  return { ...rest, pins, usb: { x0: usb.x0, y0: usb.y0, x1: round(usb.x0 + usbW), y1: round(L + usbOverhang), height: usbH } };
}

/** The tallest thing on the board above the PCB: the receptacle or a component. */
const tallest = (layout: DevBoardLayout) => Math.max(layout.usb.height, ...layout.components.map(component => component.height));

export const devBoardParts: Part[] = BOARDS.map((board): Part => {
  const confirmed = measured('manufacturer', board.source); const estimated = measured('estimated', ESTIMATE);
  const dimension = (key: keyof Board['dimensions'], value: number) => board.published.includes(key) ? confirmed(value) : estimated(value);
  const dimensions = Object.fromEntries(Object.entries(board.dimensions).map(([key, value]) => [key, dimension(key as keyof Board['dimensions'], value)]));
  const layout = layoutOf(board);
  return {
    id: board.id, family: 'dev-board', title: board.title, designation: board.designation, aliases: board.aliases, description: board.description,
    standard: null, product: { manufacturer: board.manufacturer, sku: board.sku, url: board.url },
    attributes: { chip: board.chip, pins: `${layout.pins.length}`, edge: board.edge, usb: 'USB-C', manufacturer: board.manufacturer },
    dimensions: { ...dimensions, H: estimated(round(board.dimensions.t + tallest(layout))) },
    sources: board.sources, notes: board.notes, preview: { kind: 'procedural' },
  };
});

/** The layout of a development board of the library (see `DevBoardLayout`), or undefined for any other part. */
export function devBoardLayout(part: Part): DevBoardLayout | undefined {
  const board = BOARDS.find(candidate => candidate.id === part.id);
  return board ? layoutOf(board) : undefined;
}
