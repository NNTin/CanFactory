import type { Dimension, Part, PartFamily } from './schema.ts';
import { measured } from './sources.ts';

/**
 * Prototype boards on the 2.54 mm grid: perfboard (isolated pads), stripboard (copper strips), a board of pads linked by thin
 * traces, and breadboard-style boards (Adafruit's Perma-Proto, with its 5-hole strips and power rails). A wire-routing guide
 * or a case is designed round the outline, the mounting holes and the holes it addresses by (column, row), so each board has its
 * layout (`prototypeBoardLayout`) besides its dimensions. See docs/adding-parts.md, “Prototype boards”.
 */
export const prototypeBoardFamily: PartFamily = {
  id: 'prototype-board', title: 'Prototype boards',
  description: 'Perfboard, stripboard and breadboard-style prototype PCBs on the 2.54 mm grid, with the outline, the hole grid and its printed labels, the pads, the holes the copper connects, and the mounting holes.',
  attributes: [
    { key: 'pattern', label: 'Pattern' }, { key: 'grid', label: 'Grid (columns × rows)' }, { key: 'holes', label: 'Holes' },
    { key: 'plating', label: 'Plating' }, { key: 'copper', label: 'Copper' }, { key: 'material', label: 'Material' },
    { key: 'solderMask', label: 'Solder mask' }, { key: 'manufacturer', label: 'Manufacturer' },
  ],
  dimensions: [
    { key: 'L', label: 'Board size along X, the direction the columns are counted in', symbol: 'L', required: true },
    { key: 'W', label: 'Board size along Y, the direction the rows are counted in', symbol: 'W', required: true },
    { key: 't', label: 'Board thickness', symbol: 't', required: true },
    { key: 'r', label: 'Corner radius (square corners when omitted)', symbol: 'r', required: false },
    { key: 'e', label: 'Hole pitch', symbol: 'e', required: true },
    { key: 'x0', label: 'Centre of hole (0, 0) from the board’s edge at x = 0', symbol: 'x0', required: true },
    { key: 'y0', label: 'Centre of hole (0, 0) from the board’s edge at y = 0', symbol: 'y0', required: true },
    { key: 'd', label: 'Hole (drill) diameter', symbol: 'd', required: true },
    { key: 'pad', label: 'Pad diameter (round pads)', symbol: 'D', required: false },
    { key: 'sw', label: 'Strip width (stripboard)', symbol: 'b', required: false },
    { key: 'dm', label: 'Mounting hole diameter', symbol: 'dm', required: false },
  ],
};

/** A hole of the grid by its 0-based column (counted along +X) and row (counted along +Y). */
export type PrototypeBoardHoleRef = readonly [column: number, row: number];
/** A point in the board's plane. */
export interface PrototypeBoardPoint { x: number; y: number }
/** The hole grid: grid position (column, row) is at (`x0` + column × `pitch`, `y0` + row × `pitch`), 0 ≤ column < `columns`. */
export interface PrototypeBoardGrid { x0: number; y0: number; pitch: number; columns: number; rows: number }
/**
 * A drilled hole of the grid with its pad: its grid position, its centre, the label the board prints for it (`A1`, `top + 5`;
 * null when the board prints none) and its net (null for an isolated pad).
 */
export interface PrototypeBoardHole extends PrototypeBoardPoint { column: number; row: number; label: string | null; net: string | null }
/** The pad on one side of the board round every hole: a disc (`round`) or a square, `size` across. */
export interface PrototypeBoardPad { shape: 'round' | 'square'; size: number }
/**
 * A copper trace between the pads of two neighbouring holes, on one side of the board, `width` wide. Cutting it (as one cuts a
 * stripboard's strip) is removing it: the nets are the holes the remaining traces connect.
 */
