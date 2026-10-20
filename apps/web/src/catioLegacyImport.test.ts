import { describe, expect, it } from 'vitest';
import {
  COUPLING_DEFAULT, evaluateProject, isKind, parseProject, serializeProject, TUNNEL_COUPLING_DEFAULT, TUNNEL_DEFAULT, WINDOW_INSERT_DEFAULT,
  type EvaluatedTunnel, type Project,
} from '@canfactory/catio';
import { importLegacyCatio, LEGACY_CATIO_KEY, legacyDesign, readLegacySaves } from './catioLegacyImport.ts';

/** The old concept page's whole-catio settings, as each version saved them. */
const CONFIG = {
  glassWidth: 760, glassHeight: 780, sashWidth: 880, sashHeight: 900, enclosure: { width: 1400, depth: 1200, height: 1500 }, second: { width: 1800, depth: 1600, height: 1900 },
  secondEnabled: false, route: 'straight', approach: 2, lateral: 2, final: 1, link: 2,
};
const VIEWS = { direct: { progress: 2, exploded: true, windowOpen: false, cutaway: true, hidden: ['mesh'], view: 'Side', doors: {} }, modular: { progress: 6, exploded: false, windowOpen: true, cutaway: false, hidden: [], view: 'Top', doors: { 'window-cat': false } } };
/** Version 1: no closure (every port a sliding gate), the tunnel's clear width and height. */
const v1 = (config: object = {}) => ({ version: 1, mode: 'modular', config: { ...CONFIG, tunnelWidth: 350, tunnelHeight: 300, ...config }, views: VIEWS });
/** Version 2: the closure chosen, still the tunnel's width and height. */
const v2 = (config: object = {}) => ({ version: 2, mode: 'modular', config: { ...CONFIG, tunnelWidth: 280, tunnelHeight: 320, portClosure: 'removable-panel', ...config }, views: VIEWS });
/** Version 3: one square clear size, and the doors' seat. */
const v3 = (config: object = {}) => ({ version: 3, mode: 'modular', config: { ...CONFIG, tunnelSize: 300, portClosure: 'removable-panel', doorSeat: 'rebate', ...config }, views: VIEWS });
const page = (config: object, views: object = { modular: { progress: 3, doorOpen: false } }) => JSON.stringify({ version: 1, variant: 'modular', config, views });

/** A storage holding `entries`, that counts and forbids writes. */
function storage(entries: Record<string, string>) {
  const store = new Map(Object.entries(entries));
  const writes: string[] = [];
  return {
    store, writes,
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string) => { writes.push(key); }, removeItem: (key: string) => { writes.push(key); },
  };
}
const imported = (entries: Record<string, string>): { project: Project; notes: string[] } => {
  const result = importLegacyCatio(storage(entries));
  if (result.kind !== 'imported') throw new Error(JSON.stringify(result));
  return result;
};
const tunnels = (project: Project) => evaluateProject(project).instances.filter((e): e is EvaluatedTunnel => e.kind === 'tunnel');

