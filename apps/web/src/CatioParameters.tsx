import { validateModular, type ModularConfig, type EnclosureSize } from './catioModularDesign.ts';

export function CatioParameters({ draft, change, reset }: { draft: ModularConfig; change: (next: ModularConfig) => void; reset: () => void }) {
  const errors = validateModular(draft);
  const number = (label: string, value: number, update: (value: number) => void, min: number, max: number, unit = 'cm') => <label className="catio-field" key={label}><span>{label} <small>{unit}</small></span><input type="number" aria-label={label} value={Number.isFinite(value) ? value : ''} min={min} max={max} step="1" onChange={event => update(event.target.value === '' ? NaN : Number(event.target.value))} /></label>;
  const dimension = (label: string, key: 'glassWidth' | 'glassHeight' | 'sashWidth' | 'sashHeight' | 'tunnelWidth' | 'tunnelHeight', min: number, max: number) => number(label, draft[key] / 10, n => change({ ...draft, [key]: n * 10 }), min, max);
  const enclosure = (key: 'enclosure' | 'second', label: string) => <fieldset><legend>{label}</legend>{(['width', 'depth', 'height'] as (keyof EnclosureSize)[]).map(k => number(`${label} ${k}`, draft[key][k] / 10, n => change({ ...draft, [key]: { ...draft[key], [k]: n * 10 } }), k === 'height' ? 90 : 80, k === 'height' ? 220 : 240))}</fieldset>;
  const modules = (label: string, key: 'approach' | 'lateral' | 'final' | 'link') => number(label, draft[key], n => change({ ...draft, [key]: n }), 1, 6, '× 50 cm');
  return <div className="catio-parameters" aria-label="Modular dimensions">
    <p>Adjust dimensions in centimetres. Each straight tunnel section is 50 cm long.</p>
    <fieldset><legend>Window</legend>{dimension('Glass width', 'glassWidth', 40, 140)}{dimension('Glass height', 'glassHeight', 40, 140)}{dimension('Sash width', 'sashWidth', 50, 160)}{dimension('Sash height', 'sashHeight', 50, 160)}</fieldset>
    {enclosure('enclosure', 'Enclosure A')}
    <fieldset><legend>Tunnel</legend>{dimension('Tunnel clear width', 'tunnelWidth', 20, 45)}{dimension('Tunnel clear height', 'tunnelHeight', 20, 45)}
      <label className="catio-field"><span>Route</span><select aria-label="Tunnel route" value={draft.route} onChange={event => change({ ...draft, route: event.target.value as ModularConfig['route'] })}><option value="straight">Straight</option><option value="left">Left offset</option><option value="right">Right offset</option></select></label>
      {modules('Approach modules', 'approach')}{draft.route !== 'straight' && <>{modules('Lateral modules', 'lateral')}{modules('Final modules', 'final')}</>}
      <p>{draft.route === 'straight' ? 'A straight run from window to enclosure A.' : 'A dogleg with two 90° corners; left/right as seen from inside looking out.'}</p>
    </fieldset>
    <label className="catio-second"><input type="checkbox" checked={draft.secondEnabled} onChange={event => change({ ...draft, secondEnabled: event.target.checked })} /> Add second enclosure</label>
    {draft.secondEnabled && <>{enclosure('second', 'Enclosure B')}{modules('Link modules', 'link')}<p>B sits to the right of A. A separate tunnel joins their side ports; rear edges and landings align.</p></>}
    {errors.length > 0 && <div role="alert" className="catio-errors"><strong>Showing the last valid design.</strong><ul>{errors.map(error => <li key={error}>{error}</li>)}</ul></div>}
    <button type="button" className="catio-reset" onClick={reset}>Reset modular dimensions</button>
  </div>;
}
