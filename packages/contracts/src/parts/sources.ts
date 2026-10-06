import type { Dimension, PartSource } from './schema.ts';

/** The day the web sources below were read. Re-read a source and update its `accessed` date when correcting a value from it. */
const ACCESSED = '2026-09-27';
const CATIO_ACCESSED = '2026-10-02';

const iso = (number: string, title: string): PartSource => ({
  id: `iso-${number.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`, title: `ISO ${number}: ${title}`, publisher: 'ISO',
  url: `https://www.iso.org/search.html?q=ISO%20${encodeURIComponent(number)}`, kind: 'standard', accessed: ACCESSED,
});
const din = (number: string, title: string): PartSource => ({
  id: `din-${number}`, title: `DIN ${number}: ${title}`, publisher: 'DIN', url: `https://www.dinmedia.de/en/search?query=DIN%20${number}`, kind: 'standard', accessed: ACCESSED,
});
/** fasteners.eu publishes each standard's dimension table; the values of the standard parts were read there. */
const fastenersEu = (standard: string, path: string): PartSource => ({
  id: `fasteners-eu-${standard}`, title: `${standard.toUpperCase().replace('-', ' ')} dimension table`, publisher: 'fasteners.eu',
  url: `https://www.fasteners.eu/standards/${path}/`, kind: 'reference', accessed: ACCESSED,
});

