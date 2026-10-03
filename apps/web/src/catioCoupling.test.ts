import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { COUPLING_LATCH, dimensionOf, findPart, insertTunnelCouplingConcept, partUsage, parts } from '@canfactory/contracts';
import type { CatioState } from './catioScene.ts';
import { defaultSubassemblySettings, parseSubassemblySettings } from './catioSubassembly.ts';
import { couplingDefinition } from './catioSubassemblies.ts';
import { COUPLING, COUPLING_CONTROLS, COUPLING_DECISIONS, COUPLING_DEFAULT, couplingBom, couplingFacts, couplingLayout, couplingSteps, validateCoupling, type CouplingConfig, type CouplingSite } from './catioCoupling.ts';
import { createCouplingScene, LIFT, OPEN } from './catioCouplingScene.ts';
import { TUNNEL, TUNNEL_DEFAULT, tunnelBom, tunnelSite } from './catioTunnel.ts';
import { INSERT, WINDOW_INSERT_CONTROLS, WINDOW_INSERT_DEFAULT } from './catioWindowInsert.ts';
import { fastenerClashes } from './catioSubassembly.ts';
import { partGeometry } from './partGeometry.ts';

const base = tunnelSite();
const site: CouplingSite = { tunnel: TUNNEL_DEFAULT, site: base };
/** The insert with each of its mesh fixings: the docking frame is rebated over cover battens only where there are battens. */
const sites: CouplingSite[] = (['staples-and-battens', 'staples', 'battens'] as const).map(meshFixing => ({ tunnel: TUNNEL_DEFAULT, site: { ...base, insert: { ...WINDOW_INSERT_DEFAULT, meshFixing } } }));
/** Every option of every control, one at a time, from the defaults. */
const configs: CouplingConfig[] = [COUPLING_DEFAULT, ...COUPLING_CONTROLS.flatMap(control => control.options.map(option => ({ ...COUPLING_DEFAULT, [control.key]: option.value })))];
const installed: CatioState = { progress: 5, exploded: false, windowOpen: false, cutaway: false, hidden: new Set() };
const bounds = (object: THREE.Object3D) => new THREE.Box3().setFromObject(object, true);

