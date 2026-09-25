import { useEffect, useMemo, useState, type ReactElement } from 'react';
import { ArrowDownToLine, ArrowLeft, ArrowRight, Box, Check, ChevronDown, CircleAlert, Layers3, LoaderCircle, RotateCcw, SlidersHorizontal, Sparkles } from 'lucide-react';
import { api } from '@canfactory/client';
import { findModel, validateParameters, type Control, type ModelDetail, type ParameterValues } from '@canfactory/contracts';
import { Viewer } from './Viewer.tsx';
import { useRender } from './useRender.ts';

type ModelCard = Pick<ModelDetail, 'id' | 'version' | 'title' | 'description' | 'attribution' | 'license' | 'licenseUrl' | 'artifactFormat' | 'customizable'>;
const settingsKey = (model: ModelDetail) => `canfactory:settings:${model.id}:${model.version}`;

function restoreSettings(model: ModelDetail): ParameterValues {
  try {
    const stored = localStorage.getItem(settingsKey(model));
    const definition = findModel(model.id);
    if (stored && definition) {
      const values: unknown = JSON.parse(stored);
      if (values !== null && typeof values === 'object' && validateParameters(definition, values).length === 0) {
        const entries = Object.entries(values).filter((entry): entry is [string, number | boolean] => typeof entry[1] === 'number' || typeof entry[1] === 'boolean');
        return Object.fromEntries(entries);
      }
    }
  } catch { /* Storage can be unavailable; defaults remain fully usable. */ }
  return { ...model.defaults };
}

function FunnelIllustration() {
  return <svg viewBox="0 0 240 190" aria-hidden="true" className="funnel-illustration">
    <ellipse cx="120" cy="152" rx="90" ry="16" fill="#c8cec1" opacity=".35" />
    <path d="M28 143 120 30l92 113-18 8H46z" fill="#d98460" />
    <path d="M120 30 212 143l-18 8-67-15z" fill="#c46543" />
    <ellipse cx="120" cy="143" rx="92" ry="20" fill="#e8ab87" />
    <path d="m53 138 62-101q5-9 10 0l62 101q-67 22-134 0" fill="#d27750" />
    <ellipse cx="120" cy="37" rx="5" ry="3" fill="#753e2d" />
    {[0, 1, 2, 3, 4, 5].map(row => <path key={row} d={`M${101 - row * 8} ${66 + row * 12} Q120 ${74 + row * 12} ${139 + row * 8} ${66 + row * 12}`} fill="none" stroke="#8b513a" strokeWidth="2" strokeDasharray="1 6" opacity=".6" />)}
  </svg>;
}

const LATTICE_STRUTS = [-3, -2, -1, 0, 1, 2, 3].map(n => n * 20);

function MossPlanterIllustration() {
  return <svg viewBox="0 0 240 190" aria-hidden="true" className="moss-planter-illustration">
    <defs><clipPath id="moss-planter-tube"><rect x="92" y="52" width="56" height="88" /></clipPath></defs>
    <ellipse cx="120" cy="152" rx="90" ry="16" fill="#c8cec1" opacity=".35" />
    <path d="M104 150 120 184l16-34z" fill="#8b513a" opacity=".55" />
    <rect x="92" y="52" width="56" height="88" fill="#8fa27c" opacity=".35" />
    <g clipPath="url(#moss-planter-tube)" stroke="#5f7350" strokeWidth="3.5" strokeLinecap="round" fill="none">
      {LATTICE_STRUTS.map(x => <path key={`a${x}`} d={`M${120 + x - 44} 52 L${120 + x + 44} 140`} />)}
      {LATTICE_STRUTS.map(x => <path key={`b${x}`} d={`M${120 + x + 44} 52 L${120 + x - 44} 140`} />)}
    </g>
    <path d="M148 52v88h-9q9-44 0-88z" fill="#3f4f34" opacity=".2" />
    <rect x="88" y="138" width="64" height="8" rx="3" fill="#7b8e6b" />
    <rect x="88" y="46" width="64" height="8" rx="3" fill="#7b8e6b" />
    <path d="M92 46q0-24 28-24t28 24z" fill="#d98460" />
    <path d="M120 22q28 0 28 24h-14q0-18-14-24z" fill="#c46543" />
    <path d="M30 148q90 24 180 0v6q-90 24-180 0z" fill="#8b513a" opacity=".35" />
  </svg>;
}

const ILLUSTRATIONS: Record<string, () => ReactElement> = {
  'fruit-fly-trap': FunnelIllustration,
  'moss-planter': MossPlanterIllustration,
};

