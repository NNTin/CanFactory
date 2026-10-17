import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { buildDoorPanel } from './catioDoorScene.ts';
import { createCatioParts } from './catioParts.ts';
import type { CatioState } from './catioScene.ts';
import { createModularCatio, type ModularState } from './catioModularScene.ts';
import { CATIO_SETTINGS_VERSION, CATIO_STORAGE_KEY, defaultCatioSettings, loadCatioSettings, migrateCatioSettings, parseCatioSettings, savedBeforeClosure } from './catioSettings.ts';
import { defaultSubassemblySettings, parseSubassemblySettings, saveShared, subassemblyStorageKey } from './catioSubassembly.ts';
import { couplingDefinition, tunnelCouplingDefinition, tunnelDefinition, windowInsertDefinition } from './catioSubassemblies.ts';
import { createCouplingScene } from './catioCouplingScene.ts';
import { createTunnelCouplingScene } from './catioTunnelCouplingScene.ts';
import { createTunnelScene } from './catioTunnelScene.ts';
import { createWindowInsertScene } from './catioWindowInsertScene.ts';
import { COUPLING_DEFAULT, DOOR, DOOR_SEATS, DOOR_TRAVEL, doorBounds, INSERT, insetPanel, MODULAR, MODULAR_DEFAULT, parseTunnel, PORT_CLOSURE_DEFAULT, PORT_CLOSURE_LEGACY, PORT_CLOSURES, PORT_FRAME, setInDoor, slidingGateRise, TUNNEL, TUNNEL_COUPLING_DEFAULT, TUNNEL_DEFAULT, validateModular, WINDOW_INSERT_DEFAULT, windowFor, windowInsertLayout, type DoorPanel, type ModularConfig, type TunnelSite, type WindowInsertConfig, type WindowSpec } from '@canfactory/catio';
import { savedWindow, tunnelSite } from './catioSaved.ts';

/** The cat port sizes the catio concept page allows (20–45 cm each way), and section lengths between the tunnel's flanges. */
const SIZES = [200, 250, 300, 380, 450];
const BAYS = [300, 440, 690, 940];
const faces = SIZES.flatMap(width => SIZES.flatMap(height => DOOR_SEATS.flatMap(seat => (['solid', 'mesh'] as const).map(material => setInDoor({ id: 'p', width, height, material, seat, depth: PORT_FRAME, sealed: material === 'solid', sillButton: material !== 'solid' })))));
const insets = BAYS.flatMap(width => SIZES.map(height => insetPanel({ id: 'a', width, height, cavity: TUNNEL.rail, pivots: { head: 10, sill: TUNNEL.floor + TUNNEL.rail - 10 } })));
const name = (d: DoorPanel) => `${d.fit} ${d.material} ${d.opening.width} × ${d.opening.height}`;
const moving = (d: DoorPanel) => d.timber.filter(t => t.moves).flatMap(t => t.boxes);
const installed: CatioState = { progress: 6, exploded: false, windowOpen: true, cutaway: false, hidden: new Set() };
const bounds = (object: THREE.Object3D) => new THREE.Box3().setFromObject(object, true);
const sliding: ModularConfig = { ...MODULAR_DEFAULT, portClosure: 'sliding-gate' };
const windowWith = (closure: WindowSpec['closure'], config: WindowInsertConfig = WINDOW_INSERT_DEFAULT): WindowSpec => ({ ...windowFor('modular', config, MODULAR_DEFAULT), closure });
const siteWith = (closure: WindowSpec['closure'], insert: WindowInsertConfig = WINDOW_INSERT_DEFAULT): TunnelSite => {
  const window = windowWith(closure, insert);
  return { ...tunnelSite(), insert, window, floorZ: windowInsertLayout('modular', insert, window).floor };
};