export interface PrototypeBoardTrace { from: PrototypeBoardHoleRef; to: PrototypeBoardHoleRef; side: 'top' | 'bottom'; width: number }
/** Holes the copper connects: a stripboard's strip, a Perma-Proto's 5-hole strip or power rail, or all of a linked board's pads. */
export interface PrototypeBoardNet { id: string; kind: 'strip' | 'rail' | 'linked'; holes: PrototypeBoardHoleRef[] }
export interface PrototypeBoardMountingHole extends PrototypeBoardPoint { d: number; plated: boolean }
/**
 * Where everything on a prototype board is. Frame (as the development boards'): millimetres, Z up; the board's underside on
 * z = 0 with its corner at the origin, seen from the component side (for a single-sided board the bare side, the copper being
 * underneath); the board runs from x = 0 to `L` and from y = 0 to `W`. Columns are counted along +X and rows along +Y, both from
 * 0: hole (column, row) is at `point(column, row)`. A grid position can be empty (a Perma-Proto's gap between its halves); only
 * `holes` are drilled.
 */
export interface PrototypeBoardLayout {
  outline: { L: number; W: number; t: number; r: number };
  grid: PrototypeBoardGrid;
  /** What the board prints beside each column and row (null where it prints nothing), indexed by column and by row. */
  columnLabels: (string | null)[];
  rowLabels: (string | null)[];
  drill: number;
  plated: boolean;
  /** The pad round each hole on each side; null on a side without copper pads. */
  pads: { top: PrototypeBoardPad | null; bottom: PrototypeBoardPad | null };
  /** The surface of each side: its solder mask's colour, or `bare` (the laminate, with the copper uncoated by mask). */
  surface: { top: 'white mask' | 'green mask' | 'bare'; bottom: 'white mask' | 'green mask' | 'bare' };
  material: 'FR4' | 'FR2';
  /** The copper's finish: gold plate, tin (hot-air levelled) or bare copper under an organic or anti-tarnish coating. */
  finish: 'gold' | 'tin' | 'copper';
  holes: PrototypeBoardHole[];
  traces: PrototypeBoardTrace[];
  nets: PrototypeBoardNet[];
  mountingHoles: PrototypeBoardMountingHole[];
  /** The centre of grid position (column, row), drilled or not. */
  point(column: number, row: number): PrototypeBoardPoint;
  /** The drilled hole at (column, row), or undefined for an empty grid position or one off the grid. */
  hole(column: number, row: number): PrototypeBoardHole | undefined;
  /** The hole the board labels so (`A1`, `J30`, `top + 5`), or undefined. */
  holeByLabel(label: string): PrototypeBoardHole | undefined;
}

const round = (value: number) => Math.round(value * 10000) / 10000;
const PITCH = 2.54;

interface BoardSpec {
  grid: PrototypeBoardGrid; outline: PrototypeBoardLayout['outline'];
  columnLabels?: (column: number) => string | null; rowLabels?: (row: number) => string | null;
  drill: number; plated: boolean; pads: PrototypeBoardLayout['pads']; surface: PrototypeBoardLayout['surface']; material: PrototypeBoardLayout['material'];
  finish: PrototypeBoardLayout['finish'];
  /** Whether grid position (column, row) is drilled (all of them when omitted). */
  drilled?: (column: number, row: number) => boolean;
  /** The copper traces: from each hole to the neighbours it is linked to (+X or +Y), on one side, with a width. */
  links?: (column: number, row: number) => PrototypeBoardHoleRef[];
  traceSide?: 'top' | 'bottom'; traceWidth?: (from: PrototypeBoardHoleRef, to: PrototypeBoardHoleRef) => number;
  /** A net's id and kind, from its holes (ordered by column, then row). */
  net?: (holes: PrototypeBoardHoleRef[]) => { id: string; kind: PrototypeBoardNet['kind'] };
  mountingHoles: PrototypeBoardMountingHole[];
}

/** The groups of two or more holes that `traces` connect, each ordered by column and then row (a union-find over the holes). */
function connections(holes: readonly PrototypeBoardHoleRef[], traces: readonly PrototypeBoardTrace[]): PrototypeBoardHoleRef[][] {
  const key = ([column, row]: PrototypeBoardHoleRef) => `${column},${row}`;
  const parent = new Map(holes.map(hole => [key(hole), key(hole)]));
  const find = (k: string): string => { let root = k; while (parent.get(root) !== root) root = parent.get(root) ?? root; parent.set(k, root); return root; };
  for (const { from, to } of traces) {
    if (!parent.has(key(from)) || !parent.has(key(to))) continue;
    const [a, b] = [find(key(from)), find(key(to))];
    if (a !== b) parent.set(b, a);
  }
  const groups = new Map<string, PrototypeBoardHoleRef[]>();
  for (const hole of [...holes].sort((p, q) => p[0] - q[0] || p[1] - q[1])) {
    const root = find(key(hole)); groups.set(root, [...groups.get(root) ?? [], hole]);
  }
  return [...groups.values()].filter(group => group.length > 1);
}

