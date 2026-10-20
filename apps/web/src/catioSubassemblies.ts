import type { SubassemblyDefinition, SubassemblyDrawing } from './catioSubassembly.ts';
import { createWindowInsertScene } from './catioWindowInsertScene.ts';
import { createTunnelScene } from './catioTunnelScene.ts';
import { createCouplingScene } from './catioCouplingScene.ts';
import { createTunnelCouplingScene } from './catioTunnelCouplingScene.ts';
import {
  COUPLING_DECISIONS, couplingBom, couplingFacts, couplingSteps, couplingViews, insertCouplingSubject, portTemplateSvg, TUNNEL_COUPLING_CONTROLS,
  TUNNEL_COUPLING_DECISIONS, TUNNEL_DECISIONS, tunnelBom, tunnelCouplingBom, tunnelCouplingFacts, tunnelCouplingLayout, tunnelCouplingSteps,
  tunnelCouplingSubject, tunnelCouplingViews, tunnelFacts, tunnelSteps, tunnelSubject, tunnelViews, validateCoupling, validateTunnel,
  validateTunnelCoupling, validateWindowInsert, WINDOW_INSERT_DECISIONS, windowInsertBom, windowInsertFacts, windowInsertSteps,
  windowInsertSubject, windowInsertViews, type CatioSubassembly, type CouplingConfig, type CouplingSite, type TunnelConfig,
  type TunnelCouplingConfig, type TunnelCouplingSite, type TunnelSubjectSite, type WindowInsertConfig, type WindowSpec,
} from '@canfactory/catio';

// Each view shows one instance of the project, fitted to the rest of it: its subject (catioProjectDetail.ts) is the project's, and the
// sub-assembly's own functions are given it. Every instance is built with tunnel.
const M = 'modular';

export const windowInsertDefinition: SubassemblyDefinition<WindowInsertConfig, WindowSpec> = {
  id: 'window-insert', title: 'Window insert', eyebrow: 'CATIO SUB-ASSEMBLY · WINDOW INSERT',
  heading: 'Held by the window, not fixed to it.', briefLabel: 'THE INSERT', assemblyHeading: 'From the bench to the window.',
  summary: 'The removable timber collar that sits in the exterior recess: its pieces, the joints between them, how the mesh is held, and the padded clamps that grip the recess, or the screen hooks that hang it on the window frame, without a single hole in the wall or the window.',
  // the cat port is shut by what the project sets for every cat port, and the view can open it
  doorToggle: () => 'Cat port open',
  subject: windowInsertSubject,
  validate: (config, window) => validateWindowInsert(M, config, window),
  steps: (config, window) => windowInsertSteps(M, config, window),
  build: (config, window) => createWindowInsertScene(M, config, window),
  bom: (config, window) => windowInsertBom(M, config, window),
  views: (config, window) => windowInsertViews(M, config, window),
  facts: (config, window) => windowInsertFacts(M, config, window), decisions: WINDOW_INSERT_DECISIONS,
};

export const tunnelDefinition: SubassemblyDefinition<TunnelConfig, TunnelSubjectSite> = {
  id: 'tunnel', title: 'Tunnel', eyebrow: 'CATIO SUB-ASSEMBLY · TUNNEL',
  heading: 'Standard elements, any height, on any ground.',
  summary: 'The enclosed walkway between two cat ports, built of standard elements: every piece ends in the same port, so any one couples to any other. It turns at side ports and climbs on sloped sections, on supports whose levelling feet take up ground that is not level. Its route is drawn in the planner.',
  briefLabel: 'THE TUNNEL', assemblyHeading: 'From the slabs to the enclosure.', stageScale: 20,
  viewLabels: { Interior: 'Along the tunnel', Side: 'Side · the climb', Top: 'Top · the turns', Mounting: 'Support detail' },
  toggles: { cutaway: 'Wall cutaway' }, layerLabels: { hardware: 'Bolts, feet & fixings', environment: 'Ground, wall & slabs' },
  // the doors of every opening that is not coupled: the end bays' sides (the side access), and a section's start at a turn
  doorToggle: (_config, s) => s.layout.doors.length > 0 ? 'Doors open' : null,
  subject: tunnelSubject,
  validate: (config, s) => validateTunnel(M, config, s.site, s.joint, s.layout),
  steps: (config, s) => tunnelSteps(M, config, s.site, s.joint, s.layout),
  build: (config, s) => createTunnelScene(M, config, s.site, s.joint, s.coupling, s.layout),
  bom: (config, s) => tunnelBom(M, config, s.site, s.joint, s.layout),
  views: (config, s) => tunnelViews(M, config, s.site, s.joint, s.layout),
  facts: (config, s) => tunnelFacts(M, config, s.site, s.joint, s.layout), decisions: TUNNEL_DECISIONS, drawings: (_config, s) => [portTemplateDrawing(s.site.w)],
};