describe('removable door panel: button sweep and withdrawal', () => {

  it('draws what it lays out: every piece once, the buttons turning and the panel coming out as one', () => {
    for (const d of [setInDoor({ id: 'p', width: 300, height: 300, material: 'solid', seat: 'stops', depth: PORT_FRAME, sealed: true, sillButton: false, stow: [600, 0, 300] }), ...insets.slice(0, 2), ...faces.filter(f => f.material === 'mesh').slice(0, 1)]) {
      const p = createCatioParts(); const root = new THREE.Group(); p.root.add(root);
      const built = buildDoorPanel(p, d, { origin: [100, 50, 200], u: [1, 0, 0], v: [0, 0, 1], n: [0, -1, 0] }, { timber: root, mesh: root, hardware: root });
      root.updateMatrixWorld(true);
      expect(built.buttons).toHaveLength(d.buttons.length);
      expect(built.fixed).toHaveLength(d.timber.filter(t => !t.moves).length);
      // seated: the panel's timber is where the layout puts it, in the world
      const seated = bounds(built.panel);
      const expected = moving(d).map(b => doorBounds(built.frame, b));
      for (const i of [0, 1, 2] as const) {
        expect(seated.min.getComponent(i), name(d)).toBeCloseTo(Math.min(...expected.map(e => e.min[i])), 6);
        expect(seated.max.getComponent(i), name(d)).toBeCloseTo(Math.max(...expected.map(e => e.max[i])), 6);
      }
      // each button lies over the panel closed, and beside it open
      const overPanel = (b: typeof built.buttons[number]) => { const box = bounds(b.arm); return box.intersectsBox(new THREE.Box3(seated.min.clone().addScalar(-0.5), seated.max.clone().addScalar(0.5))) && box.max.x > seated.min.x + 1 && box.min.x < seated.max.x - 1 && box.max.z > seated.min.z + 1 && box.min.z < seated.max.z - 1; };
      for (const b of built.buttons) expect(overPanel(b), `${name(d)} ${b.button.id} closed`).toBe(true);
      built.set(DOOR_TRAVEL.turned); root.updateMatrixWorld(true);
      for (const b of built.buttons) expect(overPanel(b), `${name(d)} ${b.button.id} open`).toBe(false);
      expect(bounds(built.panel).min.y).toBeCloseTo(seated.min.y, 6);
      // drawn out along the door's n (here −Y), by its withdrawal
      built.set(DOOR_TRAVEL.out); root.updateMatrixWorld(true);
      expect(seated.min.y - bounds(built.panel).min.y).toBeCloseTo(d.withdraw, 6);
      built.set(1); root.updateMatrixWorld(true);
      // set aside where it is stowed, or carried away
      expect(built.panel.children.every(child => child.visible)).toBe(d.stow !== null);
      if (d.stow) expect(bounds(built.panel).min.x - seated.min.x).toBeCloseTo(d.stow[0], 6);
      built.set(0); root.updateMatrixWorld(true);
      expect(built.panel.children.every(child => child.visible)).toBe(true);
      expect(bounds(built.panel).min.toArray().map(x => Math.round(x * 1e6))).toEqual(seated.min.toArray().map(x => Math.round(x * 1e6)));
      p.dispose();
    }
  });

});

describe('cat-port closure: sliding travel only for a sliding gate', () => {

  it('defaults to the removable panel, keeps the sliding gate selectable, and names what a saved design had', () => {
    expect(PORT_CLOSURE_DEFAULT).toBe('removable-panel'); expect(PORT_CLOSURE_LEGACY).toBe('sliding-gate');
    expect([...PORT_CLOSURES]).toEqual(['removable-panel', 'sliding-gate']);
    expect(MODULAR_DEFAULT.portClosure).toBe('removable-panel'); expect(defaultCatioSettings().config.portClosure).toBe('removable-panel');
    expect(validateModular(MODULAR_DEFAULT)).toEqual([]); expect(validateModular(sliding)).toEqual([]);
    expect(validateModular({ ...MODULAR_DEFAULT, portClosure: 'curtain' as ModularConfig['portClosure'] }).join()).toMatch(/Choose a removable panel or a sliding gate/);
    expect(slidingGateRise(300, 40)).toBe(640);
  });

});

