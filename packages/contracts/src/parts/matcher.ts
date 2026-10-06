import { Type, type Static } from 'typebox';
import { AFFILIATE_ACCOUNTS, type AffiliateAccounts } from './affiliateAccounts.ts';
import { MarketSchema, offers as curatedOffers, type Market, type Offer } from './offers.ts';
import type { Part } from './schema.ts';

/** Each market's Amazon. */
export const AMAZON_HOSTS: Record<Market, string> = { DE: 'www.amazon.de', US: 'www.amazon.com' };
/** Awin prices older than this are not shown (the link stays): Awin sets no limit, so Canfactory chose 72 h, see #54. */
export const AWIN_PRICE_MAX_AGE_MS = 72 * 3_600_000;
/**
 * Whether Amazon's Add-to-Cart form (`/gp/aws/cart/add.html`) puts several items into the visitor's basket and credits the
 * Associates tag without the API's access key. It is documented only in the retired PA-API 5 docs; until someone has checked
 * both (it needs an Associates account), the buy list links each item instead. See docs/affiliate-offers.md.
 */
export const AMAZON_CART_FORM_VERIFIED = false;

/** The listing of an ASIN on a market's Amazon, with the Associates tag. Amazon's links are used as they are, never edited. */
export function amazonProductUrl(asin: string, market: Market, tag: string): string {
  return `https://${AMAZON_HOSTS[market]}/dp/${asin}?tag=${encodeURIComponent(tag)}`;
}
/** What to search for a part on Amazon: the manufacturer's article for a product, the standard designation otherwise. */
export function amazonSearchTerms(part: Pick<Part, 'designation' | 'product'>): string {
  return part.product ? `${part.product.manufacturer} ${part.product.sku}` : part.designation;
}
/** A search of a market's Amazon for a part, with the Associates tag: the link of a part that has no curated offer. */
export function amazonSearchUrl(part: Pick<Part, 'designation' | 'product'>, market: Market, tag: string): string {
  return `https://${AMAZON_HOSTS[market]}/s?k=${encodeURIComponent(amazonSearchTerms(part))}&tag=${encodeURIComponent(tag)}`;
}
/** Awin's tracked link to a page of an advertiser, for a product its feed has no row for (yet). */
export function awinFallbackUrl(advertiserId: number, publisherId: number, productUrl: string): string {
  return `https://www.awin1.com/cread.php?awinmid=${advertiserId}&awinaffid=${publisherId}&ued=${encodeURIComponent(productUrl)}`;
}
/** Amazon's Add-to-Cart form for several ASINs (see `AMAZON_CART_FORM_VERIFIED`). */
export function amazonCartUrl(items: readonly { asin: string; quantity: number }[], market: Market, tag: string): string {
  const query = items.flatMap((item, index) => [`ASIN.${index + 1}=${item.asin}`, `Quantity.${index + 1}=${item.quantity}`]);
  return `https://${AMAZON_HOSTS[market]}/gp/aws/cart/add.html?${[...query, `AssociateTag=${encodeURIComponent(tag)}`].join('&')}`;
}

/** One product of an Awin advertiser's feed, as the offers service stored it. */
export interface AwinLive {
  advertiserId: number; merchantProductId: string; market: Market;
  deepLink: string; name: string; price: number | null; currency: string | null; deliveryCost: number | null; inStock: boolean | null;
  /** When Awin last imported the advertiser's feed (ms since the epoch): the time its price is “as of”. */
  lastImported: number;
}

const CoversSchema = Type.Array(Type.Object({ partId: Type.String(), quantity: Type.Integer({ minimum: 1 }) }, { additionalProperties: false }));

