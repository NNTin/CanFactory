import type { Dimension, Part, PartFamily } from './schema.ts';
import { measured } from './sources.ts';

export const screwFamily: PartFamily = {
  id: 'screw', title: 'Screws',
  description: 'Metric machine screws by standard, thread size and length: socket head, button head, countersunk, hexagon head and pan head.',
  attributes: [
    { key: 'thread', label: 'Thread' }, { key: 'head', label: 'Head' }, { key: 'drive', label: 'Drive' },
    { key: 'standard', label: 'Standard' }, { key: 'length', label: 'Length' },
  ],
  dimensions: [
    { key: 'd', label: 'Thread diameter', symbol: 'd', required: true },
    { key: 'pitch', label: 'Thread pitch', symbol: 'P', required: true },
    { key: 'l', label: 'Length', symbol: 'l', required: true },
    { key: 'dk', label: 'Head diameter', symbol: 'dk', required: false },
    { key: 'k', label: 'Head height', symbol: 'k', required: true },
    { key: 's', label: 'Drive size (hex key) or width across flats', symbol: 's', required: false },
    { key: 'e', label: 'Width across corners', symbol: 'e', required: false },
    { key: 't', label: 'Socket depth', symbol: 't', required: false },
    { key: 'b', label: 'Thread length (longer screws)', symbol: 'b', required: false },
  ],
};

type Head = 'socket-cap' | 'button' | 'countersunk' | 'hex' | 'pan';
interface ScrewRow {
  thread: string; pitch: number; lengths: number[];
  dimensions: Record<string, [value: number, min?: number | null, max?: number | null]>;
  drive: string;
}
interface ScrewStandard {
  source: string; reference: string; code: string; head: Head; name: string; aliases: (thread: string, l: number) => string[];
  rows: ScrewRow[]; describe: (row: ScrewRow, l: number) => string; notes: string | null;
  /** The title before the size, when the head's own name would not tell it apart from another standard's. */
  title?: string;
}

const HEAD_TEXT: Record<Head, string> = {
  'socket-cap': 'Socket head cap screw', button: 'Button head screw', countersunk: 'Countersunk head screw', hex: 'Hexagon head screw', pan: 'Pan head screw',
};
const LENGTHS_NOTE = 'The lengths listed are common trade lengths within the range of the standard, not every length it allows.';

/** The table of one standard: one row per thread size, expanded into one part per length. */
function screws(standard: ScrewStandard): Part[] {
  const dimension = measured('standard', standard.reference);
  return standard.rows.flatMap(row => row.lengths.map((l): Part => {
    const dimensions: Record<string, Dimension> = {
      d: dimension(Number(row.thread.slice(1))), pitch: dimension(row.pitch), l: dimension(l),
      ...Object.fromEntries(Object.entries(row.dimensions).map(([key, [value, min = null, max = null]]) => [key, dimension(value, min, max)])),
    };
    const size = `${row.thread} × ${l}`;
    return {
      id: `${standard.code}-${row.thread.toLowerCase().replace('.', '-')}x${l}`,
      family: 'screw', title: `${standard.title ?? HEAD_TEXT[standard.head]} ${size}`, designation: `${standard.name} ${size}`,
      aliases: standard.aliases(row.thread, l), description: standard.describe(row, l),
      standard: standard.source, product: null,
      attributes: { thread: row.thread, head: standard.head, drive: row.drive, standard: standard.name, length: `${l} mm` },
      dimensions, sources: [standard.source, standard.reference, 'iso-261'], notes: standard.notes, preview: { kind: 'procedural' },
    };
  }));
}

