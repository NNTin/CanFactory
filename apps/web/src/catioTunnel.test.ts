import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { CATIO_MESH_PARTS, catioMesh, findPart, partUsage, toggleLatchMechanism as TL, TUNNEL_FOOT, tunnelConcept } from '@canfactory/contracts';
import type { CatioState } from './catioScene.ts';
import { defaultSubassemblySettings, parseSubassemblySettings } from './catioSubassembly.ts';
import { tunnelDefinition } from './catioSubassemblies.ts';
import {
  cubeFacing, facePoint, groundAt, jointSetback, placedRoute, portFloor, PORT_MOVED, SUPPORT_FIXINGS, TUNNEL, TUNNEL_CONTROLS, TUNNEL_DEFAULT, TUNNEL_PAD_HEIGHT, TUNNEL_PRESETS, tunnelFacts, tunnelBom, tunnelLayout, tunnelSite, tunnelSteps, validateTunnel, vec, type SupportFixing, type TunnelConfig,
} from './catioTunnel.ts';
import { createTunnelScene, LIFT } from './catioTunnelScene.ts';
import { TUNNEL_COUPLING_CONTROLS, TUNNEL_COUPLING_DEFAULT, type TunnelCouplingConfig } from './catioTunnelJoint.ts';
import { PRINTED_LATCH_JOINT } from './catioPrintedLatch.ts';
import { cubeEdge } from './catioPort.ts';
import type { V3 } from './catioSubassembly.ts';
import { WINDOW_INSERT_DEFAULT, windowInsertLayout, type WindowInsertConfig } from './catioWindowInsert.ts';

const site = tunnelSite();
const installed: CatioState = { progress: 6, exploded: false, windowOpen: true, cutaway: false, hidden: new Set() };
/** Every option of every select control, one at a time, from the defaults. */
// (a port facing left along the wall stands to the left of the window)
const optionConfigs: TunnelConfig[] = [TUNNEL_DEFAULT, ...TUNNEL_CONTROLS.filter(c => !c.range).flatMap(control => control.options.map(option => ({ ...TUNNEL_DEFAULT, [control.key]: option.value, ...(control.key === 'portFacing' && option.value === -90 ? { portX: -TUNNEL_DEFAULT.portX } : {}) }))),
  // the Ganter feet in every size, and the printed feet at their lowest and highest
  ...TUNNEL_FOOT.diameters.map(footDiameter => ({ ...TUNNEL_DEFAULT, footPad: 'ganter' as const, footDiameter })),
  { ...TUNNEL_DEFAULT, padHeight: TUNNEL_PAD_HEIGHT.min }, { ...TUNNEL_DEFAULT, padHeight: TUNNEL_PAD_HEIGHT.max, footDiameter: 25 },
  // self-standing on uneven ground of ±10 mm: the shorter screw in the feet
  { ...TUNNEL_DEFAULT, supportBase: 'self-standing', groundTolerance: 10 }];
