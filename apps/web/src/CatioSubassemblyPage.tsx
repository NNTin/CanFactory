import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Box, RotateCcw } from 'lucide-react';
import * as THREE from 'three';
import { findPart } from '@canfactory/contracts';
import { createStage, type Stage } from './stage.ts';
import type { CatioLayer, CatioView } from './catioDesign.ts';
import type { CatioMode } from './catioSettings.ts';
import { loadSubassemblySettings, subassemblyStorageKey, defaultSubassemblySettings, type BomLine, type SubassemblyDefinition, type SubassemblyModel, type SubassemblyViewing } from './catioSubassembly.ts';
import { windowInsertDefinition } from './catioSubassemblies.ts';
import { formatHash, type CatioSubassembly } from './route.ts';

const VIEWS: CatioView[] = ['Exterior', 'Interior', 'Front', 'Side', 'Top', 'Mounting'];
const LAYERS: { id: CatioLayer; title: string }[] = [
  { id: 'timber', title: 'Timber' }, { id: 'mesh', title: 'Metal mesh' }, { id: 'hardware', title: 'Clamps & fixings' }, { id: 'environment', title: 'Wall & grass' },
];
const VARIANTS: { id: CatioMode; label: string }[] = [{ id: 'direct', label: 'Direct · original design' }, { id: 'modular', label: 'Modular · with tunnel' }];

/** The page of one catio sub-assembly, picked by its route. */
export function CatioSubassemblyRoute({ id }: { id: CatioSubassembly }) {
  // One definition so far; the tunnel and the enclosure become cases here.
  const pages: Record<CatioSubassembly, () => React.JSX.Element> = { 'window-insert': () => <CatioSubassemblyPage definition={windowInsertDefinition} /> };
  return pages[id]();
}

