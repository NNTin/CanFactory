import { Readable } from 'node:stream';
import type { ReadableStream as WebReadableStream } from 'node:stream/web';
import { createGunzip } from 'node:zlib';
import { offers as curatedOffers, type AwinLive, type AwinOffer, type Market, type Offer } from '@canfactory/contracts';

/** One curated Awin product, as the offers service stores and looks it up. */
export interface AwinOfferKey { advertiserId: number; merchantProductId: string; market: Market }
/** What the offers service last stored of a feed: when Awin had imported it then. */
export interface AwinFeedState { feedId: number; advertiserId: number; lastImported: number }

/** The storage the ingest job needs (see `Storage`). */
export interface AwinStore {
  awinFeeds(): Promise<AwinFeedState[]>;
  saveAwinFeed(feed: AwinFeedState, rows: readonly AwinLive[]): Promise<void>;
}

/** CSV as RFC 4180 writes it (quoted fields may hold commas, quotes and line breaks), parsed as it streams in. */
export class CsvParser {
  private row: string[] = [];
  private field = '';
  private quoted = false;
  private quoteSeen = false;
  constructor(private readonly delimiter = ',') {}
  /** The records this text completes. */
  push(text: string): string[][] {
    const records: string[][] = [];
    for (const character of text) {
      if (this.quoted) {
        if (this.quoteSeen) {
          this.quoteSeen = false;
          if (character === '"') { this.field += '"'; continue; }
          this.quoted = false;
        } else {
          if (character === '"') this.quoteSeen = true; else this.field += character;
          continue;
        }
      }
      if (character === '"' && this.field === '') this.quoted = true;
      else if (character === this.delimiter) { this.row.push(this.field); this.field = ''; }
      else if (character === '\n') { this.row.push(this.field); records.push(this.row); this.row = []; this.field = ''; }
      else if (character !== '\r') this.field += character;
    }
    return records;
  }
  /** The last record, when the text does not end with a line break. */
  end(): string[][] {
    this.quoted = false; this.quoteSeen = false;
    if (this.field === '' && this.row.length === 0) return [];
    const last = [...this.row, this.field];
    this.row = []; this.field = '';
    return [last];
  }
}

export function parseCsv(text: string): string[][] {
  const parser = new CsvParser();
  return [...parser.push(text), ...parser.end()];
}

/** A column name as a key: lower case, letters and digits only (“Advertiser ID” → `advertiserid`). */
const key = (name: string) => name.toLowerCase().replace(/[^a-z0-9]/g, '');

/** Awin's times (“2026-07-09 07:07:32”) are UTC. */
export function awinTime(value: string): number {
  return Date.parse(`${value.trim().replace(' ', 'T')}Z`);
}

export interface FeedListEntry { advertiserId: number; advertiserName: string; feedId: number; membership: string; lastImported: number; url: string }

/** Awin's product feed list (`productdata.awin.com/datafeed/list/apikey/<key>`): every feed the account can download. */
export function parseFeedList(text: string): FeedListEntry[] {
  const [header, ...rows] = parseCsv(text);
  if (!header) return [];
  const column = (name: string) => header.findIndex(cell => key(cell) === name);
  const at = { advertiserId: column('advertiserid'), advertiserName: column('advertisername'), feedId: column('feedid'), membership: column('membershipstatus'), lastImported: column('lastimported'), url: column('url') };
  if (at.advertiserId < 0 || at.feedId < 0 || at.lastImported < 0 || at.url < 0) throw new Error('The Awin feed list has no Advertiser ID, Feed ID, Last Imported or URL column.');
  return rows.flatMap(row => {
    const entry = { advertiserId: Number(row[at.advertiserId]), advertiserName: row[at.advertiserName] ?? '', feedId: Number(row[at.feedId]),
      membership: row[at.membership] ?? '', lastImported: awinTime(row[at.lastImported] ?? ''), url: row[at.url] ?? '' };
    return Number.isInteger(entry.advertiserId) && Number.isInteger(entry.feedId) && Number.isFinite(entry.lastImported) && entry.url.startsWith('https://') ? [entry] : [];
  });
}

