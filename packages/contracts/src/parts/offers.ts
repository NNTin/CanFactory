import { Type, type Static } from 'typebox';

/**
 * Where a visitor shops: `DE` (amazon.de and Awin's German advertisers, prices in EUR) or `US` (amazon.com and Awin's US
 * advertisers, prices in USD). See docs/affiliate-offers.md.
 */
export const MARKETS = ['DE', 'US'] as const;
export type Market = typeof MARKETS[number];
export const MarketSchema = Type.Union([Type.Literal('DE'), Type.Literal('US')], { description: '`DE`: amazon.de and German Awin advertisers. `US`: amazon.com and US Awin advertisers.' });

const OfferCoverSchema = Type.Object({
  partId: Type.String({ description: 'A part of the library (a permanent id from ids.lock).' }),
  quantity: Type.Integer({ minimum: 1, description: 'How many of that part one pack holds.' }),
}, { additionalProperties: false });

const offerFields = {
  id: Type.String({ pattern: '^[a-z0-9]+(-[a-z0-9]+)*$', description: 'Stable id of the offer.' }),
  market: MarketSchema,
  covers: Type.Array(OfferCoverSchema, { minItems: 1, description: 'The library parts one pack holds, e.g. one size of insert, or every size of an assortment box.' }),
  title: Type.String({ description: 'What the pack is, in a few words, e.g. “ruthex RX-M3x5.7, pack of 100”.' }),
  rank: Type.Integer({ minimum: 0, description: 'Order among the offers for the same part: the lowest comes first.' }),
  checkedOn: Type.String({ pattern: '^\\d{4}-\\d{2}-\\d{2}$', description: 'The date someone checked that the listing is this product (ISO 8601).' }),
  note: Type.Union([Type.String(), Type.Null()], { description: 'How the listing was checked, or anything a buyer should know.' }),
  sameAsProduct: Type.Boolean({ description: 'The listing is the part’s own manufacturer product (`Part.product`): its link replaces the plain product page link.' }),
};

export const AmazonOfferSchema = Type.Object({
  ...offerFields,
  network: Type.Literal('amazon'),
  asin: Type.String({ pattern: '^[A-Z0-9]{10}$', description: 'The listing’s ASIN on this market’s Amazon. The same product often has a different ASIN on another market.' }),
}, { additionalProperties: false });

export const AwinOfferSchema = Type.Object({
  ...offerFields,
  network: Type.Literal('awin'),
  advertiserId: Type.Integer({ minimum: 1, description: 'The Awin advertiser (merchant) id.' }),
  shop: Type.String({ description: 'The shop’s name, as shown to visitors.' }),
  merchantProductId: Type.String({ description: 'The product’s `merchant_product_id` in the advertiser’s Awin product feed.' }),
  productUrl: Type.String({ description: 'The product page in the shop, for the tracked link while the feed has no row for it.' }),
}, { additionalProperties: false });

/**
 * A curated listing that sells parts of the library: an Amazon ASIN, or a product of an Awin advertiser. Never a price: Amazon
 * forbids prices that do not come from its API, and Awin's prices come from its feeds at run time (see the offers service).
 */
export const OfferSchema = Type.Union([AmazonOfferSchema, AwinOfferSchema]);
export type AmazonOffer = Static<typeof AmazonOfferSchema>;
export type AwinOffer = Static<typeof AwinOfferSchema>;
export type Offer = Static<typeof OfferSchema>;

const CHECKED = '2026-10-06';
const amazon = (market: Market, asin: string, title: string, covers: Offer['covers'], options: { rank?: number; sameAsProduct?: boolean } = {}): AmazonOffer => ({
  id: `amazon-${market.toLowerCase()}-${asin.toLowerCase()}`, market, network: 'amazon', asin, title, covers, rank: options.rank ?? 0,
  checkedOn: CHECKED, note: `Title read from the listing at https://www.amazon.${market === 'DE' ? 'de' : 'com'}/dp/${asin}.`, sameAsProduct: options.sameAsProduct ?? false,
});
/** ruthex's assortment box: 70 M2, 100 M3, 50 M4 and 50 M5 inserts (the listing's title). */
const RUTHEX_BOX: Offer['covers'] = [
  { partId: 'ruthex-rx-m2x4', quantity: 70 }, { partId: 'ruthex-rx-m3x5-7', quantity: 100 },
  { partId: 'ruthex-rx-m4x8-1', quantity: 50 }, { partId: 'ruthex-rx-m5x9-5', quantity: 50 },
];

