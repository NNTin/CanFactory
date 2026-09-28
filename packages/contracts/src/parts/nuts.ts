import type { Part, PartFamily } from './schema.ts';
import { measured } from './sources.ts';

export const nutFamily: PartFamily = {
  id: 'nut', title: 'Nuts',
  description: 'Metric nuts: regular and thin hexagon nuts, nylon-insert lock nuts, and square nuts that sit in a printed slot.',
  attributes: [{ key: 'thread', label: 'Thread' }, { key: 'shape', label: 'Shape' }, { key: 'standard', label: 'Standard' }],
  dimensions: [
    { key: 'd', label: 'Thread diameter', symbol: 'd', required: true },
    { key: 'pitch', label: 'Thread pitch', symbol: 'P', required: true },
    { key: 's', label: 'Width across flats', symbol: 's', required: true },
    { key: 'e', label: 'Width across corners', symbol: 'e', required: false },
    { key: 'm', label: 'Height (thread)', symbol: 'm', required: true },
    { key: 'h', label: 'Overall height (with the nylon insert)', symbol: 'h', required: false },
    { key: 'dw', label: 'Bearing face diameter', symbol: 'dw', required: false },
  ],
};

type Shape = 'hex' | 'hex-thin' | 'hex-nyloc' | 'square' | 'square-thin';
type Value = [value: number, min?: number | null, max?: number | null];
interface NutRow { thread: string; pitch: number; dimensions: Record<string, Value> }
interface NutStandard {
  source: string; references: string[]; code: string; shape: Shape; name: string; aliases: (thread: string) => string[];
  title: string; describe: (row: NutRow) => string; notes: string | null; rows: NutRow[];
}

function nuts(standard: NutStandard): Part[] {
  const dimension = measured('standard', standard.references[0] ?? standard.source);
  return standard.rows.map((row): Part => ({
    id: `${standard.code}-${row.thread.toLowerCase().replace('.', '-')}`,
    family: 'nut', title: `${standard.title} ${row.thread}`, designation: `${standard.name} ${row.thread}`, aliases: standard.aliases(row.thread),
    description: standard.describe(row), standard: standard.source, product: null,
    attributes: { thread: row.thread, shape: standard.shape, standard: standard.name },
    dimensions: {
      d: dimension(Number(row.thread.slice(1))), pitch: dimension(row.pitch),
      ...Object.fromEntries(Object.entries(row.dimensions).map(([key, [value, min = null, max = null]]) => [key, dimension(value, min, max)])),
    },
    sources: [standard.source, ...standard.references, 'iso-261'], notes: standard.notes, preview: { kind: 'procedural' },
  }));
}

// ISO 4032: P, s max/min, e min, m max/min, dw min.
const iso4032 = nuts({
  source: 'iso-4032', references: ['fasteners-eu-iso-4032'], code: 'iso-4032', shape: 'hex', name: 'ISO 4032', title: 'Hexagon nut',
  aliases: thread => [`DIN 934 ${thread}`], notes: null,
  describe: row => `A regular ${row.thread} hexagon nut, ${row.dimensions['s']?.[0]} mm across the flats and ${row.dimensions['m']?.[0]} mm high (ISO 4032, replacing DIN 934).`,
  rows: [
    { thread: 'M2', pitch: 0.4, dimensions: { s: [4, 3.82, 4], e: [4.32, 4.32], m: [1.6, 1.35, 1.6], dw: [3.1, 3.1] } },
    { thread: 'M2.5', pitch: 0.45, dimensions: { s: [5, 4.82, 5], e: [5.45, 5.45], m: [2, 1.75, 2], dw: [4.1, 4.1] } },
    { thread: 'M3', pitch: 0.5, dimensions: { s: [5.5, 5.32, 5.5], e: [6.01, 6.01], m: [2.4, 2.15, 2.4], dw: [4.6, 4.6] } },
    { thread: 'M4', pitch: 0.7, dimensions: { s: [7, 6.78, 7], e: [7.66, 7.66], m: [3.2, 2.9, 3.2], dw: [5.9, 5.9] } },
    { thread: 'M5', pitch: 0.8, dimensions: { s: [8, 7.78, 8], e: [8.79, 8.79], m: [4.7, 4.4, 4.7], dw: [6.9, 6.9] } },
    { thread: 'M6', pitch: 1, dimensions: { s: [10, 9.78, 10], e: [11.05, 11.05], m: [5.2, 4.9, 5.2], dw: [8.9, 8.9] } },
    { thread: 'M8', pitch: 1.25, dimensions: { s: [13, 12.73, 13], e: [14.38, 14.38], m: [6.8, 6.44, 6.8], dw: [11.6, 11.6] } },
  ],
});

