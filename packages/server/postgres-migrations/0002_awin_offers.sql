-- The offers service: the products of Awin advertisers' feeds that curated offers point to (packages/contracts/src/parts/offers.ts).
-- Additive: it creates two new tables and changes none.
CREATE TABLE awin_feeds (
  feed_id bigint PRIMARY KEY,
  advertiser_id bigint NOT NULL,
  last_imported bigint NOT NULL,
  fetched_at bigint NOT NULL
);
CREATE TABLE awin_offers (
  advertiser_id bigint NOT NULL,
  merchant_product_id text NOT NULL,
  market text NOT NULL CHECK (market IN ('DE', 'US')),
  feed_id bigint NOT NULL,
  deep_link text NOT NULL,
  name text NOT NULL,
  price double precision,
  currency text,
  delivery_cost double precision,
  in_stock boolean,
  last_imported bigint NOT NULL,
  fetched_at bigint NOT NULL,
  PRIMARY KEY (advertiser_id, merchant_product_id, market)
);
CREATE INDEX awin_offers_feed ON awin_offers(feed_id);