describe('saved settings from before the closure could be chosen', () => {
  const without = <T extends object, K extends keyof T>(value: T, ...keys: K[]): Omit<T, K> => Object.fromEntries(Object.entries(value).filter(([key]) => !keys.includes(key as K))) as Omit<T, K>;
  // (saved then with the tunnel's clear width and height, 35 × 30 cm)
  const legacyConfig = { ...without({ ...MODULAR_DEFAULT, route: 'left' as const, approach: 3, secondEnabled: true, second: { width: 1800, depth: 1600, height: 1900 } }, 'portClosure', 'tunnelSize'), tunnelWidth: 350, tunnelHeight: 300 };
  const legacyViews = { direct: { progress: 2, exploded: true, windowOpen: false, cutaway: true, hidden: ['mesh'], view: 'Side', doors: {} }, modular: { progress: 6, exploded: false, windowOpen: true, cutaway: false, hidden: ['environment'], view: 'Top', doors: { 'window-cat': false, 'a-human': true } } };
  const legacy = JSON.stringify({ version: 1, mode: 'modular', config: legacyConfig, views: legacyViews });

  it('keeps a version 1 catio’s dimensions and viewing state, and its sliding gates; its tunnel square at the larger size', () => {
    const settings = parseCatioSettings(legacy);
    expect(settings.version).toBe(CATIO_SETTINGS_VERSION); expect(settings.mode).toBe('modular');
    // a 35 × 30 cm tunnel becomes the standard square port, 35 cm both ways: the cats' opening never shrinks
    expect(settings.config).toEqual({ ...without(legacyConfig, 'tunnelWidth', 'tunnelHeight'), tunnelSize: 350, portClosure: 'sliding-gate' });
    expect(settings.views).toEqual(legacyViews);
    expect(validateModular(settings.config)).toEqual([]);
    // saved again, it stays as migrated: the new default is never applied behind the owner's back
    expect(parseCatioSettings(JSON.stringify(settings))).toEqual(settings);
    // a sliding-only size that only a version 1 design could have keeps working
    expect(parseCatioSettings(JSON.stringify({ version: 1, mode: 'modular', config: { ...legacyConfig, sashHeight: 910 }, views: {} })).config.portClosure).toBe('sliding-gate');
  });

  it('uses the new default only for a fresh or reset design, and still rejects what is not a valid design', () => {
    expect(parseCatioSettings(null).config.portClosure).toBe('removable-panel');
    expect(structuredClone(MODULAR_DEFAULT).portClosure).toBe('removable-panel');
    // a design saved with the choice keeps its choice, either way
    for (const portClosure of PORT_CLOSURES) expect(parseCatioSettings(JSON.stringify({ ...defaultCatioSettings(), config: { ...MODULAR_DEFAULT, portClosure } })).config.portClosure).toBe(portClosure);
    // corrupt or invalid: the defaults, as before
    expect(migrateCatioSettings(null)).toBeNull(); expect(migrateCatioSettings({ version: 7 })).toBeNull(); expect(migrateCatioSettings([])).toBeNull();
    expect(parseCatioSettings(JSON.stringify({ version: 1, config: { ...legacyConfig, sashWidth: 2 } }))).toEqual(defaultCatioSettings());
    expect(parseCatioSettings(JSON.stringify({ version: 1, config: 'none' }))).toEqual(defaultCatioSettings());
    expect(parseCatioSettings(JSON.stringify({ version: 2, config: legacyConfig }))).toEqual(defaultCatioSettings());
    expect(parseCatioSettings(JSON.stringify({ version: 2, config: { ...legacyConfig, portClosure: 'curtain' } }))).toEqual(defaultCatioSettings());
    // migrating does not touch what it is given
    const before = JSON.parse(legacy) as Record<string, unknown>; const copy = structuredClone(before);
    migrateCatioSettings(before); expect(before).toEqual(copy);
  });

  it('keeps a saved tunnel’s settings and viewing state, dropping the side access its end bays’ doors replaced', () => {
    const config = { ...TUNNEL_DEFAULT, portX: 800, portHeight: 655, supportFixing: 'dowels' as const, mesh: 'welded' as const };
    const saved = parseSubassemblySettings(tunnelDefinition, JSON.stringify({ version: 1, variant: 'modular', config: { ...config, sideAccess: 'all', sideAccessSide: 'left' }, views: { modular: { progress: 3, view: 'Top', hidden: ['mesh'], cutaway: true, exploded: true, windowOpen: false } } }));
    expect(saved.config).toEqual(config); expect(Object.keys(saved.config)).not.toContain('sideAccess');
    expect(saved.views.modular).toEqual({ progress: 3, view: 'Top', hidden: ['mesh'], cutaway: true, exploded: true, windowOpen: false, doorOpen: false });
    expect(parseTunnel(saved.config)).toEqual(saved.config);
    // only the settings another page shares with it, written before the tunnel page was ever opened: not a saved tunnel
    expect(parseTunnel({ supportFixing: 'strap', supportBase: 'self-standing' })).toEqual({ ...TUNNEL_DEFAULT, supportFixing: 'strap', supportBase: 'self-standing' });
  });

  it('keeps sliding gates for a window insert or tunnel saved before the choice, when the whole catio was never saved', () => {
    const store = new Map<string, string>();
    const storage = { getItem: (key: string) => store.get(key) ?? null, setItem: (key: string, value: string) => void store.set(key, value), removeItem: (key: string) => void store.delete(key), clear: () => store.clear(), key: () => null, length: 0 };
    const previous = (globalThis as { localStorage?: Storage }).localStorage;
    Object.defineProperty(globalThis, 'localStorage', { value: storage, configurable: true });
    try {
      const oldView = { progress: 6, exploded: false, windowOpen: true, cutaway: false, hidden: [], view: 'Exterior' };
      const oldPage = (config: object) => JSON.stringify({ version: 1, variant: 'modular', config, views: { direct: oldView, modular: oldView } });
      const closures = () => [loadCatioSettings().config.portClosure, savedWindow('modular', WINDOW_INSERT_DEFAULT).closure, tunnelSite().window.closure, windowInsertLayout('modular', WINDOW_INSERT_DEFAULT, savedWindow('modular', WINDOW_INSERT_DEFAULT)).closure];
      // nothing saved anywhere: a new design, with removable panels
      expect(closures()).toEqual(Array(4).fill('removable-panel')); expect(store.size).toBe(0);
      // each page alone, saved before the choice, with no whole-catio settings: its design keeps its sliding gate
      for (const [id, config] of [['window-insert', { ...WINDOW_INSERT_DEFAULT, footDiameter: 40 }], ['tunnel', TUNNEL_DEFAULT], ['insert-tunnel-coupling', COUPLING_DEFAULT], ['tunnel-tunnel-coupling', TUNNEL_COUPLING_DEFAULT]] as const) {
        store.clear(); store.set(subassemblyStorageKey(id), oldPage(config));
        expect(savedBeforeClosure(storage), id).toBe(true);
        expect(closures(), id).toEqual(Array(4).fill('sliding-gate'));
        expect(windowInsertLayout('modular', WINDOW_INSERT_DEFAULT, savedWindow('modular', WINDOW_INSERT_DEFAULT)).door, id).toBeNull();
        // the decision is saved with the catio's settings, everything else at its defaults
        expect(JSON.parse(store.get(CATIO_STORAGE_KEY) ?? '{}')).toEqual({ ...defaultCatioSettings(), config: { ...MODULAR_DEFAULT, portClosure: 'sliding-gate' } });
        // so it holds once the page has saved itself again in today's form
        store.set(subassemblyStorageKey(id), JSON.stringify(parseSubassemblySettings(windowInsertDefinition, null)));
        expect(savedBeforeClosure(storage), id).toBe(false); expect(closures(), id).toEqual(Array(4).fill('sliding-gate'));
      }
      // a page first saved today, with no whole-catio settings: a new design
      store.clear(); store.set(subassemblyStorageKey('window-insert'), JSON.stringify(defaultSubassemblySettings(windowInsertDefinition)));
      expect(savedBeforeClosure(storage)).toBe(false); expect(closures()).toEqual(Array(4).fill('removable-panel')); expect(store.has(CATIO_STORAGE_KEY)).toBe(false);
      // only the settings another page shares into a page's storage, or rubbish: not a saved design
      store.clear(); saveShared(tunnelCouplingDefinition, { ...TUNNEL_COUPLING_DEFAULT, supportFixing: 'strap' as const }); store.set(subassemblyStorageKey('window-insert'), '{oops');
      expect(store.has(subassemblyStorageKey('tunnel'))).toBe(true); expect(savedBeforeClosure(storage)).toBe(false); expect(closures()).toEqual(Array(4).fill('removable-panel'));
      // saved whole-catio settings decide, whatever the pages hold: version 1 migrates to the gate, a chosen panel stays
      store.set(subassemblyStorageKey('tunnel'), oldPage(TUNNEL_DEFAULT));
      store.set(CATIO_STORAGE_KEY, JSON.stringify(defaultCatioSettings())); expect(closures()).toEqual(Array(4).fill('removable-panel'));
      store.set(CATIO_STORAGE_KEY, legacy); expect(loadCatioSettings().config.portClosure).toBe('sliding-gate');
    } finally { Object.defineProperty(globalThis, 'localStorage', { value: previous, configurable: true }); }
  });

  it('remembers an opened door per page, and starts every older page with its door shut', () => {
    for (const definition of [windowInsertDefinition, couplingDefinition, tunnelDefinition, tunnelCouplingDefinition] as const) {
      const d = definition as typeof windowInsertDefinition;
      expect(defaultSubassemblySettings(d).views.modular.doorOpen, d.id).toBe(false);
      const last = d.steps('modular', d.defaults).length - 1;
      expect(parseSubassemblySettings(d, JSON.stringify({ version: 1, variant: 'modular', config: d.defaults, views: { modular: { progress: last, doorOpen: true } } })).views.modular).toMatchObject({ progress: last, doorOpen: true });
      expect(parseSubassemblySettings(d, JSON.stringify({ version: 1, variant: 'modular', config: d.defaults, views: { modular: { progress: last, doorOpen: 'yes' } } })).views.modular.doorOpen).toBe(false);
    }
    // each page offers the toggle only where its design has a door
    expect(windowInsertDefinition.doorToggle?.('modular', WINDOW_INSERT_DEFAULT)).toBe('Cat port open');
    expect(windowInsertDefinition.doorToggle?.('direct', WINDOW_INSERT_DEFAULT)).toBeNull();
    expect(couplingDefinition.doorToggle?.('modular', COUPLING_DEFAULT)).toBe('Cat port open');
    // the tunnel's doors, every opening not coupled, open together
    expect(tunnelDefinition.doorToggle?.('modular', TUNNEL_DEFAULT)).toBe('Doors open');
    expect(tunnelDefinition.doorToggle?.('modular', { ...TUNNEL_DEFAULT, angleJoint: 'angle-collar' as const })).toBe('Doors open');
  });
});

