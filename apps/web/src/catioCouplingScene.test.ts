import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { dimensionOf, parts, toggleLatchMechanism as TL } from '@canfactory/contracts';
import type { CatioState } from './catioScene.ts';
import { defaultSubassemblySettings, parseSubassemblySettings } from './catioSubassembly.ts';
import { couplingDefinition } from './catioSubassemblies.ts';
import { createCouplingScene, LIFT, OPEN } from './catioCouplingScene.ts';
import { partGeometry } from '@canfactory/part-geometry';
import { COUPLING, COUPLING_CONTROLS, COUPLING_DEFAULT, couplingSteps, MODULAR_DEFAULT, TUNNEL, TUNNEL_COUPLING_DEFAULT, TUNNEL_DEFAULT, tunnelSiteFor, WINDOW_INSERT_DEFAULT, type CouplingConfig, type CouplingSite } from '@canfactory/catio';

const base = tunnelSiteFor(WINDOW_INSERT_DEFAULT, MODULAR_DEFAULT);
const site: CouplingSite = { tunnel: TUNNEL_DEFAULT, joint: TUNNEL_COUPLING_DEFAULT, site: base };
/** The insert with each of its mesh fixings: the docking frame is rebated over cover battens only where there are battens. */
// every mesh fixing, pressed into the recess and hung on the window frame (its collar then lies deeper, on the frame's face)
/** Staples alone hold welded mesh only: a net needs the battens (the window insert page). */
/** Every option of every control, one at a time, from the defaults. */
const configs: CouplingConfig[] = [COUPLING_DEFAULT, ...COUPLING_CONTROLS.flatMap(control => control.options.map(option => ({ ...COUPLING_DEFAULT, [control.key]: option.value })))];
const installed: CatioState = { progress: 5, exploded: false, windowOpen: false, cutaway: false, hidden: new Set() };
const bounds = (object: THREE.Object3D) => new THREE.Box3().setFromObject(object, true);

