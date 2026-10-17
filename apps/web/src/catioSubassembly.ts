import type { CameraPreset, CatioLayer, CatioMode, CatioSubassembly, CatioView, DesignDecision, AssemblyStep, BomLine, Follow, SubassemblyControl, SubassemblyFact, SubassemblyPreset, V3 } from '@canfactory/catio';
import { inRange } from '@canfactory/catio';
import type * as THREE from 'three';
import type { CatioState } from './catioScene.ts';

/**
 * A sub-assembly's live page (`#/concepts/catio/<id>`): the same two variants as the whole catio, design choices as parameters, its
 * pieces staged into an assembly, and a parts list. `CatioSubassemblyPage` renders any definition; a new sub-assembly is one more
 * definition in `CATIO_SUBASSEMBLY_DEFINITIONS`. The pure parts (controls, facts, decisions) are in `@canfactory/catio`.
 */
const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

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

/** A drawing to make a part by: its title, what it is for, an SVG document at 1:1, and the file name to save it as. */
export interface SubassemblyDrawing { id: string; title: string; caption: string; svg: string; filename: string }
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
  /**
   * The label of the toggle that opens the design's door (a cat port's panel or gate, a side-access panel), or null when this
   * design has none. Checked, the scene shows the door open (`CatioState.door` runs from 0 to 1 as it opens); absent, no toggle.
   */
  doorToggle?: (variant: CatioMode, config: C) => string | null;
  /** Drawings to make it by, shown beside the parts list with a download: an SVG document at 1:1 in millimetres. */
  drawings?: (variant: CatioMode, config: C) => SubassemblyDrawing[];
  /** The views that open with the wall cut away; Interior and Mounting when absent. */
  cutawayViews?: CatioView[];
  /** Viewing defaults besides the shared ones, e.g. a toggle that starts off. */
  defaultViewing?: Partial<Pick<SubassemblyViewing, 'windowOpen' | 'cutaway' | 'view'>>;
}

export interface SubassemblyViewing {
  progress: number; exploded: boolean; windowOpen: boolean; cutaway: boolean; hidden: CatioLayer[]; view: CatioView;
  /** The design's door shown open (`doorToggle`): closed in settings saved before there was one. */
  doorOpen: boolean;
}
export interface SubassemblySettings<C> { version: 1; variant: CatioMode; config: C; views: Record<CatioMode, SubassemblyViewing> }

/** (`savedBeforeClosure` in catioSettings.ts reads these keys too.) */
export const subassemblyStorageKey = (id: CatioSubassembly) => `canfactory.catio.${id}.v1`;

export function defaultSubassemblySettings<C extends object>(definition: SubassemblyDefinition<C>): SubassemblySettings<C> {
  const view = (variant: CatioMode): SubassemblyViewing => ({
    progress: definition.steps(variant, definition.defaults).length - 1, exploded: false, windowOpen: true, cutaway: false, hidden: [], view: 'Exterior', doorOpen: false, ...definition.defaultViewing,
  });
  return { version: 1, variant: definition.variants?.[0] ?? 'direct', config: structuredClone(definition.defaults), views: { direct: view('direct'), modular: view('modular') } };
}

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
      for (const key of ['exploded', 'windowOpen', 'cutaway', 'doorOpen'] as const) if (typeof saved[key] === 'boolean') target[key] = saved[key];
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

