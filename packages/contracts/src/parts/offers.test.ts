import { readFileSync } from 'node:fs';
import { Value } from 'typebox/value';
import { describe, expect, it } from 'vitest';
import { bomRequirements, countParts, modelBom } from '../bom.ts';
import { cigaretteCase, models } from '../models.ts';
import {
  AFFILIATE_ACCOUNTS, amazonCartUrl, amazonProductUrl, amazonSearchUrl, AWIN_PRICE_MAX_AGE_MS, awinFallbackUrl, findPart, marketOfCountry, matchOffers,
  OfferSchema, offers, OffersSchema, type AffiliateAccounts, type AwinLive, type Offer,
} from './index.ts';

const locked = readFileSync(new URL('./ids.lock', import.meta.url), 'utf8').split('\n').filter(line => line && !line.startsWith('#'));
const accounts: AffiliateAccounts = { amazon: { DE: 'canfactory-21', US: 'canfactory-20' }, awin: { publisherId: 12345 } };
const awin = (overrides: Partial<Extract<Offer, { network: 'awin' }>> = {}): Offer => ({
  id: 'awin-de-test', market: 'DE', network: 'awin', advertiserId: 777, shop: 'Test Shop', merchantProductId: 'SKU-1', productUrl: 'https://shop.example/m3',
  title: 'Test shop M3 inserts, pack of 25', covers: [{ partId: 'ruthex-rx-m3x5-7', quantity: 25 }], rank: 0, checkedOn: '2026-10-06', note: null, sameAsProduct: false, ...overrides,
});
const live = (overrides: Partial<AwinLive> = {}): AwinLive => ({
  advertiserId: 777, merchantProductId: 'SKU-1', market: 'DE', deepLink: 'https://www.awin1.com/pclick.php?p=1&a=12345&m=777', name: 'M3 inserts',
  price: 4.99, currency: 'EUR', deliveryCost: 3.95, inStock: true, lastImported: Date.parse('2026-10-06T08:00:00Z'), ...overrides,
});

describe('curated offers', () => {
  it('are well formed, unique, and sell parts of the library', () => {
    for (const offer of offers) expect([...Value.Errors(OfferSchema, offer)].map(error => `${error.instancePath} ${error.message}`), offer.id).toEqual([]);
    expect(new Set(offers.map(offer => offer.id)).size).toBe(offers.length);
    for (const offer of offers) for (const cover of offer.covers) {
      expect(locked, `${offer.id}: ${cover.partId} is not a permanent part id`).toContain(cover.partId);
      expect(findPart(cover.partId), `${offer.id}: ${cover.partId}`).toBeDefined();
    }
    // One listing per market and product: the same ASIN or feed product is never curated twice for a market.
    const keys = offers.map(offer => `${offer.market}:${offer.network === 'amazon' ? offer.asin : `${offer.advertiserId}/${offer.merchantProductId}`}`);
    expect(keys.length - new Set(keys).size).toBe(0);
  });

  it('only replace a product link with the listing of that very product', () => {
    for (const offer of offers.filter(candidate => candidate.sameAsProduct)) {
      expect(offer.covers, offer.id).toHaveLength(1);
      expect(findPart(offer.covers[0]?.partId ?? '')?.product, `${offer.id}: the part has no manufacturer product`).not.toBeNull();
    }
  });

  it('link to an https page of a shop', () => {
    for (const offer of offers.filter(candidate => candidate.network === 'awin')) expect(new URL(offer.productUrl).protocol).toBe('https:');
  });

  it('ships with no account, so that no affiliate link appears until the owner adds one', () => {
    expect(AFFILIATE_ACCOUNTS).toEqual({ amazon: { DE: null, US: null }, awin: { publisherId: null } });
  });
});