describe('insert–tunnel coupling', () => {
  it('frames the cat port with a docking frame that sits on the insert’s own faces and keeps the port’s clear size', () => {
    for (const s of sites) for (const config of configs) {
      const l = couplingLayout(config, s);
      expect(l.errors, JSON.stringify(config)).toEqual([]);
      const boxes = l.frame.flatMap(member => member.boxes.map(b => ({ member: member.id, min: b.center.map((c, i) => c - (b.size[i] ?? 0) / 2), max: b.center.map((c, i) => c + (b.size[i] ?? 0) / 2) })));
      const battens = s.site.insert.meshFixing !== 'staples';
      // on the threshold, round the clear opening, its face flat at 6 mm short of the flange, its back on the battens or the mesh
      expect(Math.min(...boxes.map(b => b.min[2] ?? 0))).toBeCloseTo(l.floor, 9);
      for (const b of boxes) {
        expect(b.max[1], b.member).toBeCloseTo(TUNNEL.wallGap - COUPLING.gap, 9);
        expect([l.meshFace, l.meshFace + (battens ? INSERT.batten.thickness : 0)].some(y => Math.abs((b.min[1] ?? 0) - y) < 1e-9), b.member).toBe(true);
        const inside = (b.min[0] ?? 0) >= l.w / 2 - 1e-9 || (b.max[0] ?? 0) <= -l.w / 2 + 1e-9 || (b.min[2] ?? 0) >= l.transomZ - 1e-9;
        expect(inside, `${b.member} keeps out of the port`).toBe(true);
      }
      expect(l.meshFace).toBeCloseTo(l.insert.yOut + INSERT.mesh.wire, 9);
      expect(l.frame.every(member => member.cut.includes('rebated') === battens)).toBe(true);
      // the outline above the floor is the tunnel flange's
      expect(Math.max(...boxes.map(b => b.max[0] ?? 0))).toBeCloseTo(l.w / 2 + TUNNEL.flange.width, 9);
      expect(Math.max(...boxes.map(b => b.max[2] ?? 0))).toBeCloseTo(l.transomZ + TUNNEL.flange.width, 9);
    }
  });

  it('screws the docking frame 26 mm into the jambs and transom, whatever the mesh fixing', () => {
    for (const s of sites) {
      const l = couplingLayout(COUPLING_DEFAULT, s);
      const screws = l.fasteners.filter(f => f.component === 'frame-screws');
      expect(screws.length).toBeGreaterThan(4);
      for (const f of screws) {
        const screw = findPart(f.partId); if (!screw) throw new Error(f.partId);
        const length = dimensionOf(screw, 'l');
        expect(f.direction).toEqual([0, -1, 0]);
        expect(length - (f.at[1] - l.insert.yOut), `${f.use} bite`).toBeCloseTo(26, 9);
      }
    }
  });

  it('shows on its own page whether the insert has cover battens, and that the window insert page sets it', () => {
    for (const s of sites) {
      const fact = couplingFacts('modular', COUPLING_DEFAULT, s).find(f => f.label === 'Cover battens at the port');
      const battens = s.site.insert.meshFixing !== 'staples';
      expect(fact?.value, s.site.insert.meshFixing).toBe(battens ? `Yes · frame rebated ${INSERT.batten.thickness} mm over them` : 'None · frame flat on the mesh');
      expect(fact?.from).toEqual({ page: 'window-insert', settings: ['meshFixing'] });
    }
  });

  it('keeps every docking frame screw clear of the insert’s batten screws and staples, for every way the insert is set', () => {
    const insertConfigs = [WINDOW_INSERT_DEFAULT, ...WINDOW_INSERT_CONTROLS.flatMap(control => control.options.map(option => ({ ...WINDOW_INSERT_DEFAULT, [control.key]: option.value })))];
    for (const insert of insertConfigs) for (const meshFixing of ['staples-and-battens', 'staples', 'battens'] as const) {
      const s: CouplingSite = { tunnel: TUNNEL_DEFAULT, site: { ...base, insert: { ...insert, meshFixing } } };
      const l = couplingLayout(COUPLING_DEFAULT, s);
      const frame = l.fasteners.filter(f => f.component === 'frame-screws');
      const face = l.insert.fasteners.filter(f => f.component === 'batten-screws' || f.component === 'staples');
      expect(fastenerClashes(frame, face, COUPLING.screwClearance), JSON.stringify(s.site.insert)).toEqual([]);
      expect(l.errors).toEqual([]);
      // still into the jambs and transom, not off their ends
      for (const f of frame) if (f.use.includes('stiles')) expect(f.at[2] > l.floor && f.at[2] < l.transomZ).toBe(true);
    }
    // the defaults put a batten screw on a stile's middle: that frame screw is moved off it
    const l = couplingLayout(COUPLING_DEFAULT, site);
    expect(l.fasteners.filter(f => f.component === 'frame-screws')).toHaveLength(10);
  });

  it('builds its decisions from the sizes it uses', () => {
    const l = couplingLayout(COUPLING_DEFAULT, site);
    const text = COUPLING_DECISIONS.map(d => `${d.choice} ${d.why}`).join(' ');
    expect(text).toContain(`${Math.round(l.thickness)} × ${TUNNEL.flange.width} stiles`);
    expect(text).toContain(`the joint is ${Math.round(l.flangeFront - l.meshFace)} mm deep`);
    expect(text).toContain(`lies ${Math.round(-l.meshFace)} mm inside the recess`);
    expect(COUPLING_DECISIONS.find(d => d.title === 'A docking frame on the insert')?.from).toEqual({ page: 'window-insert', settings: ['meshFixing', 'fixingPitch'] });
  });

  it('carries nothing of the tunnel on the insert: the wall support holds the flange, only the seal and the latches cross the gap', () => {
    for (const config of configs) {
      const l = couplingLayout(config, site);
      const s = l.wallSupport; const first = l.first; if (!s || !first) throw new Error('no wall support');
      expect(first.start.at).toEqual([0, TUNNEL.wallGap, l.floor]);
      // the bearer is under the first flange and meets its underside
      expect(s.top).toBeCloseTo(l.floor - TUNNEL.flange.width, 6);
      expect(s.at[1] - TUNNEL.bearer.width / 2).toBeCloseTo(TUNNEL.wallGap, 6);
      // a real gap between the frame and the flange, filled by the seal squashed from its free height
      expect(l.flangeBack - l.front).toBe(COUPLING.gap);
      expect(COUPLING.seal.height).toBeGreaterThan(COUPLING.gap);
      expect([l.seal.y0, l.seal.y1]).toEqual([l.front, l.flangeBack]);
      // the floor lip only lies on the threshold, which ends at the wall face
      if (l.lip) { expect(l.lip.z).toBe(l.floor); expect(l.lip.y0).toBeLessThan(0); expect(l.lip.y1).toBe(l.flangeFront); }
      expect(l.lip === null).toBe(config.floorLip === 'none');
    }
  });

  it('puts every latch body on the flange’s side and its catch on the docking frame’s, within the hook’s range', () => {
    for (const type of COUPLING_LATCH.types) for (const latchesPerSide of [1, 2] as const) {
      const l = couplingLayout({ ...COUPLING_DEFAULT, latchType: type, latchesPerSide }, site);
      const p = l.latchPart;
      expect(p.attributes['length']).toBe('Short (2)');
      expect(l.latches).toHaveLength(2 * latchesPerSide);
      const [b3, b4, length, w2] = (['b3', 'b4', 'l1', 'w2'] as const).map(key => dimensionOf(p, key)) as [number, number, number, number];
      for (const q of l.latches) {
        expect(Math.abs(q.faceX)).toBe(l.w / 2 + TUNNEL.flange.width);
        expect(q.baseY).toBeGreaterThanOrEqual(l.flangeBack); expect(q.hingeY).toBeLessThanOrEqual(l.flangeFront); expect(q.hingeY - q.baseY).toBe(b3);
        expect(q.catchY).toBeGreaterThanOrEqual(l.meshFace); expect(q.catchY + b4).toBeLessThanOrEqual(l.front);
        // set to the middle of its range: the joint may end up w2/2 nearer or further and still close
        expect(q.hingeY - q.catchY - length).toBeCloseTo(w2 / 2, 9);
        expect(q.z).toBeGreaterThan(l.floor); expect(q.z).toBeLessThan(l.transomZ + TUNNEL.flange.width);
      }
      expect(l.tolerance).toBe(w2 / 2);
    }
    // the long type would hang its catch off the back of the frame: the joint is too shallow for it
    const long = findPart('ganter-gn-831-100-a-ni-1'); if (!long) throw new Error('long latch');
    const l = couplingLayout(COUPLING_DEFAULT, site);
    expect(l.flangeFront - COUPLING.latchInset - dimensionOf(long, 'l1') - dimensionOf(long, 'w2') / 2).toBeLessThan(l.meshFace);
  });

  it('explains what cannot be built', () => {
    const tall: CouplingSite = { tunnel: TUNNEL_DEFAULT, site: { ...base, window: { ...base.window, tunnel: { width: 300, height: 800 } }, h: 800 } };
    expect(validateCoupling('modular', COUPLING_DEFAULT, tall).join(' ')).toMatch(/head rail/);
    const wide: CouplingSite = { tunnel: TUNNEL_DEFAULT, site: { ...base, window: { ...base.window, tunnel: { width: 760, height: 300 } }, w: 760 } };
    expect(validateCoupling('modular', COUPLING_DEFAULT, wide).join(' ')).toMatch(/does not fit between the collar stiles/);
  });
});

