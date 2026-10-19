import {
  COUPLING_DEFAULT, isKind, MODULAR_DEFAULT, parseCoupling, parseProject, parseTunnel, parseTunnelCoupling, parseWindowInsert, TUNNEL_COUPLING_DEFAULT,
  TUNNEL_DEFAULT, tunnelSiteFor, WINDOW_INSERT_DEFAULT, windowFor, type CatioMode, type CouplingSite, type ModularConfig, type TunnelCouplingSite,
  type TunnelSite, type WindowProfile, type WindowSpec,
} from '@canfactory/catio';
import { browserStorage, PLANNER_STORAGE_KEY } from './catioPlannerSaved.ts';
import { loadSubassemblyConfig } from './catioSubassembly.ts';

/**
 * The sub-assemblies' settings as their pages saved them (or their defaults), for the pages and scenes that show one sub-assembly
 * fitted to the others. `@canfactory/catio` never reads saved settings: the pages resolve them here and pass them in.
 */
const savedWindowInsert = () => loadSubassemblyConfig('window-insert', parseWindowInsert, WINDOW_INSERT_DEFAULT);
export const savedTunnel = () => loadSubassemblyConfig('tunnel', parseTunnel, TUNNEL_DEFAULT);
export const savedTunnelCoupling = () => loadSubassemblyConfig('tunnel-tunnel-coupling', parseTunnelCoupling, TUNNEL_COUPLING_DEFAULT);
export const savedCoupling = () => loadSubassemblyConfig('insert-tunnel-coupling', parseCoupling, COUPLING_DEFAULT);

let read: { text: string | null; ports: ModularConfig } | null = null;
/**
 * The window's sizes and the cat ports' settings of the planner's project in this browser: its first window's params, its closure and
 * door seat. A new project's (the defaults) when none is saved or it cannot be read. Parsed once per saved text.
 */
function plannerCatPorts(): ModularConfig {
  let text: string | null = null;
  try { text = browserStorage().getItem(PLANNER_STORAGE_KEY); } catch { /* A browser without storage has the defaults. */ }
  if (read?.text === text) return read.ports;
  const parsed = text === null ? null : parseProject(text);
  const project = parsed?.ok ? parsed.project : null;
  const window = project?.instances.find(isKind('window'));
  const ports = project ? { ...MODULAR_DEFAULT, ...window?.params, portClosure: project.settings.portClosure, doorSeat: project.settings.doorSeat } : MODULAR_DEFAULT;
  read = { text, ports };
  return ports;
}

/** The window for a variant: with tunnel, the planner project's window and cat ports. */
export const savedWindow = (variant: CatioMode, profile: WindowProfile): WindowSpec => windowFor(variant, profile, plannerCatPorts());

/** The saved window insert in the planner project's window. */
export const tunnelSite = (): TunnelSite => tunnelSiteFor(savedWindowInsert(), plannerCatPorts());
export const couplingSite = (): CouplingSite => ({ tunnel: savedTunnel(), site: tunnelSite(), joint: savedTunnelCoupling() });
export const tunnelCouplingSite = (): TunnelCouplingSite => ({ tunnel: savedTunnel(), site: tunnelSite() });
