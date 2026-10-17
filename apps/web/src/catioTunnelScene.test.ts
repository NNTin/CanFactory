import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { toggleLatchMechanism as TL } from '@canfactory/contracts';
import type { CatioState } from './catioScene.ts';
import { defaultSubassemblySettings, parseSubassemblySettings } from './catioSubassembly.ts';
import { tunnelDefinition } from './catioSubassemblies.ts';
import { createTunnelScene, LIFT } from './catioTunnelScene.ts';
import { COUPLING_DEFAULT, MODULAR_DEFAULT, PORT_MOVED, SUPPORT_FIXINGS, TUNNEL_CONTROLS, TUNNEL_COUPLING_DEFAULT, TUNNEL_DEFAULT, tunnelLayout, tunnelPresets, tunnelSiteFor, tunnelSteps, WINDOW_INSERT_DEFAULT, type TunnelConfig, type TunnelCouplingConfig } from '@canfactory/catio';
const site = tunnelSiteFor(WINDOW_INSERT_DEFAULT, MODULAR_DEFAULT);
const TUNNEL_PRESETS = tunnelPresets(() => ({ site, joint: TUNNEL_COUPLING_DEFAULT }));
const installed: CatioState = { progress: 6, exploded: false, windowOpen: true, cutaway: false, hidden: new Set() };
const bolted: TunnelCouplingConfig = { ...TUNNEL_COUPLING_DEFAULT, mechanism: 'bolts' };

describe('tunnel held on its supports', () => {
  /** A straight route with section-to-section couplings: two flanges over a bearer, where the latch and the buttons fit. */
  const straight: TunnelConfig = { ...TUNNEL_DEFAULT, portX: 0, portY: 3000, portLevel: 'window', sectionLength: 1 };

  it('stages every fixing: fittings on the levelled supports, buttons on the flanges, the hold-down last, each along its own way', () => {
    for (const fixing of SUPPORT_FIXINGS) {
      const config = { ...straight, supportFixing: fixing, supportBase: 'self-standing' as const };
      const scene = createTunnelScene('modular', config, site, TUNNEL_COUPLING_DEFAULT, COUPLING_DEFAULT);
      for (const motion of scene.motions.filter(m => m.role === 'screw')) expect(motion.approach.clone().normalize().dot(new THREE.Vector3(...(motion.drive ?? [0, 0, 0]))), motion.action).toBeCloseTo(-1, 6);
      const moments = new Map(scene.motions.filter(m => m.window[1] > m.window[0]).map(m => [m.stage - 1 + (m.window[0] + m.window[1]) / 2, m.action]));
      for (const [progress, action] of moments) {
        scene.update({ ...installed, progress });
        expect(scene.caption?.(), `${fixing}: caption mid ${action}`).not.toBeNull();
      }
      const ids = scene.components.map(part => part.id);
      expect(ids.includes('support-fixings'), fixing).toBe(['dowels', 'strap', 'turn-buttons'].includes(fixing));
      expect(ids.includes('flange-screws'), fixing).toBe(fixing === 'screws');
      expect(ids.includes('straps'), fixing).toBe(fixing === 'strap');
      expect(ids.includes('turn-buttons'), fixing).toBe(fixing === 'turn-buttons');
      expect(scene.layout.supports.every(s => s.stands)).toBe(true);
      scene.dispose();
    }
  });
});

