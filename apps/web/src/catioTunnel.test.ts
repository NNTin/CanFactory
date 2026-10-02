import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { dimensionOf, findPart, partUsage, TUNNEL_FOOT, tunnelConcept } from '@canfactory/contracts';
import type { CatioState } from './catioScene.ts';
import { defaultSubassemblySettings, parseSubassemblySettings } from './catioSubassembly.ts';
import { tunnelDefinition } from './catioSubassemblies.ts';
import {
  facePoint, groundAt, jointSetback, TUNNEL, TUNNEL_CONTROLS, TUNNEL_DEFAULT, tunnelBom, tunnelLayout, tunnelSite, tunnelSteps, validateTunnel, vec, type TunnelConfig,
} from './catioTunnel.ts';
import { createTunnelScene, LIFT } from './catioTunnelScene.ts';
import type { V3 } from './catioSubassembly.ts';

const site = tunnelSite();
const installed: CatioState = { progress: 6, exploded: false, windowOpen: true, cutaway: false, hidden: new Set() };
/** Every option of every select control, one at a time, from the defaults. */
const optionConfigs: TunnelConfig[] = [TUNNEL_DEFAULT, ...TUNNEL_CONTROLS.filter(c => !c.range).flatMap(control => control.options.map(option => ({ ...TUNNEL_DEFAULT, [control.key]: option.value })))];
/** Routes that turn either way, at odd angles, climb and fall, with both joint types. */
const routes: TunnelConfig[] = ([
  TUNNEL_DEFAULT,
  { ...TUNNEL_DEFAULT, portX: -1730, portY: 3420, portFacing: -25, portHeight: 820, slopeLeg: 'final', final: 2300 },
  { ...TUNNEL_DEFAULT, portX: 2600, portY: 2200, portFacing: 90, portHeight: 300, approach: 900, final: 600 },
  { ...TUNNEL_DEFAULT, portX: 0, portY: 4000, portFacing: 0, portHeight: 245, slopeLeg: 'approach', approach: 1500 },
  { ...TUNNEL_DEFAULT, portX: 900, portY: 5200, portFacing: 15, portHeight: 1100, maxSlope: 25, sectionLength: 1000 },
  { ...TUNNEL_DEFAULT, portX: -2400, portY: 2600, portFacing: -60, portHeight: 400, slopeLeg: 'approach', approach: 1800, groundFall: 4 },
] satisfies TunnelConfig[]).flatMap((config): TunnelConfig[] => [config, { ...config, angleJoint: 'mitred-ends' }]);
const close = (a: V3, b: V3, digits = 6, message = '') => { for (const i of [0, 1, 2]) expect(a[i], `${message} [${i}]`).toBeCloseTo(b[i] ?? 0, digits); };
const profile = (w: number, h: number): [number, number][] => [[-w / 2 - 70, -70], [w / 2 + 70, -70], [w / 2 + 70, h + 70], [-w / 2 - 70, h + 70], [-w / 2, 0], [w / 2, h]];