describe('insert–tunnel coupling parts list', () => {
  it('counts every latch, screw and seal from the layout, all from the parts library', () => {
    for (const s of sites) for (const config of configs) {
      const l = couplingLayout(config, s);
      const lines = couplingBom('modular', config, s);
      const count = (id: string) => lines.find(line => line.partId === id)?.quantity ?? 0;
      for (const line of lines) {
        expect(line.quantity, line.id).toBeGreaterThan(0);
        if (line.partId) expect(findPart(line.partId), line.partId).toBeDefined();
      }
      expect(count(l.latchPart.id)).toBe(2 * config.latchesPerSide);
      expect(l.latchPart.id).toBe(`ganter-gn-831-100-${config.latchType.toLowerCase()}-${config.latchMaterial.toLowerCase()}-2`);
      expect(count('din-7997-5x60')).toBe(l.fasteners.filter(f => f.component === 'frame-screws').length);
      // two screws in each latch body and each catch, and three through the lip
      expect(count('din-7997-4x25')).toBe(4 * l.latches.length + (l.lip ? 3 : 0));
      expect(lines.find(line => line.id === 'frame-stile')?.quantity).toBe(2);
      expect(lines.find(line => line.id === 'frame-head')?.quantity).toBe(1);
      expect(lines.find(line => line.id === 'frame-stile')?.size).toMatch(/^32 × 70 · 300 long/);
      expect(lines.some(line => line.id === 'floor-lip')).toBe(config.floorLip === 'rubber-lip');
      expect(lines.find(line => line.id === 'seal')?.size).toContain(`${Math.ceil(l.seal.length / 10) * 10} long`);
    }
  });

  it('links every library part it can use back to this page in the parts library', () => {
    const used = new Set(configs.flatMap(config => [...COUPLING_LATCH.types].flatMap(latchType => [...COUPLING_LATCH.materials].flatMap(latchMaterial =>
      couplingBom('modular', { ...config, latchType, latchMaterial }, site).flatMap(line => line.partId ? [line.partId] : [])))));
    expect([...used].sort()).toEqual([...new Set(insertTunnelCouplingConcept.parts.map(link => link.partId))].sort());
    for (const id of used) {
      const p = findPart(id); if (!p) throw new Error(id);
      expect(partUsage(p).filter(use => use.kind === 'concept').map(use => use.modelId), id).toContain('catio/insert-tunnel-coupling');
    }
  });

  it('leaves the old foam strip out of the tunnel’s parts list: the coupling closes the window end now', () => {
    expect(tunnelBom('modular', TUNNEL_DEFAULT, base).some(line => /foam/i.test(line.name))).toBe(false);
  });
});