describe('tunnel scene', () => {
  const bounds = (object: THREE.Object3D) => new THREE.Box3().setFromObject(object, true);

  it('stages the build and keeps the site still', () => {
    const scene = createTunnelScene('modular', TUNNEL_DEFAULT, site, TUNNEL_COUPLING_DEFAULT, COUPLING_DEFAULT);
    expect(tunnelSteps('modular', TUNNEL_DEFAULT, site, TUNNEL_COUPLING_DEFAULT)).toHaveLength(7);
    scene.update({ ...installed, progress: 0 });
    const context = scene.components.filter(part => part.step === 0);
    const positions = context.map(part => part.group.position.toArray());
    for (let progress = 0; progress <= 6; progress++) {
      scene.update({ ...installed, progress, exploded: progress % 2 === 1 });
      expect(context.map(part => part.group.position.toArray())).toEqual(positions);
      for (const part of scene.components) expect(part.group.visible, `${part.id} at ${progress}`).toBe(part.step <= progress);
    }
    expect(scene.components.map(part => part.id)).toEqual(expect.arrayContaining(['terrain', 'window-insert', 'enclosure-port', 'slabs', 'legs', 'levelling-feet', 'bearers', 'flanges', 'rails', 'mesh', 'staples', 'section-latches', 'section-latch-screws', 'section-seals', 'flange-screws', 'docking-frame', 'coupling-latches', 'doors', 'door-mesh', 'door-hardware']));
    // printed latches at every coupling by default, the enclosure end too: no bolts; bolted, no latches
    expect(scene.components.map(part => part.id)).not.toContain('coupling-bolts');
    expect(scene.components.map(part => part.id)).not.toContain('port-bolts');
    scene.update({ ...installed, cutaway: true, hidden: new Set(['mesh']) });
    expect(scene.components.find(part => part.id === 'wall')?.group.visible).toBe(false);
    expect(scene.components.filter(part => part.layer === 'mesh').every(part => !part.group.visible)).toBe(true);
    scene.dispose();
  });

  it('raises the sections while they are built and lowers them onto the supports in order from the window', () => {
    const scene = createTunnelScene('modular', TUNNEL_DEFAULT, site, TUNNEL_COUPLING_DEFAULT, COUPLING_DEFAULT);
    const flanges = scene.components.find(part => part.id === 'flanges')?.group; if (!flanges) throw new Error('flanges');
    scene.update({ ...installed }); const down = bounds(flanges).min.z;
    scene.update({ ...installed, progress: 4 }); expect(bounds(flanges).min.z).toBeCloseTo(down + LIFT, 6);
    const order = scene.layout.pieces.map(p => p.id);
    scene.update({ ...installed, progress: 4.25 });
    const lifts = order.map(id => scene.carriers.get(id) ?? 0);
    expect(lifts[0]).toBe(0); expect(lifts.at(-1)).toBe(LIFT);
    for (const [i, lift] of lifts.entries()) if (i > 0) expect(lift).toBeGreaterThanOrEqual(lifts[i - 1] ?? 0);
    scene.dispose();
  });

  it('latches every square coupling with the shared printed latch, closed over centre once the pieces are down, each part on its pins', () => {
    const scene = createTunnelScene('modular', TUNNEL_DEFAULT, site, TUNNEL_COUPLING_DEFAULT, COUPLING_DEFAULT);
    const latched = scene.layout.couplings.filter(c => c.kind === 'latched');
    expect(scene.levers).toHaveLength(latched.reduce((n, c) => n + c.latches.length, 0));
    const G = TL.TOGGLE_LATCH_GEOMETRY;
    const world = (object: THREE.Object3D, point: [number, number, number]) => new THREE.Vector3(...point).applyMatrix4(object.matrixWorld);
    const named = (lever: THREE.Object3D, name: string) => lever.parent?.children.find(child => child.name === name);
    const tip = (lever: THREE.Object3D) => world(lever, [30, G.lever.middle, 1.5]);
    scene.update({ ...installed, progress: 4.5 }); const open = scene.levers.map(q => tip(q.lever).distanceTo(new THREE.Vector3(...q.mount.at)));
    scene.update(installed);
    scene.levers.forEach((q, i) => {
      const base = named(q.lever, 'toggle-latch-base'), link = named(q.lever, 'toggle-latch-link'); if (!base || !link) throw new Error('latch parts');
      expect(world(q.lever, [G.lever.pivot[0], G.lever.middle, G.lever.pivot[1]]).distanceTo(world(base, [G.base.middle, G.base.pivot[0], G.base.pivot[1]]))).toBeLessThan(1e-3);
      expect(world(link, [G.link.hole[0], G.link.middle, G.link.hole[1]]).distanceTo(world(q.lever, [G.lever.pin[0], G.lever.middle, G.lever.pin[1]]))).toBeLessThan(1e-3);
      // closed, the lever lies along the joint, much nearer the plates than it stood open
      expect(tip(q.lever).distanceTo(new THREE.Vector3(...q.mount.at))).toBeLessThan(open[i] ?? 0);
    });
    scene.dispose();
  });

  it('levels each support from its feet: low until stage 2, at its height after', () => {
    const scene = createTunnelScene('modular', TUNNEL_DEFAULT, site, TUNNEL_COUPLING_DEFAULT, COUPLING_DEFAULT);
    const bearers = scene.motions.filter(m => m.role === 'bearer');
    scene.update({ ...installed, progress: 1 }); const low = bearers.map(m => m.object.position.z);
    scene.update({ ...installed, progress: 2 }); const high = bearers.map(m => m.object.position.z);
    bearers.forEach((m, i) => expect((high[i] ?? 0) - (low[i] ?? 0)).toBeCloseTo(scene.drops.get(m.support ?? '') ?? NaN, 6));
    // installed, the tunnel rests on its bearers
    scene.update(installed);
    for (const s of scene.layout.supports) {
      const bearer = scene.motions.find(m => m.role === 'bearer' && m.support === s.id); if (!bearer) throw new Error(s.id);
      expect(bounds(bearer.object).max.z, s.id).toBeCloseTo(s.top, 0);
    }
    scene.dispose();
  });

  it('drives every fastener along its own axis, point first, in its order: nut before foot, bolt before nut', () => {
    for (const [config, joint] of [[TUNNEL_DEFAULT, TUNNEL_COUPLING_DEFAULT], [{ ...TUNNEL_DEFAULT, angleJoint: 'mitred-ends' as const }, { ...bolted, boltsPerCoupling: 8 as const }], [{ ...TUNNEL_DEFAULT, angleJoint: 'mitred-ends' as const }, TUNNEL_COUPLING_DEFAULT]] as const) {
      const scene = createTunnelScene('modular', config, site, joint, COUPLING_DEFAULT);
      for (const motion of scene.motions.filter(m => m.role === 'screw' || m.role === 'staple' || m.role === 'bolt')) {
        const drive = new THREE.Vector3(...(motion.drive ?? [0, 0, 0]));
        expect(motion.approach.clone().normalize().dot(drive), motion.action).toBeCloseTo(-1, 6);
      }
      for (const s of scene.layout.supports) for (const f of s.feet) {
        const of = (role: string) => scene.motions.find(m => m.of === f.id && m.role === role);
        expect(of('insert-nut')?.window[1]).toBeLessThanOrEqual(of('foot')?.window[0] ?? 0);
        expect(of('slab')?.window[1]).toBeLessThanOrEqual(of('insert-nut')?.window[0] ?? 0);
      }
      for (const c of scene.layout.couplings) c.bolts.forEach((_, i) => {
        const bolt = scene.motions.find(m => m.of === `${c.id}-${i}` && m.role === 'bolt'); const nut = scene.motions.find(m => m.of === `${c.id}-${i}` && m.role === 'nut');
        expect(bolt?.window[1]).toBeLessThanOrEqual(nut?.window[0] ?? 0);
      });
      // pieces of one kind move together: one caption, one window
      const windows = new Map<string, string>();
      for (const motion of scene.motions) {
        const key = `${motion.stage}:${motion.action}`; const window = motion.window.join();
        expect(windows.get(key) ?? window, motion.action).toBe(window); windows.set(key, window);
      }
      // a caption mid every window (once a window: the motions sharing it are posed together)
      const mid = new Map(scene.motions.filter(m => m.stage >= 1 && m.stage <= 6).map(m => [`${m.stage}:${m.window.join()}`, m] as const));
      for (const motion of mid.values()) {
        scene.update({ ...installed, progress: motion.stage - 1 + (motion.window[0] + motion.window[1]) / 2 });
        expect(scene.caption?.(), `caption mid ${motion.action}`).not.toBeNull();
      }
      scene.dispose();
    }
  });
});

