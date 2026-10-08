/**
 * The magnetic QR code tag (models/qr-magnet-tag/generator.scad, docs/qr-magnet-tag.md): a border that holds disc magnets in its
 * back, and a centre plate that carries a QR code and an optional SVG logo, printed in two colours with one filament change.
 *
 * This module is shared by the browser, the API, the worker and the tests:
 * - `encodeQr` turns the text into a QR symbol (byte mode, the chosen error correction, the mask chosen by the penalty rules of
 *   ISO/IEC 18004), with `uqr` (MIT, no dependencies; a port of Project Nayuki's reference-quality generator).
 * - `qrTagCode` clears the logo's knockout pad and merges the dark modules into rectangles, and `qrScad` writes them for
 *   `-D QR=` as numbers only. The API never receives a matrix: the worker encodes the validated text again.
 * - `qrTagLayout` repeats the generator's layout (seat, centre, code area, magnet pockets, joints), so that the contract can
 *   validate settings and place the magnets in the assembly preview exactly where the SCAD file cuts their pockets.
 *
 * Frame (mm): both parts are centred on the Z axis. The border prints back down (its back on z = 0, the front face on top); the
 * centre prints base down (light base, then the dark modules and logo on top) and sits in the border's seat the same way up.
 */
import { encode, QrCodeDataType } from 'uqr';
import { embedCavity, toLayers } from './printPause.ts';

export const QR_TEXT_MAX_LENGTH = 200;
export const QR_ECC_LEVELS = ['L', 'M', 'Q', 'H'] as const;
export type QrEcc = typeof QR_ECC_LEVELS[number];

/** A QR symbol: `dark[row][column]`, row 0 at the top; `fixed` marks the function patterns (finders, timing, alignment, format and
 * version information), which carry no data; `solid` the finder and alignment patterns among them, which a scanner finds the code
 * by and which therefore print solid in every module style. No quiet zone. */
export interface QrSymbol { version: number; size: number; mask: number; dark: boolean[][]; fixed: boolean[][]; solid: boolean[][] }

const symbolOf = (qr: ReturnType<typeof encode>): QrSymbol => ({
  version: qr.version, size: qr.size, mask: qr.maskPattern, dark: qr.data,
  // uqr marks every function module with a type other than Data
  fixed: qr.types.map(row => row.map(type => type !== QrCodeDataType.Data)),
  solid: qr.types.map(row => row.map(type => type === QrCodeDataType.Position || type === QrCodeDataType.Alignment)),
});

/** The text as a QR symbol: byte mode (one byte per printable ASCII character), at exactly this error correction (never raised), in
 * the smallest version that holds it. Throws for characters outside printable ASCII. */
export function encodeQr(text: string, ecc: QrEcc): QrSymbol {
  if (!/^[ -~]*$/.test(text)) throw new Error('Only printable ASCII characters can be encoded.');
  const bytes = Array.from(text, char => char.charCodeAt(0));
  return symbolOf(encode(bytes, { ecc, border: 0, boostEcc: false }));
}

/**
 * The logo's knockout: a light square pad of whole modules in the middle of the code, on which no module is printed and the logo
 * stands. Its side is odd, as the symbol's is, so that it is centred on the module grid, and leaves at least half a module round
 * a logo `logoSize` % of the symbol's width.
 */
export const knockoutModules = (size: number, logoSize: number): number => {
  const least = logoSize / 100 * size + 1;
  const odd = Math.ceil(least - 1e-9);
  return odd % 2 === 1 ? odd : odd + 1;
};

