import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { toggleLatchMechanism as TL } from '@canfactory/contracts';
import type { CatioState } from './catioParts.ts';
import { tunnelCouplingDefinition } from './catioSubassemblies.ts';
import { createTunnelCouplingScene, LIFT } from './catioTunnelCouplingScene.ts';
import { MODULAR_DEFAULT, parseTunnel, parseTunnelCoupling, settingHome, SUBASSEMBLY_CONTROLS, SUPPORT_FIXINGS, TUNNEL, TUNNEL_CONTROLS, TUNNEL_COUPLING_CONTROLS, TUNNEL_COUPLING_DEFAULT, TUNNEL_DEFAULT, tunnelCouplingLayout, tunnelCouplingSteps, tunnelSiteFor, validateTunnelCoupling, vec, WINDOW_INSERT_DEFAULT, type SupportFixing, type TunnelConfig, type TunnelCouplingConfig, type TunnelCouplingSite } from '@canfactory/catio';

const base = tunnelSiteFor(WINDOW_INSERT_DEFAULT, MODULAR_DEFAULT);
const site: TunnelCouplingSite = { tunnel: TUNNEL_DEFAULT, site: base };
/** The tunnel meshed with welded wire mesh instead of the default net. */
/** Every option of every control, one at a time, from the defaults, and bolted with every count. */
// (gravity only needs self-standing supports)
// (the joint shown has a test of its own)
const configs: TunnelCouplingConfig[] = [TUNNEL_COUPLING_DEFAULT, ...TUNNEL_COUPLING_CONTROLS.filter(control => control.key !== 'jointShown').flatMap(control => control.options.map(option => ({ ...TUNNEL_COUPLING_DEFAULT, [control.key]: option.value })))
  .map(config => config.supportFixing === 'gravity' ? { ...config, supportBase: 'self-standing' as const } : config),
  ...([4, 8] as const).map(boltsPerCoupling => ({ ...TUNNEL_COUPLING_DEFAULT, mechanism: 'bolts' as const, boltsPerCoupling }))];
/** The tunnel's sections at every length, with its feet, and the catio's smallest and largest clear tunnel. */
/** A section's length along the run: a whole number of pitches less the gap. */
const installed: CatioState = { progress: 5, exploded: false, windowOpen: false, cutaway: false, hidden: new Set() };
const bounds = (object: THREE.Object3D) => new THREE.Box3().setFromObject(object, true);