// ISO 4035: P, s max/min, e min, m max/min, dw min.
const iso4035 = nuts({
  source: 'iso-4035', references: ['fasteners-eu-iso-4035'], code: 'iso-4035', shape: 'hex-thin', name: 'ISO 4035', title: 'Thin hexagon nut',
  aliases: thread => [`DIN 439 ${thread}`],
  notes: 'The reference table prints the M3 pitch as 0.45 mm and the M5 width across corners as 9.79 mm; the M3 coarse pitch is 0.5 mm (ISO 261) and the M5 value is 8.79 mm, as for the same hexagon in ISO 4032.',
  describe: row => `A thin ${row.thread} hexagon nut (jam nut), ${row.dimensions['s']?.[0]} mm across the flats but only ${row.dimensions['m']?.[0]} mm high, for locking another nut or where there is little room (ISO 4035, replacing DIN 439).`,
  rows: [
    { thread: 'M2', pitch: 0.4, dimensions: { s: [4, 3.82, 4], e: [4.32, 4.32], m: [1.2, 0.95, 1.2], dw: [3.1, 3.1] } },
    { thread: 'M2.5', pitch: 0.45, dimensions: { s: [5, 4.82, 5], e: [5.45, 5.45], m: [1.6, 1.35, 1.6], dw: [4.1, 4.1] } },
    { thread: 'M3', pitch: 0.5, dimensions: { s: [5.5, 5.32, 5.5], e: [6.01, 6.01], m: [1.8, 1.55, 1.8], dw: [4.6, 4.6] } },
    { thread: 'M4', pitch: 0.7, dimensions: { s: [7, 6.78, 7], e: [7.66, 7.66], m: [2.2, 1.95, 2.2], dw: [5.9, 5.9] } },
    { thread: 'M5', pitch: 0.8, dimensions: { s: [8, 7.78, 8], e: [8.79, 8.79], m: [2.7, 2.45, 2.7], dw: [6.9, 6.9] } },
    { thread: 'M6', pitch: 1, dimensions: { s: [10, 9.78, 10], e: [11.05, 11.05], m: [3.2, 2.9, 3.2], dw: [8.9, 8.9] } },
    { thread: 'M8', pitch: 1.25, dimensions: { s: [13, 12.73, 13], e: [14.38, 14.38], m: [4, 3.7, 4], dw: [11.6, 11.6] } },
  ],
});