// ISO 4762: P, b (ref.), dk max/min, k max/min, s nominal, t min.
const iso4762 = screws({
  source: 'iso-4762', reference: 'fasteners-eu-iso-4762', code: 'iso-4762', head: 'socket-cap', name: 'ISO 4762',
  aliases: (thread, l) => [`DIN 912 ${thread}x${l}`],
  describe: (row, l) => `An ${row.thread} socket head cap screw, ${l} mm long under its cylindrical ${row.dimensions['dk']?.[0]} mm head, driven with a ${row.dimensions['s']?.[0]} mm hex key (ISO 4762, formerly DIN 912).`,
  notes: `b is the thread length of the longer screws; short ones are threaded to the head. ${LENGTHS_NOTE}`,
  rows: [
    { thread: 'M2', pitch: 0.4, lengths: [4, 5, 6, 8, 10, 12, 16, 20], drive: 'hex socket 1.5', dimensions: { b: [16], dk: [3.8, 3.62, 3.8], k: [2, 1.86, 2], s: [1.5], t: [1, 1] } },
    { thread: 'M2.5', pitch: 0.45, lengths: [4, 5, 6, 8, 10, 12, 16, 20, 25], drive: 'hex socket 2', dimensions: { b: [17], dk: [4.5, 4.32, 4.5], k: [2.5, 2.36, 2.5], s: [2], t: [1.1, 1.1] } },
    { thread: 'M3', pitch: 0.5, lengths: [5, 6, 8, 10, 12, 14, 16, 20, 25, 30], drive: 'hex socket 2.5', dimensions: { b: [18], dk: [5.5, 5.32, 5.5], k: [3, 2.86, 3], s: [2.5], t: [1.3, 1.3] } },
    { thread: 'M4', pitch: 0.7, lengths: [6, 8, 10, 12, 16, 20, 25, 30, 35, 40], drive: 'hex socket 3', dimensions: { b: [20], dk: [7, 6.78, 7], k: [4, 3.82, 4], s: [3], t: [2, 2] } },
    { thread: 'M5', pitch: 0.8, lengths: [8, 10, 12, 16, 20, 25, 30, 35, 40, 50], drive: 'hex socket 4', dimensions: { b: [22], dk: [8.5, 8.28, 8.5], k: [5, 4.82, 5], s: [4], t: [2.5, 2.5] } },
    { thread: 'M6', pitch: 1, lengths: [10, 12, 16, 20, 25, 30, 35, 40, 50, 60], drive: 'hex socket 5', dimensions: { b: [24], dk: [10, 9.78, 10], k: [6, 5.7, 6], s: [5], t: [3, 3] } },
    { thread: 'M8', pitch: 1.25, lengths: [12, 16, 20, 25, 30, 35, 40, 50, 60, 70, 80], drive: 'hex socket 6', dimensions: { b: [28], dk: [13, 12.73, 13], k: [8, 7.64, 8], s: [6], t: [4, 4] } },
  ],
});

// ISO 7380-1: P, b (ref.), dk max/min, k max/min, s nominal, t min. The standard starts at M3.
const iso7380 = screws({
  source: 'iso-7380-1', reference: 'fasteners-eu-iso-7380', code: 'iso-7380', head: 'button', name: 'ISO 7380-1',
  aliases: () => [],
  describe: (row, l) => `An ${row.thread} button head screw, ${l} mm long under its low, domed ${row.dimensions['dk']?.[0]} mm head, driven with a ${row.dimensions['s']?.[0]} mm hex key (ISO 7380-1).`,
  notes: LENGTHS_NOTE,
  rows: [
    { thread: 'M3', pitch: 0.5, lengths: [6, 8, 10, 12, 16], drive: 'hex socket 2', dimensions: { b: [18], dk: [5.7, 5.4, 5.7], k: [1.65, 1.4, 1.65], s: [2, 2.02, 2.08], t: [1.04, 1.04] } },
    { thread: 'M4', pitch: 0.7, lengths: [6, 8, 10, 12, 16, 20], drive: 'hex socket 2.5', dimensions: { b: [20], dk: [7.6, 7.24, 7.6], k: [2.2, 1.95, 2.2], s: [2.5, 2.52, 2.58], t: [1.3, 1.3] } },
    { thread: 'M5', pitch: 0.8, lengths: [8, 10, 12, 16, 20, 25], drive: 'hex socket 3', dimensions: { b: [22], dk: [9.5, 9.14, 9.5], k: [2.75, 2.5, 2.75], s: [3, 3.02, 3.08], t: [1.56, 1.56] } },
    { thread: 'M6', pitch: 1, lengths: [10, 12, 16, 20, 25, 30], drive: 'hex socket 4', dimensions: { b: [24], dk: [10.5, 10.07, 10.5], k: [3.3, 3, 3.3], s: [4, 4.02, 4.095], t: [2.08, 2.08] } },
    { thread: 'M8', pitch: 1.25, lengths: [12, 16, 20, 25, 30, 40], drive: 'hex socket 5', dimensions: { b: [28], dk: [14, 13.57, 14], k: [4.4, 4.1, 4.4], s: [5, 5.02, 5.14], t: [2.6, 2.6] } },
  ],
});

