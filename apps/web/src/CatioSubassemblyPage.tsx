import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { ArrowLeft, ArrowRight, Box, RotateCcw } from 'lucide-react';
import * as THREE from 'three';
import { bomRequirements, findPart } from '@canfactory/contracts';
import {
  BOM_GROUPS, configureSubassembly, hasSubject, SUBASSEMBLY_CONTROLS, SUBASSEMBLY_OWNERS, subassemblyInstances,
  type BomLine, type CatioLayer, type CatioSubassembly, type CatioView, type SettingRef, type SubassemblyControl, type Subject,
} from '@canfactory/catio';
import { createStage, type Stage } from './stage.ts';
import { latchPartsStatus, watchLatchParts } from './catioPrintedLatchScene.ts';
import { defaultViewing, type SubassemblyDefinition, type SubassemblyModel, type SubassemblyViewing } from './catioSubassembly.ts';
import { CATIO_SUBASSEMBLY_DEFINITIONS, CATIO_SUBASSEMBLY_TITLES } from './catioSubassemblies.ts';
import { ControlFields, HistoryButtons, SharedNote } from './CatioControls.tsx';
import { projectSession } from './catioPlannerSaved.ts';
import { PlannerStoreContext, usePlannerHistory, usePlannerStore } from './catioPlannerStore.ts';
import { formatHash } from './route.ts';
import { AffiliateNote, OfferLink } from './Shopping.tsx';
import { addToBuyList, useMarket, useOffers, type BuyListSource } from './shopping.ts';

const VIEWS: CatioView[] = ['Exterior', 'Interior', 'Front', 'Side', 'Top', 'Mounting'];
const LAYERS: { id: CatioLayer; title: string }[] = [
  { id: 'timber', title: 'Timber' }, { id: 'mesh', title: 'Mesh' }, { id: 'hardware', title: 'Clamps & fixings' }, { id: 'environment', title: 'Wall & grass' },
];
/** How long a door takes to open or shut on the stage, in ms: its buttons turn, then its panel comes out. */
const DOOR_MS = 1600;
const OWNER_TITLES = { window: 'Window', tunnel: 'Tunnel' } as const;

/** The view of one catio sub-assembly of an instance of the project open in this tab (#117), picked by its route. */
export function CatioSubassemblyRoute({ id, instance }: { id: CatioSubassembly; instance: string | null }) {
  const [session] = useState(projectSession);
  const definition: SubassemblyDefinition<object, unknown> = CATIO_SUBASSEMBLY_DEFINITIONS[id] as unknown as SubassemblyDefinition<object, unknown>;
  return <PlannerStoreContext.Provider value={session.store}><CatioSubassemblyPage definition={definition} instance={instance} /></PlannerStoreContext.Provider>;
}

/**
 * Any sub-assembly of an instance of the project: its construction choices (the project's: an edit is an edit of the project, one
 * undo step, and shows in the planner), a staged live preview, a parts list and the reasons behind its defaults.
 */
export function CatioSubassemblyPage<C extends object, S>({ definition, instance }: { definition: SubassemblyDefinition<C, S>; instance: string | null }) {
  const store = usePlannerStore();
  const project = usePlannerHistory().present;
  const evaluation = store.evaluation();
  // the evaluation is the design's: a new one for every edit, the same while only the view changes
  const subject = useMemo(() => definition.subject(store.get().present, evaluation, instance), [definition, evaluation, instance]);
  const owner = SUBASSEMBLY_OWNERS[definition.id];
  const instances = subassemblyInstances(project, definition.id);
  const shown = subject.instance ?? '';
  return <>
    <div className="page-heading catio-heading"><div><div className="eyebrow">{definition.eyebrow}</div><h1>{definition.heading}</h1><p>{definition.summary}</p></div>
      <span className="model-tag"><span /> SUB-ASSEMBLY</span></div>
    <div className="subassembly-project" role="group" aria-label="Project">
      <span>Of the project <strong>{project.name}</strong></span>
      {instances.length > 0 && <label><span>{OWNER_TITLES[owner]}</span><select aria-label={OWNER_TITLES[owner]} value={shown} onChange={event => {
        window.location.hash = formatHash({ view: 'concepts', concept: 'catio', subassembly: definition.id, instance: event.target.value });
      }}>{instances.map(i => <option key={i.id} value={i.id}>{i.name ?? i.id}</option>)}</select></label>}
      <a href={formatHash({ view: 'catio-planner' })} onClick={() => { if (shown) store.select([shown]); }}>Show in the planner</a>
      <HistoryButtons />
    </div>
    {hasSubject(subject) ? <SubassemblyDetail key={subject.instance} definition={definition} subject={subject} />
      : <p className="catio-errors subassembly-missing" role="status">{subject.problem} <a href={formatHash({ view: 'catio-planner' })}>Open the planner</a></p>}
  </>;
}