describe('links', () => {
  it('builds Amazon product, search and cart links with the tag, and Awin’s tracked link', () => {
    expect(amazonProductUrl('B08BCRZZS3', 'DE', 'canfactory-21')).toBe('https://www.amazon.de/dp/B08BCRZZS3?tag=canfactory-21');
    expect(amazonProductUrl('B08BCRZZS3', 'US', 'canfactory-20')).toBe('https://www.amazon.com/dp/B08BCRZZS3?tag=canfactory-20');
    expect(amazonSearchUrl({ designation: 'ISO 4762 M3 × 10', product: null }, 'DE', 'canfactory-21')).toBe('https://www.amazon.de/s?k=ISO%204762%20M3%20%C3%97%2010&tag=canfactory-21');
    expect(amazonSearchUrl({ designation: 'ruthex RX-M3x5.7', product: { manufacturer: 'ruthex', sku: 'RX-M3x5.7', url: '' } }, 'US', 't-20')).toBe('https://www.amazon.com/s?k=ruthex%20RX-M3x5.7&tag=t-20');
    expect(amazonCartUrl([{ asin: 'B08BCRZZS3', quantity: 2 }, { asin: 'B088QJG676', quantity: 1 }], 'DE', 'canfactory-21'))
      .toBe('https://www.amazon.de/gp/aws/cart/add.html?ASIN.1=B08BCRZZS3&Quantity.1=2&ASIN.2=B088QJG676&Quantity.2=1&AssociateTag=canfactory-21');
    expect(awinFallbackUrl(777, 12345, 'https://shop.example/a?b=1')).toBe('https://www.awin1.com/cread.php?awinmid=777&awinaffid=12345&ued=https%3A%2F%2Fshop.example%2Fa%3Fb%3D1');
  });

  it('chooses the market by country: DACH shops on amazon.de, everyone else on amazon.com', () => {
    expect(['DE', 'AT', 'CH', 'de'].map(marketOfCountry)).toEqual(['DE', 'DE', 'DE', 'DE']);
    expect(['US', 'FR', 'GB', 'XX', null, undefined].map(marketOfCountry)).toEqual(['US', 'US', 'US', 'US', 'US', 'US']);
  });
});

describe('product matcher', () => {
  const now = Date.parse('2026-10-06T12:00:00Z');

  it('offers nothing while the market has no account', () => {
    const result = matchOffers([{ partId: 'ruthex-rx-m3x5-7', quantity: 4 }], 'DE', { findPart, now });
    expect(result.networks).toEqual({ amazon: false, awin: false });
    expect(result.matches).toEqual([{ partId: 'ruthex-rx-m3x5-7', quantity: 4, offers: [] }]);
    expect(result.shops).toEqual([]);
    expect(Value.Check(OffersSchema, result)).toBe(true);
  });

  it('ranks the curated offers, rounds up to packs, and searches Amazon for a part with none', () => {
    const result = matchOffers([{ partId: 'ruthex-rx-m3x5-7', quantity: 150 }, { partId: 'iso-4762-m3x10', quantity: 4 }], 'DE', { findPart, now, accounts });
    expect(Value.Check(OffersSchema, result)).toBe(true);
    const [inserts, screws] = result.matches;
    expect(inserts?.offers.map(offer => [offer.asin, offer.packs])).toEqual([['B08BCRZZS3', 2], ['B08K1BVGN9', 2]]);
    expect(inserts?.offers[0]?.url).toBe('https://www.amazon.de/dp/B08BCRZZS3?tag=canfactory-21');
    expect(inserts?.offers[0]?.price).toBeNull();
    expect(screws?.offers).toHaveLength(1);
    expect(screws?.offers[0]).toMatchObject({ kind: 'search', shopKey: 'amazon-DE', offerId: null, url: expect.stringContaining('https://www.amazon.de/s?k=') as unknown });
    expect(result.shops.map(shop => [shop.shopKey, shop.lines.length, shop.cartUrl])).toEqual([['amazon-DE', 2, null]]);
  });

  it('buys an assortment once, in enough packs for every part it covers', () => {
    const box = offers.find(offer => offer.id === 'amazon-de-b08k1bvgn9');
    if (!box) throw new Error('The ruthex box is curated.');
    const result = matchOffers([{ partId: 'ruthex-rx-m2x4', quantity: 10 }, { partId: 'ruthex-rx-m3x5-7', quantity: 150 }, { partId: 'ruthex-rx-m2x4', quantity: 70 }], 'DE',
      { findPart, now, accounts, catalogue: [{ ...box, rank: 0 }] });
    expect(result.matches.map(match => [match.partId, match.quantity])).toEqual([['ruthex-rx-m2x4', 80], ['ruthex-rx-m3x5-7', 150]]);
    expect(result.shops).toHaveLength(1);
    expect(result.shops[0]?.lines.map(line => [line.offer.asin, line.packs, line.partIds])).toEqual([['B08K1BVGN9', 2, ['ruthex-rx-m2x4', 'ruthex-rx-m3x5-7']]]);
  });

  it('shows an Awin price with its time while the feed is fresh, and after 72 h only the link', () => {
    const catalogue = [awin()];
    const fresh = matchOffers([{ partId: 'ruthex-rx-m3x5-7', quantity: 30 }], 'DE', { findPart, now, accounts, catalogue, live: [live()] });
    expect(fresh.matches[0]?.offers[0]).toMatchObject({ shop: 'Test Shop', shopKey: 'awin-777', packs: 2, inStock: true, url: live().deepLink,
      price: { amount: 4.99, currency: 'EUR', deliveryCost: 3.95, asOf: '2026-10-06T08:00:00.000Z' } });
    const stale = matchOffers([{ partId: 'ruthex-rx-m3x5-7', quantity: 30 }], 'DE', { findPart, now: live().lastImported + AWIN_PRICE_MAX_AGE_MS, accounts, catalogue, live: [live()] });
    expect(stale.matches[0]?.offers[0]).toMatchObject({ price: null, inStock: null, url: live().deepLink });
    const missing = matchOffers([{ partId: 'ruthex-rx-m3x5-7', quantity: 30 }], 'DE', { findPart, now, accounts, catalogue });
    expect(missing.matches[0]?.offers[0]?.url).toBe('https://www.awin1.com/cread.php?awinmid=777&awinaffid=12345&ued=https%3A%2F%2Fshop.example%2Fm3');
  });

  it('puts Awin offers without a fresh price or out of stock after the others', () => {
    const catalogue = [awin(), ...offers.filter(offer => offer.market === 'DE')];
    const order = (row: AwinLive) => matchOffers([{ partId: 'ruthex-rx-m3x5-7', quantity: 1 }], 'DE', { findPart, now, accounts, catalogue, live: [row] }).matches[0]?.offers.map(offer => offer.shopKey);
    // Fresh and in stock, it keeps its place by rank (0, tied with the single pack, then by id) before the box (rank 1).
    expect(order(live())).toEqual(['amazon-DE', 'awin-777', 'amazon-DE']);
    expect(order(live({ inStock: false }))).toEqual(['amazon-DE', 'amazon-DE', 'awin-777']);
    expect(order(live({ price: null }))).toEqual(['amazon-DE', 'amazon-DE', 'awin-777']);
  });

  it('leaves out a network without an account', () => {
    const catalogue = [awin(), ...offers];
    const amazonOnly = matchOffers([{ partId: 'ruthex-rx-m3x5-7', quantity: 1 }], 'DE', { findPart, now, catalogue, accounts: { ...accounts, awin: { publisherId: null } } });
    expect(amazonOnly.networks).toEqual({ amazon: true, awin: false });
    expect(amazonOnly.matches[0]?.offers.every(offer => offer.network === 'amazon')).toBe(true);
    const awinOnly = matchOffers([{ partId: 'iso-4762-m3x10', quantity: 1 }], 'DE', { findPart, now, catalogue, accounts: { ...accounts, amazon: { DE: null, US: null } } });
    expect(awinOnly.matches[0]?.offers).toEqual([]);
  });
});

