import type { Part, PartFamily } from './schema.ts';
import { measured } from './sources.ts';

/** Retail comparison candidates, not mounting templates or parts selected for a model. */
export const catEntranceFamily: PartFamily = {
  id: 'cat-entrance', title: 'Cat entrances',
  description: 'Retail cat flaps and pet doors, from simple manual locks to microchip entry. Compare published frame, cut-out and passage sizes separately. Previews are front-size diagrams only: white frame, grey cut-out, blue passage (TRIXIE: flap size), with illustrative centred rectangles and 2 mm display thickness.',
  attributes: [
    { key: 'brand', label: 'Brand' }, { key: 'access', label: 'Access control' },
    { key: 'closedLock', label: 'Closed retention' }, { key: 'holdOpen', label: 'Held-open retention' },
    { key: 'seal', label: 'Weather sealing' },
  ],
  dimensions: [
    { key: 'frameWidth', label: 'Overall frame width', symbol: 'W', required: true },
    { key: 'frameHeight', label: 'Overall frame height', symbol: 'H', required: true },
    { key: 'overallDepth', label: 'Overall depth', symbol: 'D', required: false },
    { key: 'cutoutWidth', label: 'Door/wall cut-out width', symbol: 'Wc', required: false },
    { key: 'cutoutHeight', label: 'Door/wall cut-out height', symbol: 'Hc', required: false },
    { key: 'passageWidth', label: 'Published opening width', symbol: 'Wp', required: false },
    { key: 'passageHeight', label: 'Published opening height', symbol: 'Hp', required: false },
    { key: 'flapWidth', label: 'Flap width (not clear passage)', symbol: 'Wf', required: false },
    { key: 'flapHeight', label: 'Flap height (not clear passage)', symbol: 'Hf', required: false },
    { key: 'installationMin', label: 'Minimum installation thickness', symbol: 'Tmin', required: false },
    { key: 'installationMax', label: 'Maximum installation thickness', symbol: 'Tmax', required: false },
    { key: 'tunnelDepth', label: 'Tunnel depth (not overall depth)', symbol: 'Dt', required: false },
    { key: 'frontFrameDepth', label: 'Interior frame depth (not overall depth)', symbol: 'Di', required: false },
  ],
};

interface Entrance {
  id: string; brand: string; name: string; sku: string; url: string; source: string;
  aliases: string[]; access: string; closedLock: string; seal: string; description: string;
  dimensions: Record<string, number>; notes: string; extraSources?: string[];
}

const ENTRANCES: Entrance[] = [
  {
    id: 'trixie-44211', brand: 'TRIXIE', name: '44211 4-way cat flap', sku: '44211',
    url: 'https://trixie.shop/products/4-wege-freilauftur', source: 'trixie-44211', aliases: ['4-Wege Freilauftür'],
    access: 'Manual 4-way', closedLock: 'Rotary 4-way lock', seal: 'Circumferential TPR seal',
    description: 'An inexpensive white plastic cat flap with a rotary four-way lock, transparent flap and TPR perimeter seal. The thin-panel version starts at 5 mm installation thickness.',
    dimensions: { frameWidth: 200, frameHeight: 220, cutoutWidth: 159, cutoutHeight: 168, flapWidth: 140, flapHeight: 155, installationMin: 5 },
    notes: 'The maker gives flap size, not clear passage. Maximum installation thickness and overall depth are not published. Manufacturer-shop price reference: €16.99 on 2026-10-10, excluding shipping; not a live offer.',
  },
  {
    id: 'trixie-44231', brand: 'TRIXIE', name: '44231 4-way cat flap with tunnel', sku: '44231',
    url: 'https://trixie.shop/products/4-wege-freilauftur-mit-tunnel', source: 'trixie-44231', aliases: ['4-Wege Freilauftür mit Tunnel'],
    access: 'Manual 4-way', closedLock: 'Rotary 4-way lock', seal: 'Circumferential TPR seal',
    description: 'The white TRIXIE four-way flap with two tunnel elements included, for 20–52 mm installation thickness. It has the same front and flap sizes as 44211, but a different installation range.',
    dimensions: { frameWidth: 200, frameHeight: 220, cutoutWidth: 159, cutoutHeight: 168, flapWidth: 140, flapHeight: 155, installationMin: 20, installationMax: 52 },
    notes: 'Flap size is not clear passage; 20–52 mm is installation thickness, not overall depth. Further tunnel elements are available. Manufacturer-shop price reference: €19.99 on 2026-10-10, excluding shipping; not a live offer.',
  },
  {
    id: 'cat-mate-221', brand: 'Cat Mate / Closer Pets', name: '221 large cat flap', sku: '221',
    url: 'https://closerpets.co.uk/collections/door-range/products/large-cat-flap', source: 'closer-pets-221', aliases: ['CP221', '221W', 'Large Cat & Small Dog Flap'],
    access: 'Manual 4-way', closedLock: 'Double-point 4-way lock', seal: 'Brush seal, magnetic closure and rain seal',
    description: 'A white manual four-way flap for large cats and small dogs, with double-point locking and a published 180 × 180 mm opening. Its self-lining frame accommodates up to 50 mm thickness.',
    dimensions: { frameWidth: 235, frameHeight: 252, cutoutWidth: 204, cutoutHeight: 221, passageWidth: 180, passageHeight: 180, installationMax: 50 },
    notes: 'The current manufacturer page supplies the opening size; overall depth and minimum installation thickness are not stated. The magnetic closure is for weather closing, not a substitute for the lock. Manual control, not a timed curfew. Direct-shop price reference: £17.99 on 2026-10-10, excluding shipping; not a live offer.',
  },
  {
    id: 'ferplast-swing-1', brand: 'Ferplast', name: 'SWING 1 cat flap', sku: '72101011',
    url: 'https://www.ferplast.fr/products/swing-1', source: 'ferplast-swing-1', aliases: ['721010', 'SWING1'],
    access: 'Manual 2-way', closedLock: 'Manual 2-way lock', seal: 'No Wind Stopper system on SWING 1',
    description: 'A simple white two-way flap: unlocked or closed, rather than directional four-way control. Ferplast publishes a 145 × 148 mm opening and 50 mm overall depth for this small model.',
    dimensions: { frameWidth: 215, frameHeight: 240, overallDepth: 50, passageWidth: 145, passageHeight: 148 },
    notes: 'SWING 1 does not include the Wind Stopper fitted to other SWING models. Rectangular cut-out dimensions are not given on the cited product page: use the supplied installation template. Price reference at Ferplast France: €22.20 on 2026-10-10, excluding shipping; not a live offer.',
    extraSources: ['ferplast-swing-controls'],
  },
  {
    id: 'sureflap-microchip-cat-flap', brand: 'Sure Petcare', name: 'SureFlap Microchip Cat Flap', sku: 'Microchip Cat Flap',
    url: 'https://www.surepetcare.com/en-gb/pet-doors/microchip-cat-flap', source: 'sureflap-microchip-dimensions', aliases: ['SureFlap original', 'non-Connect'],
    access: 'Microchip entry + manual 4-way', closedLock: 'Electronic entry catch + manual lock', seal: 'Not specified in cited product dimensions',
    description: 'The non-Connect SureFlap electronic comparator: microchip-selective entry, unrestricted exit unless manually locked, and four AA batteries. Its smallest published opening is 142 × 120 mm.',
    dimensions: { frameWidth: 210, frameHeight: 210, cutoutWidth: 165, cutoutHeight: 171, passageWidth: 142, passageHeight: 120, tunnelDepth: 70, frontFrameDepth: 42 },
    notes: 'Exterior frame dimensions are given separately from the interior frame depth and tunnel depth; none is an overall-depth measurement. This is not DualScan or Connect and does not selectively identify exiting cats. Product name used as designation; confirm the regional SKU before ordering. Direct-shop price reference: £70 on 2026-10-10, excluding batteries and shipping; not a live offer.',
    extraSources: ['sureflap-microchip-product'],
  },
];

