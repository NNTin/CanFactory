import { describe, expect, it } from 'vitest';
import { clearOf, fastenerClashes } from './catioSubassembly.ts';
import { CATIO_SUBASSEMBLY_ENTRIES, dependentsOf } from './catioSubassemblies.ts';
import { COUPLING_DEFAULT, couplingBom, couplingLayout } from './catioCoupling.ts';
import { TUNNEL_CONTROLS, TUNNEL_DEFAULT, tunnelBom, tunnelLayout, tunnelSite, type TunnelConfig, type TunnelSite } from './catioTunnel.ts';
import { TUNNEL_COUPLING_CONTROLS, TUNNEL_COUPLING_DEFAULT, tunnelCouplingBom, tunnelCouplingLayout, type TunnelCouplingConfig } from './catioTunnelCoupling.ts';
import { WINDOW_INSERT_CONTROLS, WINDOW_INSERT_DEFAULT, windowInsertLayout, type WindowInsertConfig } from './catioWindowInsert.ts';

const base = tunnelSite();
const withInsert = (insert: WindowInsertConfig): TunnelSite => ({ ...base, insert, floorZ: windowInsertLayout('modular', insert, base.window).floor });
/** What a page builds from the other pages' settings: anything a followed setting changes shows up here. */
const builds = {
  tunnel: (site: TunnelSite, joint: TunnelCouplingConfig = TUNNEL_COUPLING_DEFAULT) => {
    const l = tunnelLayout(TUNNEL_DEFAULT, site, joint);
    return JSON.stringify([l.S, l.pieces, l.couplings, l.supports, tunnelBom('modular', TUNNEL_DEFAULT, site, joint), l.errors]);
  },
  tunnelCoupling: (tunnel: TunnelConfig, site: TunnelSite = base, config: TunnelCouplingConfig = TUNNEL_COUPLING_DEFAULT) => {
    const l = tunnelCouplingLayout(config, { tunnel, site });
    return JSON.stringify([l.before, l.after, l.coupling, l.support, l.tl.pad, l.tl.members.filter(m => l.pieces.includes(m.piece)), tunnelCouplingBom('modular', config, { tunnel, site }), l.errors]);
  },
  coupling: (site: TunnelSite, tunnel: TunnelConfig = TUNNEL_DEFAULT) => {
    const l = couplingLayout(COUPLING_DEFAULT, { tunnel, site });
    return JSON.stringify([l.frame, l.fasteners, l.floor, couplingBom('modular', COUPLING_DEFAULT, { tunnel, site }), l.errors]);
  },
};

