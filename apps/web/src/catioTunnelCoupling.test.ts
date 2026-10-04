import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { findPart, partUsage, toggleLatchMechanism as TL, tunnelTunnelCouplingConcept } from '@canfactory/contracts';
import type { CatioState } from './catioScene.ts';
import { defaultSubassemblySettings, fastenerClashes, loadSubassemblySettings, parseSubassemblySettings, saveShared, subassemblyStorageKey } from './catioSubassembly.ts';
import { dependentsOf, tunnelCouplingDefinition, tunnelDefinition } from './catioSubassemblies.ts';
import { PRINTED_LATCH, PRINTED_LATCH_JOINT } from './catioPrintedLatch.ts';
import { LATCH_SCREW_CLEARANCE, SUPPORT_FIXINGS, TUNNEL, TUNNEL_DEFAULT, tunnelSite, vec, type SupportFixing, type TunnelConfig } from './catioTunnel.ts';
import {
  TUNNEL_COUPLING, TUNNEL_COUPLING_CONTROLS, validateTunnelCoupling, TUNNEL_COUPLING_DECISIONS, TUNNEL_COUPLING_DEFAULT, tunnelCouplingBom, tunnelCouplingFacts, tunnelCouplingLayout, tunnelCouplingSteps,
  type TunnelCouplingConfig, type TunnelCouplingSite,
} from './catioTunnelCoupling.ts';
import { createTunnelCouplingScene, LIFT } from './catioTunnelCouplingScene.ts';

const base = tunnelSite();
const site: TunnelCouplingSite = { tunnel: TUNNEL_DEFAULT, site: base };
/** Every option of every control, one at a time, from the defaults, and bolted with every count. */
// (gravity only needs self-standing supports)
const configs: TunnelCouplingConfig[] = [TUNNEL_COUPLING_DEFAULT, ...TUNNEL_COUPLING_CONTROLS.flatMap(control => control.options.map(option => ({ ...TUNNEL_COUPLING_DEFAULT, [control.key]: option.value })))
  .map(config => config.supportFixing === 'gravity' ? { ...config, supportBase: 'self-standing' as const } : config),
  ...([4, 8] as const).map(boltsPerCoupling => ({ ...TUNNEL_COUPLING_DEFAULT, mechanism: 'bolts' as const, boltsPerCoupling }))];
/** The tunnel's sections at every length, with its feet, and the catio's smallest and largest clear tunnel. */
const sites: TunnelCouplingSite[] = [site, ...([500, 1000] as const).map(sectionLength => ({ tunnel: { ...TUNNEL_DEFAULT, sectionLength }, site: base })),
  { tunnel: { ...TUNNEL_DEFAULT, footPad: 'ganter' } satisfies TunnelConfig, site: base },
  ...[[200, 200], [450, 450]].map(([w = 0, h = 0]) => ({ tunnel: TUNNEL_DEFAULT, site: { ...base, w, h } }))];
const installed: CatioState = { progress: 5, exploded: false, windowOpen: false, cutaway: false, hidden: new Set() };
const bounds = (object: THREE.Object3D) => new THREE.Box3().setFromObject(object, true);

