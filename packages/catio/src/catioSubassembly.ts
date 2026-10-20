import type { CatioMode } from './catioDesign.ts';

/** The catio's sub-assemblies, each with its own view of an instance of the project (`#/concepts/catio/<id>`). */
export const CATIO_SUBASSEMBLIES = ['window-insert', 'insert-tunnel-coupling', 'tunnel', 'tunnel-tunnel-coupling'] as const;
export type CatioSubassembly = typeof CATIO_SUBASSEMBLIES[number];

/**
 * A sub-assembly of the catio (the window insert, the tunnel and the couplings now; the enclosure later), shown in its own live view
 * of an instance of the project (`#/concepts/catio/<id>`): its design choices as parameters (the project's, catioProjectDetail.ts),
 * its pieces staged into an assembly, and a parts list. Its pure parts are here: the web app's `CatioSubassemblyPage` renders any
 * definition (`apps/web/src/catioSubassembly.ts`).
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
 * Where a setting of the project is edited, when it is not on the sub-assembly's own view: control keys of another sub-assembly's
 * view, or setting labels in the catio planner (its window's cat ports). A fact or a decision names the ones it comes from.
 */
export type SettingRef = { page: CatioSubassembly; settings: string[] } | { page: 'planner'; settings: string[] };
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

export interface CameraPreset { position: V3; target: V3 }
export interface SubassemblyPreset<C> { id: string; label: string; description: string; config: () => C }

/** A documented design call: what was chosen and why, so the owner can redirect it. */
export interface DesignDecision {
  title: string; choice: string; why: string;
  /** The control on this page that redirects it. */
  parameter?: string;
  /** The settings on another page that redirect it, instead. */
  from?: SettingRef;
}


const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

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

/**
 * What a config saved before a setting existed has for it: the design as it was then, not today's default, so that a saved design
 * does not change when a new choice gets a new default. A config the page saved itself always holds `witness` (a setting the page
 * has had from the start); one that holds it but lacks a setting of `values` was saved before that setting existed. A config
 * without the witness is not a design of the page's (e.g. only the settings another page once shared with it), and takes the defaults.
 */
export interface LegacySettings<C> { witness: keyof C & string; values: Partial<C> }

/**
 * A config from storage, checked against the controls: each known key keeps a value its control offers, or its default. A key the
 * saved config lacks altogether takes its `legacy` value instead, when it has one.
 */
export function parseControlled<C extends object>(defaults: C, controls: SubassemblyControl<C>[], raw: unknown, legacy?: LegacySettings<C>): C | null {
  if (!record(raw)) return null;
  const config = structuredClone(defaults);
  if (legacy && legacy.witness in raw) for (const [key, value] of Object.entries(legacy.values)) if (!(key in raw)) (config as Record<string, unknown>)[key] = value;
  for (const control of controls) {
    const value = raw[control.key];
    if (control.range ? inRange(control.range, value) : control.options.some(option => option.value === value)) (config as Record<string, unknown>)[control.key] = value;
  }
  return config;
}