describe('tunnel route', () => {
  it('runs from the window insert’s port to the enclosure’s, square to both, for every route and joint type', () => {
    for (const config of routes) {
      const l = tunnelLayout(config, site);
      expect(l.errors, JSON.stringify(config)).toEqual([]);
      const first = l.pieces[0]; const last = l.pieces.at(-1); if (!first || !last) throw new Error('no pieces');
      close(first.start.at, [0, TUNNEL.wallGap, site.floorZ], 6, 'start');
      close(first.start.n, [0, 1, 0], 9, 'start square to the wall');
      close(last.end.at, [config.portX, config.portY, config.portHeight], 6, 'end');
      close(last.end.n, [Math.sin(config.portFacing * Math.PI / 180), Math.cos(config.portFacing * Math.PI / 180), 0], 9, 'end square to the port');
      // the turns add up to the port's facing, and every slope is within the limit
      expect(l.joints.filter(j => j.kind === 'turn').reduce((s, j) => s + j.angle, 0)).toBeCloseTo(config.portFacing, 6);
      for (const p of l.pieces) expect(Math.abs(p.pitch), p.id).toBeLessThanOrEqual(config.maxSlope + 1e-9);
      expect(l.joints.filter(j => j.kind === 'bend').reduce((s, j) => s + j.angle, 0)).toBeCloseTo(0, 9);
    }
  });

  it('never rolls a piece: every floor stays level across the tunnel', () => {
    for (const config of routes) for (const p of tunnelLayout(config, site).pieces) {
      expect(p.frame.x[2], p.id).toBeCloseTo(0, 12);
      for (const face of [p.start, p.end]) expect(face.frame.x[2], p.id).toBeCloseTo(0, 12);
    }
  });

  it('turns only where level and bends only where straight in plan', () => {
    for (const config of routes) for (const j of tunnelLayout(config, site).joints) {
      if (j.kind === 'turn') { expect(j.a[2]).toBeCloseTo(0, 12); expect(j.b[2]).toBeCloseTo(0, 12); }
      else expect(Math.atan2(j.a[0], j.a[1])).toBeCloseTo(Math.atan2(j.b[0], j.b[1]), 12);
    }
  });

  it('meets every coupling face to face: the profile of both pieces is the same outline on the same plane', () => {
    for (const config of routes) {
      const l = tunnelLayout(config, site);
      l.pieces.slice(1).forEach((after, i) => {
        const before = l.pieces[i]; if (!before) return;
        close(before.end.n, after.start.n, 12, `${after.id} plane`);
        for (const [u, v] of profile(l.w, l.h)) close(facePoint(before.end, u, v), facePoint(after.start, u, v), 6, `${before.id} | ${after.id} at ${u},${v}`);
      });
    }
  });

  it('closes an angle collar exactly: its two flanges touch at the inside of the joint and open on the outside', () => {
    for (const config of routes.filter(c => c.angleJoint === 'angle-collar')) {
      const l = tunnelLayout(config, site);
      for (const j of l.joints) {
        const collar = l.pieces.find(p => p.id === j.collar); if (!collar) throw new Error(j.id);
        // the profile point on the inside of the joint, from the floor's centre line
        const insideOf = (face: typeof collar.start): [number, number] => {
          const inward = vec.unit(vec.sub(j.b, j.a));
          const across = vec.dot(inward, face.frame.x); const up = vec.dot(inward, face.frame.z);
          return Math.abs(across) > Math.abs(up) ? [Math.sign(across) * (l.w / 2 + 70), l.h / 2] : [0, up > 0 ? l.h + 70 : -70];
        };
        const [u, v] = insideOf(collar.start);
        const backA = facePoint(collar.start, u, v, TUNNEL.flange.thickness); const backB = facePoint(collar.end, u, v, -TUNNEL.flange.thickness);
        expect(vec.len(vec.sub(backA, backB)), `${j.id} inside`).toBeCloseTo(0, 6);
        // their outer faces there are two flange thicknesses apart across the bisector
        expect(vec.len(vec.sub(facePoint(collar.start, u, v), facePoint(collar.end, u, v))), `${j.id} faces at the inside`).toBeCloseTo(2 * TUNNEL.flange.thickness * Math.cos(j.angle * Math.PI / 360), 6);
        // and nothing of one flange lies behind the other's back: the outside corner opens wider
        const [uo, vo] = [u === 0 ? 0 : -u, u === 0 ? (v > 0 ? -70 : l.h + 70) : v];
        expect(vec.len(vec.sub(facePoint(collar.start, uo, vo, TUNNEL.flange.thickness), facePoint(collar.end, uo, vo, -TUNNEL.flange.thickness))), `${j.id} outside`).toBeGreaterThan(1);
        // and the setback formula is that geometry
        expect(vec.len(vec.sub(j.vertex, collar.start.at))).toBeCloseTo(jointSetback(j.angle * Math.PI / 180, j.inside, 'angle-collar'), 9);
      }
    }
  });

  it('mitres both pieces on the bisector plane through the vertex', () => {
    const l = tunnelLayout({ ...TUNNEL_DEFAULT, angleJoint: 'mitred-ends' }, site);
    expect(l.pieces.every(p => p.kind === 'section')).toBe(true);
    for (const j of l.joints) {
      const at = l.interfaces.find(i => vec.len(vec.sub(i.face.at, j.vertex)) < 1e-9); if (!at) throw new Error(j.id);
      close(at.face.n, vec.unit(vec.add(j.a, j.b)), 12, j.id);
    }
  });

  it('climbs exactly the difference between the two floors', () => {
    for (const config of routes) {
      const l = tunnelLayout(config, site);
      expect(l.pieces.at(-1)?.end.at[2]).toBeCloseTo(config.portHeight, 9);
      expect(l.rise).toBeCloseTo(config.portHeight - site.floorZ, 9);
      if (Math.abs(l.rise) > 1) expect(l.slope?.pitch).toBeDefined();
    }
    // a small climb gets a shallower slope over the shortest run
    const small = tunnelLayout({ ...TUNNEL_DEFAULT, portHeight: 275 }, site);
    expect(Math.abs(small.slope?.pitch ?? 0)).toBeLessThan(TUNNEL_DEFAULT.maxSlope);
    expect(small.slope?.run).toBeCloseTo(TUNNEL.minRun, 6);
  });

  it('explains what cannot be built', () => {
    expect(validateTunnel('modular', { ...TUNNEL_DEFAULT, portHeight: 1400, final: 300, slopeLeg: 'final' }, site).join()).toMatch(/too short to climb/);
    expect(validateTunnel('modular', { ...TUNNEL_DEFAULT, portX: 4000, portY: 900, final: 1200 }, site).join()).toMatch(/back into the wall/);
    expect(validateTunnel('modular', { ...TUNNEL_DEFAULT, slopeLeg: 'approach' }, site).join()).toMatch(/approach leg is too short to climb 255 mm at up to 20°: it needs \d+ mm/);
    expect(validateTunnel('modular', { ...TUNNEL_DEFAULT, angleJoint: 'mitred-ends', portX: 2600, portY: 900, portFacing: 60 }, site).join()).toMatch(/mitred ends go to 90°/);
    // the same 95° turn is fine for an angle collar
    expect(validateTunnel('modular', { ...TUNNEL_DEFAULT, portX: 2600, portY: 900, portFacing: 60 }, site)).toEqual([]);
    expect(validateTunnel('modular', { ...TUNNEL_DEFAULT, portHeight: 150, slopeLeg: 'approach', approach: 2000 }, site).join()).toMatch(/too close to the ground/);
  });
});