describe('tunnel presets', () => {

  it('builds every preset, each one a valid saved design', () => {
    for (const p of TUNNEL_PRESETS) {
      const config = p.config();
      expect(tunnelLayout(config, site, TUNNEL_COUPLING_DEFAULT).errors, p.id).toEqual([]);
      expect(parseSubassemblySettings(tunnelDefinition, JSON.stringify({ version: 1, config })).config, p.id).toEqual(config);
    }
  });

});

describe('tunnel page settings', () => {
  it('offers only the modular variant and restores valid saved settings', () => {
    expect(defaultSubassemblySettings(tunnelDefinition).variant).toBe('modular');
    const saved = JSON.stringify({ version: 1, variant: 'direct', config: { ...TUNNEL_DEFAULT, portHeight: 655, portFacing: 400, angleJoint: 'glued' }, views: { modular: { progress: 2, view: 'Top' } } });
    const settings = parseSubassemblySettings(tunnelDefinition, saved);
    expect(settings.variant).toBe('modular');
    expect(settings.config.portHeight).toBe(655);
    expect(settings.config.portFacing).toBe(TUNNEL_DEFAULT.portFacing);
    expect(settings.config.angleJoint).toBe(TUNNEL_DEFAULT.angleJoint);
    expect(settings.views.modular).toMatchObject({ progress: 2, view: 'Top' });
    // a tunnel saved before the standard elements: its route and its joints as saved, its longest section the nearest whole pitches
    for (const [sectionLength, pitches] of [[500, 1], [750, 2], [1000, 2]] as const) {
      const old = parseSubassemblySettings(tunnelDefinition, JSON.stringify({ version: 1, config: { ...TUNNEL_DEFAULT, angleJoint: 'angle-collar', portX: 1200, portY: 3000, sectionLength } }));
      expect(old.config).toMatchObject({ angleJoint: 'angle-collar', portX: 1200, portY: 3000, sectionLength: pitches });
      // laid out on whole elements: the brief says where that puts the port
      expect(tunnelLayout(old.config, site, TUNNEL_COUPLING_DEFAULT).moved).toBeGreaterThan(PORT_MOVED);
    }
    // off a step is not accepted either
    expect(parseSubassemblySettings(tunnelDefinition, JSON.stringify({ version: 1, config: { ...TUNNEL_DEFAULT, portHeight: 657.3 } })).config.portHeight).toBe(TUNNEL_DEFAULT.portHeight);
  });
});

