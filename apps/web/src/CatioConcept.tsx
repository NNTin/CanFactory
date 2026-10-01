import { useEffect, useRef, useState } from 'react';
import { ArrowDownToLine, ArrowLeft, ArrowRight, Box, RotateCcw } from 'lucide-react';
import * as THREE from 'three';
import { createStage, type Stage } from './stage.ts';
import { createCatioScene, type CatioState } from './catioScene.ts';
import { CATIO_STEPS, CATIO_VIEWS, type CatioLayer, type CatioView } from './catioDesign.ts';

const assets = import.meta.glob<string>('../../../docs/concepts/catio/*.png', { eager: true, query: '?url', import: 'default' });
const sheets = [
  ['01-overview', 'At home, outside', 'Exterior and interior views of the same timber catio.'],
  ['02-orientations', 'Every angle', 'Front, side and top views with consistent proportions.'],
  ['03-window-attachment', 'A removable connection', 'Reachable clamps, exterior brackets and a section through the recess.'],
  ['04-ground-details', 'Grass under their paws', 'The ramp, four feet and continuous metal-mesh floor.'],
  ['05-exploded', 'How it fits together', 'The window collar, enclosure panels, roof, door and ramp.'],
  ['06-assembly', 'From window to catio', 'Six illustrated stages matching the live assembly preview.'],
] as const;

const layers: { id: CatioLayer; title: string }[] = [
  { id: 'timber', title: 'Timber & ramp' }, { id: 'mesh', title: 'Metal mesh' },
  { id: 'hardware', title: 'Mounting & feet' }, { id: 'environment', title: 'Wall & grass' },
];