describe('legacy catio import (FR-08.5)', () => {
  it('reads each version’s settings as one design: v1 sliding gates, the larger of the tunnel’s width and height, stop strips before the seat', () => {
    expect(legacyDesign(v1())).toMatchObject({ portClosure: 'sliding-gate', doorSeat: 'stops', window: { tunnelSize: 350, glassWidth: 760 }, route: 'straight', second: null });
    expect(legacyDesign(v2())).toMatchObject({ portClosure: 'removable-panel', doorSeat: 'stops', window: { tunnelSize: 320 } });
    expect(legacyDesign(v3())).toMatchObject({ portClosure: 'removable-panel', doorSeat: 'rebate', window: { tunnelSize: 300 }, enclosure: CONFIG.enclosure });
    // a version 1 design keeps its gates even where it names another closure; a later one keeps what it chose
    expect(legacyDesign(v1({ portClosure: 'removable-panel' }))?.portClosure).toBe('sliding-gate');
    expect(legacyDesign(v3({ portClosure: 'sliding-gate' }))?.portClosure).toBe('sliding-gate');
    // not a design: another version, missing sizes, a closure or route it never had, modules out of range
    for (const bad of [{ version: 4, config: CONFIG }, { version: 3 }, v3({ glassWidth: 'wide' }), v3({ enclosure: null }), v3({ portClosure: 'curtain' }), v3({ route: 'up' }), v3({ approach: 0 }), [], null])
      expect(legacyDesign(bad), JSON.stringify(bad)).toBeNull();
  });

  it('makes nothing when nothing was saved, and fails, keeping the old data, when it cannot be read', () => {
    expect(importLegacyCatio(storage({}))).toEqual({ kind: 'none' });
    // only settings another page shared into a page's storage: no page's own save
    expect(importLegacyCatio(storage({ 'canfactory.catio.tunnel.v1': JSON.stringify({ version: 1, config: { supportFixing: 'strap' } }) }))).toEqual({ kind: 'none' });
    for (const text of ['{oops', JSON.stringify({ version: 9, config: CONFIG })]) {
      const s = storage({ [LEGACY_CATIO_KEY]: text });
      expect(importLegacyCatio(s).kind).toBe('failed');
      expect(s.store.get(LEGACY_CATIO_KEY)).toBe(text);
    }
  });

  it.each([['v1', v1()], ['v2', v2()], ['v3', v3()]] as const)('imports a %s catio into a new, valid project, leaving the old saves untouched', (_version, saved) => {
    const entries = {
      [LEGACY_CATIO_KEY]: JSON.stringify(saved),
      'canfactory.catio.window-insert.v1': page({ ...WINDOW_INSERT_DEFAULT, footDiameter: 40, mesh: 'welded' }),
      'canfactory.catio.tunnel.v1': page({ ...TUNNEL_DEFAULT, footPad: 'ganter', maxSlope: 15 }),
      'canfactory.catio.insert-tunnel-coupling.v1': page({ ...COUPLING_DEFAULT, latchesPerSide: 2 }),
      'canfactory.catio.tunnel-tunnel-coupling.v1': page({ ...TUNNEL_COUPLING_DEFAULT, mechanism: 'bolts', supportFixing: 'strap' }),
    };
    const s = storage(entries);
    const result = importLegacyCatio(s);
    if (result.kind !== 'imported') throw new Error(JSON.stringify(result));
    const { project } = result;
    // nothing written or removed: the old saves stay as they were
    expect(s.writes).toEqual([]); expect(Object.fromEntries(s.store)).toEqual(entries);
    // a project the planner opens as it is, under its own id
    expect(parseProject(serializeProject(project))).toEqual({ ok: true, project });
    expect(project.id).toBe('imported-catio'); expect(project.revision).toBe(0);
    const design = legacyDesign(saved); if (!design) throw new Error('design');
    const window = project.instances.find(isKind('window'));
    expect(window?.params).toEqual(design.window);
    expect(project.settings).toMatchObject({ portClosure: design.portClosure, doorSeat: design.doorSeat, mesh: 'welded' });
    expect(project.settings.insert.footDiameter).toBe(40); expect(project.settings.insertCoupling.latchesPerSide).toBe(2);
    expect(project.settings.tunnelCoupling).toMatchObject({ mechanism: 'bolts', supportFixing: 'strap' });
    expect(project.ports.every(p => p.interface.size === design.window.tunnelSize)).toBe(true);
    // the enclosure at the end of the window's tunnel, the saved modules long, coupled at both ends
    const [enclosure] = project.instances.filter(isKind('enclosure'));
    expect(enclosure?.params).toEqual(design.enclosure);
    const [tunnel] = tunnels(project);
    expect(tunnel?.layout?.pieces.length).toBeGreaterThan(0);
    const t = project.instances.find(isKind('tunnel'));
    expect(t?.params.route.reduce((n, e) => n + e.modules, 0)).toBe(design.approach);
    expect(t?.params).toMatchObject({ footPad: 'ganter', maxSlope: 15 });
    expect(tunnel?.ends.start.owner).toBe(window?.id); expect(tunnel?.ends.end.owner).toBe(enclosure?.id);
    const issues = evaluateProject(project).issues.filter(i => i.severity === 'error' && (i.kind === 'connection' || i.kind === 'geometry'));
    expect(issues).toEqual([]);
  });

  it('lays an offset route out with two side-port turns, to the side it was saved to, and links a second enclosure from A’s right-hand port', () => {
    const sideOf = (route: 'left' | 'right') => {
      const { project } = imported({ [LEGACY_CATIO_KEY]: JSON.stringify(v3({ route, approach: 1, lateral: 2, final: 3, secondEnabled: true, link: 3 })) });
      const world = new Map(evaluateProject(project).instances.map(e => [e.id, e.world]));
      const w = project.instances.find(isKind('window')); const [a, b] = project.instances.filter(isKind('enclosure'));
      const main = project.instances.find(i => i.kind === 'tunnel' && i.id === 'tunnel-1');
      const link = project.instances.filter(isKind('tunnel')).find(i => i.id !== 'tunnel-1');
      expect(main?.kind === 'tunnel' && main.params.route.map(e => [e.kind, e.modules])).toEqual([['straight', 1], ['turn', 1], ['straight', 1], ['straight', 1], ['turn', 1], ['straight', 1], ['straight', 1], ['straight', 1]]);
      expect(link?.params.route.reduce((n, e) => n + e.modules, 0)).toBe(3);
      expect(b?.params).toEqual({ width: 1800, depth: 1600, height: 1900 });
      // every end coupled, the garden grown round it all, nothing outside it
      expect(project.ports.filter(p => p.state === 'open')).toEqual([]);
      expect(project.connections).toHaveLength(4);
      expect(evaluateProject(project).issues.filter(i => i.severity === 'error' && i.kind !== 'input')).toEqual([]);
      const ax = world.get(a?.id ?? '')?.x ?? NaN; const bx = world.get(b?.id ?? '')?.x ?? NaN;
      // B beside A, along the wall, on A's right (+X, seen from the room looking out)
      expect(bx).toBeGreaterThan(ax);
      return ax - (world.get(w?.id ?? '')?.x ?? NaN);
    };
    // right, seen from the room looking out, is +X (the old page's frame and the planner's alike)
    expect(sideOf('right')).toBeGreaterThan(500); expect(sideOf('left')).toBeLessThan(-500);
  });

  it('keeps the sliding gates of a page saved before the closure could be chosen, when the whole catio was never saved', () => {
    const before = page(TUNNEL_DEFAULT, { modular: { progress: 6 } });
    const { project, notes } = imported({ 'canfactory.catio.tunnel.v1': before });
    expect(project.settings.portClosure).toBe('sliding-gate'); expect(notes.join(' ')).toMatch(/before the cat ports’ closure could be chosen/);
    // a page saved since, which says whether its door is open: today's default
    expect(imported({ 'canfactory.catio.tunnel.v1': page(TUNNEL_DEFAULT) }).project.settings.portClosure).toBe('removable-panel');
    // the whole catio's settings decide when they are there
    expect(imported({ 'canfactory.catio.tunnel.v1': before, [LEGACY_CATIO_KEY]: JSON.stringify(v3()) }).project.settings.portClosure).toBe('removable-panel');
  });

  it('says that a direct design is imported with the modular design’s sizes', () => {
    const { project, notes } = imported({ [LEGACY_CATIO_KEY]: JSON.stringify({ ...v3(), mode: 'direct' }) });
    expect(notes.join(' ')).toMatch(/direct design/);
    expect(project.instances.filter(isKind('enclosure'))[0]?.params).toEqual(CONFIG.enclosure);
  });

  it('reads the saves only when asked, and only reads them', () => {
    const s = storage({ [LEGACY_CATIO_KEY]: JSON.stringify(v2()) });
    const reads: string[] = [];
    const saves = readLegacySaves({ getItem: key => { reads.push(key); return s.getItem(key); } });
    expect([...reads].sort()).toEqual([LEGACY_CATIO_KEY, ...['window-insert', 'insert-tunnel-coupling', 'tunnel', 'tunnel-tunnel-coupling'].map(id => `canfactory.catio.${id}.v1`)].sort());
    expect(saves.catio).toMatchObject({ portClosure: 'removable-panel' });
  });
});