describe('window insert: the cat port’s removable panel', () => {

  it('stages the panel from the room side, turns its buttons over it last, and opens it again with the page’s toggle', () => {
    const scene = createWindowInsertScene('modular', WINDOW_INSERT_DEFAULT, windowWith('removable-panel')); const door = scene.closure?.door; if (!door) throw new Error('door');
    const ids = scene.components.map(part => part.id);
    expect(ids).toEqual(expect.arrayContaining(['port-panel', 'port-panel-hardware'])); expect(ids.filter(id => /gate/.test(id))).toEqual([]);
    expect(scene.components.find(part => part.id === 'port-panel')).toMatchObject({ step: 6, layer: 'timber' });
    expect(scene.components.find(part => part.id === 'port-panel-hardware')).toMatchObject({ step: 6, layer: 'hardware' });
    const turned = () => door.buttons.map(b => Math.abs(Math.atan2(Math.sin(b.arm.rotation.z - Math.atan2(b.button.closed[1], b.button.closed[0])), Math.cos(b.arm.rotation.z - Math.atan2(b.button.closed[1], b.button.closed[0])))) / (Math.PI / 2));
    // stage 6: stop and strips, their screws, the seal, the buttons (pointing clear), the panel, and last the buttons turned over it
    const captions: string[] = [];
    for (let progress = 5.02; progress < 6; progress += 0.04) { scene.update({ ...installed, progress }); const caption = scene.caption?.(); if (caption && captions.at(-1) !== caption) captions.push(caption); }
    expect(captions.map(c => c.split(':')[0])).toEqual(['4 × Door stop', 'Screws', 'Seal', '3 × Door turn button', 'Cat-port panel', '3 × Door turn button']);
    expect(captions.at(-1)).toMatch(/turned a quarter turn over the panel, its locking pin dropped into its hole/);
    scene.update({ ...installed, progress: 5.7 }); for (const t of turned()) expect(t).toBeCloseTo(1, 6);
    // complete: seated, every button over it
    scene.update(installed); const seated = bounds(door.panel);
    for (const t of turned()) expect(t).toBeCloseTo(0, 6);
    expect(scene.caption?.()).toBeNull();
    // the toggle: buttons clear first, then the panel into the room, then stowed on the wall beside the window
    scene.update({ ...installed, door: 0.2 }); expect(scene.caption?.()).toMatch(/3 × Door turn button: its locking pin lifted, turned a quarter turn clear of the cat-port panel/);
    expect(bounds(door.panel).min.y).toBeCloseTo(seated.min.y, 6);
    scene.update({ ...installed, door: DOOR_TRAVEL.turned }); for (const t of turned()) expect(t).toBeCloseTo(1, 6);
    scene.update({ ...installed, door: DOOR_TRAVEL.out }); expect(seated.min.y - bounds(door.panel).min.y).toBeCloseTo(door.door.withdraw, 6);
    expect(scene.caption?.()).toMatch(/Cat-port panel: stowed clear of the route/);
    scene.update({ ...installed, door: 1 });
    const stowed = bounds(door.panel); const w = scene.layout.window;
    expect(stowed.min.x).toBeGreaterThan(w.openingWidth / 2); expect(stowed.max.y).toBeLessThan(-300);
    // the port is clear: nothing of the door's is left in the opening but its stops, round its edge
    const port = scene.layout.port; if (!port) throw new Error('port'); const stop = DOOR.setIn.lap + 1;
    const opening = new THREE.Box3(new THREE.Vector3(-port.width / 2 + stop, -400, scene.layout.floor + stop), new THREE.Vector3(port.width / 2 - stop, 0, scene.layout.floor + port.height - stop));
    for (const part of scene.components.filter(q => /^port-panel/.test(q.id))) part.group.traverse(o => { if (o instanceof THREE.Mesh && o.visible) { const b = new THREE.Box3().setFromObject(o); expect(b.intersectsBox(opening), `${part.id} ${o.name}`).toBe(false); } });
    // before the assembly is complete, and exploded, the toggle does nothing
    scene.update({ ...installed, progress: 5, door: 1 }); expect(door.panel.position.z).toBeGreaterThan(0);
    scene.update({ ...installed, progress: 6, door: 0 }); expect(bounds(door.panel).min.toArray().map(Math.round)).toEqual(seated.min.toArray().map(Math.round));
    scene.dispose();
    // the sliding gate, as before: tracks, gate and latch, and the toggle slides it up
    const gate = createWindowInsertScene('modular', WINDOW_INSERT_DEFAULT, windowWith('sliding-gate'));
    expect(gate.components.map(part => part.id)).toEqual(expect.arrayContaining(['gate-tracks', 'cat-gate', 'gate-latch']));
    expect(gate.components.map(part => part.id).filter(id => /port-panel/.test(id))).toEqual([]);
    gate.update(installed); const shut = bounds(gate.components.find(part => part.id === 'cat-gate')?.group ?? new THREE.Group());
    gate.update({ ...installed, door: 1 }); const raised = bounds(gate.components.find(part => part.id === 'cat-gate')?.group ?? new THREE.Group());
    expect(raised.min.z - shut.min.z).toBeCloseTo((gate.layout.port?.height ?? 0) + 30, 6);
    gate.update({ ...installed, door: 0.5 }); expect(gate.caption?.()).toMatch(/Cat gate: unlatched and slid up/);
    gate.dispose();
  });
});