/**
 * The holes a board's copper connects with only `traces` left (its own by default): cut a strip or a link by leaving its trace
 * out, and the nets are what remains connected. Groups of two or more holes, each ordered by column and then row.
 */
export function prototypeBoardConnections(layout: PrototypeBoardLayout, traces: readonly PrototypeBoardTrace[] = layout.traces): PrototypeBoardHoleRef[][] {
  return connections(layout.holes.map(hole => [hole.column, hole.row] as const), traces);
}

function layoutOf(spec: BoardSpec): PrototypeBoardLayout {
  const { grid } = spec;
  const drilled = (column: number, row: number) =>
    column >= 0 && row >= 0 && column < grid.columns && row < grid.rows && (spec.drilled?.(column, row) ?? true);
  const point = (column: number, row: number) => ({ x: round(grid.x0 + column * grid.pitch), y: round(grid.y0 + row * grid.pitch) });
  const columnLabels = Array.from({ length: grid.columns }, (_, column) => spec.columnLabels?.(column) ?? null);
  const rowLabels = Array.from({ length: grid.rows }, (_, row) => spec.rowLabels?.(row) ?? null);
  const traces: PrototypeBoardTrace[] = [];
  for (let row = 0; row < grid.rows; row++) for (let column = 0; column < grid.columns; column++) {
    if (!drilled(column, row)) continue;
    for (const to of spec.links?.(column, row) ?? []) {
      if (drilled(to[0], to[1])) traces.push({ from: [column, row], to, side: spec.traceSide ?? 'bottom', width: spec.traceWidth?.([column, row], to) ?? 0 });
    }
  }
  const drilledRefs: PrototypeBoardHoleRef[] = [];
  for (let column = 0; column < grid.columns; column++) for (let row = 0; row < grid.rows; row++) if (drilled(column, row)) drilledRefs.push([column, row]);
  const nets: PrototypeBoardNet[] = [];
  const netOf = new Map<string, string>();
  for (const holes of connections(drilledRefs, traces)) {
    const named = spec.net?.(holes) ?? { id: `net ${nets.length + 1}`, kind: 'strip' as const };
    nets.push({ ...named, holes });
    for (const [column, row] of holes) netOf.set(`${column},${row}`, named.id);
  }
  const holes: PrototypeBoardHole[] = [];
  for (let row = 0; row < grid.rows; row++) for (let column = 0; column < grid.columns; column++) {
    if (!drilled(column, row)) continue;
    const [c, r] = [columnLabels[column], rowLabels[row]];
    const label = c && r ? (r.length === 1 ? `${r}${c}` : `${r} ${c}`) : null;
    holes.push({ column, row, ...point(column, row), label, net: netOf.get(`${column},${row}`) ?? null });
  }
  const key = (column: number, row: number) => row * grid.columns + column;
  const byPosition = new Map(holes.map(hole => [key(hole.column, hole.row), hole]));
  const byLabel = new Map(holes.filter(hole => hole.label).map(hole => [hole.label, hole]));
  return {
    outline: spec.outline, grid, columnLabels, rowLabels, drill: spec.drill, plated: spec.plated, pads: spec.pads, surface: spec.surface,
    material: spec.material, finish: spec.finish, holes, traces, nets, mountingHoles: spec.mountingHoles, point,
    hole: (column, row) => drilled(column, row) ? byPosition.get(key(column, row)) : undefined,
    holeByLabel: label => byLabel.get(label),
  };
}