/** Routes that turn either way, at odd angles, climb and fall, with both joint types. */
/** The routes' common start: the tunnel's earlier recommended route, two turns and a climb in the middle leg. */
const ROUTE: TunnelConfig = { ...TUNNEL_DEFAULT, portX: 1200, portY: 3000, final: 700, slopeLeg: 'middle' };
const routes: TunnelConfig[] = ([
  TUNNEL_DEFAULT, ROUTE,
  { ...ROUTE, portX: -1730, portY: 3420, portFacing: -25, portHeight: 820, slopeLeg: 'final', final: 2300 },
  { ...ROUTE, portX: 2600, portY: 2200, portFacing: 90, portHeight: 300, approach: 900, final: 600 },
  { ...ROUTE, portX: 0, portY: 4000, portFacing: 0, portHeight: 245, slopeLeg: 'approach', approach: 1500 },
  { ...ROUTE, portX: 900, portY: 5200, portFacing: 15, portHeight: 1100, maxSlope: 25, sectionLength: 2 },
  { ...ROUTE, portX: -2400, portY: 2600, portFacing: -60, portHeight: 400, slopeLeg: 'approach', approach: 1800, groundFall: 4 },
] satisfies TunnelConfig[]).flatMap((config): TunnelConfig[] => [config, { ...config, angleJoint: 'angle-collar' }, { ...config, angleJoint: 'mitred-ends' }, { ...config, straights: 'cubes' }]);
/** Where a route's enclosure port faces: as asked, or with cube corners the nearest of straight out and along the wall. */
const facingOf = (config: TunnelConfig) => config.angleJoint === 'cube-corner' ? cubeFacing(config.portFacing) : config.portFacing;
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
      // it ends where its whole elements end, the coupling's gap short of the enclosure port's face, at the port's floor
      close(vec.add(last.end.at, vec.mul(last.end.n, l.gap)), l.E, 6, 'end');
      expect(l.E[2]).toBeCloseTo(config.portHeight, 6);
      expect(l.moved).toBeCloseTo(vec.len(vec.sub(l.E, [config.portX, config.portY, config.portHeight])), 9);
      const facing = facingOf(config);
      close(last.end.n, [Math.sin(facing * Math.PI / 180), Math.cos(facing * Math.PI / 180), 0], 9, 'end square to the port');
      // the turns add up to the port's facing (cube corners: each a right angle), and every slope is within the limit
      expect(l.joints.filter(j => j.kind === 'turn').reduce((s, j) => s + j.angle, 0)).toBeCloseTo(facing, 6);
      if (config.angleJoint === 'cube-corner') for (const j of l.joints.filter(q => q.kind === 'turn')) { expect(Math.abs(j.angle)).toBeCloseTo(90, 9); expect(j.cube).not.toBeNull(); }
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

  it('is built of whole standard elements: every straight run a whole number of pitches, every coupling a standard port', () => {
    for (const joint of [TUNNEL_COUPLING_DEFAULT, bolted]) for (const config of [...routes, ...TUNNEL_PRESETS.map(p => p.config())]) {
      const l = tunnelLayout(config, site, joint);
      expect(l.errors, `${JSON.stringify(config)} ${joint.mechanism}`).toEqual([]);
      expect(l.cubeEdge).toBe(cubeEdge(l.w)); expect(l.pitch).toBe(l.cubeEdge + l.gap);
      // a long section is a whole number of pitches less the gap after it, no more than the longest; a cube is one cube edge
      for (const p of l.pieces.filter(q => q.kind === 'section')) {
        const pitches = (p.length + l.gap) / l.pitch;
        expect(pitches, p.id).toBeCloseTo(Math.round(pitches), 9);
        expect(Math.round(pitches), p.id).toBeLessThanOrEqual(config.sectionLength);
        expect(Math.round(pitches), p.id).toBeGreaterThanOrEqual(1);
      }
      for (const p of l.pieces.filter(q => q.kind === 'cube')) { expect(p.length).toBe(l.cubeEdge); expect(p.cube).not.toBeNull(); }
      // level runs of cubes when chosen; sloped runs are always long sections
      if (config.straights === 'cubes') expect(l.pieces.filter(p => p.kind === 'section').every(p => Math.abs(p.pitch) > 0.01)).toBe(true);
      // the pieces and the gaps between them make up the route; a collar's ends stay at its setback from the vertex
      for (const j of l.joints) expect(j.stop - j.setback, j.id).toBeCloseTo((j.collar || j.cube) && joint.mechanism === 'printed-latch' ? PRINTED_LATCH_JOINT.gap : 0, 9);
      // the enclosure end is a standard port like every other: coupled as the couplings are, its bolts at the same stations
      const port = l.couplings.find(c => c.id === 'port');
      expect(port).toMatchObject({ kind: joint.mechanism === 'printed-latch' ? 'latched' : 'bolted', gap: l.gap });
      expect(port?.bolts).toHaveLength(joint.mechanism === 'bolts' ? joint.boltsPerCoupling : 0);
    }
  });

  it('puts the enclosure port where its whole elements end, and says so when that is not where it was asked', () => {
    // the defaults and the presets are set where their elements end: no move
    for (const config of [TUNNEL_DEFAULT, ...TUNNEL_PRESETS.map(p => p.config())]) expect(tunnelLayout(config, site).moved, JSON.stringify(config)).toBeLessThan(PORT_MOVED);
    expect(tunnelFacts('modular', TUNNEL_DEFAULT, site).some(f => f.label.startsWith('Enclosure port'))).toBe(false);
    // asked between two whole elements, it goes to the nearer
    const asked = { ...TUNNEL_DEFAULT, portX: 0, portY: 2300, portLevel: 'window' as const };
    const l = tunnelLayout(asked, site);
    expect(l.errors).toEqual([]);
    const pitches = (l.E[1] - TUNNEL.wallGap) / l.pitch;
    expect(pitches).toBeCloseTo(Math.round(pitches), 6);
    expect(Math.abs(l.E[1] - 2300)).toBeLessThanOrEqual(l.pitch / 2);
    expect(l.moved).toBeGreaterThan(PORT_MOVED);
    expect(tunnelFacts('modular', asked, site).find(f => f.label.startsWith('Enclosure port'))?.value).toMatch(/asked 0, 230: \d+(\.\d)? cm off/);
    // set to where it was placed, the route is the same and nothing moves
    const placed = placedRoute(asked, site);
    expect(tunnelLayout(placed, site).moved).toBeLessThan(PORT_MOVED);
    expect(tunnelLayout(placed, site).pieces.map(p => p.length)).toEqual(l.pieces.map(p => p.length));
    // cube corners turn only 90°: a port asked to face 30° faces straight out, and the brief says it was turned
    const turned = tunnelLayout({ ...TUNNEL_DEFAULT, portFacing: 30 }, site);
    expect(turned.facingMoved).toBeCloseTo(30, 9);
    expect(tunnelFacts('modular', { ...TUNNEL_DEFAULT, portFacing: 30 }, site).find(f => f.label.startsWith('Enclosure port'))?.value).toMatch(/facing 0°.*, 30°/);
    // the latches' gaps come out of the elements: with bolts the pitch is a cube's edge, so the port lands nearer the wall
    const latched = tunnelLayout(TUNNEL_DEFAULT, site, TUNNEL_COUPLING_DEFAULT); const boltedRoute = tunnelLayout(TUNNEL_DEFAULT, site, bolted);
    expect(latched.pieces.map(p => p.kind)).toEqual(boltedRoute.pieces.map(p => p.kind));
    expect(boltedRoute.pitch).toBe(latched.pitch - PRINTED_LATCH_JOINT.gap);
  });

  it('puts the printed latches on the flanges’ outer sides, plates within the flanges, screws in the timber and clear of the bearer’s and rails’ screws', () => {
    for (const joint of joints.filter(j => j.mechanism === 'printed-latch')) for (const config of routes) {
      const l = tunnelLayout(config, site, joint);
      expect(l.errors).toEqual([]);
      for (const c of l.couplings.filter(k => k.kind === 'latched')) {
        expect(c.latches).toHaveLength(2 * joint.latchesPerSide); expect(c.bolts).toEqual([]);
        expect(c.seal !== null).toBe(joint.seal === 'e-profile');
        for (const q of c.latches) {
          // on the side face, the pull along the tunnel towards the flange with the base plate: seen from outside, every port has its
          // base plates on its left, so the piece after the joint has them on the left of the tunnel (looking along it), the piece
          // before it on the right
          expect(q.base, q.id).toBe(q.side < 0 ? 'port' : 'outside');
          close(q.pull, vec.mul(c.face.n, q.base === 'port' ? 1 : -1), 12, q.id);
          expect(vec.dot(vec.sub(q.at, c.face.at), c.face.frame.x)).toBeCloseTo(q.side * (l.w / 2 + TUNNEL.flange.width), 6);
        }
      }
      const screws = l.fasteners.filter(f => f.component === 'latch-screws' || f.component === 'catch-screws');
      // the couplings' latches and the latched doors' (on the cubes)
      expect(screws).toHaveLength(4 * (l.couplings.reduce((n, c) => n + c.latches.length, 0) + l.doors.reduce((n, d) => n + d.latches.length, 0)));
      for (const f of screws.filter(q => l.couplings.some(k => k.latches.some(m => m.id === q.of)))) {
        const c = l.couplings.find(k => k.latches.some(q => q.id === f.of)); if (!c) throw new Error(f.of);
        const q = c.latches.find(k => k.id === f.of);
        // into the flange its plate is on (the base's: after the joint where the base is the port's), at least 5 mm in from its face
        const after = (f.component === 'latch-screws') === (q?.base === 'port');
        const depth = -vec.dot(vec.sub(f.at, c.face.at), c.face.n);
        if (after) expect(-depth, f.of).toBeGreaterThan(5); else expect(depth - c.gap, f.of).toBeGreaterThan(5);
        expect(f.piece, f.of).toBe(after ? c.after ?? undefined : c.before ?? undefined);
      }
    }
    // bolted, only the cubes' latched doors have latches
    const boltedLayout = tunnelLayout(TUNNEL_DEFAULT, site, bolted);
    expect(boltedLayout.fasteners.some(f => f.component === 'latch-screws' && !boltedLayout.doors.some(d => d.latches.some(q => q.id === f.of)))).toBe(false);
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
        expect(vec.len(vec.sub(facePoint(collar.start, uo, vo, TUNNEL.flange.thickness), facePoint(collar.end, uo, vo, -TUNNEL.flange.thickness))), `${j.id} outside`).toBeGreaterThan(1e-3);
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

  it('climbs exactly the difference between the two floors, on whole long sections', () => {
    for (const config of routes) {
      const l = tunnelLayout(config, site);
      expect(l.E[2]).toBeCloseTo(config.portHeight, 9);
      expect(l.rise).toBeCloseTo(config.portHeight - site.floorZ, 9);
      if (Math.abs(l.rise) > 1) {
        expect(l.slope?.pitch).toBeDefined();
        // the sloped run is whole pitches of long section, the fewest that climb it within the steepest slope
        const pitches = ((l.slope?.run ?? 0) + l.gap) / l.pitch;
        expect(pitches).toBeCloseTo(Math.round(pitches), 9);
        expect(Math.abs(l.slope?.pitch ?? 0)).toBeLessThanOrEqual(config.maxSlope + 1e-9);
        for (const p of l.pieces.filter(q => Math.abs(q.pitch) > 0.01 && q.kind !== 'collar')) expect(p.kind, p.id).toBe('section');
      }
    }
    // a small climb gets a shallower slope over one pitch
    const small = tunnelLayout({ ...TUNNEL_DEFAULT, portHeight: 275 }, site);
    expect(Math.abs(small.slope?.pitch ?? 0)).toBeLessThan(TUNNEL_DEFAULT.maxSlope);
    expect(small.slope?.run).toBeCloseTo(small.pitch - small.gap, 6);
  });

  it('explains what cannot be built, and moves the port for a leg too short for its joints', () => {
    expect(validateTunnel('modular', { ...TUNNEL_DEFAULT, angleJoint: 'angle-collar', portX: 4000, portY: 900, final: 1200 }, site).join()).toMatch(/back into the wall/);
    expect(validateTunnel('modular', { ...TUNNEL_DEFAULT, angleJoint: 'mitred-ends', portX: 2600, portY: 900, portFacing: 60 }, site).join()).toMatch(/mitred ends go to 90°/);
    // the same 95° turn is fine for an angle collar
    expect(validateTunnel('modular', { ...TUNNEL_DEFAULT, angleJoint: 'angle-collar', portX: 2600, portY: 900, portFacing: 60 }, site)).toEqual([]);
    expect(validateTunnel('modular', { ...TUNNEL_DEFAULT, portHeight: 150, slopeLeg: 'approach', approach: 2000 }, site).join()).toMatch(/too close to the ground/);
    expect(validateTunnel('modular', { ...TUNNEL_DEFAULT, portX: 2400, portY: 2000, portFacing: -90 }, site).join()).toMatch(/must be to the left of the window/);
    expect(validateTunnel('modular', { ...TUNNEL_DEFAULT, portX: -2400, portY: 2000, portFacing: -90 }, site)).toEqual([]);
    // a climb in a leg too short for it still climbs, on whole elements: the port goes as far out as they take it
    const climb = { ...TUNNEL_DEFAULT, portHeight: 1400, slopeLeg: 'approach' as const };
    const l = tunnelLayout(climb, site);
    expect(l.errors).toEqual([]);
    expect(l.E[2]).toBeCloseTo(1400, 6); expect(l.moved).toBeGreaterThan(PORT_MOVED);
  });

  it('turns at cubes: the run in by the cube’s back face, out by its side, every other face closed by a door', () => {
    for (const config of routes.filter(c => c.angleJoint === 'cube-corner')) {
      const l = tunnelLayout(config, site);
      for (const j of l.joints.filter(q => q.kind === 'turn')) {
        const c = l.pieces.find(p => p.id === j.cube); if (!c?.cube) throw new Error(j.id);
        // its centre over the vertex, half a cube up from the floor's centre line
        close(c.cube.centre, vec.add(j.vertex, [0, 0, l.h / 2]), 6, j.id);
        const exit = j.angle > 0 ? 'right' : 'left';
        expect(Object.entries(c.cube.roles).filter(([, r]) => r === 'coupling').map(([f]) => f).sort()).toEqual(['back', exit].sort());
        close(c.end.n, j.b, 9, j.id);
        close(c.end.at, c.cube.faces[exit].at, 9, j.id);
        expect(l.doors.filter(d => d.piece === c.id).map(d => d.face).sort()).toEqual(['front', 'left', 'right', 'top', 'bottom'].filter(f => f !== exit).sort());
      }
      for (const c of l.pieces.filter(p => p.cube && !p.joint)) expect(l.doors.filter(d => d.piece === c.id)).toHaveLength(4);
    }
  });
});

