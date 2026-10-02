import { CATIO_VIEWS, type CatioLayer, type CatioView } from './catioDesign.ts';
import { MODULAR_DEFAULT, validateModular, type ModularConfig } from './catioModularDesign.ts';
export type CatioMode = 'direct' | 'modular';
export interface CatioViewing { progress: number; exploded: boolean; windowOpen: boolean; cutaway: boolean; hidden: CatioLayer[]; view: CatioView; doors: Record<string, boolean> }
export interface CatioSettings { version: 1; mode: CatioMode; config: ModularConfig; views: Record<CatioMode, CatioViewing> }
export const CATIO_STORAGE_KEY = 'canfactory.catio.v1';
export function defaultCatioSettings(): CatioSettings {
  const view = (): CatioViewing => ({ progress: 6, exploded: false, windowOpen: true, cutaway: false, hidden: [], view: 'Exterior', doors: {} });
  return { version: 1, mode: 'direct', config: structuredClone(MODULAR_DEFAULT), views: { direct: view(), modular: view() } };
}
function record(value: unknown): value is Record<string, unknown> { return typeof value === 'object' && value !== null && !Array.isArray(value); }
export function parseCatioSettings(raw: string | null): CatioSettings {
  const defaults = defaultCatioSettings();
  try {
    const value: unknown = JSON.parse(raw ?? 'null');
    if (!record(value) || value['version'] !== 1) return defaults;
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