// ISO 10511: P, s nominal = max / min, e min, h nominal = max / min, m min (the threaded part), dw min. The standard starts at M3.
const iso10511 = nuts({
  source: 'iso-10511', references: ['fasteners-eu-iso-10511'], code: 'iso-10511', shape: 'hex-nyloc', name: 'ISO 10511', title: 'Nylon-insert lock nut',
  aliases: thread => [`DIN 985 ${thread}`], notes: '`m` is the minimum height of the threaded steel part; `h` includes the nylon insert.',
  describe: row => `An ${row.thread} lock nut with a nylon ring that grips the thread, ${row.dimensions['s']?.[0]} mm across the flats and ${row.dimensions['h']?.[0]} mm high overall (ISO 10511, formerly DIN 985).`,
  rows: [
    { thread: 'M3', pitch: 0.5, dimensions: { s: [5.5, 5.32, 5.5], e: [6.01, 6.01], h: [4, 3.7, 4], m: [2.4, 2.4], dw: [4.6, 4.6] } },
    { thread: 'M4', pitch: 0.7, dimensions: { s: [7, 6.78, 7], e: [7.66, 7.66], h: [5, 4.7, 5], m: [2.9, 2.9], dw: [5.9, 5.9] } },
    { thread: 'M5', pitch: 0.8, dimensions: { s: [8, 7.78, 8], e: [8.79, 8.79], h: [5, 4.7, 5], m: [3.2, 3.2], dw: [6.9, 6.9] } },
    { thread: 'M6', pitch: 1, dimensions: { s: [10, 9.78, 10], e: [11.05, 11.05], h: [6, 5.7, 6], m: [4, 4], dw: [8.9, 8.9] } },
    { thread: 'M8', pitch: 1.25, dimensions: { s: [13, 12.73, 13], e: [14.38, 14.38], h: [8, 7.64, 8], m: [5.5, 5.5], dw: [11.6, 11.6] } },
  ],
});

// DIN 562: s (nominal), m max. The two published tables disagree on the minimum height, so only the maximum is given.
const din562 = nuts({
  source: 'din-562', references: ['fasteners-eu-din-562', 'globalfastener-din-562'], code: 'din-562', shape: 'square-thin', name: 'DIN 562', title: 'Thin square nut',
  aliases: () => [],
  notes: 'The two published tables of DIN 562 used here agree on the width and the greatest height, but not on the least height (for M3: 1.6 or 1.4 mm), so only the greatest height is given. Size a slot for the greatest height.',
  describe: row => `A thin ${row.thread} square nut, ${row.dimensions['s']?.[0]} mm square and ${row.dimensions['m']?.[0]} mm high. It cannot turn in a square slot, so it is the usual captive nut in printed parts (DIN 562).`,
  rows: [
    { thread: 'M2', pitch: 0.4, dimensions: { s: [4], m: [1.2, null, 1.2] } },
    { thread: 'M2.5', pitch: 0.45, dimensions: { s: [5], m: [1.6, null, 1.6] } },
    { thread: 'M3', pitch: 0.5, dimensions: { s: [5.5], m: [1.8, null, 1.8] } },
    { thread: 'M4', pitch: 0.7, dimensions: { s: [7], m: [2.2, null, 2.2] } },
    { thread: 'M5', pitch: 0.8, dimensions: { s: [8], m: [2.7, null, 2.7] } },
    { thread: 'M6', pitch: 1, dimensions: { s: [10], m: [3.2, null, 3.2] } },
    { thread: 'M8', pitch: 1.25, dimensions: { s: [13], m: [4, null, 4] } },
  ],
});

// DIN 557: P, s nominal = max / min, e min, m nominal = max / min, dw min. The standard starts at M5.
const din557 = nuts({
  source: 'din-557', references: ['fasteners-eu-din-557'], code: 'din-557', shape: 'square', name: 'DIN 557', title: 'Square nut',
  aliases: () => [], notes: null,
  describe: row => `A regular ${row.thread} square nut, ${row.dimensions['s']?.[0]} mm square and ${row.dimensions['m']?.[0]} mm high (DIN 557).`,
  rows: [
    { thread: 'M5', pitch: 0.8, dimensions: { s: [8, 7.64, 8], e: [9.93, 9.93, 11.3], m: [4, 3.52, 4], dw: [6.7, 6.7] } },
    { thread: 'M6', pitch: 1, dimensions: { s: [10, 9.64, 10], e: [12.53, 12.53, 14.1], m: [5, 4.52, 5], dw: [8.7, 8.7] } },
    { thread: 'M8', pitch: 1.25, dimensions: { s: [13, 12.57, 13], e: [16.34, 16.34, 18.4], m: [6.5, 5.92, 6.5], dw: [11.5, 11.5] } },
  ],
});

export const nutParts: Part[] = [...iso4032, ...iso4035, ...iso10511, ...din562, ...din557];