function Field({ control, value, disabled, issue, change }: { control: Control; value: number | boolean | undefined; disabled: boolean; issue: string | undefined; change: (value: number | boolean) => void }) {
  const id = `parameter-${control.key}`;
  if (control.kind === 'boolean') return <div className="toggle-field">
    <div><label htmlFor={id}>{control.label}</label><p>{control.description}</p></div>
    <button id={id} type="button" className="switch" role="switch" aria-checked={value === true} onClick={() => change(value !== true)} disabled={disabled}><span /></button>
  </div>;
  const number = typeof value === 'number' && Number.isFinite(value) ? value : '';
  return <div className={`number-field ${disabled ? 'field-disabled' : ''}`}>
    <div className="field-heading"><label htmlFor={id} title={control.description}>{control.label}</label><span className="number-input-wrap">
      <input id={id} type="number" value={number} min={control.minimum ?? undefined} max={control.maximum ?? undefined} step={control.step ?? 0.1}
        disabled={disabled} aria-invalid={Boolean(issue)} aria-describedby={`${id}-description${issue ? ` ${id}-error` : ''}`}
        onChange={event => change(event.currentTarget.value === '' ? Number.NaN : Number(event.currentTarget.value))} />{control.unit && <span>{control.unit}</span>}
    </span></div>
    <input className="range-input" type="range" aria-label={`${control.label} slider`} value={number === '' ? control.minimum ?? 0 : number}
      min={control.minimum ?? undefined} max={control.maximum ?? undefined} step={control.step ?? 0.1} disabled={disabled} onChange={event => change(Number(event.currentTarget.value))} />
    <div className="range-limits"><span>{control.minimum}{control.unit ? ` ${control.unit}` : ''}</span><span>{control.maximum}{control.unit ? ` ${control.unit}` : ''}</span></div>
    <span id={`${id}-description`} className="sr-only">{control.description}</span>
    {issue && <p className="field-error" id={`${id}-error`}>{issue}</p>}
  </div>;
}

