import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { findPart, partUsage, toggleLatchMechanism as TL, TUNNEL_FOOT, tunnelConcept } from '@canfactory/contracts';
import type { CatioState } from './catioScene.ts';
import { defaultSubassemblySettings, parseSubassemblySettings } from './catioSubassembly.ts';
import { tunnelDefinition } from './catioSubassemblies.ts';
import {
  facePoint, groundAt, jointSetback, portFloor, SUPPORT_FIXINGS, TUNNEL, TUNNEL_CONTROLS, TUNNEL_DEFAULT, TUNNEL_PAD_HEIGHT, TUNNEL_PRESETS, tunnelFacts, tunnelBom, tunnelLayout, tunnelSite, tunnelSteps, validateTunnel, vec, type SupportFixing, type TunnelConfig,
} from './catioTunnel.ts';
import { createTunnelScene, LIFT } from './catioTunnelScene.ts';
import { TUNNEL_COUPLING_CONTROLS, TUNNEL_COUPLING_DEFAULT, type TunnelCouplingConfig } from './catioTunnelJoint.ts';
import { PRINTED_LATCH, PRINTED_LATCH_JOINT } from './catioPrintedLatch.ts';
import type { V3 } from './catioSubassembly.ts';
import { WINDOW_INSERT_DEFAULT, windowInsertLayout, type WindowInsertConfig } from './catioWindowInsert.ts';

const site = tunnelSite();
const installed: CatioState = { progress: 6, exploded: false, windowOpen: true, cutaway: false, hidden: new Set() };
/** Every option of every select control, one at a time, from the defaults. */
const optionConfigs: TunnelConfig[] = [TUNNEL_DEFAULT, ...TUNNEL_CONTROLS.filter(c => !c.range).flatMap(control => control.options.map(option => ({ ...TUNNEL_DEFAULT, [control.key]: option.value }))),
  // the Ganter feet in every size, and the printed feet at their lowest and highest
  ...TUNNEL_FOOT.diameters.map(footDiameter => ({ ...TUNNEL_DEFAULT, footPad: 'ganter' as const, footDiameter })),
  { ...TUNNEL_DEFAULT, padHeight: TUNNEL_PAD_HEIGHT.min }, { ...TUNNEL_DEFAULT, padHeight: TUNNEL_PAD_HEIGHT.max, footDiameter: 25 }];
/** Routes that turn either way, at odd angles, climb and fall, with both joint types. */
const routes: TunnelConfig[] = ([
  TUNNEL_DEFAULT,
  { ...TUNNEL_DEFAULT, portX: -1730, portY: 3420, portFacing: -25, portHeight: 820, slopeLeg: 'final', final: 2300 },
  { ...TUNNEL_DEFAULT, portX: 2600, portY: 2200, portFacing: 90, portHeight: 300, approach: 900, final: 600 },
  { ...TUNNEL_DEFAULT, portX: 0, portY: 4000, portFacing: 0, portHeight: 245, slopeLeg: 'approach', approach: 1500 },
  { ...TUNNEL_DEFAULT, portX: 900, portY: 5200, portFacing: 15, portHeight: 1100, maxSlope: 25, sectionLength: 1000 },
  { ...TUNNEL_DEFAULT, portX: -2400, portY: 2600, portFacing: -60, portHeight: 400, slopeLeg: 'approach', approach: 1800, groundFall: 4 },
] satisfies TunnelConfig[]).flatMap((config): TunnelConfig[] => [config, { ...config, angleJoint: 'mitred-ends' }]);
/** Both coupling mechanisms, with every count of latches and bolts. */
const joints: TunnelCouplingConfig[] = [TUNNEL_COUPLING_DEFAULT, ...TUNNEL_COUPLING_CONTROLS.flatMap(control => control.options.map(option => ({ ...TUNNEL_COUPLING_DEFAULT, [control.key]: option.value }))),
  { ...TUNNEL_COUPLING_DEFAULT, mechanism: 'bolts', boltsPerCoupling: 4 }, { ...TUNNEL_COUPLING_DEFAULT, mechanism: 'bolts', boltsPerCoupling: 8 }];