// --- Adafruit Perma-Proto ----------------------------------------------------------------------------------------------------
// Read from Adafruit's EAGLE files (adafruit-perma-proto-pcb), moved into the layout's frame: x minus the outline's left edge
// (−21.59, −40.64 and −43.18 mm in the quarter, half and full files) and y + 25.4 here. Eighteen grid rows 2.54 mm apart:
// the bottom rails (rows 0 and 1), A–E (rows 3–7), the middle channel, F–J (rows 10–14) and the top rails (rows 16 and 17).
// Each column's A–E and F–J are a 5-hole strip; each rail runs the board's length. The red line (+) is outside the bottom pair
// and inside the top pair, so row 0 and row 16 are + and rows 1 and 17 are −, as printed.

const PERMA_ROWS: Record<number, string> = {
  0: 'bottom +', 1: 'bottom -', 3: 'A', 4: 'B', 5: 'C', 6: 'D', 7: 'E', 10: 'F', 11: 'G', 12: 'H', 13: 'I', 14: 'J', 16: 'top +', 17: 'top -',
};
const PERMA_RAILS = [0, 1, 16, 17];
const PERMA_STRIP_WIDTH = 0.4064;
const PERMA_RAIL_WIDTH = 0.8128;

function permaProto(columns: number, L: number, mounting: number[]): PrototypeBoardLayout {
  return layoutOf({
    grid: { x0: 3.81, y0: 3.81, pitch: PITCH, columns, rows: 18 },
    outline: { L, W: 50.8, t: 1.6, r: 2.54 },
    columnLabels: column => String(column + 1), rowLabels: row => PERMA_ROWS[row] ?? null,
    drill: 1.2, plated: true,
    pads: { top: { shape: 'round', size: 1.9304 }, bottom: { shape: 'round', size: 1.9304 } },
    surface: { top: 'white mask', bottom: 'bare' }, material: 'FR4', finish: 'gold',
    drilled: (_, row) => row in PERMA_ROWS,
    links: (column, row) => PERMA_RAILS.includes(row) ? [[column + 1, row]] : row === 7 || row === 14 ? [] : [[column, row + 1]],
    traceWidth: from => PERMA_RAILS.includes(from[1]) ? PERMA_RAIL_WIDTH : PERMA_STRIP_WIDTH,
    net: holes => {
      const [column, row] = holes[0] ?? [0, 0];
      if (PERMA_RAILS.includes(row)) return { id: `rail ${PERMA_ROWS[row]}`, kind: 'rail' };
      return { id: `strip ${column + 1}${row < 8 ? 'A-E' : 'F-J'}`, kind: 'strip' };
    },
    mountingHoles: mounting.map(x => ({ x, y: 25.4, d: 3.2, plated: false })),
  });
}

// --- Roth Elektronik laboratory cards ---------------------------------------------------------------------------------------
// Roth's drawing (the same for the RE200-HP, RE200-LF and RE212-HP) gives the card as 160.15 × 100.20 mm, 61 × 38 holes with
// 152.40 and 93.98 mm between the outer ones, 3.89 and 3.86 mm from the short edges and 3.15 and 3.07 mm from the long ones.
// It shows the copper side; seen from the component side (the bare side) left and right swap, so x0 = 3.86 and y0 = 3.15.

function rothCard(pad: number, material: 'FR4' | 'FR2', mask: boolean, linked: boolean): PrototypeBoardLayout {
  return layoutOf({
    grid: { x0: 3.86, y0: 3.15, pitch: PITCH, columns: 61, rows: 38 },
    outline: { L: 160.15, W: 100.2, t: 1.5, r: 0 },
    drill: 1, plated: false,
    pads: { top: null, bottom: { shape: 'round', size: pad } },
    surface: { top: 'bare', bottom: mask ? 'green mask' : 'bare' }, material, finish: material === 'FR4' ? 'tin' : 'copper',
    ...(linked ? {
      // every pad linked to its neighbours by thin traces; Roth gives no width: 0.3 mm, estimated
      links: (column: number, row: number): PrototypeBoardHoleRef[] => [[column + 1, row], [column, row + 1]],
      traceWidth: () => 0.3, net: () => ({ id: 'all pads', kind: 'linked' as const }),
    } : {}),
    mountingHoles: [],
  });
}