/**
 * The curated offers: listings checked by hand against the part they sell, one row per market (an ASIN of amazon.de is not
 * necessarily the same product on amazon.com: B07YSV66Y5 is ruthex's M4 insert on amazon.de and its ¼″ insert on amazon.com).
 * Parts without an offer link to a search of the market's Amazon instead. See docs/affiliate-offers.md.
 *
 * TODO(awin): applied on 2026-10-07 to these Awin programmes (DE market), waiting for approval. Once one approves, curate its
 * products here (`network: 'awin'`, its advertiser id, the feed's `merchant_product_id`), store the product feed key in the
 * `canfactory-offers` Secret, and enable the `offers` CronJob:
 * - 28052 online-schrauben DE: ISO/DIN screws, nuts, washers and wood screws, from a single piece.
 * - 21761 3D Jake DE: ruthex heat-set inserts, filament, 3D-printing parts.
 * - 11354 Conrad Electronic DE: fasteners, magnets, electronics.
 * - 11830 Globus Baumarkt DE: catio timber, mesh, brackets and hooks.
 * - 11330 Zooplus DE: cat nets and catio accessories.
 */
export const offers: readonly Offer[] = [
  { ...amazon('DE', 'B0C69FFVHH', 'Seeed Studio XIAO ESP32-S3 Sense', [{ partId: 'seeed-xiao-esp32s3-sense', quantity: 1 }], { sameAsProduct: true }),
    checkedOn: '2026-10-10', note: 'Product link supplied by the project owner; Amazon could not be fetched automatically. Check the selected Sense variant and camera before ordering.' },
  amazon('DE', 'B088QJG676', 'ruthex RX-M2x4, pack of 70', [{ partId: 'ruthex-rx-m2x4', quantity: 70 }], { sameAsProduct: true }),
  amazon('DE', 'B08BCRZZS3', 'ruthex RX-M3x5.7, pack of 100', [{ partId: 'ruthex-rx-m3x5-7', quantity: 100 }], { sameAsProduct: true }),
  amazon('DE', 'B07YSV66Y5', 'ruthex RX-M4x8.1, pack of 50', [{ partId: 'ruthex-rx-m4x8-1', quantity: 50 }], { sameAsProduct: true }),
  amazon('DE', 'B07YSVXWS8', 'ruthex RX-M5x9.5, pack of 50', [{ partId: 'ruthex-rx-m5x9-5', quantity: 50 }], { sameAsProduct: true }),
  amazon('DE', 'B08K1BVGN9', 'ruthex assortment box M2 + M3 + M4 + M5 (70 + 100 + 50 + 50)', RUTHEX_BOX, { rank: 1 }),
  amazon('US', 'B088QJG676', 'ruthex RX-M2x4, pack of 70', [{ partId: 'ruthex-rx-m2x4', quantity: 70 }], { sameAsProduct: true }),
  amazon('US', 'B08BCRZZS3', 'ruthex RX-M3x5.7, pack of 100', [{ partId: 'ruthex-rx-m3x5-7', quantity: 100 }], { sameAsProduct: true }),
  amazon('US', 'B07YSVXWS8', 'ruthex RX-M5x9.5, pack of 50', [{ partId: 'ruthex-rx-m5x9-5', quantity: 50 }], { sameAsProduct: true }),
  amazon('US', 'B08K1BVGN9', 'ruthex assortment box M2 + M3 + M4 + M5 (70 + 100 + 50 + 50)', RUTHEX_BOX, { rank: 1 }),
];

