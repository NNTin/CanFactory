import { describe, expect, it } from 'vitest';
import { CATIO_MESH_PARTS, findPart, partUsage, toggleLatchMechanism as TL, tunnelTunnelCouplingConcept } from '@canfactory/contracts';
import { fastenerClashes, LATCH_SCREW_CLEARANCE, MODULAR_DEFAULT, PRINTED_LATCH, PRINTED_LATCH_JOINT, sidePortLength, TUNNEL, TUNNEL_COUPLING, TUNNEL_COUPLING_CONTROLS, TUNNEL_COUPLING_DECISIONS, TUNNEL_COUPLING_DEFAULT, TUNNEL_DEFAULT, tunnelCouplingBom, tunnelCouplingFacts, tunnelCouplingLayout, tunnelCouplingSteps, tunnelSiteFor, vec, WINDOW_INSERT_DEFAULT, type TunnelConfig, type TunnelCouplingConfig, type TunnelCouplingSite, type V3 } from './index.ts';

const base = tunnelSiteFor(WINDOW_INSERT_DEFAULT, MODULAR_DEFAULT);
const site: TunnelCouplingSite = { tunnel: TUNNEL_DEFAULT, site: base };
/** The tunnel meshed with welded wire mesh instead of the default net. */
const welded: TunnelCouplingSite = { tunnel: { ...TUNNEL_DEFAULT, mesh: 'welded' }, site: base };
/** Every option of every control, one at a time, from the defaults, and bolted with every count. */
// (gravity only needs self-standing supports)
// (the joint shown has a test of its own)
const configs: TunnelCouplingConfig[] = [TUNNEL_COUPLING_DEFAULT, ...TUNNEL_COUPLING_CONTROLS.filter(control => control.key !== 'jointShown').flatMap(control => control.options.map(option => ({ ...TUNNEL_COUPLING_DEFAULT, [control.key]: option.value })))
  .map(config => config.supportFixing === 'gravity' ? { ...config, supportBase: 'self-standing' as const } : config),
  ...([4, 8] as const).map(boltsPerCoupling => ({ ...TUNNEL_COUPLING_DEFAULT, mechanism: 'bolts' as const, boltsPerCoupling }))];
/** The tunnel's sections at every length, with its feet, and the catio's smallest and largest clear tunnel. */
const sites: TunnelCouplingSite[] = [site, ...([1, 3] as const).map(sectionLength => ({ tunnel: { ...TUNNEL_DEFAULT, sectionLength }, site: base })),
  { tunnel: { ...TUNNEL_DEFAULT, footPad: 'ganter' } satisfies TunnelConfig, site: base }, welded,
  ...[[200, 200], [450, 450]].map(([w = 0, h = 0]) => ({ tunnel: TUNNEL_DEFAULT, site: { ...base, w, h } }))];
/** A section's length along the run: a whole number of pitches less the gap. */
const elementLength = (s: TunnelCouplingSite, config: TunnelCouplingConfig) => s.tunnel.sectionLength * (sidePortLength(s.site.w) + (config.mechanism === 'printed-latch' ? PRINTED_LATCH_JOINT.gap : 0)) - (config.mechanism === 'printed-latch' ? PRINTED_LATCH_JOINT.gap : 0);
const close = (a: V3, b: V3, digits = 6) => { for (const i of [0, 1, 2]) expect(a[i]).toBeCloseTo(b[i] ?? 0, digits); };

