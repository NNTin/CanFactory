import { useState, type ReactNode } from 'react';
import { ExternalLink, ShoppingBasket, Trash2 } from 'lucide-react';
import { findPart, MARKETS, type Market, type Offers, type ProductOffer, type Requirement } from '@canfactory/contracts';
import { formatHash } from './route.ts';
import { addToBuyList, clearBuyList, removeFromBuyList, setBuyListQuantity, useBuyList, useMarket, useOffers, type BuyListSource } from './shopping.ts';

const MARKET_TEXT: Record<Market, string> = { DE: 'Germany · amazon.de', US: 'United States · amazon.com' };
const LOCALE: Record<Market, string> = { DE: 'de-DE', US: 'en-US' };
const partHref = (partId: string) => formatHash({ view: 'parts', family: findPart(partId)?.family ?? null, part: partId, filters: {} });
const partName = (partId: string) => findPart(partId)?.title ?? partId;

/** Says the links are affiliate links, wherever offers are shown (Amazon: “clearly and prominently”). */
export function AffiliateNote() {
  return <p className="affiliate-note">Affiliate links: CanFactory may earn a commission when you buy through them. <a href={formatHash({ view: 'disclosure' })}>Disclosure</a></p>;
}

export function MarketPicker({ market, choose }: { market: Market; choose: (market: Market) => void }) {
  return <label className="market-picker">Shop in <select aria-label="Shop in" value={market} onChange={event => choose(event.currentTarget.value as Market)}>
    {MARKETS.map(candidate => <option key={candidate} value={candidate}>{MARKET_TEXT[candidate]}</option>)}</select></label>;
}

/** An Awin price as its feed gives it, with when the feed was imported; prices include VAT in the DE market. */
function Price({ offer, market }: { offer: ProductOffer; market: Market }) {
  if (!offer.price) return null;
  const money = (amount: number) => new Intl.NumberFormat(LOCALE[market], { style: 'currency', currency: offer.price?.currency ?? 'EUR' }).format(amount);
  const asOf = new Intl.DateTimeFormat(LOCALE[market], { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(offer.price.asOf));
  const shipping = offer.price.deliveryCost === null ? 'plus shipping' : offer.price.deliveryCost === 0 ? 'free shipping' : `plus ${money(offer.price.deliveryCost)} shipping`;
  return <span className="offer-price"><strong>{money(offer.price.amount)}</strong> {market === 'DE' ? 'incl. VAT, ' : ''}{shipping}
    <small> · price as of {asOf}; it may have changed since</small>{offer.inStock === false && <small> · out of stock</small>}</span>;
}

export function OfferLink({ offer, children }: { offer: ProductOffer; children?: ReactNode }) {
  return <a className="offer-link" href={offer.url} target="_blank" rel="sponsored noopener">{children ?? offer.shop} <ExternalLink size={11} aria-hidden="true" /></a>;
}

function OfferRow({ offer, market }: { offer: ProductOffer; market: Market }) {
  const pack = offer.kind === 'search' ? null : offer.covers.length > 1 ? 'assortment' : `pack of ${offer.covers[0]?.quantity ?? 1}`;
  return <li className="offer-row">
    <div><span className="offer-title">{offer.title}</span><small>{offer.shop}{pack && ` · ${pack}`}{offer.packs > 1 && ` · ${offer.packs} packs`}</small><Price offer={offer} market={market} /></div>
    <OfferLink offer={offer}>{offer.kind === 'search' ? `Search ${offer.shop}` : `View at ${offer.shop}`}</OfferLink>
  </li>;
}

/** The parts library's “Where to buy” for one part: its offers in the visitor's market, and adding it to the buy list. */
export function WhereToBuy({ partId, offers, market, choose }: { partId: string; offers: Offers | null; market: Market; choose: (market: Market) => void }) {
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);
  const match = offers?.matches.find(candidate => candidate.partId === partId);
  return <section className="where-to-buy" aria-label="Where to buy">
    <div className="where-to-buy-heading"><h3>Where to buy</h3><MarketPicker market={market} choose={choose} /></div>
    {match && match.offers.length > 0 ? <ul className="offer-list">{match.offers.map(offer => <OfferRow key={offer.offerId ?? offer.url} offer={offer} market={market} />)}</ul>
      : <p className="part-unused">{offers ? 'No shop in this market yet.' : 'Looking for shops…'}</p>}
    <div className="buy-list-add"><label>Quantity <input type="number" min={1} max={9999} value={quantity} onChange={event => setQuantity(Math.max(1, Math.min(9999, Math.round(Number(event.currentTarget.value) || 1))))} /></label>
      <button type="button" className="secondary-button" onClick={() => { addToBuyList({ kind: 'part', id: partId, label: partName(partId) }, [{ partId, quantity }]); setAdded(true); }}>
        <ShoppingBasket size={14} /> Add to buy list</button>{added && <a href={formatHash({ view: 'buy-list' })}>See the buy list</a>}</div>
    <AffiliateNote />
  </section>;
}

