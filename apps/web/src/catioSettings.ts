import { CATIO_VIEWS, type CatioLayer, type CatioView } from './catioDesign.ts';
import { PORT_CLOSURE_LEGACY } from './catioDoor.ts';
import { MODULAR_DEFAULT, validateModular, type ModularConfig } from './catioModularDesign.ts';
export type CatioMode = 'direct' | 'modular';
export interface CatioViewing { progress: number; exploded: boolean; windowOpen: boolean; cutaway: boolean; hidden: CatioLayer[]; view: CatioView; doors: Record<string, boolean> }
/** The settings as saved now. Version 1 had no `portClosure`: every cat port had a sliding gate (see `migrateCatioSettings`). */
export const CATIO_SETTINGS_VERSION = 2;
export interface CatioSettings { version: typeof CATIO_SETTINGS_VERSION; mode: CatioMode; config: ModularConfig; views: Record<CatioMode, CatioViewing> }
export const CATIO_STORAGE_KEY = 'canfactory.catio.v1';
export function defaultCatioSettings(): CatioSettings {
  const view = (): CatioViewing => ({ progress: 6, exploded: false, windowOpen: true, cutaway: false, hidden: [], view: 'Exterior', doors: {} });
  return { version: CATIO_SETTINGS_VERSION, mode: 'direct', config: structuredClone(MODULAR_DEFAULT), views: { direct: view(), modular: view() } };
}
function record(value: unknown): value is Record<string, unknown> { return typeof value === 'object' && value !== null && !Array.isArray(value); }
/**
 * Saved settings of any version brought to the current one, or null when they are none of ours. A version 1 design keeps
 * everything it holds, dimensions and viewing state alike, and gets the sliding gates it was drawn with: only a new or reset
 * design takes the new default closure. Nothing else is touched, so that what is invalid is still rejected by the checks after it.
 */
export function migrateCatioSettings(value: unknown): Record<string, unknown> | null {
  if (!record(value)) return null;
  if (value['version'] === CATIO_SETTINGS_VERSION) return value;
  if (value['version'] !== 1) return null;
  const config = value['config'];
  return { ...value, version: CATIO_SETTINGS_VERSION, config: record(config) ? { ...config, portClosure: PORT_CLOSURE_LEGACY } : config };
}
export function parseCatioSettings(raw: string | null): CatioSettings {
  const defaults = defaultCatioSettings();
  try {
    const value = migrateCatioSettings(JSON.parse(raw ?? 'null'));
    if (!value) return defaults;
    const config = value['config'];
    if (!record(config)) return defaults;
    // Require the entire shape before invoking dimensional validation on untrusted local storage.
    for (const key of Object.keys(defaults.config) as (keyof ModularConfig)[]) {
      if (key === 'enclosure' || key === 'second') {
        const size = config[key]; if (!record(size) || !['width', 'depth', 'height'].every(k => typeof size[k] === 'number')) return defaults;
      } else if (typeof config[key] !== typeof defaults.config[key]) return defaults;
    }
    const typedConfig = config as unknown as ModularConfig;
    if (validateModular(typedConfig).length) return defaults;
    defaults.config = typedConfig;
    if (value['mode'] === 'modular') defaults.mode = 'modular';
    const views = value['views'];
    if (record(views)) for (const mode of ['direct', 'modular'] as const) {
      const saved = views[mode]; if (!record(saved)) continue;
      const v = defaults.views[mode];
      if (typeof saved['progress'] === 'number' && saved['progress'] >= 0 && saved['progress'] <= 6) v.progress = saved['progress'];
      for (const key of ['exploded', 'windowOpen', 'cutaway'] as const) if (typeof saved[key] === 'boolean') v[key] = saved[key];
      if (typeof saved['view'] === 'string' && Object.hasOwn(CATIO_VIEWS, saved['view'])) v.view = saved['view'] as CatioView;
      if (Array.isArray(saved['hidden'])) v.hidden = saved['hidden'].filter((layer): layer is CatioLayer => ['timber', 'mesh', 'hardware', 'environment'].includes(String(layer)));
      if (record(saved['doors'])) v.doors = Object.fromEntries(Object.entries(saved['doors']).filter((entry): entry is [string, boolean] => typeof entry[1] === 'boolean'));
    }
    return defaults;
  } catch { return defaults; }
}
export function loadCatioSettings(): CatioSettings {
  try { return parseCatioSettings(localStorage.getItem(CATIO_STORAGE_KEY)); } catch { return defaultCatioSettings(); }
}