describe('insert–tunnel coupling with a removable cat-port panel', () => {

  it('shows the port shut until the tunnel is docked and latched, then opens it into the room past the docked tunnel', () => {
    const docked: CatioState = { progress: 5, exploded: false, windowOpen: false, cutaway: false, hidden: new Set() };
    for (const closure of PORT_CLOSURES) {
      const scene = createCouplingScene('modular', COUPLING_DEFAULT, { tunnel: TUNNEL_DEFAULT, joint: TUNNEL_COUPLING_DEFAULT, site: siteWith(closure) });
      const ids = scene.components.map(part => part.id);
      expect(ids).toEqual(expect.arrayContaining(['window-port-closure', 'window-port-closure-hardware']));
      expect(scene.closure?.door === null).toBe(closure === 'sliding-gate'); expect(scene.closure?.gate === null).toBe(closure === 'removable-panel');
      const group = scene.components.find(part => part.id === 'window-port-closure')?.group; if (!group) throw new Error('closure');
      scene.update(docked); const shut = bounds(group);
      // not docked yet, or the latches released: it stays shut whatever the toggle says
      for (const state of [{ ...docked, progress: 3, door: 1 }, { ...docked, windowOpen: true, door: 1 }, { ...docked, progress: 4.5, door: 1 }]) { scene.update(state); expect(bounds(group).equals(shut), `${closure} ${state.progress}`).toBe(true); }
      scene.update({ ...docked, door: 1 }); const open = bounds(group);
      expect(open.equals(shut)).toBe(false);
      if (closure === 'removable-panel') {
        // into the room: nothing of the moving panel passes the port frame's room-side face
        const moving = scene.closure?.door?.panel; if (!moving) throw new Error('panel');
        // (once drawn out: set into the port, it starts inside it)
        for (const travel of [DOOR_TRAVEL.out, 0.8, 1]) { scene.update({ ...docked, door: travel }); expect(bounds(moving).max.y, String(travel)).toBeLessThanOrEqual(scene.layout.insert.yOut - INSERT.portMember + 1e-6); }
        scene.update({ ...docked, door: 0.5 }); expect(scene.caption?.()).toMatch(/Cat-port panel: drawn straight out of its opening/);
      } else expect(open.max.z).toBeGreaterThan(shut.max.z);
      scene.dispose();
    }
  });
});

