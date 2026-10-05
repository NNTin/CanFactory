import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ArrowLeft, ArrowRight, Box, RotateCcw } from 'lucide-react';
import * as THREE from 'three';
import { findPart } from '@canfactory/contracts';
import { createStage, type Stage } from './stage.ts';
import type { CatioLayer, CatioView } from './catioDesign.ts';
import type { CatioMode } from './catioSettings.ts';
import { BOM_GROUPS, inRange, loadSubassemblySettings, saveShared, subassemblyStorageKey, defaultSubassemblySettings, type BomLine, type NumberRange, type SubassemblyDefinition, type SubassemblyModel, type SubassemblyViewing } from './catioSubassembly.ts';
import { couplingDefinition, dependentsOf, tunnelCouplingDefinition, tunnelDefinition, windowInsertDefinition } from './catioSubassemblies.ts';
import { ChangesNote, OtherPageIssues, PageRelations, SettingSource, SharedNote, useOtherPageIssues } from './CatioCrossPage.tsx';
import { formatHash, type CatioSubassembly } from './route.ts';

const VIEWS: CatioView[] = ['Exterior', 'Interior', 'Front', 'Side', 'Top', 'Mounting'];
const LAYERS: { id: CatioLayer; title: string }[] = [
  { id: 'timber', title: 'Timber' }, { id: 'mesh', title: 'Metal mesh' }, { id: 'hardware', title: 'Clamps & fixings' }, { id: 'environment', title: 'Wall & grass' },
];
const VARIANTS: { id: CatioMode; label: string }[] = [{ id: 'direct', label: 'Direct · original design' }, { id: 'modular', label: 'Modular · with tunnel' }];

/** The page of one catio sub-assembly, picked by its route. */
export function CatioSubassemblyRoute({ id }: { id: CatioSubassembly }) {
  // The enclosure becomes a case here.
  const pages: Record<CatioSubassembly, () => React.JSX.Element> = {
    'window-insert': () => <CatioSubassemblyPage definition={windowInsertDefinition} />,
    'insert-tunnel-coupling': () => <CatioSubassemblyPage definition={couplingDefinition} />,
    tunnel: () => <CatioSubassemblyPage definition={tunnelDefinition} />,
    'tunnel-tunnel-coupling': () => <CatioSubassemblyPage definition={tunnelCouplingDefinition} />,
  };
  return pages[id]();
}