// --- BusBoard StripBoard Size1 ----------------------------------------------------------------------------------------------
// 80 × 50 mm, 31 × 19 holes; the 19 strips run the board's length (along X). The four Ø3.18 mounting holes are on the 0.1" grid,
// 2.800" × 1.600" apart, so they take grid positions (1, 1), (29, 1), (1, 17) and (29, 17): a 3.18 mm hole is wider than the
// strip, so its strip is broken there (as BusBoard's photograph shows), leaving one hole at each end on its own. BusBoard does
// not dimension the margins: the grid is centred on the board, as the mounting holes are.

const ST1_MOUNTING: PrototypeBoardHoleRef[] = [[1, 1], [29, 1], [1, 17], [29, 17]];
const ST1_STRIP = 2;

function stripBoard(doubleSided: boolean): PrototypeBoardLayout {
  const grid = { x0: round((80 - 30 * PITCH) / 2), y0: round((50 - 18 * PITCH) / 2), pitch: PITCH, columns: 31, rows: 19 };
  const mounting = (column: number, row: number) => ST1_MOUNTING.some(([c, r]) => c === column && r === row);
  return layoutOf({
    grid, outline: { L: 80, W: 50, t: 1.6, r: 0 },
    drill: 0.94, plated: doubleSided,
    pads: { top: doubleSided ? { shape: 'round', size: 1.8 } : null, bottom: { shape: 'square', size: ST1_STRIP } },
    surface: { top: 'bare', bottom: 'bare' }, material: 'FR4', finish: 'copper',
    drilled: (column, row) => !mounting(column, row),
    links: (column, row) => [[column + 1, row]],
    traceWidth: () => ST1_STRIP,
    net: holes => {
      const row = holes[0]?.[1] ?? 0; const whole = holes.length === grid.columns;
      return { id: whole ? `strip ${row + 1}` : `strip ${row + 1}, columns ${(holes[0]?.[0] ?? 0) + 1}-${(holes.at(-1)?.[0] ?? 0) + 1}`, kind: 'strip' };
    },
    mountingHoles: ST1_MOUNTING.map(([column, row]) => ({ x: round(grid.x0 + column * PITCH), y: round(grid.y0 + row * PITCH), d: 3.18, plated: false })),
  });
}

// --- Generic double-sided boards --------------------------------------------------------------------------------------------
// The green FR4 boards sold unbranded in 4 × 6, 5 × 7, 7 × 9 and 8 × 12 cm: no maker draws them. Their usual values: the hole
// counts sellers most often state (sellers differ), Ø1.0 mm plated holes in Ø1.8 mm round pads on both sides, 1.6 mm FR4, green
// mask, and an Ø2.0 mm mounting hole 2.5 mm from both edges in each corner; the grid centred on the board.

function generic(L: number, W: number, columns: number, rows: number): PrototypeBoardLayout {
  const inset = 2.5;
  return layoutOf({
    grid: { x0: round((L - (columns - 1) * PITCH) / 2), y0: round((W - (rows - 1) * PITCH) / 2), pitch: PITCH, columns, rows },
    outline: { L, W, t: 1.6, r: 0 },
    drill: 1, plated: true,
    pads: { top: { shape: 'round', size: 1.8 }, bottom: { shape: 'round', size: 1.8 } },
    surface: { top: 'green mask', bottom: 'green mask' }, material: 'FR4', finish: 'tin',
    mountingHoles: [[inset, inset], [L - inset, inset], [inset, W - inset], [L - inset, W - inset]].map(([x = 0, y = 0]) => ({ x, y, d: 2, plated: false })),
  });
}

const LAYOUTS: Record<string, PrototypeBoardLayout> = {
  'adafruit-perma-proto-quarter': permaProto(15, 43.18, [3.81, 39.37]),
  'adafruit-perma-proto-half': permaProto(30, 81.28, [3.81, 77.47]),
  'adafruit-perma-proto-full': permaProto(60, 157.48, [3.81, 78.74, 153.67]),
  'roth-re200-hp': rothCard(2.2, 'FR2', false, false),
  'roth-re200-lf': rothCard(2.2, 'FR4', false, false),
  'roth-re212-hp': rothCard(2.1, 'FR2', true, true),
  'busboard-st1': stripBoard(false),
  'busboard-st1-d': stripBoard(true),
  'generic-proto-board-40x60': generic(60, 40, 20, 14),
  'generic-proto-board-50x70': generic(70, 50, 24, 18),
  'generic-proto-board-70x90': generic(90, 70, 30, 24),
  'generic-proto-board-80x120': generic(120, 80, 42, 28),
};

