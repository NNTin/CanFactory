import type { CatioSubassembly } from './route.ts';
import { loadSubassemblySettings, type Follow, type SubassemblyDefinition } from './catioSubassembly.ts';
import { createWindowInsertScene } from './catioWindowInsertScene.ts';
import { createTunnelScene } from './catioTunnelScene.ts';
import { createCouplingScene } from './catioCouplingScene.ts';
import { createTunnelCouplingScene } from './catioTunnelCouplingScene.ts';
import {
  parseTunnelCoupling, TUNNEL_COUPLING_CONTROLS, TUNNEL_COUPLING_DECISIONS, TUNNEL_COUPLING_DEFAULT, TUNNEL_SETTINGS_FOLLOWED, TUNNEL_SETTINGS_SHARED, tunnelCouplingBom, tunnelCouplingFacts, tunnelCouplingSteps,
  tunnelCouplingViews, validateTunnelCoupling, type TunnelCouplingConfig,
} from './catioTunnelCoupling.ts';
import {
  COUPLING_CONTROLS, COUPLING_DECISIONS, COUPLING_DEFAULT, couplingBom, couplingFacts, couplingSteps, couplingViews, parseCoupling, validateCoupling, type CouplingConfig,
} from './catioCoupling.ts';
import {
  parseTunnel, TUNNEL_CONTROLS, TUNNEL_PRESETS, TUNNEL_DECISIONS, TUNNEL_DEFAULT, tunnelBom, tunnelFacts, tunnelSteps, tunnelViews, validateTunnel, type TunnelConfig,
} from './catioTunnel.ts';
import {
  parseWindowInsert, validateWindowInsert, WINDOW_FLOOR_SETTINGS, WINDOW_INSERT_CONTROLS, WINDOW_INSERT_DECISIONS, WINDOW_INSERT_DEFAULT, windowInsertBom, windowInsertFacts,
  windowInsertSteps, windowInsertViews, type WindowInsertConfig,
} from './catioWindowInsert.ts';

export const windowInsertDefinition: SubassemblyDefinition<WindowInsertConfig> = {
  id: 'window-insert', title: 'Window insert', eyebrow: 'CATIO SUB-ASSEMBLY · WINDOW INSERT',
  heading: 'Held by the window, not fixed to it.', briefLabel: 'THE INSERT', assemblyHeading: 'From the bench to the window.',
  summary: 'The removable timber collar that sits in the exterior recess: its pieces, the joints between them, how the mesh is held, and the padded clamps that grip the recess without a single hole in the wall.',
  defaults: WINDOW_INSERT_DEFAULT, controls: WINDOW_INSERT_CONTROLS, parse: parseWindowInsert,
  validate: (variant, config) => validateWindowInsert(variant, config),
  steps: windowInsertSteps, build: createWindowInsertScene, bom: (variant, config) => windowInsertBom(variant, config),
  views: windowInsertViews, facts: windowInsertFacts, decisions: WINDOW_INSERT_DECISIONS,
};

export const tunnelDefinition: SubassemblyDefinition<TunnelConfig> = {
  id: 'tunnel', title: 'Tunnel', eyebrow: 'CATIO SUB-ASSEMBLY · TUNNEL',
  heading: 'Any angle, any height, on any ground.',
  summary: 'The enclosed walkway from the window insert’s cat port to the enclosure’s: solved between the two ports, turning and climbing at any angle through parametrised angle joints, on supports whose levelling feet take up ground that is not level.',
  variants: ['modular'], briefLabel: 'THE TUNNEL', assemblyHeading: 'From the slabs to the enclosure.', stageScale: 20,
  // the window port's floor, which the tunnel starts from, follows the insert's clamp gap; every section and collar coupling is the
  // tunnel–tunnel coupling page's (latched across a gap, or bolted)
  follows: [{ page: 'window-insert', settings: WINDOW_FLOOR_SETTINGS }, { page: 'tunnel-tunnel-coupling', settings: ['mechanism', 'latchesPerSide', 'boltsPerCoupling', 'seal'] }],
  viewLabels: { Interior: 'Along the tunnel', Side: 'Side · the climb', Top: 'Top · the turns', Mounting: 'Support detail' },
  toggles: { cutaway: 'Wall cutaway' }, layerLabels: { hardware: 'Bolts, feet & fixings', environment: 'Ground, wall & slabs' },
  defaults: TUNNEL_DEFAULT, presets: TUNNEL_PRESETS, controls: TUNNEL_CONTROLS, parse: parseTunnel,
  validate: (variant, config) => validateTunnel(variant, config),
  steps: tunnelSteps, build: createTunnelScene, bom: (variant, config) => tunnelBom(variant, config),
  views: tunnelViews, facts: tunnelFacts, decisions: TUNNEL_DECISIONS,
};

