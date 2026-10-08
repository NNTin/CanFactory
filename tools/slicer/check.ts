/**
 * Does the sliced code still read? The dark filament's lines (every extrusion above the filament change), seen from above as a
 * scanner sees the print, each widened by the bleed on both sides, compared module by module with the code they should draw.
 *
 * A module is read right when:
 * - dark: at least half of its middle (the middle half of its width, where a scanner samples it) is dark;
 * - light: at most half of its middle is dark, and at most half of the whole module, so that it still shows as a light gap.
 * One module read wrong fails the check, though the code's error correction would repair it: the print's own flaws need that.
 * Real codes are also decoded with jsQR, which finds the code by its corner patterns, at several resolutions: it must read the text
 * at one of them. jsQR alone is no check of the print: at H it still reads codes with a hundred modules wrong, and it misses dot
 * codes at some resolutions whose every module is right.
 */
import { zlibSync } from 'fflate';
import jsQR from 'jsqr';
import type { Extrusion } from './gcode.ts';

export interface Grid {
  /** dark[row][column], row 0 at the top */
  dark: readonly (readonly boolean[])[];
  /** the module's width, mm */
  module: number;
  /** modules the check skips (the logo's pad, where the logo stands dark on light) */
  skip?: (row: number, column: number) => boolean;
  /** quiet zone round it, modules: drawn light for the decoder */
  quietZone: number;
}

export interface ModuleError { row: number; column: number; shouldBe: 'dark' | 'light'; middle: number; whole: number }

export interface PrintCheck {
  modules: number; errors: ModuleError[];
  /** the least dark middle of a dark module, and the darkest light module (middle or whole), as shares */
  worstDark: number; worstLight: number;
  /** what jsQR reads at any of DECODE_SCALES, and at each */
  decoded: string | undefined; decodes: [perModule: number, text: string | undefined][];
  extrusions: number; layers: number[];
  /** the picture of the dark lines, with the wrong modules marked, as PNG */
  png: Uint8Array;
}

const THRESHOLD = 0.5;
/** The resolutions (pixels per module) the code is decoded at; it must decode at one of them. */
export const DECODE_SCALES = [3, 4, 5, 6, 8, 10] as const;

