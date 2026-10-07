import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, BookOpen, Bolt, CircleAlert, CircleDot, Cog, Disc, ExternalLink, Flame, Hexagon, LoaderCircle, Magnet, Pin, Search, Footprints, Paperclip, Drill, Lock, Anchor, SquareDashedBottom, Circle, WavesVertical, type LucideIcon } from 'lucide-react';
import { api } from '@canfactory/client';
import type { Part, PartFamilyDetail, PartFamilySummary, PartSource } from '@canfactory/contracts';
import { PartsViewer, VIEWER_LIMIT } from './PartsViewer.tsx';
import { formatHash, type Route } from './route.ts';
import { OfferLink, WhereToBuy } from './Shopping.tsx';
import { useMarket, useOffers } from './shopping.ts';

type PartsRoute = Extract<Route, { view: 'parts' }>;

const FAMILY_ICONS: Record<string, LucideIcon> = {
  magnet: Magnet, screw: Bolt, nut: Hexagon, washer: Disc, 'threaded-insert': CircleDot, bearing: Cog, pin: Pin, 'everyday-object': Flame,
  'wood-screw': Drill, nail: Paperclip, 'insert-nut': CircleDot, 'levelling-foot': Footprints, 'toggle-latch': Lock, 'screen-hook': Anchor, 'corner-bracket': SquareDashedBottom,
  'set-screw': Bolt, ball: Circle, spring: WavesVertical,
};
const BASIS_TEXT: Record<string, string> = { standard: 'Standard', manufacturer: 'Manufacturer', estimated: 'Estimated' };
/** Search text is kept with the filters, under this key. */
const SEARCH = 'q';

const byNumber = (a: string, b: string) => a.localeCompare(b, undefined, { numeric: true });
const mm = (value: number | null | undefined) => value === null || value === undefined ? '—' : `${Number(value.toFixed(3))}`;

function matches(part: Part, filters: Record<string, string>): boolean {
  return Object.entries(filters).every(([key, value]) => {
    if (key !== SEARCH) return part.attributes[key] === value;
    const text = `${part.title} ${part.designation} ${part.aliases.join(' ')} ${part.description}`.toLowerCase();
    return value.toLowerCase().split(/\s+/).every(word => text.includes(word));
  });
}

/** The families, as cards. */
function Families({ families, open }: { families: PartFamilySummary[]; open: (family: string) => void }) {
  return <>
    <div className="page-heading library-heading"><div><div className="eyebrow">THE PARTS LIBRARY</div><h1>Real parts. Exact sizes.</h1>
      <p>Screws, nuts, magnets and more, as the standards and their makers specify them: every size with its tolerance and its source. Models link here for the parts they are made to fit.</p></div></div>
    <div className="model-library part-families">{families.map(family => {
      const Icon = FAMILY_ICONS[family.id] ?? BookOpen;
      return <button type="button" className="model-card family-card" key={family.id} onClick={() => open(family.id)}>
        <div className="card-art"><Icon size={70} strokeWidth={1} /></div>
        <div className="card-copy"><span className="eyebrow">{family.count} {family.count === 1 ? 'PART' : 'PARTS'}</span><h2>{family.title}</h2><p>{family.description}</p>
          <span className="card-action">Browse {family.title.toLowerCase()} <ArrowRight size={17} /></span></div>
      </button>;
    })}</div>
  </>;
}