/** Any sub-assembly: variants, its design parameters, a staged live preview, a parts list and the reasons behind its defaults. */
export function CatioSubassemblyPage<C extends object>({ definition }: { definition: SubassemblyDefinition<C> }) {
  const container = useRef<HTMLDivElement>(null);
  const controller = useRef<{ stage: Stage; model: SubassemblyModel } | null>(null);
  const [settings, setSettings] = useState(() => loadSubassemblySettings(definition));
  const [unsupported, setUnsupported] = useState(false);
  const { variant, config } = settings;
  const viewing = settings.views[variant];
  const { progress, exploded, windowOpen, cutaway, view } = viewing;
  const hidden = new Set(viewing.hidden);
  const stateRef = useRef({ ...viewing, hidden });
  stateRef.current = { ...viewing, hidden };
  const steps = definition.steps(variant, config); const last = steps.length - 1;
  const index = Math.ceil(progress); const step = steps[index] ?? steps[last];
  const errors = definition.validate(variant, config);
  const bom = definition.bom(variant, config);
  const controls = definition.controls.filter(control => !control.variants || control.variants.includes(variant));
  const groups = [...new Set(controls.map(control => control.group))];
  const editView = (patch: Partial<SubassemblyViewing>) => setSettings(current => ({ ...current, views: { ...current.views, [current.variant]: { ...current.views[current.variant], ...patch } } }));
  const camera = (name: CatioView) => {
    const preset = definition.views(variant, config)[name];
    const target = new THREE.Vector3(...preset.target); const position = new THREE.Vector3(...preset.position);
    if (stateRef.current.exploded) position.sub(target).multiplyScalar(1.45).add(target);
    controller.current?.stage.lookAt(position, target);
  };
  const visibleParts = () => controller.current?.model.components.filter(part => part.group.visible).map(part => part.id).join(' ') ?? '';
  useEffect(() => {
    try { localStorage.setItem(subassemblyStorageKey(definition.id), JSON.stringify(settings)); } catch { /* The page works without storage. */ }
  }, [settings, definition.id]);
  useEffect(() => {
    const element = container.current; if (!element) return;
    const stage = createStage(element, `Interactive ${definition.title.toLowerCase()} concept. Drag to orbit, scroll to zoom, right-drag to pan.`, { scale: 10, workshopFloor: false });
    if (!stage) { setUnsupported(true); return; }
    setUnsupported(false);
    const model = definition.build(variant, config);
    stage.group.add(model.root); controller.current = { stage, model };
    model.update(stateRef.current); camera(stateRef.current.view); stage.invalidate();
    element.dataset['ready'] = 'true'; element.dataset['visibleParts'] = visibleParts();
    return () => { delete element.dataset['ready']; model.dispose(); stage.dispose(); controller.current = null; };
    // camera and visibleParts read the current refs; the scene is rebuilt only for a new design
  }, [definition, variant, config]);
  useEffect(() => {
    controller.current?.model.update(stateRef.current); controller.current?.stage.invalidate();
    if (container.current) container.current.dataset['visibleParts'] = visibleParts();
  }, [viewing]);
  useEffect(() => { camera(view); }, [exploded, view]);
  const selectView = (name: CatioView) => { camera(name); editView({ view: name, cutaway: name === 'Interior' || name === 'Mounting' }); };
  const toggleLayer = (id: CatioLayer) => editView({ hidden: hidden.has(id) ? viewing.hidden.filter(layer => layer !== id) : [...viewing.hidden, id] });
  const change = (key: keyof C & string, value: C[keyof C]) => setSettings(current => ({ ...current, config: { ...current.config, [key]: value } }));
  const reset = () => setSettings(current => ({ ...current, config: structuredClone(defaultSubassemblySettings(definition).config) }));

  return <>
    <div className="page-heading catio-heading"><div><div className="eyebrow">{definition.eyebrow}</div><h1>{definition.heading}</h1><p>{definition.summary}</p></div>
      <span className="model-tag"><span /> SUB-ASSEMBLY</span></div>
    <div className="catio-modes" role="group" aria-label={`${definition.title} variant`}>{VARIANTS.map(option =>
      <button type="button" key={option.id} aria-pressed={variant === option.id} onClick={() => setSettings(current => ({ ...current, variant: option.id }))}>{option.label}</button>)}</div>
    <div className="catio-layout">
      <aside className="catio-brief" aria-label={`${definition.title} parameters`}>
        <span className="eyebrow">THE INSERT</span>
        <dl className="catio-dimensions">{definition.facts(variant, config).map(fact => <div key={fact.label}><dt>{fact.label}</dt><dd>{fact.value}</dd></div>)}</dl>
        <div className="catio-parameters subassembly-parameters">
          {groups.map(group => <fieldset key={group}><legend>{group}</legend>{controls.filter(control => control.group === group).map(control => {
            const current = config[control.key];
            return <label className="catio-field subassembly-field" key={control.key}><span>{control.label}</span>
              <select aria-label={control.label} value={String(current)} onChange={event => {
                const option = control.options.find(candidate => String(candidate.value) === event.target.value);
                if (option) change(control.key, option.value);
              }}>{control.options.map(option => <option key={String(option.value)} value={String(option.value)}>{option.label}</option>)}</select>
              <small>{control.help}</small></label>;
          })}</fieldset>)}
          {errors.length > 0 && <div role="alert" className="catio-errors"><strong>This combination does not fit.</strong><ul>{errors.map(error => <li key={error}>{error}</li>)}</ul></div>}
          <button type="button" className="catio-reset" onClick={reset}>Reset to the recommended defaults</button>
        </div>
        {variant === 'modular' && <p>The window and cat port sizes follow the modular design on the <a href={formatHash({ view: 'concepts', concept: 'catio', subassembly: null })}>catio concept</a> page.</p>}
      </aside>
      <section className="catio-preview" aria-label={`Live ${definition.title.toLowerCase()} concept`}>
        <div className="catio-preview-title"><span className="eyebrow"><Box size={14} /> LIVE ASSEMBLY</span><span>Dimensions in millimetres</span></div>
        <div className="catio-cameras" role="group" aria-label="Camera views">{VIEWS.map(name =>
          <button key={name} type="button" aria-pressed={name === view} onClick={() => selectView(name)} disabled={unsupported}>{name}</button>)}
          <button type="button" aria-label="Reset view" title="Reset view" disabled={unsupported} onClick={() => selectView('Exterior')}><RotateCcw size={14} /></button>
        </div>
        <div className="catio-canvas" ref={container} data-testid="subassembly-viewer" data-subassembly={definition.id} data-variant={variant} data-config={JSON.stringify(config)} data-step={index} data-window={windowOpen ? 'open' : 'closed'} data-exploded={exploded}>
          {unsupported && <div className="catio-fallback"><Box size={32} /><strong>3D preview needs WebGL</strong><p>The parts list and assembly instructions below are still available.</p></div>}
        </div>
        <div className="catio-options">
          <label><input type="checkbox" checked={windowOpen} onChange={event => editView({ windowOpen: event.target.checked })} disabled={unsupported} /> Window open</label>
          <label><input type="checkbox" checked={cutaway} onChange={event => editView({ cutaway: event.target.checked })} disabled={unsupported} /> Wall cutaway</label>
          <label><input type="checkbox" checked={exploded} onChange={event => editView({ exploded: event.target.checked })} disabled={unsupported} /> Exploded view</label>
          <span>Drag to orbit · Scroll to zoom</span>
        </div>
        <div className="catio-assembly">
          <div className="catio-step-title"><span className="eyebrow">{index === 0 ? 'BEFORE ASSEMBLY' : `STAGE ${index} / ${last}`}</span><strong aria-live="polite">{step?.title}</strong></div>
          <div className="catio-slider"><button type="button" aria-label="Previous assembly stage" disabled={progress === 0} onClick={() => editView({ progress: Math.max(0, Math.ceil(progress) - 1) })}><ArrowLeft size={16} /></button>
            <input type="range" min="0" max={last} step="0.01" value={progress} aria-label={`${definition.title} assembly`} aria-valuetext={`${index} of ${last} · ${step?.title ?? ''}`} onChange={event => editView({ progress: Number(event.target.value) })} />
            <button type="button" aria-label="Next assembly stage" disabled={progress === last} onClick={() => editView({ progress: Math.min(last, Math.floor(progress) + 1) })}><ArrowRight size={16} /></button></div>
          <p>{step?.detail}</p>
        </div>
        <div className="catio-layers" role="group" aria-label="Visible components">{LAYERS.map(layer => <button key={layer.id} type="button" aria-pressed={!hidden.has(layer.id)} disabled={unsupported} onClick={() => toggleLayer(layer.id)}>{layer.title}</button>)}</div>
      </section>
    </div>
    <PartsList lines={bom} />
    <section className="catio-instructions" aria-label="Assembly instructions"><span className="eyebrow">THE ASSEMBLY</span><h2>From the bench to the window.</h2>
      <ol>{steps.slice(1).map(info => <li key={info.title}><strong>{info.title}</strong><p>{info.detail}</p></li>)}</ol></section>
    <section className="subassembly-decisions" aria-label="Design decisions"><span className="eyebrow">THE DEFAULTS, AND WHY</span><h2>Choices to redirect.</h2>
      <div>{definition.decisions.map(decision => <article key={decision.title}><h3>{decision.title}</h3>{decision.parameter && <span className="eyebrow">PARAMETER · {decision.parameter.toUpperCase()}</span>}<p><strong>Chosen: </strong>{decision.choice}</p><p>{decision.why}</p></article>)}</div></section>
  </>;
}

function PartsList({ lines }: { lines: BomLine[] }) {
  return <section className="subassembly-parts" aria-label="Parts list"><span className="eyebrow">THE PARTS</span><h2>Everything it takes.</h2>
    <p>Timber is cut for this design; hardware links to the parts library, with its standard or maker’s dimensions. Sizes in millimetres.</p>
    {(['Timber', 'Mesh', 'Hardware'] as const).map(group => {
      const rows = lines.filter(line => line.group === group);
      return rows.length > 0 && <table key={group} aria-label={`${group} parts`}><caption>{group}</caption>
        <thead><tr><th scope="col">Qty</th><th scope="col">Part</th><th scope="col">Dimensions</th><th scope="col">Where</th></tr></thead>
        <tbody>{rows.map(line => <tr key={line.id}><td>{line.quantity}</td>
          <td>{line.partId ? <a href={formatHash({ view: 'parts', family: findPart(line.partId)?.family ?? null, part: line.partId, filters: {} })}>{line.name}</a> : line.name}</td>
          <td>{line.size}</td><td>{line.use}</td></tr>)}</tbody></table>;
    })}</section>;
}