// ISO 10642: P, b (l ≤ 125 mm), dk nominal = max / min, k max, s nominal / min / max, t max / min. The length includes the head.
const iso10642 = screws({
  source: 'iso-10642', reference: 'fasteners-eu-iso-10642', code: 'iso-10642', head: 'countersunk', name: 'ISO 10642',
  aliases: (thread, l) => [`DIN 7991 ${thread}x${l}`],
  describe: (row, l) => `An ${row.thread} countersunk screw, ${l} mm long including its 90° cone head of ${row.dimensions['dk']?.[0]} mm, which sits flush in a countersink; driven with a ${row.dimensions['s']?.[0]} mm hex key (ISO 10642, formerly DIN 7991).`,
  notes: `The length of a countersunk screw includes the head. ${LENGTHS_NOTE}`,
  rows: [
    { thread: 'M3', pitch: 0.5, lengths: [8, 10, 12, 16, 20, 25, 30], drive: 'hex socket 2', dimensions: { b: [12], dk: [6, 5.7, 6], k: [1.7, null, 1.7], s: [2, 2.02, 2.1], t: [1.2, 0.95, 1.2] } },
    { thread: 'M4', pitch: 0.7, lengths: [8, 10, 12, 16, 20, 25, 30, 40], drive: 'hex socket 2.5', dimensions: { b: [14], dk: [8, 7.64, 8], k: [2.3, null, 2.3], s: [2.5, 2.52, 2.6], t: [1.8, 1.5, 1.8] } },
    { thread: 'M5', pitch: 0.8, lengths: [8, 10, 12, 16, 20, 25, 30, 40, 50], drive: 'hex socket 3', dimensions: { b: [16], dk: [10, 9.64, 10], k: [2.8, null, 2.8], s: [3, 3.02, 3.1], t: [2.3, 2.05, 2.3] } },
    { thread: 'M6', pitch: 1, lengths: [10, 12, 16, 20, 25, 30, 40, 50, 60], drive: 'hex socket 4', dimensions: { b: [18], dk: [12, 11.57, 12], k: [3.3, null, 3.3], s: [4, 4.02, 4.12], t: [2.5, 2.25, 2.5] } },
    { thread: 'M8', pitch: 1.25, lengths: [12, 16, 20, 25, 30, 40, 50, 60, 80], drive: 'hex socket 5', dimensions: { b: [22], dk: [16, 15.57, 16], k: [4.4, null, 4.4], s: [5, 5.02, 5.14], t: [3.5, 3.2, 3.5] } },
  ],
});