/** Any sub-assembly: variants, its design parameters, a staged live preview, a parts list and the reasons behind its defaults. */
export function CatioSubassemblyPage<C extends object>({ definition }: { definition: SubassemblyDefinition<C> }) {
  const container = useRef<HTMLDivElement>(null);
  const controller = useRef<{ stage: Stage; model: SubassemblyModel } | null>(null);
  const [settings, setSettings] = useState(() => loadSubassemblySettings(definition));
  const [unsupported, setUnsupported] = useState(false);
  const [action, setAction] = useState<string | null>(null);
  const { variant, config } = settings;
  const variants = VARIANTS.filter(option => !definition.variants || definition.variants.includes(option.id));
  const toggles = definition.toggles ?? { windowOpen: 'Window open', cutaway: 'Wall cutaway' };
  const viewing = settings.views[variant];
  const { progress, exploded, windowOpen, cutaway, view } = viewing;
  const hidden = new Set(viewing.hidden);
  const stateRef = useRef({ ...viewing, hidden });
  stateRef.current = { ...viewing, hidden };
  const steps = definition.steps(variant, config); const last = steps.length - 1;
  const index = Math.ceil(progress); const step = steps[index] ?? steps[last];
  const errors = definition.validate(variant, config);
  const bom = definition.bom(variant, config);
  const controls = definition.controls.filter(control => (!control.variants || control.variants.includes(variant)) && (!control.when || control.when(config)));
  const groups = [...new Set(controls.map(control => control.group))];
  const editView = (patch: Partial<SubassemblyViewing>) => setSettings(current => ({ ...current, views: { ...current.views, [current.variant]: { ...current.views[current.variant], ...patch } } }));
  const focus = useRef('');
  const camera = (name: CatioView) => {
    const preset = definition.views(variant, config)[name];
    const offset = new THREE.Vector3(...(controller.current?.model.focusOffset?.() ?? [0, 0, 0])); focus.current = offset.toArray().join();
    const target = new THREE.Vector3(...preset.target).add(offset); const position = new THREE.Vector3(...preset.position).add(offset);
    if (stateRef.current.exploded) position.sub(target).multiplyScalar(1.45).add(target);
    controller.current?.stage.lookAt(position, target);
  };
  const visibleParts = () => controller.current?.model.components.filter(part => part.group.visible).map(part => part.id).join(' ') ?? '';
  useEffect(() => {
    try { localStorage.setItem(subassemblyStorageKey(definition.id), JSON.stringify(settings)); } catch { /* The page works without storage. */ }
    // settings shared with the page that owns them are kept there too
    saveShared(definition, settings.config);
  }, [settings, definition.id]);
  // after the save above, so the pages fitted to this one read the new settings
  const otherIssues = useOtherPageIssues(dependentsOf(definition.id).map(d => d.page), JSON.stringify(config));
  useEffect(() => {
    const element = container.current; if (!element) return;
    const stage = createStage(element, `Interactive ${definition.title.toLowerCase()} concept. Drag to orbit, scroll to zoom, right-drag to pan.`, { scale: definition.stageScale ?? 10, workshopFloor: false });
    if (!stage) { setUnsupported(true); return; }
    setUnsupported(false);
    const model = definition.build(variant, config);
    stage.group.add(model.root); controller.current = { stage, model };
    model.update(stateRef.current); camera(stateRef.current.view); stage.invalidate(); setAction(model.caption?.() ?? null);
    element.dataset['ready'] = 'true'; element.dataset['visibleParts'] = visibleParts();
    return () => { delete element.dataset['ready']; model.dispose(); stage.dispose(); controller.current = null; };
    // camera and visibleParts read the current refs; the scene is rebuilt only for a new design
  }, [definition, variant, config]);
  useEffect(() => {
    controller.current?.model.update(stateRef.current); controller.current?.stage.invalidate();
    setAction(controller.current?.model.caption?.() ?? null);
    // the cameras follow the sub-assembly when it moves somewhere else, e.g. between the bench and the window
    if ((controller.current?.model.focusOffset?.() ?? [0, 0, 0]).join() !== focus.current) camera(stateRef.current.view);
    if (container.current) container.current.dataset['visibleParts'] = visibleParts();
  }, [viewing]);
  useEffect(() => { camera(view); }, [exploded, view]);
  const selectView = (name: CatioView) => { camera(name); editView({ view: name, cutaway: (definition.cutawayViews ?? ['Interior', 'Mounting']).includes(name) }); };
  const toggleLayer = (id: CatioLayer) => editView({ hidden: hidden.has(id) ? viewing.hidden.filter(layer => layer !== id) : [...viewing.hidden, id] });
  const change = (key: keyof C & string, value: C[keyof C]) => setSettings(current => ({ ...current, config: { ...current.config, [key]: value } }));
  const activePreset = [{ id: 'recommended', config: () => definition.defaults }, ...(definition.presets ?? [])].find(preset => JSON.stringify(preset.config()) === JSON.stringify(config))?.id ?? null;
  const reset = () => setSettings(current => ({ ...current, config: structuredClone(defaultSubassemblySettings(definition).config) }));

  return <>
    <div className="page-heading catio-heading"><div><div className="eyebrow">{definition.eyebrow}</div><h1>{definition.heading}</h1><p>{definition.summary}</p></div>
      <span className="model-tag"><span /> SUB-ASSEMBLY</span></div>
    <div className="catio-modes" role="group" aria-label={`${definition.title} variant`}>{variants.map(option =>
      <button type="button" key={option.id} aria-pressed={variant === option.id} onClick={() => setSettings(current => ({ ...current, variant: option.id }))}>{option.label}</button>)}</div>
    <div className="catio-layout">
      <aside className="catio-brief" aria-label={`${definition.title} parameters`}>
        <span className="eyebrow">{definition.briefLabel}</span>
        <dl className="catio-dimensions">{definition.facts(variant, config).map(fact => <div key={fact.label}><dt>{fact.label}</dt><dd>{fact.value}</dd>{fact.from && <SettingSource from={fact.from} />}</div>)}</dl>
        <div className="catio-parameters subassembly-parameters">
          {definition.presets && <div className="subassembly-presets" role="group" aria-label="Presets"><span className="eyebrow">PRESETS</span>
            <div>{[{ id: 'recommended', label: 'Recommended', description: 'The recommended defaults.', config: () => structuredClone(definition.defaults) }, ...definition.presets].map(preset => {
              return <button type="button" key={preset.id} title={preset.description} aria-pressed={activePreset === preset.id}
                onClick={() => setSettings(current => ({ ...current, config: preset.config() }))}>{preset.label}</button>;
            })}</div>
            <small>{[{ id: 'recommended', description: 'The recommended defaults.' }, ...definition.presets].find(preset => preset.id === activePreset)?.description ?? 'Your own design: start again from a preset or the recommended defaults.'}</small></div>}
          {groups.map(group => <fieldset key={group}><legend>{group}</legend>{controls.filter(control => control.group === group).map(control => {
            const current = config[control.key];
            const shared = definition.shares?.find(share => share.settings.includes(control.key));
            const note = shared ? <SharedNote page={shared.page} /> : <ChangesNote page={definition.id} setting={control.key} />;
            if (control.range) return <NumberField key={control.key} label={control.label} help={control.help} range={control.range} value={Number(current)}
              onCommit={value => change(control.key, value as C[keyof C])} note={note} />;
            return <label className="catio-field subassembly-field" key={control.key}><span>{control.label}</span>
              <select aria-label={control.label} value={String(current)} onChange={event => {
                const option = control.options.find(candidate => String(candidate.value) === event.target.value);
                if (option) change(control.key, option.value);
              }}>{control.options.map(option => <option key={String(option.value)} value={String(option.value)}>{option.label}</option>)}</select>
              <small>{control.help}</small>{note}</label>;
          })}</fieldset>)}
          {errors.length > 0 && <div role="alert" className="catio-errors"><strong>This combination does not fit.</strong><ul>{errors.map(error => <li key={error}>{error}</li>)}</ul></div>}
          <OtherPageIssues issues={otherIssues}>These settings do not fit another page.</OtherPageIssues>
          <button type="button" className="catio-reset" onClick={reset}>Reset to the recommended defaults</button>
        </div>
        {variant === 'modular' && <p>The window and cat port sizes follow the modular design on the <a href={formatHash({ view: 'concepts', concept: 'catio', subassembly: null })}>catio concept</a> page.</p>}
        <PageRelations page={definition.id} follows={definition.follows ?? []} />
      </aside>
      <section className="catio-preview" aria-label={`Live ${definition.title.toLowerCase()} concept`}>
        <div className="catio-preview-title"><span className="eyebrow"><Box size={14} /> LIVE ASSEMBLY</span><span>Dimensions in millimetres</span></div>
        <div className="catio-cameras" role="group" aria-label="Camera views">{VIEWS.map(name =>
          <button key={name} type="button" aria-pressed={name === view} onClick={() => selectView(name)} disabled={unsupported}>{definition.viewLabels?.[name] ?? name}</button>)}
          <button type="button" aria-label="Reset view" title="Reset view" disabled={unsupported} onClick={() => selectView('Exterior')}><RotateCcw size={14} /></button>
        </div>
        <div className="catio-canvas" ref={container} data-testid="subassembly-viewer" data-subassembly={definition.id} data-variant={variant} data-config={JSON.stringify(config)} data-step={index} data-window={windowOpen ? 'open' : 'closed'} data-exploded={exploded}>
          {unsupported && <div className="catio-fallback"><Box size={32} /><strong>3D preview needs WebGL</strong><p>The parts list and assembly instructions below are still available.</p></div>}
        </div>
        <div className="catio-options">
          {toggles.windowOpen && <label><input type="checkbox" checked={windowOpen} onChange={event => editView({ windowOpen: event.target.checked })} disabled={unsupported} /> {toggles.windowOpen}</label>}
          {toggles.cutaway && <label><input type="checkbox" checked={cutaway} onChange={event => editView({ cutaway: event.target.checked })} disabled={unsupported} /> {toggles.cutaway}</label>}
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
    <PartsList lines={bom} />
    <section className="catio-instructions" aria-label="Assembly instructions"><span className="eyebrow">THE ASSEMBLY</span><h2>{definition.assemblyHeading}</h2>
      <ol>{steps.slice(1).map(info => <li key={info.title}><strong>{info.title}</strong><p>{info.detail}</p></li>)}</ol></section>
    <section className="subassembly-decisions" aria-label="Design decisions"><span className="eyebrow">THE DEFAULTS, AND WHY</span><h2>Choices to redirect.</h2>
      <div>{definition.decisions.map(decision => <article key={decision.title}><h3>{decision.title}</h3>{decision.parameter && <span className="eyebrow">PARAMETER · {decision.parameter.toUpperCase()}</span>}{decision.from && <SettingSource from={decision.from} />}<p><strong>Chosen: </strong>{decision.choice}</p><p>{decision.why}</p></article>)}</div></section>
  </>;
}