export const couplingDefinition: SubassemblyDefinition<CouplingConfig, CouplingSite> = {
  id: 'insert-tunnel-coupling', title: 'Insert–tunnel coupling', eyebrow: 'CATIO SUB-ASSEMBLY · INSERT–TUNNEL COUPLING',
  heading: 'Two levers to dock, two to let go.',
  summary: 'The joint between the window insert’s cat port and the tunnel’s first flange: a docking frame on the insert, a squashed seal, and toggle latches that join the two without tools, while the tunnel’s own support keeps carrying its weight.',
  briefLabel: 'THE JOINT', assemblyHeading: 'From the port to a docked tunnel.',
  cutawayViews: ['Interior', 'Side', 'Top', 'Mounting'],
  viewLabels: { Side: 'Side · the joint', Mounting: 'Latch detail' },
  toggles: { windowOpen: 'Released · latches open', cutaway: 'Wall cutaway' }, defaultViewing: { windowOpen: false },
  // docked and latched, the window's cat port can be opened from the room
  doorToggle: () => 'Cat port open',
  layerLabels: { hardware: 'Latches, seal & screws', environment: 'Wall & grass' },
  subject: insertCouplingSubject,
  validate: (config, site) => validateCoupling(M, config, site),
  steps: (config, site) => couplingSteps(M, config, site),
  build: (config, site) => createCouplingScene(M, config, site),
  bom: (config, site) => couplingBom(M, config, site),
  views: (config, site) => couplingViews(M, config, site),
  facts: (config, site) => couplingFacts(M, config, site), decisions: COUPLING_DECISIONS,
};

export const tunnelCouplingDefinition: SubassemblyDefinition<TunnelCouplingConfig, TunnelCouplingSite> = {
  id: 'tunnel-tunnel-coupling', title: 'Tunnel–tunnel coupling', eyebrow: 'CATIO SUB-ASSEMBLY · TUNNEL–TUNNEL COUPLING',
  heading: 'One section, then the next.',
  summary: 'How two of the tunnel’s sections are joined, flange to flange, on the support under the joint: printed toggle latches across a sealed gap that close by hand, or M8 bolts through both flanges. Every tunnel of the project couples its sections this way.',
  briefLabel: 'THE JOINT', assemblyHeading: 'From one section to two, coupled.',
  viewLabels: { Interior: 'Along the tunnel', Side: 'Side · the joint', Mounting: 'Latch detail' },
  toggles: { windowOpen: 'Released · latches open' }, defaultViewing: { windowOpen: false },
  doorToggle: (config, site) => { const l = tunnelCouplingLayout(config, site); return l.tl.doors.some(d => l.pieces.includes(d.piece)) ? 'Doors open' : null; },
  layerLabels: { hardware: 'Latches, bolts, feet & screws', environment: 'Grass & slabs' },
  subject: tunnelCouplingSubject, viewControls: TUNNEL_COUPLING_CONTROLS.filter(c => c.key === 'jointShown'),
  validate: (config, site) => validateTunnelCoupling(M, config, site),
  steps: (config, site) => tunnelCouplingSteps(M, config, site),
  build: (config, site) => createTunnelCouplingScene(M, config, site),
  bom: (config, site) => tunnelCouplingBom(M, config, site),
  views: (config, site) => tunnelCouplingViews(M, config, site),
  facts: (config, site) => tunnelCouplingFacts(M, config, site), decisions: TUNNEL_COUPLING_DECISIONS, drawings: (_config, site) => [portTemplateDrawing(site.site.w)],
};

/** Every sub-assembly's view, by its id: the route picks one, the planner's inspector edits their settings. The enclosure is next. */
export const CATIO_SUBASSEMBLY_DEFINITIONS = {
  'window-insert': windowInsertDefinition, 'insert-tunnel-coupling': couplingDefinition, tunnel: tunnelDefinition, 'tunnel-tunnel-coupling': tunnelCouplingDefinition,
} as const satisfies Record<CatioSubassembly, object>;
/** Every sub-assembly's title, for links and breadcrumbs. */
export const CATIO_SUBASSEMBLY_TITLES: Record<CatioSubassembly, string> = {
  'window-insert': windowInsertDefinition.title, 'insert-tunnel-coupling': couplingDefinition.title, tunnel: tunnelDefinition.title,
  'tunnel-tunnel-coupling': tunnelCouplingDefinition.title,
};

/** The standard port's marking template (catioPort.ts `portTemplate`), for the views whose elements end in it. */
export function portTemplateDrawing(s: number): SubassemblyDrawing {
  return { id: 'port-template', title: 'Standard port marking template', filename: `port-template-${s}.svg`, svg: portTemplateSvg(s),
    caption: `1:1, in millimetres: cut it from 6 mm plywood and mark and pre-drill every ring from it, face out (the bolt holes, and the latch stations at the notches). Every port is then the same, and any one fits any other at any quarter turn.` };
}
