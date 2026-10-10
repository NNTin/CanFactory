import type { Dimension, Part, PartFamily } from './schema.ts';
import { measured } from './sources.ts';

/**
 * Development boards: small microcontroller boards (ESP32-C3, ESP32-C6) that a print holds, such as a smart lamp's controller. A
 * case or carrier is designed around the board's outline, its pins, the USB-C receptacle at one end, the components on top and the
 * way to an external antenna, so each board has its layout (`devBoardLayout`) besides its dimensions. See docs/adding-parts.md,
 * “Development boards”.
 */
export const devBoardFamily: PartFamily = {
  id: 'dev-board', title: 'Development boards',
  description: 'Microcontroller boards by product (ESP32-C3, ESP32-C6), with the board outline, the pin holes, the USB-C receptacle, the components on top and the external antenna access, as their makers draw them.',
  attributes: [{ key: 'chip', label: 'Chip' }, { key: 'pins', label: 'Pins' }, { key: 'edge', label: 'Pin edge' }, { key: 'usb', label: 'USB' }, { key: 'externalAntenna', label: 'External antenna' }, { key: 'manufacturer', label: 'Manufacturer' }],
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

/** A pin: its name and the centre of its hole (or of its pad, for a pad on the underside). */
export interface DevBoardPin { name: string; x: number; y: number }
/** A point in the board's plane. */
export interface DevBoardPoint { x: number; y: number }
/**
 * What stands on a component's body, centred on it: a button's plunger or an LED's lens. `shape` is its plan (`round`: a disc of
 * diameter `width`; `oval`: a stadium of `width` × `length`; `rectangle`), and `height` is its top above the PCB.
 */
export interface DevBoardComponentTop { shape: 'round' | 'oval' | 'rectangle'; width: number; length: number; height: number }
/**
 * A component on top of the board: its body as a box, centred at (`x`, `y`), its size along X (`width`) and Y (`length`) before
 * it is turned by `rotation` degrees about Z, and its `height` above the PCB; on a button or an LED, its plunger or lens (`top`).
 * A button's plunger moves down by `travel` when pressed: a printed actuator rests on the plunger's top and pushes it that far.
 * `sized` says where the size comes from (`source`: the part's own data sheet, `manufacturer`, or the drawing and the package's
 * usual size, `estimated`); every position is read off the board maker's drawing.
 */
export interface DevBoardComponent {
  name: string; kind: 'button' | 'led' | 'chip' | 'regulator' | 'crystal' | 'diode' | 'antenna' | 'connector' | 'shield' | 'other';
  x: number; y: number; width: number; length: number; height: number; rotation: number;
  top?: DevBoardComponentTop; travel?: number;
  sized: Dimension['basis']; source: string;
}
/** A rectangle in the board's plane, from `x0, y0` to `x1, y1`. */
export interface DevBoardArea { x0: number; y0: number; x1: number; y1: number }
/**
 * How an external antenna reaches the radio, which a case must leave room for (and a way out for its cable):
 * - `connector`: a coaxial receptacle on the board (its body is one of the `components`), centred at (`x`, `y`). A mated plug
 *   stands up to `matedHeight` above the PCB, and `select` says how the firmware switches to it.
 * - `solder points`: no connector; a coax cable is soldered on, its core to `signal` and its shield to `ground`, as `how` says.
 * `source` is where it is documented.
 */
export type DevBoardExternalAntenna =
  | { kind: 'connector'; name: string; x: number; y: number; matedHeight: number; select: string; source: string }
  | { kind: 'solder points'; signal: DevBoardPoint; ground: DevBoardPoint; how: string; source: string };
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
  /** How an external antenna connects, or null when the maker documents no way (the onboard antenna only). */
  externalAntenna: DevBoardExternalAntenna | null;
  /** Flat pads on the underside (more GPIO, JTAG, battery), for pogo pins or wires: a floor under them must leave them free to reach. */
  bottomPads: DevBoardPin[];
  /** Whether the underside is bare (no components): a board can then lie flat on a printed floor. */
  bareUnderside: boolean;
  /** The colour of the solder mask, for previews. */
  solderMask: 'black' | 'blue';
}

