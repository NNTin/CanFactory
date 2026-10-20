import { CATIO_SUBASSEMBLIES, type CatioSubassembly } from '@canfactory/catio';
/**
 * Where the app is, mirrored to the URL's hash so that every page can be linked to and the browser's back button works:
 * `#/models` (the model library), `#/models/<id>` (a model's editor), `#/parts` (the parts library's families),
 * `#/parts/<family>` and `#/parts/<family>/<part>`, each optionally with filters as a query, e.g. `#/parts/screw?thread=M3`.
 * `#/concepts/catio` is the catio concept's overview, `#/concepts/catio/planner` the catio planner and `#/concepts/catio/<sub-assembly>` the
 * detail view of one of its sub-assemblies in the project, of its first window or tunnel, or of `#/concepts/catio/<sub-assembly>/<instance>`.
 * `#/buy-list` is the buy list, `#/disclosure` the affiliate disclosure and `#/privacy` the privacy page.
 * A URL without a hash, or with one that names no page, opens the model library.
 */
const isSubassembly = (value: string | undefined): value is CatioSubassembly => CATIO_SUBASSEMBLIES.includes(value as CatioSubassembly);

export type Route =
  | { view: 'concepts'; concept: 'catio'; subassembly: CatioSubassembly | null; instance?: string }
  | { view: 'catio-planner' }
  | { view: 'models'; model: string | null }
  | { view: 'parts'; family: string | null; part: string | null; filters: Record<string, string> }
  | { view: 'buy-list' | 'disclosure' | 'privacy' };

const PAGES = ['buy-list', 'disclosure', 'privacy'] as const;

const segment = (value: string | undefined): string | null => value ? decodeURIComponent(value) : null;

/** The route in a hash, or null for an empty or unknown hash (the app then opens the model library). */
export function parseHash(hash: string): Route | null {
  const [path = '', query = ''] = hash.replace(/^#\/?/, '').split('?');
  const [view, first, second, third] = path.split('/');
  if (view === 'concepts' && first === 'catio') {
    if (!second) return { view: 'concepts', concept: 'catio', subassembly: null };
    if (second === 'planner') return { view: 'catio-planner' };
    if (isSubassembly(second)) return { view: 'concepts', concept: 'catio', subassembly: second, ...(third ? { instance: decodeURIComponent(third) } : {}) };
  }
  if (view === 'models') return { view: 'models', model: segment(first) };
  const page = PAGES.find(candidate => candidate === view);
  if (page && !first) return { view: page };
  if (view === 'parts') {
    const filters = Object.fromEntries([...new URLSearchParams(query)].filter(([, value]) => value !== ''));
    return { view: 'parts', family: segment(first), part: segment(second), filters };
  }
  return null;
}

export function formatHash(route: Route): string {
  if (route.view === 'concepts') return route.subassembly ? `#/concepts/catio/${route.subassembly}${route.instance ? `/${encodeURIComponent(route.instance)}` : ''}` : '#/concepts/catio';
  if (route.view === 'catio-planner') return '#/concepts/catio/planner';
  if (route.view === 'models') return route.model ? `#/models/${encodeURIComponent(route.model)}` : '#/models';
  if (route.view !== 'parts') return `#/${route.view}`;
  const family = route.family ? `/${encodeURIComponent(route.family)}` : '';
  const path = `#/parts${family}${family && route.part ? `/${encodeURIComponent(route.part)}` : ''}`;
  const query = new URLSearchParams(Object.entries(route.filters).filter(([, value]) => value !== '')).toString();
  return query ? `${path}?${query}` : path;
}

/** The link to the parts library for one option of a part-linked control: its part, or every part with that attribute value. */
export function partLink(link: { family: string; attribute: string | null }, value: string): string {
  return formatHash(link.attribute
    ? { view: 'parts', family: link.family, part: null, filters: { [link.attribute]: value } }
    : { view: 'parts', family: link.family, part: value, filters: {} });
}