/**
 * The hardware of a build (a model's settings, or a catio page): each library part with its best offer, and “Add all to buy list”.
 * Hidden while no network links in the visitor's market.
 */
export function Hardware({ requirements, from, title = 'Hardware for this build', intro }: { requirements: readonly Requirement[]; from: BuyListSource; title?: string; intro?: string }) {
  const { market, linking, choose } = useMarket();
  const offers = useOffers(requirements, market, linking);
  const [added, setAdded] = useState(false);
  if (!market || !linking || requirements.length === 0) return null;
  return <section className="hardware" aria-label={title}>
    <div className="where-to-buy-heading"><div><span className="eyebrow">WHERE TO BUY</span><h2>{title}</h2></div><MarketPicker market={market} choose={choose} /></div>
    {intro && <p className="hardware-intro">{intro}</p>}
    <table><thead><tr><th scope="col">Qty</th><th scope="col">Part</th><th scope="col">Buy</th></tr></thead>
      <tbody>{requirements.map(requirement => {
        const best = offers?.matches.find(match => match.partId === requirement.partId)?.offers[0];
        return <tr key={requirement.partId}><td>{requirement.quantity}</td><td><a href={partHref(requirement.partId)}>{partName(requirement.partId)}</a></td>
          <td>{best ? <><OfferLink offer={best}>{best.kind === 'search' ? `Search ${best.shop}` : best.shop}</OfferLink>{best.kind === 'curated' && <small> {best.packs} × {best.title}</small>}</> : <small>{offers ? '—' : '…'}</small>}</td></tr>;
      })}</tbody></table>
    <div className="buy-list-add"><button type="button" className="secondary-button" onClick={() => { addToBuyList(from, requirements); setAdded(true); }}><ShoppingBasket size={14} /> Add all to buy list</button>
      {added && <a href={formatHash({ view: 'buy-list' })}>See the buy list</a>}</div>
    <AffiliateNote />
  </section>;
}