interface Board {
  id: string; manufacturer: string; sku: string; url: string; title: string; designation: string; aliases: string[];
  /** The chip family, which the library filters by (ESP32-C3); the exact chip (its flash variant, e.g. ESP32-C3FN4) is in the
   * description and the components. */
  chip: string;
  sources: string[]; description: string; notes: string;
  /** The dimensions a maker publishes, each with the source it is read from (the others are estimated); `H` when the maker gives
   * the overall height. */
  published: Partial<Record<keyof Board['dimensions'] | 'H', string>>;
  dimensions: { L: number; W: number; t: number; r?: number; e: number; e1: number; a: number; d: number; usbW: number; usbH: number; usbOverhang: number };
  /** Pin names, from the USB end down: the column at x = (W − e1) / 2, then the one at x = (W + e1) / 2. */
  columns: [string[], string[]];
  edge: string;
  layout: Omit<DevBoardLayout, 'pins' | 'usb'> & { usb: { x0: number; y0: number } };
}

/** The usual height of a top-mount USB-C receptacle (16-pin, 3.16–3.26 mm), for the boards whose makers do not give it. */
const USB_C_HEIGHT = 3.2;
const ESTIMATE = 'canfactory-dev-board-estimate';
const round = (value: number) => Math.round(value * 100) / 100;

