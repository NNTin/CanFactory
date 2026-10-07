import { useEffect, useState, useSyncExternalStore } from 'react';
import { api } from '@canfactory/client';
import { countParts, formatOfferParts, MARKETS, type Market, type MarketInfo, type Offers, type Requirement } from '@canfactory/contracts';

/**
 * The visitor's market and buy list, kept in this browser only (localStorage, see the privacy page), and the offers of the API
 * for them. See docs/affiliate-offers.md.
 */
const MARKET_KEY = 'canfactory.market';
const BUY_LIST_KEY = 'canfactory.buy-list';
const CHANGE = 'canfactory:shopping';

function read(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}
function write(key: string, value: string | null): void {
  try { if (value === null) localStorage.removeItem(key); else localStorage.setItem(key, value); } catch { /* Optional local storage. */ }
  window.dispatchEvent(new Event(CHANGE));
}
function subscribe(listener: () => void): () => void {
  window.addEventListener(CHANGE, listener); window.addEventListener('storage', listener);
  return () => { window.removeEventListener(CHANGE, listener); window.removeEventListener('storage', listener); };
}

let marketInfo: MarketInfo | null = null;
let marketRequest: Promise<void> | null = null;
/** The API's view of the visitor's market (by country), fetched once per page load. */
function loadMarketInfo(): void {
  marketRequest ??= api.GET('/api/v1/market').then(response => {
    if (response.data) { marketInfo = response.data; window.dispatchEvent(new Event(CHANGE)); }
  }).catch(() => { /* Without it, no offers are shown. */ });
}
const chosenMarket = (): Market | null => { const value = read(MARKET_KEY); return MARKETS.find(market => market === value) ?? null; };

export interface MarketState {
  /** The visitor's choice, else the market of their country; null until the API has answered. */
  market: Market | null;
  info: MarketInfo | null;
  /** Whether any network links in any market: without, the site shows no affiliate links at all. */
  enabled: boolean;
  /** Whether a network links in the current market. */
  linking: boolean;
  choose: (market: Market) => void;
}

export function useMarket(): MarketState {
  useEffect(loadMarketInfo, []);
  const info = useSyncExternalStore(subscribe, () => marketInfo);
  const chosen = useSyncExternalStore(subscribe, chosenMarket);
  const market = info ? chosen ?? info.market : null;
  const networks = info && market ? info.networks[market] : null;
  return {
    market, info,
    enabled: info !== null && MARKETS.some(candidate => info.networks[candidate].amazon || info.networks[candidate].awin),
    linking: networks !== null && (networks.amazon || networks.awin),
    choose: next => write(MARKET_KEY, next),
  };
}

const offerCache = new Map<string, { at: number; offers: Promise<Offers | null> }>();
/** The offers for these parts in a market (cached for five minutes, as the API's responses are). */
export function useOffers(requirements: readonly Requirement[], market: Market | null, linking: boolean): Offers | null {
  const parts = formatOfferParts(countParts(requirements).slice(0, 200));
  const [offers, setOffers] = useState<{ key: string; value: Offers | null } | null>(null);
  const key = market && linking && parts ? `${market}|${parts}` : null;
  useEffect(() => {
    if (!key || !market) return;
    let cached = offerCache.get(key);
    if (!cached || Date.now() - cached.at > 300_000) {
      cached = { at: Date.now(), offers: api.GET('/api/v1/offers', { params: { query: { market, parts } } }).then(response => response.data ?? null).catch(() => null) };
      offerCache.set(key, cached);
    }
    let current = true;
    void cached.offers.then(value => { if (current) setOffers({ key, value }); });
    return () => { current = false; };
  }, [key, market, parts]);
  return key && offers?.key === key ? offers.value : null;
}

/** Where a buy-list item was added: a model, a catio page, or the parts library. */
export interface BuyListSource { kind: 'model' | 'concept' | 'part'; id: string; label: string }
export interface BuyListItem { partId: string; quantity: number; from: BuyListSource }

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;
const isItem = (value: unknown): value is BuyListItem => {
  if (!isRecord(value) || !isRecord(value['from'])) return false;
  const { partId, quantity, from } = value;
  return typeof partId === 'string' && typeof quantity === 'number' && Number.isInteger(quantity) && quantity > 0 && quantity <= 9999
    && typeof from['kind'] === 'string' && ['model', 'concept', 'part'].includes(from['kind']) && typeof from['id'] === 'string' && typeof from['label'] === 'string';
};
let listText: string | null = null;
let listItems: BuyListItem[] = [];
function buyList(): BuyListItem[] {
  const text = read(BUY_LIST_KEY);
  if (text !== listText) {
    listText = text;
    try { const parsed: unknown = text ? JSON.parse(text) : []; listItems = Array.isArray(parsed) ? parsed.filter(isItem) : []; } catch { listItems = []; }
  }
  return listItems;
}
const save = (items: readonly BuyListItem[]) => write(BUY_LIST_KEY, items.length > 0 ? JSON.stringify(items) : null);

/** The buy list: parts gathered from models, catio pages and the parts library, in this browser. */
export function useBuyList(): BuyListItem[] {
  return useSyncExternalStore(subscribe, buyList);
}
/** Adds parts from one source; adding the same source again replaces what it added before (its settings may have changed). */
export function addToBuyList(from: BuyListSource, requirements: readonly Requirement[]): void {
  const kept = buyList().filter(item => item.from.kind !== from.kind || item.from.id !== from.id
    || (from.kind === 'part' && !requirements.some(requirement => requirement.partId === item.partId)));
  save([...kept, ...countParts(requirements).map(requirement => ({ ...requirement, quantity: Math.min(9999, requirement.quantity), from }))]);
}
export function setBuyListQuantity(partId: string, from: BuyListSource, quantity: number): void {
  save(buyList().flatMap(item => item.partId === partId && item.from.kind === from.kind && item.from.id === from.id
    ? quantity > 0 ? [{ ...item, quantity: Math.min(9999, Math.round(quantity)) }] : [] : [item]));
}
export function removeFromBuyList(partId: string): void { save(buyList().filter(item => item.partId !== partId)); }
export function clearBuyList(): void { save([]); }