/** The buy list: everything gathered, summed by part, rounded up to packs and grouped by shop. */
export function BuyListPage() {
  const items = useBuyList();
  const { market, linking, choose } = useMarket();
  const requirements = items.map(item => ({ partId: item.partId, quantity: item.quantity }));
  const offers = useOffers(requirements, market, linking);
  const [copied, setCopied] = useState(false);
  const copy = () => {
    const lines = offers?.shops.flatMap(shop => [`${shop.shop}:`, ...shop.lines.map(line => `  ${line.packs} × ${line.offer.title} (${line.partIds.map(partName).join(', ')}) ${line.offer.url}`)]) ?? [];
    void navigator.clipboard.writeText(lines.join('\n')).then(() => setCopied(true)).catch(() => setCopied(false));
  };
  return <section className="buy-list-page">
    <div className="page-heading library-heading"><div><div className="eyebrow">THE BUY LIST</div><h1>Everything to buy, by shop.</h1>
      <p>The parts you added from models, catio pages and the parts library, summed by part and rounded up to whole packs. It stays in this browser.</p></div>
      {market && <MarketPicker market={market} choose={choose} />}</div>
    {items.length === 0 ? <p className="part-hint">Nothing here yet. Add the hardware of a model, a catio page or a part of the parts library.</p> : <>
      {!linking && <p className="part-hint">No shop links in this market yet.</p>}
      {offers?.shops.map(shop => <div className="buy-list-shop" key={shop.shopKey}><h2>{shop.shop}</h2>
        <ul className="offer-list">{shop.lines.map(line => <li className="offer-row" key={line.offer.offerId ?? line.offer.url}>
          <div><span className="offer-title">{line.offer.kind === 'curated' ? `${line.packs} × ${line.offer.title}` : line.offer.title}</span>
            <small>For {line.partIds.map(partId => `${requirements.filter(requirement => requirement.partId === partId).reduce((sum, requirement) => sum + requirement.quantity, 0)} × ${partName(partId)}`).join(', ')}</small>
            {market && <Price offer={line.offer} market={market} />}</div>
          <OfferLink offer={line.offer}>{line.offer.kind === 'search' ? `Search ${line.offer.shop}` : `View at ${line.offer.shop}`}</OfferLink></li>)}</ul>
        {shop.cartUrl && <a className="primary-button cart-link" href={shop.cartUrl} target="_blank" rel="sponsored noopener">Add all to the {shop.shop} basket</a>}</div>)}
      <h2 className="buy-list-sources-title">What you added</h2>
      <table className="buy-list-items"><thead><tr><th scope="col">Qty</th><th scope="col">Part</th><th scope="col">From</th><th scope="col"><span className="sr-only">Remove</span></th></tr></thead>
        <tbody>{items.map(item => <tr key={`${item.from.kind}:${item.from.id}:${item.partId}`}>
          <td><input type="number" aria-label={`Quantity of ${partName(item.partId)}`} min={0} max={9999} value={item.quantity} onChange={event => setBuyListQuantity(item.partId, item.from, Number(event.currentTarget.value))} /></td>
          <td><a href={partHref(item.partId)}>{partName(item.partId)}</a></td>
          <td>{item.from.kind === 'model' ? <a href={formatHash({ view: 'models', model: item.from.id })}>{item.from.label}</a> : item.from.kind === 'concept' ? <a href={`#/concepts/${item.from.id}`}>{item.from.label}</a> : 'Parts library'}</td>
          <td><button type="button" className="text-button" aria-label={`Remove ${partName(item.partId)}`} onClick={() => removeFromBuyList(item.partId)}><Trash2 size={13} /></button></td></tr>)}</tbody></table>
      <div className="buy-list-add"><button type="button" className="secondary-button" disabled={!offers} onClick={copy}>Copy the list</button>{copied && <span>Copied.</span>}
        <button type="button" className="text-button" onClick={clearBuyList}>Clear the list</button></div>
      <AffiliateNote />
    </>}
  </section>;
}

export function DisclosurePage() {
  return <article className="legal-page">
    <div className="eyebrow">DISCLOSURE</div><h1>Affiliate links</h1>
    <p>Some links on CanFactory are affiliate links: when you buy through one, the shop pays CanFactory a commission, and the price you pay does not change. CanFactory chooses the products for their fit to the parts its models are made for; a shop paying a commission does not change which parts a model needs.</p>
    <h2>Amazon</h2>
    <p lang="de">Als Amazon-Partner verdiene ich an qualifizierten Verkäufen.</p>
    <p>As an Amazon Associate I earn from qualifying purchases.</p>
    <p>Amazon links never show a price: prices and availability are on Amazon’s page.</p>
    <h2>Awin</h2>
    <p>Links to other shops go through Awin, an affiliate network, and are advertising (“Werbung”). The prices shown with them come from the shop’s product feed, as of the time shown; they include VAT where the shop sells in Germany, and the price in the shop is the one that counts.</p>
    <p><a href={formatHash({ view: 'privacy' })}>Privacy</a></p>
  </article>;
}

export function PrivacyPage() {
  return <article className="legal-page">
    <div className="eyebrow">PRIVACY</div><h1>Privacy</h1>
    <p>CanFactory has no accounts, sets no cookies of its own, and runs no analytics or third-party scripts.</p>
    <h2>Stored in your browser</h2>
    <p>Your model settings, your buy list and the market you chose are kept in this browser’s local storage, and never sent to CanFactory’s server except as the request for the page you view (a render’s settings, the parts of the buy list to find shops for). Clearing your browser’s site data removes them.</p>
    <h2>Your country</h2>
    <p>To pick the shops of your market, CanFactory reads the country that its network provider, Cloudflare, derives from your IP address. The country is used for that one answer and not stored.</p>
    <h2>Generated files</h2>
    <p>A model you render is kept on the server for one hour, so that the preview and the download are the same file, and then deleted.</p>
    <h2>Shops</h2>
    <p>When you follow a shop link, you leave CanFactory: Amazon, Awin and the shop set their own cookies to credit the purchase to CanFactory, under their own privacy policies.</p>
    <p><a href={formatHash({ view: 'disclosure' })}>Affiliate disclosure</a></p>
  </article>;
}