const BOARDS: Board[] = [
  {
    id: 'nologo-esp32-c3-supermini', manufacturer: 'Nologo', sku: 'ESP32C3 SuperMini', url: 'https://wiki.nologo.tech/product/esp32/esp32c3/esp32c3supermini/esp32C3SuperMini.html',
    title: 'ESP32-C3 SuperMini', designation: 'ESP32-C3 SuperMini (Nologo ESP32C3SuperMini)', aliases: ['ESP32C3 SuperMini', 'ESP32-C3 Super Mini'], chip: 'ESP32-C3',
    sources: ['nologo-esp32c3-supermini', 'xunpu-ts-1088', ESTIMATE],
    description: 'A 22.52 × 18 mm ESP32-C3FN4 board with two rows of 8 pins 15.24 mm apart, castellated as well as drilled, a USB-C receptacle that overhangs one end, BOOT and RST buttons, a blue LED on GPIO8 and a chip antenna at the other end; components on top only.',
    notes: 'Board size, row spacing, pinout and the single-sided assembly are Nologo’s, and its schematic names the buttons (3 × 4 × 2 mm, two pins: drawn as XUNPU’s TS-1088 of that size, Ø1.8 mm plunger 2.0 mm high, 0.2 mm travel), the crystal (3225), the regulator (SOT23-5) and the diode (SOD-323); everything else (the pitch and first pin, the holes, the receptacle and every component) is read off Nologo’s to-scale top-view render (39.4 px/mm) or is the usual size of its package, and the PCB thickness is assumed: measure a board before a tight fit. Its schematic lists the two LEDs as 0603, but the render draws smaller ones (0402), which the layout follows. Many shops sell copies of this board (TENSTAR and others) whose components may sit slightly differently; the “Plus” version has a WS2812 LED and an antenna connector and is a different board. Small 0402 resistors and capacitors (under 0.5 mm high) are left out of the layout.',
    published: { L: 'nologo-esp32c3-supermini', W: 'nologo-esp32c3-supermini', e1: 'nologo-esp32c3-supermini' },
    dimensions: { L: 22.52, W: 18, t: 1, e: 2.54, e1: 15.24, a: 1.57, d: 1, usbW: 9.25, usbH: USB_C_HEIGHT, usbOverhang: 1.93 },
    columns: [['GPIO5', 'GPIO6', 'GPIO7', 'GPIO8', 'GPIO9', 'GPIO10', 'GPIO20', 'GPIO21'], ['5V', 'GND', '3V3', 'GPIO4', 'GPIO3', 'GPIO2', 'GPIO1', 'GPIO0']],
    edge: 'castellated, drilled',
    layout: {
      castellated: true, bareUnderside: true, solderMask: 'black',
      usb: { x0: 4.14, y0: 16.71 },
      components: [
        { name: 'ESP32-C3FN4 (QFN32 5 × 5 mm)', kind: 'chip', x: 9.71, y: 7.89, width: 5, length: 5, height: 0.9, rotation: 45, sized: 'estimated', source: ESTIMATE },
        // 3 × 4 × 2 mm two-pin tact switches (Nologo's schematic), drawn as XUNPU's TS-1088 of that size: the body 3.9 × 3.0 × 1.5 with
        // its terminals across X (5.0 over them), the round plunger Ø1.8 up to 2.0, 0.2 mm travel
        { name: 'BOOT button (GPIO9)', kind: 'button', x: 6.11, y: 13.77, width: 3.9, length: 3, height: 1.5, rotation: 0, top: { shape: 'round', width: 1.8, length: 1.8, height: 2 }, travel: 0.2, sized: 'estimated', source: 'xunpu-ts-1088' },
        { name: 'RST button (CHIP_EN)', kind: 'button', x: 11.66, y: 13.77, width: 3.9, length: 3, height: 1.5, rotation: 0, top: { shape: 'round', width: 1.8, length: 1.8, height: 2 }, travel: 0.2, sized: 'estimated', source: 'xunpu-ts-1088' },
        { name: '3.3 V regulator (ME6211, SOT23-5)', kind: 'regulator', x: 3.73, y: 9.69, width: 2.9, length: 1.6, height: 1.3, rotation: 0, sized: 'estimated', source: ESTIMATE },
        { name: 'Crystal (40 MHz, 3225)', kind: 'crystal', x: 4.55, y: 4.97, width: 3.2, length: 2.1, height: 0.8, rotation: 0, sized: 'estimated', source: ESTIMATE },
        { name: 'Diode (BAT60J, SOD-323)', kind: 'diode', x: 2.92, y: 20.73, width: 1.27, length: 1.7, height: 1, rotation: 0, sized: 'estimated', source: ESTIMATE },
        { name: 'Red power LED', kind: 'led', x: 2.99, y: 17.31, width: 0.6, length: 1, height: 0.5, rotation: 0, sized: 'estimated', source: ESTIMATE },
        { name: 'Blue LED (GPIO8)', kind: 'led', x: 13.56, y: 11.44, width: 1, length: 0.5, height: 0.5, rotation: 0, sized: 'estimated', source: ESTIMATE },
        { name: 'Small SMD part (unmarked)', kind: 'other', x: 13.86, y: 4.75, width: 0.85, length: 1.7, height: 0.7, rotation: 0, sized: 'estimated', source: ESTIMATE },
        { name: 'Chip antenna', kind: 'antenna', x: 8.98, y: 1.29, width: 7, length: 2.1, height: 1, rotation: 0, sized: 'estimated', source: ESTIMATE },
      ],
      antennaKeepout: { x0: 4.45, y0: 0, x1: 13.51, y1: 3.3 },
      // Nologo's “WIFI天线” picture: the coax core (线芯) on the chip antenna's feed pad, its shield (屏蔽层) on the ground pad of the
      // part beside it, read off that render
      externalAntenna: {
        kind: 'solder points', signal: { x: 12.22, y: 1.36 }, ground: { x: 12.25, y: 3.38 }, source: 'nologo-esp32c3-supermini',
        how: 'Solder a thin coax cable’s core to the chip antenna’s feed pad (its end towards GPIO0) and its shield to the ground pad of the part beside it, as Nologo’s picture shows; Nologo gives no more than the picture.',
      },
      bottomPads: [],
    },
  },
  {
    id: 'waveshare-esp32-c3-zero', manufacturer: 'Waveshare', sku: 'ESP32-C3-Zero', url: 'https://www.waveshare.com/esp32-c3-zero.htm',
    title: 'Waveshare ESP32-C3-Zero', designation: 'Waveshare ESP32-C3-Zero', aliases: ['ESP32-C3-Zero-M (with pin headers)'], chip: 'ESP32-C3',
    sources: ['waveshare-esp32-c3-zero', 'waveshare-esp32-c3-zero-product', 'xinglight-xl-0807rgbc-ws2812b', ESTIMATE],
    description: 'A 23.5 × 18 mm ESP32-C3FH4 board with rounded corners and two rows of 9 castellated, drilled pins 15.24 mm apart, a USB-C receptacle that overhangs one end, BOOT and RESET buttons, a WS2812 RGB LED on GPIO10 and a ceramic antenna at the other end.',
    notes: 'Outline, corner radius, pitch, first pin, row inset (1.38 mm from each edge) and pinout are Waveshare’s drawing and pinout; the RGB LED is its data sheet’s (a 2.0 × 1.8 mm base under a 1.34 mm lens, 0.8 mm high). No data sheet names the buttons: their white body (3.5 × 4.2 × 1.5 mm) and beige oval plunger (2.4 × 3.2 mm, its top 1.8 mm above the PCB) are read off Waveshare’s photographs, so measure them before printing an actuator that rests on them. The receptacle (Waveshare dimensions it 4.67 mm from one edge; its photograph shows a standard 8.94 mm wide receptacle, centred), the other components’ places and the PCB thickness are read off Waveshare’s to-scale photograph (14.6 px/mm) or assumed: measure a board before a tight fit. The ESP32-C3-Zero-M is the same board with pin headers soldered on. Waveshare: keep PCBs, metal and plastic off the ceramic antenna. Small 0402 resistors and capacitors (under 0.5 mm high) are left out of the layout.',
    published: Object.fromEntries((['L', 'W', 'r', 'e', 'e1', 'a'] as const).map(key => [key, 'waveshare-esp32-c3-zero'])),
    dimensions: { L: 23.5, W: 18, t: 1, r: 1, e: 2.54, e1: 15.24, a: 1.59, d: 1, usbW: 8.94, usbH: USB_C_HEIGHT, usbOverhang: 1.58 },
    columns: [['5V', 'GND', '3V3', 'GPIO0', 'GPIO1', 'GPIO2', 'GPIO3', 'GPIO4', 'GPIO5'], ['GPIO21', 'GPIO20', 'GPIO19', 'GPIO18', 'GPIO10', 'GPIO9', 'GPIO8', 'GPIO7', 'GPIO6']],
    edge: 'castellated, drilled',
    layout: {
      castellated: true, bareUnderside: true, solderMask: 'blue',
      usb: { x0: 4.53, y0: 17.73 },
      components: [
        { name: 'ESP32-C3FH4 (QFN32 5 × 5 mm)', kind: 'chip', x: 8.4, y: 10.52, width: 5, length: 5, height: 0.9, rotation: 0, sized: 'estimated', source: ESTIMATE },
        // white two-pin tact switches with their terminals along Y and a beige oval plunger, read off Waveshare's photographs (the
        // plunger stands about 0.3 mm proud of the body, which is about half as high as the USB-C receptacle); no data sheet names them
        { name: 'BOOT button (GPIO9)', kind: 'button', x: 3.81, y: 12.78, width: 3.5, length: 4.2, height: 1.5, rotation: 0, top: { shape: 'oval', width: 2.4, length: 3.2, height: 1.8 }, travel: 0.2, sized: 'estimated', source: ESTIMATE },
        { name: 'RESET button (CHIP_EN)', kind: 'button', x: 14.22, y: 12.78, width: 3.5, length: 4.2, height: 1.5, rotation: 0, top: { shape: 'oval', width: 2.4, length: 3.2, height: 1.8 }, travel: 0.2, sized: 'estimated', source: ESTIMATE },
        // its data sheet: a 2.0 × 1.8 mm base, 0.28 mm thick, under a clear lens 1.34 mm wide (1.29 at its top) across the full 1.8 mm,
        // 0.80 mm high overall; its pads (on the 2.0 mm sides) lie along Y on the board, the lens is centred
        { name: 'WS2812 RGB LED (XL-0807RGBC-WS2812B, GPIO10)', kind: 'led', x: 8.93, y: 14.2, width: 1.8, length: 2, height: 0.28, rotation: 0, top: { shape: 'rectangle', width: 1.8, length: 1.34, height: 0.8 }, sized: 'manufacturer', source: 'xinglight-xl-0807rgbc-ws2812b' },
        { name: '3.3 V regulator (SOT23-5)', kind: 'regulator', x: 13.74, y: 7.39, width: 2.9, length: 1.6, height: 1.3, rotation: 0, sized: 'estimated', source: ESTIMATE },
        { name: 'Crystal (2.5 × 2.0 mm class)', kind: 'crystal', x: 3.5, y: 8.49, width: 2.5, length: 2, height: 0.6, rotation: 0, sized: 'estimated', source: ESTIMATE },
        { name: 'Ceramic antenna', kind: 'antenna', x: 8.93, y: 1.14, width: 6.6, length: 1.7, height: 1, rotation: 0, sized: 'estimated', source: ESTIMATE },
      ],
      antennaKeepout: { x0: 2.4, y0: 0, x1: 15.6, y1: 3.85 },
      externalAntenna: null, bottomPads: [],
    },
  },
  {
    id: 'waveshare-esp32-c6-zero', manufacturer: 'Waveshare', sku: 'ESP32-C6-Zero', url: 'https://www.waveshare.com/esp32-c6-zero.htm',
    title: 'Waveshare ESP32-C6-Zero', designation: 'Waveshare ESP32-C6-Zero', aliases: ['ESP32-C6-Zero-M (with pin headers)'], chip: 'ESP32-C6',
    sources: ['waveshare-esp32-c6-zero', 'waveshare-esp32-c6-zero-product', 'xinglight-xl-0807rgbc-ws2812b', ESTIMATE],
    description: 'A 23.5 × 18 mm ESP32-C6FH4 board (Wi-Fi 6, Bluetooth LE, Zigbee and Thread) on a 1.6 mm PCB with rounded corners, two rows of 9 castellated, drilled pins and 7 more GPIO pads underneath, a USB-C receptacle that overhangs one end, RST and BOOT buttons either side of a WS2812 RGB LED on GPIO8, and a ceramic antenna at the other end.',
    notes: 'Outline, PCB thickness, pins, holes, the pads underneath, the receptacle and every component’s place and size are Waveshare’s own drawing, DXF and STEP model (4.85 mm overall); the RGB LED (WS2812B-0807 in the schematic) is its data sheet’s 2.0 × 1.8 mm base under a 1.34 mm lens, 0.8 mm high (Waveshare’s model draws a plain 1.5 × 1.8 × 1.0 mm block). Waveshare’s model leaves out the 3.3 V regulator (ME6217, SOT23-5), which is placed from its photographs, and the buttons’ travel, which is assumed. The receptacle is mid-mounted: its shell reaches 0.9 mm into a cut-out in the PCB. Waveshare documents no external antenna: the ceramic antenna (CA-C03) is fed through a 0 Ω resistor. The ESP32-C6-Zero-M is the same board with pin headers soldered on. Small 0201 and 0402 resistors and capacitors (under 0.6 mm high) are left out of the layout.',
    published: { ...Object.fromEntries((['L', 'W', 't', 'r', 'e', 'e1', 'a', 'd', 'usbW', 'usbH', 'usbOverhang', 'H'] as const).map(key => [key, 'waveshare-esp32-c6-zero'])) },
    dimensions: { L: 23.5, W: 18, t: 1.6, r: 1, e: 2.54, e1: 15.24, a: 1.59, d: 0.9, usbW: 9.58, usbH: 3.25, usbOverhang: 1.22 },
    columns: [['5V', 'GND', '3V3', 'GPIO0', 'GPIO1', 'GPIO2', 'GPIO3', 'GPIO4', 'GPIO5'], ['GPIO16', 'GPIO17', 'GPIO14', 'GPIO15', 'GPIO18', 'GPIO19', 'GPIO20', 'GPIO21', 'GPIO22']],
    edge: 'castellated, drilled',
    layout: {
      castellated: true, bareUnderside: true, solderMask: 'blue',
      usb: { x0: 4.21, y0: 17.19 },
      // Waveshare's STEP model, moved into the layout's frame
      components: [
        { name: 'ESP32-C6FH4 (QFN32 5 × 5 mm)', kind: 'chip', x: 8, y: 9.49, width: 5, length: 5, height: 1, rotation: 0, sized: 'manufacturer', source: 'waveshare-esp32-c6-zero' },
        { name: 'RST button (CHIP_EN)', kind: 'button', x: 5.01, y: 13.77, width: 4.12, length: 2.5, height: 1.4, rotation: 0, top: { shape: 'round', width: 1.5, length: 1.5, height: 1.75 }, travel: 0.2, sized: 'manufacturer', source: 'waveshare-esp32-c6-zero' },
        { name: 'BOOT button (GPIO9)', kind: 'button', x: 12.99, y: 13.77, width: 4.12, length: 2.5, height: 1.4, rotation: 0, top: { shape: 'round', width: 1.5, length: 1.5, height: 1.75 }, travel: 0.2, sized: 'manufacturer', source: 'waveshare-esp32-c6-zero' },
        { name: 'WS2812 RGB LED (WS2812B-0807, GPIO8)', kind: 'led', x: 9, y: 13.87, width: 2, length: 1.8, height: 0.28, rotation: 0, top: { shape: 'rectangle', width: 1.34, length: 1.8, height: 0.8 }, sized: 'manufacturer', source: 'xinglight-xl-0807rgbc-ws2812b' },
        { name: 'Diode (B5819WS, SOD-323)', kind: 'diode', x: 14.72, y: 10.13, width: 1.25, length: 2.7, height: 1.12, rotation: 0, sized: 'manufacturer', source: 'waveshare-esp32-c6-zero' },
        { name: '3.3 V regulator (ME6217, SOT23-5)', kind: 'regulator', x: 13.4, y: 6.35, width: 1.6, length: 2.9, height: 1.3, rotation: 0, sized: 'estimated', source: ESTIMATE },
        { name: 'Crystal (40 MHz)', kind: 'crystal', x: 3.74, y: 8.91, width: 1.6, length: 2, height: 1, rotation: 0, sized: 'manufacturer', source: 'waveshare-esp32-c6-zero' },
        { name: 'Ceramic antenna (CA-C03)', kind: 'antenna', x: 8.86, y: 1.2, width: 5.7, length: 2, height: 1, rotation: 0, sized: 'manufacturer', source: 'waveshare-esp32-c6-zero' },
      ],
      antennaKeepout: { x0: 2.4, y0: 0, x1: 15.6, y1: 3 },
      externalAntenna: null,
      // Ø1.15 mm pads in a row 3.63 mm from the edge, 8.79 mm from the USB end down at a 1.59 mm pitch
      bottomPads: ['GPIO13', 'GPIO12', 'GPIO23', 'GPIO9', 'GPIO8', 'GPIO7', 'GPIO6'].map((name, i) => ({ name, x: 14.37, y: round(23.5 - 8.79 - i * 1.59) })),
    },
  },
  {
    id: 'seeed-xiao-esp32c6', manufacturer: 'Seeed Studio', sku: '113991254', url: 'https://wiki.seeedstudio.com/xiao_esp32c6_getting_started/',
    title: 'Seeed Studio XIAO ESP32C6', designation: 'Seeed Studio XIAO ESP32C6', aliases: ['XIAO ESP32-C6'], chip: 'ESP32-C6',
    sources: ['seeed-xiao-esp32c6', 'seeed-xiao-esp32c6-kicad', 'gct-usb4105', 'alps-sktaaae010', 'hirose-u-fl', ESTIMATE],
    description: 'A 21 × 17.8 mm ESP32-C6FH4 board (Wi-Fi 6, Bluetooth LE, Zigbee and Thread) with two rows of 7 castellated, drilled pins, a USB-C receptacle that overhangs one end with tiny RESET and BOOT buttons beside it, a metal shield over the radio, and a ceramic antenna next to a U.FL connector for an external antenna.',
    notes: 'Outline, PCB thickness, pins and every component’s place come from Seeed’s own KiCad design (v1.0); the USB-C receptacle (GCT USB4105), the buttons (Alps SKTAAAE010: 2.6 × 1.6 mm, a dome 0.53 mm high, 0.11 mm travel) and the U.FL receptacle (Hirose U.FL-R-SMT-1: a Ø2 mm post 1.25 mm high on a 2.6 mm base; 2.5 mm at most with a plug on it) are their makers’ data sheets. The receptacle’s overhang (from the GCT drawing against Seeed’s footprint), the buttons’ body height and dome size (from Alps’s drawing), the LEDs’ height and the shield can (from Seeed’s rendered pinout; it is not in the KiCad design) are estimated. Seeed’s KiCad design also carries a 1.27 mm wide outline under the shield’s lower edge on its board outline layer, which no photograph shows; it is left out. The antenna is chosen in firmware: GPIO3 low enables the RF switch, then GPIO14 high selects the U.FL connector (low, the default: the ceramic antenna). Pads underneath: JTAG (MTDO, MTDI, MTCK, MTMS), EN, BOOT, 3V3, GND and the battery (BAT+ and BAT−, charged by the board). Small 0201 and 0402 resistors and capacitors are left out of the layout.',
    published: { ...Object.fromEntries((['L', 'W', 't', 'r', 'e', 'e1', 'a', 'd'] as const).map(key => [key, 'seeed-xiao-esp32c6-kicad'])), usbW: 'gct-usb4105', usbH: 'gct-usb4105' },
    dimensions: { L: 20.955, W: 17.78, t: 1.6, r: 1.905, e: 2.54, e1: 15.24, a: 2.921, d: 1, usbW: 8.94, usbH: 3.31, usbOverhang: 1.54 },
    columns: [['GPIO0', 'GPIO1', 'GPIO2', 'GPIO21', 'GPIO22', 'GPIO23', 'GPIO16'], ['5V', 'GND', '3V3', 'GPIO18', 'GPIO20', 'GPIO19', 'GPIO17']],
    edge: 'castellated, drilled',
    layout: {
      castellated: true, bareUnderside: true, solderMask: 'black',
      usb: { x0: 4.42, y0: 15.15 },
      // Seeed's KiCad footprints, moved into the layout's frame (its X along the board is the layout's Y)
      components: [
        { name: 'Shield can (over the ESP32-C6FH4, crystal and regulator)', kind: 'shield', x: 8.89, y: 8.76, width: 12.2, length: 10.45, height: 1.5, rotation: 0, sized: 'estimated', source: ESTIMATE },
        { name: 'RESET button (CHIP_EN)', kind: 'button', x: 2.31, y: 19.87, width: 2.6, length: 1.6, height: 0.35, rotation: 0, top: { shape: 'round', width: 1.1, length: 1.1, height: 0.53 }, travel: 0.11, sized: 'manufacturer', source: 'alps-sktaaae010' },
        { name: 'BOOT button (GPIO9)', kind: 'button', x: 15.47, y: 19.87, width: 2.6, length: 1.6, height: 0.35, rotation: 0, top: { shape: 'round', width: 1.1, length: 1.1, height: 0.53 }, travel: 0.11, sized: 'manufacturer', source: 'alps-sktaaae010' },
        { name: 'Red charge LED', kind: 'led', x: 3.02, y: 16.55, width: 0.5, length: 1, height: 0.45, rotation: 0, sized: 'estimated', source: ESTIMATE },
        { name: 'Yellow user LED (GPIO15)', kind: 'led', x: 14.7, y: 16.55, width: 0.5, length: 1, height: 0.45, rotation: 0, sized: 'estimated', source: ESTIMATE },
        { name: 'U.FL receptacle (Hirose U.FL-R-SMT-1)', kind: 'connector', x: 4.59, y: 1.41, width: 2.6, length: 2.6, height: 0.35, rotation: 0, top: { shape: 'round', width: 2, length: 2, height: 1.25 }, sized: 'manufacturer', source: 'hirose-u-fl' },
        { name: 'Ceramic antenna (KH5220-A36)', kind: 'antenna', x: 12.01, y: 1.15, width: 5.2, length: 2, height: 1.1, rotation: 0, sized: 'manufacturer', source: 'seeed-xiao-esp32c6-kicad' },
      ],
      antennaKeepout: { x0: 9, y0: 0, x1: 15.2, y1: 2.9 },
      externalAntenna: {
        kind: 'connector', name: 'U.FL (Hirose U.FL-R-SMT-1)', x: 4.59, y: 1.41, matedHeight: 2.5, source: 'seeed-xiao-esp32c6',
        select: 'GPIO3 low enables the RF switch; then GPIO14 high selects the U.FL connector, low (the default) the ceramic antenna.',
      },
      bottomPads: [
        { name: 'MTDI (GPIO5)', x: 7.62, y: 19.06 }, { name: 'MTDO (GPIO7)', x: 10.16, y: 19.06 }, { name: 'EN', x: 7.62, y: 16.52 }, { name: 'GND', x: 10.16, y: 16.52 },
        { name: 'MTMS (GPIO4)', x: 7.62, y: 13.98 }, { name: 'MTCK (GPIO6)', x: 10.16, y: 13.98 }, { name: 'BOOT (GPIO9)', x: 7.62, y: 11.44 }, { name: '3V3', x: 10.06, y: 11.5 },
        { name: 'BAT+', x: 7.11, y: 4.89 }, { name: 'BAT−', x: 9.65, y: 4.89 },
      ],
    },
  },
];