describe('tunnel–tunnel coupling', () => {
  it('joins two identical sections of the tunnel’s longest length, on the support under the joint, at its own height', () => {
    for (const s of sites) for (const config of configs) {
      const l = tunnelCouplingLayout(config, s);
      expect(l.errors, `${JSON.stringify(config)} ${JSON.stringify(s.tunnel.sectionLength)} ${s.site.w}`).toEqual([]);
      expect(l.before.length).toBeCloseTo(s.tunnel.sectionLength, 9); expect(l.after.length).toBeCloseTo(s.tunnel.sectionLength, 9);
      expect(l.before.kind).toBe('section'); expect(l.after.kind).toBe('section');
      // straight on and level, the floor at the page's height wherever the window insert puts the window port
      expect(l.before.frame.y).toEqual(l.after.frame.y); expect(l.before.pitch).toBe(0);
      expect(l.before.start.at[2]).toBe(TUNNEL_COUPLING.floor);
      // the second starts the gap after the first: 3 mm latched, flange to flange bolted
      const gap = config.mechanism === 'printed-latch' ? PRINTED_LATCH_JOINT.gap : 0;
      expect(l.coupling.kind).toBe(config.mechanism === 'printed-latch' ? 'latched' : 'bolted');
      expect(vec.len(vec.sub(l.after.start.at, l.before.end.at))).toBeCloseTo(gap, 9);
      // the bearer is under the middle of the gap and carries both flanges, two screws up into each
      expect(l.support.at[1]).toBeCloseTo(l.coupling.face.at[1] - gap / 2, 9);
      expect(l.support.top + l.support.seat).toBeCloseTo(TUNNEL_COUPLING.floor - TUNNEL.flange.width, 6);
      expect(l.fixings).toHaveLength(config.supportFixing === 'screws' ? 4 : 0);
      for (const f of l.fixings) {
        const into = f.at[1] < l.coupling.face.at[1] ? l.before.end.at[1] - TUNNEL.flange.thickness / 2 : l.after.start.at[1] + TUNNEL.flange.thickness / 2;
        expect(f.at[1]).toBeCloseTo(into, 9); expect(f.direction).toEqual([0, 0, 1]);
      }
      expect(l.support.kind).toBe('trestle');
    }
  });

  it('puts each printed latch across the gap with the shared mechanism: base on the first flange, catch on the second, in line, pulling along the tunnel', () => {
    for (const s of sites) for (const latchesPerSide of [1, 2, 3] as const) {
      const l = tunnelCouplingLayout({ ...TUNNEL_COUPLING_DEFAULT, latchesPerSide }, s);
      expect(l.latches).toHaveLength(2 * latchesPerSide); expect(l.bolts).toEqual([]);
      const face = l.coupling.face; const T = TUNNEL.flange.thickness;
      // locked, the plates stand as far apart as the over-centre lock sets them; each reaches as far into the gap
      expect(PRINTED_LATCH.locked).toBeCloseTo(-TL.tautLink(TL.CLOSED).offset, 9);
      expect(2 * PRINTED_LATCH.overhang + PRINTED_LATCH.locked).toBeCloseTo(l.gap, 9);
      for (const q of l.latches) {
        expect(q.pull.map(c => c + 0)).toEqual([0, -1, 0]); expect(Math.abs(q.at[0])).toBeCloseTo(l.w / 2 + TUNNEL.flange.width, 9);
        expect(q.out[0]).toBe(q.side);
        // the seam is `overhang` proud of the first flange's face; its base plate lies within that flange's thickness
        const first = face.at[1] - l.gap;
        expect(first - q.at[1]).toBeCloseTo(-PRINTED_LATCH.overhang, 9);
        expect(PRINTED_LATCH.along - PRINTED_LATCH.overhang).toBeLessThanOrEqual(T);
        // standing on the flange's side, clear of the bearer under it and of its top
        expect(q.at[2] - PRINTED_LATCH.length / 2).toBeGreaterThan(l.support.top);
        expect(q.at[2] + PRINTED_LATCH.length / 2).toBeLessThan(TUNNEL_COUPLING.floor + l.h + TUNNEL.flange.width);
      }
      // two screws through each plate, at least 5 mm into its flange's timber, and clear of the bearer's screws and the rails'
      expect(l.latchScrews).toHaveLength(4 * l.latches.length);
      for (const f of l.latchScrews) {
        expect(f.partId).toBe('din-7997-4x25');
        const depth = f.component === 'latch-screws' ? (face.at[1] - l.gap) - f.at[1] : f.at[1] - face.at[1];
        expect(depth, f.use).toBeGreaterThan(5);
        expect(depth, f.use).toBeLessThan(TUNNEL.flange.thickness);
      }
      const others = l.tl.fasteners.filter(f => (f.component === 'flange-screws' || f.component === 'rail-screws') && (f.piece === undefined || l.pieces.includes(f.piece)) && Math.abs(f.at[1] - face.at[1]) < 100);
      expect(others.length).toBeGreaterThan(4);
      expect(fastenerClashes(l.latchScrews, others, LATCH_SCREW_CLEARANCE)).toEqual([]);
      expect(fastenerClashes(others, l.latchScrews, LATCH_SCREW_CLEARANCE)).toEqual([]);
    }
  });

  it('bolts the flanges face to face with the chosen pattern', () => {
    for (const boltsPerCoupling of [4, 6, 8] as const) {
      const l = tunnelCouplingLayout({ ...TUNNEL_COUPLING_DEFAULT, mechanism: 'bolts', boltsPerCoupling }, site);
      expect(l.gap).toBe(0); expect(l.latches).toEqual([]); expect(l.seal).toBeNull();
      expect(l.bolts).toHaveLength(boltsPerCoupling);
      // outside the mesh: up the flanges' sides beside the rails, or across the head over the roof
      for (const b of l.bolts) { expect(b.n).toEqual(l.coupling.face.n); expect(Math.abs(b.at[0]) > l.w / 2 + TUNNEL.rail || b.at[2] > l.floor + l.h + TUNNEL.rail).toBe(true); }
    }
  });

  it('builds its decisions from the sizes it uses', () => {
    const text = TUNNEL_COUPLING_DECISIONS.map(d => `${d.choice} ${d.why}`).join(' ');
    expect(text).toContain(`stand ${PRINTED_LATCH_JOINT.gap} mm apart`);
    expect(text).toContain(`${Number(PRINTED_LATCH.locked.toFixed(1))} mm apart`);
    expect(text).toContain(`${Number(PRINTED_LATCH.overhang.toFixed(1))} mm proud`);
    expect(text).toContain(`${TUNNEL_COUPLING_DEFAULT.boltsPerCoupling} ISO 4017 M8 × 80 bolts`);
    expect(TUNNEL_COUPLING_DECISIONS.map(d => d.title)).toEqual(expect.arrayContaining(['No locating pins: the bearer locates', 'The enclosure end stays bolted']));
    for (const d of TUNNEL_COUPLING_DECISIONS) if (d.parameter) expect(TUNNEL_COUPLING_CONTROLS.map(c => c.label), d.title).toContain(d.parameter);
  });

  it('names where the section length is set, and what the joint is', () => {
    const facts = tunnelCouplingFacts('modular', TUNNEL_COUPLING_DEFAULT, site);
    expect(facts.find(f => f.label === 'Gap · seal')?.value).toBe('3 mm · squashed from 4 mm');
    expect(facts.find(f => f.label === 'Section length')).toMatchObject({ value: '75 cm · the longest section', from: { page: 'tunnel', settings: ['sectionLength'] } });
    expect(tunnelCouplingFacts('modular', { ...TUNNEL_COUPLING_DEFAULT, seal: 'none' }, site).find(f => f.label === 'Gap · seal')?.value).toBe('3 mm · left open');
    expect(tunnelCouplingFacts('modular', { ...TUNNEL_COUPLING_DEFAULT, mechanism: 'bolts' }, site).find(f => f.label === 'Bolts per coupling')?.value).toMatch(/^6 × ISO 4017 M8 × 80/);
  });
});

