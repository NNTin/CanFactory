import { describe, expect, it } from 'vitest';
import { clearOf, fastenerClashes } from './catioSubassembly.ts';
import { CATIO_SUBASSEMBLY_ENTRIES, dependentsOf } from './catioSubassemblies.ts';
import { COUPLING_DEFAULT, couplingBom, couplingLayout } from './catioCoupling.ts';
import { TUNNEL_CONTROLS, TUNNEL_DEFAULT, tunnelBom, tunnelLayout, tunnelSite, type TunnelConfig, type TunnelSite } from './catioTunnel.ts';
import { WINDOW_INSERT_CONTROLS, WINDOW_INSERT_DEFAULT, windowInsertLayout, type WindowInsertConfig } from './catioWindowInsert.ts';

const base = tunnelSite();
const withInsert = (insert: WindowInsertConfig): TunnelSite => ({ ...base, insert, floorZ: windowInsertLayout('modular', insert, base.window).floor });
/** What a page builds from the other pages' settings: anything a followed setting changes shows up here. */
const builds = {
  tunnel: (site: TunnelSite) => { const l = tunnelLayout(TUNNEL_DEFAULT, site); return JSON.stringify([l.S, l.supports, tunnelBom('modular', TUNNEL_DEFAULT, site), l.errors]); },
  coupling: (site: TunnelSite, tunnel: TunnelConfig = TUNNEL_DEFAULT) => {
    const l = couplingLayout(COUPLING_DEFAULT, { tunnel, site });
    return JSON.stringify([l.frame, l.fasteners, l.floor, couplingBom('modular', COUPLING_DEFAULT, { tunnel, site }), l.errors]);
  },
};

describe('catio pages that follow each other', () => {
  it('declares exactly the window insert settings that change each page fitted to it', () => {
    const follows = (page: 'tunnel' | 'insert-tunnel-coupling') => CATIO_SUBASSEMBLY_ENTRIES[page].follows.find(f => f.page === 'window-insert')?.settings ?? [];
    for (const [page, build] of [['tunnel', builds.tunnel], ['insert-tunnel-coupling', (s: TunnelSite) => builds.coupling(s)]] as const) {
      const reference = build(withInsert(WINDOW_INSERT_DEFAULT));
      for (const control of WINDOW_INSERT_CONTROLS) {
        const changes = control.options.some(option => build(withInsert({ ...WINDOW_INSERT_DEFAULT, [control.key]: option.value })) !== reference);
        expect(changes, `${page} · ${control.key}`).toBe(follows(page).includes(control.key));
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
      { page: 'tunnel', settings: ['attachment', 'footDiameter'] },
      { page: 'insert-tunnel-coupling', settings: ['meshFixing', 'fixingPitch', 'attachment', 'footDiameter'] },
    ]);
    expect(dependentsOf('tunnel')).toEqual([{ page: 'insert-tunnel-coupling', settings: [] }]);
    expect(dependentsOf('insert-tunnel-coupling')).toEqual([]);
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
