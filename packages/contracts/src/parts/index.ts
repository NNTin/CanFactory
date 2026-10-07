import { ballFamily, ballParts } from './balls.ts';
import { bearingFamily, bearingParts } from './bearings.ts';
import { catCollarFamily, catCollarParts } from './cat-collars.ts';
import { cornerBracketFamily, cornerBracketParts } from './corner-brackets.ts';
import { everydayObjectFamily, everydayObjectParts } from './everyday-objects.ts';
import { insertFamily, insertParts } from './inserts.ts';
import { insertNutFamily, insertNutParts } from './insert-nuts.ts';
import { levellingFootFamily, levellingFootParts } from './levelling-feet.ts';
import { magnetFamily, magnetParts } from './magnets.ts';
import { nailFamily, nailParts } from './nails.ts';
import { nfcTagFamily, nfcTagParts } from './nfc-tags.ts';
import { nutFamily, nutParts } from './nuts.ts';
import { pinFamily, pinParts } from './pins.ts';
import type { Part, PartFamily } from './schema.ts';
import { screenHookFamily, screenHookParts } from './screen-hooks.ts';
import { screwFamily, screwParts } from './screws.ts';
import { setScrewFamily, setScrewParts } from './set-screws.ts';
import { splitRingFamily, splitRingParts } from './split-rings.ts';
import { springFamily, springParts } from './springs.ts';
import { toggleLatchFamily, toggleLatchParts } from './toggle-latches.ts';
import { washerFamily, washerParts } from './washers.ts';
import { woodScrewFamily, woodScrewParts } from './wood-screws.ts';

export * from './schema.ts';
export * from './offers.ts';
export * from './affiliateAccounts.ts';
export * from './matcher.ts';
export { PART_SOURCES, findPartSource } from './sources.ts';
export { cornerBracketHoles } from './corner-brackets.ts';
export { springRate } from './springs.ts';

/**
 * The parts library: real-world items that models are made to fit, grouped into families. Each family is one file with its
 * data as tables (one row per size or product), expanded into parts; see docs/adding-parts.md.
 *
 * TODO(parts): families to add next: batteries (CR2032 and other coin cells, AA/AAA; IEC 60086), O-rings (ISO 3601),
 * rods and shafts (linear shafts, threaded rods), and more everyday objects.
 */
export const partFamilies: readonly PartFamily[] = [
  magnetFamily, screwFamily, nutFamily, washerFamily, insertFamily, bearingFamily, pinFamily, everydayObjectFamily,
  woodScrewFamily, nailFamily, insertNutFamily, levellingFootFamily, toggleLatchFamily, screenHookFamily, cornerBracketFamily,
  setScrewFamily, ballFamily, springFamily, splitRingFamily, nfcTagFamily, catCollarFamily,
];

export const parts: readonly Part[] = [
  ...magnetParts, ...screwParts, ...nutParts, ...washerParts, ...insertParts, ...bearingParts, ...pinParts, ...everydayObjectParts,
  ...woodScrewParts, ...nailParts, ...insertNutParts, ...levellingFootParts, ...toggleLatchParts, ...screenHookParts, ...cornerBracketParts,
  ...setScrewParts, ...ballParts, ...springParts, ...splitRingParts, ...nfcTagParts, ...catCollarParts,
];

export function findPart(id: string): Part | undefined { return parts.find(part => part.id === id); }
export function findPartFamily(id: string): PartFamily | undefined { return partFamilies.find(family => family.id === id); }
export function partsOfFamily(family: string): Part[] { return parts.filter(part => part.family === family); }

/**
 * One value of a part's dimension in mm: its nominal `value`, or the `min` or `max` of its tolerance, which is the nominal value
 * when the source gives no limit. Throws for a dimension the part does not have.
 */
export function dimensionOf(part: Part, key: string, limit: 'value' | 'min' | 'max' = 'value'): number {
  const dimension = part.dimensions[key];
  if (!dimension) throw new Error(`${part.id} has no dimension ${key}.`);
  return limit === 'value' ? dimension.value : dimension[limit] ?? dimension.value;
}

/** Where a part's model lives, for a part with an STL preview: `<path>.scad` is its source and `<path>.stl` that file rendered. */
export function partAssetPath(part: Part, extension: 'scad' | 'stl'): string | undefined {
  return part.preview.kind === 'stl' ? part.preview.path.replace(/\.stl$/, `.${extension}`) : undefined;
}

/** The ISO 261 coarse pitch of each metric thread in the library, in mm. */
export const METRIC_THREADS = { M2: 0.4, 'M2.5': 0.45, M3: 0.5, M4: 0.7, M5: 0.8, M6: 1, M8: 1.25 } as const;
export type MetricThread = keyof typeof METRIC_THREADS;

/**
 * ISO 273 (DIN EN 20273) clearance-hole diameters in mm, per thread and series: fine (H12), medium (H13, the usual choice) and
 * coarse (H14). Mirrored by `DIN_EN_20273` in models/plank-connector/generator.scad (a test keeps the two identical).
 */
export const ISO_273_CLEARANCE_HOLES: Record<MetricThread, { fine: number; medium: number; coarse: number }> = {
  M2: { fine: 2.2, medium: 2.4, coarse: 2.6 },
  'M2.5': { fine: 2.7, medium: 2.9, coarse: 3.1 },
  M3: { fine: 3.2, medium: 3.4, coarse: 3.6 },
  M4: { fine: 4.3, medium: 4.5, coarse: 4.8 },
  M5: { fine: 5.3, medium: 5.5, coarse: 5.8 },
  M6: { fine: 6.4, medium: 6.6, coarse: 7 },
  M8: { fine: 8.4, medium: 9, coarse: 10 },
};
