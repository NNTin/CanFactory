import { DOOR_SEAT_LABELS, DOOR_SEAT_SETTING, DOOR_SEATS, modularPitch, PORT_CLOSURE_LABELS, PORT_CLOSURE_SETTING, PORT_CLOSURES, validateModular, type DoorSeat, type EnclosureSize, type ModularConfig, type PortClosure } from '@canfactory/catio';

export function CatioParameters({ draft, change, reset }: { draft: ModularConfig; change: (next: ModularConfig) => void; reset: () => void }) {
  const errors = validateModular(draft);
  const number = (label: string, value: number, update: (value: number) => void, min: number, max: number, unit = 'cm') => <label className="catio-field" key={label}><span>{label} <small>{unit}</small></span><input type="number" aria-label={label} value={Number.isFinite(value) ? value : ''} min={min} max={max} step="1" onChange={event => update(event.target.value === '' ? NaN : Number(event.target.value))} /></label>;
  const dimension = (label: string, key: 'glassWidth' | 'glassHeight' | 'sashWidth' | 'sashHeight', min: number, max: number) => number(label, draft[key] / 10, n => change({ ...draft, [key]: n * 10 }), min, max);
  const enclosure = (key: 'enclosure' | 'second', label: string) => <fieldset><legend>{label}</legend>{(['width', 'depth', 'height'] as (keyof EnclosureSize)[]).map(k => number(`${label} ${k}`, draft[key][k] / 10, n => change({ ...draft, [key]: { ...draft[key], [k]: n * 10 } }), k === 'height' ? 90 : 80, k === 'height' ? 220 : 240))}</fieldset>;
  const pitch = Math.round(modularPitch(draft) / 10 * 10) / 10;
  const modules = (label: string, key: 'approach' | 'lateral' | 'final' | 'link') => number(label, draft[key], n => change({ ...draft, [key]: n }), 1, 6, `× ${pitch} cm`);
  return <div className="catio-parameters" aria-label="Modular dimensions">
    <p>Adjust dimensions in centimetres. The tunnel is built of standard elements: each straight section is one pitch ({pitch} cm, a cube’s edge and a coupling’s gap), and each corner is a cube.</p>
    <fieldset><legend>Window</legend>{dimension('Glass width', 'glassWidth', 40, 140)}{dimension('Glass height', 'glassHeight', 40, 140)}{dimension('Sash width', 'sashWidth', 50, 160)}{dimension('Sash height', 'sashHeight', 50, 160)}</fieldset>
    {enclosure('enclosure', 'Enclosure A')}
    <fieldset><legend>Tunnel</legend>{number('Tunnel clear size', draft.tunnelSize / 10, n => change({ ...draft, tunnelSize: n * 10 }), 20, 45)}
      <p>The standard port is square: this is its clear opening both ways, at the window, at the enclosures and along the tunnel.</p>
      <label className="catio-field"><span>Route</span><select aria-label="Tunnel route" value={draft.route} onChange={event => change({ ...draft, route: event.target.value as ModularConfig['route'] })}><option value="straight">Straight</option><option value="left">Left offset</option><option value="right">Right offset</option></select></label>
      {modules('Approach modules', 'approach')}{draft.route !== 'straight' && <>{modules('Lateral modules', 'lateral')}{modules('Final modules', 'final')}</>}
      <p>{draft.route === 'straight' ? 'A straight run from window to enclosure A.' : 'A dogleg with two cube corners, each turning 90°; left/right as seen from inside looking out.'}</p>
    </fieldset>
    <fieldset><legend>Cat ports</legend>
      <label className="catio-field"><span>{PORT_CLOSURE_SETTING}</span><select aria-label={PORT_CLOSURE_SETTING} value={draft.portClosure} onChange={event => change({ ...draft, portClosure: event.target.value as PortClosure })}>{PORT_CLOSURES.map(option => <option key={option} value={option}>{PORT_CLOSURE_LABELS[option]}</option>)}</select></label>
      <label className="catio-field"><span>{DOOR_SEAT_SETTING}</span><select aria-label={DOOR_SEAT_SETTING} value={draft.doorSeat} onChange={event => change({ ...draft, doorSeat: event.target.value as DoorSeat })}>{DOOR_SEATS.map(option => <option key={option} value={option}>{DOOR_SEAT_LABELS[option]}</option>)}</select></label>
      <p>{draft.doorSeat === 'stops' ? 'Every door is set into its opening, about flush with the frame, against stop strips glued inside the opening: nothing to cut, but the strips narrow the opening a little.' : 'Every door is set into a rebate cut round its opening, about flush with the frame: the opening stays clear.'}</p>
      <p>{draft.portClosure === 'removable-panel'
        ? 'Every cat port, the window’s and the enclosures’, is shut by a panel kept in by turn buttons: turn each button clear and lift the panel out. Solid and sealed at the window, framed mesh at the enclosures.'
        : 'Every cat port is shut by a gate that slides up in tracks, so each port needs its own height again above it.'}</p>
    </fieldset>
    <label className="catio-second"><input type="checkbox" checked={draft.secondEnabled} onChange={event => change({ ...draft, secondEnabled: event.target.checked })} /> Add second enclosure</label>
    {draft.secondEnabled && <>{enclosure('second', 'Enclosure B')}{modules('Link modules', 'link')}<p>B sits to the right of A. A separate tunnel joins their side ports; rear edges and landings align.</p></>}
    {errors.length > 0 && <div role="alert" className="catio-errors"><strong>Showing the last valid design.</strong><ul>{errors.map(error => <li key={error}>{error}</li>)}</ul></div>}
    <button type="button" className="catio-reset" onClick={reset}>Reset modular dimensions</button>
  </div>;
}
