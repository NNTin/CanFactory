import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Offer } from '@canfactory/contracts';
import { AWIN_FEED_LIST_URL, CsvParser, awinTime, feedDownloadUrl, ingestAwin, parseCsv, parseFeedList } from './awin.ts';
import { LocalStorage } from './storage.ts';
import { repositoryRoot, Store } from './store.ts';

const offer = (id: string, merchantProductId: string, market: 'DE' | 'US' = 'DE', advertiserId = 777): Offer => ({
  id, market, network: 'awin', advertiserId, shop: 'Test Shop', merchantProductId, productUrl: `https://shop.example/${merchantProductId}`,
  title: id, covers: [{ partId: 'ruthex-rx-m3x5-7', quantity: 25 }], rank: 0, checkedOn: '2026-10-06', note: null, sameAsProduct: false,
});
const FEED_URL = 'https://datafeed.api.productserve.com/datafeed/download/apikey/_apikey_here_/fid/42/format/csv/language/de/delimiter/%2C/compression/gzip/columns/aw_deep_link%2Cproduct_name/';
const list = (lastImported: string) => `"Advertiser ID","Advertiser Name","Primary Region","Membership Status","Feed ID","Feed Name","Language","Vertical","Last Imported","Last Checked","No of products","URL"
777,"Test Shop",DE,Joined,42,Default,German,,"${lastImported}","${lastImported}",3,"${FEED_URL}"
9,Other,GB,"Not Joined",9,Default,English,,"2026-07-09 07:07:32","2026-07-09 07:07:32",5,"https://datafeed.api.productserve.com/datafeed/download/apikey/x/fid/9/"
`;
const feed = gzipSync(`aw_deep_link,product_name,merchant_product_id,merchant_id,search_price,store_price,currency,delivery_cost,in_stock,description
https://www.awin1.com/pclick.php?p=1&a=1&m=777,"ruthex M3, 100 pieces",SKU-1,777,4.99,5.49,EUR,3.95,1,"A ""quoted"" description
over two lines"
https://www.awin1.com/pclick.php?p=2&a=1&m=777,Other product,SKU-9,777,1.00,,EUR,,0,
https://www.awin1.com/pclick.php?p=3&a=1&m=777,M3 inserts US,SKU-2,777,,6.50,USD,,,
`);

describe('Awin feeds', () => {
  it('parses quoted CSV fields across chunks, with commas, quotes and line breaks', () => {
    expect(parseCsv('a,"b,1","c ""x""\ny"\r\n1,,3')).toEqual([['a', 'b,1', 'c "x"\ny'], ['1', '', '3']]);
    const parser = new CsvParser();
    const text = 'a,"q""uote",z\n"split\nfield",2,3\n';
    const records = Array.from({ length: text.length }, (_, index) => text.charAt(index)).flatMap(character => parser.push(character));
    expect([...records, ...parser.end()]).toEqual([['a', 'q"uote', 'z'], ['split\nfield', '2', '3']]);
  });

  it('reads the feed list and puts the account’s key into the download link', () => {
    const entries = parseFeedList(list('2026-10-06 08:00:00'));
    expect(entries.map(entry => [entry.advertiserId, entry.feedId, entry.membership, entry.lastImported])).toEqual([
      [777, 42, 'Joined', Date.parse('2026-10-06T08:00:00Z')], [9, 9, 'Not Joined', Date.parse('2026-07-09T07:07:32Z')]]);
    expect(feedDownloadUrl(FEED_URL, 'secret')).toContain('/apikey/secret/fid/42/');
    expect(awinTime('2026-10-06 08:00:00')).toBe(Date.parse('2026-10-06T08:00:00Z'));
    expect(() => parseFeedList('a,b\n1,2\n')).toThrow(/Feed ID/);
  });
});