describe('insert–tunnel coupling scene', () => {
  it('stages the build and keeps the insert, wall and support still', () => {
    const scene = createCouplingScene('modular', COUPLING_DEFAULT, site);
    expect(couplingSteps('modular', COUPLING_DEFAULT, site)).toHaveLength(6);
    scene.update({ ...installed, progress: 0 });
    const context = scene.components.filter(part => part.step === 0);
    const positions = context.map(part => part.group.position.toArray());
    for (let progress = 0; progress <= 5; progress++) {
      scene.update({ ...installed, progress, exploded: progress % 2 === 1 });
      expect(context.map(part => part.group.position.toArray())).toEqual(positions);
      for (const part of scene.components) expect(part.group.visible, `${part.id} at ${progress}`).toBe(part.step <= progress);
    }
    expect(scene.components.map(part => part.id)).toEqual(expect.arrayContaining(['wall', 'window-insert', 'wall-support', 'docking-frame', 'frame-screws', 'seal', 'catches', 'frame-latch-screws', 'first-section', 'first-section-mesh', 'latches', 'flange-latch-screws', 'floor-lip', 'lip-screws']));
    scene.update({ ...installed, cutaway: true, hidden: new Set(['hardware']) });
    expect(scene.components.find(part => part.id === 'wall')?.group.visible).toBe(false);
    expect(scene.components.filter(part => part.layer === 'hardware').every(part => !part.group.visible)).toBe(true);
    scene.dispose();
    const plain = createCouplingScene('modular', { ...COUPLING_DEFAULT, floorLip: 'none' }, site);
    expect(plain.components.map(part => part.id)).not.toContain('floor-lip');
    plain.dispose();
  });

  it('fits the latches to the first section raised, then lowers it onto its wall support and the seal', () => {
    const scene = createCouplingScene('modular', COUPLING_DEFAULT, site);
    const timber = scene.components.find(part => part.id === 'first-section')?.group; if (!timber) throw new Error('first section');
    scene.update(installed); const down = bounds(timber).min.z;
    expect(down).toBeCloseTo(scene.layout.floor - TUNNEL.flange.width, 3);
    scene.update({ ...installed, progress: 3 }); expect(scene.lift()).toBe(LIFT); expect(bounds(timber).min.z).toBeCloseTo(down + LIFT, 3);
    scene.update({ ...installed, progress: 3.5 }); expect(scene.lift()).toBeGreaterThan(0); expect(scene.lift()).toBeLessThan(LIFT);
    scene.update({ ...installed, progress: 4 }); expect(scene.lift()).toBe(0);
    // the flange's back stands at the wall gap, clear of the docking frame
    const frame = scene.components.find(part => part.id === 'docking-frame')?.group; if (!frame) throw new Error('frame');
    expect(bounds(frame).max.y).toBeCloseTo(TUNNEL.wallGap - COUPLING.printed.gap, 6);
    expect(bounds(timber).min.y).toBeCloseTo(TUNNEL.wallGap, 6);
    scene.dispose();
  });

  it('closes every lever over centre in the last stage, and opens them all when released', () => {
    const scene = createCouplingScene('modular', { ...COUPLING_DEFAULT, latch: 'gn-831', latchesPerSide: 2 }, site);
    expect(scene.levers).toHaveLength(4);
    const angles = () => scene.levers.map(lever => Math.abs(THREE.MathUtils.radToDeg(lever.rotation.z)));
    scene.update({ ...installed, progress: 4 }); for (const a of angles()) expect(a).toBeCloseTo(OPEN, 6);
    scene.update(installed); for (const a of angles()) expect(a).toBeCloseTo(0, 6);
    scene.update({ ...installed, windowOpen: true }); for (const a of angles()) expect(a).toBeCloseTo(OPEN, 6);
    // open, each lever swings outwards, away from the tunnel
    scene.levers.forEach((lever, i) => {
      const q = scene.layout.latches[i]; if (!q) throw new Error('latch');
      const end = new THREE.Vector3(0, -50, 0).applyAxisAngle(new THREE.Vector3(0, 0, 1), lever.rotation.z);
      expect(Math.sign(end.x)).toBe(q.side);
    });
    scene.dispose();
  });

  it('opens and closes the printed latches with the shared mechanism, each part on its pins', () => {
    const scene = createCouplingScene('modular', { ...COUPLING_DEFAULT, latch: 'printed', latchesPerSide: 2 }, site);
    const G = TL.TOGGLE_LATCH_GEOMETRY;
    const world = (object: THREE.Object3D, point: [number, number, number]) => new THREE.Vector3(...point).applyMatrix4(object.matrixWorld);
    const named = (lever: THREE.Object3D, name: string) => lever.parent?.children.find(child => child.name === name);
    for (const state of [installed, { ...installed, progress: 4.5 }, { ...installed, windowOpen: true }]) {
      scene.update(state);
      for (const lever of scene.levers) {
        const base = named(lever, 'toggle-latch-base'), link = named(lever, 'toggle-latch-link'); if (!base || !link) throw new Error('latch parts');
        // the lever's pivot hole on the base's pins, the link's hole on the lever's pins (both at the latch's middle)
        expect(world(lever, [G.lever.pivot[0], G.lever.middle, G.lever.pivot[1]]).distanceTo(world(base, [G.base.middle, G.base.pivot[0], G.base.pivot[1]]))).toBeLessThan(1e-3);
        expect(world(link, [G.link.hole[0], G.link.middle, G.link.hole[1]]).distanceTo(world(lever, [G.lever.pin[0], G.lever.middle, G.lever.pin[1]]))).toBeLessThan(1e-3);
      }
    }
    // locked, the lever lies over its base plate; released, it stands open and the link is off the hook
    scene.update(installed);
    const lever = scene.levers[0]; if (!lever) throw new Error('lever');
    const tip = () => world(lever, [30, G.lever.middle, 1.5]);
    const q = scene.layout.latches[0]; if (!q) throw new Error('latch');
    const closed = Math.abs(tip().x - q.faceX);
    scene.update({ ...installed, windowOpen: true });
    expect(Math.abs(tip().x - q.faceX)).toBeGreaterThan(closed + 15);
    expect(scene.components.map(part => part.id)).toEqual(expect.arrayContaining(['catches', 'latches', 'frame-latch-screws', 'flange-latch-screws']));
    scene.dispose();
  });

  it('drives every screw along its own axis, point first, and shows what moves', () => {
    for (const config of configs) {
      const scene = createCouplingScene('modular', config, site);
      for (const motion of scene.motions.filter(m => m.role === 'screw')) {
        const drive = new THREE.Vector3(...(motion.drive ?? [0, 0, 0]));
        expect(motion.approach.clone().normalize().dot(drive), motion.action).toBeCloseTo(-1, 6);
      }
      // a catch before its screws, a latch body before its screws: on the frame in stage 2, on the flange in stage 3
      for (const q of scene.layout.latches) for (const piece of ['catch', 'latch'] as const) {
        const body = scene.motions.find(m => m.role === piece && m.of === q.id); if (!body) throw new Error(`${q.id} ${piece}`);
        const screw = scene.motions.find(m => m.role === 'screw' && m.of === q.id && m.stage === body.stage);
        expect(body.window[1], `${q.id} ${piece}`).toBeLessThanOrEqual(screw?.window[0] ?? 0);
      }
      const windows = new Map<string, string>();
      for (const motion of scene.motions) {
        const key = `${motion.stage}:${motion.action}`; const window = motion.window.join();
        expect(windows.get(key) ?? window, motion.action).toBe(window); windows.set(key, window);
      }
      for (const motion of scene.motions.filter(m => m.window[1] > m.window[0])) {
        scene.update({ ...installed, progress: motion.stage - 1 + (motion.window[0] + motion.window[1]) / 2 });
        expect(scene.caption?.(), `caption mid ${motion.action}`).not.toBeNull();
      }
      for (const progress of [3.5, 4.3]) { scene.update({ ...installed, progress }); expect(scene.caption?.(), `caption at ${progress}`).not.toBeNull(); }
      scene.dispose();
    }
  });
});