describe('tunnel doors: every section’s end bay', () => {
  const site = siteWith('removable-panel');

  it('draws the doors with the shared door, opens them with the page’s toggle, and shows the window port’s closure as the insert has it', () => {
    for (const closure of PORT_CLOSURES) {
      const scene = createTunnelScene('modular', TUNNEL_DEFAULT, siteWith(closure), TUNNEL_COUPLING_DEFAULT, COUPLING_DEFAULT);
      const ids = scene.components.map(part => part.id);
      expect(ids).toEqual(expect.arrayContaining(['doors', 'door-mesh', 'door-hardware', 'window-port-closure']));
      expect(scene.doors).toHaveLength(scene.layout.doors.length); expect(scene.doors.length).toBeGreaterThan(1);
      expect(scene.components.find(part => part.id === 'doors')).toMatchObject({ step: 4, layer: 'timber' });
      scene.update(installed);
      const seated = scene.doors.map(a => bounds(a.built.panel));
      for (const [i, a] of scene.doors.entries()) {
        const expected = a.access.door.timber.filter(t => t.moves).flatMap(t => t.boxes).map(b => doorBounds(a.access.frame, b));
        for (const k of [0, 1, 2] as const) expect(seated[i]?.min.getComponent(k), a.access.id).toBeCloseTo(Math.min(...expected.map(e => e.min[k])), 4);
      }
      scene.update({ ...installed, door: 0.2 }); expect(scene.caption?.()).toMatch(/Door turn button: its locking pin lifted, turned a quarter turn clear of the door/);
      scene.update({ ...installed, door: DOOR_TRAVEL.out });
      for (const [i, a] of scene.doors.entries()) {
        const moved = bounds(a.built.panel).getCenter(new THREE.Vector3()).sub(seated[i]?.getCenter(new THREE.Vector3()) ?? new THREE.Vector3());
        expect(moved.length()).toBeCloseTo(a.access.door.withdraw, 4); expect(moved.normalize().dot(new THREE.Vector3(...a.access.frame.n))).toBeCloseTo(1, 6);
      }
      scene.update({ ...installed, door: 1 }); for (const a of scene.doors) expect(a.built.panel.children.every(child => !child.visible)).toBe(true);
      scene.update({ ...installed, progress: 5.5, door: 1 }); for (const a of scene.doors) expect(a.built.panel.children.every(child => child.visible)).toBe(true);
      scene.update({ ...installed, progress: 3.75 }); expect(scene.caption?.()).toMatch(/Door: set into its opening/);
      scene.dispose();
    }
  });

  it('keeps the doors of the two sections on the coupling page clear of the joint’s latches, shut or open', () => {
    for (const jointShown of ['end-end', 'end-side'] as const) {
      const config = { ...TUNNEL_COUPLING_DEFAULT, jointShown };
      const scene = createTunnelCouplingScene('modular', config, { tunnel: TUNNEL_DEFAULT, site });
      expect(scene.doors.length).toBeGreaterThan(0);
      const coupled: CatioState = { progress: 5, exploded: false, windowOpen: false, cutaway: false, hidden: new Set() };
      for (const travel of [0, 0.4, 0.7]) {
        scene.update({ ...coupled, door: travel });
        for (const lever of scene.levers) for (const a of scene.doors) for (const piece of [...a.built.moving, ...a.built.buttons.map(b => b.group), ...a.built.fixed.map(f => f.group)]) expect(bounds(lever.group).intersectsBox(bounds(piece)), `${jointShown} ${a.access.id} at ${travel}`).toBe(false);
      }
      scene.update({ ...coupled, door: 1 }); expect(scene.doors.every(a => a.built.panel.children.every(child => !child.visible))).toBe(true);
      scene.dispose();
    }
  });
});