// The maker's sizing chart is H × W × D; store W and H explicitly, not in printed order.
for (const [sku, size, width, height, depth, cutWidth, cutHeight, passageWidth, passageHeight] of [
  ['715EF', 'small', 198, 236, 32, 158, 185, 152, 175],
  ['740EF', 'medium', 292, 352, 45, 237, 281, 218, 238],
  ['760EF', 'large', 383, 454, 47, 314, 370, 289, 325],
] as const) {
  ENTRANCES.push({
    id: `petsafe-staywell-${sku.toLowerCase()}`, brand: 'PetSafe', name: `Staywell Original 2-way pet door, ${size}`, sku,
    url: `https://www.petsafe.com/gb/p/staywell-original-2-way-pet-door/${sku}/`, source: `petsafe-staywell-${sku.toLowerCase()}`,
    aliases: [`Staywell ${sku}`, '700 series'], access: 'Manual 2-way', closedLock: 'Manual lock; closing panel included', seal: 'Not specified in cited sizing chart',
    description: `The ${size} white Staywell Original two-way door (${sku}), with a rigid transparent flap and included closing panel. Its published opening is ${passageWidth} × ${passageHeight} mm, distinct from the larger installation cut-out.`,
    dimensions: { frameWidth: width, frameHeight: height, overallDepth: depth, cutoutWidth: cutWidth, cutoutHeight: cutHeight, passageWidth, passageHeight },
    notes: `Dimensions reordered from the maker’s H × W × D chart. Installation-thickness range and panel-retention details are not specified there. ${size === 'small' ? 'A tunnel is purchased separately.' : 'One tunnel is included; the maker allows only one tunnel on this size.'}`,
  });
}

const COMPARISON_NOTES = ' No built-in hold-open retainer is documented in the cited sources: unlocked means free-swinging, not held raised. Closed-lock strength and draught leakage still need testing; no cat-proof rating is inferred. Preview: front-size diagram only, 2 mm display thickness, centred rectangular outlines, not a cutting template or mounting model.';

export const catEntranceParts: Part[] = ENTRANCES.map((entrance): Part => {
  const stated = measured('manufacturer', entrance.source);
  return {
    id: entrance.id, family: 'cat-entrance', title: `${entrance.brand} ${entrance.name}`, designation: `${entrance.brand} ${entrance.sku}`,
    aliases: entrance.aliases, description: entrance.description, standard: null,
    product: { manufacturer: entrance.brand, sku: entrance.sku, url: entrance.url },
    attributes: { brand: entrance.brand, access: entrance.access, closedLock: entrance.closedLock, holdOpen: 'Not documented; unlocked is free-swinging', seal: entrance.seal },
    dimensions: Object.fromEntries(Object.entries(entrance.dimensions).map(([key, value]) => [key, stated(value)])),
    sources: [entrance.source, ...(entrance.extraSources ?? [])], notes: entrance.notes + COMPARISON_NOTES,
    preview: { kind: 'procedural' },
  };
});