export const ProductOfferSchema = Type.Object({
  offerId: Type.Union([Type.String(), Type.Null()], { description: 'The curated offer, or null for a search link.' }),
  kind: Type.Union([Type.Literal('curated'), Type.Literal('search')], { description: '`curated`: a checked listing. `search`: a search of the market’s Amazon, for a part with no curated offer.' }),
  network: Type.Union([Type.Literal('amazon'), Type.Literal('awin')]),
  shop: Type.String({ description: 'The shop as shown to visitors, e.g. “amazon.de”.' }),
  shopKey: Type.String({ description: 'Groups the buy list by shop: `amazon-DE`, `amazon-US` or `awin-<advertiserId>`.' }),
  title: Type.String(),
  url: Type.String({ description: 'The affiliate link. Shown with rel="sponsored".' }),
  asin: Type.Union([Type.String(), Type.Null()]),
  covers: CoversSchema,
  packs: Type.Integer({ minimum: 1, description: 'Packs needed for the requested quantity of the part (1 for a search).' }),
  sameAsProduct: Type.Boolean(),
  price: Type.Union([Type.Object({
    amount: Type.Number(), currency: Type.String(),
    deliveryCost: Type.Union([Type.Number(), Type.Null()], { description: 'Shipping, when the feed gives it.' }),
    asOf: Type.String({ description: 'When the advertiser’s feed was imported (ISO 8601); prices older than 72 hours are not given.' }),
  }, { additionalProperties: false }), Type.Null()], { description: 'Awin only, from the advertiser’s feed. Amazon offers never carry a price.' }),
  inStock: Type.Union([Type.Boolean(), Type.Null()]),
}, { additionalProperties: false });
export type ProductOffer = Static<typeof ProductOfferSchema>;

export const OfferMatchSchema = Type.Object({
  partId: Type.String(), quantity: Type.Integer({ minimum: 1 }),
  offers: Type.Array(ProductOfferSchema, { description: 'Best first. Empty when no network is enabled for the market.' }),
}, { additionalProperties: false });
export type OfferMatch = Static<typeof OfferMatchSchema>;

export const ShopLineSchema = Type.Object({
  offer: ProductOfferSchema,
  packs: Type.Integer({ minimum: 1, description: 'Packs to buy: enough of every part the pack covers.' }),
  partIds: Type.Array(Type.String(), { description: 'The requested parts this line buys.' }),
}, { additionalProperties: false });
export const ShopGroupSchema = Type.Object({
  shopKey: Type.String(), shop: Type.String(), network: Type.Union([Type.Literal('amazon'), Type.Literal('awin')]),
  lines: Type.Array(ShopLineSchema),
  cartUrl: Type.Union([Type.String(), Type.Null()], { description: 'One link that puts every line in the basket, where the shop supports it.' }),
}, { additionalProperties: false });
export type ShopGroup = Static<typeof ShopGroupSchema>;

export const NetworksSchema = Type.Object({ amazon: Type.Boolean(), awin: Type.Boolean() }, { additionalProperties: false });
export const OffersSchema = Type.Object({
  market: MarketSchema,
  networks: NetworksSchema,
  matches: Type.Array(OfferMatchSchema, { description: 'One per requested part, in request order.' }),
  shops: Type.Array(ShopGroupSchema, { description: 'The buy list: the best offer of every part, grouped by shop.' }),
}, { additionalProperties: false });
export type Offers = Static<typeof OffersSchema>;

export interface Requirement { partId: string; quantity: number }

export interface MatchOptions {
  accounts?: AffiliateAccounts;
  /** The stored Awin feed rows of the offers involved. */
  live?: readonly AwinLive[];
  now?: number;
  catalogue?: readonly Offer[];
  findPart: (id: string) => Pick<Part, 'id' | 'designation' | 'product'> | undefined;
}

/** Which networks link for a market: those with an account. */
export function enabledNetworks(market: Market, accounts: AffiliateAccounts = AFFILIATE_ACCOUNTS): Static<typeof NetworksSchema> {
  return { amazon: accounts.amazon[market] !== null, awin: accounts.awin.publisherId !== null };
}

/**
 * The Product Matcher: for each required part, the curated offers of the market whose networks have an account, best first, with
 * the packs that cover the quantity; a search of the market's Amazon when there is none. `shops` is the buy list: the best offer
 * of each part, grouped by shop, where a pack that covers several parts (an assortment) is bought once, in enough packs for all.
 */