describe('tunnel supports', () => {
  it('puts a support at both ends, at every straight coupling and at every joint, within a section’s length of each other', () => {
    for (const config of routes) {
      const l = tunnelLayout(config, site);
      const straight = l.interfaces.filter(i => i.kind === 'coupling' && ![i.before, i.after].some(id => id?.startsWith('collar')) && !l.joints.some(j => vec.len(vec.sub(j.vertex, i.face.at)) < 1e-9));
      expect(l.supports).toHaveLength(2 + straight.length + l.joints.length);
      for (const p of l.pieces) {
        const near = (at: V3) => l.supports.some(s => Math.hypot(s.at[0] - at[0], s.at[1] - at[1]) < 250);
        expect(near(p.start.at) || near(p.end.at), p.id).toBe(true);
      }
    }
  });

  it('bears each bearer on the tunnel’s underside without cutting into it', () => {
    for (const config of routes) {
      const l = tunnelLayout(config, site);
      for (const s of l.supports) {
        // every flange's bottom edge (front and back) over the bearer's top is at or above it, and the nearest touches or nearly
        const over: number[] = [];
        for (const p of l.pieces) for (const [face, sign] of [[p.start, 1], [p.end, -1]] as const) for (const offset of [0, sign * TUNNEL.flange.thickness]) for (let k = -4; k <= 4; k++) {
          const q = facePoint(face, k * (l.w / 2 + 70) / 4, -70, offset);
          const d = vec.sub(q, s.at);
          if (Math.abs(vec.dot(d, s.along)) <= TUNNEL.bearer.width / 2 && Math.abs(vec.dot(d, s.across)) <= s.length / 2) over.push(q[2]);
        }
        for (const z of over) expect(z, s.id).toBeGreaterThanOrEqual(s.top - 0.05);
        if (over.length) expect(Math.min(...over) - s.top, s.id).toBeLessThan(TUNNEL.bearer.width * Math.tan(Math.PI / 180 * config.maxSlope) + 1e-6);
      }
    }
  });

  it('cuts the legs to the designed fall and sets every foot to the uneven ground within its travel', () => {
    for (const config of [...routes, ...optionConfigs]) {
      const l = tunnelLayout(config, site);
      const tooShort = l.errors.some(e => e.includes('cannot take up'));
      expect(tooShort, JSON.stringify(config)).toBe(config.footDiameter !== 40 && config.groundTolerance > (dimensionOf(l.foot, 'l1') - 18 - 6.8) / 2 - TUNNEL.legRound / 2);
      if (tooShort) continue;
      // the only other limit an option can hit from the defaults: a leg too short for the climb
      expect(l.errors.filter(e => !/too short to climb/.test(e)), JSON.stringify(config)).toEqual([]);
      for (const s of l.supports) for (const f of s.feet) {
        expect(f.actualSetting, f.id).toBeGreaterThanOrEqual(l.travel.min - 1e-6);
        expect(f.actualSetting, f.id).toBeLessThanOrEqual(l.travel.max + 1e-6);
        expect(f.slabTop - TUNNEL.slab.thickness).toBeCloseTo(groundAt(config, f.at[0], f.at[1]), 9);
        expect(f.leg % TUNNEL.legRound).toBe(0);
        // the stack from the slab to the bearer top is exact
        expect(f.slabTop + dimensionOf(l.foot, 'l3') + f.actualSetting + f.leg + s.depth).toBeCloseTo(s.top, 6);
      }
    }
  });
});