describe('insert–tunnel coupling scene', () => {
  it('stages the build and keeps the insert, wall and support still', () => {
    const scene = createCouplingScene('modular', COUPLING_DEFAULT, site);
    expect(couplingSteps('modular', COUPLING_DEFAULT)).toHaveLength(6);
    scene.update({ ...installed, progress: 0 });
    const context = scene.components.filter(part => part.step === 0);
    const positions = context.map(part => part.group.position.toArray());
    for (let progress = 0; progress <= 5; progress++) {
      scene.update({ ...installed, progress, exploded: progress % 2 === 1 });
      expect(context.map(part => part.group.position.toArray())).toEqual(positions);
      for (const part of scene.components) expect(part.group.visible, `${part.id} at ${progress}`).toBe(part.step <= progress);
    }
    expect(scene.components.map(part => part.id)).toEqual(expect.arrayContaining(['wall', 'window-insert', 'wall-support', 'docking-frame', 'frame-screws', 'seal', 'catches', 'catch-screws', 'first-section', 'first-section-mesh', 'latches', 'latch-screws', 'floor-lip', 'lip-screws']));
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
    expect(bounds(frame).max.y).toBeCloseTo(TUNNEL.wallGap - COUPLING.gap, 6);
    expect(bounds(timber).min.y).toBeCloseTo(TUNNEL.wallGap, 6);
    scene.dispose();
  });

  it('closes every lever over centre in the last stage, and opens them all when released', () => {
    const scene = createCouplingScene('modular', { ...COUPLING_DEFAULT, latchesPerSide: 2 }, site);
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

  it('drives every screw along its own axis, point first, and shows what moves', () => {
    for (const config of configs) {
      const scene = createCouplingScene('modular', config, site);
      for (const motion of scene.motions.filter(m => m.role === 'screw')) {
        const drive = new THREE.Vector3(...(motion.drive ?? [0, 0, 0]));
        expect(motion.approach.clone().normalize().dot(drive), motion.action).toBeCloseTo(-1, 6);
      }
      // a catch before its screws, a latch body before its screws
      for (const q of scene.layout.latches) for (const [piece, screws] of [['catch', 2], ['latch', 3]] as const) {
        const body = scene.motions.find(m => m.role === piece && m.of === q.id);
        const screw = scene.motions.find(m => m.role === 'screw' && m.of === q.id && m.stage === screws);
        expect(body?.window[1]).toBeLessThanOrEqual(screw?.window[0] ?? 0);
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