describe('catio pages that follow each other', () => {
  it('declares exactly the window insert settings that change each page fitted to it', () => {
    const follows = (page: 'tunnel' | 'insert-tunnel-coupling') => CATIO_SUBASSEMBLY_ENTRIES[page].follows.find(f => f.page === 'window-insert')?.settings ?? [];
    for (const [page, build] of [['tunnel', builds.tunnel], ['insert-tunnel-coupling', (s: TunnelSite) => builds.coupling(s)]] as const) {
      // the default printed pad keeps the 32 mm Ganter foot's gap, so the choice of feet shows only with another pad height; the
      // diameter changes the gap only with the Ganter feet, whose height grows with it
      for (const control of WINDOW_INSERT_CONTROLS) {
        const values = control.range ? [control.range.min, control.range.max] : control.options.map(option => option.value);
        const changes = [WINDOW_INSERT_DEFAULT, { ...WINDOW_INSERT_DEFAULT, padHeight: 30 }, { ...WINDOW_INSERT_DEFAULT, clampPad: 'ganter' as const }].some(base => {
          const reference = build(withInsert(base));
          return values.some(value => build(withInsert({ ...base, [control.key]: value })) !== reference);
        });
        expect(changes, `${page} · ${control.key}`).toBe(follows(page).includes(control.key));
      }
    }
  });

  it('declares exactly the window insert settings that change the tunnel–tunnel coupling: none, it stands at its own height', () => {
    expect(CATIO_SUBASSEMBLY_ENTRIES['tunnel-tunnel-coupling'].follows.some(f => f.page === 'window-insert')).toBe(false);
    const reference = builds.tunnelCoupling(TUNNEL_DEFAULT, withInsert(WINDOW_INSERT_DEFAULT));
    for (const control of WINDOW_INSERT_CONTROLS) for (const value of control.range ? [control.range.min, control.range.max] : control.options.map(option => option.value)) {
      expect(builds.tunnelCoupling(TUNNEL_DEFAULT, withInsert({ ...WINDOW_INSERT_DEFAULT, [control.key]: value })), control.key).toBe(reference);
    }
  });

  it('declares exactly the tunnel–tunnel coupling settings that change the tunnel, and the tunnel settings that change the coupling', () => {
    // the tunnel follows the coupling's mechanism at every section and collar coupling (and its bolts at the enclosure end)
    const followed = CATIO_SUBASSEMBLY_ENTRIES.tunnel.follows.find(f => f.page === 'tunnel-tunnel-coupling')?.settings ?? [];
    const reference = builds.tunnel(base);
    for (const control of TUNNEL_COUPLING_CONTROLS) {
      const changes = control.options.some(option => builds.tunnel(base, { ...TUNNEL_COUPLING_DEFAULT, [control.key]: option.value }) !== reference);
      expect(changes, `tunnel · ${control.key}`).toBe(followed.includes(control.key));
    }
    // the coupling page is built from the tunnel's sections, one of its supports and its feet and ground
    const follows = CATIO_SUBASSEMBLY_ENTRIES['tunnel-tunnel-coupling'].follows.find(f => f.page === 'tunnel')?.settings ?? [];
    for (const mechanism of ['printed-latch', 'bolts'] as const) {
      const config = { ...TUNNEL_COUPLING_DEFAULT, mechanism };
      const own = builds.tunnelCoupling(TUNNEL_DEFAULT, base, config);
      for (const control of TUNNEL_CONTROLS) {
        const values = control.range ? [control.range.min, control.range.max] : control.options.map(option => option.value);
        const changes = values.some(value => builds.tunnelCoupling({ ...TUNNEL_DEFAULT, [control.key]: value }, base, config) !== own)
          // the printed feet's sole changes only them, and the Ganter feet's diameter only with the Ganter feet
          || values.some(value => builds.tunnelCoupling({ ...TUNNEL_DEFAULT, footPad: 'ganter', [control.key]: value }, base, config) !== builds.tunnelCoupling({ ...TUNNEL_DEFAULT, footPad: 'ganter' }, base, config));
        expect(changes, `tunnel–tunnel coupling (${mechanism}) · ${control.key}`).toBe(follows.includes(control.key));
      }
    }
  });

  it('only shows the tunnel on the coupling page: no tunnel setting changes the coupling’s parts', () => {
    expect(CATIO_SUBASSEMBLY_ENTRIES['insert-tunnel-coupling'].follows.find(f => f.page === 'tunnel')?.settings).toEqual([]);
    const reference = builds.coupling(base);
    for (const control of TUNNEL_CONTROLS.filter(c => !c.range)) for (const option of control.options) {
      expect(builds.coupling(base, { ...TUNNEL_DEFAULT, [control.key]: option.value }), `${control.key} ${String(option.value)}`).toBe(reference);
    }
  });

  it('finds the pages fitted to each page, with the settings they follow', () => {
    expect(dependentsOf('window-insert')).toEqual([
      { page: 'tunnel', settings: ['attachment', 'clampPad', 'padHeight', 'footDiameter'] },
      { page: 'insert-tunnel-coupling', settings: ['meshFixing', 'fixingPitch', 'attachment', 'clampPad', 'padHeight', 'footDiameter'] },
    ]);
    expect(dependentsOf('tunnel')).toEqual([
      { page: 'insert-tunnel-coupling', settings: [] },
      { page: 'tunnel-tunnel-coupling', settings: ['sectionLength', 'footPad', 'padHeight', 'padSurface', 'footDiameter', 'groundFall', 'groundTolerance'] },
    ]);
    expect(dependentsOf('insert-tunnel-coupling')).toEqual([]);
    expect(dependentsOf('tunnel-tunnel-coupling')).toEqual([{ page: 'tunnel', settings: ['mechanism', 'latchesPerSide', 'boltsPerCoupling', 'seal'] }]);
    for (const entry of Object.values(CATIO_SUBASSEMBLY_ENTRIES)) {
      for (const f of entry.follows) for (const key of f.settings) expect(CATIO_SUBASSEMBLY_ENTRIES[f.page].label(key), `${entry.id} → ${f.page}.${key}`).not.toBe(key);
      // without storage every page reads the others' defaults, which fit
      expect(entry.savedErrors(), entry.id).toEqual([]);
    }
  });
});

describe('fasteners clear of each other', () => {
  it('moves only the positions too close to one already there, to the nearest clear spot in range', () => {
    expect(clearOf([0, 100, 200], [100], 12, 0, 200)).toEqual([0, 88, 200]);
    expect(clearOf([0, 100, 200], [95, 105], 12, 0, 200)).toEqual([0, 83, 200]);
    expect(clearOf([0], [5], 12, 0, 200)).toEqual([17]);
    expect(clearOf([0], [0], 12, 0, 5)).toEqual([0]); // no clear spot: left for the check to report
  });

  it('measures across the driving direction, not along it', () => {
    const screw = { at: [0, 0, 0] as [number, number, number], direction: [0, -1, 0] as [number, number, number] };
    expect(fastenerClashes([screw], [{ at: [0, -40, 5] }], 12)).toHaveLength(1);
    expect(fastenerClashes([screw], [{ at: [12, -40, 0] }], 12)).toHaveLength(0);
  });
});