describe('tunnel parts list', () => {
  it('counts every bolt, foot and screw from the layout, all from the parts library', () => {
    for (const config of [...routes, ...optionConfigs]) {
      const l = tunnelLayout(config, site);
      const lines = tunnelBom('modular', config, site);
      const count = (id: string) => lines.find(line => line.partId === id)?.quantity ?? 0;
      for (const line of lines) {
        expect(line.quantity, line.id).toBeGreaterThan(0);
        if (line.partId) expect(findPart(line.partId), line.partId).toBeDefined();
      }
      const bolts = l.couplings.reduce((n, c) => n + c.bolts.length, 0);
      expect(bolts).toBe((l.pieces.length) * config.couplingBolts);
      expect(count('iso-4017-m8x80')).toBe(bolts);
      expect(count('iso-7093-m8')).toBe(2 * bolts);
      expect(count('iso-4032-m8')).toBe(bolts);
      expect(count(l.foot.id)).toBe(2 * l.supports.length);
      expect(count('din-7965-m8x18')).toBe(2 * l.supports.length);
      expect(lines.find(line => line.id === 'slabs')?.quantity).toBe(2 * l.supports.length);
      expect(lines.filter(line => line.name === 'Leg').reduce((n, line) => n + line.quantity, 0)).toBe(l.supports.filter(s => s.kind === 'trestle').length * 2);
      expect(lines.filter(line => line.name.startsWith('Flange')).reduce((n, line) => n + line.quantity, 0)).toBe(8 * l.pieces.length);
      expect(lines.some(line => line.name === 'Collar floor')).toBe(config.angleJoint === 'angle-collar' && l.joints.length > 0);
    }
  });

  it('lists the mitre angles in the cut list of mitred sections, and only square cuts for collared ones', () => {
    const collar = tunnelBom('modular', TUNNEL_DEFAULT, site).filter(line => line.name === 'Section rail');
    expect(collar.every(line => line.size.includes('square ends'))).toBe(true);
    const mitred = tunnelBom('modular', { ...TUNNEL_DEFAULT, angleJoint: 'mitred-ends' }, site);
    expect(mitred.some(line => /mitre face/.test(line.size))).toBe(true);
    expect(mitred.some(line => line.name === 'Section rail' && /°/.test(line.size))).toBe(true);
  });

  it('links every library part it can use back to this page in the parts library', () => {
    expect(TUNNEL_CONTROLS.find(c => c.key === 'footDiameter')?.options.map(o => o.value)).toEqual([...TUNNEL_FOOT.diameters]);
    const used = new Set([...routes, ...optionConfigs].flatMap(config => tunnelBom('modular', config, site).flatMap(line => line.partId ? [line.partId] : [])));
    expect([...used].sort()).toEqual([...new Set(tunnelConcept.parts.map(link => link.partId))].sort());
    for (const id of used) {
      const p = findPart(id); if (!p) throw new Error(id);
      expect(partUsage(p).filter(use => use.kind === 'concept').map(use => use.modelId), id).toContain('catio/tunnel');
    }
  });
});