export function matchOffers(requirements: readonly Requirement[], market: Market, options: MatchOptions): Offers {
  const { accounts = AFFILIATE_ACCOUNTS, live = [], now = Date.now(), catalogue = curatedOffers } = options;
  const networks = enabledNetworks(market, accounts);
  const tag = accounts.amazon[market];
  const publisherId = accounts.awin.publisherId;
  const summed = new Map<string, number>();
  for (const requirement of requirements) summed.set(requirement.partId, (summed.get(requirement.partId) ?? 0) + requirement.quantity);

  const product = (offer: Offer, partId: string, quantity: number): ProductOffer | undefined => {
    const perPack = offer.covers.find(cover => cover.partId === partId)?.quantity ?? 1;
    const base = { offerId: offer.id, kind: 'curated' as const, network: offer.network, title: offer.title, covers: offer.covers.map(cover => ({ ...cover })),
      packs: Math.max(1, Math.ceil(quantity / perPack)), sameAsProduct: offer.sameAsProduct };
    if (offer.network === 'amazon') {
      if (tag === null) return undefined;
      return { ...base, shop: AMAZON_HOSTS[market].replace(/^www\./, ''), shopKey: `amazon-${market}`, url: amazonProductUrl(offer.asin, market, tag), asin: offer.asin, price: null, inStock: null };
    }
    if (publisherId === null) return undefined;
    const row = live.find(candidate => candidate.advertiserId === offer.advertiserId && candidate.merchantProductId === offer.merchantProductId && candidate.market === market);
    const fresh = row !== undefined && now - row.lastImported < AWIN_PRICE_MAX_AGE_MS;
    return {
      ...base, shop: offer.shop, shopKey: `awin-${offer.advertiserId}`, url: row?.deepLink ?? awinFallbackUrl(offer.advertiserId, publisherId, offer.productUrl), asin: null,
      price: fresh && row.price !== null && row.currency !== null ? { amount: row.price, currency: row.currency, deliveryCost: row.deliveryCost, asOf: new Date(row.lastImported).toISOString() } : null,
      inStock: fresh ? row.inStock : null,
    };
  };
  // An Awin offer that is out of stock, or whose price is unknown or too old, goes after the others; then the curated rank.
  const weak = (offer: ProductOffer) => offer.network === 'awin' && (offer.inStock === false || offer.price === null) ? 1 : 0;

  const matches: OfferMatch[] = [...summed].map(([partId, quantity]) => {
    const found = catalogue.filter(offer => offer.market === market && offer.covers.some(cover => cover.partId === partId))
      .sort((a, b) => a.rank - b.rank || a.id.localeCompare(b.id))
      .flatMap(offer => { const result = product(offer, partId, quantity); return result ? [result] : []; })
      .sort((a, b) => weak(a) - weak(b));
    const part = options.findPart(partId);
    if (found.length === 0 && tag !== null && part) {
      found.push({ offerId: null, kind: 'search', network: 'amazon', shop: AMAZON_HOSTS[market].replace(/^www\./, ''), shopKey: `amazon-${market}`,
        title: `Search for “${amazonSearchTerms(part)}”`, url: amazonSearchUrl(part, market, tag), asin: null, covers: [{ partId, quantity: 1 }], packs: 1,
        sameAsProduct: false, price: null, inStock: null });
    }
    return { partId, quantity, offers: found };
  });

  const groups = new Map<string, ShopGroup>();
  for (const match of matches) {
    const best = match.offers[0];
    if (!best) continue;
    const group = groups.get(best.shopKey) ?? { shopKey: best.shopKey, shop: best.shop, network: best.network, lines: [], cartUrl: null };
    groups.set(best.shopKey, group);
    const line = best.offerId === null ? undefined : group.lines.find(candidate => candidate.offer.offerId === best.offerId);
    if (line) { line.packs = Math.max(line.packs, best.packs); line.partIds.push(match.partId); }
    else group.lines.push({ offer: best, packs: best.packs, partIds: [match.partId] });
  }
  const shops = [...groups.values()];
  if (AMAZON_CART_FORM_VERIFIED && tag !== null) {
    for (const group of shops) {
      const items = group.lines.flatMap(line => line.offer.asin ? [{ asin: line.offer.asin, quantity: line.packs }] : []);
      if (group.network === 'amazon' && items.length > 0) group.cartUrl = amazonCartUrl(items, market, tag);
    }
  }
  return { market, networks, matches, shops };
}

/** The market of a visitor's country (ISO 3166 alpha-2, e.g. Cloudflare's CF-IPCountry): DE, AT and CH shop on amazon.de, others on amazon.com. */
export function marketOfCountry(country: string | null | undefined): Market {
  return country !== null && country !== undefined && ['DE', 'AT', 'CH'].includes(country.toUpperCase()) ? 'DE' : 'US';
}