const bolted: TunnelCouplingConfig = { ...TUNNEL_COUPLING_DEFAULT, mechanism: 'bolts' };
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

  it('meets every coupling with the same outline on parallel planes: face to face when bolted, the printed latch’s gap apart when latched', () => {
    for (const joint of [TUNNEL_COUPLING_DEFAULT, bolted]) for (const config of routes) {
      const l = tunnelLayout(config, site, joint);
      l.pieces.slice(1).forEach((after, i) => {
        const before = l.pieces[i]; if (!before) return;
        const coupling = l.couplings.find(c => c.after === after.id); if (!coupling) throw new Error(after.id);
        // latched wherever both flanges are square to their pieces (sections and angle collars); a mitre is always bolted
        const square = vec.dot(after.start.n, after.start.frame.y) > 1 - 1e-9;
        expect(coupling.kind, `${coupling.id} ${JSON.stringify(joint)}`).toBe(joint.mechanism === 'printed-latch' && square ? 'latched' : 'bolted');
        const gap = coupling.kind === 'latched' ? PRINTED_LATCH_JOINT.gap : 0;
        expect(coupling.gap).toBeCloseTo(gap, 9);
        close(before.end.n, after.start.n, 12, `${after.id} plane`);
        for (const [u, v] of profile(l.w, l.h)) close(vec.add(facePoint(before.end, u, v), vec.mul(after.start.n, gap)), facePoint(after.start, u, v), 6, `${before.id} | ${after.id} at ${u},${v}`);
      });
    }
  });

  it('makes room for the latches’ gaps: the route still ends exactly at the enclosure port, with every section no longer than the longest', () => {
    for (const joint of [TUNNEL_COUPLING_DEFAULT, bolted]) for (const config of [...routes, ...TUNNEL_PRESETS.map(p => p.config())]) {
      const l = tunnelLayout(config, site, joint);
      expect(l.errors, `${JSON.stringify(config)} ${joint.mechanism}`).toEqual([]);
      close(l.pieces.at(-1)?.end.at ?? [0, 0, 0], [config.portX, config.portY, portFloor(config, site)], 6, `end ${joint.mechanism}`);
      for (const p of l.pieces.filter(q => q.kind === 'section')) expect(p.length, p.id).toBeLessThanOrEqual(config.sectionLength + 1e-9);
      // the pieces and the gaps between them make up the route; a collar's ends stay at its setback from the vertex
      const gaps = l.couplings.reduce((n, c) => n + c.gap, 0);
      expect(l.totalLength + gaps).toBeCloseTo(l.pieces.reduce((n, p) => n + p.length, 0) + gaps, 9);
      for (const j of l.joints) expect(j.stop - j.setback, j.id).toBeCloseTo(j.collar && joint.mechanism === 'printed-latch' ? PRINTED_LATCH_JOINT.gap : 0, 9);
      // the enclosure end is bolted whatever the couplings are
      expect(l.couplings.find(c => c.id === 'port')).toMatchObject({ kind: 'bolted', gap: 0 });
      expect(l.couplings.find(c => c.id === 'port')?.bolts).toHaveLength(joint.boltsPerCoupling);
    }
    // the default route is as long with either mechanism: the gaps come out of the sections
    const latchedLength = tunnelLayout(TUNNEL_DEFAULT, site, TUNNEL_COUPLING_DEFAULT); const boltedLength = tunnelLayout(TUNNEL_DEFAULT, site, bolted);
    expect(latchedLength.pieces.length).toBe(boltedLength.pieces.length);
    const span = (l: typeof latchedLength) => l.totalLength + l.couplings.reduce((n, c) => n + c.gap, 0);
    expect(span(latchedLength)).toBeCloseTo(span(boltedLength), 9);
  });

  it('puts the printed latches on the flanges’ outer sides, plates within the flanges, screws in the timber and clear of the bearer’s and rails’ screws', () => {
    for (const joint of joints.filter(j => j.mechanism === 'printed-latch')) for (const config of routes) {
      const l = tunnelLayout(config, site, joint);
      expect(l.errors).toEqual([]);
      for (const c of l.couplings.filter(k => k.kind === 'latched')) {
        expect(c.latches).toHaveLength(2 * joint.latchesPerSide); expect(c.bolts).toEqual([]);
        expect(c.seal !== null).toBe(joint.seal === 'e-profile');
        for (const q of c.latches) {
          // on the side face, the pull along the tunnel back towards the flange before the joint
          close(q.pull, vec.mul(c.face.n, -1), 12, q.id);
          expect(Math.abs(vec.dot(vec.sub(q.at, c.face.at), c.face.frame.x))).toBeCloseTo(l.w / 2 + TUNNEL.flange.width, 6);
        }
      }
      const screws = l.fasteners.filter(f => f.component === 'latch-screws' || f.component === 'catch-screws');
      expect(screws).toHaveLength(4 * l.couplings.reduce((n, c) => n + c.latches.length, 0));
      for (const f of screws) {
        const c = l.couplings.find(k => k.latches.some(q => q.id === f.of)); if (!c) throw new Error(f.of);
        // into the flange before the joint (base) or after it (catch), at least 5 mm in from its face
        const depth = -vec.dot(vec.sub(f.at, c.face.at), c.face.n);
        if (f.component === 'latch-screws') expect(depth - c.gap).toBeGreaterThan(5); else expect(-depth).toBeGreaterThan(5);
      }
    }
    expect(tunnelLayout(TUNNEL_DEFAULT, site, bolted).fasteners.some(f => f.component === 'latch-screws')).toBe(false);
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
      // half the stud's travel, less half a leg rounding: a Ganter foot under 40 mm (63 mm stud) and a printed foot (77 mm out of it)
      // reach ±25 mm no more; the 40 mm Ganter foot (80 mm stud) does
      expect(tooShort, JSON.stringify(config)).toBe(config.groundTolerance > (l.stud - 18 - 6.8) / 2 - TUNNEL.legRound / 2);
      if (tooShort) continue;
      // the only other limits an option can hit from the defaults: a leg too short for the climb, and a fixing that leaves a trestle
      // standing on its own (gravity, or a latch or turn buttons where they do not fit)
      const loose = l.supports.some(s => !s.hold.attached);
      expect(l.errors.some(e => /Choose self-standing supports/.test(e)), JSON.stringify(config)).toBe(loose && config.supportBase === 'trestle');
      expect(l.errors.filter(e => !/too short to climb|Choose self-standing supports/.test(e)), JSON.stringify(config)).toEqual([]);
      for (const s of l.supports) for (const f of s.feet) {
        expect(f.actualSetting, f.id).toBeGreaterThanOrEqual(l.travel.min - 1e-6);
        expect(f.actualSetting, f.id).toBeLessThanOrEqual(l.travel.max + 1e-6);
        // one slab under each leg (and under both feet of its sole), on the ground there
        expect(f.slabTop - TUNNEL.slab.thickness).toBeCloseTo(groundAt(config, f.slabAt[0], f.slabAt[1]), 9);
        expect(f.leg % TUNNEL.legRound).toBe(0);
        // the stack from the slab to the bearer top is exact
        expect(f.slabTop + l.footHeight + f.actualSetting + (s.soles.length ? TUNNEL.sole.thickness : 0) + f.leg + s.depth).toBeCloseTo(s.top, 6);
      }
    }
  });
});