describe('tunnel–tunnel coupling scene', () => {
  it('stages one support, one section, its joint, the second section, the coupling and the fixings, and keeps the site still', () => {
    for (const config of [TUNNEL_COUPLING_DEFAULT, { ...TUNNEL_COUPLING_DEFAULT, mechanism: 'bolts' as const }]) {
      const scene = createTunnelCouplingScene('modular', config, site);
      const steps = tunnelCouplingSteps('modular', config, site);
      expect(steps).toHaveLength(6);
      expect(steps.map(s => s.title)).toEqual(['The site', 'Build one section', 'Ready its joint', 'The second section comes in', 'Couple', 'Hold it on the support']);
      scene.update({ ...installed, progress: 0 });
      const context = scene.components.filter(part => part.step === 0);
      expect(context.map(part => part.id)).toEqual(expect.arrayContaining(['terrain', 'slabs', 'support', 'support-feet']));
      const positions = context.map(part => part.group.position.toArray());
      for (let progress = 0; progress <= 5; progress++) {
        scene.update({ ...installed, progress, exploded: progress % 2 === 1 });
        expect(context.map(part => part.group.position.toArray())).toEqual(positions);
        for (const part of scene.components) expect(part.group.visible, `${part.id} at ${progress}`).toBe(part.step <= progress);
      }
      const ids = scene.components.map(part => part.id);
      expect(ids).toEqual(expect.arrayContaining(['first-section', 'first-section-mesh', 'first-section-fixings', 'second-section', 'second-section-mesh', 'second-section-fixings', 'fixings']));
      if (config.mechanism === 'bolts') { expect(ids).toContain('bolts'); expect(ids).not.toContain('latches'); }
      else { expect(ids).toEqual(expect.arrayContaining(['seal', 'latches', 'latch-screws'])); expect(ids).not.toContain('bolts'); }
      scene.update({ ...installed, hidden: new Set(['hardware']) });
      expect(scene.components.filter(part => part.layer === 'hardware').every(part => !part.group.visible)).toBe(true);
      scene.dispose();
    }
  });

  it('frames the first section raised and lays it on the support, its outgoing flange over the bearer', () => {
    const scene = createTunnelCouplingScene('modular', TUNNEL_COUPLING_DEFAULT, site);
    const timber = scene.components.find(part => part.id === 'first-section')?.group; if (!timber) throw new Error('first section');
    scene.update(installed); const down = bounds(timber).min.z;
    expect(down).toBeCloseTo(scene.layout.support.top, 3);
    scene.update({ ...installed, progress: 0.5 }); expect(scene.lift()).toBe(LIFT);
    scene.update({ ...installed, progress: 0.9 }); expect(scene.lift()).toBeGreaterThan(0); expect(scene.lift()).toBeLessThan(LIFT);
    expect(scene.caption?.()).toMatch(/Laying the first section/);
    scene.update({ ...installed, progress: 1 }); expect(scene.lift()).toBe(0); expect(bounds(timber).min.z).toBeCloseTo(down, 6);
    // the outgoing flange ends over the bearer
    const l = scene.layout;
    expect(Math.abs(bounds(timber).max.y - l.support.at[1])).toBeLessThan(TUNNEL.bearer.width / 2);
    scene.dispose();
  });

  it('brings an identical second section into view along the tunnel’s axis, from beyond the first, onto the same bearer, stopping at the gap', () => {
    for (const config of [TUNNEL_COUPLING_DEFAULT, { ...TUNNEL_COUPLING_DEFAULT, mechanism: 'bolts' as const }]) {
      const scene = createTunnelCouplingScene('modular', config, site);
      const first = scene.components.find(part => part.id === 'first-section')?.group;
      const second = scene.components.find(part => part.id === 'second-section')?.group; if (!first || !second) throw new Error('sections');
      const axis = new THREE.Vector3(...scene.layout.coupling.face.n);
      // not there until stage 3
      scene.update({ ...installed, progress: 2 }); expect(second.visible).toBe(false);
      // it comes in whole: every piece of it moves together, along the axis, from beyond the first
      const entering = scene.motions.filter(m => m.role === 'section');
      expect(new Set(entering.map(m => `${m.stage}:${m.window.join()}:${m.action}`)).size).toBe(1);
      for (const m of entering) { expect(m.approach.clone().normalize().dot(axis)).toBeCloseTo(1, 9); expect(m.stage).toBe(3); }
      const track: number[] = [];
      for (const progress of [2.05, 2.3, 2.6, 3]) { scene.update({ ...installed, progress }); expect(second.visible).toBe(true); track.push(bounds(second).min.y); }
      for (let i = 1; i < track.length; i++) expect(track[i]).toBeLessThan(track[i - 1] ?? Infinity);
      // beyond the first section when it appears, and only along the axis: same height and line throughout
      expect(track[0]).toBeGreaterThan(bounds(first).max.y + 100);
      scene.update({ ...installed, progress: 2.3 }); const midway = bounds(second);
      scene.update({ ...installed, progress: 3 }); const placed = bounds(second);
      expect(midway.min.z).toBeCloseTo(placed.min.z, 6); expect(midway.min.x).toBeCloseTo(placed.min.x, 6);
      // identical, and stopped the gap short of the first: on the same bearer
      expect(placed.max.y - placed.min.y).toBeCloseTo(bounds(first).max.y - bounds(first).min.y, 3);
      expect(placed.min.y - bounds(first).max.y).toBeCloseTo(scene.layout.gap, 6);
      expect(placed.min.z).toBeCloseTo(scene.layout.support.top, 3);
      expect(scene.entry()).toBe(0);
      // the cameras follow it in, then come back to the joint
      scene.update({ ...installed, progress: 2.4 }); expect(scene.focusOffset?.()[1]).toBeGreaterThan(0);
      scene.update(installed); expect(scene.focusOffset?.()).toEqual([0, 0, 0]);
      scene.dispose();
    }
  });

  it('closes the printed latches with the shared mechanism, each part on its pins, and opens them when released', () => {
    const scene = createTunnelCouplingScene('modular', { ...TUNNEL_COUPLING_DEFAULT, latchesPerSide: 2 }, site);
    expect(scene.levers).toHaveLength(4);
    const G = TL.TOGGLE_LATCH_GEOMETRY;
    const world = (object: THREE.Object3D, point: [number, number, number]) => new THREE.Vector3(...point).applyMatrix4(object.matrixWorld);
    const named = (lever: THREE.Object3D, name: string) => lever.parent?.children.find(child => child.name === name);
    for (const state of [installed, { ...installed, progress: 3.2 }, { ...installed, progress: 3.5 }, { ...installed, progress: 3.8 }, { ...installed, windowOpen: true }]) {
      scene.update(state);
      for (const { lever } of scene.levers) {
        const base = named(lever, 'toggle-latch-base'), link = named(lever, 'toggle-latch-link'); if (!base || !link) throw new Error('latch parts');
        expect(world(lever, [G.lever.pivot[0], G.lever.middle, G.lever.pivot[1]]).distanceTo(world(base, [G.base.middle, G.base.pivot[0], G.base.pivot[1]]))).toBeLessThan(1e-3);
        expect(world(link, [G.link.hole[0], G.link.middle, G.link.hole[1]]).distanceTo(world(lever, [G.lever.pin[0], G.lever.middle, G.lever.pin[1]]))).toBeLessThan(1e-3);
      }
    }
    // mid-stage the caption names the mechanism's movement; locked, the lever lies over its plate; released, it stands open
    scene.update({ ...installed, progress: 3.15 }); expect(scene.caption?.()).toMatch(/Printed toggle latch: hook the link over the catch/);
    scene.update({ ...installed, progress: 3.5 }); expect(scene.caption?.()).toMatch(/close the lever/);
    scene.update(installed);
    const first = scene.levers[0]; if (!first) throw new Error('lever');
    const tip = () => world(first.lever, [30, G.lever.middle, 1.5]);
    const closed = Math.abs(tip().x - first.mount.at[0]);
    expect(closed).toBeLessThan(15);
    scene.update({ ...installed, windowOpen: true });
    expect(Math.abs(tip().x - first.mount.at[0])).toBeGreaterThan(closed + 15);
    scene.dispose();
  });

  it('moves every piece along its own way in, point first for fasteners, each kind together, and shows what moves', () => {
    for (const config of configs) {
      const scene = createTunnelCouplingScene('modular', config, site);
      for (const motion of scene.motions.filter(m => m.role === 'screw' || m.role === 'staple' || m.role === 'bolt')) {
        const drive = new THREE.Vector3(...(motion.drive ?? [0, 0, 0]));
        expect(motion.approach.clone().normalize().dot(drive), motion.action).toBeCloseTo(-1, 6);
      }
      // a latch plate before its screws, a bolt before its nut
      for (const q of scene.layout.latches) {
        const plate = scene.motions.find(m => m.role === 'latch' && m.of === q.id); const screw = scene.motions.find(m => m.role === 'screw' && m.of === q.id);
        expect(plate?.window[1]).toBeLessThanOrEqual(screw?.window[0] ?? 0);
      }
      for (const m of scene.motions.filter(k => k.role === 'bolt')) expect(m.window[1]).toBeLessThanOrEqual(scene.motions.find(k => k.role === 'nut' && k.of === m.of)?.window[0] ?? 0);
      const windows = new Map<string, string>();
      for (const motion of scene.motions) {
        const key = `${motion.stage}:${motion.action}`; const window = motion.window.join();
        expect(windows.get(key) ?? window, motion.action).toBe(window); windows.set(key, window);
      }
      // (once a window: the motions sharing it are posed together)
      for (const motion of new Map(scene.motions.filter(m => m.window[1] > m.window[0]).map(m => [`${m.stage}:${m.window.join()}`, m] as const)).values()) {
        scene.update({ ...installed, progress: motion.stage - 1 + (motion.window[0] + motion.window[1]) / 2 });
        expect(scene.caption?.(), `caption mid ${motion.action}`).not.toBeNull();
      }
      scene.dispose();
    }
  });

  it('freezes the same assembly when exploded: the first section raised, the second waiting beyond it, every piece on its way in', () => {
    const scene = createTunnelCouplingScene('modular', TUNNEL_COUPLING_DEFAULT, site);
    const second = scene.components.find(part => part.id === 'second-section')?.group; const first = scene.components.find(part => part.id === 'first-section')?.group;
    if (!second || !first) throw new Error('sections');
    scene.update(installed); const placed = bounds(second); const laid = bounds(first);
    scene.update({ ...installed, exploded: true });
    expect(scene.lift()).toBe(LIFT); expect(scene.entry()).toBe(1);
    expect(bounds(first).min.z).toBeGreaterThan(laid.min.z + LIFT - 400);
    expect(bounds(second).min.y).toBeGreaterThan(placed.min.y + scene.layout.sectionLength);
    for (const m of scene.motions.filter(k => k.role === 'screw' && k.stage > 1)) {
      const f = scene.layout.fixings.find(q => m.object.position.distanceTo(new THREE.Vector3(...q.at)) < 1e-6);
      expect(f, m.action).toBeUndefined();
    }
    // and the latches stand open
    const lever = scene.levers[0]; if (!lever) throw new Error('lever');
    const pose = () => [...lever.lever.position.toArray(), ...lever.lever.rotation.toArray().slice(0, 3)];
    scene.update({ ...installed, exploded: true }); const open = pose();
    scene.update({ ...installed, windowOpen: true }); expect(pose()).toEqual(open);
    scene.update(installed); expect(pose()).not.toEqual(open);
    scene.dispose();
  });
});