/** Everything about one part: what it is, its dimensions with their basis and source, and the models that use it. */
function PartDetails({ detail, part }: { detail: PartFamilyDetail; part: Part }) {
  const sources = new Map<string, PartSource>(detail.sources.map(source => [source.id, source]));
  const usage = detail.usage[part.id] ?? [];
  const attributes = Object.entries(part.attributes);
  const { market, linking, choose } = useMarket();
  const offers = useOffers([{ partId: part.id, quantity: 1 }], market, linking);
  // The listing of the part's own product, when it is an affiliate offer, replaces the plain product page link.
  const own = offers?.matches[0]?.offers.find(offer => offer.sameAsProduct);
  return <article className="part-details" aria-label={`${part.title} details`}>
    <div className="eyebrow">{part.designation}</div>
    <h2>{part.title}</h2>
    <p className="part-description">{part.description}</p>
    {part.aliases.length > 0 && <p className="part-aliases">Also: {part.aliases.join(', ')}</p>}
    {part.product && <p className="part-product">{part.product.manufacturer} · {part.product.sku} · {own
      ? <OfferLink offer={own}>Product page at {own.shop} (affiliate link)</OfferLink>
      : <a href={part.product.url} target="_blank" rel="noreferrer">Product page <ExternalLink size={11} /></a>}</p>}
    <table className="part-dimensions">
      <caption>Dimensions in mm</caption>
      <thead><tr><th scope="col">Dimension</th><th scope="col">Nominal</th><th scope="col">Min</th><th scope="col">Max</th><th scope="col">Basis</th></tr></thead>
      <tbody>{detail.family.dimensions.filter(spec => spec.key in part.dimensions).map(spec => {
        const value = part.dimensions[spec.key];
        const source = value && sources.get(value.source);
        return value && <tr key={spec.key}>
          <th scope="row"><i>{spec.symbol}</i> {spec.label}</th><td>{mm(value.value)}</td><td>{mm(value.min)}</td><td>{mm(value.max)}</td>
          <td><span className={`basis basis-${value.basis}`} title={source ? `${source.title} (${source.publisher})` : value.source}>{BASIS_TEXT[value.basis] ?? value.basis}</span></td>
        </tr>;
      })}</tbody>
    </table>
    {attributes.length > 0 && <dl className="part-attributes">{attributes.map(([key, value]) =>
      <div key={key}><dt>{detail.family.attributes.find(attribute => attribute.key === key)?.label ?? key.replace(/([A-Z])/g, ' $1').toLowerCase()}</dt><dd>{value.replace(/^([a-z]+)-([a-z])/, '$1 $2')}</dd></div>)}</dl>}
    {part.notes && <p className="part-notes">{part.notes}</p>}
    {market && linking && <WhereToBuy key={part.id} partId={part.id} offers={offers} market={market} choose={choose} />}
    <h3>Sources</h3>
    <ul className="part-sources">{part.sources.flatMap(id => { const source = sources.get(id); return source ? [source] : []; }).map(source =>
      <li key={source.id}><span className={`source-kind source-${source.kind}`}>{source.kind}</span>{source.url ? <a href={source.url} target="_blank" rel="noreferrer">{source.title}</a> : source.title}
        <small> · {source.publisher} · read {source.accessed}</small></li>)}</ul>
    <h3>Used by</h3>
    {usage.length > 0 ? <ul className="part-usage">{usage.map(use => <li key={`${use.modelId}:${use.via}`}><a href={use.kind === 'concept' ? `#/concepts/${use.modelId}` : formatHash({ view: 'models', model: use.modelId })}>{use.modelTitle}</a> <small>· {use.via}</small></li>)}</ul>
      : <p className="part-unused">No model links to this part yet.</p>}
  </article>;
}