/** The layout of a prototype board of the library (see `PrototypeBoardLayout`), or undefined for any other part. */
export function prototypeBoardLayout(part: Part): PrototypeBoardLayout | undefined {
  return part.family === 'prototype-board' ? LAYOUTS[part.id] : undefined;
}

// --- The parts --------------------------------------------------------------------------------------------------------------

const eagle = measured('manufacturer', 'adafruit-perma-proto-pcb');
const estimate = measured('estimated', 'canfactory-prototype-board-estimate');
type Source = (value: number) => Dimension;

/**
 * A board's dimensions from its layout, each from the source given for it (`all` for the rest); a dimension whose source is
 * `null` is left out.
 */
function dimensionsOf(layout: PrototypeBoardLayout, sources: Partial<Record<'L' | 'W' | 't' | 'r' | 'e' | 'x0' | 'y0' | 'd' | 'pad' | 'sw' | 'dm', Source | null>> & { all: Source }): Record<string, Dimension> {
  const values: Record<string, number | undefined> = {
    L: layout.outline.L, W: layout.outline.W, t: layout.outline.t, r: layout.outline.r || undefined, e: layout.grid.pitch,
    x0: layout.grid.x0, y0: layout.grid.y0, d: layout.drill,
    pad: [layout.pads.top, layout.pads.bottom].find(pad => pad?.shape === 'round')?.size,
    sw: layout.pads.bottom?.shape === 'square' ? layout.pads.bottom.size : undefined,
    dm: layout.mountingHoles[0]?.d,
  };
  const dimensions: Record<string, Dimension> = {};
  for (const [key, value] of Object.entries(values)) {
    const source = key in sources ? sources[key as keyof typeof sources] : sources.all;
    if (value !== undefined && source) dimensions[key] = source(value);
  }
  return dimensions;
}

const attributesOf = (layout: PrototypeBoardLayout, pattern: string, manufacturer: string): Record<string, string> => ({
  pattern, grid: `${layout.grid.columns} × ${layout.grid.rows}`, holes: String(layout.holes.length),
  plating: layout.plated ? 'plated through' : 'unplated',
  copper: layout.pads.top ? 'both sides' : 'one side',
  material: layout.material === 'FR2' ? 'FR2 (phenolic paper)' : 'FR4 (glass epoxy)',
  solderMask: [layout.surface.top, layout.surface.bottom].includes('white mask') ? 'white, top only'
    : layout.surface.top === 'green mask' ? 'green, both sides' : layout.surface.bottom === 'green mask' ? 'green, copper side' : 'none',
  manufacturer,
});

const layout = (id: string) => LAYOUTS[id] ?? (() => { throw new Error(`No layout for ${id}`); })();

const PERMA_NOTES = 'Every position is read from Adafruit’s EAGLE design (adafruit/Adafruit-Perma-Proto-PCB, CC BY-SA 3.0; only its values are used), whose vias and nets are the holes and their connections. The bottom has no solder mask (the strips can be cut); the top is white mask with the labels. Columns are numbered 1 to N along X and the rows lettered A–E and F–J along Y, as printed: hole (column, row) of the layout is printed as row letter and column number, so A1 is (0, 3). The rails are + outside the bottom pair (row 0) and inside the top pair (row 16), − in rows 1 and 17.';
const ROTH_NOTES = 'The drawing shows the copper side; the layout is seen from the component side (the bare one), so x0 is the drawing’s right margin (3.86 mm). Roth prints no labels on the grid and has no mounting holes. The holes are unplated: the copper and its pads are underneath only.';
const ST1_NOTES = 'The 19 strips run the board’s length (along X), one per row; the four mounting holes take grid positions (1, 1), (29, 1), (1, 17) and (29, 17) of BusBoard’s 31 × 19 (589-hole) grid, which leaves 585 holes and breaks strips 2 and 18 at the mounting holes. BusBoard dimensions the mounting holes’ spacing but not the margins, nor the copper: the grid is centred on the board (as the mounting holes are), and the strip width (2.0 mm) is read off BusBoard’s photograph. No silkscreen, so no labels.';
const GENERIC_NOTES = 'No maker publishes a drawing of these boards; sellers’ copies differ (in hole count, pad shape, mounting holes and whether the grid is lettered in copper), so every value is the usual one and `estimated`: count and measure your board, and correct a value under the same id. 1.6 mm FR4 with green mask on both sides and plated holes, as ProtoSupplies gives for its 8 × 12 cm board.';