// ISO/IEC 18004 table 9, by version 1 to 40 (index 0 unused): the error-correction codewords per block, and the number of blocks.
const ECC_PER_BLOCK: Record<QrEcc, readonly number[]> = {
  L: [0, 7, 10, 15, 20, 26, 18, 20, 24, 30, 18, 20, 24, 26, 30, 22, 24, 28, 30, 28, 28, 28, 28, 30, 30, 26, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
  M: [0, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26, 26, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28],
  Q: [0, 13, 22, 18, 26, 18, 24, 18, 22, 20, 24, 28, 26, 24, 20, 30, 24, 28, 28, 26, 30, 28, 30, 30, 30, 30, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
  H: [0, 17, 28, 22, 16, 22, 28, 26, 26, 24, 28, 24, 28, 22, 24, 24, 30, 28, 28, 26, 28, 30, 24, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
};
const BLOCKS: Record<QrEcc, readonly number[]> = {
  L: [0, 1, 1, 1, 1, 1, 2, 2, 2, 2, 4, 4, 4, 4, 4, 6, 6, 6, 6, 7, 8, 8, 9, 9, 10, 12, 12, 12, 13, 14, 15, 16, 17, 18, 19, 19, 20, 21, 22, 24, 25],
  M: [0, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16, 17, 17, 18, 20, 21, 23, 25, 26, 28, 29, 31, 33, 35, 37, 38, 40, 43, 45, 47, 49],
  Q: [0, 1, 1, 2, 2, 4, 4, 6, 6, 8, 8, 8, 10, 12, 16, 12, 17, 16, 18, 21, 20, 23, 23, 25, 27, 29, 34, 34, 35, 38, 40, 43, 45, 48, 51, 53, 56, 59, 62, 65, 68],
  H: [0, 1, 1, 2, 4, 4, 4, 5, 6, 8, 8, 11, 11, 16, 16, 18, 16, 19, 21, 25, 25, 25, 34, 30, 32, 35, 37, 40, 42, 45, 48, 51, 54, 57, 60, 63, 66, 70, 74, 77, 81],
};
/** Codewords set aside against misdecoding (ISO/IEC 18004 table 9, "p"), which the decoder cannot spend on corrections. */
const MISDECODE: Partial<Record<string, number>> = { '1L': 3, '1M': 2, '1Q': 1, '1H': 1, '2L': 2, '3L': 1 };

/**
 * How badly a knockout of `pad` modules in the middle of a symbol damages it, block by block: the codewords it touches in each
 * Reed–Solomon block (every one counts as an error, whatever the logo on it), against the errors that block can correct. Found
 * by laying the codewords out as the standard does (ISO/IEC 18004 7.7.3: two-module columns zigzagging up and down from the
 * bottom right, round the function patterns; blocks interleaved codeword by codeword, the longer blocks last), so it depends only
 * on the version, the error correction and the pad, never on the text.
 */
export function knockoutDamage(version: number, ecc: QrEcc, pad: number): { damaged: number[]; correctable: number[] } {
  const size = 17 + 4 * version;
  const fixed = symbolFor(version, ecc).fixed;
  const blocks = BLOCKS[ecc][version] ?? 1, eccLength = ECC_PER_BLOCK[ecc][version] ?? 0;
  let modules = 0;
  for (const row of fixed) for (const value of row) if (!value) modules++;
  const raw = Math.floor(modules / 8);
  const short = blocks - raw % blocks, shortLength = Math.floor(raw / blocks);
  // the block of each codeword, in the order they are placed (data codewords interleaved, then error-correction codewords)
  const blockOf: number[] = [];
  for (let i = 0; i < shortLength + 1; i++) for (let j = 0; j < blocks; j++) if (i !== shortLength - eccLength || j >= short) blockOf.push(j);
  const damaged = Array.from({ length: blocks }, () => 0);
  const from = (size - pad) / 2, to = from + pad;
  const hit = new Set<number>();
  let bit = 0;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vert = 0; vert < size; vert++) for (let j = 0; j < 2; j++) {
      const x = right - j, y = ((right + 1) & 2) === 0 ? size - 1 - vert : vert;
      if (fixed[y]?.[x]) continue;
      const codeword = bit >>> 3;
      bit++;
      if (codeword >= raw || hit.has(codeword) || !(y >= from && y < to && x >= from && x < to)) continue;
      hit.add(codeword);
      const block = blockOf[codeword] ?? 0;
      damaged[block] = (damaged[block] ?? 0) + 1;
    }
  }
  const correctable = damaged.map(() => Math.floor((eccLength - (MISDECODE[`${version}${ecc}`] ?? 0)) / 2));
  return { damaged, correctable };
}

/** The function patterns of a symbol of this version (an empty one; they do not depend on the content), per error correction. */
const symbols = new Map<string, QrSymbol>();
function symbolFor(version: number, ecc: QrEcc): QrSymbol {
  const key = `${version}${ecc}`;
  let symbol = symbols.get(key);
  if (!symbol) {
    symbol = symbolOf(encode([], { ecc, border: 0, boostEcc: false, minVersion: version, maxVersion: version }));
    symbols.set(key, symbol);
  }
  return symbol;
}

/**
 * The share of each block's correctable errors the knockout may use: the rest is left for the print's own flaws (a smudged module,
 * glare on the relief). The decode round-trip test in qrMagnetTag.test.ts decodes the largest pad this allows, with a logo drawn
 * on it, at every version from 2 to 12.
 */
export const QR_LOGO_ECC_SHARE = 0.6;
/**
 * The largest share of the symbol's area the knockout may take, per error correction (about 7 % for M, 15 % for Q and 25 % for
 * H): a cap on top of the codeword count, which large versions would otherwise allow more of. The logo is refused below Q (the
 * editor says so); M's figure is listed for completeness.
 */
export const QR_LOGO_AREA_LIMIT: Record<QrEcc, number> = { L: 0, M: 0.07, Q: 0.15, H: 0.25 };
/** The lowest error correction that allows a logo. */
export const QR_LOGO_MIN_ECC: QrEcc = 'Q';
export const eccAllowsLogo = (ecc: QrEcc): boolean => QR_ECC_LEVELS.indexOf(ecc) >= QR_ECC_LEVELS.indexOf(QR_LOGO_MIN_ECC);

/**
 * Whether a knockout of `pad` modules fits a symbol of `size` at this error correction: it stays inside rows and columns 9 to
 * size − 10 (clear of the finder patterns, their separators, the timing lines and the format information), within the area cap,
 * and costs no block more than QR_LOGO_ECC_SHARE of the errors it can correct.
 */
export function knockoutFits(size: number, pad: number, ecc: QrEcc): boolean {
  if (pad > size - 18 || pad * pad > QR_LOGO_AREA_LIMIT[ecc] * size * size + 1e-9) return false;
  const { damaged, correctable } = knockoutDamage((size - 17) / 4, ecc, pad);
  return damaged.every((count, block) => count <= QR_LOGO_ECC_SHARE * (correctable[block] ?? 0) + 1e-9);
}

/** The largest logo size (whole % of the symbol's width) whose knockout fits, or 0 if none does. */
export function maxLogoSize(size: number, ecc: QrEcc): number {
  for (let percent = 100; percent > 0; percent--) if (knockoutFits(size, knockoutModules(size, percent), ecc)) return percent;
  return 0;
}

/** A rectangle of dark modules: column, row, width and height in modules (row 0 at the top). */
export type ModuleRect = [x: number, y: number, w: number, h: number];

/** The dark modules as rectangles: each row's runs, then runs of the same span in consecutive rows merged into one. */
export function mergeModules(dark: readonly (readonly boolean[])[]): ModuleRect[] {
  const done: ModuleRect[] = [];
  let open = new Map<string, ModuleRect>();
  dark.forEach((row, y) => {
    const next = new Map<string, ModuleRect>();
    for (let x = 0; x < row.length;) {
      if (!row[x]) { x++; continue; }
      const start = x;
      while (x < row.length && row[x]) x++;
      const key = `${start}:${x - start}`;
      const above = open.get(key);
      if (above) { above[3]++; next.set(key, above); open.delete(key); }
      else next.set(key, [start, y, x - start, 1]);
    }
    done.push(...open.values());
    open = next;
  });
  done.push(...open.values());
  return done.sort((a, b) => a[1] - b[1] || a[0] - b[0]);
}

/** The dark modules as vertical runs of at least two, one per column's run: `[x, y, h]` in modules (row 0 at the top). With the rows
 * of `mergeModules`' rectangles (each a whole run of its row) they say which dark modules touch, for the connected dots. */
export function moduleColumns(dark: readonly (readonly boolean[])[]): [x: number, y: number, h: number][] {
  const runs: [number, number, number][] = [];
  const size = dark.length;
  for (let x = 0; x < size; x++) for (let y = 0; y < size;) {
    if (!dark[y]?.[x]) { y++; continue; }
    const start = y;
    while (y < size && dark[y]?.[x]) y++;
    if (y - start > 1) runs.push([x, start, y - start]);
  }
  return runs.sort((a, b) => a[1] - b[1] || a[0] - b[0]);
}

/**
 * How the dark modules are drawn (docs/qr-magnet-tag.md#module-styles). The finder and alignment patterns, which a scanner finds the
 * code by, stay solid in every style (as rounded blobs outside `square`): drawn as dots, no scanner we tried finds them.
 * - `square`: squares, edge to edge, as the standard draws them (the default).
 * - `rounded-blobs`: the squares' union, its outer corners rounded: neighbours still touch along whole edges.
 * - `rounded-squares`: each module a separate rounded square, a gap between neighbours.
 * - `dots`: each module a separate dot.
 * - `connected-dots`: dots joined to their dark neighbours above, below and beside by bars as wide as the dots.
 */
export const QR_MODULE_STYLES = ['square', 'rounded-blobs', 'rounded-squares', 'dots', 'connected-dots'] as const;
export type QrModuleStyle = typeof QR_MODULE_STYLES[number];
/** The styles' sizes, as shares of the module pitch; a test compares them with the SCAD file. Separate shapes never touch: they keep
 * a gap of 1 − side (shapes that only just touch slice with holes in them). */
export const QR_MODULE_SHAPE = {
  /** rounded blobs (and the solid patterns of the other styles): the radius of their rounded outer corners */
  blobRadius: 0.3,
  /** rounded squares: the side and the corner radius */
  roundedSide: 0.85, roundedRadius: 0.25,
  /** dots and connected dots: the diameter, and the bars' width */
  dotDiameter: 0.85,
} as const;

/** The code the centre carries: the symbol, its knockout pad (0 without a logo), the dark modules left, as rectangles (`rects`, all of
 * them; `dataRects` without, `solidRects` only, the finder and alignment patterns) and the data modules' vertical runs. */
export interface QrTagCode { symbol: QrSymbol; pad: number; dark: boolean[][]; rects: ModuleRect[]; dataRects: ModuleRect[]; solidRects: ModuleRect[]; columns: [number, number, number][] }

export interface QrCodeSettings { qrText: string; errorCorrection: QrEcc; logo: string; logoSize: number }

export function qrTagCode(p: QrCodeSettings): QrTagCode {
  const symbol = encodeQr(p.qrText, p.errorCorrection);
  const pad = p.logo === '' ? 0 : knockoutModules(symbol.size, p.logoSize);
  const from = (symbol.size - pad) / 2, to = from + pad;
  const dark = symbol.dark.map((row, y) => row.map((value, x) => value && !(y >= from && y < to && x >= from && x < to)));
  const data = dark.map((row, y) => row.map((value, x) => value && !symbol.solid[y]?.[x]));
  const solid = dark.map((row, y) => row.map((value, x) => value && Boolean(symbol.solid[y]?.[x])));
  return { symbol, pad, dark, rects: mergeModules(dark), dataRects: mergeModules(data), solidRects: mergeModules(solid), columns: moduleColumns(data) };
}

/**
 * The code as an OpenSCAD vector for `-D QR=`: `[modules, pad, [[x, y, w, h], ...], [[x, y, w, h], ...], [[x, y, h], ...]]`: the
 * data modules' rectangles, the finder and alignment patterns' rectangles, and (for connected dots only, else empty) the data
 * modules' vertical runs. Every entry an integer: only numbers and brackets reach OpenSCAD; the text itself never does. Throws if
 * the settings cannot be encoded.
 */
export function qrScad(p: QrCodeSettings & { moduleStyle?: QrModuleStyle }): string {
  const code = qrTagCode(p);
  return JSON.stringify([code.symbol.size, code.pad, code.dataRects, code.solidRects, p.moduleStyle === 'connected-dots' ? code.columns : []]);
}

/** The nozzles the tag is checked for (diameters in mm, as the editor's choices): the smallest module it allows depends on the nozzle,
 * and CI slices every one of them (tools/test-slicer.ts). */
export const QR_NOZZLES = ['0.2', '0.25', '0.4', '0.5', '0.6', '0.8'] as const;
export type QrNozzle = typeof QR_NOZZLES[number];
/** How much wider (per side, mm) the dark filament prints than the slicer plans its lines: squish, over-extrusion and the dark
 * colour showing through at the edges. CI checks the code with its lines widened by this much. */
export const QR_BLEED = { minimum: 0, maximum: 0.2, default: 0.1, step: 0.01 } as const;

/**
 * The smallest module (mm) that slices and scans reliably in this style with this nozzle and bleed: `nozzle × nozzle factor + bleed ×
 * bleed factor`, never under the floor. Found by slicing with OrcaSlicer; CI slices every style and nozzle at this size, at no bleed,
 * the default bleed and the most bleed, and fails if a single module comes out the wrong colour (tools/test-slicer.ts,
 * docs/qr-magnet-tag.md#slicer-check).
 */
export const QR_MIN_MODULE: Record<QrModuleStyle, { nozzle: number; bleed: number; floor: number }> = {
  square: { nozzle: 2, bleed: 2, floor: 0.6 },
  'rounded-blobs': { nozzle: 2, bleed: 2, floor: 0.6 },
  'rounded-squares': { nozzle: 2.5, bleed: 3, floor: 0.8 },
  dots: { nozzle: 2.5, bleed: 3, floor: 0.8 },
  'connected-dots': { nozzle: 2.5, bleed: 3, floor: 0.8 },
};
export const minModuleSize = (style: QrModuleStyle, nozzle: number, bleed: number): number => {
  const f = QR_MIN_MODULE[style];
  return Math.ceil(Math.max(f.floor, f.nozzle * nozzle + f.bleed * bleed) * 100 - 1e-6) / 100;
};

// ---------------------------------------------------------------------------------------------------------------------------
// The tag's layout

/** The generator's fixed sizes (POCKET_PLAY ... DETENT_SPAN); a test compares them with the SCAD file. */
export const QR_TAG = {
  /** A magnet pocket is the magnet's greatest diameter plus this, and as deep as its greatest height. */
  pocketPlay: 0.2,
  /** Floor left between a back pocket and the seat (the front face's side). */
  floorWall: 0.8,
  /** Least wall between a pocket and the tag's outer edge, the centre's edge, the push-out hole or another pocket. */
  sideWall: 1.2,
  /** Under a joint magnet's pocket in the seat floor, to the back face. */
  jointBackWall: 0.6,
  /** Above a joint magnet's pocket in the centre, under its code. */
  centreWall: 0.6,
  /** Between the two magnets of a joint pair. */
  magnetGap: 0.2,
  /** The push-out hole through the middle of the seat floor. */
  pushHole: 5,
  /** The least corner radius of a square seat. */
  seatRadius: 1,
  /** Twist lock: the lugs' radial depth, angular width (degrees), height and count; the turn that locks them; the least lip over
   * them; the detent ridge's interference and angular width; the stop's angular width. */
  lugDepth: 1.5, lugAngle: 11, lugHeight: 0.8, lugs: 3, lockAngle: 30, lipMin: 0.6, twistEngage: 0.15, ridgeAngle: 2, stopAngle: 6,
  /** Crush ribs: radius, how much the centre squeezes them on top of the fit, and how many per side (square) or round a circle. */
  ribRadius: 1, ribSqueeze: 0.15, ribsPerSide: 2, ribsRound: 8,
  /** Detent: how far the bumps reach past the seat wall, on top of the fit, and how much of each side they span. */
  detentEngage: 0.2, detentSpan: 0.4,
  /** The least room above and below a detent bump on the centre's edge. */
  detentMargin: 0.2,
  /** The smallest seat (the inside of the border). */
  minSeat: 20,
  /** Embedded magnets: the least skin between a magnet and the back face (rounded up to whole layers), and the least headroom over
   * the magnet's greatest height before the print pauses (the cavity's top is the pause height, on a layer boundary). */
  embedSkin: 0.4, embedHeadroom: 0.05,
} as const;

/** How the magnets are held: in open pockets, pressed or glued in after printing, or sealed in cavities, dropped in when the print
 * pauses. */
export const QR_TAG_MOUNTS = ['pockets', 'embedded'] as const;
export type QrTagMount = typeof QR_TAG_MOUNTS[number];


export const QR_TAG_JOINTS = ['crush-ribs', 'detent', 'twist-lock', 'magnets'] as const;
export type QrTagJoint = typeof QR_TAG_JOINTS[number];
export const QR_TAG_SHAPES = ['square', 'round'] as const;
export type QrTagShape = typeof QR_TAG_SHAPES[number];

/** The settings the layout depends on (the model's parameters of the same names), and the chosen magnet's greatest size. */
export interface QrTagShapeSettings {
  shape: QrTagShape; size: number; cornerRadius: number; borderWidth: number; quietZone: number;
  baseThickness: number; reliefHeight: number; joint: QrTagJoint; fit: number; magnetCount: number;
  magnetMount: QrTagMount; layerHeight: number;
  magnetDiameter: number; magnetThickness: number;
}

type Point = [number, number];

/** The generator's derived layout (FLOOR ... JOINT_POCKETS in the SCAD file). */
export function qrTagLayout(p: QrTagShapeSettings) {
  const t = QR_TAG;
  const pocketD = p.magnetDiameter + t.pocketPlay;
  const pocketDepth = p.magnetThickness;
  const r = pocketD / 2;
  // Magnets joint: the centre's magnet sits in a pocket under its code and stands out of its back into a deeper pocket in the seat
  // floor, over the floor's own magnet.
  const centrePocket = Math.min(pocketDepth, p.baseThickness - t.centreWall);
  const protrusion = pocketDepth - centrePocket;
  const jointPocket = pocketDepth + protrusion + t.magnetGap;
  // Embedded: every magnet of the border (in the back, and the magnet joint's in the seat) lies in a sealed cavity from `skin`
  // over the back face up to the pause height; the floor closes over it. The centre's joint magnet still stands out of the centre
  // into an open pocket above that floor.
  const embedded = p.magnetMount === 'embedded';
  const cavity = embedCavity(t.embedSkin, pocketDepth, t.embedHeadroom, p.layerHeight);
  const skin = embedded ? cavity.skin : 0;
  const pauseHeight = embedded ? cavity.pause : 0;
  const floor = embedded ? pauseHeight + t.floorWall + (p.joint === 'magnets' ? protrusion + t.magnetGap : 0)
    : Math.max(pocketDepth + t.floorWall, p.joint === 'magnets' ? jointPocket + t.jointBackWall : 0);
  const backMagnetZ = skin;
  const seatMagnetZ = embedded ? skin : floor - jointPocket;
  const seatDepth = p.baseThickness + p.reliefHeight;
  const height = floor + seatDepth;
  const roundSeat = p.shape === 'round' || p.joint === 'twist-lock';
  const seatWidth = p.size - 2 * p.borderWidth;
  const seatRadius = roundSeat ? seatWidth / 2 : Math.max(p.cornerRadius - p.borderWidth, t.seatRadius);
  const centreWidth = seatWidth - 2 * p.fit;
  const centreRadius = seatRadius - p.fit;
  // the largest square inside the centre's face (a rounded square's corners cut it by the arc)
  const codeWidth = roundSeat ? centreWidth / Math.SQRT2 : centreWidth - 2 * centreRadius * (1 - Math.SQRT1_2);
  // back pockets: on the diagonals, as far out as the outline leaves a side wall
  const inset = r + t.sideWall;
  const corner = p.shape === 'round' ? (p.size / 2 - inset) * Math.SQRT1_2
    : p.cornerRadius > inset ? p.size / 2 - p.cornerRadius + (p.cornerRadius - inset) * Math.SQRT1_2 : p.size / 2 - inset;
  const diagonals: Point[] = [[1, 1], [-1, -1], [-1, 1], [1, -1]];
  const backPockets = diagonals.slice(0, p.magnetCount).map(([x, y]): Point => [x * corner, y * corner]);
  // joint magnets: on the axes, inside the centre with a side wall to its edge
  const axial = centreWidth / 2 - r - t.sideWall;
  const axes: Point[] = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  const jointPockets = p.joint === 'magnets' ? axes.slice(0, p.magnetCount).map(([x, y]): Point => [x * axial, y * axial]) : [];
  // twist lock: the channel under the lip that the lugs turn in, and the lip over them
  const channelRadius = seatWidth / 2 + t.lugDepth + p.fit;
  const lip = seatDepth - t.lugHeight - p.fit;
  return { pocketD, pocketDepth, centrePocket, protrusion, jointPocket, embedded, skin, pauseHeight, backMagnetZ, seatMagnetZ, floor, seatDepth, height, roundSeat, seatWidth, seatRadius, centreWidth, centreRadius, codeWidth, backPockets, jointPockets, channelRadius, lip };
}
export type QrTagLayout = ReturnType<typeof qrTagLayout>;

/** The width of one module, in mm: the code area over the symbol and its quiet zone. */
export const moduleSize = (layout: QrTagLayout, modules: number, quietZone: number): number => layout.codeWidth / (modules + 2 * quietZone);

/** The height at which to change to the dark filament: the base's top, rounded up to a layer boundary. */
export const filamentChangeHeight = (baseThickness: number, layerHeight: number): number => toLayers(baseThickness, layerHeight);

/** Problems with the magnet pockets for these settings (empty when they fit), in words for the user. */
export function magnetPocketIssues(p: QrTagShapeSettings, layout: QrTagLayout = qrTagLayout(p)): string[] {
  const t = QR_TAG;
  const issues: string[] = [];
  const d = layout.pocketD;
  const distance = (a: Point, b: Point) => Math.hypot(a[0] - b[0], a[1] - b[1]);
  const pairs = (points: Point[]) => points.flatMap((a, i) => points.slice(i + 1).map(b => distance(a, b)));
  const back = layout.backPockets;
  if (Math.min(...back.map(point => Math.hypot(...point))) < d / 2 + t.pushHole / 2 + t.sideWall - 1e-9 || Math.min(...pairs(back)) < d + t.sideWall - 1e-9)
    issues.push(`The ${d.toFixed(1)} mm pockets for this magnet do not fit in the back of a ${p.size} mm tile. Choose a smaller magnet or a larger tile.`);
  const joint = layout.jointPockets;
  if (joint.length > 0) {
    const axial = Math.hypot(...(joint[0] ?? [0, 0]));
    const apart = Math.min(...joint.flatMap(a => back.map(b => distance(a, b))));
    if (axial < d / 2 + t.pushHole / 2 + t.sideWall - 1e-9 || apart < d + t.sideWall - 1e-9 || Math.min(...pairs(joint)) < d + t.sideWall - 1e-9)
      issues.push(`The joint magnets’ ${d.toFixed(1)} mm pockets do not fit beside the back magnets under a ${layout.centreWidth.toFixed(1)} mm centre. Choose a smaller magnet, fewer magnets, another joint or a larger tile.`);
    if (layout.centrePocket < 0.6 - 1e-9) issues.push(`The base is too thin to hold the joint magnets: make it at least ${(0.6 + t.centreWall).toFixed(1)} mm thick.`);
  }
  return issues;
}
