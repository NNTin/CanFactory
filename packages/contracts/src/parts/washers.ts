import type { Part, PartFamily } from './schema.ts';
import { measured } from './sources.ts';

export const washerFamily: PartFamily = {
  id: 'washer', title: 'Washers',
  description: 'Plain metric washers in the normal and large series, flat or chamfered.',
  attributes: [{ key: 'thread', label: 'For thread' }, { key: 'series', label: 'Series' }, { key: 'standard', label: 'Standard' }],
  dimensions: [
    { key: 'd1', label: 'Inner diameter (hole)', symbol: 'd1', required: true },
    { key: 'd2', label: 'Outer diameter', symbol: 'd2', required: true },
    { key: 'h', label: 'Thickness', symbol: 'h', required: true },
  ],
};

/** [thread, d1 min, d1 max, d2 max, d2 min, h nominal, h max, h min]; d1's nominal is its minimum and d2's its maximum. */
type Row = [thread: string, d1Min: number, d1Max: number, d2Max: number, d2Min: number, h: number, hMax: number, hMin: number];
interface WasherStandard { source: string; reference: string; code: string; name: string; series: string; title: string; aliases: (thread: string) => string[]; describe: (row: Row) => string; rows: Row[] }

function washers(standard: WasherStandard): Part[] {
  const dimension = measured('standard', standard.reference);
  return standard.rows.map((row): Part => {
    const [thread, d1Min, d1Max, d2Max, d2Min, h, hMax, hMin] = row;
    return {
      id: `${standard.code}-${thread.toLowerCase().replace('.', '-')}`, family: 'washer',
      title: `${standard.title} ${thread}`, designation: `${standard.name} ${thread}`, aliases: standard.aliases(thread),
      description: standard.describe(row), standard: standard.source, product: null,
      attributes: { thread, series: standard.series, standard: standard.name },
      dimensions: { d1: dimension(d1Min, d1Min, d1Max), d2: dimension(d2Max, d2Min, d2Max), h: dimension(h, hMin, hMax) },
      sources: [standard.source, standard.reference], notes: null, preview: { kind: 'procedural' },
    };
  });
}

const iso7089 = washers({
  source: 'iso-7089', reference: 'fasteners-eu-iso-7089', code: 'iso-7089', name: 'ISO 7089', series: 'normal', title: 'Plain washer',
  aliases: thread => [`DIN 125-A ${thread}`],
  describe: ([thread, d1, , d2, , h]) => `A plain flat washer for ${thread} screws: a ${d1} mm hole, ${d2} mm across and ${h} mm thick (ISO 7089, formerly DIN 125-A).`,
  rows: [
    ['M2', 2.2, 2.34, 5, 4.7, 0.3, 0.35, 0.25], ['M2.5', 2.7, 2.84, 6, 5.7, 0.5, 0.55, 0.45], ['M3', 3.2, 3.38, 7, 6.64, 0.5, 0.55, 0.45],
    ['M4', 4.3, 4.48, 9, 8.64, 0.8, 0.9, 0.7], ['M5', 5.3, 5.48, 10, 9.64, 1, 1.1, 0.9], ['M6', 6.4, 6.62, 12, 11.57, 1.6, 1.8, 1.4],
    ['M8', 8.4, 8.62, 16, 15.57, 1.6, 1.8, 1.4],
  ],
});

// ISO 7090 is ISO 7089 with a chamfered outer edge; the standard starts at M5.
const iso7090 = washers({
  source: 'iso-7090', reference: 'fasteners-eu-iso-7090', code: 'iso-7090', name: 'ISO 7090', series: 'normal, chamfered', title: 'Chamfered plain washer',
  aliases: thread => [`DIN 125-B ${thread}`],
  describe: ([thread, d1, , d2, , h]) => `A plain washer for ${thread} screws with a chamfered outer edge: a ${d1} mm hole, ${d2} mm across and ${h} mm thick (ISO 7090, formerly DIN 125-B).`,
  rows: [['M5', 5.3, 5.48, 10, 9.64, 1, 1.1, 0.9], ['M6', 6.4, 6.62, 12, 11.57, 1.6, 1.8, 1.4], ['M8', 8.4, 8.62, 16, 15.57, 1.6, 1.8, 1.4]],
});

const iso7093 = washers({
  source: 'iso-7093-1', reference: 'fasteners-eu-iso-7093', code: 'iso-7093', name: 'ISO 7093-1', series: 'large', title: 'Large washer',
  aliases: thread => [`DIN 9021 ${thread}`],
  describe: ([thread, d1, , d2, , h]) => `A large (fender) washer for ${thread} screws, which spreads the load over soft or printed parts: a ${d1} mm hole, ${d2} mm across and ${h} mm thick (ISO 7093-1, formerly DIN 9021).`,
  rows: [
    ['M2.5', 2.7, 2.84, 8, 7.64, 0.8, 0.9, 0.7], ['M3', 3.2, 3.38, 9, 8.64, 0.8, 0.9, 0.7], ['M4', 4.3, 4.48, 12, 11.57, 1, 1.1, 0.9],
    ['M5', 5.3, 5.48, 15, 14.57, 1.2, 1.4, 1], ['M6', 6.4, 6.62, 18, 17.57, 1.6, 1.8, 1.4], ['M8', 8.4, 8.62, 24, 23.48, 2, 2.2, 1.8],
  ],
});

export const washerParts: Part[] = [...iso7089, ...iso7090, ...iso7093];
