import type { BomLine } from '@canfactory/contracts';
import type * as THREE from 'three';
import type { CatioLayer, CatioView } from './catioDesign.ts';
import type { CatioState } from './catioScene.ts';
import type { CatioMode } from './catioSettings.ts';
import type { CatioSubassembly } from './route.ts';

/**
 * A sub-assembly of the catio (the window insert, the tunnel and the coupling between them now; the enclosure later) with its own live page
 * (`#/concepts/catio/<id>`): the same two variants as the whole catio, design choices as parameters, its pieces staged
 * into an assembly, and a parts list. `CatioSubassemblyPage` renders any definition; a new sub-assembly is one more
 * definition in `CATIO_SUBASSEMBLY_DEFINITIONS`.
 */
export type V3 = [number, number, number];
export interface AssemblyStep { title: string; detail: string }

/** One choice the owner can change. Options are strings or numbers, kept as they are in the config. */
export interface SubassemblyControl<C> {
  key: keyof C & string;
  label: string;
  group: string;
  /** Why the choice matters, shown under the control. */
  help: string;
  /** The values to choose from; empty for a free number (`range`). */
  options: { value: C[keyof C]; label: string }[];
  /**
   * A free number instead of options: stored in the config's unit (mm, degrees), shown divided by `scale` (e.g. 10 for cm).
   * `min`, `max` and `step` are in the config's unit.
   */
  range?: NumberRange;
  /** The variants it applies to; all when absent. */
  variants?: CatioMode[];
  /** Shown only while this holds, e.g. a height that only matters in one mode. */
  when?: (config: C) => boolean;
}

/**
 * Settings of another page that a page reads: control keys of another sub-assembly page, or setting labels on the catio concept
 * page. A sub-assembly's `follows` lists them; a fact names the ones it comes from.
 */
export interface Follow { page: CatioSubassembly; settings: string[] }
export type SettingRef = Follow | { page: 'concept'; settings: string[] };
/** A short fact for the brief, and where it is set when that is another page. */
export interface SubassemblyFact { label: string; value: string; from?: SettingRef }
export interface NumberRange { min: number; max: number; step: number; unit: string; scale?: number }

/** A number from storage or an input that its range accepts: inside the limits and on a step. */
export function inRange(range: NumberRange, value: unknown): value is number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < range.min || value > range.max) return false;
  const steps = (value - range.min) / range.step;
  return Math.abs(steps - Math.round(steps)) < 1e-6;
}

/** The parts list's lines are shared with the API's buy list (`@canfactory/contracts`). */
export { BOM_GROUPS, type BomGroup, type BomLine } from '@canfactory/contracts';

export interface SubassemblyPreset<C> { id: string; label: string; description: string; config: () => C }

/** A documented design call: what was chosen and why, so the owner can redirect it. */
export interface DesignDecision {
  title: string; choice: string; why: string;
  /** The control on this page that redirects it. */
  parameter?: string;
  /** The settings on another page that redirect it, instead. */
  from?: SettingRef;
}

export interface SubassemblyComponent { id: string; group: THREE.Group; step: number; layer?: CatioLayer }
export interface SubassemblyModel {
  root: THREE.Group;
  hinge: THREE.Group;
  components: SubassemblyComponent[];
  update: (state: CatioState) => void;
  dispose: () => void;
  /** What is being fitted at the last `update`, and how, for the caption under the stage; null between moves. */
  caption?: () => string | null;
  /** Where the sub-assembly is, relative to where it is installed (e.g. out on a bench), for the cameras to follow. */
  focusOffset?: () => V3;
}
export interface CameraPreset { position: V3; target: V3 }