function SubassemblyDetail<C extends object, S>({ definition, subject }: { definition: SubassemblyDefinition<C, S>; subject: Subject<C, S> }) {
  const store = usePlannerStore();
  const evaluation = store.evaluation();
  const container = useRef<HTMLDivElement>(null);
  const controller = useRef<{ stage: Stage; model: SubassemblyModel } | null>(null);
  const [unsupported, setUnsupported] = useState(false);
  // the printed latches' parts arrive after the scene is drawn (or fail to): redraw, and say so on the viewer
  const latchParts = useSyncExternalStore(watchLatchParts, latchPartsStatus, () => 'idle' as const);
  useEffect(() => { controller.current?.stage.invalidate(); }, [latchParts]);
  const [action, setAction] = useState<string | null>(null);
  const [refused, setRefused] = useState<string[]>([]);
  // how the view shows it (which joint), the view's own choices over the project's config
  const [own, setOwn] = useState<Partial<C>>({});
  const config = useMemo(() => ({ ...subject.config, ...own }), [subject, own]);
  const { site } = subject;
  const toggles = definition.toggles ?? { windowOpen: 'Window open', cutaway: 'Wall cutaway' };
  const steps = definition.steps(config, site); const last = steps.length - 1;
  const [viewingState, setViewing] = useState<SubassemblyViewing>(() => defaultViewing(definition, last));
  const viewing = viewingState.progress > last ? { ...viewingState, progress: last } : viewingState;
  const { progress, exploded, windowOpen, cutaway, view } = viewing;
  const hidden = new Set(viewing.hidden);
  // The design's door (a cat port's panel or gate, a side-access panel), when it has one: shut until the assembly is complete, then
  // opened by its toggle. `door` is how far it is on its way out, which the stage follows from frame to frame.
  const doorLabel = definition.doorToggle?.(config, site) ?? null;
  const doorOpen = doorLabel !== null && viewing.doorOpen && progress >= last;
  const door = useRef(doorOpen ? 1 : 0);
  const stateRef = useRef({ ...viewing, hidden, door: door.current });
  stateRef.current = { ...viewing, hidden, door: door.current };
  const index = Math.ceil(progress); const step = steps[index] ?? steps[last];
  const errors = definition.validate(config, site);
  // the project's problems with this instance that its own checks do not already name
  const problems = evaluation.issues.filter(i => i.severity !== 'info' && i.instanceIds.includes(subject.instance) && !errors.includes(i.message));
  const bom = definition.bom(config, site);
  const drawings = definition.drawings?.(config, site) ?? [];
  const controls = [...(definition.viewControls ?? []), ...SUBASSEMBLY_CONTROLS[definition.id] as unknown as SubassemblyControl<C>[]];
  const viewKeys = new Set((definition.viewControls ?? []).map(control => control.key));
  const editView = (patch: Partial<SubassemblyViewing>) => setViewing(current => ({ ...current, ...patch }));
  const change = (key: keyof C & string, value: C[keyof C]): string[] => {
    if (viewKeys.has(key)) { setOwn(current => ({ ...current, [key]: value })); return []; }
    const result = configureSubassembly(store.get().present, definition.id, subject.instance, { [key]: value });
    setRefused(result.errors);
    if (!result.errors.length) store.apply(result.project);
    return result.errors;
  };
  const focus = useRef('');
  const camera = (name: CatioView) => {
    const preset = definition.views(config, site)[name];
    const offset = new THREE.Vector3(...(controller.current?.model.focusOffset?.() ?? [0, 0, 0])); focus.current = offset.toArray().join();
    const target = new THREE.Vector3(...preset.target).add(offset); const position = new THREE.Vector3(...preset.position).add(offset);
    if (stateRef.current.exploded) position.sub(target).multiplyScalar(1.45).add(target);
    controller.current?.stage.lookAt(position, target);
  };
  const visibleParts = () => controller.current?.model.components.filter(part => part.group.visible).map(part => part.id).join(' ') ?? '';
  useEffect(() => {
    const element = container.current; if (!element) return;
    const stage = createStage(element, `Interactive ${definition.title.toLowerCase()} concept. Drag to orbit, scroll to zoom, right-drag to pan.`, { scale: definition.stageScale ?? 10, workshopFloor: false });
    if (!stage) { setUnsupported(true); return; }
    setUnsupported(false);
    const model = definition.build(config, site);
    stage.group.add(model.root); controller.current = { stage, model };
    model.update(stateRef.current); camera(stateRef.current.view); stage.invalidate(); setAction(model.caption?.() ?? null);
    element.dataset['ready'] = 'true'; element.dataset['visibleParts'] = visibleParts();
    return () => { delete element.dataset['ready']; model.dispose(); stage.dispose(); controller.current = null; };
    // camera and visibleParts read the current refs; the scene is rebuilt only for a new design
  }, [definition, config, site]);
  useEffect(() => {
    controller.current?.model.update(stateRef.current); controller.current?.stage.invalidate();
    setAction(controller.current?.model.caption?.() ?? null);
    // the cameras follow the sub-assembly when it moves somewhere else, e.g. between the bench and the window
    if ((controller.current?.model.focusOffset?.() ?? [0, 0, 0]).join() !== focus.current) camera(stateRef.current.view);
    if (container.current) container.current.dataset['visibleParts'] = visibleParts();
  }, [viewingState, config]);
  useEffect(() => { camera(view); }, [exploded, view]);
  useEffect(() => {
    const element = container.current; const target = doorOpen ? 1 : 0; const from = door.current;
    const show = (travel: number) => {
      door.current = travel; stateRef.current = { ...stateRef.current, door: travel };
      controller.current?.model.update(stateRef.current); controller.current?.stage.invalidate();
      setAction(controller.current?.model.caption?.() ?? null);
      if (element) element.dataset['doorTravel'] = String(travel);
    };
    // no stage, nothing to move, or the visitor prefers no motion: the door is simply shown where it ends
    if (from === target || !controller.current || typeof requestAnimationFrame !== 'function' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) { show(target); return; }
    let frame = 0; const started = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - started) / DOOR_MS);
      show(from + (target - from) * t);
      if (t < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
    // the stage is rebuilt for a new design, and then shows the door where it is
  }, [doorOpen]);
  const selectView = (name: CatioView) => { camera(name); editView({ view: name, cutaway: (definition.cutawayViews ?? ['Interior', 'Mounting']).includes(name) }); };
  const toggleLayer = (id: CatioLayer) => editView({ hidden: hidden.has(id) ? viewing.hidden.filter(layer => layer !== id) : [...viewing.hidden, id] });

  return <>
    <div className="catio-layout">
      <aside className="catio-brief" aria-label={`${definition.title} parameters`}>
        <span className="eyebrow">{definition.briefLabel}</span>
        <dl className="catio-dimensions">{definition.facts(config, site).map(fact => <div key={fact.label}><dt>{fact.label}</dt><dd>{fact.value}</dd>{fact.from && <SettingSource from={fact.from} />}</div>)}</dl>
        <div className="catio-parameters subassembly-parameters">
          <ControlFields controls={controls} config={config} change={change} note={key => viewKeys.has(key) ? null : <SharedNote id={definition.id} setting={key} />} />
          {refused.length > 0 && <div role="alert" className="catio-errors"><strong>Not changed.</strong><ul>{refused.map(error => <li key={error}>{error}</li>)}</ul></div>}
          {errors.length > 0 && <div role="alert" className="catio-errors"><strong>This combination does not fit.</strong><ul>{errors.map(error => <li key={error}>{error}</li>)}</ul></div>}
          {problems.length > 0 && <div role="status" aria-label="Problems in the project" className="catio-errors subassembly-other-errors"><strong>In the project:</strong>
            <ul>{problems.map(issue => <li key={issue.id}>{issue.message}</li>)}</ul></div>}
        </div>
        <p>These are the project’s settings: a change here is a change in the planner too, and Undo takes it back.</p>
      </aside>
      <section className="catio-preview" aria-label={`Live ${definition.title.toLowerCase()} concept`}>
        <div className="catio-preview-title"><span className="eyebrow"><Box size={14} /> LIVE ASSEMBLY</span><span>Dimensions in millimetres</span></div>
        <div className="catio-cameras" role="group" aria-label="Camera views">{VIEWS.map(name =>
          <button key={name} type="button" aria-pressed={name === view} onClick={() => selectView(name)} disabled={unsupported}>{definition.viewLabels?.[name] ?? name}</button>)}
          <button type="button" aria-label="Reset view" title="Reset view" disabled={unsupported} onClick={() => selectView('Exterior')}><RotateCcw size={14} /></button>
        </div>
        <div className="catio-canvas" ref={container} data-testid="subassembly-viewer" data-subassembly={definition.id} data-instance={subject.instance} data-config={JSON.stringify(config)} data-step={index} data-window={windowOpen ? 'open' : 'closed'} data-exploded={exploded} data-door={doorLabel === null ? undefined : doorOpen ? 'open' : 'closed'} data-latch-parts={latchParts === 'idle' ? undefined : latchParts}>
          {unsupported && <div className="catio-fallback"><Box size={32} /><strong>3D preview needs WebGL</strong><p>The parts list and assembly instructions below are still available.</p></div>}
          {latchParts === 'missing' && <p className="catio-latch-note" role="status">The printed latches’ parts could not be loaded. They are shown without them and tried again shortly.</p>}
        </div>
        <div className="catio-options">
          {toggles.windowOpen && <label><input type="checkbox" checked={windowOpen} onChange={event => editView({ windowOpen: event.target.checked })} disabled={unsupported} /> {toggles.windowOpen}</label>}
          {toggles.cutaway && <label><input type="checkbox" checked={cutaway} onChange={event => editView({ cutaway: event.target.checked })} disabled={unsupported} /> {toggles.cutaway}</label>}
          {doorLabel && <label title={progress < last ? 'Complete the assembly first: the door stays shut until then.' : undefined}><input type="checkbox" checked={doorOpen} onChange={event => editView({ doorOpen: event.target.checked })} disabled={unsupported || progress < last || exploded} /> {doorLabel}</label>}
          <label><input type="checkbox" checked={exploded} onChange={event => editView({ exploded: event.target.checked })} disabled={unsupported} /> Exploded view</label>
          <span>Drag to orbit · Scroll to zoom</span>
        </div>
        <div className="catio-assembly">
          <div className="catio-step-title"><span className="eyebrow">{index === 0 ? 'BEFORE ASSEMBLY' : `STAGE ${index} / ${last}`}</span><strong aria-live="polite">{step?.title}</strong></div>
          <div className="catio-slider"><button type="button" aria-label="Previous assembly stage" disabled={progress === 0} onClick={() => editView({ progress: Math.max(0, Math.ceil(progress) - 1) })}><ArrowLeft size={16} /></button>
            <input type="range" min="0" max={last} step="0.01" value={progress} aria-label={`${definition.title} assembly`} aria-valuetext={`${index} of ${last} · ${step?.title ?? ''}`} onChange={event => editView({ progress: Number(event.target.value) })} />
            <button type="button" aria-label="Next assembly stage" disabled={progress === last} onClick={() => editView({ progress: Math.min(last, Math.floor(progress) + 1) })}><ArrowRight size={16} /></button></div>
          <p>{step?.detail}</p>
          <p className="subassembly-action" data-testid="assembly-action" aria-live="polite">{action ? <><strong>Now: </strong>{action}</> : '\u00a0'}</p>
        </div>
        <div className="catio-layers" role="group" aria-label="Visible components">{LAYERS.map(layer => <button key={layer.id} type="button" aria-pressed={!hidden.has(layer.id)} disabled={unsupported} onClick={() => toggleLayer(layer.id)}>{definition.layerLabels?.[layer.id] ?? layer.title}</button>)}</div>
      </section>
    </div>
    <PartsList lines={bom} from={{ kind: 'concept', id: `catio/${definition.id}`, label: `Catio: ${CATIO_SUBASSEMBLY_TITLES[definition.id]}` }} />
    {drawings.length > 0 && <section className="subassembly-drawings" aria-label="Drawings"><span className="eyebrow">THE DRAWINGS</span><h2>Made to the same marks.</h2>
      {drawings.map(d => {
        const href = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(d.svg)}`;
        return <figure key={d.id}><img src={href} alt={d.title} width={320} /><figcaption><strong>{d.title}</strong> {d.caption} <a href={href} download={d.filename}>Download {d.filename}</a></figcaption></figure>;
      })}</section>}
    <section className="catio-instructions" aria-label="Assembly instructions"><span className="eyebrow">THE ASSEMBLY</span><h2>{definition.assemblyHeading}</h2>
      <ol>{steps.slice(1).map(info => <li key={info.title}><strong>{info.title}</strong><p>{info.detail}</p></li>)}</ol></section>
    <section className="subassembly-decisions" aria-label="Design decisions"><span className="eyebrow">THE DEFAULTS, AND WHY</span><h2>Choices to redirect.</h2>
      <div>{definition.decisions.map(decision => <article key={decision.title}><h3>{decision.title}</h3>{decision.parameter && <span className="eyebrow">PARAMETER · {decision.parameter.toUpperCase()}</span>}{decision.from && <SettingSource from={decision.from} />}<p><strong>Chosen: </strong>{decision.choice}</p><p>{decision.why}</p></article>)}</div></section>
  </>;
}

/**
 * Under a fact or a decision that another sub-assembly's settings change: where they are set, the view of that sub-assembly in the
 * project (or the planner, for the cat ports and a tunnel's route).
 */
function SettingSource({ from }: { from: SettingRef }) {
  const labels = from.page === 'planner' ? from.settings
    : from.settings.flatMap(key => (SUBASSEMBLY_CONTROLS[from.page] as SubassemblyControl<object>[]).find(control => control.key === key)?.label ?? []);
  if (from.page === 'planner' || !labels.length) return <small className="subassembly-source">Set in the <a href={formatHash({ view: 'catio-planner' })}>catio planner</a>{from.page === 'planner' ? `: ${labels.join(', ')}` : ', by the tunnel’s route'}</small>;
  return <small className="subassembly-source">Set on the <a href={formatHash({ view: 'concepts', concept: 'catio', subassembly: from.page })}>{CATIO_SUBASSEMBLY_TITLES[from.page].toLowerCase()}</a>: {labels.join(', ')}</small>;
}

function PartsList({ lines, from }: { lines: BomLine[]; from: BuyListSource }) {
  // Library parts link to shops too, when a network links in the visitor's market (see docs/affiliate-offers.md).
  const { market, linking } = useMarket();
  const requirements = bomRequirements(lines);
  const offers = useOffers(requirements, market, linking);
  const buying = linking && requirements.length > 0;
  const [added, setAdded] = useState(false);
  return <section className="subassembly-parts" aria-label="Parts list"><span className="eyebrow">THE PARTS</span><h2>Everything it takes.</h2>
    <p>Timber is cut for this design; hardware links to the parts library, with its standard or maker’s dimensions, and printed parts to their model. Sizes in millimetres.</p>
    {BOM_GROUPS.map(group => {
      const rows = lines.filter(line => line.group === group);
      return rows.length > 0 && <table key={group} aria-label={`${group} parts`}><caption>{group}</caption>
        <thead><tr><th scope="col">Qty</th><th scope="col">Part</th><th scope="col">Dimensions</th><th scope="col">Where</th>{buying && <th scope="col">Buy</th>}</tr></thead>
        <tbody>{rows.map(line => {
          const best = line.partId ? offers?.matches.find(match => match.partId === line.partId)?.offers[0] : undefined;
          return <tr key={line.id}><td>{line.quantity}</td>
            <td>{line.partId ? <a href={formatHash({ view: 'parts', family: findPart(line.partId)?.family ?? null, part: line.partId, filters: {} })}>{line.name}</a>
              : line.modelId ? <a href={formatHash({ view: 'models', model: line.modelId })}>{line.name}</a> : line.name}</td>
            <td>{line.size}</td><td>{line.use}</td>
            {buying && <td>{best ? <OfferLink offer={best}>{best.kind === 'search' ? `Search ${best.shop}` : best.shop}</OfferLink> : null}</td>}</tr>;
        })}</tbody></table>;
    })}
    {buying && <><div className="buy-list-add"><button type="button" className="secondary-button" onClick={() => { addToBuyList(from, requirements); setAdded(true); }}>Add all hardware to buy list</button>
      {added && <a href={formatHash({ view: 'buy-list' })}>See the buy list</a>}</div><AffiliateNote /></>}
  </section>;
}