describe('insert–tunnel coupling page settings', () => {
  it('offers only the modular variant, starts docked and restores valid saved settings', () => {
    const defaults = defaultSubassemblySettings(couplingDefinition);
    expect(defaults.variant).toBe('modular');
    expect(defaults.views.modular.windowOpen).toBe(false);
    const saved = JSON.stringify({ version: 1, variant: 'direct', config: { ...COUPLING_DEFAULT, latchType: 'SV', latchesPerSide: 3 }, views: { modular: { progress: 2, windowOpen: true, view: 'Mounting' } } });
    const settings = parseSubassemblySettings(couplingDefinition, saved);
    expect(settings.variant).toBe('modular');
    expect(settings.config).toEqual({ ...COUPLING_DEFAULT, latchType: 'SV' });
    expect(settings.views.modular).toMatchObject({ progress: 2, windowOpen: true, view: 'Mounting' });
    expect(parseSubassemblySettings(couplingDefinition, '{oops')).toEqual(defaults);
  });
});

describe('parts library previews of the toggle latches', () => {
  it('builds every latch to its own size', () => {
    for (const part of parts.filter(p => p.family === 'toggle-latch')) {
      const geometry = partGeometry(part); if (!geometry) throw new Error(`${part.id} has no preview`);
      geometry.computeBoundingBox(); const size = geometry.boundingBox?.getSize(new THREE.Vector3()) ?? new THREE.Vector3();
      expect(size.x, part.id).toBeCloseTo(dimensionOf(part, 'l1'), 6);
      const top = Math.max(dimensionOf(part, 'h1'), part.dimensions['h3']?.value ?? 0, part.dimensions['h4']?.value ?? 0);
      expect(size.z, part.id).toBeCloseTo(top, 6);
      geometry.dispose();
    }
  });
});