describe('tunnel–tunnel coupling parts list', () => {
  it('counts the latches, their screws and the seal, or the bolts, washers and nuts, and the two sections’ timber and mesh', () => {
    for (const s of sites) for (const config of configs) {
      const l = tunnelCouplingLayout(config, s);
      const lines = tunnelCouplingBom('modular', config, s);
      const count = (id: string) => lines.find(line => line.partId === id)?.quantity ?? 0;
      for (const line of lines) {
        expect(line.quantity, line.id).toBeGreaterThan(0);
        if (line.partId) expect(findPart(line.partId), line.partId).toBeDefined();
      }
      if (config.mechanism === 'printed-latch') {
        expect(lines.find(line => line.modelId === 'toggle-latch')).toMatchObject({ quantity: 2 * config.latchesPerSide, name: 'Toggle latch, printed' });
        expect(count('din-7997-4x25')).toBe(8 * config.latchesPerSide);
        expect(lines.some(line => line.id === 'coupling-seal')).toBe(config.seal === 'e-profile');
        expect(count('iso-4017-m8x80')).toBe(0);
      } else {
        expect(count('iso-4017-m8x80')).toBe(config.boltsPerCoupling); expect(count('iso-7093-m8')).toBe(2 * config.boltsPerCoupling); expect(count('iso-4032-m8')).toBe(config.boltsPerCoupling);
        expect(lines.some(line => line.modelId)).toBe(false);
      }
      // two flange rings per section, four rails, a floor board; three mesh panels each
      expect(lines.filter(line => line.name.startsWith('Flange')).reduce((n, line) => n + line.quantity, 0)).toBe(16);
      expect(lines.filter(line => line.name === 'Section rail').reduce((n, line) => n + line.quantity, 0)).toBe(8);
      expect(lines.filter(line => line.name === 'Floor board').reduce((n, line) => n + line.quantity, 0)).toBe(2);
      expect(lines.filter(line => line.group === 'Mesh').reduce((n, line) => n + line.quantity, 0)).toBe(6);
      expect(lines.find(line => line.name === 'Floor board')?.size).toContain(`${Math.round(l.sectionLength - 2 * TUNNEL.flange.thickness)}`);
    }
  });

  it('links every library part it can use back to this page in the parts library', () => {
    const used = new Set(configs.flatMap(config => tunnelCouplingBom('modular', config, site).flatMap(line => line.partId ? [line.partId] : [])));
    expect([...used].sort()).toEqual([...new Set(tunnelTunnelCouplingConcept.parts.map(link => link.partId))].sort());
    for (const id of used) {
      const p = findPart(id); if (!p) throw new Error(id);
      expect(partUsage(p).filter(use => use.kind === 'concept').map(use => use.modelId), id).toContain('catio/tunnel-tunnel-coupling');
    }
  });
});

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
      for (const motion of scene.motions.filter(m => m.window[1] > m.window[0])) {
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
      expect(steps.at(-1)?.detail, fixing).toMatch({ screws: /6 × 100/, strap: /strap/, dowels: /dowels/, cradle: /cradles/, latch: /vertical latch/, 'turn-buttons': /button/, gravity: /own weight/ }[fixing]);
      const scene = createTunnelCouplingScene('modular', held, site);
      // every fitting moves in along its own way, and is captioned while it does
      for (const motion of scene.motions.filter(m => m.role === 'screw')) expect(motion.approach.clone().normalize().dot(new THREE.Vector3(...(motion.drive ?? [0, 0, 0]))), motion.action).toBeCloseTo(-1, 6);
      for (const motion of scene.motions.filter(m => m.window[1] > m.window[0])) {
        scene.update({ ...installed, progress: motion.stage - 1 + (motion.window[0] + motion.window[1]) / 2 });
        expect(scene.caption?.(), `${fixing}: caption mid ${motion.action}`).not.toBeNull();
      }
      scene.dispose();
    }
  });

  it('lifts the second section over dowels or cradle lips and sets it down onto the same bearer', () => {
    for (const fixing of ['dowels', 'cradle'] as const) {
      const scene = createTunnelCouplingScene('modular', holding(fixing), site);
      const second = scene.components.find(part => part.id === 'second-section')?.group; if (!second) throw new Error('second section');
      scene.update({ ...installed, progress: 3 }); const placed = bounds(second);
      expect(placed.min.z).toBeCloseTo(scene.layout.support.top + scene.layout.support.seat, 3);
      scene.update({ ...installed, progress: 2.5 }); const coming = bounds(second);
      const lip = fixing === 'dowels' ? TUNNEL.fixing.dowel.into : TUNNEL.fixing.cradle.lip;
      expect(coming.min.z - placed.min.z).toBeGreaterThan(lip);
      scene.update({ ...installed, progress: 2.9 }); expect(scene.caption?.()).toMatch(/Setting the second section down/);
      scene.dispose();
    }
  });

  it('closes the vertical latches and turns the buttons down in the last stage, and lets go when released', () => {
    const latched = createTunnelCouplingScene('modular', holding('latch'), site);
    expect(latched.hold.latches).toHaveLength(2);
    const G = TL.TOGGLE_LATCH_GEOMETRY;
    const world = (object: THREE.Object3D, point: [number, number, number]) => new THREE.Vector3(...point).applyMatrix4(object.matrixWorld);
    const tip = () => latched.hold.latches.map(q => world(q.lever, [30, G.lever.middle, 1.5]).distanceTo(new THREE.Vector3(...q.mount.at)));
    latched.update({ ...installed, progress: 4.2 }); const open = tip();
    latched.update(installed); tip().forEach((d, i) => expect(d).toBeLessThan(open[i] ?? 0));
    latched.update({ ...installed, windowOpen: true }); tip().forEach((d, i) => expect(d).toBeCloseTo(open[i] ?? 0, 6));
    latched.dispose();
    const buttons = createTunnelCouplingScene('modular', holding('turn-buttons'), site);
    expect(buttons.hold.buttons).toHaveLength(4);
    const arm = (b: (typeof buttons.hold.buttons)[number]) => b.group.children[0]?.quaternion.clone() ?? new THREE.Quaternion();
    buttons.update({ ...installed, progress: 3.9 }); const up = buttons.hold.buttons.map(arm);
    buttons.update(installed); buttons.hold.buttons.forEach((b, i) => expect(arm(b).angleTo(up[i] ?? new THREE.Quaternion())).toBeCloseTo(Math.PI / 2, 6));
    buttons.dispose();
  });
});

