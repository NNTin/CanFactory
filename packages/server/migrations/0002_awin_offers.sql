-- The offers service: the products of Awin advertisers' feeds that curated offers point to (packages/contracts/src/parts/offers.ts).
CREATE TABLE awin_feeds (
  feed_id INTEGER PRIMARY KEY NOT NULL, advertiser_id INTEGER NOT NULL,
  last_imported INTEGER NOT NULL, fetched_at INTEGER NOT NULL
);
CREATE TABLE awin_offers (
  advertiser_id INTEGER NOT NULL, merchant_product_id TEXT NOT NULL, market TEXT NOT NULL CHECK (market IN ('DE', 'US')),
  feed_id INTEGER NOT NULL, deep_link TEXT NOT NULL, name TEXT NOT NULL,
  price REAL, currency TEXT, delivery_cost REAL, in_stock INTEGER,
  last_imported INTEGER NOT NULL, fetched_at INTEGER NOT NULL,
  PRIMARY KEY (advertiser_id, merchant_product_id, market)
);
CREATE INDEX awin_offers_feed ON awin_offers(feed_id);
