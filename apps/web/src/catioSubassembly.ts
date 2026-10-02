import type * as THREE from 'three';
import type { CatioLayer, CatioView } from './catioDesign.ts';
import type { CatioState } from './catioScene.ts';
import type { CatioMode } from './catioSettings.ts';
import type { CatioSubassembly } from './route.ts';

/**
 * A sub-assembly of the catio (the window insert and the tunnel now; the enclosure later) with its own live page
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
}
export interface NumberRange { min: number; max: number; step: number; unit: string; scale?: number }

/** A number from storage or an input that its range accepts: inside the limits and on a step. */
export function inRange(range: NumberRange, value: unknown): value is number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < range.min || value > range.max) return false;
  const steps = (value - range.min) / range.step;
  return Math.abs(steps - Math.round(steps)) < 1e-6;
}

export const BOM_GROUPS = ['Timber', 'Mesh', 'Hardware', 'Groundwork'] as const;
export type BomGroup = typeof BOM_GROUPS[number];
/** One line of the parts list. A library part links to the parts library; other lines are cut or made for the catio. */
export interface BomLine {
  id: string;
  group: BomGroup;
  name: string;
  quantity: number;
  /** Size, e.g. a cut length and section, or a part's key dimensions, in millimetres. */
  size: string;
  /** Where it goes. */
  use: string;
  partId?: string;
}

/** A documented design call: what was chosen and why, so the owner can redirect it. */
export interface DesignDecision { title: string; choice: string; why: string; parameter?: string }

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
  facts: (variant: CatioMode, config: C) => { label: string; value: string }[];
  decisions: DesignDecision[];
}

export interface SubassemblyViewing { progress: number; exploded: boolean; windowOpen: boolean; cutaway: boolean; hidden: CatioLayer[]; view: CatioView }
export interface SubassemblySettings<C> { version: 1; variant: CatioMode; config: C; views: Record<CatioMode, SubassemblyViewing> }

export const subassemblyStorageKey = (id: CatioSubassembly) => `canfactory.catio.${id}.v1`;

export function defaultSubassemblySettings<C extends object>(definition: SubassemblyDefinition<C>): SubassemblySettings<C> {
  const view = (variant: CatioMode): SubassemblyViewing => ({
    progress: definition.steps(variant, definition.defaults).length - 1, exploded: false, windowOpen: true, cutaway: false, hidden: [], view: 'Exterior',
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
  try { return parseSubassemblySettings(definition, localStorage.getItem(subassemblyStorageKey(definition.id))); }
  catch { return defaultSubassemblySettings(definition); }
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