describe('tunnel–tunnel coupling on its support, as the tunnel page holds it', () => {
  /** The coupling with the support held as given: set on this page (it is shared with the tunnel page). */
  const holding = (supportFixing: SupportFixing, supportBase: TunnelConfig['supportBase'] = 'trestle', config: TunnelCouplingConfig = TUNNEL_COUPLING_DEFAULT): TunnelCouplingConfig => ({ ...config, supportFixing, supportBase });

  it('holds the joint on its support with every fixing, and stages it', () => {
    for (const fixing of SUPPORT_FIXINGS) for (const config of [TUNNEL_COUPLING_DEFAULT, { ...TUNNEL_COUPLING_DEFAULT, mechanism: 'bolts' as const }]) {
      const held = holding(fixing, fixing === 'gravity' ? 'self-standing' : 'trestle', config);
      const l = tunnelCouplingLayout(held, site);
      expect(l.errors, `${fixing} ${config.mechanism}`).toEqual([]);
      expect(l.support.hold.attached).toBe(fixing !== 'gravity');
      if (fixing === 'gravity') expect(validateTunnelCoupling('modular', holding('gravity', 'trestle', config), site).join()).toMatch(/choose self-standing supports/);
      expect(l.fixings.length).toBe(fixing === 'screws' ? 4 : 0);
      const steps = tunnelCouplingSteps('modular', held, site);
      expect(steps.at(-1)?.detail, fixing).toMatch({ screws: /6 × 100/, strap: /strap/, dowels: /dowels/, 'turn-buttons': /button/, gravity: /own weight/ }[fixing]);
      const scene = createTunnelCouplingScene('modular', held, site);
      // every fitting moves in along its own way, and is captioned while it does
      for (const motion of scene.motions.filter(m => m.role === 'screw')) expect(motion.approach.clone().normalize().dot(new THREE.Vector3(...(motion.drive ?? [0, 0, 0]))), motion.action).toBeCloseTo(-1, 6);
      // (once a window: the motions sharing it are posed together)
      for (const motion of new Map(scene.motions.filter(m => m.window[1] > m.window[0]).map(m => [`${m.stage}:${m.window.join()}`, m] as const)).values()) {
        scene.update({ ...installed, progress: motion.stage - 1 + (motion.window[0] + motion.window[1]) / 2 });
        expect(scene.caption?.(), `${fixing}: caption mid ${motion.action}`).not.toBeNull();
      }
      scene.dispose();
    }
  });

  it('lifts the second section over the dowels and sets it down onto the same bearer', () => {
    for (const fixing of ['dowels'] as const) {
      const scene = createTunnelCouplingScene('modular', holding(fixing), site);
      const second = scene.components.find(part => part.id === 'second-section')?.group; if (!second) throw new Error('second section');
      scene.update({ ...installed, progress: 3 }); const placed = bounds(second);
      expect(placed.min.z).toBeCloseTo(scene.layout.support.top, 3);
      scene.update({ ...installed, progress: 2.5 }); const coming = bounds(second);
      const lip = TUNNEL.fixing.dowel.into;
      expect(coming.min.z - placed.min.z).toBeGreaterThan(lip);
      scene.update({ ...installed, progress: 2.9 }); expect(scene.caption?.()).toMatch(/Setting the second section down/);
      scene.dispose();
    }
  });

  it('turns each button flat over its keeper in the last stage, out again when released, never through anything', () => {
    const scene = createTunnelCouplingScene('modular', holding('turn-buttons'), site);
    const { buttons, keepers } = scene.hold; const s = scene.layout.support;
    expect(buttons).toHaveLength(4); expect(keepers).toHaveLength(4);
    const corners = [-0.5, 0.5].flatMap(x => [-0.5, 0, 0.5].flatMap(y => [-0.5, 0.5].map(z => new THREE.Vector3(x, y, z))));
    /** Points of a button: its box's corners and edges' middles, and round its rounded end. */
    const points = (b: (typeof buttons)[number]) => {
      const [box, disc] = b.arm.children; if (!box || !disc) throw new Error('button');
      const round = Array.from({ length: 16 }, (_, i) => [-0.5, 0.5].map(y => new THREE.Vector3(Math.cos(i * Math.PI / 8), y, Math.sin(i * Math.PI / 8)).applyMatrix4(disc.matrixWorld))).flat();
      return [...corners.map(c => c.clone().applyMatrix4(box.matrixWorld)), ...round];
    };
    /** Whether a world point is inside a box mesh (its unit cube, shrunk by 0.05 mm). */
    const inside = (mesh: THREE.Object3D, q: THREE.Vector3) => {
      const local = q.clone().applyMatrix4(mesh.matrixWorld.clone().invert()); const scale = mesh.getWorldScale(new THREE.Vector3());
      const half = [scale.x / 2, scale.y / 2, scale.z / 2];
      return [local.x * scale.x, local.y * scale.y, local.z * scale.z].every((v, i) => Math.abs(v) < (half[i] ?? 0) - 0.05);
    };
    const keeperMesh = (k: (typeof keepers)[number]) => k.group.children[0] as THREE.Object3D;
    const buttonMesh = (b: (typeof buttons)[number]) => b.arm.children[0] as THREE.Object3D;
    for (let progress = 4; progress <= 5.0001; progress += 0.02) {
      scene.update({ ...installed, progress });
      for (const b of buttons) for (const q of points(b)) {
        // never into the flange (or the bearer): always out from the flush face
        expect(vec.dot(vec.sub(q.toArray(), s.at), vec.mul(s.across, b.button.side)) - s.length / 2, `${progress}`).toBeGreaterThan(-1e-6);
        for (const k of keepers) expect(inside(keeperMesh(k), q), `button into a keeper at ${progress.toFixed(2)}`).toBe(false);
        for (const other of buttons) if (other !== b) expect(inside(buttonMesh(other), q), `button into a button at ${progress.toFixed(2)}`).toBe(false);
      }
    }
    // closed it lies over its keeper; open (and released) it points straight out, clear of it in plan
    const plan = (b: (typeof buttons)[number]) => { const box = new THREE.Box3().setFromObject(buttonMesh(b)); return box; };
    const [k0] = keepers; if (!k0) throw new Error('keeper');
    scene.update(installed);
    for (const [i, b] of buttons.entries()) {
      const k = new THREE.Box3().setFromObject(keeperMesh(keepers[i] ?? k0));
      const p = plan(b); expect(p.min.z).toBeGreaterThan(k.max.z); expect(p.intersectsBox(k.clone().expandByVector(new THREE.Vector3(0, 0, 10)))).toBe(true);
    }
    scene.update({ ...installed, progress: 4.15 }); expect(scene.caption?.()).toMatch(/Turn button: turned flat over the keeper/);
    scene.update({ ...installed, windowOpen: true });
    for (const [i, b] of buttons.entries()) {
      const k = new THREE.Box3().setFromObject(keeperMesh(keepers[i] ?? k0)).expandByVector(new THREE.Vector3(0, 0, 10));
      expect(plan(b).intersectsBox(k)).toBe(false);
      // pointing out: its far end well beyond the flush face
      expect(Math.max(...points(b).map(q => vec.dot(vec.sub(q.toArray(), s.at), vec.mul(s.across, b.button.side)) - s.length / 2))).toBeGreaterThan(20);
    }
    scene.dispose();
  });
});