describe('tunnel–tunnel coupling', () => {
  it('joins two identical sections of the tunnel’s, on the support under the joint, at its own height', () => {
    for (const s of sites) for (const config of configs) {
      const l = tunnelCouplingLayout(config, s);
      expect(l.errors, `${JSON.stringify(config)} ${JSON.stringify(s.tunnel.sectionLength)} ${s.site.w}`).toEqual([]);
      // sections of the tunnel's longest length, straight on, each with its end bay's two side doors
      expect(l.before.length).toBeCloseTo(elementLength(s, config), 9); expect(l.after.length).toBeCloseTo(elementLength(s, config), 9);
      expect(l.before.kind).toBe('section'); expect(l.after.kind).toBe('section'); expect(l.side).toBe(false);
      expect(l.tl.doors.filter(d => l.pieces.includes(d.piece)).map(d => d.at).sort()).toEqual(['left', 'left', 'right', 'right']);
      // straight on and level, the floor at the page's height wherever the window insert puts the window port
      expect(l.before.frame.y).toEqual(l.after.frame.y); expect(l.before.pitch).toBe(0);
      expect(l.before.start.at[2]).toBe(TUNNEL_COUPLING.floor);
      // the second starts the gap after the first: 3 mm latched, flange to flange bolted
      const gap = config.mechanism === 'printed-latch' ? PRINTED_LATCH_JOINT.gap : 0;
      expect(l.coupling.kind).toBe(config.mechanism === 'printed-latch' ? 'latched' : 'bolted');
      expect(vec.len(vec.sub(l.after.start.at, l.before.end.at))).toBeCloseTo(gap, 9);
      // the bearer is under the middle of the gap and carries both flanges, two screws up into each
      expect(l.support.at[1]).toBeCloseTo(l.coupling.face.at[1] - gap / 2, 9);
      expect(l.support.top).toBeCloseTo(TUNNEL_COUPLING.floor - TUNNEL.flange.width, 6);
      expect(l.fixings).toHaveLength(config.supportFixing === 'screws' ? 4 : 0);
      for (const f of l.fixings) {
        const into = f.at[1] < l.coupling.face.at[1] ? l.before.end.at[1] - TUNNEL.flange.thickness / 2 : l.after.start.at[1] + TUNNEL.flange.thickness / 2;
        expect(f.at[1]).toBeCloseTo(into, 9); expect(f.direction).toEqual([0, 0, 1]);
      }
      expect(l.support.kind).toBe('trestle');
    }
  });

  it('puts each printed latch across the gap with the shared mechanism: base and catch on the two flanges, in line, pulling along the tunnel', () => {
    for (const s of sites) for (const jointShown of ['end-end', 'end-side'] as const) for (const latchesPerSide of [1, 2, 3] as const) {
      const l = tunnelCouplingLayout({ ...TUNNEL_COUPLING_DEFAULT, latchesPerSide, jointShown }, s);
      expect(l.latches).toHaveLength(jointShown === 'end-side' ? 2 : 2 * latchesPerSide); expect(l.bolts).toEqual([]);
      const face = l.coupling.face; const T = TUNNEL.flange.thickness;
      // locked, the plates stand as far apart as the over-centre lock sets them; each reaches as far into the gap
      expect(PRINTED_LATCH.locked).toBeCloseTo(-TL.tautLink(TL.CLOSED).offset, 9);
      expect(2 * PRINTED_LATCH.overhang + PRINTED_LATCH.locked).toBeCloseTo(l.gap, 9);
      for (const q of l.latches) {
        // seen from outside, each flange has its base plates on its left: the first's on the right of the tunnel looking along it,
        // pulling back towards it; the second's on the left, pulling on along the tunnel
        expect(q.base).toBe(q.side > 0 ? 'outside' : 'port');
        expect(q.pull.map(c => Math.round(c * 1e9) / 1e9 + 0)).toEqual(q.base === 'outside' ? [0, -1, 0] : [0, 1, 0]);
        // on the stiles' outer sides; where an end butts into a side opening, two on the head, lying on the top across the joint
        if (jointShown === 'end-side') { expect(Math.abs(q.at[0])).toBeCloseTo(0.3 * l.w, 9); expect(q.at[2]).toBeCloseTo(TUNNEL_COUPLING.floor + l.h + TUNNEL.flange.width, 9); expect(q.out[2]).toBeCloseTo(1, 12); }
        else { expect(Math.abs(q.at[0])).toBeCloseTo(l.w / 2 + TUNNEL.flange.width, 9); expect(q.out[0]).toBeCloseTo(q.side, 12); }
        // the seam is `overhang` proud of the face of the flange with the base plate; that plate lies within the flange's thickness
        const first = face.at[1] - l.gap;
        expect(q.at[1] - (q.base === 'outside' ? first : face.at[1])).toBeCloseTo(q.base === 'outside' ? PRINTED_LATCH.overhang : -PRINTED_LATCH.overhang, 9);
        expect(PRINTED_LATCH.along - PRINTED_LATCH.overhang).toBeLessThanOrEqual(T);
        // standing on the frame's side, clear of the bearer under it and of its top
        if (jointShown === 'end-end') {
          expect(q.at[2] - PRINTED_LATCH.length / 2).toBeGreaterThan(l.support.top);
          expect(q.at[2] + PRINTED_LATCH.length / 2).toBeLessThan(TUNNEL_COUPLING.floor + l.h + TUNNEL.flange.width);
        }
      }
      // two screws through each plate, at least 5 mm into its flange's timber, and clear of the bearer's screws and the rails'
      expect(l.latchScrews).toHaveLength(4 * l.latches.length);
      for (const f of l.latchScrews) {
        expect(f.partId).toBe('din-7997-4x25');
        const q = l.latches.find(k => k.id === f.of);
        const onFirst = (f.component === 'latch-screws') === (q?.base === 'outside');
        const depth = onFirst ? (face.at[1] - l.gap) - f.at[1] : f.at[1] - face.at[1];
        expect(f.piece).toBe(onFirst ? l.before.id : l.after.id);
        expect(depth, f.use).toBeGreaterThan(5);
        expect(depth, f.use).toBeLessThan(TUNNEL.flange.thickness);
      }
      const others = l.tl.fasteners.filter(f => (f.component === 'flange-screws' || f.component === 'rail-screws') && (f.piece === undefined || l.pieces.includes(f.piece)) && Math.abs(f.at[1] - face.at[1]) < 100);
      expect(others.length).toBeGreaterThan(4);
      expect(fastenerClashes(l.latchScrews, others, LATCH_SCREW_CLEARANCE)).toEqual([]);
      expect(fastenerClashes(others, l.latchScrews, LATCH_SCREW_CLEARANCE)).toEqual([]);
    }
  });

  it('bolts the flanges face to face at the standard port’s stations, the same on all four sides', () => {
    for (const jointShown of ['end-end', 'end-side'] as const) for (const boltsPerCoupling of [4, 8, 12] as const) {
      const l = tunnelCouplingLayout({ ...TUNNEL_COUPLING_DEFAULT, mechanism: 'bolts', boltsPerCoupling, jointShown }, site);
      expect(l.gap).toBe(0); expect(l.latches).toEqual([]); expect(l.seal).toBeNull();
      expect(l.bolts).toHaveLength(boltsPerCoupling);
      // through both frames, on their middle line round the opening
      const face = l.coupling.face; const local = (q: V3) => [vec.dot(vec.sub(q, face.at), face.frame.x), vec.dot(vec.sub(q, face.at), face.frame.z)] as const;
      for (const b of l.bolts) {
        close(b.n, face.n, 9); const [u, v] = local(b.at);
        expect(Math.max(Math.abs(u) - l.w / 2, v - l.h, -v)).toBeCloseTo(TUNNEL.flange.width / 2, 6);
      }
      const sides = [l.bolts.filter(b => local(b.at)[0] < -l.w / 2), l.bolts.filter(b => local(b.at)[0] > l.w / 2), l.bolts.filter(b => local(b.at)[1] > l.h), l.bolts.filter(b => local(b.at)[1] < 0)];
      expect(sides.map(q => q.length)).toEqual([1, 1, 1, 1].map(() => boltsPerCoupling / 4));
    }
  });

  it('builds its decisions from the sizes it uses', () => {
    const text = TUNNEL_COUPLING_DECISIONS.map(d => `${d.choice} ${d.why}`).join(' ');
    expect(text).toContain(`stand ${PRINTED_LATCH_JOINT.gap} mm apart`);
    expect(text).toContain(`${Number(PRINTED_LATCH.locked.toFixed(1))} mm apart`);
    expect(text).toContain(`${Number(PRINTED_LATCH.overhang.toFixed(1))} mm proud`);
    expect(text).toContain(`${TUNNEL_COUPLING_DEFAULT.boltsPerCoupling} ISO 4017 M8 × 80 bolts`);
    expect(TUNNEL_COUPLING_DECISIONS.map(d => d.title)).toEqual(expect.arrayContaining(['No locating pins: the bearer locates', 'One standard port, coupled or closed']));
    expect(text).toContain('base plates on its left side and their catch plates on its right');
    for (const d of TUNNEL_COUPLING_DECISIONS) if (d.parameter) expect(TUNNEL_COUPLING_CONTROLS.map(c => c.label), d.title).toContain(d.parameter);
  });

  it('shows a section’s end meeting a side port at a turn the same as two sections’ ends', () => {
    for (const [jointShown, second] of [['end-end', 'section'], ['end-side', 'section with a side port']] as const) for (const mechanism of ['printed-latch', 'bolts'] as const) for (const s of sites) {
      const config = { ...TUNNEL_COUPLING_DEFAULT, jointShown, mechanism };
      const l = tunnelCouplingLayout(config, s);
      expect(l.errors, jointShown).toEqual([]);
      expect([l.first, l.second]).toEqual(['section', second]);
      expect(l.coupling.kind).toBe(mechanism === 'printed-latch' ? 'latched' : 'bolted');
      expect(l.coupling.latches).toHaveLength(mechanism === 'printed-latch' ? (jointShown === 'end-side' ? 2 : 2 * config.latchesPerSide) : 0);
      // the same port either way: the first one's end the gap from the second one's port, its start or its side port
      const port = jointShown === 'end-side' ? l.after.sidePort?.face : l.after.start; if (!port) throw new Error(jointShown);
      expect(vec.len(vec.sub(port.at, l.before.end.at))).toBeCloseTo(l.gap, 9);
      expect(l.after.sidePort?.from ?? null).toBe(jointShown === 'end-side' ? l.before.id : null);
      // at a turn, square across the first; the stub's end closed by its door
      expect(vec.dot(l.before.frame.y, l.after.frame.y)).toBeCloseTo(jointShown === 'end-side' ? 0 : 1, 9);
      expect(l.tl.doors.filter(d => l.pieces.includes(d.piece))).toHaveLength(4);
      expect(l.before.length).toBeCloseTo(elementLength(s, config), 9); expect(l.after.length).toBeCloseTo(elementLength(s, config), 9);
      expect(tunnelCouplingFacts('modular', config, s).find(f => f.label === 'Joint shown')?.value).toBe(`${jointShown === 'end-side' ? 'Section end to a side port' : 'Section end to section end'}: the standard port either way`);
      expect(tunnelCouplingSteps('modular', config, s).map(q => q.title)).toEqual(expect.arrayContaining(['Build one section', `The second ${second} comes in`]));
    }
    // its parts: nothing on the second section's side but its end bay's bay posts, and its doors
    const side = tunnelCouplingBom('modular', { ...TUNNEL_COUPLING_DEFAULT, jointShown: 'end-side' }, site);
    expect(side.find(line => line.name === 'Bay post')?.quantity).toBe(4);
    expect(side.filter(line => line.name.startsWith('Flange')).reduce((n, line) => n + line.quantity, 0)).toBe(16);
    expect(side.some(line => line.name === 'Door turn button, printed (custom)')).toBe(true);
  });

  it('names where the section length is set, and what the joint is', () => {
    const facts = tunnelCouplingFacts('modular', TUNNEL_COUPLING_DEFAULT, site);
    expect(facts.find(f => f.label === 'Gap · seal')?.value).toBe('3 mm · squashed from 4 mm');
    expect(facts.find(f => f.label === 'Section length')).toMatchObject({ value: `${Number((elementLength(site, TUNNEL_COUPLING_DEFAULT) / 10).toFixed(1))} cm · the longest section`, from: { page: 'tunnel', settings: ['sectionLength'] } });
    expect(facts.find(f => f.label === 'Enclosure end')?.value).toBe('Latched: a standard port like every other');
    expect(facts.find(f => f.label === 'Doors · held by')?.value).toBe('4 on these two sections, every opening not coupled · set in, turn buttons on the port’s ring');
    expect(tunnelCouplingFacts('modular', { ...TUNNEL_COUPLING_DEFAULT, doorFixing: 'latches', jointShown: 'end-side' }, site).find(f => f.label === 'Doors · held by')?.value).toBe('4 on these two sections, every opening not coupled · a blank on the port’s own toggle latches');
    expect(tunnelCouplingFacts('modular', { ...TUNNEL_COUPLING_DEFAULT, seal: 'none' }, site).find(f => f.label === 'Gap · seal')?.value).toBe('3 mm · left open');
    expect(tunnelCouplingFacts('modular', { ...TUNNEL_COUPLING_DEFAULT, mechanism: 'bolts' }, site).find(f => f.label === 'Bolts per coupling')?.value).toMatch(/^8 × ISO 4017 M8 × 80/);
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
        // the joint's, and the doors' when they are blanks on the latches
        const doorLatches = l.tl.doors.filter(d => l.pieces.includes(d.piece)).reduce((n, d) => n + d.latches.length, 0);
        expect(lines.find(line => line.modelId === 'toggle-latch')).toMatchObject({ quantity: 2 * config.latchesPerSide + doorLatches, name: 'Toggle latch, printed' });
        // two through each latch plate, and the doors' turn buttons' pivots, the same screw
        expect(count('din-7997-4x25')).toBe(8 * config.latchesPerSide + l.tl.doors.filter(d => l.pieces.includes(d.piece)).reduce((n, d) => n + d.door.fasteners.filter(f => f.partId === 'din-7997-4x25').length + 4 * d.latches.length, 0));
        expect(lines.some(line => line.id === 'coupling-seal')).toBe(config.seal === 'e-profile');
        expect(count('iso-4017-m8x80')).toBe(0);
      } else {
        expect(count('iso-4017-m8x80')).toBe(config.boltsPerCoupling); expect(count('iso-7093-m8')).toBe(2 * config.boltsPerCoupling); expect(count('iso-4032-m8')).toBe(config.boltsPerCoupling);
        expect(lines.some(line => line.modelId)).toBe(false);
      }
      // two flange rings per section, four rails, a floor board; one net hood each, or three welded mesh panels, cut from one roll
      expect(lines.filter(line => line.name.startsWith('Flange')).reduce((n, line) => n + line.quantity, 0)).toBe(16);
      expect(lines.filter(line => line.name === 'Section rail').reduce((n, line) => n + line.quantity, 0)).toBe(8);
      expect(lines.filter(line => line.name === 'Floor board').reduce((n, line) => n + line.quantity, 0)).toBe(2);
      const roll = lines.filter(line => line.group === 'Mesh' && line.partId);
      expect(roll).toMatchObject([{ quantity: 1, partId: CATIO_MESH_PARTS[s.tunnel.mesh] }]);
      expect(roll[0]?.use).toContain('more rolls may be needed');
      // each section's end bay has a door each side, its own mesh; beyond the bay a piece of mesh each side, and the roof or hood
      const doors = l.tl.doors.filter(d => l.pieces.includes(d.piece)).length; expect(doors).toBe(4);
      const beside = l.tl.panels.filter(q => l.pieces.includes(q.piece) && q.id.includes('-mesh-beside-')).length;
      expect(lines.filter(line => line.name === 'Removable panel mesh').reduce((n, line) => n + line.quantity, 0)).toBe(doors);
      expect(lines.filter(line => line.group === 'Mesh' && !line.partId && line.name !== 'Removable panel mesh').reduce((n, line) => n + line.quantity, 0)).toBe(2 + beside);
      expect(lines.some(line => line.name === 'Net hood')).toBe(s.tunnel.mesh === 'netting');
      expect(lines.find(line => line.name === 'Floor board')?.size).toContain(`${Math.round(l.sectionLength - 2 * TUNNEL.flange.thickness)}`);
    }
  });

  it('counts the two sections’ frames, bay posts and doors, and the doors’ latches or turn buttons, at a turn', () => {
    for (const config of configs.map(c => ({ ...c, jointShown: 'end-side' as const }))) {
      const l = tunnelCouplingLayout(config, site); const lines = tunnelCouplingBom('modular', config, site);
      // the first section's two side doors; the second's start and the end bay's other side
      const doors = l.tl.doors.filter(d => l.pieces.includes(d.piece)); expect(doors).toHaveLength(4);
      expect(doors.filter(d => d.piece === l.after.id).map(d => d.at).sort()).toEqual(['start', l.after.sidePort?.side === 1 ? 'left' : 'right'].sort());
      // two sections' end frames, four members each, and nothing on a side; a bay post each side of each end bay
      expect(lines.filter(line => line.name.startsWith('Flange')).reduce((n, line) => n + line.quantity, 0)).toBe(16);
      expect(lines.find(line => line.name === 'Bay post')?.quantity).toBe(l.tl.members.filter(m => l.pieces.includes(m.piece) && m.kind === 'post').length);
      expect(lines.filter(line => line.name === 'Removable panel mesh').reduce((n, line) => n + line.quantity, 0)).toBe(doors.length);
      const latches = lines.find(line => line.modelId === 'toggle-latch')?.quantity ?? 0;
      // two on the head at the joint itself
      const joint = config.mechanism === 'printed-latch' ? 2 : 0;
      expect(latches).toBe(joint + doors.reduce((n, d) => n + d.latches.length, 0));
      expect(lines.filter(line => line.name === 'Door turn button, printed (custom)').reduce((n, line) => n + line.quantity, 0)).toBe(config.doorFixing === 'turn-buttons' ? doors.reduce((n, d) => n + d.door.buttons.length, 0) : 0);
    }
  });

  it('links every library part it can use back to this page in the parts library', () => {
    const used = new Set([site, welded].flatMap(s => configs.flatMap(config => [config, { ...config, jointShown: 'end-side' as const }]).flatMap(config => tunnelCouplingBom('modular', config, s))).flatMap(line => line.partId ? [line.partId] : []));
    expect([...used].sort()).toEqual([...new Set(tunnelTunnelCouplingConcept.parts.map(link => link.partId))].sort());
    for (const id of used) {
      const p = findPart(id); if (!p) throw new Error(id);
      expect(partUsage(p).filter(use => use.kind === 'concept').map(use => use.modelId), id).toContain('catio/tunnel-tunnel-coupling');
    }
  });
});
