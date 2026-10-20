import { useEffect, useState, type ReactNode } from 'react';
import { Redo2, Undo2 } from 'lucide-react';
import { canRedo, canUndo, inRange, settingHome, type CatioSubassembly, type NumberRange, type SubassemblyControl } from '@canfactory/catio';
import { usePlannerHistory, usePlannerStore } from './catioPlannerStore.ts';

/**
 * A sub-assembly's settings as fields (#117): a choice of its options, or a free number in its display unit, grouped as its controls
 * are. The one way they are edited, in the planner's inspector and on a sub-assembly's view; `change` makes the edit (a command on
 * the project) and returns its errors. `compact` gives each field's help as its tooltip, for the inspector's narrow column.
 */
export function ControlFields<C extends object>({ controls, config, change, compact = false, note }: {
  controls: SubassemblyControl<C>[]; config: C; change: (key: keyof C & string, value: C[keyof C]) => string[]; compact?: boolean;
  /** What else to say under a control, e.g. that the whole catio shares it. */
  note?: (key: keyof C & string) => ReactNode;
}) {
  const shown = controls.filter(control => !control.when || control.when(config));
  const groups = [...new Set(shown.map(control => control.group))];
  return <>{groups.map(group => <fieldset key={group}><legend>{group}</legend>{shown.filter(control => control.group === group).map(control => {
    const current = config[control.key];
    const help = compact ? undefined : control.help;
    if (control.range) return <NumberField key={control.key} label={control.label} help={help} title={compact ? control.help : undefined} range={control.range}
      value={Number(current)} onCommit={value => change(control.key, value as C[keyof C])} note={note?.(control.key)} />;
    return <label className="catio-field subassembly-field" key={control.key} title={compact ? control.help : undefined}><span>{control.label}</span>
      <select aria-label={control.label} value={String(current)} onChange={event => {
        const option = control.options.find(candidate => String(candidate.value) === event.target.value);
        if (option) change(control.key, option.value);
      }}>{control.options.map(option => <option key={String(option.value)} value={String(option.value)}>{option.label}</option>)}</select>
      {help && <small>{help}</small>}{note?.(control.key)}</label>;
  })}</fieldset>)}</>;
}

/** A free number: typed in its display unit, kept while it is being typed, and committed once its range accepts it. */
function NumberField({ label, help, title, range, value, onCommit, note }: {
  label: string; help: string | undefined; title: string | undefined; range: NumberRange; value: number; onCommit: (value: number) => string[]; note?: ReactNode;
}) {
  const scale = range.scale ?? 1;
  const shown = (stored: number) => String(Number((stored / scale).toFixed(3)));
  const [text, setText] = useState(() => shown(value));
  useEffect(() => { setText(shown(value)); }, [value, scale]);
  /** The stored value a typed text stands for, or null when its range does not accept it. */
  const parse = (typed: string) => {
    const stored = Math.round(Number(typed) * scale * 1e6) / 1e6;
    return typed.trim() !== '' && inRange(range, stored) ? stored : null;
  };
  return <label className="catio-field subassembly-field" title={title}><span>{label} <em className="subassembly-unit">{range.unit}</em></span>
    <input type="number" aria-label={label} aria-invalid={parse(text) === null} min={range.min / scale} max={range.max / scale} step={range.step / scale} value={text}
      onChange={event => {
        setText(event.target.value);
        const next = parse(event.target.value); if (next !== null && next !== value) onCommit(next);
      }}
      onBlur={() => setText(shown(value))} />
    <small>{help ? `${help} ` : ''}{`${shown(range.min)}–${shown(range.max)} ${range.unit}.`}</small>{note}</label>;
}

/** Under a setting that more than its instance shares: what else it changes. */
export function SharedNote({ id, setting }: { id: CatioSubassembly; setting: string }) {
  const home = settingHome(id, setting);
  const text = home === 'mesh' ? 'The whole catio’s: the window insert and every tunnel.'
    : setting === 'supportFixing' || setting === 'supportBase' ? 'Every tunnel’s supports: the tunnel and its couplings show the same.'
    : home === 'tunnelCoupling' ? 'Every coupling of the project’s tunnels: the tunnel follows.' : null;
  return text ? <small className="subassembly-affects">{text}</small> : null;
}

/** Undo and redo of the project's history: the planner's and every sub-assembly view's, one history. */
export function HistoryButtons() {
  const store = usePlannerStore();
  const history = usePlannerHistory();
  return <div className="planner-history" role="group" aria-label="Undo and redo">
    <button type="button" onClick={store.undo} disabled={!canUndo(history)} title="Undo (Ctrl+Z)"><Undo2 size={15} aria-hidden="true" /> Undo</button>
    <button type="button" onClick={store.redo} disabled={!canRedo(history)} title="Redo (Ctrl+Shift+Z)"><Redo2 size={15} aria-hidden="true" /> Redo</button>
  </div>;
}