/** One family: filters and the list of its parts, the live preview of the listed parts, and the selected part's details. */
function FamilyPage({ route, navigate }: { route: PartsRoute & { family: string }; navigate: (route: Route, replace?: boolean) => void }) {
  const [detail, setDetail] = useState<PartFamilyDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  useEffect(() => {
    const abort = new AbortController(); setDetail(null); setError(null);
    void api.GET('/api/v1/part-families/{id}', { params: { path: { id: route.family } }, signal: abort.signal }).then(response => {
      if (!response.data) throw new Error(response.error.message);
      setDetail(response.data);
    }).catch((caught: unknown) => { if (!abort.signal.aborted) setError(caught instanceof Error ? caught.message : 'Cannot load this part family.'); });
    return () => abort.abort();
  }, [route.family]);
  const filtered = useMemo(() => detail?.parts.filter(part => matches(part, route.filters)) ?? [], [detail, route.filters]);
  const selected = detail?.parts.find(part => part.id === route.part) ?? null;
  // The preview shows the listed parts, up to its limit; a selected part is always among them.
  const shown = useMemo(() => {
    const first = filtered.slice(0, VIEWER_LIMIT);
    return selected && !first.includes(selected) ? [selected, ...first.slice(0, VIEWER_LIMIT - 1)] : first;
  }, [filtered, selected]);
  const facets = useMemo(() => (detail?.family.attributes ?? []).map(attribute => ({
    ...attribute, values: [...new Set(detail?.parts.flatMap(part => part.attributes[attribute.key] ?? []))].sort(byNumber),
  })).filter(facet => facet.values.length > 1), [detail]);

  if (error) return <div className="empty-state" role="alert"><CircleAlert size={30} /><h1>Not in the library.</h1><p>{error}</p></div>;
  if (!detail) return <div className="empty-state"><LoaderCircle className="spin" size={30} /><p>Opening the parts drawer…</p></div>;
  const filter = (key: string, value: string) => navigate({ ...route, filters: { ...route.filters, [key]: value } }, true);
  const select = (id: string) => navigate({ ...route, part: id === route.part ? null : id });

  return <>
    <div className="page-heading"><div><div className="eyebrow">THE PARTS LIBRARY · {detail.parts.length} {detail.parts.length === 1 ? 'PART' : 'PARTS'}</div><h1>{detail.family.title}</h1><p>{detail.family.description}</p></div></div>
    <div className="parts-layout">
      <aside className="settings-panel parts-panel" aria-label="Find a part">
        <label className="part-search"><Search size={14} aria-hidden="true" /><span className="sr-only">Search</span>
          <input type="search" placeholder="Search, e.g. DIN 912 M3" value={route.filters[SEARCH] ?? ''} onChange={event => filter(SEARCH, event.currentTarget.value)} /></label>
        <div className="part-facets">{facets.map(facet => <div className="select-field" key={facet.key}>
          <label htmlFor={`facet-${facet.key}`}>{facet.label}</label>
          <select id={`facet-${facet.key}`} value={route.filters[facet.key] ?? ''} onChange={event => filter(facet.key, event.currentTarget.value)}>
            <option value="">All</option>{facet.values.map(value => <option key={value} value={value}>{value.replace(/-/g, ' ')}</option>)}
          </select>
        </div>)}</div>
        <div className="part-count" role="status">{filtered.length} of {detail.parts.length} {filtered.length > VIEWER_LIMIT ? `· the first ${VIEWER_LIMIT} are shown; filter to see others` : ''}
          {Object.keys(route.filters).length > 0 && <button type="button" className="text-button" onClick={() => navigate({ ...route, filters: {} }, true)}>Clear filters</button>}</div>
        <ul className="part-list" aria-label={`${detail.family.title} in the library`}>{filtered.map(part =>
          <li key={part.id}><button type="button" aria-pressed={part.id === route.part} className={part.id === hovered ? 'hovered' : undefined}
            onMouseEnter={() => setHovered(part.id)} onMouseLeave={() => setHovered(current => current === part.id ? null : current)} onFocus={() => setHovered(part.id)} onBlur={() => setHovered(null)}
            onClick={() => select(part.id)}>
            <strong>{part.designation}</strong><span>{part.title}</span>
            <small>{detail.family.dimensions.flatMap(spec => { const value = part.dimensions[spec.key]; return value ? [`${spec.symbol} ${mm(value.value)}`] : []; }).slice(0, 5).join(' · ')}</small>
          </button></li>)}</ul>
      </aside>
      <section className="preview-panel parts-preview" aria-label="Parts preview and details">
        <div className="preview-heading"><span className="eyebrow">LIVE PREVIEW · TRUE TO SIZE</span></div>
        <PartsViewer parts={shown} hovered={hovered} selected={route.part} onHover={setHovered} onSelect={select} />
        {selected ? <PartDetails detail={detail} part={selected} /> : <p className="part-hint">Select a part for its dimensions, tolerances and sources.</p>}
      </section>
    </div>
  </>;
}

/** The parts library: its families, or one family's parts. */
export function PartsLibrary({ route, families, navigate }: { route: PartsRoute; families: PartFamilySummary[]; navigate: (route: Route, replace?: boolean) => void }) {
  if (!route.family) return <Families families={families} open={family => navigate({ view: 'parts', family, part: null, filters: {} })} />;
  return <FamilyPage key={route.family} route={{ ...route, family: route.family }} navigate={navigate} />;
}
