import { useMemo, useState } from 'react';
import { ArrowDownToLine, FileUp } from 'lucide-react';
import { validateWireGuideDesign, WIRE_GUIDE_LIMITS, wireGuideBoard, WireGuideSettingsSchema, wireGuideSummary, type Control, type ParameterValue, type WireGuideDesign, type WireGuideSettings } from '@canfactory/contracts';

const LEVEL_COLORS = ['#c46543', '#3f6fb5', '#637655', '#9a5bb0', '#b08a2e', '#2e8f8a'];
type NumberSetting = Exclude<keyof WireGuideSettings, 'registration'>;
const NUMBER_SETTINGS: { key: NumberSetting; label: string }[] = [
  { key: 'coverThickness', label: 'Plate thickness' }, { key: 'channelClearance', label: 'Channel clearance' },
  { key: 'funnelTopDiameter', label: 'Funnel opening' }, { key: 'funnelBottomDiameter', label: 'Funnel outlet' },
  { key: 'funnelStandoff', label: 'Standoff over the board' },
];
const settingRange = (key: NumberSetting) => {
  const property = WireGuideSettingsSchema.properties[key] as { minimum?: number; maximum?: number; description?: string };
  return { minimum: property.minimum ?? 0, maximum: property.maximum ?? 10, description: property.description ?? '' };
};

/** The board seen from the component side (+Y up), with each wire's route coloured by its level. Drawn from validated numbers only. */
function BoardMap({ design }: { design: WireGuideDesign }) {
  const board = wireGuideBoard(design);
  if (!board) return null;
  const { L, W } = board.outline;
  const point = ([column, row]: readonly [number, number]) => board.point(column, row);
  return <svg className="wire-guide-map" viewBox={`-1 -1 ${L + 2} ${W + 2}`} role="img" aria-label={`The wires on the board: ${design.wires.length} routes`}>
    <g transform={`translate(0 ${W}) scale(1 -1)`}>
      <rect x={0} y={0} width={L} height={W} rx={board.outline.r} fill="#e6eadc" stroke="#9aa38a" strokeWidth={0.4} />
      {board.holes.map(hole => <circle key={`${hole.column},${hole.row}`} cx={hole.x} cy={hole.y} r={0.35} fill="#b9bfaa" />)}
      {board.mountingHoles.map((hole, index) => <circle key={`m${index}`} cx={hole.x} cy={hole.y} r={hole.d / 2} fill="none" stroke="#9aa38a" strokeWidth={0.4} />)}
      {(design.components ?? []).map(component => component.body).concat(design.keepouts ?? []).map((keepout, index) => keepout.kind === 'box'
        ? <rect key={`k${index}`} x={keepout.x} y={keepout.y} width={keepout.w} height={keepout.h} fill="#5c5f55" opacity={0.35} />
        : <circle key={`k${index}`} cx={keepout.cx} cy={keepout.cy} r={keepout.d / 2} fill="#5c5f55" opacity={0.35} />)}
      {design.wires.map((wire, index) => {
        const points = [wire.from, ...wire.path, wire.to].map(point);
        const color = LEVEL_COLORS[wire.level % LEVEL_COLORS.length];
        return <g key={index}>
          <polyline points={points.map(p => `${p.x},${p.y}`).join(' ')} fill="none" stroke={color} strokeWidth={1.2} strokeLinejoin="round" strokeLinecap="round" />
          {[points[0], points.at(-1)].map((p, end) => p && <circle key={end} cx={p.x} cy={p.y} r={0.9} fill={color} />)}
        </g>;
      })}
    </g>
  </svg>;
}

/**
 * A `document` control for a wire-guide design: the design's summary and map, the guide's settings, and “Import design (.json)”, so
 * that the model works without the assistant. A file is read here, in the browser, and checked with the same function as the API and
 * the worker (`validateWireGuideDesign`); only a valid design replaces the current one, an invalid one is listed with its issues.
 */