function layoutOf(board: Board): DevBoardLayout {
  const { L, W, e, e1, a, usbW, usbH, usbOverhang } = board.dimensions;
  const pins = board.columns.flatMap((names, column) => names.map((name, i) => ({ name, x: round((W + (column === 0 ? -e1 : e1)) / 2), y: round(L - a - i * e) })));
  const { usb, ...rest } = board.layout;
  return { ...rest, pins, usb: { x0: usb.x0, y0: usb.y0, x1: round(usb.x0 + usbW), y1: round(L + usbOverhang), height: usbH } };
}

/** The top of a component above the PCB: its plunger's or lens's, else its body's. */
export const componentTop = (component: DevBoardComponent) => component.top?.height ?? component.height;

/** The tallest thing on the board above the PCB: the receptacle or a component. */
const tallest = (layout: DevBoardLayout) => Math.max(layout.usb.height, ...layout.components.map(componentTop));

export const devBoardParts: Part[] = BOARDS.map((board): Part => {
  const dimension = (key: keyof Board['dimensions'] | 'H', value: number) => {
    const source = board.published[key];
    return source ? measured('manufacturer', source)(value) : measured('estimated', ESTIMATE)(value);
  };
  const dimensions = Object.fromEntries(Object.entries(board.dimensions).map(([key, value]) => [key, dimension(key as keyof Board['dimensions'], value)]));
  const layout = layoutOf(board);
  return {
    id: board.id, family: 'dev-board', title: board.title, designation: board.designation, aliases: board.aliases, description: board.description,
    standard: null, product: { manufacturer: board.manufacturer, sku: board.sku, url: board.url },
    attributes: {
      chip: board.chip, pins: `${layout.pins.length}`, edge: board.edge, usb: 'USB-C',
      externalAntenna: layout.externalAntenna?.kind === 'connector' ? 'U.FL connector' : layout.externalAntenna ? 'coax solder points' : 'none', manufacturer: board.manufacturer,
    },
    dimensions: { ...dimensions, H: dimension('H', round(board.dimensions.t + tallest(layout))) },
    sources: board.sources, notes: board.notes, preview: { kind: 'procedural' },
  };
});

/** The layout of a development board of the library (see `DevBoardLayout`), or undefined for any other part. */
export function devBoardLayout(part: Part): DevBoardLayout | undefined {
  const board = BOARDS.find(candidate => candidate.id === part.id);
  return board ? layoutOf(board) : undefined;
}