describe('whole catio: every cat port by the chosen closure', () => {
  const assembled: ModularState = { progress: 6, exploded: false, windowOpen: false, cutaway: false, hidden: new Set() };
  const part = (scene: ReturnType<typeof createModularCatio>, id: string) => { const found = scene.components.find(p => p.id === id); if (!found) throw new Error(`Missing ${id}`); return found.group; };
  const both = { ...MODULAR_DEFAULT, secondEnabled: true };

  it('draws a removable panel at the window (solid) and at every enclosure port (framed mesh), or a sliding gate at each', () => {
    const panel = createModularCatio(both, WINDOW_INSERT_DEFAULT, { doorFixing: TUNNEL_COUPLING_DEFAULT.doorFixing }); const gate = createModularCatio({ ...both, portClosure: 'sliding-gate' }, WINDOW_INSERT_DEFAULT, { doorFixing: TUNNEL_COUPLING_DEFAULT.doorFixing });
    const cats = panel.doors.filter(d => d.kind === 'cat');
    expect(cats.map(d => d.id)).toEqual(gate.doors.filter(d => d.kind === 'cat').map(d => d.id)); expect(cats).toHaveLength(7);
    expect(new Set(cats.map(d => d.mechanism))).toEqual(new Set(['removable-panel'])); expect(new Set(gate.doors.filter(d => d.kind === 'cat').map(d => d.mechanism))).toEqual(new Set(['sliding-gate']));
    expect(panel.doors.filter(d => d.kind === 'human').map(d => d.mechanism)).toEqual(['hinged', 'hinged']);
    expect(cats.map(d => d.label)).toEqual(expect.arrayContaining(['Window cat-port panel', 'Enclosure A rear cat-port panel', 'Enclosure B left cat-port panel']));
    expect(gate.doors.map(d => d.label)).toEqual(expect.arrayContaining(['Window cat gate', 'Enclosure A rear cat gate']));
    const ids = panel.components.map(p => p.id); const gateIds = gate.components.map(p => p.id);
    for (const d of cats) {
      expect(ids).toEqual(expect.arrayContaining([`${d.id}-frame`, `${d.id}-panel`, `${d.id}-panel-buttons`]));
      // mesh at the enclosures, where a port may stand unused under the sky; solid at the window, which it has to close
      expect(ids.includes(`${d.id}-panel-mesh`), d.id).toBe(d.id !== 'window-cat');
      expect(gateIds).toEqual(expect.arrayContaining([`${d.id}-frame`, `${d.id}-tracks`, `${d.id}-gate`, `${d.id}-latch`]));
    }
    expect(ids.filter(id => /-(tracks|gate|latch)$/.test(id))).toEqual([]); expect(gateIds.filter(id => /-panel/.test(id))).toEqual([]);
    // the same parts otherwise, roofs and all
    const rest = (list: string[]) => list.filter(id => !/-(tracks|gate|latch|panel|panel-mesh|panel-buttons)$/.test(id));
    expect(rest(ids)).toEqual(rest(gateIds));
    panel.dispose(); gate.dispose();
  });

  it('leaves every roof, its bearers, the walls, floors and tunnel exactly as they are, whichever closure', () => {
    const panel = createModularCatio({ ...both, route: 'right' }, WINDOW_INSERT_DEFAULT, { doorFixing: TUNNEL_COUPLING_DEFAULT.doorFixing }); const gate = createModularCatio({ ...both, route: 'right', portClosure: 'sliding-gate' }, WINDOW_INSERT_DEFAULT, { doorFixing: TUNNEL_COUPLING_DEFAULT.doorFixing });
    panel.update(assembled); gate.update(assembled);
    const roofs = panel.components.filter(p => /roof/.test(p.id)); expect(roofs.length).toBeGreaterThan(4);
    for (const p of panel.components.filter(q => !/-(panel|panel-mesh|panel-buttons)$/.test(q.id) && !/^window-(threshold|docking-frame|cat)/.test(q.id) && q.id !== 'window-infill-below' && !/^window-infill/.test(q.id) && q.id !== 'recess-collar' && q.id !== 'screen-hooks' && q.id !== 'padded-clamps')) {
      const other = gate.components.find(q => q.id === p.id); if (!other) throw new Error(p.id);
      expect([p.step, p.layer], p.id).toEqual([other.step, other.layer]);
      expect(bounds(p.group).min.toArray().concat(bounds(p.group).max.toArray()), p.id).toEqual(bounds(other.group).min.toArray().concat(bounds(other.group).max.toArray()));
    }
    expect(panel.panels.filter(q => /roof/.test(q.id))).toEqual(gate.panels.filter(q => /roof/.test(q.id)));
    expect(panel.layout).toEqual(gate.layout);
    panel.dispose(); gate.dispose();
  });

  it('keeps unused ports shut and retained, opens the connected ones only at the last stage, and shuts any of them again', () => {
    const scene = createModularCatio(both, WINDOW_INSERT_DEFAULT, { doorFixing: TUNNEL_COUPLING_DEFAULT.doorFixing });
    const seatedAt = new Map<string, THREE.Box3>();
    scene.update({ ...assembled, progress: 5 });
    for (const d of scene.doors.filter(q => q.kind === 'cat')) seatedAt.set(d.id, bounds(d.moving[0] ?? new THREE.Group()));
    const moved = (id: string) => { const d = scene.doors.find(q => q.id === id); const box = bounds(d?.moving[0] ?? new THREE.Group()); return d?.moving[0]?.children.some(child => !child.visible) || !box.equals(seatedAt.get(id) ?? new THREE.Box3()); };
    // before the last stage every port is shut, whatever is asked
    scene.update({ ...assembled, progress: 5, doors: Object.fromEntries(scene.doors.map(d => [d.id, true])) });
    for (const d of scene.doors.filter(q => q.kind === 'cat')) expect(moved(d.id), d.id).toBe(false);
    // complete: the connected ports open (their panels out), the unused stay shut even when asked to open
    scene.update({ ...assembled, doors: Object.fromEntries(scene.doors.map(d => [d.id, true])) });
    for (const d of scene.doors.filter(q => q.kind === 'cat')) expect(moved(d.id), d.id).toBe(d.connected);
    expect(scene.doors.filter(d => d.kind === 'cat' && !d.connected).map(d => d.id).sort()).toEqual(['a-left', 'b-rear', 'b-right']);
    // each shuts on its own
    scene.update({ ...assembled, doors: { 'window-cat': false } });
    expect(moved('window-cat')).toBe(false); expect(moved('a-rear')).toBe(true);
    // halfway through the last stage the buttons have turned and the panels are coming out: not a slide upwards
    scene.update({ ...assembled, progress: 5.6 });
    const rear = scene.doors.find(d => d.id === 'a-rear')?.moving[0]; if (!rear) throw new Error('rear');
    const out = bounds(rear).getCenter(new THREE.Vector3()).sub((seatedAt.get('a-rear') ?? new THREE.Box3()).getCenter(new THREE.Vector3()));
    expect(out.y).toBeGreaterThan(1); expect(Math.abs(out.z)).toBeLessThan(1e-6); expect(Math.abs(out.x)).toBeLessThan(1e-6);
    // the apertures are free of fixed mesh, and with the panel out nothing but the sill stop is left in a connected port
    scene.update(assembled);
    for (const d of scene.doors.filter(q => q.kind === 'cat' && q.connected)) {
      const frame = bounds(part(scene, `${d.id}-frame`)); const centre = frame.getCenter(new THREE.Vector3()); centre.z = MODULAR.sill + both.tunnelSize / 2;
      const direction = d.id.endsWith('left') || d.id.endsWith('right') ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
      const through = new THREE.Raycaster(centre.clone().addScaledVector(direction, -120), direction, 0, 240);
      const blockers = scene.components.filter(p => p.layer === 'mesh' || new RegExp(`^${d.id}-panel`).test(p.id)).map(p => p.group);
      const hits = through.intersectObjects(blockers, true).filter(hit => { let o: THREE.Object3D | null = hit.object; while (o) { if (!o.visible) return false; o = o.parent; } return true; });
      expect(hits, `${d.id} blocked`).toHaveLength(0);
    }
    scene.dispose();
  });

});
