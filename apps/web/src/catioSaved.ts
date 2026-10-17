import {
  COUPLING_DEFAULT, parseCoupling, parseTunnel, parseTunnelCoupling, parseWindowInsert, TUNNEL_COUPLING_DEFAULT, TUNNEL_DEFAULT, tunnelSiteFor,
  WINDOW_INSERT_DEFAULT, windowFor, type CatioMode, type CouplingSite, type TunnelCouplingSite, type TunnelSite, type WindowProfile, type WindowSpec,
} from '@canfactory/catio';
import { loadCatioSettings } from './catioSettings.ts';
import { loadSubassemblyConfig } from './catioSubassembly.ts';

/**
 * The sub-assemblies' settings as their pages saved them (or their defaults), for the pages and scenes that show one sub-assembly
 * fitted to the others. `@canfactory/catio` never reads saved settings: the pages resolve them here and pass them in.
 */
export const savedWindowInsert = () => loadSubassemblyConfig('window-insert', parseWindowInsert, WINDOW_INSERT_DEFAULT);
export const savedTunnel = () => loadSubassemblyConfig('tunnel', parseTunnel, TUNNEL_DEFAULT);
export const savedTunnelCoupling = () => loadSubassemblyConfig('tunnel-tunnel-coupling', parseTunnelCoupling, TUNNEL_COUPLING_DEFAULT);
export const savedCoupling = () => loadSubassemblyConfig('insert-tunnel-coupling', parseCoupling, COUPLING_DEFAULT);

/** The window for a variant: with tunnel, in the window and tunnel saved on the catio concept page. */
export const savedWindow = (variant: CatioMode, profile: WindowProfile): WindowSpec => windowFor(variant, profile, loadCatioSettings().config);

/** The saved window insert in the modular window saved on the catio concept page. */
export const tunnelSite = (): TunnelSite => tunnelSiteFor(savedWindowInsert(), loadCatioSettings().config);
export const couplingSite = (): CouplingSite => ({ tunnel: savedTunnel(), site: tunnelSite(), joint: savedTunnelCoupling() });
export const tunnelCouplingSite = (): TunnelCouplingSite => ({ tunnel: savedTunnel(), site: tunnelSite() });
