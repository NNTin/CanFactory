import { CATIO_VIEWS, type CatioLayer, type CatioView } from './catioDesign.ts';
import { PORT_CLOSURE_LEGACY } from './catioDoor.ts';
import { MODULAR_DEFAULT, validateModular, type ModularConfig } from './catioModularDesign.ts';
import { CATIO_SUBASSEMBLIES } from './route.ts';
export type CatioMode = 'direct' | 'modular';
export interface CatioViewing { progress: number; exploded: boolean; windowOpen: boolean; cutaway: boolean; hidden: CatioLayer[]; view: CatioView; doors: Record<string, boolean> }
/**
 * The settings as saved now. Version 1 had no `portClosure`: every cat port had a sliding gate. Up to version 2 the tunnel's clear
 * width and height could differ; the standard port is square (see `migrateCatioSettings`).
 */
export const CATIO_SETTINGS_VERSION = 3;
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
 * design takes the new default closure. A design saved with the tunnel's clear width and height (version 1, 2, or 3 as first
 * written) has one clear size now, the standard square port's: the larger of the two, so that the cats' opening never shrinks.
 * Nothing else is touched, so that what is invalid is still rejected by the checks after it.
 */
export function migrateCatioSettings(value: unknown): Record<string, unknown> | null {
  if (!record(value)) return null;
  const config = value['config'];
  const version = value['version'];
  if (version !== 1 && version !== 2 && version !== CATIO_SETTINGS_VERSION) return null;
  if (!record(config)) return { ...value, version: CATIO_SETTINGS_VERSION };
  const closure = version === 1 ? { portClosure: PORT_CLOSURE_LEGACY } : {};
  // the tunnel's clear width and height, as saved before the port was square: its larger size, both ways
  const [w, h] = [config['tunnelWidth'], config['tunnelHeight']];
  const sizes = [w, h].filter((n): n is number => typeof n === 'number');
  if (version === CATIO_SETTINGS_VERSION && !sizes.length) return value;
  const rest = Object.fromEntries(Object.entries(config).filter(([key]) => key !== 'tunnelWidth' && key !== 'tunnelHeight'));
  const size = sizes.length && !('tunnelSize' in config) ? { tunnelSize: Math.max(...sizes) } : {};
  return { ...value, version: CATIO_SETTINGS_VERSION, config: { ...rest, ...closure, ...size } };
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
/**
 * Whether a sub-assembly page (the window insert, the tunnel, a coupling) saved its settings before the cat ports' closure could
 * be chosen: a page's own save names its variant, and since the choice exists also says whether its door is shown open
 * (`doorOpen`) in every view. Settings another page only shared into its storage are not a page's own save.
 */
export function savedBeforeClosure(storage: Pick<Storage, 'getItem'>): boolean {
  return CATIO_SUBASSEMBLIES.some(id => {
    try {
      const saved: unknown = JSON.parse(storage.getItem(`canfactory.catio.${id}.v1`) ?? 'null');
      if (!record(saved) || typeof saved['variant'] !== 'string') return false;
      const views = record(saved['views']) ? Object.values(saved['views']).filter(record) : [];
      return !views.some(view => typeof view['doorOpen'] === 'boolean');
    } catch { return false; }
  });
}

/**
 * The whole catio's saved settings. With none saved, a new design: unless a sub-assembly page was saved before the closure could
 * be chosen. Its design was drawn with sliding gates and follows these settings, so it keeps them: the catio's settings are then
 * started, and saved, with the sliding gate, and stay so once that page saves itself again.
 */
export function loadCatioSettings(): CatioSettings {
  try {
    const raw = localStorage.getItem(CATIO_STORAGE_KEY);
    if (raw !== null || !savedBeforeClosure(localStorage)) return parseCatioSettings(raw);
    const settings = defaultCatioSettings(); settings.config.portClosure = PORT_CLOSURE_LEGACY;
    try { localStorage.setItem(CATIO_STORAGE_KEY, JSON.stringify(settings)); } catch { /* It is found again next time. */ }
    return settings;
  } catch { return defaultCatioSettings(); }
}