describe('tunnel–tunnel coupling settings', () => {
  it('starts coupled, and reads a saved coupling (the legacy import’s), keeping only valid settings', () => {
    expect(tunnelCouplingDefinition.defaultViewing?.windowOpen).toBe(false);
    expect(TUNNEL_COUPLING_DEFAULT).toEqual({ mechanism: 'printed-latch', latchesPerSide: 2, boltsPerCoupling: 8, seal: 'e-profile', doorFixing: 'turn-buttons', jointShown: 'end-end', supportFixing: 'screws', supportBase: 'trestle' });
    expect(parseTunnelCoupling({ ...TUNNEL_COUPLING_DEFAULT, mechanism: 'bolts', boltsPerCoupling: 12, latchesPerSide: 5, seal: 'foam', doorFixing: 'latches' }))
      .toEqual({ ...TUNNEL_COUPLING_DEFAULT, mechanism: 'bolts', boltsPerCoupling: 12, doorFixing: 'latches' });
    // saved before cubes were dropped: the nearest joint, a section's end at a side port for one that met a cube
    for (const [before, now] of [['tunnel', 'end-end'], ['section-section', 'end-end'], ['section-cube', 'end-side'], ['cube-cube', 'end-side']] as const) {
      expect(parseTunnelCoupling({ ...TUNNEL_COUPLING_DEFAULT, jointShown: before })?.jointShown).toBe(now);
    }
    // saved before the bolts were the same on all four sides of the port: 6 (three a side, on two sides) is not offered, and takes the default
    expect(parseTunnelCoupling({ ...TUNNEL_COUPLING_DEFAULT, boltsPerCoupling: 6 })?.boltsPerCoupling).toBe(8);
    expect(parseTunnelCoupling('oops')).toBeNull();
    // the latches' own settings show only with the latches
    const shown = (config: TunnelCouplingConfig) => TUNNEL_COUPLING_CONTROLS.filter(c => !c.when || c.when(config)).map(c => c.key);
    expect(shown(TUNNEL_COUPLING_DEFAULT)).toEqual(['mechanism', 'latchesPerSide', 'boltsPerCoupling', 'seal', 'doorFixing', 'jointShown', 'supportFixing', 'supportBase']);
    expect(shown({ ...TUNNEL_COUPLING_DEFAULT, mechanism: 'bolts' })).toEqual(['mechanism', 'boltsPerCoupling', 'doorFixing', 'jointShown', 'supportFixing', 'supportBase']);
  });

  it('offers how the tunnel is held on its supports alike on the tunnel and on its couplings: one setting of the project', () => {
    for (const key of ['supportFixing', 'supportBase'] as const) {
      const here = SUBASSEMBLY_CONTROLS['tunnel-tunnel-coupling'].find(c => c.key === key); const there = SUBASSEMBLY_CONTROLS.tunnel.find(c => c.key === key);
      expect(here?.options).toEqual(there?.options); expect(here?.label).toBe(there?.label);
      expect(settingHome('tunnel', key)).toBe('tunnelCoupling'); expect(settingHome('tunnel-tunnel-coupling', key)).toBe('tunnelCoupling');
    }
    // which joint the view shows is the view's own, not the project's
    expect(SUBASSEMBLY_CONTROLS['tunnel-tunnel-coupling'].map(c => c.key)).not.toContain('jointShown');
    expect(tunnelCouplingDefinition.viewControls?.map(c => c.key)).toEqual(['jointShown']);
  });

  it('drops the tunnel’s old coupling bolts from a saved tunnel: they are the coupling’s now', () => {
    const config = parseTunnel({ ...TUNNEL_DEFAULT, couplingBolts: 8, portHeight: 655 });
    expect(config).toEqual({ ...TUNNEL_DEFAULT, portHeight: 655 });
    expect(config && 'couplingBolts' in config).toBe(false);
    expect(TUNNEL_CONTROLS.map(c => c.key)).not.toContain('couplingBolts');
  });
});
