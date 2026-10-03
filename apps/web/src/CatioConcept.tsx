import { useEffect, useRef, useState } from 'react';
import { ArrowDownToLine, ArrowLeft, ArrowRight, Box, RotateCcw } from 'lucide-react';
import * as THREE from 'three';
import { createStage, type Stage } from './stage.ts';
import { createCatioScene, type CatioState } from './catioScene.ts';
import { CatioParameters } from './CatioParameters.tsx';
import { createModularCatio, type CatioDoor } from './catioModularScene.ts';
import { MODULAR_DEFAULT, MODULAR_STEPS, modularCamera, modularLayout, validateModular, type ModularConfig } from './catioModularDesign.ts';
import { CATIO_STORAGE_KEY, loadCatioSettings, type CatioViewing, type CatioMode } from './catioSettings.ts';
import { CATIO_STEPS, CATIO_VIEWS, type CatioLayer, type CatioView } from './catioDesign.ts';
import { CATIO_SUBASSEMBLY_TITLES } from './catioSubassemblies.ts';
import { OtherPageIssues, useOtherPageIssues } from './CatioCrossPage.tsx';
import { CATIO_SUBASSEMBLIES, formatHash } from './route.ts';

const assets = import.meta.glob<string>('../../../docs/concepts/catio/*.png', { eager: true, query: '?url', import: 'default' });
const sheets = [
  ['01-overview', 'At home, outside', 'Exterior and interior views of the same timber catio.'],
  ['02-orientations', 'Every angle', 'Front, side and top views with consistent proportions.'],
  ['03-window-attachment', 'A removable connection', 'Reachable clamps, exterior brackets and a section through the recess.'],
  ['04-ground-details', 'Grass under their paws', 'The ramp, four feet and continuous metal-mesh floor.'],
  ['05-exploded', 'How it fits together', 'The window collar, enclosure panels, roof, door and ramp.'],
  ['06-assembly', 'From window to catio', 'Six illustrated stages matching the live assembly preview.'],
  ['07-modular-overview', 'Room to move', 'A smaller tunnel connects the window insert to a freestanding enclosure.'],
  ['08-modular-orientations', 'The modular design, all around', 'Front, side, top and three-quarter studies of the connected system.'],
  ['09-modular-window', 'One small door, a new route', 'The sliding window gate, padded clamps and removable tunnel coupling.'],
  ['10-modular-access', 'Two scales of access', 'Full-front maintenance doors and smaller, independently closable cat ports.'],
  ['11-modular-layouts', 'Move it. Extend it.', 'Straight and offset routes, with a second enclosure linked at the side.'],
  ['12-modular-assembly', 'Connect, then open', 'Assembly and disconnection with shut-off gates at both ends.'],
] as const;

const layers: { id: CatioLayer; title: string }[] = [
  { id: 'timber', title: 'Timber & ramp' }, { id: 'mesh', title: 'Metal mesh' },
  { id: 'hardware', title: 'Mounting & feet' }, { id: 'environment', title: 'Wall & grass' },
];