describe('tunnel held on its supports', () => {
  const held = (supportFixing: SupportFixing, supportBase: TunnelConfig['supportBase'] = 'trestle', config: TunnelConfig = TUNNEL_DEFAULT) => tunnelLayout({ ...config, supportFixing, supportBase }, site, TUNNEL_COUPLING_DEFAULT);
  /** A straight route with section-to-section couplings: two flanges over a bearer, where the latch and the buttons fit. */
  const straight: TunnelConfig = { ...TUNNEL_DEFAULT, portX: 0, portY: 3000, portLevel: 'window', sectionLength: 500 };
  const fp = 'iso-2338-8x40';

  it('screws up through every bearer by default, and binds every support to the tunnel', () => {
    const l = held('screws');
    expect(TUNNEL_DEFAULT.supportFixing).toBe('screws'); expect(TUNNEL_DEFAULT.supportBase).toBe('trestle');
    expect(l.fasteners.filter(f => f.component === 'flange-screws')).toHaveLength(l.supports.reduce((n, s) => n + s.fixings.length, 0));
    expect(l.supports.every(s => s.hold.attached && s.seat === 0)).toBe(true);
  });

  it('stands each dowel half in the bearer under a flange or collar rail, and drops the tunnel over them', () => {
    for (const config of [TUNNEL_DEFAULT, straight]) {
      const l = held('dowels', 'trestle', config); const screwed = held('screws', 'trestle', config);
      expect(l.errors).toEqual([]);
      expect(l.fasteners.some(f => f.component === 'flange-screws')).toBe(false);
      for (const s of l.supports) {
        expect(s.hold.dowels).toHaveLength(s.fixings.length);
        // the tunnel sits on the bearer as before
        expect(s.top).toBeCloseTo(screwed.supports.find(t => t.id === s.id)?.top ?? NaN, 9);
        for (const d of s.hold.dowels) expect(d[2]).toBeCloseTo(s.top - TUNNEL.fixing.dowel.into, 9);
      }
      expect(tunnelBom('modular', { ...config, supportFixing: 'dowels' }, site, TUNNEL_COUPLING_DEFAULT).find(line => line.partId === fp)?.quantity).toBe(l.supports.reduce((n, s) => n + s.fixings.length, 0));
    }
  });

  it('sets the tunnel into a printed cradle on each bearer end, its lips round the flanges, the bearer lowered by the cradle’s base', () => {
    const l = held('cradle'); const screwed = held('screws');
    for (const s of l.supports) {
      expect(s.seat).toBe(TUNNEL.fixing.cradle.seat);
      expect(s.top).toBeCloseTo((screwed.supports.find(t => t.id === s.id)?.top ?? NaN) - TUNNEL.fixing.cradle.seat, 9);
      expect(s.hold.cradles).toHaveLength(2);
      // lips along the tunnel only where flanges sit on the bearer: a collar's rails run on through
      for (const c of s.hold.cradles) expect(c.boxes).toHaveLength(s.footprint ? 4 : 2);
      for (const c of s.hold.cradles) for (const b of c.boxes.slice(1)) expect(b.center[2] + b.size[2] / 2).toBeCloseTo(s.top + s.seat + TUNNEL.fixing.cradle.lip, 9);
    }
    expect(tunnelBom('modular', { ...TUNNEL_DEFAULT, supportFixing: 'cradle' }, site).find(line => line.id === 'support-cradles')?.quantity).toBe(2 * l.supports.length);
  });

  it('straps each support over the tunnel, hooked under cleats on the bearer’s ends', () => {
    const l = held('strap');
    for (const s of l.supports) {
      const strap = s.hold.strap; if (!strap) throw new Error(s.id);
      expect(strap.cleats).toHaveLength(2);
      // from below the bearer's top, over the tunnel's top (flanges, or a collar's roof), down to the other end
      const [a, b, c, d] = strap.path; if (!a || !b || !c || !d) throw new Error('path');
      expect(a[2]).toBeLessThan(s.top); expect(d[2]).toBeLessThan(s.top);
      expect(b[2]).toBeCloseTo(s.top + s.seat + l.h + 2 * TUNNEL.flange.width - (s.flanges ? 0 : TUNNEL.flange.width - TUNNEL.rail), 6);
      expect(strap.length).toBeGreaterThan(2 * (b[2] - a[2]) + l.w);
    }
    const lines = tunnelBom('modular', { ...TUNNEL_DEFAULT, supportFixing: 'strap' }, site);
    expect(lines.filter(line => line.name.startsWith('EPDM tarp strap')).reduce((n, line) => n + line.quantity, 0)).toBe(l.supports.length);
    expect(lines.find(line => line.name === 'Strap cleat')?.quantity).toBe(2 * l.supports.length);
  });

  it('latches the flanges down to the bearer only where two meet over it, flush with its ends, over a pad', () => {
    const l = held('latch', 'self-standing', straight);
    expect(l.errors).toEqual([]);
    for (const s of l.supports) {
      const fits = s.flanges === 2 && s.flush;
      expect(s.hold.latches).toHaveLength(fits ? 2 : 0); expect(s.hold.attached).toBe(fits);
      expect(s.seat).toBe(fits ? TUNNEL.fixing.latchPad : 0);
      for (const q of s.hold.latches) {
        expect(q.pull).toEqual([0, 0, 1]);
        // the plates across the pad: base on the flanges above, catch on the bearer's end below, each overhang proud of its face
        expect(q.at[2] - (s.top + s.seat)).toBeCloseTo(-PRINTED_LATCH.overhang, 9);
        const screws = l.fasteners.filter(f => f.of === q.id);
        const base = screws.filter(f => f.component === 'support-latch-screws'); const catches = screws.filter(f => f.component === 'support-catch-screws');
        expect(base).toHaveLength(2); expect(catches).toHaveLength(2);
        // one screw into each flange, at least 5 mm above its bottom; the catch's into the bearer
        expect(new Set(base.map(f => f.piece)).size).toBe(2);
        for (const f of base) expect(f.at[2] - (s.top + s.seat)).toBeGreaterThan(5);
        for (const f of catches) expect(s.top - f.at[2]).toBeGreaterThan(5);
      }
    }
    expect(l.supports.filter(s => s.hold.latches.length).length).toBeGreaterThan(2);
    // where it does not fit, a trestle has nothing holding it up
    expect(held('latch').errors.join()).toMatch(/A vertical latch fits only where two flanges meet over a bearer.*Choose self-standing supports/);
  });

  it('hooks a turn button on each flange under a keeper on the bearer’s end, under flanges flush with its ends', () => {
    const l = held('turn-buttons', 'trestle', straight);
    expect(l.errors).toEqual([]);
    for (const s of l.supports) {
      expect(s.hold.buttons).toHaveLength(2 * s.flanges);
      for (const b of s.hold.buttons) {
        const [keeper] = b.keepers; if (!keeper) throw new Error('keeper');
        // the keeper on the bearer's end, below its top; the button's pivot on the flange's side above
        expect(keeper.center[2] + keeper.size[2] / 2).toBeLessThan(s.top);
        expect(b.pivot[2]).toBeGreaterThan(s.top);
        expect(b.piece).not.toBe('');
      }
    }
    expect(held('turn-buttons').errors.join()).toMatch(/Turn buttons fit only under flanges flush/);
  });

  it('rests on self-standing supports by gravity only, and says a trestle cannot', () => {
    expect(held('gravity').errors.join()).toMatch(/With gravity only, nothing holds a support to the tunnel.*Choose self-standing supports/);
    const l = held('gravity', 'self-standing');
    expect(l.errors).toEqual([]);
    expect(l.supports.every(s => !s.hold.attached && s.soles.length === 2 && s.feet.length === 4)).toBe(true);
    // a sole under each leg, its two feet along the tunnel, both on the one slab
    for (const s of l.supports) for (const end of [0, 1]) {
      const feet = s.feet.filter(f => f.end === end); const [a, b] = feet; if (!a || !b) throw new Error(s.id);
      expect(Math.abs(vec.dot(vec.sub(a.at, b.at), s.along))).toBeCloseTo(TUNNEL.sole.length - 2 * TUNNEL.sole.footInset, 6);
      expect(a.slabAt).toEqual(b.slabAt);
    }
    const lines = tunnelBom('modular', { ...TUNNEL_DEFAULT, supportFixing: 'gravity', supportBase: 'self-standing' }, site);
    expect(lines.find(line => line.name === 'Sole')?.quantity).toBe(2 * l.supports.length);
    expect(lines.find(line => line.id === 'slabs')?.quantity).toBe(2 * l.supports.length);
  });

  it('stages every fixing: fittings on the levelled supports, buttons on the flanges, the hold-down last, each along its own way', () => {
    for (const fixing of SUPPORT_FIXINGS) {
      const config = { ...straight, supportFixing: fixing, supportBase: 'self-standing' as const };
      const scene = createTunnelScene('modular', config, site, TUNNEL_COUPLING_DEFAULT);
      for (const motion of scene.motions.filter(m => m.role === 'screw')) expect(motion.approach.clone().normalize().dot(new THREE.Vector3(...(motion.drive ?? [0, 0, 0]))), motion.action).toBeCloseTo(-1, 6);
      const moments = new Map(scene.motions.filter(m => m.window[1] > m.window[0]).map(m => [m.stage - 1 + (m.window[0] + m.window[1]) / 2, m.action]));
      for (const [progress, action] of moments) {
        scene.update({ ...installed, progress });
        expect(scene.caption?.(), `${fixing}: caption mid ${action}`).not.toBeNull();
      }
      const ids = scene.components.map(part => part.id);
      expect(ids.includes('support-fixings'), fixing).toBe(['dowels', 'cradle', 'strap', 'latch', 'turn-buttons'].includes(fixing));
      expect(ids.includes('flange-screws'), fixing).toBe(fixing === 'screws');
      expect(ids.includes('straps'), fixing).toBe(fixing === 'strap');
      expect(ids.includes('support-latches'), fixing).toBe(fixing === 'latch');
      expect(ids.includes('turn-buttons'), fixing).toBe(fixing === 'turn-buttons');
      expect(ids).toContain('soles');
      scene.dispose();
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
      // latched by default: only the enclosure end and any mitred joint are bolted
      expect(bolts).toBe(l.couplings.filter(c => c.kind === 'bolted').length * TUNNEL_COUPLING_DEFAULT.boltsPerCoupling);
      const latches = l.couplings.reduce((n, c) => n + c.latches.length, 0);
      expect(latches).toBe(l.couplings.filter(c => c.kind === 'latched').length * 2 * TUNNEL_COUPLING_DEFAULT.latchesPerSide);
      if (latches) expect(lines.find(line => line.modelId === 'toggle-latch')).toMatchObject({ quantity: latches, name: 'Toggle latch, printed' });
      expect(l.fasteners.filter(f => f.component === 'latch-screws' || f.component === 'catch-screws')).toHaveLength(4 * latches);
      expect(count('din-7997-4x25')).toBe(l.fasteners.filter(f => f.partId === 'din-7997-4x25').length);
      expect(lines.find(line => line.id === 'coupling-seal')?.quantity ?? 0).toBe(l.couplings.filter(c => c.seal).length);
      // a printed foot's screw and lock nut are the coupling's M8 × 80 and nut
      const feet = l.supports.reduce((n, s) => n + s.feet.length, 0);
      expect(feet).toBe((config.supportBase === 'self-standing' ? 4 : 2) * l.supports.length);
      expect(count('iso-4017-m8x80')).toBe(bolts + (l.pad ? feet : 0));
      expect(count('iso-7093-m8')).toBe(2 * bolts);
      expect(count('iso-4032-m8')).toBe(bolts + (l.pad ? feet : 0));
      if (l.pad) expect(lines.find(line => line.modelId === 'pressure-pad')).toMatchObject({ id: 'foot-pads', quantity: feet, size: `Ø ${config.footDiameter} × ${config.padHeight} mm · ${config.padSurface} sole · PETG · for an ISO 4017 M8 × 80 head` });
      else { expect(count(l.foot.id)).toBe(feet); expect(lines.some(line => line.modelId === 'pressure-pad')).toBe(false); }
      expect(count('din-7965-m8x18')).toBe(feet);
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

  it('lists bolts at every coupling with the bolts, and always at the enclosure end', () => {
    for (const joint of joints) for (const config of [TUNNEL_DEFAULT, { ...TUNNEL_DEFAULT, angleJoint: 'mitred-ends' as const }]) {
      const l = tunnelLayout(config, site, joint); const lines = tunnelBom('modular', config, site, joint);
      const count = (id: string) => lines.find(line => line.partId === id)?.quantity ?? 0;
      const bolts = l.couplings.filter(c => c.kind === 'bolted').length * joint.boltsPerCoupling;
      expect(bolts).toBeGreaterThanOrEqual(joint.boltsPerCoupling);
      expect(count('iso-7093-m8')).toBe(2 * bolts);
      expect(count('iso-4017-m8x80')).toBe(bolts + (l.pad ? 2 * l.supports.length : 0));
      expect(lines.some(line => line.modelId === 'toggle-latch')).toBe(l.couplings.some(c => c.kind === 'latched'));
      // angle collars keep every coupling square: all latched but the enclosure end
      if (config.angleJoint === 'angle-collar') expect(l.couplings.filter(c => c.kind === 'bolted').map(c => c.id)).toEqual(joint.mechanism === 'bolts' ? l.couplings.map(c => c.id) : ['port']);
      if (joint.mechanism === 'bolts') expect(l.couplings.every(c => c.kind === 'bolted')).toBe(true);
    }
  });

  it('links every library part it can use back to this page in the parts library', () => {
    expect(TUNNEL_CONTROLS.find(c => c.key === 'footDiameter')?.options.map(o => o.value)).toEqual([...TUNNEL_FOOT.diameters]);
    const used = new Set([...[...routes, ...optionConfigs].flatMap(config => tunnelBom('modular', config, site)), ...joints.flatMap(joint => tunnelBom('modular', TUNNEL_DEFAULT, site, joint))].flatMap(line => line.partId ? [line.partId] : []));
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
    expect(scene.components.map(part => part.id)).toEqual(expect.arrayContaining(['terrain', 'window-insert', 'enclosure-port', 'slabs', 'legs', 'levelling-feet', 'bearers', 'flanges', 'rails', 'mesh', 'staples', 'section-latches', 'section-latch-screws', 'section-seals', 'port-bolts', 'flange-screws', 'docking-frame', 'coupling-latches']));
    // printed latches at the couplings by default: no bolts there; bolted, no latches
    expect(scene.components.map(part => part.id)).not.toContain('coupling-bolts');
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

  it('latches every square coupling with the shared printed latch, closed over centre once the pieces are down, each part on its pins', () => {
    const scene = createTunnelScene('modular', TUNNEL_DEFAULT, site, TUNNEL_COUPLING_DEFAULT);
    const latched = scene.layout.couplings.filter(c => c.kind === 'latched');
    expect(scene.levers).toHaveLength(latched.length * 2 * TUNNEL_COUPLING_DEFAULT.latchesPerSide);
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
    for (const [config, joint] of [[TUNNEL_DEFAULT, TUNNEL_COUPLING_DEFAULT], [{ ...TUNNEL_DEFAULT, angleJoint: 'mitred-ends' as const }, { ...bolted, boltsPerCoupling: 8 as const }], [{ ...TUNNEL_DEFAULT, angleJoint: 'mitred-ends' as const }, TUNNEL_COUPLING_DEFAULT]] as const) {
      const scene = createTunnelScene('modular', config, site, joint);
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

describe('tunnel presets', () => {
  const preset = (id: string) => { const found = TUNNEL_PRESETS.find(p => p.id === id); if (!found) throw new Error(id); return found.config(); };

  it('builds every preset, each one a valid saved design', () => {
    for (const p of TUNNEL_PRESETS) {
      const config = p.config();
      expect(tunnelLayout(config, site).errors, p.id).toEqual([]);
      expect(parseSubassemblySettings(tunnelDefinition, JSON.stringify({ version: 1, config })).config, p.id).toEqual(config);
    }
  });

  it('runs straight and level with square sections only', () => {
    const l = tunnelLayout(preset('straight'), site);
    expect(l.joints).toEqual([]); expect(l.slope).toBeNull();
    expect(l.pieces.every(p => p.kind === 'section' && p.pitch === 0 && vec.dot(p.start.n, p.frame.y) === 1 && vec.dot(p.end.n, p.frame.y) === 1)).toBe(true);
    expect(tunnelFacts('modular', preset('straight'), site).find(f => f.label.startsWith('Rise'))?.value).toBe('level');
  });

  it('turns once, 90° to the right, and stays level', () => {
    for (const angleJoint of ['angle-collar', 'mitred-ends'] as const) {
      const l = tunnelLayout({ ...preset('right-angle'), angleJoint }, site);
      expect(l.errors).toEqual([]);
      expect(l.joints.map(j => j.kind)).toEqual(['turn']);
      expect(l.joints[0]?.angle).toBeCloseTo(90, 9);
      expect(l.slope).toBeNull();
      close(l.pieces.at(-1)?.end.n ?? [0, 0, 0], [1, 0, 0], 12);
    }
  });

  it('stays level with the window port wherever the window insert’s clamps put its floor', () => {
    const inserts: WindowInsertConfig[] = [WINDOW_INSERT_DEFAULT, { ...WINDOW_INSERT_DEFAULT, attachment: 'folding-wedges' }, { ...WINDOW_INSERT_DEFAULT, padHeight: 20 }, { ...WINDOW_INSERT_DEFAULT, clampPad: 'ganter', footDiameter: 25 }, { ...WINDOW_INSERT_DEFAULT, clampPad: 'ganter', footDiameter: 40 }];
    const floors = new Set<number>();
    for (const insert of inserts) {
      const moved = { ...site, insert, floorZ: windowInsertLayout('modular', insert, site.window).floor }; floors.add(moved.floorZ);
      for (const id of ['straight', 'right-angle']) {
        const l = tunnelLayout(preset(id), moved);
        expect(l.rise, `${id} ${JSON.stringify(insert)}`).toBe(0); expect(l.slope).toBeNull();
        expect(portFloor(preset(id), moved)).toBe(moved.floorZ);
      }
    }
    expect(floors.size).toBe(inserts.length);
    // the preset itself does not depend on the insert, so it still reads as picked after the insert changes
    expect(preset('straight')).toEqual(preset('straight'));
    expect(preset('straight').portLevel).toBe('window');
    // its own height is only asked for when it has one
    const height = TUNNEL_CONTROLS.find(c => c.key === 'portHeight');
    expect(height?.when?.({ ...TUNNEL_DEFAULT, portLevel: 'window' })).toBe(false);
    expect(height?.when?.({ ...TUNNEL_DEFAULT, portLevel: 'own' })).toBe(true);
  });

  it('names the window port’s floor and where it is set, and points out a climb of a few millimetres', () => {
    const facts = tunnelFacts('modular', TUNNEL_DEFAULT, site);
    expect(facts.find(f => f.label.startsWith('Window port floor'))).toMatchObject({ value: `${Number((site.floorZ / 10).toFixed(1))} cm`, from: { page: 'window-insert', settings: ['attachment', 'clampPad', 'padHeight', 'footDiameter'] } });
    const nearly = tunnelFacts('modular', { ...preset('straight'), portLevel: 'own', portHeight: site.floorZ + 16.5 }, site).find(f => f.label.startsWith('Rise'));
    expect(nearly?.value).toMatch(/nearly level: set the port floor level with the window port/);
    expect(tunnelFacts('modular', TUNNEL_DEFAULT, site).find(f => f.label.startsWith('Rise'))?.value).not.toMatch(/nearly level/);
  });

  it('rises to a higher door without turning', () => {
    const l = tunnelLayout(preset('rising'), site);
    expect(l.joints.map(j => j.kind)).toEqual(['bend', 'bend']);
    expect(l.rise).toBeGreaterThan(600);
    expect(l.pieces.at(-1)?.end.at[2]).toBeCloseTo(900, 9);
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
    expect(parseSubassemblySettings(tunnelDefinition, JSON.stringify({ version: 1, config: { ...TUNNEL_DEFAULT, portHeight: 657.3 } })).config.portHeight).toBe(TUNNEL_DEFAULT.portHeight);
  });
});
