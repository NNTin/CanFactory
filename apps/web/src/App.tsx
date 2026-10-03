import { useCallback, useEffect, useMemo, useState, type CSSProperties, type ReactElement } from 'react';
import { ArrowDownToLine, ArrowLeft, ArrowRight, BookOpen, Box, Check, ChevronDown, CircleAlert, FileUp, Layers3, LoaderCircle, RotateCcw, SlidersHorizontal, Sparkles, X } from 'lucide-react';
import { api } from '@canfactory/client';
import { controlRange, controlShown, decodeLogo, findModel, findPartFamily, offeredOptions, parts, partOptionOffered, resolveAssembly, SVG_MAX_BYTES, SvgError, svgToLogo, validateParameters, type Control, type ModelDetail, type ParameterValues, type PartFamilySummary } from '@canfactory/contracts';
import { PartsLibrary } from './PartsLibrary.tsx';
import { referenceObjects } from './referenceObjects.ts';
import { formatHash, parseHash, partLink, type Route } from './route.ts';
import { Viewer } from './Viewer.tsx';
import { ToggleLatchIllustration } from './ToggleLatchIllustration.tsx';
import { useRender, type RenderProblem } from './useRender.ts';
import { CatioConcept } from './CatioConcept.tsx';
import { CatioSubassemblyRoute } from './CatioSubassemblyPage.tsx';
import { CATIO_SUBASSEMBLY_TITLES } from './catioSubassemblies.ts';
import catioThumbnail from '../../../docs/concepts/catio/01-overview.png';

type ModelCard = Pick<ModelDetail, 'id' | 'version' | 'title' | 'description' | 'attribution' | 'license' | 'licenseUrl' | 'artifactFormat' | 'customizable'>;
const settingsKey = (model: ModelDetail) => `canfactory:settings:${model.id}:${model.version}`;