describe('tunnel: the rest of the standard elements', () => {
  it('loads a tunnel saved with cube corners as one turning at side ports, its runs of cubes as long sections', () => {
    const saved = parseSubassemblySettings(tunnelDefinition, JSON.stringify({ version: 1, config: { ...TUNNEL_DEFAULT, angleJoint: 'cube-corner', straights: 'cubes', portFacing: 90, portX: 2200 } })).config;
    expect(saved).toEqual({ ...TUNNEL_DEFAULT, angleJoint: 'side-port', portFacing: 90, portX: 2200 });
    expect(Object.keys(saved)).not.toContain('straights');
    expect(tunnelLayout(saved, site, TUNNEL_COUPLING_DEFAULT).joints.filter(j => j.kind === 'turn').every(j => j.side !== null)).toBe(true);
    // collars and mitres saved stay as they were
    expect(parseSubassemblySettings(tunnelDefinition, JSON.stringify({ version: 1, config: { ...TUNNEL_DEFAULT, angleJoint: 'mitred-ends', straights: 'long' } })).config.angleJoint).toBe('mitred-ends');
  });

  it('offers only what side-port turns can make for the port’s facing, and any facing with collars', () => {
    const facing = (config: TunnelConfig) => TUNNEL_CONTROLS.filter(c => c.key === 'portFacing' && (!c.when || c.when(config)));
    const square = facing(TUNNEL_DEFAULT); expect(square).toHaveLength(1);
    expect(square[0]?.range).toBeUndefined(); expect(square[0]?.options.map(o => o.value)).toEqual([-90, 0, 90]);
    const collar = facing({ ...TUNNEL_DEFAULT, angleJoint: 'angle-collar' }); expect(collar).toHaveLength(1); expect(collar[0]?.range).toBeDefined();
    // a facing saved at another angle stays saved, and is laid out at the nearest a side port makes
    const saved = parseSubassemblySettings(tunnelDefinition, JSON.stringify({ version: 1, config: { ...TUNNEL_DEFAULT, portFacing: 37 } })).config;
    expect(saved.portFacing).toBe(37);
    expect(tunnelLayout(saved, site, TUNNEL_COUPLING_DEFAULT).facingMoved).toBeCloseTo(37, 9);
  });

  it('shows the enclosure’s own cat-port panel at the far end, seated, with removable panels', () => {
    const scene = createTunnelScene('modular', TUNNEL_DEFAULT, site, TUNNEL_COUPLING_DEFAULT, COUPLING_DEFAULT);
    if (site.window.closure === 'removable-panel') {
      expect(scene.enclosureClosure).not.toBeNull();
      expect(scene.components.map(c => c.id)).toEqual(expect.arrayContaining(['enclosure-port-closure', 'enclosure-port-closure-mesh', 'enclosure-port-closure-hardware']));
    } else expect(scene.enclosureClosure).toBeNull();
    scene.dispose();
  });
});