/** A feed's download link with this account's datafeed key (the list may show it masked). */
export function feedDownloadUrl(url: string, datafeedKey: string): string {
  return url.replace(/\/apikey\/[^/]+\//, `/apikey/${encodeURIComponent(datafeedKey)}/`);
}

const number = (value: string | undefined): number | null => {
  if (value === undefined || value.trim() === '') return null;
  const parsed = Number(value.trim());
  return Number.isFinite(parsed) ? parsed : null;
};
const stock = (value: string | undefined): boolean | null => {
  const text = value?.trim().toLowerCase() ?? '';
  if (['1', 'yes', 'true', 'in stock', 'instock'].includes(text)) return true;
  if (['0', 'no', 'false', 'out of stock', 'outofstock'].includes(text)) return false;
  return null;
};

/**
 * Turns a feed's records into the rows of the curated offers it holds: one per offer whose advertiser and `merchant_product_id`
 * match, priced from `search_price` (else `store_price`), as of the feed's import.
 */
export class FeedRows {
  private header: string[] | null = null;
  readonly rows: AwinLive[] = [];
  readonly found = new Set<AwinOffer>();
  constructor(private readonly advertiserId: number, private readonly wanted: readonly AwinOffer[], private readonly lastImported: number) {}
  add(records: readonly string[][]): void {
    for (const record of records) {
      if (!this.header) { this.header = record.map(key); continue; }
      const cell = (name: string) => { const index = this.header?.indexOf(name) ?? -1; return index < 0 ? undefined : record[index]; };
      const productId = cell('merchantproductid');
      const offers = this.wanted.filter(offer => offer.merchantProductId === productId);
      const deepLink = cell('awdeeplink') ?? '';
      if (offers.length === 0 || !deepLink.startsWith('https://')) continue;
      for (const offer of offers) {
        this.found.add(offer);
        this.rows.push({
          advertiserId: this.advertiserId, merchantProductId: offer.merchantProductId, market: offer.market, deepLink, name: cell('productname') ?? '',
          price: number(cell('searchprice')) ?? number(cell('storeprice')), currency: cell('currency')?.trim() || null, deliveryCost: number(cell('deliverycost')),
          inStock: stock(cell('instock')) ?? stock(cell('stockstatus')), lastImported: this.lastImported,
        });
      }
    }
  }
}

export interface IngestOptions {
  store: AwinStore;
  datafeedKey: string;
  catalogue?: readonly Offer[];
  fetch?: (url: string) => Promise<Response>;
  log?: (message: string) => void;
  sleep?: (ms: number) => Promise<void>;
  /** Wait 10 s to 2 min before the first request, as Awin asks of scheduled jobs (its servers are busiest on the minute). */
  jitter?: boolean;
  /** How long to wait before the one retry of a failed download (Awin: 5 minutes). */
  retryDelayMs?: number;
}
export interface IngestResult { checked: number; downloaded: number; rows: number; unchanged: number; missing: string[] }

export const AWIN_FEED_LIST_URL = (datafeedKey: string) => `https://productdata.awin.com/datafeed/list/apikey/${encodeURIComponent(datafeedKey)}`;

/**
 * The offers service's job: download Awin's feed list, then every feed of an advertiser with curated offers that Awin has
 * imported since the last run, and store the rows of the curated products (replacing what that feed held before). Feeds that
 * have not changed are not downloaded again, so each feed is fetched at most once per run.
 */
export async function ingestAwin(options: IngestOptions): Promise<IngestResult> {
  const { store, datafeedKey, catalogue = curatedOffers, fetch: get = (url: string) => fetch(url), log = () => undefined,
    sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms)), jitter = true, retryDelayMs = 300_000 } = options;
  const result: IngestResult = { checked: 0, downloaded: 0, rows: 0, unchanged: 0, missing: [] };
  const wanted = catalogue.filter((offer): offer is AwinOffer => offer.network === 'awin');
  if (wanted.length === 0) { log('No curated Awin offers: nothing to fetch.'); return result; }
  if (jitter) await sleep(10_000 + Math.random() * 110_000);
  const download = async (url: string): Promise<Response> => {
    for (let attempt = 0; ; attempt++) {
      try {
        const response = await get(url);
        if (response.ok && response.body) return response;
        throw new Error(`HTTP ${response.status}`);
      } catch (error) {
        if (attempt > 0) throw error;
        log(`Download failed (${error instanceof Error ? error.message : String(error)}); retrying in ${Math.round(retryDelayMs / 1000)} s.`);
        await sleep(retryDelayMs);
      }
    }
  };

  const list = parseFeedList(await (await download(AWIN_FEED_LIST_URL(datafeedKey))).text());
  const stored = new Map((await store.awinFeeds()).map(feed => [feed.feedId, feed.lastImported]));
  const advertisers = [...new Set(wanted.map(offer => offer.advertiserId))];
  for (const advertiserId of advertisers) {
    const mine = wanted.filter(offer => offer.advertiserId === advertiserId);
    const feeds = list.filter(entry => entry.advertiserId === advertiserId);
    if (feeds.length === 0) { log(`Advertiser ${advertiserId}: no feed in the list (not joined, or it has none).`); continue; }
    const found = new Set<AwinOffer>();
    let unchanged = 0;
    for (const feed of feeds) {
      result.checked++;
      if ((stored.get(feed.feedId) ?? -1) >= feed.lastImported) { result.unchanged++; unchanged++; continue; }
      const url = feedDownloadUrl(feed.url, datafeedKey);
      const response = await download(url);
      const body = Readable.fromWeb(response.body as unknown as WebReadableStream<Uint8Array>);
      const stream = /\/compression\/gzip\//.test(url) ? body.pipe(createGunzip()) : body;
      const parser = new CsvParser();
      const rows = new FeedRows(advertiserId, mine, feed.lastImported);
      const decoder = new TextDecoder();
      for await (const chunk of stream as AsyncIterable<Uint8Array>) rows.add(parser.push(decoder.decode(chunk, { stream: true })));
      rows.add(parser.push(decoder.decode()));
      rows.add(parser.end());
      await store.saveAwinFeed({ feedId: feed.feedId, advertiserId, lastImported: feed.lastImported }, rows.rows);
      for (const offer of rows.found) found.add(offer);
      result.downloaded++; result.rows += rows.rows.length;
      log(`Advertiser ${advertiserId} (${feed.advertiserName}), feed ${feed.feedId}: ${rows.rows.length} curated products, imported ${new Date(feed.lastImported).toISOString()}.`);
    }
    // Only when every feed of the advertiser was read this run is a product known to be missing.
    if (unchanged === 0) for (const offer of mine.filter(candidate => !found.has(candidate))) {
      result.missing.push(offer.id);
      log(`Offer ${offer.id}: product ${offer.merchantProductId} is not in advertiser ${advertiserId}'s feeds; it links without a price.`);
    }
  }
  return result;
}