/** Every source of the parts library, by id. Parts and dimensions refer to these ids; a test checks that each one exists. */
export const PART_SOURCES: readonly PartSource[] = [
  iso('261', 'ISO general purpose metric screw threads — General plan'),
  iso('286-2', 'Geometrical product specifications — ISO code system for tolerances on linear sizes — Part 2: Tables of standard tolerance classes and limit deviations'),
  iso('4762', 'Hexagon socket head cap screws'),
  iso('7380-1', 'Button head screws — Part 1: Hexagon socket button head screws'),
  iso('10642', 'Hexagon socket countersunk head screws'),
  iso('4017', 'Fasteners — Hexagon head screws — Product grades A and B'),
  iso('7045', 'Pan head screws with type H or type Z cross recess — Product grade A'),
  iso('7046-1', 'Countersunk flat head screws (common head style) with type H or type Z cross recess — Product grade A — Part 1: Steel screws of property class 4.8'),
  iso('4032', 'Hexagon regular nuts (style 1)'),
  iso('4035', 'Hexagon thin nuts chamfered (style 0)'),
  iso('10511', 'Prevailing torque type hexagon thin nuts (with non-metallic insert)'),
  din('562', 'Square thin nuts; product grade B'),
  din('557', 'Square nuts; product grade C'),
  iso('7089', 'Plain washers — Normal series — Product grade A'),
  iso('7090', 'Plain washers, chamfered — Normal series — Product grade A'),
  iso('7093-1', 'Plain washers — Large series — Part 1: Product grade A'),
  iso('8734', 'Parallel pins, of hardened steel and martensitic stainless steel (Dowel pins)'),
  iso('2338', 'Parallel pins, of unhardened steel and austenitic stainless steel'),
  iso('15', 'Rolling bearings — Radial bearings — Boundary dimensions, general plan'),
  iso('273', 'Fasteners — Clearance holes for bolts and screws'),
  fastenersEu('iso-4762', 'ISO/4762'),
  fastenersEu('iso-7380', 'ISO/7380'),
  fastenersEu('iso-10642', 'ISO/10642'),
  fastenersEu('iso-4017', 'ISO/4017'),
  fastenersEu('iso-7045', 'ISO/7045'),
  { id: 'fasteners-eu-iso-7046', title: 'ISO 7046 dimension table', publisher: 'fasteners.eu', url: 'https://www.fasteners.eu/standards/ISO/7046/', kind: 'reference', accessed: '2026-09-29' },
  fastenersEu('iso-4032', 'ISO/4032'),
  fastenersEu('iso-4035', 'ISO/4035'),
  fastenersEu('iso-10511', 'ISO/10511'),
  fastenersEu('din-562', 'DIN/562'),
  fastenersEu('din-557', 'DIN/557'),
  fastenersEu('iso-7089', 'ISO/7089'),
  fastenersEu('iso-7090', 'ISO/7090'),
  fastenersEu('iso-7093', 'ISO/7093'),
  fastenersEu('iso-8734', 'ISO/8734'),
  fastenersEu('iso-2338', 'ISO/2338'),
  { id: 'globalfastener-din-562', title: 'DIN 562 (2013) dimension table', publisher: 'globalfastener.com', url: 'https://www.globalfastener.com/standards/detail_5299.html', kind: 'reference', accessed: ACCESSED },
  { id: 'igus-ball-bearing-table', title: 'Ball bearing table: sizes and dimensions (DIN 625)', publisher: 'igus', url: 'https://www.igus.eu/ball-bearings/wiki/ball-bearings-dimensions-table', kind: 'reference', accessed: ACCESSED },
  { id: 'supermagnete', title: 'supermagnete product data sheets (technical data of each article)', publisher: 'supermagnete (Webcraft GmbH)', url: 'https://www.supermagnete.de/eng/', kind: 'manufacturer', accessed: ACCESSED },
  { id: 'cnc-kitchen-inserts', title: 'CNC Kitchen heat set inserts: Dimensions & Design Guidelines, metric size inserts', publisher: 'CNC Kitchen', url: 'https://cnckitchen.store/products/heat-set-insert-m3-x-5-7-100-pieces', kind: 'manufacturer', accessed: ACCESSED },
  { id: 'ruthex-inserts', title: 'ruthex threaded inserts: dimension drawing on each product’s packaging image', publisher: 'ruthex', url: 'https://www.ruthex.de/en/collections/gewindeeinsatze', kind: 'manufacturer', accessed: ACCESSED },
  // Window catio hardware (the window insert's joints and clamps), read 2026-10-02.
  { ...din('7997', 'Cross recessed countersunk (flat) head wood screws'), accessed: CATIO_ACCESSED },
  { id: 'fasteners-eu-din-7997', title: 'DIN 7997 dimension table', publisher: 'fasteners.eu', url: 'https://www.fasteners.eu/standards/DIN/7997/', kind: 'reference', accessed: CATIO_ACCESSED },
  { ...din('7965', 'Screwed inserts (insert nuts) for wood'), accessed: CATIO_ACCESSED },
  { id: 'fasteners-eu-din-7965', title: 'DIN 7965 dimension table and drawing', publisher: 'fasteners.eu', url: 'https://www.fasteners.eu/standards/DIN/7965/', kind: 'reference', accessed: CATIO_ACCESSED },
  { ...din('1159', 'Staples (U-shaped wire nails, “Schlaufen/Krampen”)'), accessed: CATIO_ACCESSED },
  { id: 'kk-din-1159', title: 'DIN 1159, Schlaufen (Krampen): sizes d × l', publisher: 'Keller & Kalmbach', url: 'https://www.kk-shop.com/shop/kataloge/de_DE/52/articles/din-1159-schlaufen-krampen-/1759/1759.php', kind: 'reference', accessed: CATIO_ACCESSED },
  { id: 'ganter-gn-343-2', title: 'GN 343.2 Leveling Feet, Steel, with Threaded Stud: table, technical drawing and specification', publisher: 'Otto Ganter GmbH & Co. KG', url: 'https://www.ganternorm.com/en/products/3.4-Installing-lifting-dampening-with-levelling-feet-lifting-gear-and-rubber-elements/Levelling-feet/GN-343.2-Leveling-Feet-Steel-with-Threaded-Stud', kind: 'manufacturer', accessed: CATIO_ACCESSED },
  // The catio's insert–tunnel coupling, read 2026-10-02.
  { id: 'ganter-gn-831', title: 'GN 831 Toggle latches, Steel / Stainless Steel: table, technical drawing and specification', publisher: 'Otto Ganter GmbH & Co. KG', url: 'https://www.ganternorm.com/en/products/2.4-Tensioning-with-clamping-mechanisms/Toggle-latches/GN-831-Toggle-latches-Steel-Stainless-Steel', kind: 'manufacturer', accessed: CATIO_ACCESSED },
  // The catio's window insert hung on the window frame (insect screen hooks), read 2026-10-06.
  { id: 'windhager-03651', title: 'Einhängefeder Montageset 03651 (IS EH-Feder Montageset 5-35mm): product page, for frame lips of 5–35 mm', publisher: 'Windhager Handelsgesellschaft m.b.H.', url: 'https://www.windhager.eu/de/Produkte/Einhaengefeder-Montageset_a_85263', kind: 'manufacturer', accessed: '2026-10-06' },
  { id: 'windhager-qa468', title: 'Windhager assembly instructions QA468 (Spannrahmen Fenster PLUS and Einhängefedern 03651): hook tips 15 and 7 mm, bent at X + 3 mm', publisher: 'Windhager Handelsgesellschaft m.b.H. (published with the product on Amazon)', url: 'https://m.media-amazon.com/images/I/B1hRF8UnnqL.pdf', kind: 'manufacturer', accessed: '2026-10-06' },
  { id: 'hornbach-windhager-03651', title: 'Insektenschutz Windhager Einhängefeder Montageset 5-35 mm (EAN 9003117036512): stainless steel, 4 pieces', publisher: 'HORNBACH', url: 'https://www.hornbach.de/p/insektenschutz-windhager-einhaengefeder-montageset-5-35-mm-4-stueck/6830362/', kind: 'reference', accessed: '2026-10-06' },
  { id: 'canfactory-screen-hook-estimate', title: 'Estimated from the drawings of Windhager’s instructions QA468, scaled by the dimensioned 15 and 7 mm tips (docs/concepts/catio/window-insert.md)', publisher: 'CanFactory', url: 'https://github.com/NNTin/CanFactory/blob/develop/docs/concepts/catio/window-insert.md', kind: 'reference', accessed: '2026-10-06' },
  { id: 'bic-graphic-j25', title: 'BIC J25 lighter (product 3460002360): 62 × 22 × 11 mm', publisher: 'BIC Graphic', url: 'https://www.bicgraphic.com/gb/bic-j25-lighter-3460002360.html', kind: 'manufacturer', accessed: '2026-09-25' },
  { id: '4imprint-j25', title: 'BIC J25 Standard Lighter: 22 × 62 × 11 mm', publisher: '4imprint UK', url: 'https://www.4imprint.co.uk/product/502972/BIC-J25-Standard-Lighter', kind: 'reference', accessed: '2026-09-25' },
  { id: 'wemag-j25', title: 'BIC Mini lighter J25: 22 × 62 × 11 mm', publisher: 'WE MAG', url: 'https://wemag.gr/en/product/bic-mini-lighter-j25-2360/', kind: 'reference', accessed: '2026-09-25' },
  { id: 'canfactory-lighter-estimate', title: 'Estimated from photographs and proportions (docs/cigarette-case-assembly.md, “Reference objects”)', publisher: 'CanFactory', url: 'https://github.com/NNTin/CanFactory/blob/develop/docs/cigarette-case-assembly.md#reference-objects', kind: 'reference', accessed: '2026-09-25' },
];

export function findPartSource(id: string): PartSource | undefined { return PART_SOURCES.find(source => source.id === id); }

/** A dimension builder bound to one source and basis, so that the tables below stay one line per row. */
export const measured = (basis: Dimension['basis'], source: string) =>
  (value: number, min: number | null = null, max: number | null = null): Dimension => ({ value, min, max, basis, source });