export function CatioConcept() {
  const container = useRef<HTMLDivElement>(null);
  const controller = useRef<{ stage: Stage; model: ReturnType<typeof createCatioScene> } | null>(null);
  const [unsupported, setUnsupported] = useState(false);
  const [progress, setProgress] = useState(6);
  const [exploded, setExploded] = useState(false);
  const [windowOpen, setWindowOpen] = useState(true);
  const [cutaway, setCutaway] = useState(false);
  const [hidden, setHidden] = useState<ReadonlySet<CatioLayer>>(() => new Set());
  const [view, setView] = useState<CatioView>('Exterior');
  const stateRef = useRef<CatioState>({ progress, exploded, windowOpen, cutaway, hidden });
  stateRef.current = { progress, exploded, windowOpen, cutaway, hidden };
  const index = Math.ceil(progress); const step = CATIO_STEPS[index] ?? CATIO_STEPS[6];

  const camera = (name: CatioView) => {
    const preset = CATIO_VIEWS[name];
    const target = new THREE.Vector3(...preset.target);
    const position = new THREE.Vector3(...preset.position);
    if (stateRef.current.exploded) position.sub(target).multiplyScalar(1.3).add(target);
    controller.current?.stage.lookAt(position, target);
  };
  useEffect(() => {
    const element = container.current; if (!element) return;
    const stage = createStage(element, 'Interactive catio concept. Drag to orbit, scroll to zoom, right-drag to pan.', { scale: 12, workshopFloor: false, renderOnDemand: true });
    if (!stage) { setUnsupported(true); return; }
    const model = createCatioScene(); stage.group.add(model.root);
    controller.current = { stage, model }; model.update(stateRef.current);
    const preset = CATIO_VIEWS.Exterior;
    stage.lookAt(new THREE.Vector3(...preset.position), new THREE.Vector3(...preset.target));
    element.dataset['ready'] = 'true';
    return () => { delete element.dataset['ready']; model.dispose(); stage.dispose(); controller.current = null; };
  }, []);
  useEffect(() => {
    controller.current?.model.update({ progress, exploded, windowOpen, cutaway, hidden });
    controller.current?.stage.invalidate();
    if (container.current) container.current.dataset['visibleParts'] = controller.current?.model.components.filter(part => part.group.visible).map(part => part.id).join(' ') ?? '';
  }, [progress, exploded, windowOpen, cutaway, hidden]);
  useEffect(() => { camera(view); }, [exploded, view]);
  const selectView = (name: CatioView) => {
    setView(name); camera(name);
    setCutaway(name === 'Interior' || name === 'Mounting');
  };
  const toggleLayer = (id: CatioLayer) => setHidden(current => {
    const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next;
  });

  return <>
    <div className="page-heading catio-heading"><div><div className="eyebrow">CONCEPT STUDY · 01</div><h1>A little closer to the grass.</h1>
      <p>A removable window catio for a souterrain apartment. Timber, metal mesh, and a gentle route outside.</p></div><span className="model-tag"><span /> CATIO CONCEPT</span></div>
    <div className="catio-layout">
      <aside className="catio-brief" aria-label="Catio design dimensions">
        <span className="eyebrow">THE STARTING POINT</span><h2>Room to look.<br />Grass to touch.</h2>
        <dl className="catio-dimensions">
          <div><dt>Enclosure · W × D × H</dt><dd>120 × 100 × 120 <small>cm</small></dd></div>
          <div><dt>Glass · measured</dt><dd>80 × 80 <small>cm</small></dd></div>
          <div><dt>Opening sash · measured</dt><dd>91 × 91 <small>cm</small></dd></div>
          <div><dt>Sill above grass · measured</dt><dd>20 <small>cm</small></dd></div>
        </dl>
        <p>The collar is tightened from inside the open window. The enclosure stands on four feet; its mesh floor rests at grass level.</p>
        <p>The window can close with the attachment installed. A latched front door gives access for maintenance.</p>
        <details className="catio-assumptions"><summary>Illustrative dimensions</summary>
          <p>Fixed frame: 100 × 100 cm. Wall: 30 cm thick. Exterior recess: 15 cm deep. Timber: 45 mm square. Mesh openings: nominally 20 mm. Ramp: 30 cm wide, 70 cm horizontal run. Hinges are on the left viewed from indoors.</p>
          <p>These are concept assumptions, pending measurement. Hardware fit and structural sizing belong to the detailed design. Adjustable enclosure and window sizes follow later.</p>
        </details>
        <a className="catio-gallery-link" href="#catio-sheets" onClick={event => { event.preventDefault(); document.getElementById('catio-sheets')?.scrollIntoView({ behavior: 'smooth' }); }}>Explore the design sheets <ArrowDownToLine size={15} /></a>
      </aside>
      <section className="catio-preview" aria-label="Live catio concept">
        <div className="catio-preview-title"><span className="eyebrow"><Box size={14} /> LIVE CONCEPT</span><span>Dimensions in centimetres</span></div>
        <div className="catio-cameras" role="group" aria-label="Camera views">{(Object.keys(CATIO_VIEWS) as CatioView[]).map(name =>
          <button key={name} type="button" aria-pressed={name === view} onClick={() => selectView(name)} disabled={unsupported}>{name}</button>)}
          <button type="button" aria-label="Reset catio view" title="Reset view" disabled={unsupported} onClick={() => selectView('Exterior')}><RotateCcw size={14} /></button>
        </div>
        <div className="catio-canvas" ref={container} data-testid="catio-viewer" data-step={index} data-window={windowOpen ? 'open' : 'closed'} data-exploded={exploded}>
          {unsupported && <div className="catio-fallback"><Box size={32} /><strong>3D preview needs WebGL</strong><p>The concept sheets and assembly instructions below are still available.</p></div>}
        </div>
        <div className="catio-options">
          <label><input type="checkbox" checked={windowOpen} onChange={event => setWindowOpen(event.target.checked)} disabled={unsupported} /> Window open</label>
          <label><input type="checkbox" checked={cutaway} onChange={event => setCutaway(event.target.checked)} disabled={unsupported} /> Wall cutaway</label>
          <label><input type="checkbox" checked={exploded} onChange={event => setExploded(event.target.checked)} disabled={unsupported} /> Exploded view</label>
          <span>Drag to orbit · Scroll to zoom</span>
        </div>
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
    <section id="catio-sheets" className="catio-sheets" aria-label="Catio concept images"><div className="catio-section-heading"><div><span className="eyebrow">ONE DESIGN, SIX STUDIES</span><h2>Look a little closer.</h2></div><p>Design references for the next step: a detailed, parametric model.</p></div>
      <div className="catio-gallery">{sheets.map(([file, title, caption], sheetIndex) => {
        const url = assets[`../../../docs/concepts/catio/${file}.png`];
        return <figure key={file}>{url && <a href={url} target="_blank" rel="noreferrer" aria-label={`Open ${title} concept sheet`}><img src={url} alt={`${title}. ${caption}`} loading="lazy" /></a>}
          <figcaption><span className="eyebrow">STUDY {String(sheetIndex + 1).padStart(2, '0')}</span><h3>{title}</h3><p>{caption}</p>{url && <a href={url} download={`${file}.png`}>Download PNG <ArrowDownToLine size={13} /></a>}</figcaption></figure>;
      })}</div>
    </section>
    <section className="catio-instructions" aria-label="Assembly instructions"><span className="eyebrow">THE ASSEMBLY</span><h2>From the room to the lawn.</h2><ol>{CATIO_STEPS.slice(1).map(stepInfo => <li key={stepInfo.title}><strong>{stepInfo.title}</strong><p>{stepInfo.detail}</p></li>)}</ol></section>
  </>;
}
