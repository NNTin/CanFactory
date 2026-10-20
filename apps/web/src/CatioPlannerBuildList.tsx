import { useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { CircleAlert, ClipboardList, Download, HardDriveDownload, History, Info, Upload, X } from 'lucide-react';
import { findPart } from '@canfactory/contracts';
import { parseProject, serializeProject } from '@canfactory/catio';
import { usePlannerHistory, usePlannerStore } from './catioPlannerStore.ts';
import { draftBuildList } from './catioPlannerDraft.ts';
import { importLegacyCatio } from './catioLegacyImport.ts';
import { browserStorage, createAutosave, download, exportFileName, SavedProjectContext, type Autosave, type SaveState } from './catioPlannerSaved.ts';
import { formatHash } from './route.ts';
import { addToBuyList, useMarket, useOffers, type BuyListSource } from './shopping.ts';
import { AffiliateNote, OfferLink } from './Shopping.tsx';

/**
 * The planner's top-bar project and build-list actions (#115): it saves the project in this browser after every committed edit
 * (catioPlannerSaved.ts; the page opened what was saved, CatioPlannerRoute.tsx), exports and imports it as JSON, and opens the
 * draft build list of the present revision. "Import my existing catio" makes a new project, once, from what the old concept page saved
 * (catioLegacyImport.ts).
 */
const BUY_LIST_SOURCE: BuyListSource = { kind: 'concept', id: 'catio-planner', label: 'Catio planner' };

export function BuildListSlot() {
  const store = usePlannerStore();
  const saved = useContext(SavedProjectContext);
  const [autosave, setAutosave] = useState<Autosave | null>(null);
  useEffect(() => {
    const created = createAutosave(store, { keepUntilEdit: saved.problem?.kind === 'invalid' });
    setAutosave(created);
    return () => { created.dispose(); setAutosave(null); };
  }, [store, saved]);
  const saving = useSyncExternalStore(autosave?.subscribe ?? noSubscribe, () => autosave?.get() ?? null);
  const [savedProblem, setSavedProblem] = useState(saved.problem);
  const [importErrors, setImportErrors] = useState<{ file: string; errors: string[] } | null>(null);
  const [legacy, setLegacy] = useState<{ text: string; notes: string[] } | null>(null);
  const [open, setOpen] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  // the kept invalid data is gone once the first edit is saved
  useEffect(() => { if (savedProblem?.kind === 'invalid' && saving?.state === 'saved') setSavedProblem(null); }, [saving, savedProblem]);

  const exportProject = () => { const { present } = store.get(); download(exportFileName(present), serializeProject(present)); };
  const importProject = async (chosen: File) => {
    const parsed = parseProject(await chosen.text());
    if (!parsed.ok) { setImportErrors({ file: chosen.name, errors: parsed.errors }); return; }
    setImportErrors(null); setSavedProblem(null); setLegacy(null);
    store.load(parsed.project);
  };
  const importLegacy = () => {
    let result;
    try { result = importLegacyCatio(browserStorage()); } catch { result = { kind: 'failed' as const, errors: ["This browser's storage is unavailable."] }; }
    if (result.kind === 'none') { setLegacy({ text: 'No catio saved by the old catio concept page was found in this browser.', notes: [] }); return; }
    if (result.kind === 'failed') { setLegacy(null); setImportErrors({ file: 'Your existing catio', errors: result.errors }); return; }
    if (store.get().present.revision > 0 && !window.confirm('Importing your existing catio opens it as a new project in place of this one. Export this one first to keep it. Import now?')) return;
    setImportErrors(null); setSavedProblem(null);
    store.load(result.project);
    setLegacy({ text: 'Your existing catio is open as a new project. What the old page saved is left as it was.', notes: result.notes });
  };

  return <>
    <div className="planner-files" role="group" aria-label="Project file">
      <SaveStatus state={saving} />
      <button type="button" onClick={exportProject} title="Download the project as a JSON file, whatever state it is in"><Download size={15} aria-hidden="true" /> Export</button>
      <button type="button" onClick={() => file.current?.click()} title="Open a project from a JSON file; the current one is kept if the file cannot be read"><Upload size={15} aria-hidden="true" /> Import</button>
      <button type="button" onClick={importLegacy} title="Make a new project from the catio the old concept page saved in this browser; that save is left as it is"><History size={15} aria-hidden="true" /> Import my existing catio</button>
      <input ref={file} type="file" accept="application/json,.json" hidden data-testid="planner-import" onChange={event => {
        const chosen = event.target.files?.[0]; event.target.value = '';
        if (chosen) void importProject(chosen);
      }} />
    </div>
    <button type="button" className="planner-build-list" aria-expanded={open} aria-controls="planner-build-list" onClick={() => setOpen(shown => !shown)}>
      <ClipboardList size={15} aria-hidden="true" /> Build list
    </button>
    {saving?.state === 'failed' && <p className="planner-notice warning" role="alert"><CircleAlert size={15} aria-hidden="true" />
      <span><strong>Not saved.</strong> {saving.message} Your changes stay on this page until you close it; export the project to keep it.</span>
      <button type="button" onClick={exportProject}><Download size={14} aria-hidden="true" /> Export</button></p>}
    {savedProblem?.kind === 'invalid' && <div className="planner-notice warning" role="alert"><CircleAlert size={15} aria-hidden="true" />
      <div><strong>The saved project could not be opened, so a new one is open.</strong> The saved data stays in this browser until you make an edit.
        <ul>{savedProblem.errors.slice(0, 5).map(error => <li key={error}>{error}</li>)}</ul></div>
      <button type="button" onClick={() => download('catio-planner-saved.json', savedProblem.text)}><HardDriveDownload size={14} aria-hidden="true" /> Download the saved data</button></div>}
    {importErrors && <div className="planner-notice error" role="alert" aria-label="Import failed"><CircleAlert size={15} aria-hidden="true" />
      <div><strong>{importErrors.file} was not imported.</strong> The current project is unchanged.
        <ul>{importErrors.errors.slice(0, 10).map(error => <li key={error}>{error}</li>)}</ul></div>
      <button type="button" aria-label="Dismiss" onClick={() => setImportErrors(null)}><X size={14} aria-hidden="true" /></button></div>}
    {legacy && <div className="planner-notice info" role="status" aria-label="Existing catio"><Info size={15} aria-hidden="true" />
      <div><strong>{legacy.text}</strong>{legacy.notes.length > 0 && <ul>{legacy.notes.map(note => <li key={note}>{note}</li>)}</ul>}</div>
      <button type="button" aria-label="Dismiss" onClick={() => setLegacy(null)}><X size={14} aria-hidden="true" /></button></div>}
    {open && <BuildList close={() => setOpen(false)} />}
  </>;
}
const noSubscribe = () => () => {};

function SaveStatus({ state }: { state: SaveState | null }) {
  if (!state || state.state === 'pending') return <span className="planner-saved" data-testid="planner-saved" data-state="pending">Not saved yet</span>;
  if (state.state === 'failed') return <span className="planner-saved failed" data-testid="planner-saved" data-state="failed"><CircleAlert size={13} aria-hidden="true" /> Not saved</span>;
  return <span className="planner-saved" data-testid="planner-saved" data-state="saved" data-revision={state.revision}>Saved in this browser</span>;
}

/** The present revision's draft build list. Clicking a line selects the instances it is for. */
function BuildList({ close }: { close: () => void }) {
  const store = usePlannerStore();
  const history = usePlannerHistory();
  const project = history.present;
  const evaluation = store.evaluation();
  const list = useMemo(() => draftBuildList(project, evaluation), [project, evaluation]);
  const selection = project.view.selection;
  const names = new Map(project.instances.map(i => [i.id, i.name ?? i.id]));
  const pick = (ids: string[]) => store.select(ids.filter(id => names.has(id)));
  const picked = (ids: string[]) => ids.length > 0 && ids.length === selection.length && ids.every(id => selection.includes(id));

  // Library parts link to Amazon when it links in the visitor's market; without offers the list stays as it is.
  const { market, info, linking } = useMarket();
  const amazon = linking && market !== null && info?.networks[market].amazon === true;
  const offers = useOffers(list.requirements, market, amazon);
  const amazonOffer = (partId: string | undefined) => partId ? offers?.matches.find(m => m.partId === partId)?.offers.find(o => o.network === 'amazon') : undefined;
  const [added, setAdded] = useState(false);
  useEffect(() => setAdded(false), [list.revision]);

  return <section id="planner-build-list" className="planner-build" aria-label="Build list" data-revision={list.revision}>
    <header>
      <div><span className="eyebrow">BUILD LIST · REVISION {list.revision}</span>
        <h2>What it takes {list.draft && <span className="planner-draft" title="Something is unresolved or an issue is open: this is no complete build.">Draft</span>}</h2></div>
      <button type="button" aria-label="Close the build list" onClick={close}><X size={15} aria-hidden="true" /></button>
    </header>
    {list.unresolved.length > 0 && <section className="planner-unresolved" aria-label="Unresolved">
      <h3><CircleAlert size={15} aria-hidden="true" /> Unresolved · {list.unresolved.length}</h3>
      <p>Not in the list below, or not settled yet. The list is incomplete until these are resolved.</p>
      <ul>{list.unresolved.map(issue => <li key={issue.id}><button type="button" className={issue.severity} aria-pressed={picked(issue.instanceIds)} onClick={() => pick(issue.instanceIds)}>
        <strong>{issue.instanceIds.map(id => names.get(id) ?? id).join(', ')}</strong><span>{issue.message}</span></button></li>)}</ul>
    </section>}
    {list.groups.map(({ group, lines }) => <table key={group} aria-label={`${group} parts`}><caption>{group}</caption>
      <thead><tr><th scope="col">Qty</th><th scope="col">Part</th><th scope="col">Size</th><th scope="col">Use</th><th scope="col">For</th>{amazon && <th scope="col">Buy</th>}</tr></thead>
      <tbody>{lines.map((line, n) => {
        const offer = amazonOffer(line.partId);
        return <tr key={`${line.id}-${n}`} className={picked(line.sources) ? 'selected' : undefined}>
          <td>{line.quantity}</td>
          <td>{line.partId ? <a href={formatHash({ view: 'parts', family: findPart(line.partId)?.family ?? null, part: line.partId, filters: {} })}>{line.name}</a>
            : line.modelId ? <a href={formatHash({ view: 'models', model: line.modelId })}>{line.name}</a> : line.name}</td>
          <td>{line.size}</td><td>{line.use}</td>
          <td><button type="button" className="planner-sources" aria-pressed={picked(line.sources)} onClick={() => pick(line.sources)} title="Select in the planner">
            {line.sources.map(id => names.get(id) ?? id).join(', ')}</button></td>
          {amazon && <td>{offer ? <OfferLink offer={offer}>{offer.kind === 'search' ? `Search ${offer.shop}` : offer.shop}</OfferLink> : null}</td>}
        </tr>;
      })}</tbody></table>)}
    {!list.groups.length && <p className="planner-note">Nothing to build yet.</p>}
    <p className="planner-note">No total price: shop links show live offers for the library parts only, and timber, sheet and mesh are cut for this design. A partly priced list is not the cost of the project.</p>
    {amazon && list.requirements.length > 0 && <><div className="buy-list-add"><button type="button" className="secondary-button" onClick={() => { addToBuyList(BUY_LIST_SOURCE, list.requirements); setAdded(true); }}>Add all hardware to buy list</button>
      {added && <a href={formatHash({ view: 'buy-list' })}>See the buy list</a>}</div><AffiliateNote /></>}
  </section>;
}