describe('ingestAwin', () => {
  let directory: string;
  let store: LocalStorage;
  beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), 'canfactory-awin-test-'));
    const local = new Store(directory, repositoryRoot); local.migrate();
    store = new LocalStorage(local);
  });
  afterEach(async () => { await store.close(); rmSync(directory, { recursive: true, force: true }); });

  const run = (lastImported: string, catalogue: Offer[], requested: string[] = [], failures = 0) => {
    let failing = failures;
    return ingestAwin({ store, datafeedKey: 'secret', catalogue, jitter: false, sleep: () => Promise.resolve(), log: () => undefined, fetch: url => {
      requested.push(url);
      if (failing > 0) { failing--; return Promise.resolve(new Response('busy', { status: 503 })); }
      return Promise.resolve(url === AWIN_FEED_LIST_URL('secret') ? new Response(list(lastImported)) : new Response(feed));
    } });
  };

  it('stores the curated products of a changed feed, as of its import, and skips it until Awin imports it again', async () => {
    const catalogue = [offer('awin-de-sku-1', 'SKU-1'), offer('awin-us-sku-2', 'SKU-2', 'US'), offer('awin-de-gone', 'SKU-404')];
    const requested: string[] = [];
    const first = await run('2026-10-06 08:00:00', catalogue, requested);
    expect(first).toEqual({ checked: 1, downloaded: 1, rows: 2, unchanged: 0, missing: ['awin-de-gone'] });
    expect(requested).toEqual([AWIN_FEED_LIST_URL('secret'), FEED_URL.replace('_apikey_here_', 'secret')]);
    const asOf = Date.parse('2026-10-06T08:00:00Z');
    expect(await store.awinOffers([{ advertiserId: 777, merchantProductId: 'SKU-1', market: 'DE' }, { advertiserId: 777, merchantProductId: 'SKU-2', market: 'US' }, { advertiserId: 777, merchantProductId: 'SKU-404', market: 'DE' }])).toEqual([
      { advertiserId: 777, merchantProductId: 'SKU-1', market: 'DE', deepLink: 'https://www.awin1.com/pclick.php?p=1&a=1&m=777', name: 'ruthex M3, 100 pieces', price: 4.99, currency: 'EUR', deliveryCost: 3.95, inStock: true, lastImported: asOf },
      { advertiserId: 777, merchantProductId: 'SKU-2', market: 'US', deepLink: 'https://www.awin1.com/pclick.php?p=3&a=1&m=777', name: 'M3 inserts US', price: 6.5, currency: 'USD', deliveryCost: null, inStock: null, lastImported: asOf },
    ]);
    expect(await run('2026-10-06 08:00:00', catalogue)).toEqual({ checked: 1, downloaded: 0, rows: 0, unchanged: 1, missing: [] });
    // A newer import replaces what the feed held: an offer that leaves the catalogue loses its row.
    expect((await run('2026-10-06 09:00:00', [offer('awin-de-sku-1', 'SKU-1')])).rows).toBe(1);
    expect(await store.awinOffers([{ advertiserId: 777, merchantProductId: 'SKU-2', market: 'US' }])).toEqual([]);
    expect(await store.awinFeeds()).toEqual([{ feedId: 42, advertiserId: 777, lastImported: Date.parse('2026-10-06T09:00:00Z') }]);
  });

  it('retries a failed download once, and fetches nothing without curated Awin offers', async () => {
    const requested: string[] = [];
    expect((await run('2026-10-06 08:00:00', [offer('awin-de-sku-1', 'SKU-1')], requested, 1)).rows).toBe(1);
    expect(requested[0]).toBe(requested[1]);
    await expect(run('2026-10-06 10:00:00', [offer('awin-de-sku-1', 'SKU-1')], [], 2)).rejects.toThrow(/503/);
    const none: string[] = [];
    expect(await run('2026-10-06 08:00:00', [], none)).toEqual({ checked: 0, downloaded: 0, rows: 0, unchanged: 0, missing: [] });
    expect(none).toEqual([]);
  });
});