export interface SubassemblyDefinition<C extends object> {
  id: CatioSubassembly;
  title: string;
  eyebrow: string;
  heading: string;
  summary: string;
  /** The variants the page offers, the first being the default; both when absent. */
  variants?: CatioMode[];
  /** Over the facts and parameters, e.g. "THE INSERT". */
  briefLabel: string;
  /** The heading of the written assembly instructions. */
  assemblyHeading: string;
  /** Labels for the camera presets, where a sub-assembly means something else by one (e.g. Mounting as a support detail). */
  viewLabels?: Partial<Record<CatioView, string>>;
  /** The viewing toggles the page offers besides the exploded view, with their labels; both, as for the window, when absent. */
  toggles?: Partial<Record<'windowOpen' | 'cutaway', string>>;
  /** Labels for the layer buttons, where a sub-assembly's layers hold something else (e.g. feet rather than clamps). */
  layerLabels?: Partial<Record<CatioLayer, string>>;
  /** The stage's scale (scene units per stage unit): larger for a sub-assembly that spans the garden. */
  stageScale?: number;
  defaults: C;
  /** Ready-made designs besides the defaults, applied with one click; each is built when picked (it may follow other pages' settings). */
  presets?: SubassemblyPreset<C>[];
  controls: SubassemblyControl<C>[];
  /** A config from untrusted storage, or null when it is not a valid one. */
  parse: (raw: unknown) => C | null;
  validate: (variant: CatioMode, config: C) => string[];
  /** Stage 0 is the existing context; the slider runs from 0 to `steps.length - 1`. */
  steps: (variant: CatioMode, config: C) => readonly AssemblyStep[];
  build: (variant: CatioMode, config: C) => SubassemblyModel;
  bom: (variant: CatioMode, config: C) => BomLine[];
  views: (variant: CatioMode, config: C) => Record<CatioView, CameraPreset>;
  /** Short facts for the brief, e.g. the collar size that follows from the chosen clamps. */
  facts: (variant: CatioMode, config: C) => SubassemblyFact[];
  decisions: DesignDecision[];
  /**
   * The other sub-assembly pages this one is fitted to, and which of their settings change it (an empty list when it only shows
   * them). Linked from both briefs; the other page notes it under each listed setting and warns when its settings break this page.
   */
  follows?: Follow[];
  /**
   * Settings another page owns that this page also shows and edits, under the same key and with the same choices (e.g. how the
   * tunnel is held on its supports, on the tunnel–tunnel coupling page). The owner's saved settings hold them: this page reads
   * them from there when it loads and writes them back when they change here, so either page sets them.
   */
  shares?: Follow[];
  /** The views that open with the wall cut away; Interior and Mounting when absent. */
  cutawayViews?: CatioView[];
  /** Viewing defaults besides the shared ones, e.g. a toggle that starts off. */
  defaultViewing?: Partial<Pick<SubassemblyViewing, 'windowOpen' | 'cutaway' | 'view'>>;
}

export interface SubassemblyViewing { progress: number; exploded: boolean; windowOpen: boolean; cutaway: boolean; hidden: CatioLayer[]; view: CatioView }
export interface SubassemblySettings<C> { version: 1; variant: CatioMode; config: C; views: Record<CatioMode, SubassemblyViewing> }

export const subassemblyStorageKey = (id: CatioSubassembly) => `canfactory.catio.${id}.v1`;

export function defaultSubassemblySettings<C extends object>(definition: SubassemblyDefinition<C>): SubassemblySettings<C> {
  const view = (variant: CatioMode): SubassemblyViewing => ({
    progress: definition.steps(variant, definition.defaults).length - 1, exploded: false, windowOpen: true, cutaway: false, hidden: [], view: 'Exterior', ...definition.defaultViewing,
  });
  return { version: 1, variant: definition.variants?.[0] ?? 'direct', config: structuredClone(definition.defaults), views: { direct: view('direct'), modular: view('modular') } };
}

const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const LAYERS: CatioLayer[] = ['timber', 'mesh', 'hardware', 'environment'];
const VIEWS: CatioView[] = ['Exterior', 'Interior', 'Front', 'Side', 'Top', 'Mounting'];

/** Saved settings, keeping only what is valid; anything else falls back to the defaults. */
export function parseSubassemblySettings<C extends object>(definition: SubassemblyDefinition<C>, raw: string | null): SubassemblySettings<C> {
  const settings = defaultSubassemblySettings(definition);
  try {
    const value: unknown = JSON.parse(raw ?? 'null');
    if (!record(value) || value['version'] !== 1) return settings;
    const config = definition.parse(value['config']);
    if (config) settings.config = config;
    const variant = value['variant'];
    if ((variant === 'direct' || variant === 'modular') && (definition.variants ?? ['direct', 'modular']).includes(variant)) settings.variant = variant;
    const views = value['views'];
    if (record(views)) for (const variant of ['direct', 'modular'] as const) {
      const saved = views[variant]; if (!record(saved)) continue;
      const target = settings.views[variant];
      const last = definition.steps(variant, settings.config).length - 1;
      if (typeof saved['progress'] === 'number' && saved['progress'] >= 0 && saved['progress'] <= last) target.progress = saved['progress'];
      for (const key of ['exploded', 'windowOpen', 'cutaway'] as const) if (typeof saved[key] === 'boolean') target[key] = saved[key];
      if (typeof saved['view'] === 'string' && VIEWS.includes(saved['view'] as CatioView)) target.view = saved['view'] as CatioView;
      if (Array.isArray(saved['hidden'])) target.hidden = saved['hidden'].filter((layer): layer is CatioLayer => LAYERS.includes(layer as CatioLayer));
    }
    return settings;
  } catch { return settings; }
}

