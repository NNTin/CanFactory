import { Fragment, useEffect, useState, type ReactNode } from 'react';
import type { Follow, SettingRef } from './catioSubassembly.ts';
import { CATIO_SUBASSEMBLY_ENTRIES, dependentsOf } from './catioSubassemblies.ts';
import { formatHash, type CatioSubassembly } from './route.ts';

/**
 * How the catio pages show what they take from each other, all from the sub-assemblies' `follows` and facts' `from`: where a
 * setting comes from, what else it changes, and which other pages the current settings break.
 */

function PageLink({ page }: { page: CatioSubassembly | 'concept' }) {
  return page === 'concept'
    ? <a href={formatHash({ view: 'concepts', concept: 'catio', subassembly: null })}>catio concept</a>
    : <a href={formatHash({ view: 'concepts', concept: 'catio', subassembly: page })}>{CATIO_SUBASSEMBLY_ENTRIES[page].title.toLowerCase()}</a>;
}

/** “the a”, “the a and the b”, “the a, the b and the c”; “The …” to start a sentence. */
function Pages({ pages, capital = false }: { pages: (CatioSubassembly | 'concept')[]; capital?: boolean }) {
  return <>{pages.map((page, i) => <Fragment key={page}>{i > 0 ? (i === pages.length - 1 ? ' and ' : ', ') : ''}{i === 0 && capital ? 'The' : 'the'} <PageLink page={page} /></Fragment>)}</>;
}

const labels = (ref: SettingRef) => ref.page === 'concept' ? ref.settings : ref.settings.map(key => CATIO_SUBASSEMBLY_ENTRIES[ref.page].label(key));

/** Under a fact that another page sets: which page and settings to change it with. */
export function SettingSource({ from }: { from: SettingRef }) {
  return <small className="subassembly-source">Set on the <PageLink page={from.page} /> page{from.settings.length ? `: ${labels(from).join(', ')}` : ''}</small>;
}

/** Under a control: the other pages that change with it. */
export function ChangesNote({ page, setting }: { page: CatioSubassembly; setting: string }) {
  const pages = dependentsOf(page).filter(d => d.settings.includes(setting)).map(d => d.page);
  return pages.length > 0 ? <small className="subassembly-affects">Also changes <Pages pages={pages} />.</small> : null;
}

/** In the brief: the pages this one is fitted to, and the pages fitted to it. */
export function PageRelations({ page, follows }: { page: CatioSubassembly; follows: Follow[] }) {
  const dependents = dependentsOf(page).map(d => d.page);
  const fits = follows.map(f => f.page);
  return <>
    {fits.length > 0 && <p>It fits <Pages pages={fits} /> as {fits.length > 1 ? 'they are' : 'it is'} set on {fits.length > 1 ? 'their pages' : 'its page'}.</p>}
    {dependents.length > 0 && <p><Pages pages={dependents} capital /> {dependents.length > 1 ? 'are' : 'is'} fitted to this one and follow{dependents.length > 1 ? '' : 's'} its settings.</p>}
  </>;
}

export interface PageIssues { page: CatioSubassembly; errors: string[] }

/**
 * The other pages' errors with their saved settings, checked again whenever `revision` changes. Call it after the effect that
 * saves this page's settings, so the other pages read them.
 */
export function useOtherPageIssues(pages: readonly CatioSubassembly[], revision: string): PageIssues[] {
  const [issues, setIssues] = useState<PageIssues[]>([]);
  const key = pages.join();
  useEffect(() => {
    setIssues(pages.map(page => ({ page, errors: CATIO_SUBASSEMBLY_ENTRIES[page].savedErrors() })).filter(i => i.errors.length > 0));
    // `pages` is compared by its ids
  }, [key, revision]);
  return issues;
}

/** The errors of other pages that the current settings cause, each linked to its page. */
export function OtherPageIssues({ issues, children }: { issues: PageIssues[]; children: ReactNode }) {
  if (issues.length === 0) return null;
  return <div role="status" aria-label="Other pages" className="catio-errors subassembly-other-errors"><strong>{children}</strong>
    <ul>{issues.flatMap(i => i.errors.map(error => <li key={`${i.page}:${error}`}><PageLink page={i.page} />: {error}</li>))}</ul></div>;
}