// ISO 4017, product grade A: P, s nominal = max / min, e min, k nominal / max / min. Threaded to the head.
const iso4017 = screws({
  source: 'iso-4017', reference: 'fasteners-eu-iso-4017', code: 'iso-4017', head: 'hex', name: 'ISO 4017',
  aliases: (thread, l) => [`DIN 933 ${thread}x${l}`],
  describe: (row, l) => `An ${row.thread} hexagon head screw, ${l} mm long and threaded all the way to its hexagon head, turned with a ${row.dimensions['s']?.[0]} mm spanner (ISO 4017, formerly DIN 933).`,
  notes: `Threaded to the head. Product grade A tolerances. ${LENGTHS_NOTE}`,
  rows: [
    { thread: 'M2', pitch: 0.4, lengths: [4, 6, 8, 10, 12], drive: 'external hex 4', dimensions: { s: [4, 3.82, 4], e: [4.32, 4.32], k: [1.4, 1.275, 1.525] } },
    { thread: 'M2.5', pitch: 0.45, lengths: [5, 6, 8, 10, 12, 16], drive: 'external hex 5', dimensions: { s: [5, 4.82, 5], e: [5.45, 5.45], k: [1.7, 1.575, 1.825] } },
    { thread: 'M3', pitch: 0.5, lengths: [6, 8, 10, 12, 16, 20, 25, 30], drive: 'external hex 5.5', dimensions: { s: [5.5, 5.32, 5.5], e: [6.01, 6.01], k: [2, 1.875, 2.125] } },
    { thread: 'M4', pitch: 0.7, lengths: [8, 10, 12, 16, 20, 25, 30, 40], drive: 'external hex 7', dimensions: { s: [7, 6.78, 7], e: [7.66, 7.66], k: [2.8, 2.675, 2.925] } },
    { thread: 'M5', pitch: 0.8, lengths: [10, 12, 16, 20, 25, 30, 40, 50], drive: 'external hex 8', dimensions: { s: [8, 7.78, 8], e: [8.79, 8.79], k: [3.5, 3.35, 3.65] } },
    { thread: 'M6', pitch: 1, lengths: [12, 16, 20, 25, 30, 40, 50, 60], drive: 'external hex 10', dimensions: { s: [10, 9.78, 10], e: [11.05, 11.05], k: [4, 3.85, 4.15] } },
    { thread: 'M8', pitch: 1.25, lengths: [16, 20, 25, 30, 40, 50, 60, 80], drive: 'external hex 13', dimensions: { s: [13, 12.73, 13], e: [14.38, 14.38], k: [5.3, 5.15, 5.45] } },
  ],
});

// ISO 7045: P, b, dk nominal = max / min, k nominal / max / min, cross recess number (type H).
const iso7045 = screws({
  source: 'iso-7045', reference: 'fasteners-eu-iso-7045', code: 'iso-7045', head: 'pan', name: 'ISO 7045',
  aliases: (thread, l) => [`DIN 7985 ${thread}x${l}`],
  describe: (row, l) => `An ${row.thread} pan head screw, ${l} mm long under its rounded ${row.dimensions['dk']?.[0]} mm head, with a Phillips (type H) cross recess, ${row.drive.replace('cross recess ', 'size ')} (ISO 7045, replacing DIN 7985).`,
  notes: LENGTHS_NOTE,
  rows: [
    { thread: 'M2', pitch: 0.4, lengths: [3, 4, 5, 6, 8, 10, 12, 16], drive: 'cross recess PH1', dimensions: { dk: [4, 3.7, 4], k: [1.6, 1.48, 1.72] } },
    { thread: 'M2.5', pitch: 0.45, lengths: [4, 5, 6, 8, 10, 12, 16, 20], drive: 'cross recess PH1', dimensions: { dk: [5, 4.7, 5], k: [2, 1.88, 2.12] } },
    { thread: 'M3', pitch: 0.5, lengths: [4, 5, 6, 8, 10, 12, 16, 20, 25, 30], drive: 'cross recess PH1', dimensions: { dk: [6, 5.7, 6], k: [2.4, 2.28, 2.52] } },
    { thread: 'M4', pitch: 0.7, lengths: [5, 6, 8, 10, 12, 16, 20, 25, 30, 40], drive: 'cross recess PH2', dimensions: { dk: [8, 7.64, 8], k: [3.1, 2.95, 3.25] } },
    { thread: 'M5', pitch: 0.8, lengths: [6, 8, 10, 12, 16, 20, 25, 30, 40, 50], drive: 'cross recess PH2', dimensions: { dk: [10, 9.64, 10], k: [3.8, 3.65, 3.95] } },
    { thread: 'M6', pitch: 1, lengths: [8, 10, 12, 16, 20, 25, 30, 40, 50, 60], drive: 'cross recess PH3', dimensions: { dk: [12, 11.57, 12], k: [4.6, 4.45, 4.75] } },
    { thread: 'M8', pitch: 1.25, lengths: [10, 12, 16, 20, 25, 30, 40, 50, 60], drive: 'cross recess PH4', dimensions: { dk: [16, 15.57, 16], k: [6, 5.85, 6.15] } },
  ],
});