/** A free number: typed in its display unit, kept while it is being typed, and stored once its range accepts it. */
function NumberField({ label, help, range, value, onCommit, note }: { label: string; help: string; range: NumberRange; value: number; onCommit: (value: number) => void; note?: ReactNode }) {
  const scale = range.scale ?? 1;
  const shown = (stored: number) => String(Number((stored / scale).toFixed(3)));
  const [text, setText] = useState(() => shown(value));
  useEffect(() => { setText(shown(value)); }, [value, scale]);
  /** The stored value a typed text stands for, or null when its range does not accept it. */
  const parse = (typed: string) => {
    const stored = Math.round(Number(typed) * scale * 1e6) / 1e6;
    return typed.trim() !== '' && inRange(range, stored) ? stored : null;
  };
  return <label className="catio-field subassembly-field"><span>{label} <em className="subassembly-unit">{range.unit}</em></span>
    <input type="number" aria-label={label} aria-invalid={parse(text) === null} min={range.min / scale} max={range.max / scale} step={range.step / scale} value={text}
      onChange={event => {
        setText(event.target.value);
        const next = parse(event.target.value); if (next !== null) onCommit(next);
      }}
      onBlur={() => setText(shown(value))} />
    <small>{help} {`${shown(range.min)}–${shown(range.max)} ${range.unit}.`}</small>{note}</label>;
}

function PartsList({ lines }: { lines: BomLine[] }) {
  return <section className="subassembly-parts" aria-label="Parts list"><span className="eyebrow">THE PARTS</span><h2>Everything it takes.</h2>
    <p>Timber is cut for this design; hardware links to the parts library, with its standard or maker’s dimensions, and printed parts to their model. Sizes in millimetres.</p>
    {BOM_GROUPS.map(group => {
      const rows = lines.filter(line => line.group === group);
      return rows.length > 0 && <table key={group} aria-label={`${group} parts`}><caption>{group}</caption>
        <thead><tr><th scope="col">Qty</th><th scope="col">Part</th><th scope="col">Dimensions</th><th scope="col">Where</th></tr></thead>
        <tbody>{rows.map(line => <tr key={line.id}><td>{line.quantity}</td>
          <td>{line.partId ? <a href={formatHash({ view: 'parts', family: findPart(line.partId)?.family ?? null, part: line.partId, filters: {} })}>{line.name}</a>
            : line.modelId ? <a href={formatHash({ view: 'models', model: line.modelId })}>{line.name}</a> : line.name}</td>
          <td>{line.size}</td><td>{line.use}</td></tr>)}</tbody></table>;
    })}</section>;
}