const perma = (id: string, size: 'Quarter' | 'Half' | 'Full', product: string, url: string, page: Source, thickness: Source, columns: number): Part => {
  const l = layout(id);
  return {
    id, family: 'prototype-board', title: `Adafruit Perma-Proto ${size.toLowerCase()}-sized breadboard PCB`, designation: `Adafruit ${product}`,
    aliases: [`Perma-Proto ${size}-sized Breadboard PCB`, `Adafruit PID ${product}`],
    description: `Adafruit’s ${size.toLowerCase()}-sized Perma-Proto, ${l.outline.L} × ${l.outline.W} mm: a solderless breadboard’s layout as a gold-plated PCB, ${columns} columns of two 5-hole strips (A–E, F–J) and four power rails, ${l.holes.length} plated Ø1.2 mm holes and ${l.mountingHoles.length} Ø3.2 mm mounting holes.`,
    standard: null, product: { manufacturer: 'Adafruit Industries', sku: product, url },
    attributes: attributesOf(l, 'breadboard strips and rails', 'Adafruit'),
    dimensions: dimensionsOf(l, { all: eagle, t: thickness, d: page, dm: page }),
    sources: ['adafruit-perma-proto-pcb', `adafruit-${product}`, ...thickness === estimate ? ['canfactory-prototype-board-estimate'] : []],
    notes: `${PERMA_NOTES}${thickness === estimate ? ' Adafruit gives the half-sized board’s thickness and material nowhere; it is drawn as its quarter and full siblings are, 0.063" (1.6 mm) FR4.' : ''}`,
    preview: { kind: 'procedural' },
  };
};

const roth = (id: string, sku: string, source: string, pattern: string, description: string, notes: string): Part => {
  const l = layout(id); const datasheet = measured('manufacturer', source);
  return {
    id, family: 'prototype-board', title: `Roth Elektronik ${sku} laboratory card`, designation: `Roth Elektronik ${sku}`, aliases: [],
    description, standard: null, product: { manufacturer: 'Roth Elektronik', sku, url: `https://www.roth-elektronik.com/pdf/en_${sku}.pdf` },
    attributes: attributesOf(l, pattern, 'Roth Elektronik'),
    dimensions: dimensionsOf(l, { all: datasheet }),
    sources: [source], notes: `${ROTH_NOTES} ${notes}`, preview: { kind: 'procedural' },
  };
};

const busboard = (id: string, sku: string, source: string, description: string): Part => {
  const l = layout(id); const datasheet = measured('manufacturer', source);
  return {
    id, family: 'prototype-board', title: `BusBoard ${sku} stripboard`, designation: `BusBoard Prototype Systems ${sku}`, aliases: sku === 'ST1' ? ['StripBoard-1'] : [],
    description, standard: null, product: { manufacturer: 'BusBoard Prototype Systems', sku, url: `https://busboardcom.busboard.us/${sku}` },
    attributes: attributesOf(l, 'strips', 'BusBoard Prototype Systems'),
    dimensions: dimensionsOf(l, { all: datasheet, x0: estimate, y0: estimate, sw: estimate, pad: estimate }),
    sources: [source, 'canfactory-prototype-board-estimate'],
    notes: `${ST1_NOTES}${sku === 'ST1-D' ? ' The top has a round pad at every hole (BusBoard marks track ends with square ones; drawn round); its size (Ø1.8 mm) is read off the data sheet’s drawing.' : ' Single-sided: the strips are underneath and the holes unplated.'}`,
    preview: { kind: 'procedural' },
  };
};