describe('tunnel–tunnel coupling page settings', () => {
  it('offers only the modular variant, starts coupled and restores valid saved settings', () => {
    const defaults = defaultSubassemblySettings(tunnelCouplingDefinition);
    expect(defaults.variant).toBe('modular');
    expect(defaults.views.modular.windowOpen).toBe(false);
    expect(defaults.config).toEqual({ mechanism: 'printed-latch', latchesPerSide: 2, boltsPerCoupling: 6, seal: 'e-profile', supportFixing: 'screws', supportBase: 'trestle' });
    const saved = JSON.stringify({ version: 1, variant: 'direct', config: { ...TUNNEL_COUPLING_DEFAULT, mechanism: 'bolts', boltsPerCoupling: 8, latchesPerSide: 5, seal: 'foam' }, views: { modular: { progress: 3, windowOpen: true, view: 'Mounting' } } });
    const settings = parseSubassemblySettings(tunnelCouplingDefinition, saved);
    expect(settings.variant).toBe('modular');
    expect(settings.config).toEqual({ ...TUNNEL_COUPLING_DEFAULT, mechanism: 'bolts', boltsPerCoupling: 8 });
    expect(settings.views.modular).toMatchObject({ progress: 3, windowOpen: true, view: 'Mounting' });
    expect(parseSubassemblySettings(tunnelCouplingDefinition, '{oops')).toEqual(defaults);
    // the latches' own settings show only with the latches
    const shown = (config: TunnelCouplingConfig) => TUNNEL_COUPLING_CONTROLS.filter(c => !c.when || c.when(config)).map(c => c.key);
    expect(shown(TUNNEL_COUPLING_DEFAULT)).toEqual(['mechanism', 'latchesPerSide', 'boltsPerCoupling', 'seal', 'supportFixing', 'supportBase']);
    expect(shown({ ...TUNNEL_COUPLING_DEFAULT, mechanism: 'bolts' })).toEqual(['mechanism', 'boltsPerCoupling', 'supportFixing', 'supportBase']);
  });

  it('shares how the tunnel is held on its supports with the tunnel page: set on either, both show it', () => {
    const store = new Map<string, string>();
    const storage = { getItem: (key: string) => store.get(key) ?? null, setItem: (key: string, value: string) => void store.set(key, value), removeItem: (key: string) => void store.delete(key), clear: () => store.clear(), key: () => null, length: 0 };
    const previous = (globalThis as { localStorage?: Storage }).localStorage;
    Object.defineProperty(globalThis, 'localStorage', { value: storage, configurable: true });
    try {
      expect(tunnelCouplingDefinition.shares).toEqual([{ page: 'tunnel', settings: ['supportFixing', 'supportBase'] }]);
      // the same settings, offered alike on both pages
      for (const key of ['supportFixing', 'supportBase'] as const) {
        const here = tunnelCouplingDefinition.controls.find(c => c.key === key); const there = tunnelDefinition.controls.find(c => c.key === key);
        expect(here?.options).toEqual(there?.options); expect(here?.label).toBe(there?.label);
      }
      // set on the tunnel page: this page loads with it, whatever it saved itself
      store.set(subassemblyStorageKey('tunnel'), JSON.stringify({ version: 1, config: { ...TUNNEL_DEFAULT, supportFixing: 'dowels', portHeight: 655 } }));
      store.set(subassemblyStorageKey('tunnel-tunnel-coupling'), JSON.stringify({ version: 1, config: { ...TUNNEL_COUPLING_DEFAULT, supportFixing: 'strap', mechanism: 'bolts' } }));
      expect(loadSubassemblySettings(tunnelCouplingDefinition).config).toEqual({ ...TUNNEL_COUPLING_DEFAULT, mechanism: 'bolts', supportFixing: 'dowels' });
      // set here: written back to the tunnel page, its other settings kept
      saveShared(tunnelCouplingDefinition, { ...TUNNEL_COUPLING_DEFAULT, supportFixing: 'cradle', supportBase: 'self-standing' });
      expect(loadSubassemblySettings(tunnelDefinition).config).toEqual({ ...TUNNEL_DEFAULT, supportFixing: 'cradle', supportBase: 'self-standing', portHeight: 655 });
      // with nothing saved on the tunnel page yet, it is started with just these
      store.clear();
      saveShared(tunnelCouplingDefinition, { ...TUNNEL_COUPLING_DEFAULT, supportFixing: 'latch' });
      expect(loadSubassemblySettings(tunnelDefinition).config).toEqual({ ...TUNNEL_DEFAULT, supportFixing: 'latch' });
      // an invalid value saved on the tunnel page is not taken
      store.set(subassemblyStorageKey('tunnel'), JSON.stringify({ version: 1, config: { supportFixing: 'glue' } }));
      expect(loadSubassemblySettings(tunnelCouplingDefinition).config.supportFixing).toBe('screws');
      // the tunnel page names this page under the shared settings
      expect(dependentsOf('tunnel').find(d => d.page === 'tunnel-tunnel-coupling')?.settings).toEqual(expect.arrayContaining(['supportFixing', 'supportBase', 'sectionLength']));
    } finally {
      if (previous) Object.defineProperty(globalThis, 'localStorage', { value: previous, configurable: true }); else delete (globalThis as { localStorage?: Storage }).localStorage;
    }
  });

  it('drops the tunnel page’s old coupling bolts from its saved settings: they are set here now', () => {
    const saved = JSON.stringify({ version: 1, variant: 'modular', config: { ...TUNNEL_DEFAULT, couplingBolts: 8, portHeight: 655 } });
    const config = parseSubassemblySettings(tunnelDefinition, saved).config;
    expect(config).toEqual({ ...TUNNEL_DEFAULT, portHeight: 655 });
    expect('couplingBolts' in config).toBe(false);
    expect(tunnelDefinition.controls.map(c => c.key)).not.toContain('couplingBolts');
  });
});