export const couplingDefinition: SubassemblyDefinition<CouplingConfig> = {
  id: 'insert-tunnel-coupling', title: 'Insert–tunnel coupling', eyebrow: 'CATIO SUB-ASSEMBLY · INSERT–TUNNEL COUPLING',
  heading: 'Two levers to dock, two to let go.',
  summary: 'The joint between the window insert’s cat port and the tunnel’s first flange: a docking frame on the insert, a squashed seal, and toggle latches that join the two without tools, while the tunnel’s own support keeps carrying its weight.',
  variants: ['modular'], briefLabel: 'THE JOINT', assemblyHeading: 'From the port to a docked tunnel.', 
  // the docking frame fits the insert's port face (battens or not, its floor, its screws); the tunnel's first section and wall
  // support are only shown
  follows: [{ page: 'window-insert', settings: ['meshFixing', 'fixingPitch', ...WINDOW_FLOOR_SETTINGS] }, { page: 'tunnel', settings: [] }],
  cutawayViews: ['Interior', 'Side', 'Top', 'Mounting'],
  viewLabels: { Side: 'Side · the joint', Mounting: 'Latch detail' },
  toggles: { windowOpen: 'Released · latches open', cutaway: 'Wall cutaway' }, defaultViewing: { windowOpen: false },
  layerLabels: { hardware: 'Latches, seal & screws', environment: 'Wall & grass' },
  defaults: COUPLING_DEFAULT, controls: COUPLING_CONTROLS, parse: parseCoupling,
  validate: (variant, config) => validateCoupling(variant, config),
  steps: couplingSteps, build: createCouplingScene, bom: (variant, config) => couplingBom(variant, config),
  views: couplingViews, facts: couplingFacts, decisions: COUPLING_DECISIONS,
};

export const tunnelCouplingDefinition: SubassemblyDefinition<TunnelCouplingConfig> = {
  id: 'tunnel-tunnel-coupling', title: 'Tunnel–tunnel coupling', eyebrow: 'CATIO SUB-ASSEMBLY · TUNNEL–TUNNEL COUPLING',
  heading: 'One section, then the next.',
  summary: 'How two of the tunnel’s sections are joined, flange to flange, on the support under the joint: printed toggle latches across a sealed gap that close by hand, or M8 bolts through both flanges. The tunnel page couples every section this way.',
  variants: ['modular'], briefLabel: 'THE JOINT', assemblyHeading: 'From one section to two, coupled.',
  // its two sections are the tunnel's, at its longest section, on one of its supports with its feet, on its ground
  follows: [{ page: 'tunnel', settings: TUNNEL_SETTINGS_FOLLOWED }],
  // how the tunnel is held on its supports: the tunnel page's settings, set here too
  shares: [{ page: 'tunnel', settings: TUNNEL_SETTINGS_SHARED }],
  viewLabels: { Interior: 'Along the tunnel', Side: 'Side · the joint', Mounting: 'Latch detail' },
  toggles: { windowOpen: 'Released · latches open' }, defaultViewing: { windowOpen: false },
  layerLabels: { hardware: 'Latches, bolts, feet & screws', environment: 'Grass & slabs' },
  defaults: TUNNEL_COUPLING_DEFAULT, controls: TUNNEL_COUPLING_CONTROLS, parse: parseTunnelCoupling,
  validate: (variant, config) => validateTunnelCoupling(variant, config),
  steps: (variant, config) => tunnelCouplingSteps(variant, config), build: (variant, config) => createTunnelCouplingScene(variant, config),
  bom: (variant, config) => tunnelCouplingBom(variant, config),
  views: tunnelCouplingViews, facts: (variant, config) => tunnelCouplingFacts(variant, config), decisions: TUNNEL_COUPLING_DECISIONS,
};

/** Every sub-assembly page, for links and breadcrumbs. The enclosure is next; `CatioSubassemblyRoute` picks the definition. */
export const CATIO_SUBASSEMBLY_TITLES: Record<CatioSubassembly, string> = {
  'window-insert': windowInsertDefinition.title, 'insert-tunnel-coupling': couplingDefinition.title, tunnel: tunnelDefinition.title,
  'tunnel-tunnel-coupling': tunnelCouplingDefinition.title,
};

/** What other pages need of a sub-assembly page without knowing its config type. */
export interface SubassemblyEntry {
  id: CatioSubassembly; title: string; follows: Follow[]; shares: Follow[];
  /** A control's label, by its key. */
  label: (key: string) => string;
  /** Its errors with its saved settings, which read the other pages' saved settings in turn. */
  savedErrors: () => string[];
}
const entry = <C extends object>(d: SubassemblyDefinition<C>): SubassemblyEntry => ({
  id: d.id, title: d.title, follows: d.follows ?? [], shares: d.shares ?? [],
  label: key => d.controls.find(control => control.key === key)?.label ?? key,
  savedErrors: () => { const saved = loadSubassemblySettings(d); return d.validate(saved.variant, saved.config); },
});
export const CATIO_SUBASSEMBLY_ENTRIES: Record<CatioSubassembly, SubassemblyEntry> = {
  'window-insert': entry(windowInsertDefinition), tunnel: entry(tunnelDefinition), 'insert-tunnel-coupling': entry(couplingDefinition),
  'tunnel-tunnel-coupling': entry(tunnelCouplingDefinition),
};

/** The pages that follow `id` or share its settings, each with the settings of `id` that change it. */
export function dependentsOf(id: CatioSubassembly): Follow[] {
  return Object.values(CATIO_SUBASSEMBLY_ENTRIES).flatMap(e => {
    const settings = [...e.follows, ...e.shares].filter(f => f.page === id).flatMap(f => f.settings);
    return settings.length || e.follows.some(f => f.page === id) ? [{ page: e.id, settings: [...new Set(settings)] }] : [];
  });
}