function restoreSettings(model: ModelDetail): ParameterValues {
  try {
    const stored = localStorage.getItem(settingsKey(model));
    const definition = findModel(model.id);
    if (stored && definition) {
      const values: unknown = JSON.parse(stored);
      if (values !== null && typeof values === 'object' && validateParameters(definition, values).length === 0) {
        const entries = Object.entries(values).filter((entry): entry is [string, number | boolean | string] => ['number', 'boolean', 'string'].includes(typeof entry[1]));
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

const STEM_BOTTOM = 132;

function MossTower({ x, height, foot }: { x: number; height: number; foot: 'spike' | 'helper' }) {
  const top = STEM_BOTTOM - height;
  const clip = `moss-stem-${foot}`;
  const starts = Array.from({ length: Math.ceil((44 + height) / 15) + 1 }, (_, n) => -22 - height + n * 15);
  return <g transform={`translate(${x} 0)`}>
    <defs><clipPath id={clip}><rect x="-22" y={top} width="44" height={height} /></clipPath></defs>
    <g className="mp-guide" stroke="#7b8e6b" strokeWidth="1.5" strokeDasharray="3 4" fill="none">
      <path d={`M0 ${top - 20}V${top}`} /><path d={`M0 ${STEM_BOTTOM}v20`} />
    </g>
    <g className="mp-part mp-cap">
      <path d={`M-22 ${top}q0-22 22-22t22 22z`} fill="#d98460" />
      <path d={`M0 ${top - 22}q22 0 22 22h-11q0-16-11-22z`} fill="#c46543" />
      <rect x="-25" y={top - 7} width="50" height="8" rx="3" fill="#7b8e6b" />
    </g>
    <g className="mp-part mp-stem">
      <rect x="-22" y={top} width="44" height={height} fill="#8fa27c" opacity=".35" />
      <g clipPath={`url(#${clip})`} stroke="#5f7350" strokeWidth="3" strokeLinecap="round" fill="none">
        {starts.map(x0 => <path key={`a${x0}`} d={`M${x0} ${top}L${x0 + height} ${STEM_BOTTOM}`} />)}
        {starts.map(x0 => <path key={`b${x0}`} d={`M${x0 + height} ${top}L${x0} ${STEM_BOTTOM}`} />)}
      </g>
      <path d={`M22 ${top}v${height}h-7q7-${height / 2} 0-${height}z`} fill="#3f4f34" opacity=".2" />
      <rect x="-25" y={STEM_BOTTOM - 1} width="50" height="8" rx="3" fill="#7b8e6b" />
    </g>
    <g className="mp-part mp-foot">
      {foot === 'spike'
        ? <><path d={`M-14 ${STEM_BOTTOM + 7}h28L0 ${STEM_BOTTOM + 40}z`} fill="#8b513a" opacity=".7" /><path d={`M0 ${STEM_BOTTOM + 7}h14L0 ${STEM_BOTTOM + 40}z`} fill="#753e2d" opacity=".5" /></>
        : <><path d={`M-14 ${STEM_BOTTOM + 7}h28v10q12 4 12 16h-52q0-12 12-16z`} fill="#8b513a" opacity=".7" /><path d={`M0 ${STEM_BOTTOM + 7}h14v10q12 4 12 16H0z`} fill="#753e2d" opacity=".5" /></>}
    </g>
  </g>;
}

function MossPlanterIllustration() {
  return <svg viewBox="0 0 240 190" aria-hidden="true" className="moss-planter-illustration">
    <ellipse cx="120" cy="146" rx="108" ry="14" fill="#c8cec1" opacity=".35" />
    <MossTower x={68} height={44} foot="spike" />
    <MossTower x={172} height={80} foot="helper" />
  </svg>;
}

/**
 * The five-part cigarette case, drawn front-on: a large box and sliding lid (terracotta) with the small holder (in the box) and the
 * closed shallow box (in the lid) tucked inside. On card hover they come out in stages, then the shallow box and its lid part (`.cc-*` in styles.css).
 */
function CigaretteCaseIllustration() {
  return <svg viewBox="0 0 240 190" aria-hidden="true" className="cigarette-case-illustration">
    <defs>
      <pattern id="cc-honeycomb" width="12" height="14" patternUnits="userSpaceOnUse">
        <path d="M0 3.5 6 0l6 3.5v7L6 14l-6-3.5z" fill="none" stroke="#f4eee4" strokeWidth="1.2" opacity=".55" />
      </pattern>
    </defs>
    <g transform="translate(120 95) scale(.8) translate(-120 -95)">
      <ellipse className="cc-part cc-shadow" cx="120" cy="162" rx="76" ry="10" fill="#c8cec1" opacity=".35" />
      <path className="cc-guide" d="M120 45V88" stroke="#7b8e6b" strokeWidth="1.5" strokeDasharray="3 4" fill="none" />
      <g className="cc-part cc-box-carry">
        <g className="cc-part cc-holder-slide">
          <g transform="translate(0 18)">
            <path d="M99 93V70q0-9 10-9t10 9v23z" fill="#8fa27c" />
            <path d="M109 61q10 0 10 9v23h-6V70q0-6-4-9z" fill="#5f7350" opacity=".45" />
            <ellipse cx="109" cy="78" rx="3" ry="6" fill="#3f4f34" opacity=".45" />
          </g>
        </g>
        <rect x="93.5" y="78" width="53" height="73" rx="6" fill="#c46543" />
        <rect x="93.5" y="78" width="53" height="17" rx="3" fill="#a9563a" />
        <rect x="93.5" y="95" width="53" height="56" rx="6" fill="#d98460" />
        <rect x="93.5" y="95" width="53" height="56" rx="6" fill="url(#cc-honeycomb)" />
        <path d="M138 95h8.5v50q0 6-6 6h-2.5z" fill="#753e2d" opacity=".25" />
      </g>
      <g className="cc-part cc-lift">
        <g className="cc-part cc-mini-slide">
          <g className="cc-part cc-split-box">
            <rect x="110" y="79" width="33" height="14" rx="3" fill="#7b8e6b" />
            <rect x="110" y="79" width="33" height="4" rx="2" fill="#93a682" />
            <path d="M143 79v14h-7q2-7 0-14z" fill="#3f4f34" opacity=".3" />
          </g>
          <g className="cc-part cc-split-lid">
            <rect x="112" y="79" width="30" height="13" rx="3" fill="#93a682" />
            <rect x="116" y="83" width="4" height="5" rx="2" fill="#5f7350" opacity=".5" />
            <rect x="134" y="83" width="4" height="5" rx="2" fill="#5f7350" opacity=".5" />
          </g>
        </g>
        <rect x="93.5" y="55" width="53" height="40" rx="3" fill="#d98460" />
        <rect x="93.5" y="55" width="53" height="40" rx="3" fill="url(#cc-honeycomb)" />
        <rect x="93.5" y="55" width="53" height="5" rx="2.5" fill="#e8ab87" />
        <path d="M138 60h8.5v29q0 6-6 6h-2.5z" fill="#753e2d" opacity=".25" />
      </g>
    </g>
  </svg>;
}

/** One plank, drawn front-on with its top and end faces: the wide face towards the viewer, its thickness going back up-right. */
function Plank({ x, width }: { x: number; width: number }) {
  return <>
    <path d={`M${x} 71h${width}l7-5h-${width}z`} fill="#93a682" />
    <rect x={x} y="71" width={width} height="44" fill="#8fa27c" />
    <path d={`M${x + width} 71l7-5v44l-7 5z`} fill="#5f7350" />
    <path d={`M${x + 6} 85h${width - 14}M${x + 12} 101h${width - 26}`} stroke="#7b8e6b" strokeWidth="1.5" strokeLinecap="round" opacity=".6" />
  </>;
}

/**
 * The plank connector, drawn front-on: a terracotta sleeve with two planks (green) pushed into it from either side, and its screw
 * holes. On card hover the planks slide out of their pockets, showing the open pocket in the sleeve's end (`.pc-*` in styles.css).
 */
function PlankConnectorIllustration() {
  return <svg viewBox="0 0 240 190" aria-hidden="true" className="plank-connector-illustration">
    <ellipse cx="122" cy="140" rx="106" ry="11" fill="#c8cec1" opacity=".35" />
    <path className="pc-guide" d="M8 93H84M170 93H236" stroke="#7b8e6b" strokeWidth="1.5" strokeDasharray="3 4" fill="none" />
    <g className="pc-part pc-left"><Plank x={20} width={80} /></g>
    <path d="M88 66h64l14-10H102z" fill="#e8ab87" />
    <rect x="88" y="66" width="64" height="58" fill="#d98460" />
    <path d="M152 66l14-10v58l-14 10z" fill="#c46543" />
    <path d="M154 70l10-7v44l-10 7z" fill="#753e2d" opacity=".55" />
    {[102, 138].flatMap(cx => [81, 109].map(cy => <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="3.5" fill="#753e2d" opacity=".7" />))}
    <path d="M120 69v52" stroke="#c46543" strokeWidth="1.5" strokeDasharray="2 3" opacity=".7" />
    <g className="pc-part pc-right"><Plank x={155} width={67} /></g>
  </svg>;
}

/**
 * The litter shovel, drawn from behind the scoop so the sieve faces the viewer, stacked as it goes together: the terracotta
 * container with its lip and its jug handle behind it, the scoop (sand) whose cap sits on the lip and whose arched, slotted back
 * wall rises from it, and the handle's ring (green) on the cap, its grip curving down along the container's handle. On card
 * hover the handle lifts off the scoop and the scoop off the container (`.ls-*` in styles.css).
 */
function LitterShovelIllustration() {
  const slots = [-2, -1, 0, 1, 2].flatMap(column => [67.5, 50.6, 33.8].map(y => ({ x: 120 + column * 7.1, y })));
  return <svg viewBox="0 0 240 190" aria-hidden="true" className="litter-shovel-illustration">
    <ellipse cx="120" cy="162" rx="62" ry="8" fill="#c8cec1" opacity=".35" />
    <path d="M93.5 160 90.5 88h59l-3 72z" fill="#d98460" />
    <path d="M100 150V98M140 150V98" stroke="#c46543" strokeWidth="1.5" opacity=".5" />
    <path d="M146 96h20a4 4 0 0 1 4 4v56h-24" fill="none" stroke="#c46543" strokeWidth="4" />
    <rect x="86.5" y="85" width="67" height="4" rx="1.5" fill="#c46543" />
    <g className="ls-part ls-scoop">
      <path d="M88.5 81V31H98A22 15 0 0 1 142 31H151.5V81z" fill="#e4cf9e" />
      <path d="M92 78V34H100.5A19.5 12 0 0 1 139.5 34H148V78" fill="none" stroke="#cdb57f" strokeWidth="1.5" />
      {slots.map(({ x, y }) => <rect key={`${x}-${y}`} x={x - 2} y={y - 7} width="4" height="14" rx="2" fill="#8a6d3b" opacity=".75" />)}
      <rect x="85" y="81" width="70" height="7" rx="1.5" fill="#cdb57f" />
    </g>
    <g className="ls-part ls-handle">
      <path d="M154 77h14a8 8 0 0 1 8 8v42" fill="none" stroke="#5f7350" strokeWidth="4" strokeLinecap="round" />
      <rect x="85" y="73" width="70" height="8" rx="2" fill="#8fa27c" />
      <path d="M85.5 77h69" stroke="#5f7350" strokeWidth="1.2" opacity=".6" />
    </g>
  </svg>;
}

function AiDuckIllustration() {
  return <svg viewBox="0 0 240 190" aria-hidden="true">
    <ellipse cx="124" cy="157" rx="84" ry="12" fill="#c8cec1" opacity=".35" />
    <path d="M45 124c0-30 31-42 66-35 44 10 72 1 88-20 11 51-9 86-66 90-49 3-88-5-88-35Z" fill="#f2cc43" />
    <ellipse cx="86" cy="72" rx="37" ry="40" fill="#ffda4a" />
    <path d="M120 114c21 3 40-1 57-13-2 29-19 41-43 34" fill="#dfb532" />
    {Array.from({ length: 12 }, (_, i) => <path key={i} d="M82 72v-24" transform={`rotate(${i * 30} 82 72)`} stroke="#d7774b" strokeWidth="7" strokeLinecap="round" />)}
  </svg>;
}

const ILLUSTRATIONS: Record<string, () => ReactElement> = {
  'ai-rubber-duck': AiDuckIllustration,
  'cigarette-case': CigaretteCaseIllustration,
  'fruit-fly-trap': FunnelIllustration,
  'moss-planter': MossPlanterIllustration,
  'plank-connector': PlankConnectorIllustration,
  'litter-shovel': LitterShovelIllustration,
  'toggle-latch': ToggleLatchIllustration,
};

/** The sub-range of a number control recommended for the current value of one other control (Control.recommended): `label` names
 * that control and `choice` its value. */
interface RecommendedRange { minimum: number; maximum: number; label: string; choice: string }
/** What the current values of all those controls recommend together: the range that suits all of them (empty when
 * minimum > maximum), and each control's own range. */
interface Recommendation { minimum: number; maximum: number; ranges: RecommendedRange[] }

function recommendation(control: Control, controls: readonly Control[], parameters: ParameterValues): Recommendation | undefined {
  const ranges = (control.recommended ?? []).flatMap(entry => {
    const value = parameters[entry.control];
    const range = entry.ranges.find(candidate => candidate.value === value);
    if (!range) return [];
    const other = controls.find(candidate => candidate.key === entry.control);
    return [{ minimum: range.minimum, maximum: range.maximum, label: other?.label ?? entry.control, choice: other?.options?.find(option => option.value === value)?.label ?? String(value) }];
  });
  if (ranges.length === 0) return undefined;
  return { minimum: Math.max(...ranges.map(range => range.minimum)), maximum: Math.min(...ranges.map(range => range.maximum)), ranges };
}

/** The band (Control.bands) a value is in: minimum included, maximum excluded, except for the last band. */
const bandOf = (control: Control, value: number) => control.bands?.find((band, index, bands) => value >= band.minimum && (value < band.maximum || (index === bands.length - 1 && value <= band.maximum)));

/**
 * An `svg` control: the user picks an SVG file, which is read here, in the browser, into a logo string (`svgToLogo`); only that
 * string is kept and sent. The file's own markup is never put into the page: the preview is drawn from the logo string, and
 * only after `decodeLogo` has accepted it, so it can contain nothing but numbers and M, L and Z.
 */
function LogoField({ control, value, disabled, issue, change }: { control: Control; value: string; disabled: boolean; issue: string | undefined; change: (value: string) => void }) {
  const id = `parameter-${control.key}`;
  const [loaded, setLoaded] = useState<{ name: string; warnings: string[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reading, setReading] = useState(false);
  const rings = useMemo(() => { try { return decodeLogo(value); } catch { return null; } }, [value]);
  const box = useMemo(() => {
    const points = rings?.flat() ?? [];
    if (points.length === 0) return null;
    const xs = points.map(p => p[0]), ys = points.map(p => p[1]);
    const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
    const pad = Math.max(x1 - x0, y1 - y0) * 0.04;
    // y points up in the logo, so the preview is flipped: its viewBox is the box of (x, -y).
    return `${x0 - pad} ${-y1 - pad} ${x1 - x0 + 2 * pad} ${y1 - y0 + 2 * pad}`;
  }, [rings]);
  const load = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    if (file.size > SVG_MAX_BYTES) { setError(`This file is larger than ${SVG_MAX_BYTES / 1_000_000} MB. Choose a smaller SVG file.`); return; }
    setReading(true);
    try {
      const logo = svgToLogo(await file.text());
      change(logo.logo);
      setLoaded({ name: file.name, warnings: logo.warnings });
    } catch (caught) {
      setError(caught instanceof SvgError ? caught.message : 'This file could not be read as an SVG file.');
    } finally { setReading(false); }
  };
  const remove = () => { change(''); setLoaded(null); setError(null); };
  const shown = error ?? issue;
  return <div className={`select-field logo-field ${disabled ? 'field-disabled' : ''}`}>
    <div className="field-heading"><label htmlFor={id}>{control.label}</label>{rings && rings.length > 0 && <span className="text-count">{rings.length} outline{rings.length === 1 ? '' : 's'}, {rings.reduce((sum, ring) => sum + ring.length, 0)} points</span>}</div>
    <div className="logo-picker">
      {box && rings
        ? <svg className="logo-preview" viewBox={box} role="img" aria-label={`${control.label} preview`}><path transform="scale(1 -1)" fillRule="evenodd" d={value} /></svg>
        : <div className="logo-preview logo-empty" aria-hidden="true"><FileUp size={20} /></div>}
      <div className="logo-actions">
        <label className="logo-choose">
          <input id={id} type="file" accept=".svg,image/svg+xml" disabled={disabled || reading} aria-invalid={Boolean(shown)} aria-describedby={`${id}-description${shown ? ` ${id}-error` : ''}`}
            onChange={event => { const file = event.currentTarget.files?.[0]; event.currentTarget.value = ''; void load(file); }} />
          {reading ? 'Reading…' : box ? 'Choose another SVG' : 'Choose an SVG file'}
        </label>
        {value !== '' && <button type="button" className="text-button" onClick={remove} disabled={disabled}><X size={12} /> Remove</button>}
        {loaded && value !== '' && <span className="logo-name" title={loaded.name}>{loaded.name}</span>}
      </div>
    </div>
    <p id={`${id}-description`}>{control.description}</p>
    {loaded && value !== '' && loaded.warnings.map(warning => <p key={warning} className="logo-warning">{warning}</p>)}
    {shown && <p className="field-error" id={`${id}-error`}>{shown}</p>}
  </div>;
}

function Field({ control, value, options, disabled, issue, recommended, change }: { control: Control; value: number | boolean | string | undefined; options: Control['options']; disabled: boolean; issue: string | undefined; recommended?: Recommendation | undefined; change: (value: number | boolean | string) => void }) {
  const id = `parameter-${control.key}`;
  if (control.kind === 'svg') return <LogoField control={control} value={typeof value === 'string' ? value : ''} disabled={disabled} issue={issue} change={change} />;
  if (control.kind === 'text') {
    const text = typeof value === 'string' ? value : '';
    return <div className={`select-field ${disabled ? 'field-disabled' : ''}`}>
      <div className="field-heading"><label htmlFor={id}>{control.label}</label>{control.maximum !== null && <span className="text-count">{text.length}/{control.maximum}</span>}</div>
      <input id={id} type="text" value={text} maxLength={control.maximum ?? undefined} disabled={disabled} autoComplete="off" spellCheck={false} placeholder="Nothing"
        aria-invalid={Boolean(issue)} aria-describedby={`${id}-description${issue ? ` ${id}-error` : ''}`} onChange={event => change(event.currentTarget.value)} />
      <p id={`${id}-description`}>{control.description}</p>
      {issue && <p className="field-error" id={`${id}-error`}>{issue}</p>}
    </div>;
  }
  if (control.kind === 'enum') {
    const selected = options?.find(option => option.value === value);
    // A part-linked control links its choice to the parts library, when the library has it (e.g. not a “none” option).
    const link = control.part;
    const inLibrary = link && selected && parts.some(part => part.family === link.family && (link.attribute ? part.attributes[link.attribute] === selected.value : part.id === selected.value));
    return <div className={`select-field ${disabled ? 'field-disabled' : ''}`}>
      <label htmlFor={id}>{control.label}</label>
      <select id={id} value={typeof value === 'string' ? value : ''} disabled={disabled} aria-invalid={Boolean(issue)} aria-describedby={`${id}-description`} onChange={event => change(event.currentTarget.value)}>
        {options?.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
      <p id={`${id}-description`}>{selected?.description ?? control.description}</p>
      {inLibrary && <a className="part-link" href={partLink(link, selected.value)}><BookOpen size={12} aria-hidden="true" /> {link.attribute ? `See the ${selected.value} ${findPartFamily(link.family)?.title.toLowerCase() ?? 'parts'} in the parts library` : 'See this part in the parts library'}</a>}
      {issue && <p className="field-error">{issue}</p>}
    </div>;
  }
  if (control.kind === 'boolean') return <div className="toggle-field">
    <div><label htmlFor={id}>{control.label}</label><p>{control.description}</p></div>
    <button id={id} type="button" className="switch" role="switch" aria-checked={value === true} onClick={() => change(value !== true)} disabled={disabled}><span /></button>
  </div>;
  const number = typeof value === 'number' && Number.isFinite(value) ? value : '';
  const band = number === '' ? undefined : bandOf(control, number);
  const span = control.minimum !== null && control.maximum !== null && control.maximum > control.minimum ? [control.minimum, control.maximum] as const : undefined;
  const fits = (range: { minimum: number; maximum: number }, n: number) => n >= range.minimum - 1e-9 && n <= range.maximum + 1e-9;
  // No single value suits every control's range: nothing is highlighted, and each range is listed.
  const conflict = recommended !== undefined && recommended.minimum > recommended.maximum + 1e-9;
  // The highlighted stretch of the track, as fractions of it (the thumb's centre moves between its half-widths, see styles.css).
  const highlight = recommended && !conflict && span ? [(recommended.minimum - span[0]) / (span[1] - span[0]), (recommended.maximum - span[0]) / (span[1] - span[0])] as const : undefined;
  const outside = recommended !== undefined && !conflict && number !== '' && !fits(recommended, number);
  const fixed = (n: number) => n.toFixed(2);
  // A range, or a single value when the ranges of several settings meet in one point.
  const rangeText = (range: { minimum: number; maximum: number }) => Math.abs(range.maximum - range.minimum) < 1e-9 ? fixed(range.minimum) : `${fixed(range.minimum)}–${fixed(range.maximum)}`;
  const unit = control.unit ? ` ${control.unit}` : '';
  // The controls whose range the value is outside of (all of them when they conflict), to say which setting asks for what.
  const misfits = recommended && number !== '' ? recommended.ranges.filter(range => conflict ? true : !fits(range, number)) : [];
  const forWhat = recommended?.ranges.length === 1 ? recommended.ranges[0]?.choice : 'these settings';
  // Advisory sliders (those with a recommended range) also mark their default, as a tick on the track and in the note.
  const defaultValue = control.recommended && typeof control.default === 'number' ? control.default : undefined;
  const defaultAt = defaultValue !== undefined && span ? (defaultValue - span[0]) / (span[1] - span[0]) : undefined;
  return <div className={`number-field ${disabled ? 'field-disabled' : ''}`}>
    <div className="field-heading"><label htmlFor={id} title={control.description}>{control.label}</label><span className="number-input-wrap">
      <input id={id} type="number" value={number} min={control.minimum ?? undefined} max={control.maximum ?? undefined} step={control.step ?? 0.1}
        disabled={disabled} aria-invalid={Boolean(issue)} aria-describedby={`${id}-description${issue ? ` ${id}-error` : ''}`}
        onChange={event => change(event.currentTarget.value === '' ? Number.NaN : Number(event.currentTarget.value))} />{control.unit && <span>{control.unit}</span>}
    </span></div>
    <div className="range-track">
      <input className={`range-input${highlight ? ' range-recommended' : ''}`} type="range" aria-label={`${control.label} slider`} value={number === '' ? control.minimum ?? 0 : number}
        style={highlight ? { '--recommended-from': highlight[0], '--recommended-to': highlight[1] } as CSSProperties : undefined}
        min={control.minimum ?? undefined} max={control.maximum ?? undefined} step={control.step ?? 0.1} disabled={disabled} onChange={event => change(Number(event.currentTarget.value))} />
      {defaultAt !== undefined && <span className="range-default-tick" style={{ '--default-at': defaultAt } as CSSProperties} aria-hidden="true" />}
    </div>
    <div className="range-limits"><span>{control.minimum}{control.unit ? ` ${control.unit}` : ''}</span><span>{control.maximum}{control.unit ? ` ${control.unit}` : ''}</span></div>
    {(band || recommended || defaultValue !== undefined) && <p className="range-note" data-testid={`${id}-note`}>
      {band && <strong className="range-band">{band.label}</strong>}
      {defaultValue !== undefined && <span className="range-default">Default {fixed(defaultValue)}{unit}</span>}
      {recommended && (conflict
        ? <span className="range-outside">No single value suits all of these settings</span>
        : <span className={outside ? 'range-outside' : undefined}>{outside ? 'Outside' : 'In'} the {rangeText(recommended)}{unit} recommended for {forWhat}</span>)}
      {recommended && recommended.ranges.length > 1 && misfits.map(range =>
        <span key={range.label} className="range-misfit">{range.label} ({range.choice}): {rangeText(range)}{unit}</span>)}
    </p>}
    <span id={`${id}-description`} className="sr-only">{control.description}</span>
    {issue && <p className="field-error" id={`${id}-error`}>{issue}</p>}
  </div>;
}

/** The commit the app was built from, short, linked to it on GitHub; `dev` when the build did not know it. */
function BuildCommit() {
  const sha = __COMMIT_SHA__;
  if (!/^[0-9a-f]{7,40}$/i.test(sha)) return <span className="build-commit" title="Development build">dev</span>;
  return <a className="build-commit" href={`https://github.com/NNTin/CanFactory/commit/${sha}`} target="_blank" rel="noreferrer" title={`Built from commit ${sha}`}>{sha.slice(0, 7)}</a>;
}

/** A failed render, stated plainly: a defect (not retryable) says so and offers its reference and technical detail to report; only a
 * failure that may pass on another attempt offers to try again. */
function RenderProblemBanner({ problem, retry }: { problem: RenderProblem; retry: () => void }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    const text = [`CanFactory render ${problem.reference ?? ''}`.trim(), `${problem.code}: ${problem.message}`, problem.detail].filter(Boolean).join('\n');
    void navigator.clipboard.writeText(text).then(() => { setCopied(true); }, () => { setCopied(false); });
  };
  return <div className={`error-banner ${problem.retryable ? '' : 'error-banner-defect'}`} role="alert" data-code={problem.code}>
    <CircleAlert size={17} />
    <div className="error-body">
      <strong>{problem.retryable ? 'The preview could not be rendered.' : 'This model failed to render.'}</strong>
      <span>{problem.message}</span>
      {(problem.detail || problem.reference) && <details>
        <summary>Technical details</summary>
        {problem.reference && <p>Reference <code>{problem.reference}</code> · {problem.code}</p>}
        {problem.detail && <pre>{problem.detail}</pre>}
        <button type="button" className="text-button" onClick={copy}>{copied ? 'Copied' : 'Copy for a bug report'}</button>
      </details>}
    </div>
    {problem.retryable && <button type="button" onClick={retry}>Try again</button>}
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
  // Keep poses and colors with the displayed geometry while newer settings render.
  const displayedParameters = rendering.completed?.parameters ?? model.defaults;
  const assembly = useMemo(() => resolveAssembly(definition, model.assembly, displayedParameters), [definition, model, displayedParameters]);
  const references = useMemo(() => referenceObjects(assembly), [assembly]);
  const partTitles = useMemo(() => Object.fromEntries([...(model.parts ?? []), ...(assembly?.references ?? [])].map(part => [part.id, part.title])), [model, assembly]);
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

  const change = (key: string, value: number | boolean | string) => {
    setParameters(current => {
      const next = { ...current, [key]: value };
      // A part choice filtered by this control (Control.part.filter) moves to the first part it now offers, preferring one that the
      // other settings accept (e.g. a screw long enough for the chosen insert).
      for (const control of model.controls) {
        const chosen = next[control.key];
        if (control.part?.filter?.control !== key || (typeof chosen === 'string' && partOptionOffered(control, chosen, next))) continue;
        const offered = offeredOptions(control, next);
        const accepted = definition && offered.find(option => !validateParameters(definition, { ...next, [control.key]: option.value }).some(issue => issue.field === control.key));
        const first = accepted ?? offered[0];
        if (first) next[control.key] = first.value;
      }
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
  // Controls that only matter in some modes of another control (Control.visibleWhen) are hidden in the others.
  const shown = (control: Control) => controlShown(control, parameters);
  // A number control whose room depends on other settings (ModelDefinition.limits) spans the range they leave it.
  const field = (control: Control) => <Field key={control.key} control={definition ? { ...control, ...controlRange(definition, control, parameters) } : control} value={parameters[control.key]} options={control.part?.filter ? offeredOptions(control, parameters) : control.options}
    disabled={control.enabledWhen !== null && parameters[control.enabledWhen] !== true}
    issue={issues.find(issue => issue.field === control.key)?.message} recommended={recommendation(control, model.controls, parameters)} change={value => change(control.key, value)} />;

  return <>
    <div className="editor-layout">
      <aside className="settings-panel">
        {model.customizable ? <>
          <div className="panel-heading"><div><SlidersHorizontal size={16} /><h2>Make it yours</h2></div><button className="text-button" type="button" onClick={reset}><RotateCcw size={13} /> Reset</button></div>
          <p className="panel-intro">A few adjustments. A perfect fit.</p>
          <div className="basic-controls">{model.controls.filter(control => control.group === 'basic' && shown(control)).map(field)}</div>
          {derived?.slotCount !== undefined && derived.slotCount !== null && <div className="slot-note"><Sparkles size={14} /><span>{derived.slotCount === 0 ? 'One opening. A smooth funnel.' : `${derived.slotCount.toLocaleString()} slots, automatically spaced.`}</span></div>}
          {model.controls.some(control => control.group === 'advanced') && <button className="advanced-button" type="button" aria-expanded={advanced} aria-controls="advanced-controls" onClick={() => setAdvanced(value => !value)}>
            Advanced settings <ChevronDown size={16} className={advanced ? 'rotated' : ''} />
          </button>}
          {advanced && <div id="advanced-controls" className="advanced-controls">{model.controls.filter(control => control.group === 'advanced' && shown(control)).map(field)}</div>}
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
        <Viewer url={url} format={model.artifactFormat} assembly={assembly} references={references} partTitles={partTitles} onError={setViewerError} onLoaded={setLoadedUrl} />
        {!ready && url && !error && <div className="previous-preview">Showing the previous preview while your changes are prepared.</div>}
        {!ready && url && rendering.problem && <div className="previous-preview previous-preview-stale">This is the last preview that rendered. It does not match your current settings.</div>}
        {rendering.problem ? <RenderProblemBanner problem={rendering.problem} retry={retry} />
          : (error || (!valid && issues.length > 0)) && <div className="error-banner" role="alert"><CircleAlert size={17} /><span>{error ?? issues[0]?.message}</span>{error && <button type="button" onClick={retry}>Try again</button>}</div>}
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
  const [families, setFamilies] = useState<PartFamilySummary[]>([]);
  const [route, setRoute] = useState<Route | null>(() => parseHash(window.location.hash));
  const [model, setModel] = useState<ModelDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  /** Goes to a page by changing the hash (the `hashchange` listener follows); filters replace the history entry instead of adding one. */
  const navigate = useCallback((next: Route, replace = false) => {
    const hash = formatHash(next);
    if (replace) { window.history.replaceState(null, '', hash); setRoute(parseHash(hash)); }
    else window.location.hash = hash;
  }, []);
  const openLibrary = () => { navigate({ view: 'models', model: null }); setError(null); };
  const openParts = () => { navigate({ view: 'parts', family: null, part: null, filters: {} }); setError(null); };
  useEffect(() => {
    const follow = () => setRoute(parseHash(window.location.hash));
    window.addEventListener('hashchange', follow);
    return () => window.removeEventListener('hashchange', follow);
  }, []);
  useEffect(() => {
    const abort = new AbortController();
    void api.GET('/api/v1/models', { signal: abort.signal }).then(response => {
      if (!response.data) throw new Error('The model catalogue is unavailable.');
      setModels(response.data); setLoading(false);
      // Without a page in the URL, the app opens the first model.
      const first = response.data[0]?.id ?? null;
      setRoute(current => current ?? (window.history.replaceState(null, '', formatHash({ view: 'models', model: first })), { view: 'models', model: first }));
    }).catch((caught: unknown) => { if (!abort.signal.aborted) { setError(caught instanceof Error ? caught.message : 'Cannot load models.'); setLoading(false); } });
    void api.GET('/api/v1/part-families', { signal: abort.signal }).then(response => { if (response.data) setFamilies(response.data); }).catch(() => { /* The header count is optional. */ });
    return () => abort.abort();
  }, []);
  const selectedId = route?.view === 'models' ? route.model : null;
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
  const partsRoute = route?.view === 'parts' ? route : null;
  const family = partsRoute?.family ? families.find(candidate => candidate.id === partsRoute.family) : undefined;
  const partCount = families.reduce((sum, candidate) => sum + candidate.count, 0);

  return <div className="app-shell">
    <header className="site-header"><button className="brand" type="button" aria-label="CanFactory model library" onClick={openLibrary}><span className="brand-mark"><Layers3 size={24} strokeWidth={1.7} /></span>CanFactory<span className="brand-dot">.</span></button>
      <span className="header-tagline">A little factory for useful things.</span><div className="header-right">
        <button type="button" className="library-link" aria-current={route?.view === 'models' ? 'page' : undefined} onClick={openLibrary}>Model library <span>{models.length.toString().padStart(2, '0')}</span></button>
        <button type="button" className="library-link" aria-current={partsRoute ? 'page' : undefined} onClick={openParts}>Parts library <span>{partCount.toString().padStart(2, '0')}</span></button>
        <button type="button" className="library-link" aria-current={route?.view === 'concepts' ? 'page' : undefined} onClick={() => navigate({ view: 'concepts', concept: 'catio', subassembly: null })}>Catio concept</button>
        <span className="local-badge"><i /> Local workspace</span></div>
    </header>
    <main>
      {route?.view === 'concepts' ? <><div className="breadcrumb"><button type="button" onClick={openLibrary}><ArrowLeft size={13} /> Model library</button><span>/</span>
        {route.subassembly ? <><button type="button" onClick={() => navigate({ view: 'concepts', concept: 'catio', subassembly: null })}>Catio concept</button><span>/</span><span>{CATIO_SUBASSEMBLY_TITLES[route.subassembly]}</span></> : <span>Catio concept</span>}</div>
        {route.subassembly ? <CatioSubassemblyRoute key={route.subassembly} id={route.subassembly} /> : <CatioConcept />}</> : partsRoute ? <>
        <div className="breadcrumb"><button type="button" onClick={openParts}><ArrowLeft size={13} /> Parts library</button>
          {partsRoute.family && <><span>/</span>{partsRoute.part
            ? <button type="button" onClick={() => navigate({ ...partsRoute, part: null })}>{family?.title ?? partsRoute.family}</button>
            : <span>{family?.title ?? partsRoute.family}</span>}</>}
          {partsRoute.part && <><span>/</span><span>{parts.find(part => part.id === partsRoute.part)?.designation ?? partsRoute.part}</span></>}</div>
        <PartsLibrary route={partsRoute} families={families} navigate={navigate} />
      </> : <>
      <div className="breadcrumb"><button type="button" onClick={openLibrary}><ArrowLeft size={13} /> Model library</button>{model && <><span>/</span><span>{model.title}</span></>}</div>
      {error ? <div className="empty-state" role="alert"><CircleAlert size={30} /><h1>Let’s reconnect.</h1><p>{error}</p><button className="primary-button" type="button" onClick={() => window.location.reload()}>Reload catalogue</button></div>
        : loading ? <div className="empty-state"><LoaderCircle className="spin" size={30} /><p>Opening the workshop…</p></div>
          : model ? <><div className="page-heading"><div><div className="eyebrow">THE MODEL WORKSHOP</div><h1>{model.title}</h1><p>{model.description}</p></div><span className="model-tag"><span /> {model.customizable ? 'PARAMETRIC MODEL' : 'ASSEMBLY PREVIEW'}</span></div><Editor key={`${model.id}:${model.version}`} model={model} /></>
            : <><div className="page-heading library-heading"><div><div className="eyebrow">THE MODEL LIBRARY</div><h1>Useful things. Made to fit.</h1><p>Start with a model. Make a few changes. Make it yours.</p></div></div>
              <div className="model-library">{models.map(item => <button type="button" className="model-card" key={item.id} onClick={() => navigate({ view: 'models', model: item.id })}><div className="card-art">{(() => { const Illustration = ILLUSTRATIONS[item.id]; return Illustration ? <Illustration /> : <Box size={60} strokeWidth={1} />; })()}</div><div className="card-copy"><span className="eyebrow">{item.customizable ? 'CUSTOMIZABLE' : 'PREVIEW'} · {item.artifactFormat.toUpperCase()}</span><h2>{item.title}</h2><p>{item.description}</p><span className="card-action">{item.customizable ? 'Customize model' : 'View model'} <ArrowRight size={17} /></span></div></button>)}
                <button type="button" className="model-card" onClick={() => navigate({ view: 'concepts', concept: 'catio', subassembly: null })}><div className="card-art catio-card-art"><img src={catioThumbnail} alt="" loading="lazy" /></div><div className="card-copy"><span className="eyebrow">CONCEPT · LIVE ASSEMBLY</span><h2>Window catio</h2><p>A timber enclosure, a removable window connection, and grass under their paws.</p><span className="card-action">Explore the concept <ArrowRight size={17} /></span></div></button>
                <div className="coming-next"><span className="plus-shape">+</span><h2>More useful things to come.</h2><p>A growing collection for everyday making.</p></div></div></>}
      </>}
    </main>
    <footer className="site-footer"><span>MAKE IT FIT. MAKE IT REAL.</span><span>CanFactory · Your local workshop · <BuildCommit /></span></footer>
  </div>;
}