const genericBoard = (id: string, cm: string): Part => {
  const l = layout(id); const source = id.endsWith('80x120') ? 'protosupplies-pcb-8x12' : null;
  const reference = source ? measured('estimated', source) : estimate;
  return {
    id, family: 'prototype-board', title: `Double-sided prototype PCB ${cm} cm (generic)`, designation: `Universal double-sided prototype PCB ${cm} cm, 2.54 mm`,
    aliases: [`${cm.replace(' × ', 'x')} cm perfboard`, 'green FR4 PTH prototype board'],
    description: `The generic green ${cm} cm double-sided board: ${l.grid.columns} × ${l.grid.rows} plated Ø1.0 mm holes in round pads on both sides of 1.6 mm FR4, with an Ø2 mm mounting hole in each corner.`,
    standard: null, product: { manufacturer: 'Generic (sold unbranded by many shops)', sku: `${cm} cm double-sided prototype PCB`, url: 'https://github.com/NNTin/CanFactory/blob/develop/docs/adding-parts.md#prototype-boards' },
    attributes: attributesOf(l, 'isolated pads', 'Generic'),
    dimensions: dimensionsOf(l, { all: estimate, t: reference, e: reference }),
    sources: ['canfactory-prototype-board-estimate', ...source ? [source] : []],
    notes: GENERIC_NOTES, preview: { kind: 'procedural' },
  };
};

export const prototypeBoardParts: Part[] = [
  perma('adafruit-perma-proto-quarter', 'Quarter', '1608', 'https://www.adafruit.com/product/1608', measured('manufacturer', 'adafruit-1608'), measured('manufacturer', 'adafruit-1608'), 15),
  perma('adafruit-perma-proto-half', 'Half', '1609', 'https://www.adafruit.com/product/1609', measured('manufacturer', 'adafruit-1609'), estimate, 30),
  perma('adafruit-perma-proto-full', 'Full', '1606', 'https://www.adafruit.com/product/1606', measured('manufacturer', 'adafruit-1606'), measured('manufacturer', 'adafruit-1606'), 60),
  roth('roth-re200-hp', 'RE200-HP', 'roth-re200-hp', 'isolated pads',
    'Roth Elektronik’s 100 × 160 mm (Eurocard) laboratory card of FR2 phenolic paper: 61 × 38 unplated Ø1.0 mm holes in isolated Ø2.2 mm pads, copper on one side with organic solder protection, no mounting holes.', ''),
  roth('roth-re200-lf', 'RE200-LF', 'roth-re200-lf', 'isolated pads',
    'Roth Elektronik’s 100 × 160 mm laboratory card of FR4 glass epoxy: the RE200-HP’s 61 × 38 isolated Ø2.2 mm pads and unplated Ø1.0 mm holes, hot-air levelled (lead-free).', ''),
  roth('roth-re212-hp', 'RE212-HP', 'roth-re212-hp', 'linked pads',
    'Roth Elektronik’s 100 × 160 mm FR2 card whose 61 × 38 Ø2.1 mm pads are all connected by thin horizontal and vertical traces, to be cut into a layout, under green solder mask.',
    'Every pad is linked to its four neighbours by a thin trace on the copper side, so the whole card is one net until traces are cut (`prototypeBoardConnections` with the cut traces left out gives the nets that remain). Roth gives no trace width: they are drawn 0.3 mm wide.'),
  busboard('busboard-st1', 'ST1', 'busboard-st1',
    'BusBoard’s single-sided 80 × 50 mm FR4 stripboard (Size1): 19 uncut copper strips along its length, 31 holes of Ø0.94 mm each, unplated, with four Ø3.18 mm mounting holes on the grid.'),
  busboard('busboard-st1-d', 'ST1-D', 'busboard-st1-d',
    'BusBoard’s double-sided 80 × 50 mm FR4 stripboard (Size1): 19 strips underneath and a pad at every hole on top, Ø0.94 mm plated holes, four unplated Ø3.18 mm mounting holes on the grid.'),
  genericBoard('generic-proto-board-40x60', '4 × 6'),
  genericBoard('generic-proto-board-50x70', '5 × 7'),
  genericBoard('generic-proto-board-70x90', '7 × 9'),
  genericBoard('generic-proto-board-80x120', '8 × 12'),
];