function Editor({ model }: { model: ModelDetail }) {
  const [parameters, setParameters] = useState<ParameterValues>(() => restoreSettings(model));
  const [advanced, setAdvanced] = useState(false);
  const [loadedUrl, setLoadedUrl] = useState<string | null>(null);
  const [viewerError, setViewerError] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const definition = findModel(model.id);
  const issues = useMemo(() => definition ? validateParameters(definition, parameters) : [{ field: '', message: 'Reload the page to use this model’s current editor.' }], [definition, parameters]);
  const valid = issues.length === 0;
  const rendering = useRender(model, parameters, valid);
  const render = rendering.completed?.render;
  const artifact = render?.artifact;
  const url = artifact?.url ?? null;
  const ready = rendering.ready && loadedUrl === url && !viewerError;
  const error = rendering.error ?? viewerError ?? downloadError;
  const derived = definition?.derived(parameters);

  useEffect(() => {
    if (!valid) return;
    try { localStorage.setItem(settingsKey(model), JSON.stringify(parameters)); } catch { /* Optional local preference storage. */ }
  }, [parameters, model, valid]);
  useEffect(() => { setViewerError(null); setDownloadError(null); }, [url]);

  const change = (key: string, value: number | boolean) => {
    setParameters(current => {
      const next = { ...current, [key]: value };
      if (value === false && definition) {
        const invalid = validateParameters(definition, next);
        for (const control of model.controls) {
          if (control.enabledWhen === key && invalid.some(issue => issue.field === control.key)) next[control.key] = control.default;
        }
      }
      return next;
    });
    setDownloadError(null); setViewerError(null);
  };
  const reset = () => { setParameters({ ...model.defaults }); setViewerError(null); setDownloadError(null); };
  const retry = () => { setViewerError(null); setDownloadError(null); rendering.retry(); };
  const download = async () => {
    if (!render || !ready) return;
    setDownloading(true); setDownloadError(null);
    try {
      const response = model.artifactFormat === 'zip'
        ? await api.GET('/api/v1/renders/{id}/zip', { params: { path: { id: render.id }, query: { download: 'true' } }, parseAs: 'blob' })
        : await api.GET('/api/v1/renders/{id}/stl', { params: { path: { id: render.id }, query: { download: 'true' } }, parseAs: 'blob' });
      if (response.error) {
        if (response.response.status === 410) rendering.retry();
        throw new Error(response.error.message);
      }
      const blobUrl = URL.createObjectURL(response.data);
      const link = document.createElement('a'); link.href = blobUrl; link.download = `${model.id}-${render.id.slice(0, 8)}.${model.artifactFormat}`;
      link.click(); setTimeout(() => URL.revokeObjectURL(blobUrl), 10_000);
    } catch (caught) { setDownloadError(caught instanceof Error ? caught.message : 'Download failed. Please try again.'); }
    finally { setDownloading(false); }
  };
  const status = error ? 'Needs attention' : !valid ? 'Check settings' : ready ? 'Ready to print' : rendering.phase === 'queued' ? 'Waiting for renderer' : rendering.phase === 'running' ? 'Rendering your model' : rendering.ready ? 'Loading preview' : 'Updating preview';
  const field = (control: Control) => <Field key={control.key} control={control} value={parameters[control.key]}
    disabled={control.enabledWhen !== null && parameters[control.enabledWhen] !== true}
    issue={issues.find(issue => issue.field === control.key)?.message} change={value => change(control.key, value)} />;

  return <>
    <div className="editor-layout">
      <aside className="settings-panel">
        {model.customizable ? <>
          <div className="panel-heading"><div><SlidersHorizontal size={16} /><h2>Make it yours</h2></div><button className="text-button" type="button" onClick={reset}><RotateCcw size={13} /> Reset</button></div>
          <p className="panel-intro">A few adjustments. A perfect fit.</p>
          <div className="basic-controls">{model.controls.filter(control => control.group === 'basic').map(field)}</div>
          {derived?.slotCount !== undefined && derived.slotCount !== null && <div className="slot-note"><Sparkles size={14} /><span>{derived.slotCount === 0 ? 'One opening. A smooth funnel.' : `${derived.slotCount.toLocaleString()} slots, automatically spaced.`}</span></div>}
          <button className="advanced-button" type="button" aria-expanded={advanced} aria-controls="advanced-controls" onClick={() => setAdvanced(value => !value)}>
            Advanced settings <ChevronDown size={16} className={advanced ? 'rotated' : ''} />
          </button>
          {advanced && <div id="advanced-controls" className="advanced-controls">{model.controls.filter(control => control.group === 'advanced').map(field)}</div>}
          <p className="local-note">Your settings stay in this browser.</p>
        </> : <>
          <div className="panel-heading"><div><SlidersHorizontal size={16} /><h2>About this model</h2></div></div>
          <p className="panel-intro">This model doesn’t have adjustable settings yet. {model.parts && model.parts.length > 0 ? `All ${model.parts.length} parts render together, exactly as designed.` : 'It renders exactly as designed.'}</p>
        </>}
      </aside>
      <section className="preview-panel" aria-label="Model preview and download">
        <div className="preview-heading"><span className="eyebrow"><Box size={15} /> LIVE PREVIEW</span><span className={`status ${ready && !error ? 'status-ready' : ''}`} role="status">
          {ready && !error ? <Check size={13} /> : error || !valid ? <CircleAlert size={13} /> : <LoaderCircle size={13} className="spin" />}{status}
        </span></div>
        <Viewer url={url} format={model.artifactFormat} onError={setViewerError} onLoaded={setLoadedUrl} />
        {!ready && url && !error && <div className="previous-preview">Showing the previous preview while your changes are prepared.</div>}
        {(error || (!valid && issues.length > 0)) && <div className="error-banner" role="alert"><CircleAlert size={17} /><span>{error ?? issues[0]?.message}</span>{error && <button type="button" onClick={retry}>Try again</button>}</div>}
        <div className="model-stats">
          {artifact?.parts ? <div><span>PARTS</span><strong>{artifact.parts.length} <small>· {(artifact.volume / 1000).toFixed(1)} cm³ total</small></strong></div>
            : <div><span>PRINT DIMENSIONS</span><strong>{artifact?.dimensions ? `${artifact.dimensions.x.toFixed(1)} × ${artifact.dimensions.y.toFixed(1)} × ${artifact.dimensions.z.toFixed(1)}` : '—'} <small>mm</small></strong></div>}
          <div><span>FILE FORMAT</span><strong>{model.artifactFormat.toUpperCase()} <small>{artifact ? `· ${(artifact.bytes / 1_000_000).toFixed(2)} MB` : '· binary'}</small></strong></div>
        </div>
        <div className="download-bar"><div><span className="download-icon"><Layers3 size={23} /></span><div><strong>From your screen to your workbench.</strong><p>Download your model and open it in your slicer.</p></div></div>
          <button className="download-button" type="button" disabled={!ready || downloading} onClick={() => { void download(); }}>
            {downloading ? <LoaderCircle size={17} className="spin" /> : <ArrowDownToLine size={17} />} {downloading ? 'Downloading…' : `Download ${model.artifactFormat.toUpperCase()}`}
          </button>
        </div>
      </section>
    </div>
    <div className="model-footer"><span>Designed by {model.attribution}. <a href={model.licenseUrl} target="_blank" rel="noreferrer">{model.license}</a></span><span>All dimensions in millimetres · {model.printNotes}</span></div>
  </>;
}

