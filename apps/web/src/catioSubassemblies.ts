import type { CatioSubassembly } from './route.ts';
import type { SubassemblyDefinition } from './catioSubassembly.ts';
import { createWindowInsertScene } from './catioWindowInsertScene.ts';
import { createTunnelScene } from './catioTunnelScene.ts';
import {
  parseTunnel, TUNNEL_CONTROLS, TUNNEL_PRESETS, TUNNEL_DECISIONS, TUNNEL_DEFAULT, tunnelBom, tunnelFacts, tunnelSteps, tunnelViews, validateTunnel, type TunnelConfig,
} from './catioTunnel.ts';
import {
  parseWindowInsert, validateWindowInsert, WINDOW_INSERT_CONTROLS, WINDOW_INSERT_DECISIONS, WINDOW_INSERT_DEFAULT, windowInsertBom, windowInsertFacts,
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
  viewLabels: { Interior: 'Along the tunnel', Side: 'Side · the climb', Top: 'Top · the turns', Mounting: 'Support detail' },
  toggles: { cutaway: 'Wall cutaway' }, layerLabels: { hardware: 'Bolts, feet & fixings', environment: 'Ground, wall & slabs' },
  defaults: TUNNEL_DEFAULT, presets: TUNNEL_PRESETS, controls: TUNNEL_CONTROLS, parse: parseTunnel,
  validate: (variant, config) => validateTunnel(variant, config),
  steps: tunnelSteps, build: createTunnelScene, bom: (variant, config) => tunnelBom(variant, config),
  views: tunnelViews, facts: tunnelFacts, decisions: TUNNEL_DECISIONS,
};

/** Every sub-assembly page, for links and breadcrumbs. The enclosure is next; `CatioSubassemblyRoute` picks the definition. */
export const CATIO_SUBASSEMBLY_TITLES: Record<CatioSubassembly, string> = { 'window-insert': windowInsertDefinition.title, tunnel: tunnelDefinition.title };