export function WireGuideField({ control, value, disabled, change }: { control: Control; value: ParameterValue | undefined; disabled: boolean; change: (value: ParameterValue) => void }) {
  const id = `parameter-${control.key}`;
  const design = typeof value === 'object' ? value as WireGuideDesign : undefined;
  const issues = useMemo(() => design ? validateWireGuideDesign(design) : [{ path: '', message: 'No design.' }], [design]);
  const summary = useMemo(() => design && issues.length === 0 ? wireGuideSummary(design) : undefined, [design, issues]);
  const [rejected, setRejected] = useState<{ name: string; issues: { path: string; message: string }[] } | null>(null);
  const [loaded, setLoaded] = useState<string | null>(null);

  const load = async (file: File | undefined) => {
    if (!file) return;
    setRejected(null);
    if (file.size > WIRE_GUIDE_LIMITS.bytes) { setRejected({ name: file.name, issues: [{ path: '', message: `This file is larger than ${WIRE_GUIDE_LIMITS.bytes / 1000} kB.` }] }); return; }
    let parsed: unknown;
    try { parsed = JSON.parse(await file.text()); } catch { setRejected({ name: file.name, issues: [{ path: '', message: 'This file is not JSON.' }] }); return; }
    const found = validateWireGuideDesign(parsed);
    if (found.length) { setRejected({ name: file.name, issues: found }); return; }
    change(parsed as WireGuideDesign);
    setLoaded(file.name);
  };
  const download = () => {
    if (!design) return;
    const url = URL.createObjectURL(new Blob([JSON.stringify(design, null, 2) + '\n'], { type: 'application/json' }));
    const link = document.createElement('a'); link.href = url; link.download = `${design.boardPartId}-wire-guide.json`;
    link.click(); setTimeout(() => URL.revokeObjectURL(url), 10_000);
  };
  const setGuide = (patch: Partial<WireGuideSettings>) => { if (design) change({ ...design, guide: { ...design.guide, ...patch } }); };
  const issueAt = (path: string) => issues.find(issue => issue.path === path)?.message;

  return <div className={`select-field wire-guide-field ${disabled ? 'field-disabled' : ''}`}>
    <div className="field-heading"><label htmlFor={id}>{control.label}</label>{summary && <span className="text-count">{summary.wires} wire{summary.wires === 1 ? '' : 's'} · {summary.prints.length} print{summary.prints.length === 1 ? '' : 's'}</span>}</div>
    {design && <BoardMap design={design} />}
    {summary && <dl className="wire-guide-summary" data-testid="wire-guide-summary">
      <dt>Board</dt><dd>{summary.board}</dd>
      <dt>Wire</dt><dd>{summary.wire}</dd>
      <dt>Wires</dt><dd>{summary.wires} on {summary.levels} level{summary.levels === 1 ? '' : 's'}</dd>
      <dt>Prints</dt><dd>{summary.prints.map(print => `${print.id} (${print.wires} wire${print.wires === 1 ? '' : 's'})`).join(', ')}</dd>
    </dl>}
    <div className="logo-actions wire-guide-actions">
      <label className="logo-choose">
        <input id={id} type="file" accept=".json,application/json" disabled={disabled} aria-describedby={`${id}-description`}
          onChange={event => { const file = event.currentTarget.files?.[0]; event.currentTarget.value = ''; void load(file); }} />
        <FileUp size={13} aria-hidden="true" /> Import design (.json)
      </label>
      {design && <button type="button" className="text-button" onClick={download} disabled={disabled}><ArrowDownToLine size={12} /> Download design</button>}
      {loaded && <span className="logo-name" title={loaded}>{loaded}</span>}
    </div>
    <p id={`${id}-description`}>{control.description}</p>
    {rejected && <div className="field-error wire-guide-rejected" role="alert">
      <strong>{rejected.name} was not imported:</strong>
      <ul>{rejected.issues.slice(0, 12).map(issue => <li key={`${issue.path}:${issue.message}`}><code>{issue.path || '/'}</code> {issue.message}</li>)}</ul>
      {rejected.issues.length > 12 && <span>and {rejected.issues.length - 12} more.</span>}
    </div>}
    {design && <div className="wire-guide-settings">
      <div className="select-field">
        <label htmlFor={`${id}-registration`}>Registration</label>
        <select id={`${id}-registration`} value={design.guide.registration} disabled={disabled} onChange={event => setGuide({ registration: event.currentTarget.value as WireGuideSettings['registration'] })}>
          <option value="mounting-holes">Bosses in the mounting holes</option>
          <option value="edge-clips">Clips on the board’s edges</option>
        </select>
        {issueAt('/guide/registration') && <p className="field-error">{issueAt('/guide/registration')}</p>}
      </div>
      {NUMBER_SETTINGS.map(({ key, label }) => {
        const range = settingRange(key);
        const issue = issueAt(`/guide/${key}`);
        return <div className="select-field" key={key}>
          <div className="field-heading"><label htmlFor={`${id}-${key}`} title={range.description}>{label}</label><span className="text-count">{range.minimum}–{range.maximum} mm</span></div>
          <input id={`${id}-${key}`} type="number" value={Number.isFinite(design.guide[key]) ? design.guide[key] : ''} min={range.minimum} max={range.maximum} step={0.1} disabled={disabled}
            aria-invalid={Boolean(issue)} onChange={event => setGuide({ [key]: event.currentTarget.value === '' ? Number.NaN : Number(event.currentTarget.value) })} />
          {issue && <p className="field-error">{issue}</p>}
        </div>;
      })}
    </div>}
    {design && issues.length > 0 && <ul className="field-error wire-guide-issues">{issues.slice(0, 8).map(issue => <li key={`${issue.path}:${issue.message}`}><code>{issue.path || '/'}</code> {issue.message}</li>)}</ul>}
  </div>;
}
