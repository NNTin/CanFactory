import { loadSubassemblySettings, type SubassemblyDefinition, type SubassemblyDrawing } from './catioSubassembly.ts';
import { createWindowInsertScene } from './catioWindowInsertScene.ts';
import { createTunnelScene } from './catioTunnelScene.ts';
import { createCouplingScene } from './catioCouplingScene.ts';
import { createTunnelCouplingScene } from './catioTunnelCouplingScene.ts';
import { COUPLING_CONTROLS, COUPLING_DECISIONS, COUPLING_DEFAULT, couplingBom, couplingFacts, couplingSteps, couplingViews, parseCoupling, parseTunnel, parseTunnelCoupling, parseWindowInsert, portTemplateSvg, TUNNEL_CONTROLS, TUNNEL_COUPLING_CONTROLS, TUNNEL_COUPLING_DECISIONS, TUNNEL_COUPLING_DEFAULT, TUNNEL_DECISIONS, TUNNEL_DEFAULT, tunnelPresets, TUNNEL_SETTINGS_FOLLOWED, TUNNEL_SETTINGS_SHARED, tunnelBom, tunnelCouplingBom, tunnelCouplingFacts, tunnelCouplingLayout, tunnelCouplingSteps, tunnelCouplingViews, tunnelFacts, tunnelLayout, tunnelSteps, tunnelViews, validateCoupling, validateTunnel, validateTunnelCoupling, validateWindowInsert, WINDOW_FLOOR_SETTINGS, WINDOW_INSERT_CONTROLS, WINDOW_INSERT_DECISIONS, WINDOW_INSERT_DEFAULT, windowInsertBom, windowInsertFacts, windowInsertSteps, windowInsertViews, type CouplingConfig, type Follow, type TunnelConfig, type TunnelCouplingConfig, type WindowInsertConfig, type CatioSubassembly } from '@canfactory/catio';
import { couplingSite, savedCoupling, savedTunnelCoupling, savedWindow, tunnelCouplingSite, tunnelSite } from './catioSaved.ts';

// Each page shows its sub-assembly fitted to the others' saved settings: resolved here, at every call, and passed in.
const tunnelJoint = () => savedTunnelCoupling();

export const windowInsertDefinition: SubassemblyDefinition<WindowInsertConfig> = {
  id: 'window-insert', title: 'Window insert', eyebrow: 'CATIO SUB-ASSEMBLY · WINDOW INSERT',
  heading: 'Held by the window, not fixed to it.', briefLabel: 'THE INSERT', assemblyHeading: 'From the bench to the window.',
  summary: 'The removable timber collar that sits in the exterior recess: its pieces, the joints between them, how the mesh is held, and the padded clamps that grip the recess, or the screen hooks that hang it on the window frame, without a single hole in the wall or the window.',
  // with tunnel, the cat port is shut by what the catio concept page sets for every cat port, and the page can open it
  doorToggle: variant => variant === 'modular' ? 'Cat port open' : null,
  defaults: WINDOW_INSERT_DEFAULT, controls: WINDOW_INSERT_CONTROLS, parse: parseWindowInsert,
  validate: (variant, config) => validateWindowInsert(variant, config, savedWindow(variant, config)),
  steps: (variant, config) => windowInsertSteps(variant, config, savedWindow(variant, config)),
  build: (variant, config) => createWindowInsertScene(variant, config, savedWindow(variant, config)),
  bom: (variant, config) => windowInsertBom(variant, config, savedWindow(variant, config)),
  views: (variant, config) => windowInsertViews(variant, config, savedWindow(variant, config)),
  facts: (variant, config) => windowInsertFacts(variant, config, savedWindow(variant, config)), decisions: WINDOW_INSERT_DECISIONS,
};