describe('tunnel supports', () => {
  it('puts a support at both ends, at every straight coupling and at every joint, within a section’s length of each other', () => {
    for (const config of routes) {
      const l = tunnelLayout(config, site);
      // (a cube at a corner stands on the supports under its two couplings)
      const straight = l.interfaces.filter(i => i.kind === 'coupling' && ![i.before, i.after].some(id => id?.startsWith('collar')) && !l.joints.some(j => vec.len(vec.sub(j.vertex, i.face.at)) < 1e-9));
      expect(l.supports).toHaveLength(2 + straight.length + l.joints.filter(j => !j.cube).length);
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
        for (const z of over) expect(z, `${s.id} ${JSON.stringify(config)}`).toBeGreaterThanOrEqual(s.top - 0.05);
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
  const straight: TunnelConfig = { ...TUNNEL_DEFAULT, portX: 0, portY: 3000, portLevel: 'window', sectionLength: 1 };
  const fp = 'iso-2338-8x40';

  it('screws up through every bearer by default, and binds every support to the tunnel', () => {
    const l = held('screws');
    expect(TUNNEL_DEFAULT.supportFixing).toBe('screws'); expect(TUNNEL_DEFAULT.supportBase).toBe('trestle');
    expect(l.fasteners.filter(f => f.component === 'flange-screws')).toHaveLength(l.supports.reduce((n, s) => n + s.fixings.length, 0));
    expect(l.supports.every(s => s.hold.attached)).toBe(true);
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

  it('straps each support over the tunnel, hooked under cleats on the bearer’s ends', () => {
    const l = held('strap');
    for (const s of l.supports) {
      const strap = s.hold.strap; if (!strap) throw new Error(s.id);
      expect(strap.cleats).toHaveLength(2);
      // from below the bearer's top, over the tunnel's top (flanges, or a collar's roof), down to the other end
      const [a, b, c, d] = strap.path; if (!a || !b || !c || !d) throw new Error('path');
      expect(a[2]).toBeLessThan(s.top); expect(d[2]).toBeLessThan(s.top);
      expect(b[2]).toBeCloseTo(s.top + l.h + 2 * TUNNEL.flange.width - (s.flanges ? 0 : TUNNEL.flange.width - TUNNEL.rail), 6);
      expect(strap.length).toBeGreaterThan(2 * (b[2] - a[2]) + l.w);
    }
    const lines = tunnelBom('modular', { ...TUNNEL_DEFAULT, supportFixing: 'strap' }, site);
    expect(lines.filter(line => line.name.startsWith('EPDM tarp strap')).reduce((n, line) => n + line.quantity, 0)).toBe(l.supports.length);
    expect(lines.find(line => line.name === 'Strap cleat')?.quantity).toBe(2 * l.supports.length);
  });

  it('turns a button flat on a post on the bearer’s end over a keeper on each flange’s side, under flanges flush with its ends', () => {
    const l = held('turn-buttons', 'trestle', straight);
    expect(l.errors).toEqual([]);
    const { keeper, button } = TUNNEL.fixing;
    for (const s of l.supports) {
      expect(s.hold.buttons).toHaveLength(2 * s.flanges);
      for (const b of s.hold.buttons) {
        const out = (q: V3) => vec.dot(vec.sub(q, s.at), vec.mul(s.across, b.side)) - s.length / 2;
        const z = (box: { center: V3; size: V3 }) => [box.center[2] - box.size[2] / 2, box.center[2] + box.size[2] / 2];
        // the keeper on the flange's side, above the bearer and proud of the flush face; the post on the bearer's end below it
        expect(z(b.keeper)[0]).toBeCloseTo(s.top + keeper.above, 9); expect(out(b.keeper.center)).toBeCloseTo(keeper.out / 2, 9);
        expect(z(b.post)[0]).toBeLessThan(s.top); expect(out(b.post.center)).toBeGreaterThan(0);
        // the button lies on its post, just clear of the keeper's top, and reaches over it
        expect(z(b.button)[0]).toBeCloseTo((z(b.keeper)[1] ?? 0) + button.clearance, 9);
        expect(z(b.post)[1]).toBeCloseTo(z(b.button)[0] ?? 0, 9);
        const along = (q: V3) => vec.dot(vec.sub(q, s.at), s.along);
        expect(along(b.button.center) + b.button.size[1] / 2).toBeGreaterThanOrEqual(along(b.keeper.center) + b.keeper.size[1] / 2 - 1e-9);
        // its pivot screw goes down into the post; the keeper belongs to the section, the button to the support
        expect(b.pivot[2]).toBeCloseTo((z(b.button)[1] ?? 0), 9);
        expect(b.piece).not.toBe('');
      }
    }
    const screws = (component: string) => l.fasteners.filter(f => f.component === component);
    const buttons = l.supports.reduce((n, s) => n + s.hold.buttons.length, 0);
    expect(screws('keeper-screws')).toHaveLength(buttons); expect(screws('post-screws')).toHaveLength(2 * buttons); expect(screws('button-screws')).toHaveLength(buttons);
    expect(screws('button-screws').every(f => f.direction[2] === -1)).toBe(true);
    expect(held('turn-buttons').errors.join()).toMatch(/Turn buttons fit only under flanges flush/);
  });

  it('rests on self-standing supports by gravity only, and says a trestle cannot', () => {
    expect(held('gravity').errors.join()).toMatch(/With gravity only, nothing holds a support to the tunnel.*Choose self-standing supports/);
    const l = held('gravity', 'self-standing');
    expect(l.errors).toEqual([]);
    expect(l.supports.every(s => !s.hold.attached && s.stands && s.feet.length === 4)).toBe(true);
    // a trestle's legs on soles, a low bearer wide along the tunnel: two feet along the tunnel under each end, both on the one slab
    const trestles = l.supports.filter(s => s.kind === 'trestle'); const blocks = l.supports.filter(s => s.kind === 'block');
    expect(trestles.length).toBeGreaterThan(0); expect(blocks.length).toBeGreaterThan(0);
    for (const s of l.supports) {
      expect(s.soles).toHaveLength(s.kind === 'trestle' ? 2 : 0);
      expect(s.width).toBe(s.kind === 'trestle' ? TUNNEL.bearer.width : TUNNEL.wideBlock.width);
      for (const end of [0, 1]) {
        const feet = s.feet.filter(f => f.end === end); const [a, b] = feet; if (!a || !b) throw new Error(s.id);
        expect(Math.abs(vec.dot(vec.sub(a.at, b.at), s.along))).toBeCloseTo(s.kind === 'trestle' ? TUNNEL.sole.length - 2 * TUNNEL.sole.footInset : TUNNEL.wideBlock.width - 2 * TUNNEL.wideBlock.footInset, 6);
        expect(a.slabAt).toEqual(b.slabAt);
      }
    }
    // the wall end's low bearer stays clear of the wall
    const wall = l.supports.find(s => s.id === 'support-wall'); if (!wall) throw new Error('wall');
    expect(wall.at[1] - wall.width / 2).toBeGreaterThanOrEqual(TUNNEL.wallGap - 1e-6);
    const lines = tunnelBom('modular', { ...TUNNEL_DEFAULT, supportFixing: 'gravity', supportBase: 'self-standing' }, site);
    expect(lines.find(line => line.name === 'Sole')?.quantity).toBe(2 * trestles.length);
    expect(lines.filter(line => line.name === 'Low bearer, wide').reduce((n, line) => n + line.quantity, 0)).toBe(blocks.length);
    expect(lines.find(line => line.name === 'Sole')?.size).toBe(`${TUNNEL.sole.width} × ${TUNNEL.sole.thickness} on edge · ${TUNNEL.sole.length} long`);
    expect(lines.find(line => line.id === 'slabs')?.quantity).toBe(2 * l.supports.length + l.props.length);
  });

  it('keeps every screw of a self-standing support inside its timber: the feet’s in the sole, the sole’s in the leg or low bearer', () => {
    for (const groundTolerance of [10, 15, 20] as const) for (const footPad of ['printed', 'ganter'] as const) {
      const l = held('gravity', 'self-standing', { ...straight, groundTolerance, footPad });
      if (footPad === 'printed') {
        // the shortest library screw with the travel the ground needs: M8 × 60 for ±10 mm, M8 × 80 beyond
        expect(l.pad?.screw.id).toBe(groundTolerance === 10 ? 'iso-4017-m8x60' : 'iso-4017-m8x80');
        expect(l.errors).toEqual([]);
      }
      for (const s of l.supports) for (const f of s.feet) {
        const soleBottom = f.slabTop + l.footHeight + f.actualSetting; const soleTop = soleBottom + TUNNEL.sole.thickness;
        // the stud's tip, however far the foot is turned within the travel the ground needs, stays inside the sole
        for (const setting of [f.setting - groundTolerance, f.setting + groundTolerance, f.actualSetting]) {
          if (setting < l.travel.min - 1e-6 || setting > l.travel.max + 1e-6) continue;
          expect(f.slabTop + l.footHeight + l.stud - (setting - f.actualSetting), f.id).toBeLessThan(soleTop);
        }
        expect(l.travel.max - l.travel.min).toBeGreaterThanOrEqual(0);
      }
      for (const f of l.fasteners.filter(q => q.component === 'sole-screws')) {
        const s = l.supports.find(q => q.id === f.support) ?? l.supports.find(q => q.feet.some(g => Math.hypot(g.legAt[0] - f.at[0], g.legAt[1] - f.at[1]) < 50)); if (!s) throw new Error('support');
        // up through the sole into the leg (or low bearer) above it: within its 45 × 45 (or its width along the tunnel)
        const end = s.feet.find(g => g.primary && Math.hypot(g.legAt[0] - f.at[0], g.legAt[1] - f.at[1]) < 50); if (!end) throw new Error('end');
        expect(Math.abs(vec.dot(vec.sub(f.at, end.legAt), s.along))).toBeLessThan(TUNNEL.leg / 2);
        expect(Math.abs(vec.dot(vec.sub(f.at, end.legAt), s.across))).toBeLessThan(TUNNEL.leg / 2 - 5);
        expect(end.leg).toBeGreaterThan(0);
        expect(f.direction).toEqual([0, 0, 1]);
        expect(100 - TUNNEL.sole.thickness).toBeGreaterThan(20);
      }
    }
    // a screw or stud that would come out of the top of a shallow low bearer is reported, and the shorter screw of a smaller
    // tolerance fits there
    const shallow: TunnelConfig = { ...ROUTE, angleJoint: 'angle-collar', portHeight: 200, slopeLeg: 'approach', approach: 1500, final: 1500 };
    expect(tunnelLayout(shallow, site).errors.join()).toMatch(/At the joint \d a foot’s screw would come out of the top of the low bearer \(59 mm up into \d+ mm\)/);
    expect(tunnelLayout({ ...shallow, footPad: 'ganter' }, site).errors.join()).toMatch(/a foot’s stud would come out of the top of the low bearer/);
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
      expect(ids.includes('support-fixings'), fixing).toBe(['dowels', 'strap', 'turn-buttons'].includes(fixing));
      expect(ids.includes('flange-screws'), fixing).toBe(fixing === 'screws');
      expect(ids.includes('straps'), fixing).toBe(fixing === 'strap');
      expect(ids.includes('turn-buttons'), fixing).toBe(fixing === 'turn-buttons');
      expect(scene.layout.supports.every(s => s.stands)).toBe(true);
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
      // latched by default: only any mitred joint is bolted
      expect(bolts).toBe(l.couplings.filter(c => c.kind === 'bolted').length * TUNNEL_COUPLING_DEFAULT.boltsPerCoupling);
      const latches = l.couplings.reduce((n, c) => n + c.latches.length, 0);
      expect(latches).toBe(l.couplings.filter(c => c.kind === 'latched').length * 2 * TUNNEL_COUPLING_DEFAULT.latchesPerSide);
      // the cubes' doors are set in, on turn buttons, by default; blanks would be held by the ports' own latches, the same printed latch
      const doorLatches = l.doors.reduce((n, d) => n + d.latches.length, 0);
      expect(doorLatches).toBe(TUNNEL_COUPLING_DEFAULT.doorFixing === 'latches' ? l.doors.length * 2 * TUNNEL_COUPLING_DEFAULT.latchesPerSide : 0);
      if (latches + doorLatches) expect(lines.find(line => line.modelId === 'toggle-latch')).toMatchObject({ quantity: latches + doorLatches, name: 'Toggle latch, printed' });
      expect(l.fasteners.filter(f => f.component === 'latch-screws' || f.component === 'catch-screws')).toHaveLength(4 * (latches + doorLatches));
      // the latches' screws, and the pivots of the side-access panels' door turn buttons, which are the same screw
      const doorScrews = (id: string) => [...l.access, ...l.doors].reduce((n, a) => n + a.door.fasteners.filter(f => f.partId === id).length, 0);
      expect(count('din-7997-4x25')).toBe(l.fasteners.filter(f => f.partId === 'din-7997-4x25').length + doorScrews('din-7997-4x25'));
      expect(lines.find(line => line.id === 'coupling-seal')?.quantity ?? 0).toBe(l.couplings.filter(c => c.seal).length);
      // a printed foot's screw and lock nut are the coupling's M8 × 80 and nut
      const feet = l.supports.reduce((n, s) => n + s.feet.length, 0);
      expect(feet).toBe((config.supportBase === 'self-standing' ? 4 : 2) * l.supports.length);
      // (a self-standing support's printed feet may take a shorter screw)
      expect(count('iso-4017-m8x80') + (l.pad && l.pad.screw.id !== 'iso-4017-m8x80' ? count(l.pad.screw.id) : 0)).toBe(bolts + (l.pad ? feet : 0));
      expect(count('iso-7093-m8')).toBe(2 * bolts);
      expect(count('iso-4032-m8')).toBe(bolts + (l.pad ? feet : 0));
      if (l.pad) expect(lines.find(line => line.modelId === 'pressure-pad')).toMatchObject({ id: 'foot-pads', quantity: feet, size: `Ø ${config.footDiameter} × ${config.padHeight} mm · ${config.padSurface} sole · PETG · for an ${l.pad.screw.designation} head` });
      else { expect(count(l.foot.id)).toBe(feet); expect(lines.some(line => line.modelId === 'pressure-pad')).toBe(false); }
      expect(count('din-7965-m8x18')).toBe(feet);
      expect(lines.find(line => line.id === 'slabs')?.quantity).toBe(2 * l.supports.length + l.props.length);
      expect(lines.filter(line => line.name === 'Leg').reduce((n, line) => n + line.quantity, 0)).toBe(l.supports.filter(s => s.kind === 'trestle').length * 2);
      // two flange rings a section or collar, six a cube, four members each
      const cubes = l.pieces.filter(p => p.kind === 'cube').length;
      expect(lines.filter(line => line.name.startsWith('Flange')).reduce((n, line) => n + line.quantity, 0)).toBe(8 * (l.pieces.length - cubes) + 24 * cubes);
      expect(lines.find(line => line.name === 'Corner block')?.quantity ?? 0).toBe(8 * cubes);
      expect(lines.some(line => line.name === 'Collar floor')).toBe(l.pieces.some(p => p.kind === 'collar'));
    }
  });

  it('nets each piece with one hood held at every mesh of its cut edges, or meshes it with three stapled welded panels, from one roll', () => {
    const net = catioMesh('netting'); const span = (a: V3, b: V3) => vec.len(vec.sub(b, a));
    expect(TUNNEL_DEFAULT.mesh).toBe('netting');
    for (const route of routes) for (const mesh of ['netting', 'welded'] as const) {
      const l = tunnelLayout({ ...route, mesh }, site);
      const staples = l.fasteners.filter(f => f.component === 'staples');
      const on = (edge: { from: V3; to: V3 }) => staples.filter(f => Math.abs(span(edge.from, f.at) + span(f.at, edge.to) - span(edge.from, edge.to)) < 1e-6).length;
      for (const panel of l.panels) for (const edge of panel.edges) {
        const pitch = span(edge.from, edge.to) / on(edge);
        // a net's cut edges (the bottom rails and the flanges): a staple over every mesh; everything else, every 15 cm at most
        expect(pitch, `${panel.id} ${edge.use}`).toBeLessThanOrEqual(mesh === 'netting' && edge.cut ? net.opening : TUNNEL.staplePitch);
        if (mesh === 'welded') expect(edge.cut).toBe(true);
      }
      // the hood passes over the top rails uncut: only the roof's staples hold it there, and its sides have none of their own
      // (beside a mitred section's side access, a net piece of its own fills the side: cut all round)
      const beside = l.panels.filter(panel => panel.id.includes('-mesh-beside-'));
      const top = l.panels.filter(panel => !beside.includes(panel)).flatMap(panel => panel.edges.filter(edge => edge.use === 'Onto the top rail').map(edge => ({ side: panel.name.includes('side'), cut: edge.cut })));
      // (a cube has no mesh of its own: its doors have)
      const meshed = l.pieces.filter(p => p.kind !== 'cube').length;
      if (mesh === 'netting') expect(top.every(edge => !edge.side && !edge.cut)).toBe(true);
      // (a side-access panel takes the place of one side's mesh)
      else expect(top.filter(edge => edge.side)).toHaveLength(2 * meshed - l.access.length);
      const lines = tunnelBom('modular', { ...route, mesh }, site).filter(line => line.group === 'Mesh');
      expect(lines[0]).toMatchObject({ id: 'mesh-roll', quantity: 1, partId: CATIO_MESH_PARTS[mesh] });
      expect(lines[0]?.use).toContain('more rolls may be needed');
      // a side-access panel has its own mesh, and takes the place of one side's; so has every cube's door but the floor's
      expect(lines.filter(line => line.name === 'Net, beside the side access').reduce((n, line) => n + line.quantity, 0)).toBe(mesh === 'netting' ? beside.length : 0);
      const panelMesh = lines.filter(line => line.name === 'Removable panel mesh');
      expect(panelMesh.reduce((n, line) => n + line.quantity, 0)).toBe(l.access.length + l.doors.filter(d => d.face !== 'bottom').length);
      const cut = lines.slice(1).filter(line => !panelMesh.includes(line)); const count = cut.reduce((n, line) => n + line.quantity, 0);
      expect(cut.every(line => !line.partId)).toBe(true);
      if (mesh === 'netting') {
        expect(cut.every(line => line.name === 'Net hood' || line.name === 'Net, beside the side access')).toBe(true); expect(count).toBe(meshed + beside.length);
        // as wide as both sides and the roof together
        const piece = l.pieces.find(p => p.kind === 'section' && !l.access.some(a => a.piece === p.id)); const panels = l.panels.filter(panel => panel.piece === piece?.id);
        const across = Math.round(panels.reduce((sum, panel) => sum + span(panel.corners[0], panel.corners[3]), 0));
        if (piece) expect(cut.some(line => line.size.includes(`× ${across} ·`))).toBe(true);
      } else expect(count).toBe(3 * meshed - l.access.length + beside.length);
    }
    expect(tunnelSteps('modular', TUNNEL_DEFAULT).find(step => step.title.startsWith('Net the sections'))?.detail).toContain('a staple over every mesh');
    expect(tunnelSteps('modular', { ...TUNNEL_DEFAULT, mesh: 'welded' }).find(step => step.title.startsWith('Mesh the sections'))?.detail).toContain('every 15 cm');
  });

  it('lists the mitre angles in the cut list of mitred sections, and only square cuts for collared ones', () => {
    const collar = tunnelBom('modular', TUNNEL_DEFAULT, site).filter(line => line.name === 'Section rail');
    expect(collar.every(line => line.size.includes('square ends'))).toBe(true);
    const mitred = tunnelBom('modular', { ...TUNNEL_DEFAULT, angleJoint: 'mitred-ends' }, site);
    expect(mitred.some(line => /mitre face/.test(line.size))).toBe(true);
    expect(mitred.some(line => line.name === 'Section rail' && /°/.test(line.size))).toBe(true);
  });

  it('lists bolts at every coupling with the bolts, and at mitred joints', () => {
    for (const joint of joints) for (const config of [TUNNEL_DEFAULT, { ...ROUTE, angleJoint: 'angle-collar' as const }, { ...ROUTE, angleJoint: 'mitred-ends' as const }]) {
      const l = tunnelLayout(config, site, joint); const lines = tunnelBom('modular', config, site, joint);
      const count = (id: string) => lines.find(line => line.partId === id)?.quantity ?? 0;
      const bolts = l.couplings.filter(c => c.kind === 'bolted').length * joint.boltsPerCoupling;
      if (joint.mechanism === 'bolts' || config.angleJoint === 'mitred-ends') expect(bolts).toBeGreaterThanOrEqual(joint.boltsPerCoupling);
      expect(count('iso-7093-m8')).toBe(2 * bolts);
      expect(count('iso-4017-m8x80')).toBe(bolts + (l.pad ? 2 * l.supports.length : 0));
      expect(lines.some(line => line.modelId === 'toggle-latch')).toBe(l.couplings.some(c => c.kind === 'latched') || l.doors.some(d => d.latches.length > 0));
      // cube corners and angle collars keep every coupling square, the enclosure end too: all latched
      if (config.angleJoint !== 'mitred-ends') expect(l.couplings.filter(c => c.kind === 'bolted').map(c => c.id)).toEqual(joint.mechanism === 'bolts' ? l.couplings.map(c => c.id) : []);
      if (joint.mechanism === 'bolts') expect(l.couplings.every(c => c.kind === 'bolted')).toBe(true);
      // the bolts of each coupling at the standard port's stations: the same number on each of its four sides
      for (const c of l.couplings.filter(k => k.kind === 'bolted' && vec.dot(k.face.n, k.face.frame.y) > 1 - 1e-9)) {
        const sides = [0, 1, 2, 3].map(side => c.bolts.filter(b => {
          const d = vec.sub(b.at, c.face.at); const u = vec.dot(d, c.face.frame.x); const v = vec.dot(d, c.face.frame.z) - l.h / 2;
          return side === 0 ? u < -Math.abs(v) : side === 1 ? u > Math.abs(v) : side === 2 ? v > Math.abs(u) : v < -Math.abs(u);
        }).length);
        expect(sides, c.id).toEqual([1, 1, 1, 1].map(() => joint.boltsPerCoupling / 4));
      }
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
    expect(scene.components.map(part => part.id)).toEqual(expect.arrayContaining(['terrain', 'window-insert', 'enclosure-port', 'slabs', 'legs', 'levelling-feet', 'bearers', 'flanges', 'rails', 'mesh', 'staples', 'section-latches', 'section-latch-screws', 'section-seals', 'flange-screws', 'docking-frame', 'coupling-latches', 'cube-doors', 'cube-door-mesh', 'cube-door-hardware']));
    // printed latches at every coupling by default, the enclosure end too: no bolts; bolted, no latches
    expect(scene.components.map(part => part.id)).not.toContain('coupling-bolts');
    expect(scene.components.map(part => part.id)).not.toContain('port-bolts');
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
    for (const angleJoint of ['cube-corner', 'angle-collar', 'mitred-ends'] as const) {
      // (a collar's or a mitre's route turns where the run out from the wall ends: there, the port's line)
      const right = preset('right-angle');
      const l = tunnelLayout({ ...right, angleJoint, approach: angleJoint === 'cube-corner' ? right.approach : right.portY - TUNNEL.wallGap }, site);
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
    expect(settings.config.angleJoint).toBe(TUNNEL_DEFAULT.angleJoint);
    expect(settings.views.modular).toMatchObject({ progress: 2, view: 'Top' });
    // a tunnel saved before the standard elements: its route and its joints as saved, its longest section the nearest whole pitches
    for (const [sectionLength, pitches] of [[500, 1], [750, 2], [1000, 2]] as const) {
      const old = parseSubassemblySettings(tunnelDefinition, JSON.stringify({ version: 1, config: { ...TUNNEL_DEFAULT, angleJoint: 'angle-collar', portX: 1200, portY: 3000, sectionLength } }));
      expect(old.config).toMatchObject({ angleJoint: 'angle-collar', portX: 1200, portY: 3000, sectionLength: pitches });
      // laid out on whole elements: the brief says where that puts the port
      expect(tunnelLayout(old.config, site).moved).toBeGreaterThan(PORT_MOVED);
    }
    // off a step is not accepted either
    expect(parseSubassemblySettings(tunnelDefinition, JSON.stringify({ version: 1, config: { ...TUNNEL_DEFAULT, portHeight: 657.3 } })).config.portHeight).toBe(TUNNEL_DEFAULT.portHeight);
  });
});

describe('tunnel: the rest of the standard elements', () => {
  it('stands every cube’s floor door on a prop, clamped between it and the cube, clear of its buttons and latches', () => {
    for (const doorFixing of ['latches', 'turn-buttons'] as const) for (const config of [TUNNEL_DEFAULT, { ...TUNNEL_DEFAULT, straights: 'cubes' as const }]) {
      const l = tunnelLayout(config, site, { ...TUNNEL_COUPLING_DEFAULT, doorFixing });
      expect(l.errors).toEqual([]);
      const floors = l.doors.filter(d => d.face === 'bottom');
      expect(l.props).toHaveLength(floors.length);
      for (const prop of l.props) {
        const piece = l.pieces.find(p => p.id === prop.piece); const door = floors.find(d => d.piece === prop.piece); if (!piece?.cube || !door) throw new Error(prop.id);
        // its top on the floor door's outer face, its foot on its slab
        expect(prop.top).toBeCloseTo(piece.cube.centre[2] - l.cubeEdge / 2 - door.door.front, 9);
        expect(prop.slabTop + prop.length).toBeCloseTo(prop.top, 9);
        // nothing of the door's that stands proud of its face is over the prop
        for (const b of door.door.buttons) expect(Math.max(Math.abs(b.pivot[0]), Math.abs(b.pivot[1] - l.w / 2)) - b.reach, b.id).toBeGreaterThan(TUNNEL.floorProp / 2);
        for (const q of door.latches) expect(Math.hypot(q.at[0] - prop.at[0], q.at[1] - prop.at[1])).toBeGreaterThan(TUNNEL.floorProp);
      }
      const lines = tunnelBom('modular', config, site, { ...TUNNEL_COUPLING_DEFAULT, doorFixing });
      expect(lines.filter(line => line.name === 'Floor prop').reduce((n, line) => n + line.quantity, 0)).toBe(l.props.length);
    }
  });

  it('offers only what cube corners can make for the port’s facing, and any facing with collars', () => {
    const facing = (config: TunnelConfig) => TUNNEL_CONTROLS.filter(c => c.key === 'portFacing' && (!c.when || c.when(config)));
    const cube = facing(TUNNEL_DEFAULT); expect(cube).toHaveLength(1);
    expect(cube[0]?.range).toBeUndefined(); expect(cube[0]?.options.map(o => o.value)).toEqual([-90, 0, 90]);
    const collar = facing({ ...TUNNEL_DEFAULT, angleJoint: 'angle-collar' }); expect(collar).toHaveLength(1); expect(collar[0]?.range).toBeDefined();
    // a facing saved at another angle stays saved, and is laid out at the nearest a cube makes
    const saved = parseSubassemblySettings(tunnelDefinition, JSON.stringify({ version: 1, config: { ...TUNNEL_DEFAULT, portFacing: 37 } })).config;
    expect(saved.portFacing).toBe(37);
    expect(tunnelLayout(saved, site).facingMoved).toBeCloseTo(37, 9);
  });

  it('gives a mitred section side access in the square part of its side, meshing the rest', () => {
    const routes2 = [{ ...ROUTE, angleJoint: 'mitred-ends' as const, sideAccess: 'all' as const }, { ...ROUTE, angleJoint: 'mitred-ends' as const, sideAccess: 'all' as const, sideAccessSide: 'left' as const }];
    let mitred = 0; let beside = 0;
    for (const config of routes2) {
      const l = tunnelLayout(config, site);
      expect(l.errors).toEqual([]);
      for (const a of l.access) {
        const p = l.pieces.find(q => q.id === a.piece); if (!p) throw new Error(a.id);
        const square = vec.dot(p.start.n, p.frame.y) > 1 - 1e-9 && vec.dot(p.end.n, p.frame.y) > 1 - 1e-9;
        if (square) continue;
        mitred++;
        // within the flanges' inner faces all the way up the side, in the depth of the rails
        const outer = l.w / 2 + TUNNEL.rail; const side = a.side;
        for (const u of [side * l.w / 2, side * outer]) for (const v of [-TUNNEL.floor - TUNNEL.rail, l.h + TUNNEL.rail]) {
          expect(vec.dot(vec.sub(facePoint(p.start, u, v, TUNNEL.flange.thickness), p.start.at), p.frame.y)).toBeLessThanOrEqual(a.span[0] + 1e-9);
          expect(vec.dot(vec.sub(facePoint(p.end, u, v, -TUNNEL.flange.thickness), p.start.at), p.frame.y)).toBeGreaterThanOrEqual(a.span[1] - 1e-9);
        }
        expect(a.span[1] - a.span[0]).toBeGreaterThanOrEqual(TUNNEL.access.minLength);
        // and where a mitre leans away from the panel, the side is meshed between them
        if (l.panels.some(panel => panel.piece === p.id && panel.id.includes('-mesh-beside-'))) beside++;
      }
    }
    expect(beside).toBeGreaterThan(0);
    expect(mitred).toBeGreaterThan(0);
  });

  it('shows the enclosure’s own cat-port panel at the far end, seated, with removable panels', () => {
    const scene = createTunnelScene('modular', TUNNEL_DEFAULT, site);
    if (site.window.closure === 'removable-panel') {
      expect(scene.enclosureClosure).not.toBeNull();
      expect(scene.components.map(c => c.id)).toEqual(expect.arrayContaining(['enclosure-port-closure', 'enclosure-port-closure-mesh', 'enclosure-port-closure-hardware']));
    } else expect(scene.enclosureClosure).toBeNull();
    scene.dispose();
  });
});