// ISO 7046-1: P, b min, dk nominal = max / min (the actual head, not the theoretical sharp edge), k max, cross recess number
// (type H). The length includes the head. fasteners.eu prints the table for ISO 7046 (parts 1 and 2 share the dimensions).
const iso7046 = screws({
  source: 'iso-7046-1', reference: 'fasteners-eu-iso-7046', code: 'iso-7046', head: 'countersunk', name: 'ISO 7046-1', title: 'Cross-recessed countersunk screw',
  aliases: (thread, l) => [`DIN 965 ${thread}x${l}`],
  describe: (row, l) => `An ${row.thread} countersunk flat head screw with a Phillips (type H) cross recess, ${row.drive.replace('cross recess ', 'size ')}, ${l} mm long including its 90° cone head of ${row.dimensions['dk']?.[0]} mm, which sits flush in a countersink (ISO 7046-1, replacing DIN 965).`,
  notes: `The length of a countersunk screw includes the head. dk is the actual head diameter; the countersink's theoretical sharp edge is larger. Screws shorter than b are threaded to the head. ${LENGTHS_NOTE}`,
  rows: [
    { thread: 'M2', pitch: 0.4, lengths: [3, 4, 5, 6, 8, 10, 12, 16, 20], drive: 'cross recess PH1', dimensions: { b: [16], dk: [3.8, 3.5, 3.8], k: [1.2, null, 1.2] } },
    { thread: 'M2.5', pitch: 0.45, lengths: [3, 4, 5, 6, 8, 10, 12, 16, 20, 25], drive: 'cross recess PH1', dimensions: { b: [18], dk: [4.7, 4.4, 4.7], k: [1.5, null, 1.5] } },
    { thread: 'M3', pitch: 0.5, lengths: [4, 5, 6, 8, 10, 12, 16, 20, 25, 30], drive: 'cross recess PH1', dimensions: { b: [19], dk: [5.6, 5.3, 5.6], k: [1.65, null, 1.65] } },
    { thread: 'M4', pitch: 0.7, lengths: [5, 6, 8, 10, 12, 16, 20, 25, 30, 40], drive: 'cross recess PH2', dimensions: { b: [22], dk: [7.5, 7.14, 7.5], k: [2.2, null, 2.2] } },
    { thread: 'M5', pitch: 0.8, lengths: [6, 8, 10, 12, 16, 20, 25, 30, 40, 50], drive: 'cross recess PH2', dimensions: { b: [25], dk: [9.2, 8.84, 9.2], k: [2.5, null, 2.5] } },
    { thread: 'M6', pitch: 1, lengths: [8, 10, 12, 16, 20, 25, 30, 40, 50], drive: 'cross recess PH3', dimensions: { b: [28], dk: [11, 10.57, 11], k: [3, null, 3] } },
    { thread: 'M8', pitch: 1.25, lengths: [10, 12, 16, 20, 25, 30, 40, 50, 55], drive: 'cross recess PH4', dimensions: { b: [34], dk: [14.5, 14.07, 14.5], k: [4, null, 4] } },
  ],
});

export const screwParts: Part[] = [...iso4762, ...iso7380, ...iso10642, ...iso4017, ...iso7045, ...iso7046];