export const tunnelDefinition: SubassemblyDefinition<TunnelConfig> = {
  id: 'tunnel', title: 'Tunnel', eyebrow: 'CATIO SUB-ASSEMBLY · TUNNEL',
  heading: 'Standard elements, any height, on any ground.',
  summary: 'The enclosed walkway from the window insert’s cat port to the enclosure’s, built of standard elements: every piece ends in the same port, so any one couples to any other. It turns at cubes (or angle collars) and climbs on sloped sections, on supports whose levelling feet take up ground that is not level.',
  variants: ['modular'], briefLabel: 'THE TUNNEL', assemblyHeading: 'From the slabs to the enclosure.', stageScale: 20,
  // the window port's floor, which the tunnel starts from, follows the insert's clamp gap; every section and collar coupling is the
  // tunnel–tunnel coupling page's (latched across a gap, or bolted)
  follows: [{ page: 'window-insert', settings: WINDOW_FLOOR_SETTINGS }, { page: 'tunnel-tunnel-coupling', settings: ['mechanism', 'latchesPerSide', 'boltsPerCoupling', 'seal', 'doorFixing'] }],
  viewLabels: { Interior: 'Along the tunnel', Side: 'Side · the climb', Top: 'Top · the turns', Mounting: 'Support detail' },
  toggles: { cutaway: 'Wall cutaway' }, layerLabels: { hardware: 'Bolts, feet & fixings', environment: 'Ground, wall & slabs' },
  // the doors of every opening that is not coupled: the end bays' sides (the side access), and a section's start at a turn
  doorToggle: (_variant, config) => tunnelLayout(config, tunnelSite(), tunnelJoint()).doors.length > 0 ? 'Doors open' : null,
  defaults: TUNNEL_DEFAULT, presets: tunnelPresets(() => ({ site: tunnelSite(), joint: tunnelJoint() })), controls: TUNNEL_CONTROLS, parse: parseTunnel,
  validate: (variant, config) => validateTunnel(variant, config, tunnelSite(), tunnelJoint()),
  steps: (variant, config) => tunnelSteps(variant, config, tunnelSite(), tunnelJoint()),
  build: (variant, config) => createTunnelScene(variant, config, tunnelSite(), tunnelJoint(), savedCoupling()),
  bom: (variant, config) => tunnelBom(variant, config, tunnelSite(), tunnelJoint()),
  views: (variant, config) => tunnelViews(variant, config, tunnelSite(), tunnelJoint()),
  facts: (variant, config) => tunnelFacts(variant, config, tunnelSite(), tunnelJoint()), decisions: TUNNEL_DECISIONS, drawings: () => [portTemplateDrawing(tunnelSite().w)],
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
  // docked and latched, the window's cat port can be opened from the room
  doorToggle: () => 'Cat port open',
  layerLabels: { hardware: 'Latches, seal & screws', environment: 'Wall & grass' },
  defaults: COUPLING_DEFAULT, controls: COUPLING_CONTROLS, parse: parseCoupling,
  validate: (variant, config) => validateCoupling(variant, config, couplingSite()),
  steps: (variant, config) => couplingSteps(variant, config, couplingSite()),
  build: (variant, config) => createCouplingScene(variant, config, couplingSite()),
  bom: (variant, config) => couplingBom(variant, config, couplingSite()),
  views: (variant, config) => couplingViews(variant, config, couplingSite()),
  facts: (variant, config) => couplingFacts(variant, config, couplingSite()), decisions: COUPLING_DECISIONS,
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
  doorToggle: (_variant, config) => { const l = tunnelCouplingLayout(config, tunnelCouplingSite()); return l.tl.doors.some(d => l.pieces.includes(d.piece)) ? 'Doors open' : null; },
  layerLabels: { hardware: 'Latches, bolts, feet & screws', environment: 'Grass & slabs' },
  defaults: TUNNEL_COUPLING_DEFAULT, controls: TUNNEL_COUPLING_CONTROLS, parse: parseTunnelCoupling,
  validate: (variant, config) => validateTunnelCoupling(variant, config, tunnelCouplingSite()),
  steps: (variant, config) => tunnelCouplingSteps(variant, config, tunnelCouplingSite()),
  build: (variant, config) => createTunnelCouplingScene(variant, config, tunnelCouplingSite()),
  bom: (variant, config) => tunnelCouplingBom(variant, config, tunnelCouplingSite()),
  views: (variant, config) => tunnelCouplingViews(variant, config, tunnelCouplingSite()),
  facts: (variant, config) => tunnelCouplingFacts(variant, config, tunnelCouplingSite()), decisions: TUNNEL_COUPLING_DECISIONS, drawings: () => [portTemplateDrawing(tunnelSite().w)],
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

/** The standard port's marking template (catioPort.ts `portTemplate`), for the pages whose elements end in it. */
export function portTemplateDrawing(s: number): SubassemblyDrawing {
  return { id: 'port-template', title: 'Standard port marking template', filename: `port-template-${s}.svg`, svg: portTemplateSvg(s),
    caption: `1:1, in millimetres: cut it from 6 mm plywood and mark and pre-drill every ring from it, face out (the bolt holes, and the latch stations at the notches). Every port is then the same, and any one fits any other at any quarter turn.` };
}