describe('tunnel scene', () => {
  const bounds = (object: THREE.Object3D) => new THREE.Box3().setFromObject(object, true);

  it('stages the build and keeps the site still', () => {
    const scene = createTunnelScene('modular', TUNNEL_DEFAULT, site);
    expect(tunnelSteps('modular', TUNNEL_DEFAULT)).toHaveLength(7);
    scene.update({ ...installed, progress: 0 });
    const context = scene.components.filter(part => part.step === 0);
    const positions = context.map(part => part.group.position.toArray());
    for (let progress = 0; progress <= 6; progress++) {
      scene.update({ ...installed, progress, exploded: progress % 2 === 1 });
      expect(context.map(part => part.group.position.toArray())).toEqual(positions);
      for (const part of scene.components) expect(part.group.visible, `${part.id} at ${progress}`).toBe(part.step <= progress);
    }
    expect(scene.components.map(part => part.id)).toEqual(expect.arrayContaining(['terrain', 'window-insert', 'enclosure-port', 'slabs', 'legs', 'levelling-feet', 'bearers', 'flanges', 'rails', 'mesh', 'staples', 'coupling-bolts', 'port-bolts', 'flange-screws']));
    scene.update({ ...installed, cutaway: true, hidden: new Set(['mesh']) });
    expect(scene.components.find(part => part.id === 'wall')?.group.visible).toBe(false);
    expect(scene.components.filter(part => part.layer === 'mesh').every(part => !part.group.visible)).toBe(true);
    scene.dispose();
  });

  it('raises the sections while they are built and lowers them onto the supports in order from the window', () => {
    const scene = createTunnelScene('modular', TUNNEL_DEFAULT, site);
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

  it('levels each support from its feet: low until stage 2, at its height after', () => {
    const scene = createTunnelScene('modular', TUNNEL_DEFAULT, site);
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
    for (const config of [TUNNEL_DEFAULT, { ...TUNNEL_DEFAULT, angleJoint: 'mitred-ends' as const, couplingBolts: 8 as const }]) {
      const scene = createTunnelScene('modular', config, site);
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
      for (let stage = 1; stage <= 6; stage++) for (const motion of scene.motions.filter(m => m.stage === stage)) {
        scene.update({ ...installed, progress: stage - 1 + (motion.window[0] + motion.window[1]) / 2 });
        expect(scene.caption?.(), `caption mid ${motion.action}`).not.toBeNull();
      }
      scene.dispose();
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
    expect(settings.config.angleJoint).toBe('angle-collar');
    expect(settings.views.modular).toMatchObject({ progress: 2, view: 'Top' });
    // off a step is not accepted either
    expect(parseSubassemblySettings(tunnelDefinition, JSON.stringify({ version: 1, config: { ...TUNNEL_DEFAULT, portHeight: 657 } })).config.portHeight).toBe(TUNNEL_DEFAULT.portHeight);
  });
});