/** `lines`: the G-code's extrusions, X and Y relative to the code's centre. `changeHeight`: the top of the light base. */
export function checkPrint(lines: Extrusion[], changeHeight: number, grid: Grid, bleed: number): PrintCheck {
  const n = grid.dark.length, m = grid.module;
  const px = Math.min(0.025, m / 40);
  const codeHalf = n * m / 2, half = codeHalf + (grid.quietZone + 1) * m;
  const side = Math.ceil(2 * half / px);
  const ink = new Uint8Array(side * side);
  const dark = lines.filter(line => line.z > changeHeight + 1e-6);
  for (const { x0, y0, x1, y1, width } of dark) {
    const r = width / 2 + bleed, r2 = r * r;
    const i0 = Math.max(0, Math.floor((Math.min(x0, x1) - r + half) / px)), i1 = Math.min(side - 1, Math.ceil((Math.max(x0, x1) + r + half) / px));
    const j0 = Math.max(0, Math.floor((half - Math.max(y0, y1) - r) / px)), j1 = Math.min(side - 1, Math.ceil((half - Math.min(y0, y1) + r) / px));
    const dx = x1 - x0, dy = y1 - y0, l2 = dx * dx + dy * dy;
    for (let j = j0; j <= j1; j++) {
      const wy = half - (j + 0.5) * px;
      for (let i = i0; i <= i1; i++) {
        const wx = (i + 0.5) * px - half;
        const t = l2 > 0 ? Math.max(0, Math.min(1, ((wx - x0) * dx + (wy - y0) * dy) / l2)) : 0;
        const qx = x0 + t * dx - wx, qy = y0 + t * dy - wy;
        if (qx * qx + qy * qy <= r2) ink[j * side + i] = 1;
      }
    }
  }
  // each module's share of dark: over its middle (half its width) and over all of it
  const share = (row: number, column: number, inset: number) => {
    const left = -codeHalf + column * m + inset, top = codeHalf - row * m - inset, size = m - 2 * inset;
    const i0 = Math.round((left + half) / px), i1 = Math.round((left + size + half) / px);
    const j0 = Math.round((half - top) / px), j1 = Math.round((half - top + size) / px);
    let hit = 0;
    for (let j = j0; j < j1; j++) for (let i = i0; i < i1; i++) hit += ink[j * side + i] ?? 0;
    return hit / Math.max(1, (i1 - i0) * (j1 - j0));
  };
  const errors: ModuleError[] = [];
  let worstDark = 1, worstLight = 0, modules = 0;
  for (let row = 0; row < n; row++) for (let column = 0; column < n; column++) {
    if (grid.skip?.(row, column)) continue;
    modules++;
    const middle = share(row, column, m / 4), whole = share(row, column, 0);
    if (grid.dark[row]?.[column]) {
      worstDark = Math.min(worstDark, middle);
      if (middle < THRESHOLD) errors.push({ row, column, shouldBe: 'dark', middle, whole });
    } else {
      worstLight = Math.max(worstLight, middle, whole);
      if (middle > THRESHOLD || whole > THRESHOLD) errors.push({ row, column, shouldBe: 'light', middle, whole });
    }
  }
  // what a scanner sees, at several resolutions (jsQR finds dot codes at some and not at others, though every module is right):
  // the border's blue beyond the quiet zone
  const quiet = codeHalf + grid.quietZone * m;
  const view = (perModule: number) => {
    const k = Math.max(1, Math.round(m / px / perModule)), small = Math.floor(side / k);
    const rgba = new Uint8ClampedArray(small * small * 4);
    for (let j = 0; j < small; j++) for (let i = 0; i < small; i++) {
      let sum = 0;
      for (let b = 0; b < k; b++) for (let a = 0; a < k; a++) sum += ink[(j * k + b) * side + i * k + a] ?? 0;
      const wx = (i + 0.5) * k * px - half, wy = half - (j + 0.5) * k * px;
      const grey = Math.round(238 - (238 - 20) * sum / (k * k));
      rgba.set(Math.abs(wx) > quiet || Math.abs(wy) > quiet ? [47, 111, 214, 255] : [grey, grey, Math.min(255, grey + 2), 255], (j * small + i) * 4);
    }
    return { rgba, small, k };
  };
  const decodes: [number, string | undefined][] = DECODE_SCALES.map(perModule => { const v = view(perModule); return [perModule, jsQR(v.rgba, v.small, v.small, { inversionAttempts: 'dontInvert' })?.data]; });
  const decoded = decodes.find(([, text]) => text !== undefined)?.[1];
  const { rgba, small, k } = view(6);
  // the picture for the CI artefacts: wrong modules framed, red where a dark module came out light, orange the other way
  const picture = new Uint8Array(small * small * 3);
  for (let p = 0; p < small * small; p++) picture.set([rgba[p * 4] ?? 0, rgba[p * 4 + 1] ?? 0, rgba[p * 4 + 2] ?? 0], p * 3);
  for (const error of errors) {
    const colour = error.shouldBe === 'dark' ? [230, 30, 30] : [255, 150, 0];
    const left = Math.floor((-codeHalf + error.column * m + half) / px / k), top = Math.floor((half - codeHalf + error.row * m) / px / k), size = Math.max(2, Math.round(m / px / k));
    for (let t = 0; t <= size; t++) for (const [i, j] of [[left + t, top], [left + t, top + size], [left, top + t], [left + size, top + t]] as const)
      if (i >= 0 && j >= 0 && i < small && j < small) picture.set(colour, (j * small + i) * 3);
  }
  return { modules, errors, worstDark, worstLight, decoded, decodes, extrusions: dark.length, layers: [...new Set(dark.map(line => line.z))].sort((a, b) => a - b), png: png(picture, small, small) };
}

/** The grid as text, for the log: `#` dark and `.` light as they should be, `X` a dark module printed light, `O` a light one dark. */
export function moduleMap(grid: Grid, errors: ModuleError[]): string {
  const wrong = new Map(errors.map(error => [`${error.row},${error.column}`, error.shouldBe]));
  return grid.dark.map((row, r) => row.map((value, c) => {
    const error = wrong.get(`${r},${c}`);
    return error === 'dark' ? 'X' : error === 'light' ? 'O' : grid.skip?.(r, c) ? ' ' : value ? '#' : '.';
  }).join('')).join('\n');
}

// A minimal PNG writer (8-bit RGB), so that the artefacts need no image library.
const CRC = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
function crc32(bytes: Uint8Array): number { let c = 0xffffffff; for (const b of bytes) c = (CRC[(c ^ b) & 0xff] ?? 0) ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
function chunk(type: string, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + data.length), view = new DataView(out.buffer);
  view.setUint32(0, data.length);
  out.set(new TextEncoder().encode(type), 4); out.set(data, 8);
  view.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)));
  return out;
}
function png(rgb: Uint8Array, width: number, height: number): Uint8Array {
  const raw = new Uint8Array((width * 3 + 1) * height);
  for (let y = 0; y < height; y++) raw.set(rgb.subarray(y * width * 3, (y + 1) * width * 3), y * (width * 3 + 1) + 1);
  const header = new Uint8Array(13), view = new DataView(header.buffer);
  view.setUint32(0, width); view.setUint32(4, height); header.set([8, 2, 0, 0, 0], 8);
  const parts = [new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', header), chunk('IDAT', zlibSync(raw)), chunk('IEND', new Uint8Array())];
  const out = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let offset = 0;
  for (const part of parts) { out.set(part, offset); offset += part.length; }
  return out;
}