export function App() {
  const [models, setModels] = useState<ModelCard[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [model, setModel] = useState<ModelDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const openLibrary = () => { setSelectedId(null); setLoading(false); setError(null); };
  useEffect(() => {
    const abort = new AbortController();
    void api.GET('/api/v1/models', { signal: abort.signal }).then(response => {
      if (!response.data) throw new Error('The model catalogue is unavailable.');
      setModels(response.data); setSelectedId(response.data[0]?.id ?? null); setLoading(false);
    }).catch((caught: unknown) => { if (!abort.signal.aborted) { setError(caught instanceof Error ? caught.message : 'Cannot load models.'); setLoading(false); } });
    return () => abort.abort();
  }, []);
  useEffect(() => {
    setModel(null);
    if (!selectedId) return;
    const abort = new AbortController(); setLoading(true); setError(null);
    void api.GET('/api/v1/models/{id}', { params: { path: { id: selectedId } }, signal: abort.signal }).then(response => {
      if (!response.data) throw new Error(response.error.message);
      setModel(response.data); setLoading(false);
    }).catch((caught: unknown) => { if (!abort.signal.aborted) { setError(caught instanceof Error ? caught.message : 'Cannot load this model.'); setLoading(false); } });
    return () => abort.abort();
  }, [selectedId]);

  return <div className="app-shell">
    <header className="site-header"><button className="brand" type="button" aria-label="CanFactory model library" onClick={openLibrary}><span className="brand-mark"><Layers3 size={24} strokeWidth={1.7} /></span>CanFactory<span className="brand-dot">.</span></button>
      <span className="header-tagline">A little factory for useful things.</span><div className="header-right"><button type="button" className="library-link" onClick={openLibrary}>Model library <span>{models.length.toString().padStart(2, '0')}</span></button><span className="local-badge"><i /> Local workspace</span></div>
    </header>
    <main>
      <div className="breadcrumb"><button type="button" onClick={openLibrary}><ArrowLeft size={13} /> Model library</button>{model && <><span>/</span><span>{model.title}</span></>}</div>
      {error ? <div className="empty-state" role="alert"><CircleAlert size={30} /><h1>Let’s reconnect.</h1><p>{error}</p><button className="primary-button" type="button" onClick={() => window.location.reload()}>Reload catalogue</button></div>
        : loading ? <div className="empty-state"><LoaderCircle className="spin" size={30} /><p>Opening the workshop…</p></div>
          : model ? <><div className="page-heading"><div><div className="eyebrow">THE MODEL WORKSHOP</div><h1>{model.title}</h1><p>{model.description}</p></div><span className="model-tag"><span /> {model.customizable ? 'PARAMETRIC MODEL' : 'ASSEMBLY PREVIEW'}</span></div><Editor key={`${model.id}:${model.version}`} model={model} /></>
            : <><div className="page-heading library-heading"><div><div className="eyebrow">THE MODEL LIBRARY</div><h1>Useful things. Made to fit.</h1><p>Start with a model. Make a few changes. Make it yours.</p></div></div>
              <div className="model-library">{models.map(item => <button type="button" className="model-card" key={item.id} onClick={() => setSelectedId(item.id)}><div className="card-art">{(() => { const Illustration = ILLUSTRATIONS[item.id]; return Illustration ? <Illustration /> : <Box size={60} strokeWidth={1} />; })()}</div><div className="card-copy"><span className="eyebrow">{item.customizable ? 'CUSTOMIZABLE' : 'PREVIEW'} · {item.artifactFormat.toUpperCase()}</span><h2>{item.title}</h2><p>{item.description}</p><span className="card-action">{item.customizable ? 'Customize model' : 'View model'} <ArrowRight size={17} /></span></div></button>)}
                <div className="coming-next"><span className="plus-shape">+</span><h2>More useful things to come.</h2><p>A growing collection for everyday making.</p></div></div></>}
    </main>
    <footer className="site-footer"><span>MAKE IT FIT. MAKE IT REAL.</span><span>CanFactory · Your local workshop</span></footer>
  </div>;
}