export function loadSubassemblySettings<C extends object>(definition: SubassemblyDefinition<C>): SubassemblySettings<C> {
  let settings: SubassemblySettings<C>;
  try { settings = parseSubassemblySettings(definition, localStorage.getItem(subassemblyStorageKey(definition.id))); }
  catch { return defaultSubassemblySettings(definition); }
  settings.config = withShared(definition, settings.config, page => {
    try { return (JSON.parse(localStorage.getItem(subassemblyStorageKey(page)) ?? 'null') as { config?: unknown } | null)?.config; } catch { return undefined; }
  });
  return settings;
}

/** A setting's value from untrusted storage, if its control offers it. */
const accepts = <C>(control: SubassemblyControl<C> | undefined, value: unknown) => !!control && (control.range ? inRange(control.range, value) : control.options.some(option => option.value === value));

/** `config` with its shared settings (`shares`) as the owning pages have them (`owner` gives a page's saved config), where valid. */
export function withShared<C extends object>(definition: SubassemblyDefinition<C>, config: C, owner: (page: CatioSubassembly) => unknown): C {
  const shared = structuredClone(config);
  for (const share of definition.shares ?? []) {
    const saved = owner(share.page); if (!record(saved)) continue;
    for (const key of share.settings) if (accepts(definition.controls.find(c => c.key === key), saved[key])) (shared as Record<string, unknown>)[key] = saved[key];
  }
  return shared;
}

/** Writes this page's shared settings into the owning pages' saved settings, keeping everything else they hold. */
export function saveShared<C extends object>(definition: SubassemblyDefinition<C>, config: C) {
  for (const share of definition.shares ?? []) {
    try {
      const key = subassemblyStorageKey(share.page);
      const saved: unknown = JSON.parse(localStorage.getItem(key) ?? 'null');
      const next = record(saved) && saved['version'] === 1 ? saved : { version: 1 };
      const owned = record(next['config']) ? next['config'] : {};
      const changed = share.settings.some(setting => owned[setting] !== (config as Record<string, unknown>)[setting]);
      if (!changed) continue;
      for (const setting of share.settings) owned[setting] = (config as Record<string, unknown>)[setting];
      localStorage.setItem(key, JSON.stringify({ ...next, config: owned }));
    } catch { /* The page works without storage. */ }
  }
}

/** Another page's saved config (checked by its `parse`), or `defaults` when there is none or storage is unavailable. */
export function loadSubassemblyConfig<C>(id: CatioSubassembly, parse: (raw: unknown) => C | null, defaults: C): C {
  try { return parse((JSON.parse(localStorage.getItem(subassemblyStorageKey(id)) ?? 'null') as { config?: unknown } | null)?.config) ?? defaults; } catch { return defaults; }
}

/**
 * Positions along a line kept at least `gap` from every position in `avoid` (fasteners already there, e.g. another page's
 * screws): a position too close is moved to the nearest clear spot within `min`–`max`, or left where it is when there is none.
 */
export function clearOf(positions: number[], avoid: number[], gap: number, min: number, max: number): number[] {
  const clear = (p: number) => avoid.every(a => Math.abs(p - a) >= gap - 1e-9) && p >= min - 1e-9 && p <= max + 1e-9;
  return positions.map(p => {
    if (clear(p)) return p;
    const candidates = avoid.flatMap(a => [a - gap, a + gap]).filter(clear).sort((a, b) => Math.abs(a - p) - Math.abs(b - p));
    return candidates[0] ?? p;
  });
}

/** Pairs of fasteners closer than `gap` across the first one's driving direction, e.g. a screw driven into another's hole. */
export function fastenerClashes<A extends { at: V3; direction: V3 }, B extends { at: V3 }>(a: A[], b: B[], gap: number): [A, B][] {
  const clashes: [A, B][] = [];
  for (const f of a) for (const g of b) {
    const d: V3 = [g.at[0] - f.at[0], g.at[1] - f.at[1], g.at[2] - f.at[2]];
    const n = Math.hypot(...f.direction); const along = (d[0] * f.direction[0] + d[1] * f.direction[1] + d[2] * f.direction[2]) / n;
    if (Math.sqrt(Math.max(0, d[0] ** 2 + d[1] ** 2 + d[2] ** 2 - along ** 2)) < gap) clashes.push([f, g]);
  }
  return clashes;
}

/** Fasteners along a fixed edge: one at each end and none further apart than `pitch`. */
export function fastenersAlong(length: number, pitch: number): number { return Math.max(2, Math.ceil(length / pitch) + 1); }

/** A config from storage, checked against the controls: each known key keeps a value its control offers, or its default. */
export function parseControlled<C extends object>(defaults: C, controls: SubassemblyControl<C>[], raw: unknown): C | null {
  if (!record(raw)) return null;
  const config = structuredClone(defaults);
  for (const control of controls) {
    const value = raw[control.key];
    if (control.range ? inRange(control.range, value) : control.options.some(option => option.value === value)) (config as Record<string, unknown>)[control.key] = value;
  }
  return config;
}