export function CatioConcept() {
  const container = useRef<HTMLDivElement>(null);
  const controller = useRef<{ stage: Stage; model: ReturnType<typeof createCatioScene> | ReturnType<typeof createModularCatio> } | null>(null);
  const [settings, setSettings] = useState(loadCatioSettings);
  const [draft, setDraft] = useState(settings.config);
  const [unsupported, setUnsupported] = useState(false);
  const [doors, setDoors] = useState<CatioDoor[]>([]);
  const [filter, setFilter] = useState<'All' | 'Direct' | 'Modular'>('All');
  const { mode, config } = settings;
  const viewing = settings.views[mode];
  const { progress, exploded, windowOpen, cutaway, view } = viewing;
  const hidden = new Set(viewing.hidden);
  const stateRef = useRef<CatioState & { doors: Record<string, boolean> }>({ ...viewing, hidden });
  stateRef.current = { ...viewing, hidden };
  const steps = mode === 'modular' ? MODULAR_STEPS : CATIO_STEPS;
  const index = Math.ceil(progress); const step = steps[index] ?? steps[6];
  const editView = (patch: Partial<CatioViewing>) => setSettings(current => ({ ...current, views: { ...current.views, [mode]: { ...current.views[mode], ...patch } } }));
  const setProgress = (value: number) => editView({ progress: value });
  const setExploded = (value: boolean) => editView({ exploded: value });
  const setWindowOpen = (value: boolean) => editView({ windowOpen: value });
  const setCutaway = (value: boolean) => editView({ cutaway: value });
  const camera = (name: CatioView) => {
    const preset = mode === 'modular' ? modularCamera(config, name, stateRef.current.exploded) : CATIO_VIEWS[name];
    const target = new THREE.Vector3(...preset.target);
    const position = new THREE.Vector3(...preset.position);
    if (mode === 'direct' && stateRef.current.exploded) position.sub(target).multiplyScalar(1.3).add(target);
    controller.current?.stage.lookAt(position, target);
  };
  useEffect(() => {
    try { localStorage.setItem(CATIO_STORAGE_KEY, JSON.stringify(settings)); } catch { /* The scene remains usable when storage is unavailable. */ }
  }, [settings]);
  // after the save above: the sub-assembly pages take the window and cat port sizes from it
  const otherIssues = useOtherPageIssues(CATIO_SUBASSEMBLIES, JSON.stringify(settings.config));
  useEffect(() => {
    const element = container.current; if (!element) return;
    const bounds = modularLayout(config).bounds;
    const scale = mode === 'direct' ? 12 : Math.max(12, (bounds.maxX - bounds.minX + bounds.maxY) / 220);
    const stage = createStage(element, 'Interactive catio concept. Drag to orbit, scroll to zoom, right-drag to pan.', { scale, workshopFloor: false });
    if (!stage) { setUnsupported(true); return; }
    setUnsupported(false);
    const model = mode === 'direct' ? createCatioScene() : createModularCatio(config);
    stage.group.add(model.root); controller.current = { stage, model };
    setDoors('doors' in model ? model.doors : []);
    model.update(stateRef.current); camera(view); stage.invalidate();
    element.dataset['ready'] = 'true';
    element.dataset['visibleParts'] = model.components.filter(part => part.group.visible).map(part => part.id).join(' ');
    return () => { delete element.dataset['ready']; model.dispose(); stage.dispose(); controller.current = null; };
  }, [mode, config]);
  useEffect(() => {
    controller.current?.model.update(stateRef.current);
    controller.current?.stage.invalidate();
    if (container.current) container.current.dataset['visibleParts'] = controller.current?.model.components.filter(part => part.group.visible).map(part => part.id).join(' ') ?? '';
  }, [viewing]);
  useEffect(() => { camera(view); }, [exploded, view]);
  const selectView = (name: CatioView) => {
    camera(name);
    editView({ view: name, cutaway: name === 'Interior' || name === 'Mounting' });
  };
  const toggleLayer = (id: CatioLayer) => editView({ hidden: hidden.has(id) ? viewing.hidden.filter(layer => layer !== id) : [...viewing.hidden, id] });
  const changeConfig = (next: ModularConfig) => {
    setDraft(next);
    if (!validateModular(next).length) setSettings(current => ({ ...current, config: next }));
  };

  return <>
    <div className="page-heading catio-heading"><div><div className="eyebrow">CONCEPT STUDY · 01</div><h1>A little closer to the grass.</h1>
      <p>A removable window catio for a souterrain apartment. Timber, metal mesh, and a gentle route outside.</p>
      <nav className="catio-subassemblies" aria-label="Catio sub-assemblies"><span className="eyebrow">SUB-ASSEMBLIES · PIECES, JOINTS AND PARTS LISTS</span>
        <div>{CATIO_SUBASSEMBLIES.map(id => <a key={id} href={formatHash({ view: 'concepts', concept: 'catio', subassembly: id })}><strong>{CATIO_SUBASSEMBLY_TITLES[id]}</strong><span>pieces, joints and parts list</span><ArrowRight size={16} /></a>)}</div></nav></div><span className="model-tag"><span /> CATIO CONCEPT</span></div>
    <div className="catio-modes" role="group" aria-label="Catio design mode">{(['direct', 'modular'] as CatioMode[]).map(option => <button type="button" key={option} aria-pressed={mode === option} onClick={() => setSettings(current => ({ ...current, mode: option }))}>{option === 'direct' ? 'Direct · original design' : 'Modular · with tunnel'}</button>)}</div>
    <div className="catio-layout">
      <aside className="catio-brief" aria-label="Catio design dimensions">
        <span className="eyebrow">THE STARTING POINT</span><h2>Room to look.<br />Grass to touch.</h2>
        {mode === 'direct' ? <dl className="catio-dimensions">
          <div><dt>Enclosure · W × D × H</dt><dd>120 × 100 × 120 <small>cm</small></dd></div>
          <div><dt>Glass · measured</dt><dd>80 × 80 <small>cm</small></dd></div>
          <div><dt>Opening sash · measured</dt><dd>91 × 91 <small>cm</small></dd></div>
          <div><dt>Sill above grass · assumed</dt><dd>20 <small>cm</small></dd></div>
        </dl> : <CatioParameters draft={draft} change={changeConfig} reset={() => changeConfig(structuredClone(MODULAR_DEFAULT))} />}
        {mode === 'modular' && <OtherPageIssues issues={otherIssues}>These sizes do not fit a sub-assembly.</OtherPageIssues>}
        <p>The collar is tightened from inside the open window. The enclosure stands on four feet; its mesh floor rests at grass level.</p>
        <p>The window can close with the attachment installed. A latched front door gives access for maintenance.</p>
        <details className="catio-assumptions"><summary>Illustrative dimensions</summary>
          <p>Fixed frame: 100 × 100 cm. Wall: 30 cm thick. Exterior recess: 15 cm deep. Timber: 45 mm square. Mesh openings: nominally 20 mm. Ramp: 30 cm wide, 70 cm horizontal run. Hinges are on the left viewed from indoors.</p>
          <p>These are concept assumptions, pending measurement. Hardware fit and structural sizing belong to the detailed design. Modular mode lets you adjust window, enclosure and tunnel dimensions. The 20 cm sill-to-grass drop is an assumption to confirm.</p>
        </details>
        <a className="catio-gallery-link" href="#catio-sheets" onClick={event => { event.preventDefault(); document.getElementById('catio-sheets')?.scrollIntoView({ behavior: 'smooth' }); }}>Explore the design sheets <ArrowDownToLine size={15} /></a>
      </aside>
      <section className="catio-preview" aria-label="Live catio concept">
        <div className="catio-preview-title"><span className="eyebrow"><Box size={14} /> LIVE CONCEPT</span><span>Dimensions in centimetres</span></div>
        <div className="catio-cameras" role="group" aria-label="Camera views">{(Object.keys(CATIO_VIEWS) as CatioView[]).map(name =>
          <button key={name} type="button" aria-pressed={name === view} onClick={() => selectView(name)} disabled={unsupported}>{name}</button>)}
          <button type="button" aria-label="Reset catio view" title="Reset view" disabled={unsupported} onClick={() => selectView('Exterior')}><RotateCcw size={14} /></button>
        </div>
        <div className="catio-canvas" ref={container} data-testid="catio-viewer" data-mode={mode} data-config={JSON.stringify(config)} data-step={index} data-window={windowOpen ? 'open' : 'closed'} data-exploded={exploded}>
          {unsupported && <div className="catio-fallback"><Box size={32} /><strong>3D preview needs WebGL</strong><p>The concept sheets and assembly instructions below are still available.</p></div>}
        </div>
        <div className="catio-options">
          <label><input type="checkbox" checked={windowOpen} onChange={event => setWindowOpen(event.target.checked)} disabled={unsupported} /> Window open</label>
          <label><input type="checkbox" checked={cutaway} onChange={event => setCutaway(event.target.checked)} disabled={unsupported} /> Wall cutaway</label>
          <label><input type="checkbox" checked={exploded} onChange={event => setExploded(event.target.checked)} disabled={unsupported} /> Exploded view</label>
          <span>Drag to orbit · Scroll to zoom</span>
        </div>
        {mode === 'modular' && <div className="catio-door-controls" role="group" aria-label="Doors and gates"><strong>Doors &amp; gates</strong><p>Checked means open. Cat gates open only at the completed stage; unused ports stay closed.</p>{doors.map(door => <label key={door.id}><input type="checkbox" checked={door.connected && (door.kind === 'human' || progress >= 6) && (viewing.doors[door.id] ?? door.kind === 'cat')} disabled={unsupported || !door.connected || (door.kind === 'cat' && progress < 6)} onChange={event => editView({ doors: { ...viewing.doors, [door.id]: event.target.checked } })} />{door.label}{!door.connected && <small>Unused · closed</small>}</label>)}<p>Close and latch both end gates before disconnecting a tunnel. The default 120 cm high maintenance door gives crouching or reaching access.</p></div>}
        <div className="catio-assembly">
          <div className="catio-step-title"><span className="eyebrow">{index === 0 ? 'BEFORE ASSEMBLY' : `STAGE ${index} / 6`}</span><strong aria-live="polite">{step.title}</strong></div>
          <div className="catio-slider"><button type="button" aria-label="Previous assembly stage" disabled={progress === 0} onClick={() => setProgress(Math.max(0, Math.ceil(progress) - 1))}><ArrowLeft size={16} /></button>
            <input type="range" min="0" max="6" step="0.01" value={progress} aria-label="Catio assembly" aria-valuetext={`${index} of 6 · ${step.title}`} onChange={event => setProgress(Number(event.target.value))} />
            <button type="button" aria-label="Next assembly stage" disabled={progress === 6} onClick={() => setProgress(Math.min(6, Math.floor(progress) + 1))}><ArrowRight size={16} /></button></div>
          <p>{step.detail}</p>
        </div>
        <div className="catio-layers" role="group" aria-label="Visible catio components">{layers.map(layer => <button key={layer.id} type="button" aria-pressed={!hidden.has(layer.id)} disabled={unsupported} onClick={() => toggleLayer(layer.id)}>{layer.title}</button>)}</div>
      </section>
    </div>
    <section id="catio-sheets" className="catio-sheets" aria-label="Catio concept images"><div className="catio-section-heading"><div><span className="eyebrow">TWO DESIGNS, TWELVE STUDIES</span><h2>Look a little closer.</h2></div><p>Design references for the next step: a detailed, parametric model.</p></div>
      <div className="catio-modes" role="group" aria-label="Filter design sheets">{(['All', 'Direct', 'Modular'] as const).map(option => <button type="button" key={option} aria-pressed={filter === option} onClick={() => setFilter(option)}>{option}</button>)}</div>
      <div className="catio-gallery">{sheets.filter((_, i) => filter === 'All' || (filter === 'Direct' ? i < 6 : i >= 6)).map(([file, title, caption]) => {
        const url = assets[`../../../docs/concepts/catio/${file}.png`];
        return <figure key={file}>{url && <a href={url} target="_blank" rel="noreferrer" aria-label={`Open ${title} concept sheet`}><img src={url} alt={`${title}. ${caption}`} loading="lazy" /></a>}
          <figcaption><span className="eyebrow">STUDY {file.slice(0, 2)}</span><h3>{title}</h3><p>{caption}</p>{url && <a href={url} download={`${file}.png`}>Download PNG <ArrowDownToLine size={13} /></a>}</figcaption></figure>;
      })}</div>
    </section>
    <section className="catio-instructions" aria-label="Assembly instructions"><span className="eyebrow">THE ASSEMBLY</span><h2>From the room to the lawn.</h2><ol>{steps.slice(1).map(stepInfo => <li key={stepInfo.title}><strong>{stepInfo.title}</strong><p>{stepInfo.detail}</p></li>)}</ol></section>
  </>;
}
