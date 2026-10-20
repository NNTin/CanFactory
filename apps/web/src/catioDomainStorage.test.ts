import { afterEach, describe, expect, it } from 'vitest';
import {
  COUPLING_DEFAULT, couplingBom, couplingFacts, couplingLayout, couplingSteps, couplingViews, enclosureLayout, MODULAR_DEFAULT, TUNNEL_COUPLING_DEFAULT, TUNNEL_DEFAULT, tunnelBom, tunnelCouplingBom, tunnelCouplingLayout, tunnelCouplingSteps, tunnelFacts,
  tunnelLayout, tunnelSiteFor, tunnelSteps, tunnelViews, validateCoupling, validateModular, validateTunnel, validateTunnelCoupling,
  validateWindowInsert, WINDOW_INSERT_DEFAULT, windowFor, windowInsertBom, windowInsertLayout, windowInsertSteps, type CouplingSite,
} from '@canfactory/catio';

/** Everything the planner evaluates, from explicit inputs alone. */
function evaluateAll() {
  const window = windowFor('modular', WINDOW_INSERT_DEFAULT, MODULAR_DEFAULT);
  const site = tunnelSiteFor(WINDOW_INSERT_DEFAULT, MODULAR_DEFAULT);
  const coupling: CouplingSite = { tunnel: TUNNEL_DEFAULT, site, joint: TUNNEL_COUPLING_DEFAULT };
  const sections = { tunnel: TUNNEL_DEFAULT, site };
  return JSON.stringify([
    windowInsertLayout('modular', WINDOW_INSERT_DEFAULT, window), windowInsertBom('modular', WINDOW_INSERT_DEFAULT, window),
    windowInsertSteps('modular', WINDOW_INSERT_DEFAULT, window), validateWindowInsert('modular', WINDOW_INSERT_DEFAULT, window),
    tunnelLayout(TUNNEL_DEFAULT, site, TUNNEL_COUPLING_DEFAULT), tunnelBom('modular', TUNNEL_DEFAULT, site, TUNNEL_COUPLING_DEFAULT),
    tunnelSteps('modular', TUNNEL_DEFAULT, site, TUNNEL_COUPLING_DEFAULT), tunnelFacts('modular', TUNNEL_DEFAULT, site, TUNNEL_COUPLING_DEFAULT),
    tunnelViews('modular', TUNNEL_DEFAULT, site, TUNNEL_COUPLING_DEFAULT), validateTunnel('modular', TUNNEL_DEFAULT, site, TUNNEL_COUPLING_DEFAULT),
    couplingLayout(COUPLING_DEFAULT, coupling), couplingBom('modular', COUPLING_DEFAULT, coupling), couplingSteps('modular', COUPLING_DEFAULT, coupling),
    couplingFacts('modular', COUPLING_DEFAULT, coupling), couplingViews('modular', COUPLING_DEFAULT, coupling), validateCoupling('modular', COUPLING_DEFAULT, coupling),
    tunnelCouplingLayout(TUNNEL_COUPLING_DEFAULT, sections), tunnelCouplingBom('modular', TUNNEL_COUPLING_DEFAULT, sections),
    tunnelCouplingSteps('modular', TUNNEL_COUPLING_DEFAULT, sections), validateTunnelCoupling('modular', TUNNEL_COUPLING_DEFAULT, sections),
    validateModular(MODULAR_DEFAULT),
    enclosureLayout({ width: 1200, depth: 1000, height: 1200 }, { id: 'a', tunnelSize: MODULAR_DEFAULT.tunnelSize, connected: { rear: true, left: false, right: false } }),
  ]);
}

describe('@canfactory/catio without saved settings', () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  afterEach(() => {
    if (descriptor) Object.defineProperty(globalThis, 'localStorage', descriptor); else Reflect.deleteProperty(globalThis, 'localStorage');
  });

  it('evaluates every layout, parts list and check with no localStorage global defined', () => {
    Reflect.deleteProperty(globalThis, 'localStorage');
    expect('localStorage' in globalThis).toBe(false);
    expect(() => evaluateAll()).not.toThrow();
  });

  it('never reads the storage, even when it holds settings of every page', () => {
    let reads = 0;
    const saved = JSON.stringify({ version: 1, variant: 'modular', config: { ...TUNNEL_DEFAULT, sectionLength: 1, mechanism: 'bolts', attachment: 'spreader-feet' } });
    const storage = { getItem: () => { reads++; return saved; }, setItem: () => { reads++; }, removeItem: () => { reads++; }, clear: () => { reads++; }, key: () => null, length: 1 };
    const without = (Reflect.deleteProperty(globalThis, 'localStorage'), evaluateAll());
    Object.defineProperty(globalThis, 'localStorage', { get: () => { reads++; return storage; }, configurable: true });
    // the same results with storage present as without it, and not one access to it
    expect(evaluateAll()).toBe(without);
    expect(reads).toBe(0);
  });
});