describe('bills of materials', () => {
  it('counts the real-world objects of a model’s assembly for its settings', () => {
    const magnets = modelBom(cigaretteCase, { ...cigaretteCase.defaults, snap: 'magnet' });
    expect(magnets[0]).toEqual({ partId: 'bic-j25-mini-lighter', quantity: 1 });
    expect(magnets.slice(1).every(line => findPart(line.partId)?.family === 'magnet' && line.quantity > 0)).toBe(true);
    expect(magnets.length).toBeGreaterThan(1);
    for (const model of models) for (const line of modelBom(model, model.defaults)) expect(findPart(line.partId), `${model.id}: ${line.partId}`).toBeDefined();
  });

  it('sums a parts list by library part', () => {
    expect(bomRequirements([
      { id: 'a', group: 'Hardware', name: 'Screw', quantity: 4, size: '', use: '', partId: 'iso-4762-m3x10' },
      { id: 'b', group: 'Timber', name: 'Batten', quantity: 2, size: '', use: '' },
      { id: 'c', group: 'Hardware', name: 'Screw', quantity: 2, size: '', use: '', partId: 'iso-4762-m3x10' },
    ])).toEqual([{ partId: 'iso-4762-m3x10', quantity: 6 }]);
    expect(countParts([{ partId: 'a', quantity: 1 }, { partId: 'b', quantity: 1 }, { partId: 'a', quantity: 2 }])).toEqual([{ partId: 'a', quantity: 3 }, { partId: 'b', quantity: 1 }]);
  });
});
