import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { buildDoorPanel } from './catioDoorScene.ts';
import { createCatioParts, type CatioState } from './catioParts.ts';
import { catPorts, type CatioDoor } from './catioEnclosureScene.ts';
import { defaultSubassemblySettings, parseSubassemblySettings } from './catioSubassembly.ts';
import { couplingDefinition, tunnelCouplingDefinition, tunnelDefinition, windowInsertDefinition } from './catioSubassemblies.ts';
import { createCouplingScene } from './catioCouplingScene.ts';
import { createTunnelCouplingScene } from './catioTunnelCouplingScene.ts';
import { createTunnelScene } from './catioTunnelScene.ts';
import { createWindowInsertScene } from './catioWindowInsertScene.ts';
import { COUPLING_DEFAULT, DOOR, DOOR_SEATS, DOOR_TRAVEL, doorBounds, INSERT, insetPanel, MODULAR_DEFAULT, parseTunnel, PORT_CLOSURE_DEFAULT, PORT_CLOSURES, PORT_FRAME, setInDoor, slidingGateRise, TUNNEL, TUNNEL_COUPLING_DEFAULT, TUNNEL_DEFAULT, validateModular, WINDOW_INSERT_DEFAULT, windowFor, windowInsertLayout, type DoorPanel, type ModularConfig, type TunnelSite, type WindowInsertConfig, type WindowSpec } from '@canfactory/catio';
import { tunnelSite } from './catioSaved.ts';

/** The cat port sizes the planner allows (20–45 cm each way), and section lengths between the tunnel's flanges. */
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
    expect(PORT_CLOSURE_DEFAULT).toBe('removable-panel');
    expect([...PORT_CLOSURES]).toEqual(['removable-panel', 'sliding-gate']);
    expect(MODULAR_DEFAULT.portClosure).toBe('removable-panel');
    expect(validateModular(MODULAR_DEFAULT)).toEqual([]); expect(validateModular(sliding)).toEqual([]);
    expect(validateModular({ ...MODULAR_DEFAULT, portClosure: 'curtain' as ModularConfig['portClosure'] }).join()).toMatch(/Choose a removable panel or a sliding gate/);
    expect(slidingGateRise(300, 40)).toBe(640);
  });

});

describe('saved sub-assembly settings', () => {
  it('keeps a saved tunnel’s settings and viewing state, dropping the side access its end bays’ doors replaced', () => {
    const config = { ...TUNNEL_DEFAULT, portX: 800, portHeight: 655, supportFixing: 'dowels' as const, mesh: 'welded' as const };
    const saved = parseSubassemblySettings(tunnelDefinition, JSON.stringify({ version: 1, variant: 'modular', config: { ...config, sideAccess: 'all', sideAccessSide: 'left' }, views: { modular: { progress: 3, view: 'Top', hidden: ['mesh'], cutaway: true, exploded: true, windowOpen: false } } }));
    expect(saved.config).toEqual(config); expect(Object.keys(saved.config)).not.toContain('sideAccess');
    expect(saved.views.modular).toEqual({ progress: 3, view: 'Top', hidden: ['mesh'], cutaway: true, exploded: true, windowOpen: false, doorOpen: false });
    expect(parseTunnel(saved.config)).toEqual(saved.config);
    // only the settings another page shares with it, written before the tunnel page was ever opened: not a saved tunnel
    expect(parseTunnel({ supportFixing: 'strap', supportBase: 'self-standing' })).toEqual({ ...TUNNEL_DEFAULT, supportFixing: 'strap', supportBase: 'self-standing' });
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

describe('cat ports: every one by the chosen closure', () => {
  /** A window port and an enclosure's three, the window's and the rear coupled, drawn as the planner draws them. */
  const draw = (portClosure: ModularConfig['portClosure']) => {
    const p = createCatioParts(); const doors: CatioDoor[] = [];
    const { port, closureName } = catPorts(p, { ...MODULAR_DEFAULT, portClosure }, doors);
    port('window-cat', `Window ${closureName}`, 1, true, 'window');
    for (const side of ['rear', 'left', 'right']) port(`a-${side}`, `Enclosure A ${side} ${closureName}`, 3, side === 'rear', 'enclosure');
    return { p, doors, ids: p.components.map(c => c.id) };
  };

  it('draws a removable panel at the window (solid) and at every enclosure port (framed mesh), or a sliding gate at each', () => {
    const panel = draw('removable-panel'); const gate = draw('sliding-gate');
    expect(panel.doors.map(d => d.id)).toEqual(gate.doors.map(d => d.id)); expect(panel.doors).toHaveLength(4);
    expect(new Set(panel.doors.map(d => d.mechanism))).toEqual(new Set(['removable-panel'])); expect(new Set(gate.doors.map(d => d.mechanism))).toEqual(new Set(['sliding-gate']));
    expect(panel.doors.map(d => d.label)).toEqual(['Window cat-port panel', 'Enclosure A rear cat-port panel', 'Enclosure A left cat-port panel', 'Enclosure A right cat-port panel']);
    expect(gate.doors.map(d => d.label)).toEqual(expect.arrayContaining(['Window cat gate', 'Enclosure A rear cat gate']));
    expect(panel.doors.map(d => d.connected)).toEqual([true, true, false, false]);
    for (const d of panel.doors) {
      expect(panel.ids).toEqual(expect.arrayContaining([`${d.id}-frame`, `${d.id}-panel`, `${d.id}-panel-buttons`]));
      // mesh at the enclosures, where a port may stand unused under the sky; solid at the window, which it has to close
      expect(panel.ids.includes(`${d.id}-panel-mesh`), d.id).toBe(d.id !== 'window-cat');
      expect(gate.ids).toEqual(expect.arrayContaining([`${d.id}-frame`, `${d.id}-tracks`, `${d.id}-gate`, `${d.id}-latch`]));
    }
    // a coupled port takes its dock, an unused one none
    expect(panel.ids.filter(id => id.endsWith('-dock-coupling'))).toEqual(['window-cat-dock-coupling', 'a-rear-dock-coupling']);
    expect(panel.ids.filter(id => /-(tracks|gate|latch)$/.test(id))).toEqual([]); expect(gate.ids.filter(id => /-panel/.test(id))).toEqual([]);
    panel.p.dispose(); gate.p.dispose();
  });

  it('opens a panel by turning its buttons clear and drawing it out, and shuts it again', () => {
    const { p, doors } = draw('removable-panel'); p.root.updateMatrixWorld(true);
    const door = doors.find(d => d.id === 'a-rear'); const panel = door?.moving[0]; if (!door || !panel) throw new Error('a-rear');
    const seated = bounds(panel);
    door.set(DOOR_TRAVEL.out); p.root.updateMatrixWorld(true);
    const out = bounds(panel).getCenter(new THREE.Vector3()).sub(seated.getCenter(new THREE.Vector3()));
    // out along the port's +Y, into the enclosure: not a slide upwards
    expect(out.y).toBeGreaterThan(1); expect(Math.abs(out.z)).toBeLessThan(1e-6); expect(Math.abs(out.x)).toBeLessThan(1e-6);
    door.set(0); p.root.updateMatrixWorld(true);
    expect(bounds(panel).equals(seated)).toBe(true);
    p.dispose();
  });
});
